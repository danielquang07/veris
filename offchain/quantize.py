"""Quantize float weights -> int8/i32 khop onchain math. Dung cong thuc K = 10 * s_actual."""
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from featurize import featurize_batch

FLOAT_PATH = HERE / "weights_float.npz"
DATA_PATH = HERE / "data" / "synthetic_vi.jsonl"
OUT_PATH = HERE / "weights.json"

d = np.load(FLOAT_PATH)
W1_f, b1_f, W2_f, b2_f = d["W1"], d["b1"], d["W2"], float(d["b2"])

data = [json.loads(l) for l in DATA_PATH.read_text(encoding="utf-8").splitlines() if l.strip()]
X_i8 = featurize_batch([x["text"] for x in data])

# --- Layer 1 ---
scale_w1 = float(max(np.abs(W1_f).max(), 1e-8)) / 127.0
W1_i8 = np.clip(np.round(W1_f / scale_w1), -127, 127).astype(np.int8)
s1 = 127.0 / scale_w1
b1_i32 = np.round(b1_f * s1).astype(np.int32)

H_i32 = np.maximum(X_i8.astype(np.int32) @ W1_i8.astype(np.int32) + b1_i32, 0)
h_max = int(max(H_i32.max(), 1))

shift = int(np.round(np.log2(max(h_max / 100.0, 1.0))))
shift = max(0, min(shift, 15))
u = 1 << shift

# --- Layer 2 ---
scale_w2 = float(max(np.abs(W2_f).max(), 1e-8)) / 127.0
W2_i8 = np.clip(np.round(W2_f / scale_w2), -127, 127).astype(np.int8)

s_actual = s1 / (u * scale_w2)
b2_i32 = int(round(b2_f * s_actual))

# K dung: muon z2 = +-10 -> risk = 0/100
K = int(round(10.0 * s_actual))

out = dict(
    w1=W1_i8.flatten().tolist(),
    b1=b1_i32.tolist(),
    w2=W2_i8.tolist(),
    b2=b2_i32,
    scale_w1=int(round(1.0 / scale_w1)),
    scale_w2=int(round(1.0 / scale_w2)),
    scale_b1=int(round(s1)),
    scale_b2=1,
    shift=shift,
    k_sigmoid=K,
)
OUT_PATH.write_text(json.dumps(out), encoding="utf-8")

print(f"h_max={h_max}  shift={shift}  u={u}")
print(f"scale_w1={scale_w1:.6f}  scale_w2={scale_w2:.6f}")
print(f"s1={s1:.2f}  s_actual={s_actual:.2f}")
print(f"K={K}  b2_i32={b2_i32}")
print(f"|W1_i8|max={np.abs(W1_i8).max()}  |W2_i8|max={np.abs(W2_i8).max()}")
