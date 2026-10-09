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

import os
from typing import Optional

from fastapi import FastAPI
from pydantic import BaseModel, Field

from analyzer import Analyzer
from featurize import featurize_to_list
from onchain import gather_context

app = FastAPI(title="Veris AI Scam Detector", version="0.1.0")

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


@app.get("/")
def root() -> dict:
    return {
        "service": "veris-ai-scam-detector",
        "endpoints": ["/health", "/analyze", "/featurize"],
    }
