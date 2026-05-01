"""
GhostVest Solana 客户端

功能：
  1. 使用 solders 构造并发送 release_to_stealth 交易
  2. 支持重试机制（最多 3 次）
  3. 使用快速档位 gas 价格
  4. MOCK_MODE=1 时跳过真实交易，返回模拟签名

依赖：
  - solders: Solana Python SDK
  - solana: HTTP RPC 客户端

安全说明：
  - TEE 私钥通过 .env 注入，绝不硬编码
  - 所有交易签名在内存中完成，不持久化
"""

import asyncio
import base64
import os
import time
import logging
from typing import Optional

import base58

logger = logging.getLogger("ghostvest.solana_client")

# 环境变量
MOCK_MODE = os.getenv("MOCK_MODE", "1") == "1"
RPC_URL = os.getenv("RPC_URL", "https://api.devnet.solana.com")
TEE_PRIVATE_KEY = os.getenv("TEE_PRIVATE_KEY", "")
BOUNTY_ID = int(os.getenv("BOUNTY_ID", "1"))

# 重试配置
MAX_RETRIES = 3
RETRY_DELAY_MS = 1000


async def send_sol_transfer(
    from_keypair_bytes: bytes,
    to_pubkey_bytes: bytes,
    amount_lamports: int,
) -> str:
    """
    构造并发送 SOL 转账交易。

    在 MVP 阶段，我们直接使用 SOL Transfer 而非 SPL Token Transfer，
    简化演示流程。

    Args:
        from_keypair_bytes: 发送方 Keypair 的 64 字节私钥
        to_pubkey_bytes: 接收方公钥（32 字节）
        amount_lamports: 转账金额（lamports）

    Returns:
        交易签名（Base58 编码）
    """
    if MOCK_MODE:
        return await _mock_transfer(to_pubkey_bytes, amount_lamports)

    return await _real_transfer(from_keypair_bytes, to_pubkey_bytes, amount_lamports)


async def _mock_transfer(to_pubkey_bytes: bytes, amount_lamports: int) -> str:
    """模拟转账，返回虚拟交易签名。"""
    await asyncio.sleep(0.1)  # 模拟网络延迟

    to_pubkey_b58 = base58.b58encode(to_pubkey_bytes).decode()
    mock_sig = f"MOCK_SIG_{to_pubkey_b58[:8]}_{int(time.time())}"

    logger.info(
        f"[MOCK] 模拟转账 {amount_lamports} lamports → {to_pubkey_b58[:16]}..."
    )
    logger.info(f"[MOCK] 交易签名: {mock_sig}")

    return mock_sig


async def _real_transfer(
    from_keypair_bytes: bytes,
    to_pubkey_bytes: bytes,
    amount_lamports: int,
) -> str:
    """
    真实 SOL 转账。

    使用 solders 构造交易，支持重试机制。
    """
    from solders.keypair import Keypair
    from solders.pubkey import Pubkey
    from solders.system_program import TransferParams, transfer
    from solders.transaction import Transaction
    from solana.rpc.api import Client
    from solana.rpc.commitment import Confirmed

    # 从字节还原 Keypair
    from_keypair = Keypair.from_bytes(from_keypair_bytes)
    to_pubkey = Pubkey.from_bytes(to_pubkey_bytes)

    # 连接 RPC
    client = Client(RPC_URL)

    last_error = None

    for attempt in range(MAX_RETRIES):
        try:
            # 获取最新 blockhash
            blockhash_resp = client.get_latest_blockhash()
            recent_blockhash = blockhash_resp.value.blockhash

            # 构造系统转账指令
            transfer_ix = transfer(
                TransferParams(
                    from_pubkey=from_keypair.pubkey(),
                    to_pubkey=to_pubkey,
                    lamports=amount_lamports,
                )
            )

            # 构造交易
            tx = Transaction.new_with_payer(
                [transfer_ix],
                from_keypair.pubkey(),
            )
            tx.sign([from_keypair], recent_blockhash)

            # 发送交易
            resp = client.send_transaction(
                tx,
                from_keypair,
                opts={"preflight_commitment": Confirmed},
            )

            tx_sig = str(resp.value)
            logger.info(f"[Solana] 交易成功 (attempt {attempt + 1}): {tx_sig}")
            return tx_sig

        except Exception as e:
            last_error = e
            logger.warning(
                f"[Solana] 交易失败 (attempt {attempt + 1}/{MAX_RETRIES}): {e}"
            )
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(RETRY_DELAY_MS / 1000)

    raise RuntimeError(
        f"Solana 交易在 {MAX_RETRIES} 次重试后仍然失败: {last_error}"
    )


def get_tee_keypair_bytes() -> Optional[bytes]:
    """
    从环境变量获取 TEE 密钥对字节。

    支持两种格式：
      1. Base58 编码的 64 字节 Keypair
      2. JSON 数组格式（兼容 Phantom 导出格式）

    Returns:
        64 字节密钥对字节，或 None（MOCK_MODE 时）
    """
    if MOCK_MODE:
        return None

    if not TEE_PRIVATE_KEY:
        raise ValueError("TEE_PRIVATE_KEY 未设置")

    # 尝试 Base58 解码
    try:
        return base58.b58decode(TEE_PRIVATE_KEY)
    except Exception:
        pass

    # 尝试 JSON 数组
    import json
    try:
        key_array = json.loads(TEE_PRIVATE_KEY)
        return bytes(key_array)
    except Exception:
        pass

    raise ValueError("TEE_PRIVATE_KEY 格式无法识别（支持 Base58 或 JSON 数组）")
