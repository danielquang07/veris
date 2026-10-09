import io
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
import main

client = TestClient(main.app)


def test_tts_returns_wav():
    r = client.post("/text-to-speech", json={"text": "Cảnh báo lừa đảo"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("audio/wav")
    assert len(r.content) > 1000


def test_stt_roundtrip():
    r = client.post("/text-to-speech", json={"text": "Cảnh báo địa chỉ ví lừa đảo"})
    wav = r.content
    r2 = client.post(
        "/speech-to-text",
        files={"audio": ("t.wav", io.BytesIO(wav), "audio/wav")},
    )
    assert r2.status_code == 200
    text = r2.json()["text"].lower()
    assert any(k in text for k in ("cảnh báo", "lừa", "ví", "đảo"))


def test_stt_rejects_non_wav():
    r = client.post(
        "/speech-to-text",
        files={"audio": ("t.txt", io.BytesIO(b"hi"), "text/plain")},
    )
    assert r.status_code == 415


def test_tts_rejects_empty():
    r = client.post("/text-to-speech", json={"text": ""})
    assert r.status_code == 422


def test_tts_rejects_too_long():
    r = client.post("/text-to-speech", json={"text": "a" * 600})
    assert r.status_code == 422
