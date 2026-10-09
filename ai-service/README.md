# Veris AI Service

Off-chain Vietnamese scam / phishing analyzer for the Veris ecosystem. It blends a
transformer NLP model, rule-based legal references, and on-chain context
(Solana report registry + wallet history) into a single `risk_score` (0–100).

> The transformer model runs **in this service process (RAM)**. It is never run
> on-chain. The tiny integer MLP that *is* run on-chain lives in the
> `scam_detector` Anchor program and is fed the `[i8; 256]` vector produced by
> the `/featurize` endpoint.

## Architecture

```
client ──▶ POST /analyze ──▶ Analyzer.analyze()
                               ├─ NLP model (XLM-R, vi) ──▶ nlp_risk
                               ├─ legal_refs.py (regex → Điều/Khoản)
                               └─ onchain.py (devnet RPC) ──▶ report/tx/wallet age
                             returns { risk_score, label, signals, legal_refs, on_chain_context }

client ──▶ POST /featurize ─▶ [i8; 256]  ──▶ scam_detector.predict (on-chain)
```

Final score:

```
final_risk = clamp(0, 100, 0.6 * nlp_risk + 0.4 * on_chain_risk + bonus)
```

- `bonus` = +15 if the address was reported > 3 times on `veris_registry`;
  +10 if the wallet is < 7 days old with ≥ 5 recent transactions.

## Setup

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
```

> `requirements.txt` pins `torch` (CPU) + `transformers`. These are large (~2 GB).
> If your Python is very new and wheels are missing, see the note in the repo
> README about the httpx-only JSON-RPC fallback.

## Run

From the repo root:

```bash
uvicorn ai-service.main:app --reload --port 8000
```

## Endpoints

### `GET /health`
```json
{ "status": "ok", "model_loaded": true, "model_name": "nxtcute/..." }
```
`model_loaded` is `false` until the first `/analyze` triggers the lazy load.

### `POST /analyze`
Request:
```json
{ "text": "Chúc mừng bạn trúng thưởng, cung cấp OTP để nhận", "subject_pubkey": "Fg6Pa..." }
```
Response:
```json
{
  "risk_score": 88,
  "label": "SCAM",
  "signals": ["Yêu cầu cung cấp OTP / mã xác nhận", "Hứa hẹn trúng thưởng / quà tặng"],
  "legal_refs": [{ "dieu": "174", "khoan": "1", "van_ban": "BLHS 2015", "noi_dung": "...", "link": "https://vbpl.vn/..." }],
  "on_chain_context": { "report_count": 0, "recent_tx_count": 0, "wallet_age_days": null }
}
```

### `POST /featurize`
Request: `{ "text": "..." }` → Response: `{ "features": [i8; 256], "dim": 256 }`
Feed `features` to the on-chain `scam_detector.predict` instruction.

## Configuration (env vars)

| Var | Default | Meaning |
|-----|---------|---------|
| `SCAM_MODEL` | `nxtcute/xlm-r-phishing-...-vi` | Primary HF model |
| `SCAM_MODEL_FALLBACK` | `uitnlp/visobert` | Fallback if primary fails |
| `SOLANA_RPC_URL` | `https://api.devnet.solana.com` | RPC for on-chain context |
| `VERIS_REGISTRY_PROGRAM_ID` | placeholder | `veris_registry` program id |
| `NLP_WEIGHT` / `ONCHAIN_WEIGHT` | `0.6` / `0.4` | Blend weights |

## Tests

```bash
.venv\Scripts\python.exe -X utf8 -m pytest ai-service/tests -v
```
Tests mock the RPC and the transformer model, so no network access is required.
