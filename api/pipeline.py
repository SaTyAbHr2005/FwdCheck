import asyncio
import datetime
import uuid

import db
from ingest import to_text
from extract import extract_claims
from sources import gather_evidence
from judge import judge_claims, overall_verdict
from guardrail import enforce_grounding

NO_CLAIMS_MSG = {"hi": "इस संदेश में जाँचने लायक कोई तथ्य नहीं मिला।",
                 "mr": "या संदेशात तपासण्यासारखे तथ्य आढळले नाही.",
                 "hinglish": "Is message mein check karne layak koi fact nahi mila.",
                 "en": "No checkable facts found in this message."}


async def run_check(text=None, url=None, file=None, mime=None, channel="web", use_db=True) -> dict:
    """ingest -> cache -> extract (LLM #1) -> evidence -> judge (LLM #2) -> guardrail -> save."""
    ing = await asyncio.to_thread(to_text, text, url, file, mime)
    if not ing["text"].strip():
        raise ValueError("Could not read any text from the input")
    if use_db and (hit := await asyncio.to_thread(db.find_similar, ing["text"])):
        return hit
    ex = await asyncio.to_thread(extract_claims, ing["text"])
    lang = ing.get("language") or ex["language"]
    facts = [c for c in ex["claims"] if c.get("kind") == "fact"]
    evidence = await gather_evidence(facts)
    today = datetime.date.today().isoformat()
    j = await asyncio.to_thread(judge_claims, ex["claims"], evidence, lang, today)
    verdicts = enforce_grounding(j["claims"], evidence)
    result = {"language": lang, "input_type": ing["input_type"], "text": ing["text"],
              "overall": overall_verdict(verdicts),
              "summary": j["summary"] or NO_CLAIMS_MSG.get(lang, NO_CLAIMS_MSG["en"]),
              "claims": verdicts, "red_flags": ex["red_flags"], "cached": False}
    result["id"] = await asyncio.to_thread(db.save, result, channel) if use_db else str(uuid.uuid4())
    return result
