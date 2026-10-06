"""Storage for checked messages: MongoDB Atlas (free M0 cluster)."""
import hashlib
import os
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from functools import cache
from uuid import uuid4

CACHE_DAYS = 30


@cache
def _col():
    from pymongo import MongoClient
    col = MongoClient(os.environ["MONGODB_URI"], tz_aware=True, serverSelectionTimeoutMS=8000)["fwdcheck"]["checks"]
    col.create_index("fingerprint")
    col.create_index([("created_at", -1)])
    return col


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
    from pymongo import ReturnDocument
    doc = _col().find_one_and_update(
        {"fingerprint": fingerprint(text), "created_at": {"$gt": _since(CACHE_DAYS)}},
        {"$inc": {"hit_count": 1}}, sort=[("created_at", -1)], return_document=ReturnDocument.AFTER)
    return doc["result"] | {"cached": True} if doc else None


def save(result: dict, channel: str) -> str:
    check_id = str(uuid4())
    _col().insert_one({
        "_id": check_id, "fingerprint": fingerprint(result["text"]), "raw_text": result["text"],
        "channel": channel, "language": result["language"], "input_type": result["input_type"],
        "overall": result["overall"], "result": result | {"id": check_id}, "hit_count": 1,
        "created_at": datetime.now(timezone.utc),
    })
    return check_id


def get(check_id: str) -> dict | None:
    doc = _col().find_one({"_id": check_id}, {"result": 1})
    return doc["result"] if doc else None


def trending(limit: int = 10) -> list[dict]:
    docs = (_col().find({"created_at": {"$gte": _since(7)}}, {"raw_text": 1, "overall": 1, "hit_count": 1, "created_at": 1})
            .sort("hit_count", -1).limit(limit))
    return [{"id": d["_id"], "raw_text": d["raw_text"], "overall": d["overall"], "hit_count": d["hit_count"],
             "created_at": d["created_at"].isoformat()} for d in docs]
