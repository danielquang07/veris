import io
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
import main

client = TestClient(main.app)


def test_rate_limit_analyze():
    codes = []
    for _ in range(12):
        r = client.post("/analyze", json={"text": "test", "subject_pubkey": None})
        codes.append(r.status_code)
    assert 429 in codes, f"expected 429 in {codes}"


def test_body_too_large_analyze():
    big_text = "a" * 50_000
    r = client.post("/analyze", json={"text": big_text})
    assert r.status_code == 413


def test_audio_upload_allowed_under_5mb():
    fake_audio = b"RIFF" + b"\x00" * 100_000
    r = client.post(
        "/speech-to-text",
        files={"audio": ("test.wav", io.BytesIO(fake_audio), "audio/wav")},
    )
    assert r.status_code != 413, f"unexpected 413: {r.text}"


def test_health_not_limited_aggressively():
    for _ in range(5):
        r = client.get("/health")
        assert r.status_code == 200
