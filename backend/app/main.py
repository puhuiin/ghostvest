"""
GhostVest TEE 模拟器后端

FastAPI 服务，提供以下路由：
  1. POST /submit_pr      — 提交 PR 链接，触发 AI 审核
  2. GET  /status/{task_id} — 查询任务状态
  3. POST /payout          — 获取链上交易链接（含 solscan_url）
  4. POST /mock_approve    — 强制通过审核（仅 MOCK_MODE 时可用）
  5. GET  /                — 健康检查

环境变量：
  - MOCK_MODE=1          — 启用 Mock 模式（默认开启）
  - USE_MOCK_AI=1        — AI 审核 Mock 开关（默认开启）
  - TEE_PRIVATE_KEY      — TEE 预言机私钥（Base58 或 JSON 数组）
  - RPC_URL              — Solana RPC 节点地址
  - BOUNTY_ID            — 当前 Bounty ID
  - ANTHROPIC_API_KEY    — Claude API Key（可选）

启动命令：
  cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

import asyncio
import os
import time
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from rich.console import Console
from rich.text import Text

from app.models import (
    BountyTask,
    HealthResponse,
    MockApproveRequest,
    MockApproveResponse,
    PayoutResponse,
    StatusResponse,
    SubmitPRRequest,
    SubmitPRResponse,
    TaskStatus,
)
from app.crypto_utils import (
    derive_stealth_keypair,
    generate_nonce,
    keypair_to_bytes,
)
from app.services.pr_analyzer import audit_pr
from app.services.solana_client import send_sol_transfer, get_tee_keypair_bytes
from app.services.zero_g_service import store_encrypted_nonce, retrieve_encrypted_nonce

import base58
from solders.pubkey import Pubkey

# =================================================================
# Rich 终端日志
# =================================================================

console = Console(force_terminal=True, color_system="truecolor")


def _ts() -> str:
    return datetime.now().strftime("%H:%M:%S.%f")[:-3]


def log_ok(msg: str) -> None:
    t = Text()
    t.append(f"{_ts()} ", style="dim")
    t.append("[bold green][+][/] ")
    t.append(msg, style="green")
    console.print(t)


def log_step(msg: str) -> None:
    t = Text()
    t.append(f"{_ts()} ", style="dim")
    t.append("[bold blue][*][/] ")
    t.append(msg, style="blue")
    console.print(t)


def log_wait(msg: str) -> None:
    t = Text()
    t.append(f"{_ts()} ", style="dim")
    t.append("[bold yellow][~][/] ")
    t.append(msg, style="yellow")
    console.print(t)


def log_err(msg: str) -> None:
    t = Text()
    t.append(f"{_ts()} ", style="dim")
    t.append("[bold red][!][/] ")
    t.append(msg, style="red")
    console.print(t)


def log_info(msg: str) -> None:
    t = Text()
    t.append(f"{_ts()} ", style="dim")
    t.append("[bold cyan][#][/] ")
    t.append(msg, style="cyan")
    console.print(t)

# =================================================================
# 环境变量
# =================================================================

MOCK_MODE = os.getenv("MOCK_MODE", "1") == "1"
AMOUNT_LAMPORTS = int(os.getenv("AMOUNT_LAMPORTS", "1000000"))  # 0.001 SOL

SOLSCAN_BASE = "https://solscan.io"
EXPLORER_BASE = "https://explorer.solana.com"

# =================================================================
# FastAPI 应用
# =================================================================

app = FastAPI(
    title="GhostVest TEE Simulator",
    description="GhostVest 隐私薪酬协议 TEE 预言机模拟器",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =================================================================
# 内存数据存储（MVP 阶段，无需数据库）
# =================================================================

tasks_db: dict[str, BountyTask] = {}


# =================================================================
# 路由：健康检查
# =================================================================

@app.get("/", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="ok",
        service="GhostVest TEE Simulator",
        version="0.1.0",
        mock_mode=MOCK_MODE,
    )


# =================================================================
# 路由：提交 PR
# =================================================================

@app.post("/submit_pr", response_model=SubmitPRResponse)
async def submit_pr(request: SubmitPRRequest):
    log_info(f"收到请求: PR={request.pr_url}, Wallet={request.contributor_wallet[:16]}...")

    task = BountyTask(
        pr_url=request.pr_url,
        contributor_wallet=request.contributor_wallet,
        status=TaskStatus.PENDING,
    )
    tasks_db[task.task_id] = task

    asyncio.create_task(_audit_and_pay(task.task_id))

    log_step(f"任务创建: {task.task_id[:16]}...")

    return SubmitPRResponse(
        task_id=task.task_id,
        status=task.status,
        message="任务已提交，正在等待 AI 审核...",
    )


async def _audit_and_pay(task_id: str):
    task = tasks_db.get(task_id)
    if not task:
        log_err(f"任务不存在: {task_id}")
        return

    try:
        # Step 1: AI 审核
        task.update_status(TaskStatus.AUDITING)
        log_wait(f"AI Audit 开始审核: {task_id[:16]}...")

        audit_result = await audit_pr(task.pr_url)

        task.audit_score = audit_result["score"]
        log_ok(
            f"AI Audit Passed — score={audit_result['score']}, "
            f"auditor={audit_result['auditor']}, "
            f"duration={audit_result['duration_ms']}ms"
        )

        if not audit_result["approved"]:
            task.update_status(TaskStatus.REJECTED)
            log_err(f"审核未通过: {task_id[:16]}...")
            return

        # Step 2: 生成隐身地址
        log_step("Deriving Stealth Key…")
        nonce = generate_nonce()
        nonce_hex = nonce.hex()

        contributor_pubkey_bytes = base58.b58decode(task.contributor_wallet)
        contributor_pubkey = Pubkey.from_bytes(contributor_pubkey_bytes)

        stealth_kp = derive_stealth_keypair(nonce, contributor_pubkey)
        stealth_pubkey = stealth_kp.pubkey()
        stealth_address = str(stealth_pubkey)

        task.update_status(
            TaskStatus.APPROVED,
            nonce_hex=nonce_hex,
            stealth_address=stealth_address,
        )

        log_ok(f"隐身地址已生成: {stealth_address[:16]}...")
        log_info(f"Nonce: {nonce_hex[:16]}...")

        # Step 2.5: 存入 0G / fallback
        log_wait("Storing encrypted nonce to 0G…")
        storage_result = await store_encrypted_nonce(
            task_id=task_id,
            nonce_hex=nonce_hex,
            encrypted_payload={
                "stealth_address": stealth_address,
                "contributor": task.contributor_wallet,
            },
        )
        log_ok(f"Nonce stored — source={storage_result['source']}")

        # Step 3: 资金交割
        log_wait("Submitting to Solana Devnet…")
        tee_keypair_bytes = get_tee_keypair_bytes()
        stealth_keypair_bytes = keypair_to_bytes(stealth_kp)

        tx_sig = await send_sol_transfer(
            from_keypair_bytes=tee_keypair_bytes or stealth_keypair_bytes,
            to_pubkey_bytes=bytes(stealth_kp.pubkey()),
            amount_lamports=AMOUNT_LAMPORTS,
        )

        task.update_status(TaskStatus.PAID, tx_signature=tx_sig)
        log_ok(f"交易完成: {tx_sig[:32]}...")

    except Exception as e:
        log_err(f"任务处理失败: {task_id[:16]}... 错误: {e}")
        task.update_status(TaskStatus.FAILED, tx_signature=f"ERROR: {str(e)[:200]}")


# =================================================================
# 路由：查询状态
# =================================================================

@app.get("/status/{task_id}", response_model=StatusResponse)
async def get_status(task_id: str):
    task = tasks_db.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")

    return StatusResponse(
        task_id=task.task_id,
        status=task.status,
        pr_url=task.pr_url,
        contributor_wallet=task.contributor_wallet,
        stealth_address=task.stealth_address,
        nonce_hex=task.nonce_hex,
        tx_signature=task.tx_signature,
        audit_score=task.audit_score,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


# =================================================================
# 路由：Payout（获取链上交易链接 + solscan_url）
# =================================================================

@app.post("/payout", response_model=PayoutResponse)
async def payout(task_id: str):
    """
    前端 Claim 完成后调用此端点，获取 solscan_url 等链上信息。
    """
    task = tasks_db.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")

    if task.status != TaskStatus.PAID:
        raise HTTPException(
            status_code=400,
            detail=f"任务状态不是 PAID，当前: {task.status.value}",
        )

    solscan_url = None
    explorer_url = None
    if task.tx_signature and not task.tx_signature.startswith("ERROR"):
        solscan_url = f"{SOLSCAN_BASE}/tx/{task.tx_signature}?cluster=devnet"
        explorer_url = f"{EXPLORER_BASE}/tx/{task.tx_signature}?cluster=devnet"

    log_ok(f"Payout 查询: task={task_id[:16]}... solscan={solscan_url}")

    return PayoutResponse(
        task_id=task.task_id,
        status=task.status,
        tx_signature=task.tx_signature,
        solscan_url=solscan_url,
        explorer_url=explorer_url,
        stealth_address=task.stealth_address,
        amount_lamports=AMOUNT_LAMPORTS,
        message="链上交易已完成，请查看 Solscan 确认。",
    )


# =================================================================
# 路由：Mock 强制通过（仅 MOCK_MODE 时可用）
# =================================================================

@app.post("/mock_approve", response_model=MockApproveResponse)
async def mock_approve(request: MockApproveRequest):
    if not MOCK_MODE:
        raise HTTPException(
            status_code=403,
            detail="mock_approve 仅在 MOCK_MODE=1 时可用",
        )

    task = tasks_db.get(request.task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务不存在: {request.task_id}")

    nonce = generate_nonce()
    nonce_hex = nonce.hex()

    contributor_pubkey_bytes = base58.b58decode(task.contributor_wallet)
    contributor_pubkey = Pubkey.from_bytes(contributor_pubkey_bytes)

    stealth_kp = derive_stealth_keypair(nonce, contributor_pubkey)
    stealth_address = str(stealth_kp.pubkey())

    task.update_status(
        TaskStatus.APPROVED,
        nonce_hex=nonce_hex,
        stealth_address=stealth_address,
    )

    log_ok(f"Mock 强制通过: task={request.task_id[:16]}..., stealth={stealth_address[:16]}...")

    return MockApproveResponse(
        task_id=task.task_id,
        status=TaskStatus.APPROVED,
        nonce_hex=nonce_hex,
        stealth_address=stealth_address,
        message="Mock 审核通过，nonce 已生成",
    )


# =================================================================
# 启动事件
# =================================================================

@app.on_event("startup")
async def on_startup():
    log_ok("GhostVest TEE Simulator 启动")
    log_info(f"MOCK_MODE={MOCK_MODE}, USE_MOCK_AI={os.getenv('USE_MOCK_AI', 'True')}")
    log_info(f"AMOUNT_LAMPORTS={AMOUNT_LAMPORTS}")
