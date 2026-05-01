/**
 * GhostVest 隐身地址密码学模块（TypeScript 端）
 *
 * 确定性隐身地址推导：HMAC-SHA256 + ed25519_from_seed。
 * 与 Python 端 crypto_utils.py 使用完全相同的算法，必须逐字节一致。
 *
 * 算法流程：
 *   1. seed = HMAC-SHA256(key=nonce, msg=recipient_pubkey_bytes)
 *   2. stealth_keypair = Keypair.fromSeed(seed)
 *
 * 依赖：
 *   - @noble/hashes@1.4.0（HMAC-SHA256，纯 JS 实现，无 WASM 依赖）
 *   - @solana/web3.js@1.91.0（Keypair.fromSeed）
 *
 * 安全说明：
 *   - nonce 由 TEE 预言机生成，经加密后上传至 0G Network
 *   - 前端获取 nonce 后，在本地纯内存中完成推导，私钥永不离开浏览器
 */

import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";
import { Keypair } from "@solana/web3.js";

/**
 * 从 nonce + 贡献者主公钥派生 32 字节确定性种子。
 *
 * 算法：HMAC-SHA256(key=nonce, message=contributor_pubkey_bytes)
 *
 * @param nonce - 32 字节随机 nonce（作为 HMAC 密钥）
 * @param contributorPubkey - 贡献者的 Solana 主公钥（32 字节）
 * @returns 32 字节确定性种子
 */
export function deriveStealthSeed(
  nonce: Uint8Array,
  contributorPubkey: Uint8Array
): Uint8Array {
  // 关键：key=nonce, message=contributorPubkey
  // Python 端：hmac.new(key=nonce, msg=bytes(pubkey), digestmod=hashlib.sha256)
  return hmac(sha256, nonce, contributorPubkey);
}

/**
 * 从 nonce + 贡献者主公钥派生完整的隐身 Keypair。
 *
 * 流程：nonce + pubkey → HMAC-SHA256 → 32-byte seed → Keypair.fromSeed
 *
 * @param nonce - 32 字节随机 nonce
 * @param contributorPubkey - 贡献者的 Solana 主公钥（32 字节）
 * @returns 控制隐身地址的全新 Solana Keypair
 */
export function deriveStealthKeypair(
  nonce: Uint8Array,
  contributorPubkey: Uint8Array
): Keypair {
  const seed = deriveStealthSeed(nonce, contributorPubkey);
  return Keypair.fromSeed(seed);
}

/**
 * 从 hex 字符串还原 Uint8Array。
 * 用于前端从 API 获取 hex 编码的 nonce/pubkey 后还原。
 *
 * @param hex - 十六进制字符串（不含 0x 前缀）
 * @returns 对应的 Uint8Array
 */
export function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * 将 Uint8Array 转换为 hex 字符串。
 *
 * @param arr - 输入字节数组
 * @returns 十六进制字符串
 */
export function uint8ArrayToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
