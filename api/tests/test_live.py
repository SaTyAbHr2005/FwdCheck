"""Live tests: call the real free APIs. Skipped automatically until keys are in api/.env.
Run: pytest tests/test_live.py -v"""
import os
import asyncio
from pathlib import Path

import pytest
from dotenv import load_dotenv

load_dotenv()
pytestmark = pytest.mark.skipif(not os.environ.get("GEMINI_API_KEY"), reason="needs keys in api/.env")
F = Path(__file__).parent / "fixtures"


def test_llm_json():
    from llm import generate_json
    assert generate_json('Compute 2+2 and return it as JSON: {"answer": <number>}')["answer"] == 4


def test_ingest_image():
    from ingest import to_text
    out = to_text(file=(F / "forward.png").read_bytes(), mime="image/png")   # Marathi free-recharge scam screenshot
    assert "239" in out["text"] and out["language"] == "mr" and out["input_type"] == "image"


def test_ingest_audio():
    from ingest import to_text
    out = to_text(file=(F / "note.mp3").read_bytes(), mime="audio/mpeg")
    assert out["text"] and out["language"] in ("hi", "hinglish")


def test_ingest_pdf():
    from ingest import to_text
    out = to_text(file=(F / "circular.pdf").read_bytes(), mime="application/pdf")   # text PDF: fake tax-refund letter
    assert "15,490" in out["text"] and out["input_type"] == "pdf"


def test_ingest_scanned_pdf():
    from ingest import to_text
    out = to_text(file=(F / "scanned.pdf").read_bytes(), mime="application/pdf")   # image-only PDF: read by Gemini
    assert "NASA" in out["text"] and out["input_type"] == "pdf"


def test_ingest_url():
    from ingest import to_text
    out = to_text(url="https://en.wikipedia.org/wiki/Reserve_Bank_of_India")
    assert "Reserve Bank" in out["text"]


def test_extract_forward():
    from extract import extract_claims
    out = extract_claims((F / "forward.txt").read_text(encoding="utf-8"))
    assert len(out["claims"]) >= 4
    assert any(c["kind"] == "personal" for c in out["claims"])
    assert {"chain_forward", "suspicious_link"} <= {f["type"] for f in out["red_flags"]}


def test_extract_nothing_checkable():
    from extract import extract_claims
    assert extract_claims("Good morning 🌸 have a blessed day")["claims"] == []


def test_evidence_rbi():
    from sources import gather_evidence
    claims = [{"id": "C1", "kind": "fact", "text": "RBI withdrew 2000 rupee notes",
               "search_query": "RBI withdraws 2000 rupee notes circulation"}]
    ev = asyncio.run(gather_evidence(claims))
    assert ev and all(e["claim_id"] == "C1" for e in ev)
    assert any(e["tier"] in ("official", "factchecker", "news") for e in ev)


def test_judge_outdated_2000_notes():
    from sources import gather_evidence
    from judge import judge_claims
    claims = [{"id": "C1", "kind": "fact", "text": "Exchange 2000 rupee notes at any bank by 30 September",
               "time_ref": "30 September", "search_query": "2000 rupee note exchange deadline banks RBI"}]
    ev = asyncio.run(gather_evidence(claims))
    out = judge_claims(claims, ev, "en", "2026-10-06")
    assert out["claims"][0]["verdict"] in ("OUTDATED", "FALSE")
    assert out["claims"][0]["evidence"]


def test_full_pipeline_without_db():
    import pipeline
    r = asyncio.run(pipeline.run_check(text=(F / "forward.txt").read_text(encoding="utf-8"), use_db=False))
    assert r["overall"] in ("MISLEADING", "FALSE", "OUTDATED")
    assert len(r["claims"]) >= 4 and r["summary"]


def test_voice_hindi():
    import voice
    audio = asyncio.run(voice.tts("यह संदेश गलत है।", "hi"))
    assert len(audio) > 1000
