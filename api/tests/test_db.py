import pytest

import db
from db import fingerprint

FWD = "🚨 ZAROORI SUCHNA 🚨\nRBI ne ₹2000 ke note band kar diye hain!"


def test_same_forward_with_different_spacing_emoji_case_matches():
    assert fingerprint(FWD) == fingerprint("zaroori   suchna RBI ne ₹2000 ke NOTE band kar diye hain")


def test_different_message_does_not_match():
    assert fingerprint(FWD) != fingerprint("RBI ne ₹500 ke note band kar diye hain")


def test_hindi_vowel_signs_are_kept():
    # नमस्ते vs नमस्ता differ only by a vowel sign; they must not collide
    assert fingerprint("नमस्ते दोस्तों") != fingerprint("नमस्ता दोस्तों")
    assert fingerprint("नमस्ते  दोस्तों!!") == fingerprint("नमस्ते दोस्तों")


@pytest.fixture
def memory_store(monkeypatch):
    monkeypatch.delenv("MONGODB_URI", raising=False)
    db._mem.clear()
    yield
    db._mem.clear()


def result(text, overall="FALSE"):
    return {"text": text, "language": "en", "input_type": "text", "overall": overall, "claims": []}


def test_memory_store_save_get_and_cache(memory_store):
    cid = db.save(result(FWD), "web")
    assert db.get(cid)["id"] == cid
    hit = db.find_similar("zaroori suchna rbi ne ₹2000 ke note band kar diye hain")
    assert hit["id"] == cid and hit["cached"] is True
    assert db.find_similar("something else entirely") is None
    assert db.get("missing") is None


def test_memory_store_trending_orders_by_hits(memory_store):
    a = db.save(result("fake one"), "web")
    b = db.save(result("fake two"), "telegram")
    db.find_similar("fake two")
    db.find_similar("fake two")
    rows = db.trending()
    assert [r["id"] for r in rows] == [b, a] and rows[0]["hit_count"] == 3
