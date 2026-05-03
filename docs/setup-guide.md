# GhostVest 操作手册 — 从零到演示的完整指南

> 本手册专为**计算机初学者**编写，每一步都配有详细说明。  
> 即使你从未接触过命令行 / Git / Node.js，也能按照本文档完成环境搭建并成功运行 GhostVest。

---

## 目录

1. [你需要准备什么](#1-你需要准备什么)
2. [安装基础工具](#2-安装基础工具)
3. [获取项目代码](#3-获取项目代码)
4. [启动后端服务](#4-启动后端服务)
5. [启动前端服务](#5-启动前端服务)
6. [运行演示流程](#6-运行演示流程)
7. [运行测试（可选）](#7-运行测试可选)
8. [使用交互式演示页面](#8-使用交互式演示页面)
9. [常见问题排查](#9-常见问题排查)
10. [应急预案速查表](#10-应急预案速查表)

---

## 1. 你需要准备什么

### 1.1 硬件要求

| 项目 | 最低要求 | 推荐配置 |
|------|----------|----------|
| 操作系统 | Windows 10 / macOS 12 / Ubuntu 20.04 | Windows 11 / macOS 14 / Ubuntu 22.04 |
| 内存 | 4 GB | 8 GB 以上 |
| 磁盘空间 | 2 GB 可用空间 | 5 GB 以上 |
| 网络 | 需要访问 GitHub 和 npm 仓库 | 稳定的互联网连接 |

### 1.2 软件清单

你需要安装以下 4 个软件（下文会逐步教你安装）：

| 软件 | 用途 | 检查是否已安装的命令 |
|------|------|---------------------|
| **Git** | 下载项目代码 | `git --version` |
| **Node.js** | 运行前端 | `node --version` |
| **Python** | 运行后端 | `python --version` |
| **包管理器 npm** | 安装前端依赖（随 Node.js 自带） | `npm --version` |

### 1.3 钱包准备（演示可选）

如果你要体验完整的区块链交互，需要安装 **Phantom 钱包**浏览器插件：

1. 访问 [phantom.app](https://phantom.app/)
2. 点击 "Download" → 选择你的浏览器（Chrome / Firefox / Edge）
3. 安装完成后创建新钱包
4. 切换到 **Devnet（开发网络）**：设置 → Change Network → Devnet
5. 获取一些测试 SOL：在钱包界面点击 "Receive" → "Request Airdrop"

> **提示**：纯本地演示不需要 Phantom 钱包，交互式演示页面 `demo/index.html` 完全独立运行。

---

## 2. 安装基础工具

### 2.1 安装 Git

**Windows 用户：**

1. 打开浏览器，访问 [git-scm.com](https://git-scm.com/download/win)
2. 下载安装包，双击运行
3. 安装过程中所有选项保持默认，一路点击 "Next" 直到完成
4. 安装完成后，按 `Win + R`，输入 `cmd`，回车打开命令提示符
5. 输入以下命令验证安装：

```bash
git --version
# 应该看到类似：git version 2.43.0
```

**macOS 用户：**

1. 打开 "终端"（Terminal）— 可以在 Spotlight 搜索中输入 "Terminal"
2. 输入 `git --version`，如果提示安装 Xcode Command Line Tools，点击 "安装" 即可

**Linux (Ubuntu) 用户：**

```bash
sudo apt update
sudo apt install git -y
git --version
```

---

### 2.2 安装 Node.js

1. 打开浏览器，访问 [nodejs.org](https://nodejs.org/)
2. 下载 **LTS（长期支持版）** — 页面上绿色的大按钮
3. 双击安装包，一路 "Next" 直到完成
4. **关闭并重新打开**命令行终端（重要！安装后需要重启终端才能识别新命令）
5. 验证安装：

```bash
node --version
# 应该看到类似：v20.11.0

npm --version
# 应该看到类似：10.2.0
```

> **提示**：npm 会随 Node.js 一起自动安装，不需要单独安装。

---

### 2.3 安装 Python

**Windows 用户：**

1. 访问 [python.org/downloads](https://www.python.org/downloads/)
2. 下载 Python 3.10 或更高版本
3. 双击安装包 — **⚠️ 关键步骤：勾选 "Add Python to PATH"**（安装界面底部的复选框）
4. 点击 "Install Now" 等待安装完成
5. **关闭并重新打开**命令行终端
6. 验证安装：

```bash
python --version
# 应该看到类似：Python 3.12.0
```

**macOS 用户：**

```bash
# 使用 Homebrew 安装（如果没有 Homebrew，先安装它：https://brew.sh）
brew install python@3.12
python3 --version
```

**Linux (Ubuntu) 用户：**

```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv -y
python3 --version
```

---

### 2.4 验证所有工具

在命令行中依次运行以下命令，确保所有工具都已正确安装：

```bash
git --version      # 应输出 git version x.x.x
node --version     # 应输出 v18.x 或更高
npm --version      # 应输出 9.x 或更高
python --version   # 应输出 Python 3.10 或更高（macOS 可能需要 python3）
```

> **macOS/Linux 用户注意**：如果 `python` 命令不可用，请使用 `python3` 代替。后文所有 `python` 命令同理。

---

## 3. 获取项目代码

### 3.1 克隆仓库

打开命令行终端，执行以下命令：

```bash
# 进入你想存放项目的文件夹（例如桌面）
cd ~/Desktop          # macOS / Linux
cd %USERPROFILE%\Desktop   # Windows

# 下载项目代码
git clone https://github.com/puhuiin/ghostvest.git

# 进入项目目录
cd ghostvest
```

### 3.2 确认项目结构

进入项目后，你应该看到类似这样的目录结构：

```
ghostvest/
├── backend/          ← 后端服务（Python）
├── contracts/        ← 智能合约（Rust / Anchor）
├── demo/             ← 交互式演示页面
├── docs/             ← 文档和截图
├── frontend/         ← 前端应用（Next.js）
├── tee_crypto/       ← 跨语言密码学模块
├── README.md         ← 项目说明
└── LICENSE           ← MIT 许可证
```

> **验证**：在命令行输入 `ls`（macOS/Linux）或 `dir`（Windows），确认能看到上述文件夹。

---

## 4. 启动后端服务

后端是 GhostVest 的核心引擎，负责 AI 审核、隐身地址派生和链上交互。

### 4.1 创建 Python 虚拟环境

```bash
# 进入后端目录
cd backend

# 创建虚拟环境
python -m venv venv
```

> **什么是虚拟环境？** 虚拟环境是一个独立的 Python 运行空间，防止不同项目的依赖互相冲突。你可以把它理解为一个"沙盒"。

### 4.2 激活虚拟环境

**Windows（PowerShell）：**

```powershell
.\venv\Scripts\Activate.ps1
```

> 如果遇到执行策略错误，先运行：`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

**Windows（CMD）：**

```cmd
venv\Scripts\activate.bat
```

**macOS / Linux：**

```bash
source venv/bin/activate
```

激活成功后，命令行前面会出现 `(venv)` 标识。

### 4.3 安装 Python 依赖

```bash
pip install -r requirements.txt
```

> 这会安装 FastAPI、Rich、Pydantic 等所有必需的 Python 包。首次安装可能需要 1-2 分钟。

### 4.4 创建环境配置文件

**Windows：**

```cmd
copy .env.example .env
```

**macOS / Linux：**

```bash
cp .env.example .env
```

> GhostVest 默认使用 Mock 模式（`MOCK_MODE=1`），不需要填写真实的 API Key 就能完整运行。

### 4.5 启动后端服务器

```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**启动成功的标志：**

你会在终端看到类似以下的 Rich 风格彩色日志：

```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
```

**验证后端运行：** 在浏览器中打开 [http://localhost:8000](http://localhost:8000)，应看到：

```json
{"status":"ok","service":"GhostVest TEE Simulator","version":"0.1.0","mock_mode":true}
```

> **保持终端窗口打开！** 后端服务需要持续运行。你将在另一个终端窗口中启动前端。

---

## 5. 启动前端服务

**⚠️ 请打开一个新的命令行终端窗口**（不要关闭后端的终端）。

### 5.1 进入前端目录

```bash
# 回到项目根目录
cd ghostvest

# 进入前端目录
cd frontend
```

### 5.2 安装前端依赖

```bash
npm install
```

> 首次安装会下载约 200MB 的 Node.js 依赖包，可能需要 2-5 分钟，取决于网络速度。

### 5.3 创建前端环境配置

**Windows：**

```cmd
copy .env.local.example .env.local
```

**macOS / Linux：**

```bash
cp .env.local.example .env.local
```

默认配置已经可以满足本地开发需求：

```env
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### 5.4 启动前端开发服务器

```bash
npm run dev
```

**启动成功的标志：**

终端会显示：

```
▲ Next.js 14.2.5
- Local:        http://localhost:3000
```

**验证前端运行：** 在浏览器中打开 [http://localhost:3000](http://localhost:3000)，应看到 GhostVest 的欢迎页面。

---

## 6. 运行演示流程

现在前后端都已经启动，让我们运行完整的演示流程。

### 6.1 方式一：命令行全自动演示

在项目根目录下打开新终端，运行：

```bash
cd frontend
node scripts/demo-claim.js
```

这个脚本会自动执行以下步骤：

1. 调用 `/submit_pr` 提交一个模拟 PR
2. 调用 `/mock_approve` 强制通过审核
3. 调用 `/status/{task_id}` 查询任务状态
4. 调用 `/payout` 获取链上交易链接

### 6.2 方式二：浏览器手动演示

1. 打开 [http://localhost:3000/claim](http://localhost:3000/claim)
2. 如果安装了 Phantom 钱包，点击页面上的连接钱包按钮
3. 输入 nonce（64 位十六进制字符串）或等待后端自动填入
4. 点击 "一键无痕提款"
5. 观察三步加载动画：获取凭证 → 推导隐身私钥 → 提款签名
6. 成功后会弹出 Solscan 交易弹窗

### 6.3 方式三：API 直接测试

你也可以直接在浏览器或使用 curl 命令测试 API：

```bash
# 1. 提交 PR 审核
curl -X POST http://localhost:8000/submit_pr ^
  -H "Content-Type: application/json" ^
  -d "{\"pr_url\":\"https://github.com/test/pull/1\",\"contributor_wallet\":\"DYw8jCTfwHNRJhhmFcbXvVDTqLMEABCbKvjLgPZbSv7E\"}"

# 记下返回的 task_id

# 2. 强制通过审核（Mock 模式）
curl -X POST http://localhost:8000/mock_approve ^
  -H "Content-Type: application/json" ^
  -d "{\"task_id\":\"你的task_id\"}"

# 3. 查看状态
curl http://localhost:8000/status/你的task_id

# 4. 获取交易链接
curl -X POST "http://localhost:8000/payout?task_id=你的task_id"
```

> **macOS/Linux 用户**：将 `^` 替换为 `\` 作为行续行符。

### 6.4 查看后端日志

在后端终端窗口中，你可以看到完整的 Rich 风格彩色日志：

```
14:23:01.123 [#] 收到请求: PR=https://github.com/test/pull/1, Wallet=DYw8jCTfwHNRJhhm...
14:23:01.124 [*] 任务创建: e20fe986-b779-4a...
14:23:01.125 [~] AI Audit 开始审核: e20fe986-b779-4a...
14:23:03.127 [+] AI Audit Passed — score=0.98, auditor=mock, duration=2001ms
14:23:03.128 [*] Deriving Stealth Key…
14:23:03.130 [+] 隐身地址已生成: BymrQNsCznN4z1jV...
14:23:03.131 [#] Nonce: 9697ee5402cd6945...
14:23:03.132 [~] Storing encrypted nonce to 0G…
14:23:03.133 [+] Nonce stored — source=local
14:23:03.134 [~] Submitting to Solana Devnet…
14:23:04.200 [+] 交易完成: 5UfDuX7BkGHN...
```

---

## 7. 运行测试（可选）

### 7.1 后端测试（Python）

```bash
# 确保在 backend 目录下，且虚拟环境已激活
cd backend
python -m pytest tests/ -v
```

预期结果：**24 项测试全部通过 ✅**

```
tests/test_ai_audit.py::test_use_mock_ai_flag          PASSED
tests/test_ai_audit.py::test_audit_returns_score         PASSED
tests/test_crypto_utils.py::test_deterministic_derive    PASSED
tests/test_crypto_utils.py::test_cross_lang_consistency  PASSED
... (共 24 项)
```

### 7.2 前端测试（TypeScript）

```bash
# 进入密码学验证目录
cd tee_crypto
npm install
npx vitest run
```

预期结果：**16 项测试全部通过 ✅**

### 7.3 测试总览

| 模块 | 测试数 | 通过率 |
|------|--------|--------|
| Python 后端 | 24 | 100% |
| TypeScript 密码学 | 16 | 100% |
| **合计** | **40** | **100%** |

---

## 8. 使用交互式演示页面

GhostVest 提供了一个**零依赖的交互式演示页面**，无需启动任何服务即可使用。

### 8.1 打开演示页面

直接在浏览器中打开项目中的 `demo/index.html` 文件：

```
ghostvest/demo/index.html
```

**打开方式：**

- **Windows**：在文件资源管理器中双击 `index.html`
- **macOS**：在 Finder 中双击 `index.html`（默认用 Safari 打开）
- **通用方式**：在浏览器地址栏输入 `file:///完整路径/demo/index.html`

> **推荐使用 Chrome 或 Edge 浏览器**，获得最佳动画效果。

### 8.2 演示页面包含以下模块

| 模块 | 说明 | 交互方式 |
|------|------|----------|
| 核心能力 | 6 张功能卡片，hover 高亮 | 鼠标悬停 |
| 系统架构 | 6 节点流程图动画 | 点击"播放架构动画" |
| 终端模拟 | 模拟后端 Rich 日志输出 | 点击"运行模拟" |
| 交互式 Claim | 三步加载动画 + Solscan 弹窗 | 点击"一键无痕提款" |
| 技术对比 | HMAC vs ZK vs Mixer 对比表 | 自动展示 |
| 项目数据 | 滚动触发数字计数动画 | 滚动页面 |
| 快速开始 | 4 步启动指南 | 阅读参考 |
| 演示形式 | 现场 / 录屏 / 交互三种形式 + 应急预案 | 阅读参考 |

### 8.3 演示操作流程

1. **向下滚动** → 核心能力卡片随滚动动画渐入
2. **点击"播放架构动画"** → 6 个节点依次高亮，展示数据流
3. **点击"运行模拟"** → 终端逐行打印日志，模拟真实后端输出
4. **点击"一键无痕提款"** → 三步加载动画 → 成功弹窗 → Solscan 链接
5. **继续滚动** → 数字计数动画自动触发，展示项目数据

---

## 9. 常见问题排查

### Q1: `python` 命令找不到

**症状**：输入 `python` 提示 "command not found" 或打开了 Microsoft Store

**解决**：
- Windows 用户试试 `py` 或 `python3`
- macOS/Linux 用户使用 `python3`
- 确保安装 Python 时勾选了 "Add Python to PATH"

### Q2: `pip install` 很慢或超时

**症状**：安装依赖时进度条不动

**解决**：使用国内镜像源：

```bash
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

### Q3: `npm install` 报错

**症状**：安装前端依赖时出现 ERR 错误

**解决**：
```bash
# 清除缓存后重试
npm cache clean --force
rm -rf node_modules package-lock.json    # macOS / Linux
rmdir /s /q node_modules && del package-lock.json   # Windows
npm install
```

### Q4: 端口 8000 或 3000 被占用

**症状**：提示 `EADDRINUSE` 或 `Port 8000 is already in use`

**解决**：
```bash
# 查找占用端口的进程（Windows）
netstat -ano | findstr :8000
# 使用 PID 终止进程
taskkill /PID <进程PID> /F

# macOS / Linux
lsof -i :8000
kill -9 <进程PID>
```

### Q5: 后端启动后访问 /payout 返回 404

**症状**：`/payout?task_id=xxx` 返回 404

**解决**：确保先调用了 `/submit_pr` 并等待审核完成（状态变为 `paid`）。可以用 `/mock_approve` 强制通过。

### Q6: 前端页面白屏

**症状**：打开 localhost:3000 后页面空白

**解决**：
1. 确认后端正在运行（浏览器访问 http://localhost:8000 看是否有响应）
2. 检查 `frontend/.env.local` 文件中的 `NEXT_PUBLIC_BACKEND_URL` 是否正确
3. 查看浏览器控制台（F12 → Console）是否有报错

### Q7: Phantom 钱包连接失败

**症状**：点击连接钱包没反应

**解决**：
1. 确认已安装 Phantom 浏览器插件
2. 确认钱包网络已切换到 Devnet
3. 刷新页面后重试

### Q8: 交互式演示页面动画不流畅

**症状**：demo/index.html 的动画卡顿

**解决**：
1. 使用 Chrome 或 Edge 浏览器
2. 关闭其他占用资源的标签页
3. 确保浏览器不是在节能模式下运行

---

## 10. 应急预案速查表

演示前请打印此表格备用：

| 场景 | 现象 | 应急方案 | 耗时 |
|------|------|----------|------|
| **网络断开** | npm install 或 pip install 失败 | 使用预装好的 node_modules 和 venv；交互式页面 demo/index.html 离线可用 | 0s |
| **后端启动失败** | uvicorn 报错 | 直接播放录屏视频；使用交互式页面的终端模拟 | 5s |
| **前端启动失败** | Next.js 报错 | 后端 Swagger UI (localhost:8000/docs) 可直接演示 API | 3s |
| **Solana RPC 超时** | 链上交互卡住 | Mock 模式自动降级，返回模拟签名 | 0s |
| **0G 网络不可用** | 存储失败 | 自动降级到本地 fallback.json（5 分钟 TTL） | 0s |
| **Phantom 钱包问题** | 钱包连接失败 | 交互式页面不需要钱包 | 2s |
| **浏览器不兼容** | 页面显示异常 | 切换到 Chrome / Edge | 10s |
| **完全无电脑** | 无法演示 | 打开手机浏览器访问 GitHub 仓库 + 交互式页面 | 30s |

**演示前 Checklist：**

- [ ] 后端已启动，http://localhost:8000 返回正常 JSON
- [ ] 前端已启动，http://localhost:3000 显示页面
- [ ] 浏览器已打开 http://localhost:3000/claim
- [ ] demo/index.html 可以正常打开
- [ ] 录屏视频已准备好（备用）
- [ ] 终端窗口日志输出正常，字体够大

---

## 附录：一键启动脚本

如果你已经完成了环境搭建，可以使用以下脚本一键启动所有服务：

**Windows (PowerShell)：**

```powershell
# 在 ghostvest 根目录下运行
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; .\venv\Scripts\Activate.ps1; python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"
Start-Process "http://localhost:3000/claim"
Start-Process "demo/index.html"
```

**macOS / Linux：**

```bash
# 在 ghostvest 根目录下运行
cd backend && source venv/bin/activate && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
cd ../frontend && npm run dev &
sleep 5
open http://localhost:3000/claim
open demo/index.html
```

> **提示**：首次使用前请确保已完成 `pip install` 和 `npm install`。

---

*本手册由 GhostVest 团队编写，最后更新于 2026 年 5 月。*  
*如有问题，请在 GitHub 上提交 Issue：https://github.com/puhuiin/ghostvest/issues*
