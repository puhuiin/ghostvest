"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useStealthWithdraw } from "@/hooks/useStealthWithdraw";

const CLAIM_STEPS = [
  "正在从 0G 网络获取加密凭证…",
  "正在本地推导零知识隐身私钥…",
  "提款签名中…",
];

function TypewriterText({ text, speed = 30 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return (
    <span>
      {displayed}
      {displayed.length < text.length && (
        <span className="inline-block w-2 h-4 bg-ghost-accent animate-blink ml-0.5 align-middle" />
      )}
    </span>
  );
}

function ClaimSuccessModal({
  solscanUrl,
  explorerUrl,
  txSignature,
  onClose,
}: {
  solscanUrl: string | null;
  explorerUrl: string | null;
  txSignature: string | null;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-ghost-card border border-ghost-accent/40 rounded-xl p-8 max-w-md w-full mx-4 glow-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-ghost-accent font-bold text-xl mb-2">
            提款完成
          </h2>
          <p className="text-ghost-dim text-sm mb-6">
            资金已转入无历史记录的新地址，隐私链路完成。
          </p>

          <a
            href={solscanUrl || explorerUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-4 bg-gradient-to-r from-green-600 to-green-500 text-white font-bold rounded-lg text-center hover:from-green-500 hover:to-green-400 transition-all shadow-lg shadow-green-900/40 text-lg"
          >
            🔗 查看链上交易
          </a>

          {txSignature && (
            <p className="mt-3 text-ghost-dim text-xs font-mono break-all">
              TX: {txSignature.slice(0, 16)}...{txSignature.slice(-12)}
            </p>
          )}

          <p className="mt-4 text-[11px] text-ghost-dim/60">
            资金已转入无历史记录的新地址，隐私链路完成。
          </p>
        </div>
      </div>
    </div>
  );
}

function ClaimLoadingOverlay({ step }: { step: number }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ghost-bg/95 backdrop-blur-sm">
      <div className="max-w-sm w-full mx-4">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block w-2 h-2 bg-ghost-accent rounded-full animate-pulse" />
            <span className="text-ghost-accent font-bold text-sm">
              GHOSTVEST PROTOCOL
            </span>
          </div>
        </div>
        <div className="space-y-4">
          {CLAIM_STEPS.map((label, i) => (
            <div key={i} className="flex items-start gap-3">
              <span
                className={`mt-0.5 text-sm font-mono ${
                  i < step
                    ? "text-ghost-accent"
                    : i === step
                    ? "text-ghost-accent animate-pulse"
                    : "text-ghost-dim/30"
                }`}
              >
                {i < step ? "[+]" : i === step ? "[*]" : "[~]"}
              </span>
              <span
                className={`text-sm font-mono ${
                  i < step
                    ? "text-ghost-accent/80"
                    : i === step
                    ? "text-ghost-text"
                    : "text-ghost-dim/30"
                }`}
              >
                {i === step ? (
                  <TypewriterText text={label} speed={25} />
                ) : i < step ? (
                  label
                ) : (
                  label
                )}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-6 h-1 bg-ghost-border rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-ghost-accent to-green-400 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${((step + 1) / CLAIM_STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function ClaimContent() {
  const searchParams = useSearchParams();
  const taskId = searchParams.get("task_id");

  const { publicKey, connected, connect, select, wallets } = useWallet();
  const {
    state: withdrawState,
    deriveFromNonce,
    executeWithdraw,
    reset,
  } = useStealthWithdraw();

  const [nonceInput, setNonceInput] = useState("");
  const [taskData, setTaskData] = useState<{
    status: string;
    nonce_hex: string | null;
    stealth_address: string | null;
    contributor_wallet: string;
  } | null>(null);
  const [loadingTask, setLoadingTask] = useState(false);
  const [claimStep, setClaimStep] = useState(-1);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const stepTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!taskId) return;

    setLoadingTask(true);
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

    const poll = async () => {
      try {
        const res = await fetch(`${backendUrl}/status/${taskId}`);
        if (!res.ok) return;
        const data = await res.json();
        setTaskData(data);

        if (data.nonce_hex && data.status === "approved") {
          setNonceInput(data.nonce_hex);
        }
      } catch {
        // 静默失败，继续轮询
      } finally {
        setLoadingTask(false);
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [taskId]);

  useEffect(() => {
    if (nonceInput.length === 64 && publicKey) {
      deriveFromNonce(nonceInput, publicKey.toBase58());
    }
  }, [nonceInput, publicKey, deriveFromNonce]);

  useEffect(() => {
    if (withdrawState.status === "success" && claimStep >= 0) {
      setClaimStep(CLAIM_STEPS.length);
      setTimeout(() => {
        setClaimStep(-1);
        setShowSuccessModal(true);
      }, 600);
    }
    if (withdrawState.status === "error" && claimStep >= 0) {
      setClaimStep(-1);
    }
  }, [withdrawState.status, claimStep]);

  const handleWithdraw = useCallback(async () => {
    if (!publicKey) return;
    setClaimStep(0);

    stepTimerRef.current = setTimeout(() => setClaimStep(1), 700);
    setTimeout(() => {
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
      setClaimStep(2);
    }, 1400);

    setTimeout(() => executeWithdraw(publicKey.toBase58()), 2100);
  }, [publicKey, executeWithdraw]);

  const handleReset = useCallback(() => {
    setShowSuccessModal(false);
    setClaimStep(-1);
    reset();
  }, [reset]);

  const handleConnect = useCallback(async () => {
    const phantom = wallets.find((w) => w.adapter.name === "Phantom");
    if (phantom) {
      select(phantom.adapter.name);
      setTimeout(() => connect(), 500);
    }
  }, [wallets, select, connect]);

  return (
    <div className="min-h-screen bg-ghost-bg flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* 头部 Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-ghost-accent tracking-wider">
            GHOST<span className="text-ghost-text">VEST</span>
          </h1>
          <p className="text-ghost-dim text-sm mt-2">
            隐私薪酬 Claim Portal
          </p>
          <div className="h-px bg-gradient-to-r from-transparent via-ghost-accent to-transparent mt-4 opacity-30" />
        </div>

        {/* 钱包连接区 */}
        {!connected ? (
          <div className="bg-ghost-card border border-ghost-border rounded-lg p-6 mb-6">
            <div className="flex items-center justify-center gap-3">
              <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-blink" />
              <span className="text-ghost-dim">
                请先连接 Solana 钱包以继续
              </span>
            </div>
            <button
              onClick={handleConnect}
              className="mt-4 w-full py-3 bg-ghost-accent/10 border border-ghost-accent/30 rounded text-ghost-accent hover:bg-ghost-accent/20 transition-colors font-medium"
            >
              [ 连接 Phantom 钱包 ]
            </button>
          </div>
        ) : (
          <div className="bg-ghost-card border border-ghost-border rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-ghost-accent rounded-full" />
                <span className="text-ghost-accent text-sm">已连接</span>
              </div>
              <span className="text-ghost-dim text-xs">
                {publicKey?.toBase58().slice(0, 8)}...
                {publicKey?.toBase58().slice(-6)}
              </span>
            </div>
          </div>
        )}

        {/* 任务状态区 */}
        {taskId && taskData && (
          <div className="bg-ghost-card border border-ghost-border rounded-lg p-4 mb-6 text-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-ghost-dim">TASK_ID</span>
              <span className="text-ghost-text font-mono text-xs">
                {taskId.slice(0, 16)}...
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-ghost-dim">STATUS</span>
              <span
                className={`font-mono text-xs ${
                  taskData.status === "paid"
                    ? "text-ghost-accent"
                    : taskData.status === "approved"
                    ? "text-yellow-400"
                    : taskData.status === "pending" ||
                      taskData.status === "auditing"
                    ? "text-blue-400"
                    : "text-red-400"
                }`}
              >
                [{taskData.status.toUpperCase()}]
              </span>
            </div>
            {taskData.stealth_address && (
              <div className="flex items-center justify-between">
                <span className="text-ghost-dim">STEALTH_ADDR</span>
                <span className="text-ghost-text font-mono text-xs">
                  {taskData.stealth_address.slice(0, 12)}...
                  {taskData.stealth_address.slice(-8)}
                </span>
              </div>
            )}
            {loadingTask && (
              <div className="text-ghost-dim text-xs mt-2 animate-pulse">
                等待审核结果...
              </div>
            )}
          </div>
        )}

        {/* Nonce 输入区 */}
        <div className="bg-ghost-card border border-ghost-border rounded-lg p-6 mb-6">
          <label className="block text-ghost-dim text-sm mb-3">
            {">"} NONCE (64 位 hex)
          </label>
          <input
            type="text"
            value={nonceInput}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9a-fA-F]/g, "");
              if (val.length <= 64) setNonceInput(val);
            }}
            placeholder="输入 32 字节 nonce 的十六进制..."
            className="w-full bg-ghost-bg border border-ghost-border rounded px-4 py-3 text-ghost-text font-mono text-sm focus:border-ghost-accent focus:outline-none transition-colors placeholder:text-ghost-dim/40"
            disabled={!connected}
          />

          {nonceInput.length === 64 && withdrawState.stealthAddress && (
            <div className="mt-4 p-3 bg-ghost-bg rounded border border-ghost-accent/20">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-ghost-accent text-xs">
                  ▶ 隐身地址已派生
                </span>
              </div>
              <div className="text-ghost-text font-mono text-xs break-all">
                {withdrawState.stealthAddress}
              </div>
            </div>
          )}

          {withdrawState.error && nonceInput.length === 64 && (
            <div className="mt-3 text-red-400 text-xs">
              ✗ {withdrawState.error}
            </div>
          )}
        </div>

        {/* 提款按钮 */}
        <button
          onClick={handleWithdraw}
          disabled={
            !connected ||
            nonceInput.length !== 64 ||
            !withdrawState.stealthAddress ||
            withdrawState.status === "pending" ||
            claimStep >= 0
          }
          className={`w-full py-4 rounded-lg font-bold text-sm tracking-wider transition-all ${
            !connected ||
            nonceInput.length !== 64 ||
            !withdrawState.stealthAddress
              ? "bg-ghost-border text-ghost-dim cursor-not-allowed"
              : withdrawState.status === "pending" || claimStep >= 0
              ? "bg-ghost-accent/20 text-ghost-accent animate-pulse cursor-wait glow-border"
              : "bg-ghost-accent/10 border border-ghost-accent text-ghost-accent hover:bg-ghost-accent/20 hover:shadow-lg hover:shadow-ghost-accent/10"
          }`}
        >
          {withdrawState.status === "success" && claimStep < 0
            ? "✅ 提款完成"
            : claimStep >= 0
            ? "[ 处理中... ]"
            : "[ 一键无痕提款 ]"}
        </button>

        {/* 底部信息 */}
        <div className="mt-8 text-center text-ghost-dim text-xs space-y-1">
          <p>GhostVest v0.1.0 | Solana Devnet</p>
          <p>
            隐私 = 自由 |{" "}
            <a
              href="https://github.com/ghostvest"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ghost-accent/50 hover:text-ghost-accent transition-colors"
            >
              GitHub
            </a>
          </p>
        </div>
      </div>

      {/* 三步 Loading 遮罩 */}
      {claimStep >= 0 && claimStep < CLAIM_STEPS.length && (
        <ClaimLoadingOverlay step={claimStep} />
      )}

      {/* 成功弹窗 */}
      {showSuccessModal && (
        <ClaimSuccessModal
          solscanUrl={withdrawState.solscanUrl}
          explorerUrl={withdrawState.explorerUrl}
          txSignature={withdrawState.txSignature}
          onClose={handleReset}
        />
      )}
    </div>
  );
}

export default function ClaimPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-ghost-bg flex items-center justify-center">
          <span className="text-ghost-accent animate-pulse">
            Loading GhostVest...
          </span>
        </div>
      }
    >
      <ClaimContent />
    </Suspense>
  );
}
