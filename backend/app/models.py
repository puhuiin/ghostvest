"""
GhostVest 后端数据模型

定义 API 请求/响应结构，以及内部数据存储模型。
使用 Pydantic v2 进行数据校验。
"""

import time
import uuid
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# =================================================================
# 枚举：任务状态
# =================================================================

class TaskStatus(str, Enum):
    """任务审核状态机。"""
    PENDING = "pending"
    AUDITING = "auditing"
    APPROVED = "approved"
    REJECTED = "rejected"
    PAID = "paid"
    FAILED = "failed"


# =================================================================
# API 请求模型
# =================================================================

class SubmitPRRequest(BaseModel):
    """POST /submit_pr 请求体。"""
    pr_url: str = Field(..., description="GitHub PR 链接")
    contributor_wallet: str = Field(..., description="贡献者的 Solana 主公钥 (Base58)")


class MockApproveRequest(BaseModel):
    """POST /mock_approve 请求体（仅 MOCK_MODE 时可用）。"""
    task_id: str = Field(..., description="任务 ID")


# =================================================================
# API 响应模型
# =================================================================

class SubmitPRResponse(BaseModel):
    """POST /submit_pr 响应。"""
    task_id: str
    status: TaskStatus
    message: str


class StatusResponse(BaseModel):
    """GET /status/{task_id} 响应。"""
    task_id: str
    status: TaskStatus
    pr_url: str
    contributor_wallet: str
    stealth_address: Optional[str] = None
    nonce_hex: Optional[str] = None
    tx_signature: Optional[str] = None
    audit_score: Optional[float] = None
    created_at: float
    updated_at: float


class MockApproveResponse(BaseModel):
    """POST /mock_approve 响应。"""
    task_id: str
    status: TaskStatus
    nonce_hex: str
    stealth_address: str
    message: str


class PayoutResponse(BaseModel):
    """POST /payout 响应（前端 Claim 后获取链上交易链接）。"""
    task_id: str
    status: TaskStatus
    tx_signature: Optional[str] = None
    solscan_url: Optional[str] = None
    explorer_url: Optional[str] = None
    stealth_address: Optional[str] = None
    amount_lamports: int
    message: str


class HealthResponse(BaseModel):
    """GET / 健康检查响应。"""
    status: str
    service: str
    version: str
    mock_mode: bool


# =================================================================
# 内部数据模型
# =================================================================

class BountyTask(BaseModel):
    """内部任务数据结构，存储在内存字典中。"""
    task_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pr_url: str
    contributor_wallet: str
    status: TaskStatus = TaskStatus.PENDING
    stealth_address: Optional[str] = None
    nonce_hex: Optional[str] = None
    tx_signature: Optional[str] = None
    audit_score: Optional[float] = None
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)

    def update_status(self, new_status: TaskStatus, **kwargs) -> None:
        """更新任务状态并记录时间戳。"""
        self.status = new_status
        self.updated_at = time.time()
        for k, v in kwargs.items():
            if hasattr(self, k):
                setattr(self, k, v)
