"""Tests for the Veris AI service (Phase 7).

No network access and no GPU required: the transformer model is stubbed
(``Analyzer.load_model`` is monkeypatched) and on-chain RPC calls are
monkeypatched so the tests work fully offline.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import analyzer as analyzer_mod
import main as main_mod
import onchain as onchain_mod


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
def stub_model(monkeypatch):
    """Replace the transformer with rule-based probabilities (offline)."""

    def fake_load(self):
        self._model = object()
        self._model_name = "stub-test-model"
        self._scam_index = 1

    def fake_nlp(self, text: str) -> float:
        lowered = text.lower()
        scam_kw = ("otp", "trúng thưởng", "trung thuong", "xác minh", "xac minh",
                   "khóa", "khoa", "chuyển tiền", "chuyen tien")
        return 0.9 if any(k in lowered for k in scam_kw) else 0.1

    monkeypatch.setattr(analyzer_mod.Analyzer, "load_model", fake_load)
    monkeypatch.setattr(analyzer_mod.Analyzer, "nlp_probability", fake_nlp)


@pytest.fixture()
def client() -> TestClient:
    main_mod.analyzer = analyzer_mod.Analyzer()  # fresh analyzer per test
    return TestClient(main_mod.app)


# ---------------------------------------------------------------------------
# /health
# ---------------------------------------------------------------------------
def test_health(client: TestClient):
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "model_loaded" in body


# ---------------------------------------------------------------------------
# /featurize
# ---------------------------------------------------------------------------
def test_featurize_dim_and_type(client: TestClient):
    resp = client.post("/featurize", json={"text": "Chuyển tiền gấp giúp tôi"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["dim"] == 256
    assert len(body["features"]) == 256
    assert all(isinstance(v, int) and -128 <= v <= 127 for v in body["features"])


# ---------------------------------------------------------------------------
# /analyze — four fixed samples (mocked on-chain context)
# ---------------------------------------------------------------------------
SCAM_TEXTS = [
    "Chúc mừng bạn đã trúng thưởng 10 triệu, cung cấp OTP để nhận",
    "Tài khoản bị khóa, xác minh tài khoản ngay để mở khóa thẻ ngân hàng",
]
NORMAL_TEXTS = [
    "Hôm nay trời đẹp quá, đi ăn trưa không?",
    "Gửi file báo cáo cho mình nhé, deadline thứ 6",
]


def _analyze(client: TestClient, text: str) -> dict:
    resp = client.post("/analyze", json={"text": text, "include_onchain": False})
    assert resp.status_code == 200
    return resp.json()


def test_analyze_scam_is_high_risk(client: TestClient):
    for text in SCAM_TEXTS:
        body = _analyze(client, text)
        assert body["risk_score"] >= 50, body
        assert body["label"] in ("SCAM", "SUSPICIOUS"), body
        assert len(body["signals"]) > 0
        assert len(body["legal_refs"]) > 0, "scam text should match a legal rule"


def test_analyze_normal_is_low_risk(client: TestClient):
    for text in NORMAL_TEXTS:
        body = _analyze(client, text)
        assert body["risk_score"] < 50, body
        assert body["label"] == "SAFE", body
        assert body["legal_refs"] == [], "normal text must not match legal rules"


def test_analyze_report_bonus(client: TestClient, monkeypatch):
    """Many reports against the subject must raise the score."""

    monkeypatch.setattr(
        onchain_mod, "count_reports_for_address", lambda _addr: 10
    )
    monkeypatch.setattr(
        onchain_mod, "get_wallet_context", lambda _addr, recent_limit=20: (3, 100)
    )
    text = NORMAL_TEXTS[0]
    resp = client.post(
        "/analyze",
        json={"text": text, "subject_pubkey": "11111111111111111111111111111111"},
    )
    assert resp.status_code == 200
    with_bonus = resp.json()["risk_score"]
    without = _analyze(client, text)["risk_score"]
    assert with_bonus > without
    ctx = resp.json()["on_chain_context"]
    assert ctx["report_count"] == 10
