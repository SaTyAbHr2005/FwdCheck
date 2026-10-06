import time
from collections import defaultdict, deque

# ponytail: in-memory, per-process sliding window. Fine for one Render instance;
# move to Redis/MongoDB if the backend ever runs on more than one instance.
_hits: dict[str, deque] = defaultdict(deque)


def allow(key: str, limit: int, window: float = 60.0) -> bool:
    """True if `key` has made fewer than `limit` calls in the last `window` seconds (and records this call)."""
    now = time.monotonic()
    q = _hits[key]
    while q and now - q[0] > window:
        q.popleft()
    if len(q) >= limit:
        return False
    q.append(now)
    return True


def client_ip(headers, fallback: str) -> str:
    """Real client IP behind Render's proxy (Cloudflare header first, then X-Forwarded-For)."""
    return headers.get("cf-connecting-ip") or (headers.get("x-forwarded-for") or fallback).split(",")[0].strip()
