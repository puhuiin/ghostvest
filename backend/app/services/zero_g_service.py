"""
GhostVest 0G Network 数据存储服务

功能：
  1. 将加密后的 nonce + 元数据写入 0G Network
  2. 从 0G Network 读取加密 nonce
  3. 0G 不可用时自动降级到本地 fallback.json
  4. 本地缓存 5 分钟有效，期间不再访问 0G

降级策略：
  try 0G → except → 写入 fallback.json → 后续优先读本地
"""

import json
import logging
import os
import time
from pathlib import Path
from typing import Dict, Optional

logger = logging.getLogger("ghostvest.zero_g")

# fallback.json 存储路径（项目根目录）
FALLBACK_PATH = Path(__file__).parent.parent.parent / "fallback.json"

# 缓存有效期（秒）
CACHE_TTL_S = 300  # 5 分钟

MOCK_MODE = os.getenv("MOCK_MODE", "1") == "1"


# =================================================================
# 写入操作
# =================================================================

async def store_encrypted_nonce(
    task_id: str,
    nonce_hex: str,
    encrypted_payload: Dict,
) -> Dict:
    """
    将加密 nonce 写入 0G Network，失败时降级到本地 fallback.json。

    Args:
        task_id: 任务 ID
        nonce_hex: 原始 nonce（十六进制，仅供 TEE 内部记录）
        encrypted_payload: 加密后的载荷（含 ciphertext、pk0 等）

    Returns:
        {"storage_hash": str, "source": "0G" | "local"}
    """
    record = {
        "task_id": task_id,
        "nonce": nonce_hex,
        "encrypted": encrypted_payload,
        "timestamp": int(time.time()),
        "source": "0G→local",
    }

    # 尝试写入 0G
    if not MOCK_MODE:
        try:
            return await _write_to_0g(record)
        except Exception as exc:
            logger.warning("[0G] 写入失败，降级到本地: %s", exc)

    # 降级：写入本地 fallback.json
    return _write_to_local(record)


async def _write_to_0g(record: Dict) -> Dict:
    """真实 0G Network 写入（MVP 阶段预留接口）。"""
    raise NotImplementedError("0G Network SDK 尚未接入，请设置 MOCK_MODE=1")


def _write_to_local(record: Dict) -> Dict:
    """写入本地 fallback.json（原子操作）。"""
    existing = _load_fallback()

    existing[record["task_id"]] = {
        "nonce": record["nonce"],
        "timestamp": record["timestamp"],
        "source": "0G→local",
        "encrypted": record.get("encrypted", {}),
    }

    tmp_path = FALLBACK_PATH.with_suffix(".tmp")
    tmp_path.write_text(json.dumps(existing, indent=2), encoding="utf-8")
    tmp_path.replace(FALLBACK_PATH)

    logger.info("[0G Fallback] 已写入 fallback.json: task=%s", record["task_id"])
    return {"storage_hash": f"local_{record['task_id'][:8]}", "source": "local"}


# =================================================================
# 读取操作
# =================================================================

async def retrieve_encrypted_nonce(task_id: str) -> Optional[Dict]:
    """
    获取加密 nonce，优先读本地缓存（5 分钟有效），再访问 0G。

    Returns:
        {"nonce": str, "encrypted": dict, "source": str} 或 None
    """
    # 优先读本地缓存
    local = _read_from_local(task_id)
    if local and (time.time() - local["timestamp"] < CACHE_TTL_S):
        logger.info("[0G] 命中本地缓存: task=%s", task_id)
        return local

    # 尝试 0G
    if not MOCK_MODE:
        try:
            return await _read_from_0g(task_id)
        except Exception as exc:
            logger.warning("[0G] 读取失败，使用本地数据: %s", exc)

    return local


async def _read_from_0g(task_id: str) -> Optional[Dict]:
    """真实 0G Network 读取（MVP 阶段预留接口）。"""
    raise NotImplementedError("0G Network SDK 尚未接入，请设置 MOCK_MODE=1")


def _read_from_local(task_id: str) -> Optional[Dict]:
    """从本地 fallback.json 读取。"""
    data = _load_fallback()
    return data.get(task_id)


# =================================================================
# 工具函数
# =================================================================

def _load_fallback() -> Dict:
    """加载 fallback.json，文件不存在或格式错误时返回空字典。"""
    if not FALLBACK_PATH.exists():
        return {}
    try:
        return json.loads(FALLBACK_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def is_cache_valid(task_id: str) -> bool:
    """检查本地缓存是否有效（5 分钟内）。"""
    local = _read_from_local(task_id)
    if not local:
        return False
    return (time.time() - local["timestamp"]) < CACHE_TTL_S
