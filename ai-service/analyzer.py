"""Vietnamese scam analyzer: NLP model + rule-based legal refs + on-chain context.

The transformer model is XLM-R fine-tuned for Vietnamese phishing / social
engineering detection. It runs in the service process (RAM), never on-chain.

Final risk is a weighted blend of the NLP probability and the on-chain
``scam_detector.predict`` score, plus contextual bonuses from the report
registry and wallet heuristics:

    final_risk = clamp(0, 100, 0.6 * nlp_risk + 0.4 * on_chain_risk + bonus)
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Optional

from legal_refs import match_legal_refs

# ---------------------------------------------------------------------------
# Configuration (env-overridable)
# ---------------------------------------------------------------------------
PRIMARY_MODEL = os.getenv(
    "SCAM_MODEL", "nxtcute/xlm-r-phishing-and-social-engineering-detector-vi"
)
FALLBACK_MODEL = os.getenv("SCAM_MODEL_FALLBACK", "uitnlp/visobert")
MAX_LEN = int(os.getenv("SCAM_MAX_LEN", "256"))

# Blend weights (must sum to 1.0)
NLP_WEIGHT = float(os.getenv("NLP_WEIGHT", "0.6"))
ONCHAIN_WEIGHT = float(os.getenv("ONCHAIN_WEIGHT", "0.4"))

# Contextual bonus thresholds
REPORT_BONUS_THRESHOLD = 3          # report_count > this -> +bonus
REPORT_BONUS = int(os.getenv("REPORT_BONUS", "15"))
NEW_WALLET_DAYS = 7                 # wallet younger than this + fan-in -> +bonus
NEW_WALLET_BONUS = int(os.getenv("NEW_WALLET_BONUS", "10"))


@dataclass
class AnalysisResult:
    risk_score: int
    label: str
    signals: list[str] = field(default_factory=list)
    legal_refs: list[dict] = field(default_factory=list)
    on_chain_context: dict = field(default_factory=dict)
    nlp_risk: int = 0
    on_chain_risk: int = 0

    def to_dict(self) -> dict:
        return {
            "risk_score": self.risk_score,
            "label": self.label,
            "signals": self.signals,
            "legal_refs": self.legal_refs,
            "on_chain_context": self.on_chain_context,
        }



class Analyzer:
    """Lazily loads the transformer model and exposes ``analyze``."""

    def __init__(self) -> None:
        self._tokenizer = None
        self._model = None
        self._torch = None
        self._model_name: Optional[str] = None
        self._scam_index = 1
        self._device = "cpu"

    @property
    def model_loaded(self) -> bool:
        return self._model is not None

    @property
    def model_name(self) -> Optional[str]:
        return self._model_name

    def load_model(self) -> None:
        """Load the model. Tries PRIMARY then FALLBACK. Raises on total failure."""
        if self._model is not None:
            return
        import torch  # local import keeps startup fast when model unused
        from transformers import (
            AutoModelForSequenceClassification,
            AutoTokenizer,
        )

        self._torch = torch
        torch.set_grad_enabled(False)

        last_err: Optional[Exception] = None
        for name in (PRIMARY_MODEL, FALLBACK_MODEL):
            try:
                self._tokenizer = AutoTokenizer.from_pretrained(name)
                model = AutoModelForSequenceClassification.from_pretrained(name)
                model.eval()
                model.to(self._device)
                self._model = model
                self._model_name = name
                self._scam_index = self._resolve_scam_index(model)
                return
            except Exception as exc:  # network/disk dependent
                last_err = exc
                continue
        raise RuntimeError(
            f"Could not load scam model (tried {PRIMARY_MODEL}, {FALLBACK_MODEL}): {last_err}"
        )

    @staticmethod
    def _resolve_scam_index(model) -> int:
        """Return the logit index that corresponds to the positive (scam) class."""
        cfg = getattr(model, "config", None)
        id2label = getattr(cfg, "id2label", None) or {}
        scam_words = ("scam", "phishing", "fraud", "spam", "toxic", "negative", "label_1")
        for idx, label in id2label.items():
            text = str(label).lower()
            if any(w in text for w in scam_words):
                return int(idx)
        return 1  # binary classifier -> index 1 is the positive class

    def nlp_probability(self, text: str) -> float:
        """Return P(scam) in [0, 1] using the transformer model."""
        if self._model is None:
            self.load_model()
        encoded = self._tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=MAX_LEN,
            padding=True,
        )
        encoded = {
            k: (v.to(self._device) if hasattr(v, "to") else v)
            for k, v in encoded.items()
        }
        logits = self._model(**encoded).logits[0]
        probs = self._torch.softmax(logits, dim=-1)
        return float(probs[self._scam_index].item())

    @staticmethod
    def _extract_signals(text: str, legal_refs: list[dict]) -> list[str]:
        signals: list[str] = []
        lowered = text.lower()
        checks = {
            "Yêu cầu cung cấp OTP / mã xác nhận": ["otp", "mã xác nhận", "ma xac nhan", "xác thực"],
            "Đe dọa khóa tài khoản / thẻ": ["bị khóa", "bi khoa", "khóa thẻ", "vô hiệu"],
            "Hứa hẹn trúng thưởng / quà tặng": ["trúng thưởng", "trung thuong", "nhận quà", "nhan qua"],
            "Tạo áp lực thời gian": ["trong 5 phút", "ngay lập tức", "gấp", "ngay bây giờ"],
            "Yêu cầu chuyển tiền / phí": ["chuyển tiền", "chuyen tien", "phí ", "nap tien", "nạp tien"],
            "Giả danh cơ quan chức năng": ["công an", "cong an", "ngân hàng", "ngan hang", "viện kiểm sát"],
            "Link rút gọn / domain lạ": ["http://", "https://", ".xyz", ".top", ".info", ".click"],
        }
        for label, keys in checks.items():
            if any(k in lowered for k in keys):
                signals.append(label)
        if not signals and legal_refs:
            signals.append("Khớp mẫu lừa đảo theo luật định")
        return signals

    def analyze(
        self,
        text: str,
        subject_pubkey: Optional[str] = None,
        onchain_context: Optional[dict] = None,
        onchain_risk_provider=None,
    ) -> AnalysisResult:
        """Full analysis pipeline.

        ``onchain_context`` is an optional dict already gathered by the caller
        (report_count, recent_tx_count, wallet_age_days). ``onchain_risk_provider``
        is a callable ``(text) -> int`` that invokes ``scam_detector.predict``
        on-chain (injected to keep this module free of RPC I/O and testable).
        """
        nlp_prob = self.nlp_probability(text) if text else 0.0
        nlp_risk = int(round(nlp_prob * 100))

        legal_refs = match_legal_refs(text)
        signals = self._extract_signals(text, legal_refs)

        ctx = onchain_context or {}
        report_count = int(ctx.get("report_count", 0) or 0)
        recent_tx_count = int(ctx.get("recent_tx_count", 0) or 0)
        wallet_age_days = ctx.get("wallet_age_days")

        on_chain_risk = 0
        if onchain_risk_provider is not None and text:
            try:
                on_chain_risk = int(onchain_risk_provider(text))
            except Exception:
                on_chain_risk = 0

        bonus = 0
        if report_count > REPORT_BONUS_THRESHOLD:
            bonus += REPORT_BONUS
            signals.append(f"Địa chỉ bị báo cáo {report_count} lần trên veris_registry")
        if (
            subject_pubkey
            and wallet_age_days is not None
            and wallet_age_days < NEW_WALLET_DAYS
            and recent_tx_count >= 5
        ):
            bonus += NEW_WALLET_BONUS
            signals.append(
                f"Ví mới ({wallet_age_days} ngày) với {recent_tx_count} giao dịch gần đây"
            )

        if on_chain_risk is not None and on_chain_risk > 0:
            final_risk = int(round(NLP_WEIGHT * nlp_risk + ONCHAIN_WEIGHT * on_chain_risk + bonus))
        else:
            # Không có on-chain → dồn toàn bộ trọng số cho NLP
            final_risk = int(round(nlp_risk + bonus))
        final_risk = max(0, min(100, final_risk))

        label = "SCAM" if final_risk >= 70 else ("SUSPICIOUS" if final_risk >= 40 else "SAFE")

        return AnalysisResult(
            risk_score=final_risk,
            label=label,
            signals=signals,
            legal_refs=legal_refs,
            on_chain_context={
                "report_count": report_count,
                "recent_tx_count": recent_tx_count,
                "wallet_age_days": wallet_age_days,
            },
            nlp_risk=nlp_risk,
            on_chain_risk=on_chain_risk,
        )

