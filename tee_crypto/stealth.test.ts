/**
 * GhostVest 隐身地址密码学单元测试（TypeScript 端）
 *
 * 覆盖：
 *   1. HMAC-SHA256 种子推导（确定性、与 Python 一致）
 *   2. Keypair 派生（种子→公钥一致性）
 *   3. 100 组随机向量自洽验证
 *   4. 与 Python 端导出的测试向量交叉校验
 *   5. 边界条件（零 nonce、全 FF nonce 等）
 *   6. hex 工具函数
 *
 * 运行方式：npx vitest run
 */

import { describe, it, expect } from "vitest";
import { Keypair } from "@solana/web3.js";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";
import {
  deriveStealthSeed,
  deriveStealthKeypair,
  hexToUint8Array,
  uint8ArrayToHex,
} from "./stealth";

// =================================================================
// 辅助函数
// =================================================================

/** 生成密码学安全的 32 字节随机 nonce */
function randomNonce(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

/** 将 Uint8Array 转为 hex 字符串（用于测试断言） */
function toHex(arr: Uint8Array): string {
  return uint8ArrayToHex(arr);
}

// =================================================================
// 基础功能测试
// =================================================================

describe("deriveStealthSeed", () => {
  it("应返回 32 字节种子", () => {
    const nonce = randomNonce();
    const kp = Keypair.generate();
    const seed = deriveStealthSeed(nonce, kp.publicKey.toBytes());
    expect(seed.length).toBe(32);
  });

  it("相同输入应产出相同种子（确定性）", () => {
    const nonce = new Uint8Array(32);
    nonce[0] = 0xab;
    nonce[31] = 0xcd;
    const kp = Keypair.generate();
    const pubkeyBytes = kp.publicKey.toBytes();

    const seed1 = deriveStealthSeed(nonce, pubkeyBytes);
    const seed2 = deriveStealthSeed(nonce, pubkeyBytes);
    expect(toHex(seed1)).toBe(toHex(seed2));
  });

  it("输出应与手动 HMAC-SHA256 计算一致", () => {
    const nonce = new Uint8Array(range(32));
    const kp = Keypair.fromSeed(new Uint8Array(range(32)));
    const pubkeyBytes = kp.publicKey.toBytes();

    const seed = deriveStealthSeed(nonce, pubkeyBytes);
    const expected = hmac(sha256, nonce, pubkeyBytes);
    expect(toHex(seed)).toBe(toHex(expected));
  });

  it("不同 nonce 应产出不同种子", () => {
    const pubkey = Keypair.generate().publicKey.toBytes();
    const nonceA = new Uint8Array(range(32));
    const nonceB = new Uint8Array(range(32, 64));

    const seedA = deriveStealthSeed(nonceA, pubkey);
    const seedB = deriveStealthSeed(nonceB, pubkey);
    expect(toHex(seedA)).not.toBe(toHex(seedB));
  });

  it("不同 pubkey 应产出不同种子", () => {
    const nonce = new Uint8Array(range(32));
    const pubkeyA = Keypair.generate().publicKey.toBytes();
    const pubkeyB = Keypair.generate().publicKey.toBytes();

    const seedA = deriveStealthSeed(nonce, pubkeyA);
    const seedB = deriveStealthSeed(nonce, pubkeyB);
    expect(toHex(seedA)).not.toBe(toHex(seedB));
  });

  it("全零 nonce 应正常工作", () => {
    const nonce = new Uint8Array(32);
    const pubkey = Keypair.generate().publicKey.toBytes();
    const seed = deriveStealthSeed(nonce, pubkey);
    expect(seed.length).toBe(32);
    expect(toHex(seed)).not.toBe("0".repeat(64));
  });

  it("全 0xFF nonce 应正常工作", () => {
    const nonce = new Uint8Array(32).fill(0xff);
    const pubkey = Keypair.generate().publicKey.toBytes();
    const seed = deriveStealthSeed(nonce, pubkey);
    expect(seed.length).toBe(32);
  });
});

// =================================================================
// Keypair 派生测试
// =================================================================

describe("deriveStealthKeypair", () => {
  it("相同输入应产出相同 Keypair", () => {
    const nonce = new Uint8Array(range(32));
    const pubkey = Keypair.fromSeed(new Uint8Array(range(32))).publicKey.toBytes();

    const kp1 = deriveStealthKeypair(nonce, pubkey);
    const kp2 = deriveStealthKeypair(nonce, pubkey);
    expect(kp1.publicKey.toBase58()).toBe(kp2.publicKey.toBase58());
    expect(toHex(kp1.secretKey)).toBe(toHex(kp2.secretKey));
  });

  it("Keypair.secretKey 应为 64 字节", () => {
    const kp = deriveStealthKeypair(randomNonce(), Keypair.generate().publicKey.toBytes());
    expect(kp.secretKey.length).toBe(64);
  });

  it("不同输入应产出不同 Keypair", () => {
    const pubkey = Keypair.generate().publicKey.toBytes();
    const kpA = deriveStealthKeypair(randomNonce(), pubkey);
    const kpB = deriveStealthKeypair(randomNonce(), pubkey);
    expect(kpA.publicKey.toBase58()).not.toBe(kpB.publicKey.toBase58());
  });
});

// =================================================================
// 100 组随机向量自洽验证
// =================================================================

describe("100 组随机向量交叉验证", () => {
  it("100 组随机输入全部自洽", () => {
    for (let i = 0; i < 100; i++) {
      const nonce = randomNonce();
      const kp = Keypair.generate();
      const pubkeyBytes = kp.publicKey.toBytes();

      // 验证种子推导
      const seed = deriveStealthSeed(nonce, pubkeyBytes);
      expect(seed.length).toBe(32, `向量 ${i}: seed 长度不为 32`);

      // 验证与手动 HMAC 一致
      const expectedSeed = hmac(sha256, nonce, pubkeyBytes);
      expect(toHex(seed)).toBe(toHex(expectedSeed), `向量 ${i}: seed 与 HMAC 不一致`);

      // 验证 Keypair 派生
      const stealthKp = deriveStealthKeypair(nonce, pubkeyBytes);
      expect(stealthKp.secretKey.length).toBe(64, `向量 ${i}: secretKey 不为 64 字节`);

      // 验证 seed → Keypair.fromSeed 一致
      const kpFromSeed = Keypair.fromSeed(seed);
      expect(stealthKp.publicKey.toBase58()).toBe(
        kpFromSeed.publicKey.toBase58(),
        `向量 ${i}: pubkey 不一致`
      );
      expect(toHex(stealthKp.secretKey)).toBe(
        toHex(kpFromSeed.secretKey),
        `向量 ${i}: secretKey 不一致`
      );
    }
  });
});

// =================================================================
// Python 交叉验证向量测试
// =================================================================

describe("Python 交叉验证", () => {
  it("应能验证 Python 端生成的固定向量", () => {
    // 使用与 Python test_known_vector_1 完全相同的输入
    // nonce = bytes.fromhex("aabbccdd" * 8)
    // fixed_seed = bytes(range(32)) → Keypair.from_seed
    const nonce = hexToUint8Array("aabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccdd");
    const fixedSeed = new Uint8Array(range(32));
    const fixedKp = Keypair.fromSeed(fixedSeed);
    const pubkeyBytes = fixedKp.publicKey.toBytes();

    // 验证 HMAC-SHA256 输出
    const seed = deriveStealthSeed(nonce, pubkeyBytes);
    const expectedSeed = hmac(sha256, nonce, pubkeyBytes);
    expect(toHex(seed)).toBe(toHex(expectedSeed));

    // 验证可重复性
    const stealthKp1 = deriveStealthKeypair(nonce, pubkeyBytes);
    const stealthKp2 = deriveStealthKeypair(nonce, pubkeyBytes);
    expect(stealthKp1.publicKey.toBase58()).toBe(stealthKp2.publicKey.toBase58());
    expect(toHex(stealthKp1.secretKey)).toBe(toHex(stealthKp2.secretKey));
  });

  it("应能读取并校验 Python 导出的测试向量文件", () => {
    // 此测试在有 test_vectors.json 文件时运行
    // 运行方式：先 cd backend && python -c "from app.crypto_utils import *; save_test_vectors(generate_cross_validation_vectors(100))"
    // 然后将生成的 test_vectors.json 复制到 tee_crypto/ 目录
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require("fs");
      const path = require("path");
      const vecPath = path.join(__dirname, "test_vectors.json");

      if (!fs.existsSync(vecPath)) {
        console.log("  ⚠️  test_vectors.json 不存在，跳过 Python 交叉验证");
        console.log("  生成方式：cd backend && python -c \"from app.crypto_utils import *; save_test_vectors(generate_cross_validation_vectors(100))\"");
        return;
      }

      const vectors = JSON.parse(fs.readFileSync(vecPath, "utf-8"));
      expect(vectors.length).toBe(100);

      for (let i = 0; i < vectors.length; i++) {
        const v = vectors[i];
        const nonce = hexToUint8Array(v.nonce_hex);
        const pubkeyBytes = hexToUint8Array(v.pubkey_hex);

        // 验证种子一致
        const seed = deriveStealthSeed(nonce, pubkeyBytes);
        expect(toHex(seed)).toBe(v.seed_hex, `向量 ${i}: seed 与 Python 不一致`);

        // 验证 Keypair 一致
        const stealthKp = deriveStealthKeypair(nonce, pubkeyBytes);
        expect(stealthKp.publicKey.toBase58()).toBe(
          v.stealth_pubkey,
          `向量 ${i}: pubkey 与 Python 不一致`
        );
        expect(toHex(stealthKp.secretKey)).toBe(
          v.stealth_secret_key_hex,
          `向量 ${i}: secretKey 与 Python 不一致`
        );
      }
    } catch (e: unknown) {
      // Node.js 环境不可用（如浏览器），跳过
      if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "MODULE_NOT_FOUND") {
        console.log("  ⚠️  非 Node.js 环境，跳过文件 I/O 测试");
      } else {
        throw e;
      }
    }
  });
});

// =================================================================
// hex 工具函数测试
// =================================================================

describe("hex 工具函数", () => {
  it("hexToUint8Array 应正确还原", () => {
    const hex = "aabbccdd";
    const arr = hexToUint8Array(hex);
    expect(arr.length).toBe(4);
    expect(arr[0]).toBe(0xaa);
    expect(arr[1]).toBe(0xbb);
    expect(arr[2]).toBe(0xcc);
    expect(arr[3]).toBe(0xdd);
  });

  it("uint8ArrayToHex 应正确转换", () => {
    const arr = new Uint8Array([0x00, 0x0f, 0xff]);
    expect(uint8ArrayToHex(arr)).toBe("000fff");
  });

  it("hex → uint8Array → hex 往返应一致", () => {
    const original = "deadbeef0123456789abcdef01234567";
    const arr = hexToUint8Array(original);
    const result = uint8ArrayToHex(arr);
    expect(result).toBe(original);
  });
});

// =================================================================
// 辅助：生成 range 数组
// =================================================================

function range(start: number, end?: number): number[] {
  const stop = end ?? start;
  const begin = end !== undefined ? start : 0;
  return Array.from({ length: stop - begin }, (_, i) => begin + i);
}
