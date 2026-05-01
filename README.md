<div align="center">

<img src="https://raw.githubusercontent.com/puhuiin/ghostvest/main/docs/ghostvest-logo.png" alt="GhostVest - The Privacy Execution Layer for Web3 Native Payroll" width="200" />

# GhostVest

**The Privacy Execution Layer for Web3 Native Payroll**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Stars](https://img.shields.io/github/stars/puhuiin/ghostvest?style=flat)](https://github.com/puhuiin/ghostvest/stargazers)
[![Forks](https://img.shields.io/github/forks/puhuiin/ghostvest?style=flat)](https://github.com/puhuiin/ghostvest/network/members)
[![Issues](https://img.shields.io/github/issues/puhuiin/ghostvest?style=flat)](https://github.com/puhuiin/ghostvest/issues)
[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://python.org)
[![Node.js](https://img.shields.io/badge/Node.js-18+-brightgreen.svg)](https://nodejs.org)
[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF.svg)](https://solana.com)
[![Tests](https://img.shields.io/badge/Tests-40%20passing-brightgreen.svg)](#-测试指南)

Stealth addresses · AI-driven audit · Zero-knowledge payout — for DAOs that pay real contributors, not wallets.

</div>

---

## 📖 目录

- [项目简介](#-项目简介)
- [视觉展示](#-视觉展示)
- [技术栈](#-技术栈)
- [快速开始](#-快速开始)
- [功能清单](#-功能清单)
- [配置说明](#-配置说明)
- [API 文档](#-api-文档)
- [测试指南](#-测试指南)
- [贡献规范](#-贡献规范)
- [许可证与作者](#-许可证与作者)
- [致谢](#-致谢)

---

## 🚀 项目简介

GhostVest 是面向 DAO 生态的**隐私薪酬执行层**。它通过确定性 HMAC-SHA256 隐身地址派生，将每笔薪资支付映射到一个**链上无历史记录的全新地址**，彻底斩断贡献者真实身份与资金流向的链上关联。内置 AI 驱动的 TEE 审计预言机，确保每一笔支付都锚定在**经验证的真实代码产出（Actual GDP）**之上，而非治理空转。

**核心价值**：让 DAO 能像传统公司一样发薪——贡献者收到钱，但没有人能从链上数据反推"这个人是谁"。这是机构资金入场 DAO 生态的合规前提，也是顶级开发者选择 DAO 工作的隐私底线。

---

## 🎨 视觉展示

<div align="center">

### Claim Portal — 三步加载动画

<img src="https://raw.githubusercontent.com/puhuiin/ghostvest/main/docs/screenshot-claim-loading.png" alt="GhostVest Claim Portal 三步加载动画界面，深色终端风格，打字机效果展示从 0G 网络获取凭证、推导隐身私钥、提款签名三个步骤" width="400" />

*深色终端主题，打字机逐字揭示三步状态：获取加密凭证 → 推导隐身私钥 → 提款签名*

---

### Solscan 交易成功弹窗

<img src="https://raw.githubusercontent.com/puhuiin/ghostvest/main/docs/screenshot-solscan-modal.png" alt="GhostVest 提款成功弹窗，绿色渐变按钮链接 Solscan 链上交易，提示资金已转入无历史记录的新地址" width="400" />

*绿色渐变大按钮直达 Solscan，下方提示「资金已转入无历史记录的新地址，隐私链路完成」*

---

### 后端 Rich 终端日志

<img src="https://raw.githubusercontent.com/puhuiin/ghostvest/main/docs/screenshot-terminal-logs.png" alt="GhostVest 后端终端日志，使用 Python rich 库渲染的彩色日志，展示 AI Audit Passed、Deriving Stealth Key、Storing to 0G、交易完成等步骤" width="800" />

*Python Rich 库渲染的极客风终端日志，带毫秒级时间戳和 `[+]/[*]/[~]` 状态标识*

</div>

---

## 🛠 技术栈

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **智能合约** | Anchor (Rust) | 0.30.1 | BountyState PDA 管理、资金释放 |
| **后端框架** | FastAPI (Python) | 0.115.6 | TEE 模拟器、RESTful API |
| **前端框架** | Next.js (React) | 14.2.5 | Claim Portal、钱包连接 |
| **密码学** | HMAC-SHA256 + ed25519 | — | 隐身地址确定性派生 |
| **区块链** | Solana (solders) | 0.21.0 | 转账、链上交互 |
| **存储** | 0G Network + fallback | — | 加密 nonce 分布式存证 |
| **AI 审计** | Anthropic Claude | 0.43.0 | PR 代码质量评分 |
| **终端渲染** | Rich (Python) | 13.9.4 | 彩色极客风日志输出 |
| **类型校验** | Pydantic v2 | 2.10.4 | API 请求/响应数据校验 |
| **测试** | pytest + Vitest | 8.3.4 / 1.x | 后端 24 项 + 前端 16 项测试 |
| **容器化** | Docker | — | 多阶段构建，≤ 150 MB |

---

## 🏁 快速开始

### 5.1 环境要求

| 依赖 | 最低版本 | 检查命令 |
|------|----------|----------|
| Node.js | ≥ 18.0 | `node --version` |
| Python | ≥ 3.10 | `python --version` |
| Solana CLI | ≥ 1.18 | `solana --version` |
| Anchor | ≥ 0.30 | `anchor --version` |

### 5.2 本地开发

```bash
# 1. 克隆仓库
git clone https://github.com/puhuiin/ghostvest.git
cd ghostvest

# 2. 启动后端
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS / Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 3. 启动前端（新终端）
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
# 默认端口: http://localhost:3000

# 4. 打开浏览器
# Claim 页面: http://localhost:3000/claim
# API 文档:   http://localhost:8000/docs
```

### 5.3 生产构建与部署

**Docker 部署（后端）：**

```bash
cd backend
docker build -t ghostvest-backend .
docker run -p 8000:8000 --env-file .env ghostvest-backend
```

**前端构建：**

```bash
cd frontend
npm run build
npm start
```

**Vercel 一键部署（前端）：**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/puhuiin/ghostvest&root-directory=frontend)

> 前端为纯静态 Next.js 应用，可直接部署至 Vercel / Netlify / 任何支持 Node.js 的平台。后端建议使用 Docker 部署至 Fly.io / Railway / AWS ECS。

---

## ✅ 功能清单

<details>
<summary><strong>📋 已实现功能 (v0.1.0)</strong></summary>

| 功能 | 描述 | 优先级 |
|------|------|--------|
| AI 审计 Mock 开关 | `USE_MOCK_AI=True` 硬编码，演示环境零风险 | 🔴 P0 |
| 确定性隐身地址派生 | HMAC-SHA256(key=nonce, msg=pubkey) → ed25519 keypair | 🔴 P0 |
| Python / TypeScript 交叉验证 | 100 组随机向量字节级一致性验证 | 🔴 P0 |
| 0G 网络降级方案 | 0G 不可用时自动写入 `fallback.json`（5 分钟 TTL） | 🔴 P0 |
| 前端 Toast 统一错误兜底 | 所有 catch 块统一调用 `toast.error()` | 🟡 P1 |
| Solscan 高亮弹窗 | `/payout` 返回 `solscan_url`，前端绿色模态框 | 🟡 P1 |
| 极客风终端日志 | Python Rich 库，带毫秒时间戳和颜色标识 | 🟡 P1 |
| 三步 Claim 动画 | 打字机效果 + 进度条，每步 700ms | 🟡 P1 |
| Anchor 智能合约 | BountyState PDA、`initialize_bounty`、`release_to_stealth` | 🔴 P0 |
| 后端 RESTful API | `/submit_pr`、`/status`、`/payout`、`/mock_approve` | 🔴 P0 |
| Phantom 钱包集成 | Solana 钱包适配器，Devnet 连接 | 🔴 P0 |
| 跨语言密码学一致性 | Python `solders` ↔ TypeScript `@solana/web3.js` | 🔴 P0 |

</details>

<details>
<summary><strong>🔨 开发中功能 (v0.2.0)</strong></summary>

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 真实 Claude API 集成 | `USE_MOCK_AI=False` 时接入 Anthropic API | 🟡 P1 |
| 0G Network SDK 对接 | 替换 Mock，接入真实 0G 存储 | 🟡 P1 |
| Cypress E2E 测试 | 拦截 API 返回 500，断言仅出现 Toast | 🟢 P2 |
| 批量发放 | 单次交易批量向多个隐身地址转账 | 🟡 P1 |

</details>

<details>
<summary><strong>🗺 Roadmap (v1.0)</strong></summary>

| 功能 | 描述 | 优先级 |
|------|------|--------|
| Mainnet 部署 | Solana Mainnet-Beta 合约部署 | 🔴 P0 |
| DAO 治理集成 | Realms / SPL Gov 投票触发发放 | 🟡 P1 |
| 多链支持 | EVM 隐身地址（secp256k1 派生） | 🟢 P2 |
| 合规导出 | 零知识证明的税务合规报告 | 🟢 P2 |

</details>

---

## ⚙ 配置说明

### 后端环境变量 (`backend/.env`)

```env
# ============================================
# GhostVest TEE Simulator 环境变量
# 复制此文件为 .env 并填入实际值
# ============================================

# Mock 模式开关（1=开启，0=关闭）
# 开启后所有外部 API 调用使用 Mock 数据
MOCK_MODE=1

# TEE 预言机私钥（Base58 编码的 64 字节 Keypair）
# 在 MOCK_MODE=1 时可以留空
TEE_PRIVATE_KEY=

# Solana RPC 节点地址
RPC_URL=https://api.devnet.solana.com

# Bounty ID（对应链上合约的 bounty_id）
BOUNTY_ID=1

# 转账金额（lamports，1 SOL = 1,000,000,000 lamports）
AMOUNT_LAMPORTS=1000000

# Anthropic API Key（可选，用于真实 LLM 审核）
ANTHROPIC_API_KEY=
```

| 字段 | 必填 | 说明 | 获取方式 | 示例值 |
|------|------|------|----------|--------|
| `MOCK_MODE` | ✅ | Mock 外部 API | 默认 `1` | `1` |
| `TEE_PRIVATE_KEY` | 仅生产 | TEE 预言机签名密钥 | `solana-keygen new` | `5Kd3...` |
| `RPC_URL` | ✅ | Solana RPC 端点 | 公共 Devnet 或 Helius/QuickNode | `https://api.devnet.solana.com` |
| `BOUNTY_ID` | ✅ | 链上 Bounty 标识 | 自定义 | `1` |
| `AMOUNT_LAMPORTS` | ✅ | 单次支付金额 | 业务决定 | `1000000` |
| `ANTHROPIC_API_KEY` | 仅生产 | Claude API 密钥 | [console.anthropic.com](https://console.anthropic.com) | `sk-ant-...` |

### 前端环境变量 (`frontend/.env.local`)

| 字段 | 必填 | 说明 | 示例值 |
|------|------|------|--------|
| `NEXT_PUBLIC_RPC_URL` | ✅ | 前端连接的 Solana RPC | `https://api.devnet.solana.com` |
| `NEXT_PUBLIC_BACKEND_URL` | ✅ | 后端 API 地址 | `http://localhost:8000` |

---

## 📡 API 文档

> 完整交互式文档：启动后端后访问 **http://localhost:8000/docs**（Swagger UI）

### 基础信息

| 属性 | 值 |
|------|-----|
| Base URL | `http://localhost:8000` |
| 协议 | HTTP / HTTPS |
| 数据格式 | JSON |
| 认证方式 | 无（MVP 阶段，生产环境建议 Bearer Token） |

### 接口列表

#### `POST /submit_pr` — 提交 PR 审核

**请求：**

```json
{
  "pr_url": "https://github.com/dao/repo/pull/42",
  "contributor_wallet": "DYw8jCTfwHNRJhhmFcbXvVDTqLMEABCbKvjLgPZbSv7E"
}
```

**响应 `200`：**

```json
{
  "task_id": "e20fe986-b779-4a0e-b662-60c242b2b86d",
  "status": "pending",
  "message": "任务已提交，正在等待 AI 审核..."
}
```

---

#### `GET /status/{task_id}` — 查询任务状态

**响应 `200`（审核完成）：**

```json
{
  "task_id": "e20fe986-b779-4a0e-b662-60c242b2b86d",
  "status": "paid",
  "pr_url": "https://github.com/dao/repo/pull/42",
  "contributor_wallet": "DYw8jCTfwHNRJhhmFcbXvVDTqLMEABCbKvjLgPZbSv7E",
  "stealth_address": "BymrQNsCznN4z1jVgLCgfbMrssqknqwjcRRQeWdqfoB4",
  "nonce_hex": "9697ee5402cd69451a3e80a272616a53...",
  "tx_signature": "5UfDuX7BkGHN...",
  "audit_score": 0.98,
  "created_at": 1719000000.0,
  "updated_at": 1719000002.0
}
```

**状态值：** `pending` → `auditing` → `approved` / `rejected` → `paid` / `failed`

---

#### `POST /payout` — 获取链上交易链接

**请求参数（Query）：** `?task_id=e20fe986-...`

**响应 `200`：**

```json
{
  "task_id": "e20fe986-b779-4a0e-b662-60c242b2b86d",
  "status": "paid",
  "tx_signature": "5UfDuX7BkGHN...",
  "solscan_url": "https://solscan.io/tx/5UfDuX7BkGHN...?cluster=devnet",
  "explorer_url": "https://explorer.solana.com/tx/5UfDuX7BkGHN...?cluster=devnet",
  "stealth_address": "BymrQNsCznN4z1jVgLCgfbMrssqknqwjcRRQeWdqfoB4",
  "amount_lamports": 1000000,
  "message": "链上交易已完成，请查看 Solscan 确认。"
}
```

**错误码：**

| 状态码 | 含义 | 触发条件 |
|--------|------|----------|
| `200` | 成功 | 请求正常处理 |
| `400` | 请求参数错误 | 任务状态不是 PAID |
| `403` | 禁止访问 | `mock_approve` 在非 Mock 模式下调用 |
| `404` | 资源不存在 | task_id 不存在 |
| `500` | 服务器内部错误 | 未捕获异常 |

---

## 🧪 测试指南

### 后端测试（Python）

```bash
cd backend
pip install -r requirements.txt
python -m pytest tests/ -v
```

| 测试文件 | 测试数 | 覆盖范围 |
|----------|--------|----------|
| `test_ai_audit.py` | 7 | Mock 开关、审核返回值、并发安全、降级路径 |
| `test_crypto_utils.py` | 17 | Nonce 生成、HMAC 派生、Keypair 确定性、100 组交叉验证 |

**合计：24 项测试，全部通过 ✅**

### 前端测试（TypeScript）

```bash
cd tee_crypto
npm install
npx vitest run
```

| 测试文件 | 测试数 | 覆盖范围 |
|----------|--------|----------|
| `stealth.test.ts` | 16 | HMAC 派生、Keypair 生成、跨语言一致性（Python ↔ TypeScript） |

**合计：16 项测试，全部通过 ✅**

### 总计

| 指标 | 值 |
|------|-----|
| 总测试数 | **40** |
| 通过率 | **100%** |
| 跨语言交叉验证 | **100 组随机向量，字节级一致** |

---

## 🤝 贡献规范

### 分支命名

```
feat/xxx      # 新功能
fix/xxx       # Bug 修复
docs/xxx      # 文档更新
refactor/xxx  # 代码重构
test/xxx      # 测试相关
```

### Commit Message 格式

采用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

# 示例
feat(backend): add /payout endpoint with solscan_url
fix(frontend): resolve toast z-index conflict with wallet modal
docs(readme): add API documentation section
```

### Pull Request 流程

1. 从 `main` 创建特性分支
2. 完成开发后确保所有测试通过
3. 提交 PR，填写模板描述
4. 至少 1 人 Code Review 通过后合并

### 行为准则

参与本项目即表示同意遵守 [Contributor Covenant](https://www.contributor-covenant.org/) 行为准则。我们致力于为所有人提供友好、安全、包容的协作环境。

---

## 📄 许可证与作者

本项目基于 **MIT License** 开源。详见 [LICENSE](LICENSE) 文件。

<div align="center">

<a href="https://github.com/puhuiin">
  <img src="https://github.com/puhuiin.png" alt="Neko Neri" width="80" style="border-radius:50%" />
</a>

**Neko Neri** — [@puhuiin](https://github.com/puhuiin)

[![GitHub](https://img.shields.io/badge/GitHub-puhuiin-181717?logo=github)](https://github.com/puhuiin)
[![Email](https://img.shields.io/badge/Email-LHL810219@163.com-EA4335?logo=gmail)](mailto:LHL810219@163.com)

</div>

---

## 🙏 致谢

| 项目 | 用途 |
|------|------|
| [Solana](https://solana.com) | 高性能 Layer 1 区块链 |
| [Anchor](https://www.anchor-lang.com/) | Solana 智能合约开发框架 |
| [FastAPI](https://fastapi.tiangolo.com/) | Python 异步 Web 框架 |
| [Next.js](https://nextjs.org) | React 全栈框架 |
| [Anthropic Claude](https://www.anthropic.com/) | AI 代码审计引擎 |
| [0G Network](https://0g.ai) | 去中心化存储层 |
| [Rich](https://rich.readthedocs.io/) | Python 终端富文本渲染 |
| [Phantom](https://phantom.app/) | Solana 钱包 |
| [JetBrains Mono](https://www.jetbrains.com/mono/) | 编程字体 |

---

<div align="center">

**Built with conviction at Colosseum Hackathon 2026**

*Privacy is not a feature. It is a prerequisite.*

</div>
