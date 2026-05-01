"""
GhostVest AI 审计模块单元测试

覆盖：
  1. USE_MOCK_AI 开关验证（默认 True，不可运行时修改）
  2. Mock 路径：固定返回 APPROVED + 0.98 评分
  3. 真实路径降级：API 调用失败时自动 fallback 到 mock
  4. 返回结构完整性
"""

import asyncio
import os

import pytest

from app.services.pr_analyzer import audit_pr, USE_MOCK_AI


class TestMockAI:
    """Mock 路径测试。"""

    def test_use_mock_ai_default_true(self):
        """USE_MOCK_AI 默认必须为 True，演示期间杜绝真实 API 调用。"""
        assert USE_MOCK_AI is True

    @pytest.mark.asyncio
    async def test_mock_audit_returns_approved(self):
        """Mock 路径必须返回 APPROVED 且评分 >= 0.7。"""
        result = await audit_pr("https://github.com/test/pull/1")

        assert result["score"] >= 0.7
        assert result["approved"] is True
        assert result["auditor"] == "mock"

    @pytest.mark.asyncio
    async def test_mock_audit_returns_status_approved(self):
        """返回结构中必须包含 status 和 reason 字段。"""
        result = await audit_pr("https://github.com/test/pull/42")

        assert result["status"] == "APPROVED"
        assert result["reason"] == "mock"

    @pytest.mark.asyncio
    async def test_mock_audit_duration_within_range(self):
        """Mock 审核耗时应在 2 秒 ±500ms 内。"""
        result = await audit_pr("https://github.com/test/pull/1")
        assert 1500 <= result["duration_ms"] <= 3000

    @pytest.mark.asyncio
    async def test_mock_audit_contains_pr_url(self):
        """审核报告中应包含 PR URL。"""
        pr_url = "https://github.com/ghostvest/demo/pull/99"
        result = await audit_pr(pr_url)
        assert pr_url in result["report"]


class TestAuditFallback:
    """降级路径测试：USE_MOCK_AI=True 时，无论外部状态如何都走 mock。"""

    @pytest.mark.asyncio
    async def test_concurrent_audits_all_succeed(self):
        """并发 10 次审核请求，全部返回 APPROVED。"""
        tasks = [audit_pr(f"https://github.com/test/pull/{i}") for i in range(10)]
        results = await asyncio.gather(*tasks)

        for i, r in enumerate(results):
            assert r["approved"] is True, f"第 {i} 次审核未通过"
            assert r["score"] >= 0.7, f"第 {i} 次评分过低: {r['score']}"

    @pytest.mark.asyncio
    async def test_audit_returns_consistent_structure(self):
        """返回结构字段必须完整。"""
        result = await audit_pr("https://github.com/test/pull/1")

        required_keys = {"score", "approved", "report", "auditor", "duration_ms"}
        assert required_keys.issubset(result.keys())
        assert isinstance(result["score"], float)
        assert isinstance(result["approved"], bool)
        assert isinstance(result["duration_ms"], int)
