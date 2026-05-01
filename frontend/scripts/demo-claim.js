/**
 * GhostVest 演示脚本
 * 
 * 自动化演示完整提款流程：
 *   1. 提交一个 mock PR
 *   2. 等待审核通过
 *   3. 获取 nonce
 *   4. 输出 Claim 页面的深度链接
 * 
 * 运行方式：cd frontend && npm run demo:claim
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const FRONTEND_URL = "http://localhost:3000";

// 演示用的贡献者钱包（实际演示时替换为真实钱包地址）
const DEMO_WALLET = "5ULyFk3fE9zFRvAwXVnYtKRMTnGFHZvMLZScYJM1nFeS";

async function runDemo() {
  console.log("====================================");
  console.log("  GhostVest Demo: 隐私薪酬 Claim");
  console.log("====================================\n");

  // Step 1: 提交 PR
  console.log("[1/4] 提交 PR 链接...");
  const submitRes = await fetch(`${BACKEND_URL}/submit_pr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pr_url: "https://github.com/ghostvest/demo/pull/42",
      contributor_wallet: DEMO_WALLET,
    }),
  });
  const { task_id } = await submitRes.json();
  console.log(`  ✓ Task ID: ${task_id}\n`);

  // Step 2: 等待审核（MOCK 模式下很快）
  console.log("[2/4] 等待 AI 审核...");
  await new Promise((r) => setTimeout(r, 2000));

  // Step 3: 获取状态
  console.log("[3/4] 获取审核结果...");
  const statusRes = await fetch(`${BACKEND_URL}/status/${task_id}`);
  const statusData = await statusRes.json();
  console.log(`  ✓ 状态: ${statusData.status}`);
  console.log(`  ✓ 隐身地址: ${statusData.stealth_address || "N/A"}`);
  console.log(`  ✓ Nonce: ${statusData.nonce_hex ? statusData.nonce_hex.slice(0, 16) + "..." : "N/A"}\n`);

  // Step 4: 输出 Claim 链接
  console.log("[4/4] Claim 页面链接:");
  console.log(`  ${FRONTEND_URL}/claim?task_id=${task_id}\n`);

  if (statusData.nonce_hex) {
    console.log("  或直接使用 nonce:");
    console.log(`  ${FRONTEND_URL}/claim?task_id=${task_id}`);
    console.log(`  Nonce: ${statusData.nonce_hex}\n`);
  }

  console.log("====================================");
  console.log("  演示流程完成！请在浏览器中打开 Claim 页面");
  console.log("====================================");
}

runDemo().catch(console.error);
