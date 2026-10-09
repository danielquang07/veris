"""Character n-gram featurizer shared with the on-chain scam_detector.

This re-uses ``offchain/featurize.py`` (the exact same hashing + L2-normalise +
int8-quantise logic that produced the trained model) so the ``[i8; 256]`` vector
handed to ``scam_detector.predict`` on-chain matches training exactly.

If the offchain module is unavailable, an inline identical implementation is
used as a fallback.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

DIM = 256

# Prefer the canonical implementation from the training pipeline.
_OFFCHAIN = Path(__file__).resolve().parent.parent / "offchain"
if _OFFCHAIN.is_dir():
    sys.path.insert(0, str(_OFFCHAIN))

try:  # pragma: no cover - depends on repo layout
    from featurize import featurize as _featurize  # type: ignore

    def featurize(text: str) -> np.ndarray:
        return _featurize(text)

except Exception:  # pragma: no cover - fallback keeps service self-contained
    import hashlib

    def featurize(text: str) -> np.ndarray:
        vec = np.zeros(DIM, dtype=np.int32)
        t = text.lower().strip()
        for n in (2, 3):
            for i in range(len(t) - n + 1):
                gram = t[i : i + n].encode("utf-8")
                h = int.from_bytes(hashlib.md5(gram).digest()[:4], "little")
                vec[h % DIM] += 1
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec.astype(np.float32) / norm
        return np.clip(np.round(vec * 127.0), -127, 127).astype(np.int8)


def featurize_to_list(text: str) -> list[int]:
    """Return the featurized vector as a plain ``list[int]`` of length 256."""
    return featurize(text).tolist()
