"""
GhostVest 隐身地址密码学模块

确定性隐身地址推导：HMAC-SHA256 + ed25519_from_seed。
前端 TypeScript 必须使用完全相同的算法，逐字节一致。

算法流程：
  1. 生成 32 字节随机 nonce
  2. seed = HMAC-SHA256(key=nonce, msg=recipient_pubkey_bytes)
  3. stealth_keypair = Keypair.from_seed(seed)

安全说明：
  - nonce 由 TEE 预言机生成，每次发薪唯一
  - recipient_pubkey 是贡献者的主公钥（32 字节 ed25519 公钥）
  - 任何人只有同时拥有 nonce + 对应私钥才能还原隐身地址
"""

import hashlib
import hmac
import json
import os
from typing import Dict, List, Tuple

import base58
from solders.keypair import Keypair
from solders.pubkey import Pubkey


def generate_nonce() -> bytes:
    """生成密码学安全的 32 字节随机 nonce。"""
    return os.urandom(32)


def derive_stealth_seed(nonce: bytes, recipient_pubkey: Pubkey) -> bytes:
    """
    通过 HMAC-SHA256 派生 32 字节确定性种子。

    算法：HMAC-SHA256(key=nonce, message=recipient_pubkey_bytes)

    Args:
        nonce: 32 字节随机 nonce（HMAC 密钥）
        recipient_pubkey: 贡献者的 Solana 主公钥

    Returns:
        32 字节确定性种子，可直接用于 ed25519_from_seed
    """
    return hmac.new(
        key=nonce,
        msg=bytes(recipient_pubkey),
        digestmod=hashlib.sha256,
    ).digest()


def derive_stealth_keypair(nonce: bytes, recipient_pubkey: Pubkey) -> Keypair:
    """
    从 nonce + recipient_pubkey 派生完整的隐身 Keypair。

    流程：nonce + pubkey → HMAC-SHA256 → 32-byte seed → ed25519_from_seed

    Args:
        nonce: 32 字节随机 nonce
        recipient_pubkey: 贡献者的 Solana 主公钥

    Returns:
        控制隐身地址的全新 Solana Keypair
    """
    seed = derive_stealth_seed(nonce, recipient_pubkey)
    return Keypair.from_seed(seed)


def derive_stealth_pubkey(nonce: bytes, recipient_pubkey: Pubkey) -> Pubkey:
    """便捷方法：仅派生隐身地址公钥。"""
    return derive_stealth_keypair(nonce, recipient_pubkey).pubkey()


def keypair_to_bytes(kp: Keypair) -> bytes:
    """将 Keypair 序列化为 64 字节（32 私钥 + 32 公钥）。"""
    return bytes(kp)


def generate_cross_validation_vectors(count: int = 100) -> List[Dict]:
    """
    生成交叉验证测试向量，供 Python 和 TypeScript 双端校验。

    每个向量包含：
      - nonce_hex: 32 字节 nonce 的十六进制表示
      - pubkey_hex: 贡献者公钥的十六进制表示
      - seed_hex: HMAC-SHA256 派生种子的十六进制表示
      - stealth_pubkey: 隐身地址的 Base58 编码
      - stealth_secret_key_hex: 隐身私钥（64 字节）的十六进制表示

    Args:
        count: 生成向量数量，默认 100

    Returns:
        测试向量列表
    """
    vectors = []
    for _ in range(count):
        nonce = generate_nonce()
        keypair = Keypair()
        pubkey = keypair.pubkey()
        pubkey_bytes = bytes(pubkey)

        seed = derive_stealth_seed(nonce, pubkey)
        stealth_kp = derive_stealth_keypair(nonce, pubkey)

        vectors.append({
            "nonce_hex": nonce.hex(),
            "pubkey_hex": pubkey_bytes.hex(),
            "seed_hex": seed.hex(),
            "stealth_pubkey": str(stealth_kp.pubkey()),
            "stealth_secret_key_hex": keypair_to_bytes(stealth_kp).hex(),
        })
    return vectors


def save_test_vectors(vectors: List[Dict], path: str = "test_vectors.json") -> None:
    """将测试向量保存为 JSON 文件，供前端测试读取。"""
    with open(path, "w") as f:
        json.dump(vectors, f, indent=2)
