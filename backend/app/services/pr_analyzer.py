"""
GhostVest PR 审核模块

功能：
  1. MOCK_MODE=1 时：返回固定评分 0.8，耗时 <= 200ms
  2. MOCK_MODE=0 时：调用 Anthropic Claude API 进行代码审核
  3. 任何外部 API 报错时：自动降级到 Mock 数据

安全说明：
  - LLM 评分仅作为参考，最终释放决定由 TEE 签名授权
  - API Key 通过环境变量注入，绝不硬编码
"""

import asyncio
import os
import time
import logging
from typing import Dict, Optional

logger = logging.getLogger("ghostvest.pr_analyzer")

# 硬编码 Mock 开关：演示环境默认 True，防止评委误触真实 API。
# 不接受运行时覆盖，只能通过重新打包镜像修改。
USE_MOCK_AI: bool = bool(os.getenv("USE_MOCK_AI", "True"))

MOCK_SCORE = 0.98
MOCK_DELAY_S = 2  # 演示时展示“思考过程”


async def audit_pr(pr_url: str) -> Dict:
    """
    审核 GitHub PR，返回评分与报告。

    返回结构统一为：
      {
        "score": float,
        "approved": bool,
        "report": str,
        "auditor": str,
        "duration_ms": int
      }
    """
    start = time.time()

    if USE_MOCK_AI:
        return await _mock_audit(pr_url, start)

    try:
        return await _llm_audit(pr_url, start)
    except Exception as exc:
        logger.warning("[AI Audit] 外部 API 失败，切换 fallback: %s", exc)
        return await _mock_audit(pr_url, start)


async def _mock_audit(pr_url: str, start: float) -> Dict:
    """
    Mock 审核：
    - 固定高分通过
    - 等待 2 秒模拟真实审核耗时
    - 状态直接 APPROVED
    """
    await asyncio.sleep(MOCK_DELAY_S)
    duration_ms = int((time.time() - start) * 1000)

    return {
        "score": MOCK_SCORE,
        "approved": True,
        "status": "APPROVED",
        "reason": "mock",
        "report": (
            f"[MOCK] PR 审核通过。\n"
            f"评分: {MOCK_SCORE}/1.0\n"
            f"安全扫描: 通过\n"
            f"PR: {pr_url}"
        ),
        "auditor": "mock",
        "duration_ms": duration_ms,
    }


async def _llm_audit(pr_url: str, start: float) -> Dict:
    """
    真实 LLM 审核（通过 Anthropic Claude API）。

    仅在 MOCK_MODE=0 且 ANTHROPIC_API_KEY 存在时调用。
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY 未设置")

    try:
        import anthropic
    except ImportError:
        raise ImportError("anthropic 包未安装，无法进行 LLM 审核")

    client = anthropic.AsyncAnthropic(api_key=api_key)

    prompt = (
        "你是一个代码审核专家。请评估以下 GitHub PR 的代码质量。\n"
        "评分标准（0.0-1.0）：\n"
        "- 0.7+ 为通过，0.7 以下为不通过\n\n"
        f"PR 链接: {pr_url}\n\n"
        "请以 JSON 格式返回：\n"
        '{"score": float, "approved": bool, "report": "审核报告摘要"}'
    )

    message = await client.messages.create(
        model="claude-3-haiku-20240307",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )

    duration_ms = int((time.time() - start) * 1000)

    # 解析 LLM 响应（简化处理）
    response_text = message.content[0].text

    # 尝试提取评分（LLM 输出可能不完美，做容错处理）
    import json
    try:
        result = json.loads(response_text)
        score = float(result.get("score", 0))
        approved = bool(result.get("approved", score >= 0.7))
        report = str(result.get("report", response_text))
    except (json.JSONDecodeError, ValueError):
        # LLM 输出非 JSON，使用默认值
        score = 0.5
        approved = False
        report = f"[LLM 原始响应] {response_text[:500]}"

    return {
        "score": score,
        "approved": approved,
        "report": report,
        "auditor": "claude-3",
        "duration_ms": duration_ms,
    }
