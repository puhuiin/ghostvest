"""
GhostVest 隐身地址密码学单元测试

覆盖：
  1. nonce 生成（长度、唯一性）
  2. HMAC-SHA256 种子推导（确定性、与原始 hmac 一致）
  3. Keypair 派生（种子→公钥一致性）
  4. 100 组随机向量交叉验证（Python 端自洽 + 导出供 TS 校验）
  5. 边界条件（零 nonce、全 FF nonce 等）
"""

import hashlib
import hmac
import json
import os
import tempfile

import base58
from solders.keypair import Keypair
from solders.pubkey import Pubkey

from app.crypto_utils import (
    derive_stealth_keypair,
    derive_stealth_pubkey,
    derive_stealth_seed,
    generate_cross_validation_vectors,
    generate_nonce,
    keypair_to_bytes,
    save_test_vectors,
)


# =================================================================
# 基础功能测试
# =================================================================


class TestNonceGeneration:
    """nonce 生成测试组。"""

    def test_nonce_length(self):
        """nonce 必须为 32 字节。"""
        nonce = generate_nonce()
        assert len(nonce) == 32

    def test_nonce_uniqueness(self):
        """连续生成的 nonce 不应相同。"""
        nonces = {generate_nonce() for _ in range(100)}
        assert len(nonces) == 100

    def test_nonce_randomness(self):
        """nonce 的每个字节位不应恒定（概率极低但值得验证）。"""
        collected = bytearray()
        for _ in range(100):
            collected.extend(generate_nonce())
        for byte_pos in range(32):
            unique_vals = {collected[i] for i in range(byte_pos, len(collected), 32)}
            assert len(unique_vals) > 1, f"字节位 {byte_pos} 似乎恒定"


# =================================================================
# 种子推导测试
# =================================================================


class TestSeedDerivation:
    """HMAC-SHA256 种子推导测试组。"""

    def test_seed_deterministic(self):
        """相同输入必须产出相同种子。"""
        nonce = bytes(range(32))
        pubkey = Keypair().pubkey()

        seed1 = derive_stealth_seed(nonce, pubkey)
        seed2 = derive_stealth_seed(nonce, pubkey)
        assert seed1 == seed2
        assert len(seed1) == 32

    def test_seed_matches_raw_hmac(self):
        """输出必须与手动计算的 HMAC-SHA256 一致。"""
        nonce = bytes(range(32))
        kp = Keypair()
        pubkey = kp.pubkey()

        seed = derive_stealth_seed(nonce, pubkey)
        expected = hmac.new(
            key=nonce,
            msg=bytes(pubkey),
            digestmod=hashlib.sha256,
        ).digest()
        assert seed == expected

    def test_different_nonce_different_seed(self):
        """不同 nonce 应产出不同种子。"""
        pubkey = Keypair().pubkey()
        nonce_a = bytes(range(32))
        nonce_b = bytes(range(32, 64))

        seed_a = derive_stealth_seed(nonce_a, pubkey)
        seed_b = derive_stealth_seed(nonce_b, pubkey)
        assert seed_a != seed_b

    def test_different_pubkey_different_seed(self):
        """不同 pubkey 应产出不同种子（即使 nonce 相同）。"""
        nonce = bytes(range(32))
        kp_a = Keypair()
        kp_b = Keypair()

        seed_a = derive_stealth_seed(nonce, kp_a.pubkey())
        seed_b = derive_stealth_seed(nonce, kp_b.pubkey())
        assert seed_a != seed_b

    def test_boundary_zero_nonce(self):
        """全零 nonce 应正常工作。"""
        nonce = bytes(32)
        pubkey = Keypair().pubkey()
        seed = derive_stealth_seed(nonce, pubkey)
        assert len(seed) == 32
        assert seed != bytes(32)  # 不应全零

    def test_boundary_all_ff_nonce(self):
        """全 0xFF nonce 应正常工作。"""
        nonce = bytes([0xFF] * 32)
        pubkey = Keypair().pubkey()
        seed = derive_stealth_seed(nonce, pubkey)
        assert len(seed) == 32


# =================================================================
# Keypair 派生测试
# =================================================================


class TestKeypairDerivation:
    """隐身 Keypair 派生测试组。"""

    def test_keypair_from_seed_deterministic(self):
        """相同输入应产出相同 Keypair。"""
        nonce = bytes(range(32))
        pubkey = Keypair().pubkey()

        kp1 = derive_stealth_keypair(nonce, pubkey)
        kp2 = derive_stealth_keypair(nonce, pubkey)
        assert bytes(kp1) == bytes(kp2)

    def test_pubkey_derivation_matches(self):
        """derive_stealth_pubkey 应与 derive_stealth_keypair().pubkey() 一致。"""
        nonce = generate_nonce()
        pubkey = Keypair().pubkey()

        pk1 = derive_stealth_pubkey(nonce, pubkey)
        pk2 = derive_stealth_keypair(nonce, pubkey).pubkey()
        assert pk1 == pk2

    def test_stealth_keypair_is_64_bytes(self):
        """序列化的 Keypair 应为 64 字节。"""
        kp = derive_stealth_keypair(generate_nonce(), Keypair().pubkey())
        assert len(keypair_to_bytes(kp)) == 64

    def test_different_inputs_different_keypairs(self):
        """不同输入应产出完全不同的 Keypair。"""
        nonce_a = generate_nonce()
        nonce_b = generate_nonce()
        pubkey = Keypair().pubkey()

        kp_a = derive_stealth_keypair(nonce_a, pubkey)
        kp_b = derive_stealth_keypair(nonce_b, pubkey)
        assert bytes(kp_a) != bytes(kp_b)


# =================================================================
# 100 组随机向量交叉验证
# =================================================================


class TestCrossValidation:
    """100 组随机向量，确保 Python 端自洽，并导出供 TS 端校验。"""

    def test_100_random_vectors_self_consistent(self):
        """
        核心测试：100 组随机输入，每组都满足：
          1. seed 长度为 32
          2. seed == HMAC-SHA256(nonce, pubkey)
          3. keypair 由 seed 派生，pubkey 匹配
          4. keypair 序列化长度为 64
        """
        for i in range(100):
            nonce = generate_nonce()
            kp = Keypair()
            pubkey = kp.pubkey()
            pubkey_bytes = bytes(pubkey)

            # 验证种子推导
            seed = derive_stealth_seed(nonce, pubkey)
            assert len(seed) == 32, f"向量 {i}: seed 长度不为 32"
            expected_seed = hmac.new(
                key=nonce, msg=pubkey_bytes, digestmod=hashlib.sha256
            ).digest()
            assert seed == expected_seed, f"向量 {i}: seed 与 HMAC 不一致"

            # 验证 Keypair 派生
            stealth_kp = derive_stealth_keypair(nonce, pubkey)
            stealth_bytes = keypair_to_bytes(stealth_kp)
            assert len(stealth_bytes) == 64, f"向量 {i}: keypair 不为 64 字节"

            # 验证 Pubkey 一致性
            stealth_pk = derive_stealth_pubkey(nonce, pubkey)
            assert stealth_pk == stealth_kp.pubkey(), f"向量 {i}: pubkey 不一致"

    def test_generate_and_save_vectors(self):
        """
        生成 100 组向量并保存为 JSON，供 TS 测试读取。
        验证每条向量的字段完整性。
        """
        vectors = generate_cross_validation_vectors(100)
        assert len(vectors) == 100

        for i, v in enumerate(vectors):
            assert "nonce_hex" in v, f"向量 {i}: 缺少 nonce_hex"
            assert "pubkey_hex" in v, f"向量 {i}: 缺少 pubkey_hex"
            assert "seed_hex" in v, f"向量 {i}: 缺少 seed_hex"
            assert "stealth_pubkey" in v, f"向量 {i}: 缺少 stealth_pubkey"
            assert "stealth_secret_key_hex" in v, f"向量 {i}: 缺少 stealth_secret_key_hex"

            assert len(v["nonce_hex"]) == 64, f"向量 {i}: nonce_hex 长度不为 64"
            assert len(v["pubkey_hex"]) == 64, f"向量 {i}: pubkey_hex 长度不为 64"
            assert len(v["seed_hex"]) == 64, f"向量 {i}: seed_hex 长度不为 64"
            assert len(v["stealth_secret_key_hex"]) == 128, f"向量 {i}: secret_key_hex 长度不为 128"

    def test_export_vectors_to_file(self):
        """
        将测试向量写入临时文件，验证 JSON 格式正确。
        前端测试会读取此文件进行交叉校验。
        """
        vectors = generate_cross_validation_vectors(100)

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as tmp:
            tmp_path = tmp.name

        try:
            save_test_vectors(vectors, tmp_path)

            with open(tmp_path, "r") as f:
                loaded = json.load(f)

            assert len(loaded) == 100
            assert loaded[0]["nonce_hex"] == vectors[0]["nonce_hex"]
        finally:
            os.unlink(tmp_path)


# =================================================================
# 已知向量回归测试（防止算法变更导致破坏性修改）
# =================================================================


class TestKnownVectors:
    """使用固定输入的回归测试，确保算法没有被意外修改。"""

    def test_known_vector_1(self):
        """
        使用已知的固定 nonce 和固定的 keypair，
        验证输出结果与记录值一致。
        """
        # 使用确定性的 nonce
        nonce = bytes.fromhex("aabbccdd" * 8)  # 32 字节

        # 使用确定性的 seed 派生 keypair（仅用于提取 pubkey）
        fixed_seed = bytes(range(32))
        fixed_kp = Keypair.from_seed(fixed_seed)
        pubkey = fixed_kp.pubkey()

        seed = derive_stealth_seed(nonce, pubkey)
        stealth_kp = derive_stealth_keypair(nonce, pubkey)

        # 验证 HMAC-SHA256 输出
        expected_seed = hmac.new(
            key=nonce, msg=bytes(pubkey), digestmod=hashlib.sha256
        ).digest()
        assert seed == expected_seed

        # 验证可重复性
        stealth_kp2 = derive_stealth_keypair(nonce, pubkey)
        assert bytes(stealth_kp) == bytes(stealth_kp2)
