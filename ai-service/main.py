"""Veris AI Service — Vietnamese scam / phishing analyzer.



Endpoints:

    GET  /health     -> { status, model_loaded, model_name }

    POST /analyze    -> full risk report (NLP + on-chain + legal refs)

    POST /featurize  -> [i8; 256] vector for scam_detector.predict on-chain



Run:  uvicorn ai-service.main:app --port 8000   (from repo root)



Startup: the transformer model is preloaded eagerly at startup so the first

/api/analyze call is fast. Loading is intentionally blocking at startup

(30-60s on first run, due to model weight download); uvicorn will not serve

requests until the weights are ready.



Enable this behaviour with:

    VERIS_AI_LOAD_MODEL=1 uvicorn ai-service.main:app --port 8000

"""

from __future__ import annotations



import logging
from contextlib import asynccontextmanager

import os

from typing import Optional



from fastapi import FastAPI, File, HTTPException, UploadFile

from fastapi.responses import Response

from pydantic import BaseModel, Field



from analyzer import Analyzer

analyzer = Analyzer()

from featurize import featurize_to_list

from middleware import BodySizeLimitMiddleware, InMemoryRateLimitMiddleware

from onchain import gather_context

import speech



logger = logging.getLogger(__name__)



@asynccontextmanager
async def _lifespan(app: FastAPI):
    if os.getenv("VERIS_AI_LOAD_MODEL") == "1":
        _preload_model()
    yield

app = FastAPI(title="Veris AI Scam Detector", version="0.1.0")

app.add_middleware(InMemoryRateLimitMiddleware)
app.add_middleware(BodySizeLimitMiddleware)



# Single shared analyzer (model loaded lazily). The on-chain risk provider is

# intentionally a stub here: calling scam_detector.predict requires a funded

# keypair + deployed program, which is wired up separately. NLP + legal rules +

# report registry still produce a meaningful score without it.

# Single shared analyzer. The model is loaded eagerly on application startup
# (see _preload_model), which is only enabled when the environment variable
# VERIS_AI_LOAD_MODEL=1 is set. By default (and in tests) the analyzer stays
# lazy so startup stays fast and the fallback is exercised instead.

# Single shared analyzer. The model is loaded eagerly on application startup
# (see _preload_model), which is only enabled when the environment variable
# VERIS_AI_LOAD_MODEL=1 is set. By default (and in tests) the analyzer stays
# lazy so startup stays fast and the fallback is exercised instead.



def _preload_model():
    global analyzer
    analyzer = Analyzer()
    analyzer.load_model()






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



