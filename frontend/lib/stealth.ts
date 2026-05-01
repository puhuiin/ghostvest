/**
 * GhostVest 隐身地址密码学模块（前端版）
 *
 * 与 tee_crypto/stealth.ts 完全相同的算法，直接复用。
 * 密码学一致性 = 生死线：此文件的每一行都必须与后端 Python 端逐字节一致。
 *
 * 算法：HMAC-SHA256(key=nonce, msg=contributor_pubkey_bytes) → seed → Keypair.fromSeed
 */

import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";
import { Keypair } from "@solana/web3.js";

export function deriveStealthSeed(
  nonce: Uint8Array,
  contributorPubkey: Uint8Array
): Uint8Array {
  return hmac(sha256, nonce, contributorPubkey);
}

export function deriveStealthKeypair(
  nonce: Uint8Array,
  contributorPubkey: Uint8Array
): Keypair {
  const seed = deriveStealthSeed(nonce, contributorPubkey);
  return Keypair.fromSeed(seed);
}

export function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export function uint8ArrayToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
