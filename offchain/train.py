"""
Huấn luyện MLP 256 -> 16 -> 1 trên synthetic data tiếng Việt.
Input : offchain/data/synthetic_vi.jsonl
Output: offchain/weights_float.npz

Chạy từ repo root:  python offchain/train.py
"""
import json
import sys
from pathlib import Path

import numpy as np
from sklearn.neural_network import MLPClassifier

# Cho phép import featurize.py cùng thư mục khi chạy từ bất kỳ cwd nào
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from featurize import featurize_batch  # noqa: E402

DATA_PATH = HERE / "data" / "synthetic_vi.jsonl"
OUT_PATH = HERE / "weights_float.npz"

# --- 1. Load data ---
if not DATA_PATH.exists():
    raise SystemExit(f"Không tìm thấy {DATA_PATH}. Chạy data_gen.py trước.")

lines = [l for l in DATA_PATH.read_text(encoding="utf-8").splitlines() if l.strip()]
data = [json.loads(l) for l in lines]
texts = [d["text"] for d in data]
y = np.array([int(d["label"]) for d in data], dtype=np.int64)

print(f"[data] {len(texts)} mẫu, pos={int((y == 1).sum())}, neg={int((y == 0).sum())}")

# --- 2. Featurize ---
X_i8 = featurize_batch(texts)          # (n, 256) int8
X_f = X_i8.astype(np.float32) / 127.0  # (n, 256) float32

# --- 3. Train MLP ---
clf = MLPClassifier(
    hidden_layer_sizes=(16,),
    activation="relu",
    solver="adam",
    max_iter=500,
    random_state=0,
    verbose=False,
)
clf.fit(X_f, y)

acc = clf.score(X_f, y)
print(f"[train] accuracy (train set): {acc:.4f}")
print(f"[train] n_iter = {clf.n_iter_}")

# --- 4. Extract weights ---
# sklearn lưu: coefs_ = [W1 (256,16), W2 (16,1)]
#              intercepts_ = [b1 (16,), b2 (1,)]
W1_f = clf.coefs_[0].astype(np.float32)          # (256, 16)
b1_f = clf.intercepts_[0].astype(np.float32)     # (16,)
W2_f = clf.coefs_[1].flatten().astype(np.float32)  # (16,)  -- flatten (16,1)->(16,)
b2_f = float(clf.intercepts_[1][0])

print(f"[weights] W1 {W1_f.shape}  b1 {b1_f.shape}  W2 {W2_f.shape}  b2 {b2_f:.4f}")
print(f"[weights] |W1|max={np.abs(W1_f).max():.4f}  |W2|max={np.abs(W2_f).max():.4f}")

# --- 5. Save ---
np.savez(OUT_PATH, W1=W1_f, b1=b1_f, W2=W2_f, b2=b2_f)
print(f"[save] {OUT_PATH}")
