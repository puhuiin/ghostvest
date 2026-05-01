"use client";

import { useState, useCallback } from "react";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { Keypair } from "@solana/web3.js";
import { deriveStealthKeypair, hexToUint8Array } from "@/lib/stealth";
import { toast } from "@/lib/toast";

export type WithdrawStatus = "idle" | "pending" | "success" | "error";

export interface WithdrawState {
  status: WithdrawStatus;
  txSignature: string | null;
  explorerUrl: string | null;
  solscanUrl: string | null;
  error: string | null;
  stealthAddress: string | null;
  derivedKeypair: Keypair | null;
}

interface UseStealthWithdrawReturn {
  state: WithdrawState;
  deriveFromNonce: (nonceHex: string, contributorPubkeyBase58: string) => void;
  executeWithdraw: (
    recipientWallet: string,
    amountLamports?: number
  ) => Promise<void>;
  reset: () => void;
}

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
const EXPLORER_BASE = "https://explorer.solana.com";
const SOLSCAN_BASE = "https://solscan.io";

export function useStealthWithdraw(): UseStealthWithdrawReturn {
  const [state, setState] = useState<WithdrawState>({
    status: "idle",
    txSignature: null,
    explorerUrl: null,
    solscanUrl: null,
    error: null,
    stealthAddress: null,
    derivedKeypair: null,
  });

  const deriveFromNonce = useCallback(
    (nonceHex: string, contributorPubkeyBase58: string) => {
      try {
        if (nonceHex.length !== 64) {
          setState((prev) => ({
            ...prev,
            error: "nonce 必须为 64 位十六进制字符",
            stealthAddress: null,
            derivedKeypair: null,
          }));
          return;
        }

        const nonce = hexToUint8Array(nonceHex);
        const contributorPubkey = new PublicKey(contributorPubkeyBase58);
        const kp = deriveStealthKeypair(nonce, contributorPubkey.toBytes());

        setState((prev) => ({
          ...prev,
          stealthAddress: kp.publicKey.toBase58(),
          derivedKeypair: kp,
          error: null,
        }));
      } catch {
        toast.error("nonce 格式错误，请检查后重试");
        setState((prev) => ({
          ...prev,
          error: "派生失败：nonce 或钱包地址格式无效",
          stealthAddress: null,
          derivedKeypair: null,
        }));
      }
    },
    []
  );

  const executeWithdraw = useCallback(
    async (recipientWallet: string, amountLamports?: number) => {
      if (!state.derivedKeypair) {
        toast.error("请先输入有效 nonce 派生隐身地址");
        setState((prev) => ({
          ...prev,
          status: "error",
          error: "请先输入 nonce 派生隐身地址",
        }));
        return;
      }

      setState((prev) => ({ ...prev, status: "pending", error: null }));

      try {
        const connection = new Connection(RPC_URL, "confirmed");
        const stealthKp = state.derivedKeypair;
        const recipient = new PublicKey(recipientWallet);

        const balance = await connection.getBalance(stealthKp.publicKey);
        const withdrawAmount = amountLamports || balance;

        if (withdrawAmount <= 0) {
          throw new Error("STEALTH_ADDRESS_EMPTY");
        }

        const { blockhash } = await connection.getLatestBlockhash();

        const tx = new Transaction({
          feePayer: stealthKp.publicKey,
          recentBlockhash: blockhash,
        }).add(
          SystemProgram.transfer({
            fromPubkey: stealthKp.publicKey,
            toPubkey: recipient,
            lamports: withdrawAmount - 5000,
          })
        );

        tx.sign(stealthKp);

        const sig = await connection.sendRawTransaction(tx.serialize());
        await connection.confirmTransaction(sig, "confirmed");

        const explorerUrl = `${EXPLORER_BASE}/tx/${sig}?cluster=devnet`;
        const solscanUrl = `${SOLSCAN_BASE}/tx/${sig}?cluster=devnet`;

        setState((prev) => ({
          ...prev,
          status: "success",
          txSignature: sig,
          explorerUrl,
          solscanUrl,
        }));
      } catch (err) {
        let userMsg = "网络拥堵，正在重试…";
        if (err instanceof Error) {
          if (err.message === "STEALTH_ADDRESS_EMPTY") {
            userMsg = "隐身地址余额为零，无法提款";
          } else if (err.message.includes("timeout")) {
            userMsg = "网络超时，请稍后重试";
          } else if (err.message.includes("insufficient")) {
            userMsg = "余额不足，无法支付手续费";
          }
        }
        toast.error(userMsg, { duration: 4000 });
        setState((prev) => ({ ...prev, status: "error", error: userMsg }));
      }
    },
    [state.derivedKeypair]
  );

  const reset = useCallback(() => {
    setState({
      status: "idle",
      txSignature: null,
      explorerUrl: null,
      solscanUrl: null,
      error: null,
      stealthAddress: null,
      derivedKeypair: null,
    });
  }, []);

  return { state, deriveFromNonce, executeWithdraw, reset };
}
