import os
from datetime import datetime, timedelta, timezone
from functools import cache


@cache
def _sb():
    from supabase import create_client
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


def find_similar(text: str) -> dict | None:
    """Same/near-identical forward checked in the last 30 days -> reuse its result."""
    rows = _sb().rpc("find_similar_check", {"q": text}).execute().data
    if not rows:
        return None
    _sb().rpc("bump_hit", {"check_id": rows[0]["id"]}).execute()
    return rows[0]["result"] | {"cached": True}


def save(result: dict, channel: str) -> str:
    row = _sb().table("checks").insert({
        "raw_text": result["text"], "channel": channel, "language": result["language"],
        "input_type": result["input_type"], "overall": result["overall"], "result": result,
    }).execute().data[0]
    _sb().table("checks").update({"result": result | {"id": row["id"]}}).eq("id", row["id"]).execute()
    return row["id"]


def get(check_id: str) -> dict | None:
    rows = _sb().table("checks").select("result").eq("id", check_id).limit(1).execute().data
    return rows[0]["result"] if rows else None


def trending(limit: int = 10) -> list[dict]:
    since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    return (_sb().table("checks").select("id,raw_text,overall,hit_count,created_at")
            .neq("channel", "eval").gte("created_at", since)
            .order("hit_count", desc=True).limit(limit).execute().data)
