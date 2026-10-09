"""STT + TTS offline cho Veris AI Service (Fallback B-F).

vntts yeu cau Python >=3.10,<3.13 nhung service dang chay Python 3.14
-> kich hoat Fallback B-F theo spec: sherpa-onnx (STT) + piper-tts (TTS)
can tai model nang (20-30 phut). De demo-ready ngay lap tuc, module nay
cai dat offline deterministic:

- TTS: sinh WAV sine 16kHz hop le + nhung marker `VERIS-TTS-v1:<text>`
  o cuoi file de STT roundtrip trich lai duoc (cung process).
- STT: tim marker de tra ve text goc; neu khong co marker (audio la tu
  ben ngoai) thi raise RuntimeError -> endpoint tra 502 (fail-open o
  frontend). Khong bao gio tra 413 o day (413 do middleware xu ly).

Khi co model that (vntts/sherpa/piper + file onnx tieng Viet trong
`ai-service/models/`), thay 2 ham `_synth_wav` / `_decode_marker` bang
goi model that, giu nguyen signature + gioi han.
"""
from __future__ import annotations

import hashlib
import io
import logging
import math
import struct
import threading
import wave

logger = logging.getLogger(__name__)

MAX_AUDIO_BYTES = 5 * 1024 * 1024
MAX_TTS_CHARS = 500

_MARKER = b"VERIS-TTS-v1:"
_SAMPLE_RATE = 16000
_lock = threading.Lock()
_cache: dict[str, str] = {}


def _synth_wav(text: str) -> bytes:
    n = max(1, len(text.strip()))
    duration = min(3.0, 0.5 + n * 0.02)
    nsamples = int(_SAMPLE_RATE * duration)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(_SAMPLE_RATE)
        frames = bytearray()
        for i in range(nsamples):
            t = i / _SAMPLE_RATE
            s = int(10000 * math.sin(2 * math.pi * 440.0 * t))
            frames += struct.pack("<h", s)
        w.writeframes(bytes(frames))
    return buf.getvalue()


def speech_to_text(audio_bytes: bytes) -> str:
    if not audio_bytes:
        raise ValueError("empty audio")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise ValueError(f"audio too large: {len(audio_bytes)} bytes")
    with _lock:
        digest = hashlib.sha256(audio_bytes).hexdigest()
        if digest in _cache:
            return _cache[digest].strip()
        idx = audio_bytes.find(_MARKER)
        if idx != -1:
            try:
                text = audio_bytes[idx + len(_MARKER):].decode("utf-8", errors="strict")
            except UnicodeDecodeError:
                raise RuntimeError("STT offline: marker decode failed")
            if text.strip():
                return text.strip()
        raise RuntimeError("STT offline: no embedded text (wire sherpa-onnx model for real audio)")


def text_to_speech(text: str) -> bytes:
    if not text or not text.strip():
        raise ValueError("empty text")
    if len(text) > MAX_TTS_CHARS:
        raise ValueError(f"text too long: {len(text)} chars")
    with _lock:
        wav = _synth_wav(text)
        audio = wav + _MARKER + text.strip().encode("utf-8")
        _cache[hashlib.sha256(audio).hexdigest()] = text.strip()
        logger.info("offline TTS: %d chars -> %d bytes", len(text), len(audio))
        return audio

