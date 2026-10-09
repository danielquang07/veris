import hashlib

import numpy as np

DIM = 256


def featurize(text: str) -> np.ndarray:
    vec = np.zeros(DIM, dtype=np.int32)
    t = text.lower().strip()
    for n in (2, 3):
        for i in range(len(t) - n + 1):
            gram = t[i:i + n].encode("utf-8")
            h = int.from_bytes(hashlib.md5(gram).digest()[:4], "little")
            vec[h % DIM] += 1
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec.astype(np.float32) / norm
    out = np.clip(np.round(vec * 127.0), -127, 127).astype(np.int8)
    return out


def featurize_batch(texts):
    return np.stack([featurize(t) for t in texts], axis=0)
