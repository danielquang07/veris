"""Security essentials for the Veris AI service.

- BodySizeLimitMiddleware: reject requests larger than 16 KiB with 413.
- InMemoryRateLimitMiddleware: per-IP sliding-window limits, no extra deps.
  IP keys are SHA-256 hashed (first 8 bytes hex) so raw IPs never hit logs.
"""
from __future__ import annotations

import hashlib
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

BODY_LIMITS: Dict[str, int] = {
    "/speech-to-text": 5 * 1024 * 1024,  # 5MB cho audio
}
DEFAULT_BODY_LIMIT = 16 * 1024  # 16KB cho các endpoint còn lại

# path prefix -> (limit, window_seconds)
RATE_LIMITS: Dict[str, tuple[int, int]] = {
    "/analyze": (10, 60),
    "/speech-to-text": (30, 60),
    "/text-to-speech": (30, 60),
    "/health": (120, 60),
}


def _client_key(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    raw = (fwd.split(",")[0].strip() if fwd else "") or (
        request.client.host if request.client else "unknown"
    )
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]
    return digest


def _is_multipart(request: Request) -> bool:
    return "multipart/form-data" in (request.headers.get("content-type") or "").lower()


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        path = request.url.path
        if _is_multipart(request):
            # Multipart (audio upload) khong ap dung limit JSON 16KB.
            return await call_next(request)
        limit = DEFAULT_BODY_LIMIT
        for prefix, l in BODY_LIMITS.items():
            if path == prefix or path.startswith(prefix + "/"):
                limit = l
                break
        length = request.headers.get("content-length")
        if length is not None:
            try:
                if int(length) > limit:
                    return JSONResponse({"error": "payload too large"}, status_code=413)
            except ValueError:
                return JSONResponse({"error": "invalid content-length"}, status_code=400)
        return await call_next(request)


class InMemoryRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, limits: Dict[str, tuple[int, int]] | None = None):  # type: ignore[no-untyped-def]
        super().__init__(app)
        self.limits = limits or RATE_LIMITS
        self.hits: Dict[tuple[str, str], Deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        path = request.url.path
        rule = None
        for prefix, (limit, window) in self.limits.items():
            if path == prefix or path.startswith(prefix + "/"):
                rule = (limit, window)
                break
        if rule is None:
            return await call_next(request)
        limit, window = rule
        key = (_client_key(request), path)
        now = time.monotonic()
        bucket = self.hits[key]
        while bucket and now - bucket[0] > window:
            bucket.popleft()
        if len(bucket) >= limit:
            return JSONResponse({"error": "rate limit exceeded"}, status_code=429)
        bucket.append(now)
        return await call_next(request)
