"""Pipeline orchestration with every external call faked (no keys, no network)."""
import asyncio

import pytest

import pipeline

PAGE = "The Reserve Bank of India said the ₹2000 banknotes will continue to be legal tender."


@pytest.fixture
def fakes(monkeypatch):
    calls = {"extract": 0, "saved": None}
    monkeypatch.setattr(pipeline, "to_text", lambda t, u, f, m: {"text": t or "", "language": None, "input_type": "text"})
    monkeypatch.setattr(pipeline.db, "find_similar", lambda text: None)

    def save(result, channel):
        calls["saved"] = (result, channel)
        return "new-id"
    monkeypatch.setattr(pipeline.db, "save", save)

    def extract(text):
        calls["extract"] += 1
        return {"language": "hinglish", "red_flags": [{"type": "fear", "text": "warna"}],
                "claims": [{"id": "C1", "text": "Money will be lost", "kind": "fact"},
                           {"id": "C2", "text": "Mama ji was cured", "kind": "personal"}]}
    monkeypatch.setattr(pipeline, "extract_claims", extract)

    async def evidence(claims):
        assert [c["id"] for c in claims] == ["C1"]          # only facts are searched
        return [{"claim_id": "C1", "url": "https://rbi.org.in/x", "source": "RBI", "tier": "official",
                 "date": "2023-05-19", "page_text": PAGE}]
    monkeypatch.setattr(pipeline, "gather_evidence", evidence)

    def judge(claims, ev, lang, today):
        assert lang == "hinglish"
        return {"summary": "Galat hai.", "claims": [
            {"claim_id": "C1", "claim": "Money will be lost", "verdict": "FALSE", "confidence": 0.9,
             "evidence": [{"quote": "will continue to be legal tender", "url": "https://rbi.org.in/x"}]},
            {"claim_id": "C2", "claim": "Mama ji was cured", "verdict": "FALSE", "confidence": 0.5,
             "evidence": [{"quote": "an invented quote that is nowhere", "url": "https://rbi.org.in/x"}]}]}
    monkeypatch.setattr(pipeline, "judge_claims", judge)
    return calls


def test_full_flow_grounds_and_saves(fakes):
    r = asyncio.run(pipeline.run_check(text="RBI ne note band kiye, warna paise doob jayenge", channel="telegram"))
    assert r["id"] == "new-id" and r["language"] == "hinglish"
    by_id = {c["claim_id"]: c for c in r["claims"]}
    assert by_id["C1"]["verdict"] == "FALSE" and by_id["C1"]["evidence"][0]["tier"] == "official"
    assert by_id["C2"]["verdict"] == "UNVERIFIABLE"          # invented quote removed by guardrail
    assert r["overall"] == "FALSE" and r["latency_ms"] >= 0
    assert fakes["saved"][1] == "telegram"


def test_cache_hit_skips_ai(fakes, monkeypatch):
    monkeypatch.setattr(pipeline.db, "find_similar", lambda text: {"id": "old", "overall": "FALSE", "cached": True})
    r = asyncio.run(pipeline.run_check(text="same forward again"))
    assert r["id"] == "old" and r["cached"] is True and fakes["extract"] == 0


def test_empty_input_rejected(fakes):
    with pytest.raises(ValueError):
        asyncio.run(pipeline.run_check(text="   "))


def test_no_claims_gives_friendly_summary(fakes, monkeypatch):
    monkeypatch.setattr(pipeline, "extract_claims", lambda t: {"language": "en", "claims": [], "red_flags": []})
    monkeypatch.setattr(pipeline, "judge_claims", lambda *a: {"claims": [], "summary": ""})
    r = asyncio.run(pipeline.run_check(text="Good morning"))
    assert r["overall"] == "NO_CLAIMS" and r["summary"] == pipeline.NO_CLAIMS_MSG["en"]
