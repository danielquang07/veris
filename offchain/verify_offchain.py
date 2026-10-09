"""Mirror onchain predict math. Chay: python offchain/verify_offchain.py"""
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from featurize import featurize

w = json.loads((HERE / "weights.json").read_text(encoding="utf-8"))
W1 = np.array(w["w1"], dtype=np.int32).reshape(256, 16)
b1 = np.array(w["b1"], dtype=np.int32)
W2 = np.array(w["w2"], dtype=np.int32)
b2 = int(w["b2"])
shift = int(w["shift"])
K = int(w["k_sigmoid"])


def predict_onchain_math(text):
    f = featurize(text).astype(np.int32)
    h = np.maximum(f @ W1 + b1, 0)
    hs = np.clip(h >> shift, -128, 127)
    logit = int(b2 + int((hs * W2).sum()))
    raw = (logit + K) * 100 // (2 * K)
    return max(0, min(100, raw)), logit


data = [json.loads(l) for l in (HERE / "data" / "synthetic_vi.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
pos = [d for d in data if d["label"] == 1][:10]
neg = [d for d in data if d["label"] == 0][:10]

print("=== label=1 (ky vong risk cao) ===")
for d in pos:
    r, lg = predict_onchain_math(d["text"])
    print(f"  risk={r:3d}  logit={lg:8d}  | {d['text'][:60]}")

print("=== label=0 (ky vong risk thap) ===")
for d in neg:
    r, lg = predict_onchain_math(d["text"])
    print(f"  risk={r:3d}  logit={lg:8d}  | {d['text'][:60]}")

pos_scores = [predict_onchain_math(d["text"])[0] for d in pos]
neg_scores = [predict_onchain_math(d["text"])[0] for d in neg]
print(f"\nmean risk  pos={np.mean(pos_scores):.1f}  neg={np.mean(neg_scores):.1f}")
