/**
 * GhostVest 前端 Toast 通知系统
 *
 * 统一错误处理：所有 catch 块禁止直接 console.error / alert，
 * 必须通过 toast.error() 展示用户友好信息。
 *
 * 演示期间绝不暴露堆栈或技术细节。
 */

export interface ToastOptions {
  duration?: number;
  type?: "success" | "error" | "info";
}

interface ToastContainer {
  show: (msg: string, opts?: ToastOptions) => void;
}

function createToast(): ToastContainer {
  if (typeof document === "undefined") {
    return { show: () => {} };
  }

  let container = document.getElementById("ghostvest-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "ghostvest-toast-container";
    container.style.cssText =
      "position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;";
    document.body.appendChild(container);
  }

  function show(msg: string, opts?: ToastOptions) {
    const duration = opts?.duration ?? 4000;
    const type = opts?.type ?? "error";

    const colors: Record<string, { bg: string; border: string; text: string }> = {
      error:   { bg: "#1a0000", border: "#ff4444", text: "#ff6666" },
      success: { bg: "#001a00", border: "#00ff88", text: "#00ff88" },
      info:    { bg: "#000a1a", border: "#4488ff", text: "#6699ff" },
    };
    const c = colors[type];

    const el = document.createElement("div");
    el.style.cssText = `
      pointer-events:auto;
      background:${c.bg};
      border:1px solid ${c.border};
      color:${c.text};
      padding:12px 20px;
      border-radius:6px;
      font-family:monospace;
      font-size:13px;
      max-width:360px;
      word-break:break-all;
      opacity:0;
      transform:translateX(20px);
      transition:all 0.3s ease;
    `;
    el.textContent = msg;
    container!.appendChild(el);

    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translateX(0)";
    });

    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateX(20px)";
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  return { show };
}

const toastInstance = createToast();

export const toast = {
  error: (msg: string, opts?: ToastOptions) =>
    toastInstance.show(msg, { ...opts, type: "error" }),
  success: (msg: string, opts?: ToastOptions) =>
    toastInstance.show(msg, { ...opts, type: "success" }),
  info: (msg: string, opts?: ToastOptions) =>
    toastInstance.show(msg, { ...opts, type: "info" }),
};
