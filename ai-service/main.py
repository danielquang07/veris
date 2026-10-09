"""Veris AI Service — Vietnamese scam / phishing analyzer.

Endpoints:
    GET  /health     -> { status, model_loaded, model_name }
    POST /analyze    -> full risk report (NLP + on-chain + legal refs)
    POST /featurize  -> [i8; 256] vector for scam_detector.predict on-chain

Run:  uvicorn ai-service.main:app --reload --port 8000   (from repo root)
The transformer model is loaded lazily on the first /analyze call so /health
responds instantly even before the (large) weights are downloaded.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from analyzer import Analyzer
from featurize import featurize_to_list
from middleware import BodySizeLimitMiddleware, InMemoryRateLimitMiddleware
from onchain import gather_context
import speech

logger = logging.getLogger(__name__)

app = FastAPI(title="Veris AI Scam Detector", version="0.1.0")
app.add_middleware(BodySizeLimitMiddleware)
app.add_middleware(InMemoryRateLimitMiddleware)

# Single shared analyzer (model loaded lazily). The on-chain risk provider is
# intentionally a stub here: calling scam_detector.predict requires a funded
# keypair + deployed program, which is wired up separately. NLP + legal rules +
# report registry still produce a meaningful score without it.
analyzer = Analyzer()


class AnalyzeRequest(BaseModel):
    text: str = Field(..., description="Message text to analyze (Vietnamese).")
    subject_pubkey: Optional[str] = Field(
        None, description="Solana address of the counterparty / recipient."
    )
    include_onchain: bool = Field(
        True, description="Whether to query the report registry / wallet history."
    )


class FeaturizeRequest(BaseModel):
    text: str = Field(..., description="Message text to featurize.")


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "model_loaded": analyzer.model_loaded,
        "model_name": analyzer.model_name,
    }


@app.post("/analyze")
def analyze(req: AnalyzeRequest) -> dict:
    onchain_context = None
    if req.include_onchain and req.subject_pubkey:
        onchain_context = gather_context(req.subject_pubkey).to_dict()

    result = analyzer.analyze(
        text=req.text,
        subject_pubkey=req.subject_pubkey,
        onchain_context=onchain_context,
        onchain_risk_provider=None,  # wire scam_detector.predict here when available
    )
    return result.to_dict()


@app.post("/featurize")
def featurize(req: FeaturizeRequest) -> dict:
    return {"features": featurize_to_list(req.text), "dim": 256}


# === Phase 12/14: Speech endpoints (shim; real model wiring in Section B) ===
class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)


@app.post("/speech-to-text")
async def speech_to_text_endpoint(audio: UploadFile = File(...)):
    if audio.content_type not in (
        "audio/wav",
        "audio/x-wav",
        "audio/wave",
        "application/octet-stream",
    ):
        raise HTTPException(status_code=415, detail="unsupported audio format, use wav")
    data = await audio.read()
    try:
        text = speech.speech_to_text(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("STT failed")
        raise HTTPException(status_code=502, detail="STT failed")
    return {"text": text}


@app.post("/text-to-speech")
async def text_to_speech_endpoint(req: TTSRequest):
    try:
        audio = speech.text_to_speech(req.text)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("TTS failed")
        raise HTTPException(status_code=502, detail="TTS failed")
    return Response(
        content=audio,
        media_type="audio/wav",
        headers={"Content-Disposition": 'inline; filename="tts.wav"'},
    )
# === end Phase 12/14 ===


@app.get("/")
def root() -> dict:
    return {
        "service": "veris-ai-scam-detector",
        "endpoints": ["/health", "/analyze", "/featurize"],
    }
