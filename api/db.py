"""Storage for checked messages: MongoDB Atlas (free M0) when MONGODB_URI is set, else an in-memory store."""
import hashlib
import os
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from functools import cache
from uuid import uuid4

CACHE_DAYS = 30
# Only these appear on the public trending board: true or personal messages ("good morning") never do.
FAKE = ("FALSE", "MISLEADING", "OUTDATED", "PARTLY_TRUE")

# ponytail: in-memory fallback when MONGODB_URI is unset. Lost on every restart, single process only;
# set MONGODB_URI for persistence.
_mem: dict[str, dict] = {}


def using_mongo() -> bool:
    return bool(os.environ.get("MONGODB_URI"))


@cache
def _col():
    from pymongo import MongoClient
    col = MongoClient(os.environ["MONGODB_URI"], tz_aware=True, serverSelectionTimeoutMS=8000)["fwdcheck"]["checks"]
    col.create_index("fingerprint")
    col.create_index([("created_at", -1)])
    return col


def warm_up():
    """Open the MongoDB connection (and ensure indexes) at startup instead of on the first user request."""
    if using_mongo():
        _col().database.client.admin.command("ping")


def fingerprint(text: str) -> str:
    """Same forward -> same fingerprint, ignoring case, spacing, emoji and punctuation.
    Keeps letters, digits and Indic vowel signs (Unicode categories L, N, M)."""
    t = unicodedata.normalize("NFKC", text).lower()
    t = "".join(ch if unicodedata.category(ch)[0] in "LNM" else " " for ch in t)
    return hashlib.sha256(re.sub(r"\s+", " ", t).strip().encode()).hexdigest()


def _since(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


def find_similar(text: str) -> dict | None:
    """Same forward checked in the last 30 days -> reuse its result (and count the hit)."""
    fp = fingerprint(text)
    if not using_mongo():
        hits = [d for d in _mem.values() if d["fingerprint"] == fp and d["created_at"] > _since(CACHE_DAYS)]
        doc = max(hits, key=lambda d: d["created_at"], default=None)
        if doc:
            doc["hit_count"] += 1
    else:
        from pymongo import ReturnDocument
        doc = _col().find_one_and_update(
            {"fingerprint": fp, "created_at": {"$gt": _since(CACHE_DAYS)}},
            {"$inc": {"hit_count": 1}}, sort=[("created_at", -1)], return_document=ReturnDocument.AFTER)
    return doc["result"] | {"cached": True} if doc else None


def save(result: dict, channel: str) -> str:
    check_id = str(uuid4())
    doc = {"_id": check_id, "fingerprint": fingerprint(result["text"]), "raw_text": result["text"],
           "channel": channel, "language": result["language"], "input_type": result["input_type"],
           "overall": result["overall"], "result": result | {"id": check_id}, "hit_count": 1,
           "created_at": datetime.now(timezone.utc)}
    if using_mongo():
        _col().insert_one(doc)
    else:
        _mem[check_id] = doc
    return check_id


def get(check_id: str) -> dict | None:
    doc = _col().find_one({"_id": check_id}, {"result": 1}) if using_mongo() else _mem.get(check_id)
    return doc["result"] if doc else None


def trending(limit: int = 10) -> list[dict]:
    if using_mongo():
        docs = list(_col().find({"created_at": {"$gte": _since(7)}, "overall": {"$in": FAKE}},
                                {"raw_text": 1, "overall": 1, "hit_count": 1, "created_at": 1})
                    .sort("hit_count", -1).limit(limit))
    else:
        docs = sorted((d for d in _mem.values() if d["created_at"] >= _since(7) and d["overall"] in FAKE),
                      key=lambda d: d["hit_count"], reverse=True)[:limit]
    return [{"id": d["_id"], "raw_text": d["raw_text"], "overall": d["overall"], "hit_count": d["hit_count"],
             "created_at": d["created_at"].isoformat()} for d in docs]
