# GhostVest TEE Simulator Dockerfile
# 多阶段构建，目标镜像 <= 150MB

# =================================================================
# Stage 1: 依赖安装
# =================================================================
FROM python:3.12-slim AS builder

WORKDIR /app

# 系统依赖（solders 需要 Rust 编译环境，使用预编译 wheel）
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# =================================================================
# Stage 2: 运行镜像
# =================================================================
FROM python:3.12-slim AS runtime

WORKDIR /app

# 从 builder 阶段复制已安装的依赖
COPY --from=builder /install /usr/local

# 复制应用代码
COPY app/ ./app/

# 环境变量默认值
ENV MOCK_MODE=1
ENV RPC_URL=https://api.devnet.solana.com
ENV BOUNTY_ID=1
ENV AMOUNT_LAMPORTS=1000000
ENV PYTHONUNBUFFERED=1

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/')" || exit 1

# 启动命令
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
