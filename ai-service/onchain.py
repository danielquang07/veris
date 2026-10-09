"""On-chain context lookups for the Veris scam analyzer.

Queries a Solana JSON-RPC endpoint (devnet by default) with plain ``httpx`` so
the service has no hard dependency on ``solana``/``solders`` (whose wheels may
lag new Python releases). All functions degrade gracefully: on any RPC error
they return neutral values instead of raising.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

import httpx

RPC_URL = os.getenv("SOLANA_RPC_URL", "https://api.devnet.solana.com")
REQUEST_TIMEOUT = float(os.getenv("SOLANA_RPC_TIMEOUT", "10"))

# veris_registry program id (placeholder; matches the on-chain declare_id!)
REGISTRY_PROGRAM_ID = os.getenv(
    "VERIS_REGISTRY_PROGRAM_ID", "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"
)


@dataclass
class OnchainContext:
    report_count: int
    recent_tx_count: int
    wallet_age_days: Optional[int]

    def to_dict(self) -> dict:
        return {
            "report_count": self.report_count,
            "recent_tx_count": self.recent_tx_count,
            "wallet_age_days": self.wallet_age_days,
        }


def _rpc(method: str, params: list) -> dict:
    """Low-level JSON-RPC call. Raises on transport/HTTP error."""
    payload = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    resp = httpx.post(RPC_URL, json=payload, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        raise RuntimeError(data["error"])
    return data["result"]


def count_reports_for_address(address: str) -> int:
    """Count veris_registry ScamReport accounts where ``reported`` == address.

    Uses ``getProgramAccounts`` filtered by memcmp on the ``reported`` field
    offset (after the 8-byte discriminator + 32-byte reporter). Returns 0 on
    any failure.
    """
    try:
        # ScamReport layout: disc(8) reporter(32) reported(32) ...
        reported_offset = 8 + 32
        filters = [
            {"memcmp": {"offset": reported_offset, "bytes": address}},
        ]
        result = _rpc(
            "getProgramAccounts",
            [REGISTRY_PROGRAM_ID, {"encoding": "base64", "filters": filters}],
        )
        return len(result)
    except Exception:
        return 0


def get_wallet_context(address: str, recent_limit: int = 20) -> tuple[int, Optional[int]]:
    """Return (recent_tx_count, wallet_age_days) for ``address``.

    recent_tx_count = number of confirmed signatures (capped at recent_limit).
    wallet_age_days derived from the oldest returned signature's blockTime;
    None if it cannot be determined.
    """
    try:
        sigs = _rpc(
            "getSignaturesForAddress",
            [address, {"limit": recent_limit}],
        )
        recent_tx_count = len(sigs)
        wallet_age_days: Optional[int] = None
        if sigs:
            oldest = sigs[-1]
            block_time = oldest.get("blockTime")
            if block_time:
                import time

                age_seconds = max(0, int(time.time()) - int(block_time))
                wallet_age_days = age_seconds // 86_400
        return recent_tx_count, wallet_age_days
    except Exception:
        return 0, None


def gather_context(subject_pubkey: Optional[str]) -> OnchainContext:
    """Gather all on-chain context for a subject address (or neutral if None)."""
    if not subject_pubkey:
        return OnchainContext(report_count=0, recent_tx_count=0, wallet_age_days=None)
    report_count = count_reports_for_address(subject_pubkey)
    recent_tx_count, wallet_age_days = get_wallet_context(subject_pubkey)
    return OnchainContext(
        report_count=report_count,
        recent_tx_count=recent_tx_count,
        wallet_age_days=wallet_age_days,
    )
