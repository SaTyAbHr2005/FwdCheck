import json
from llm import generate_json

LANG_NAME = {"hi": "simple Hindi (Devanagari script)", "mr": "simple Marathi (Devanagari script)",
             "hinglish": "simple Hinglish (Hindi in Roman script)", "en": "simple English", "other": "simple English"}

PROMPT = """You are a careful fact-checker. TODAY is {today}.
For EACH claim, decide using ONLY the EVIDENCE given (never your own memory):
 - VERIFIED: evidence clearly supports it and it is still true today
 - FALSE: evidence clearly contradicts it
 - OUTDATED: it was true at some time but is no longer true today (old deadline, ended scheme, old news). Compare time_ref and source dates with TODAY.
 - PARTLY_TRUE: part is supported, part is wrong or exaggerated
 - UNVERIFIABLE: evidence is missing or not enough, or it is a personal story/opinion
Rules:
 - Every quote in "evidence" MUST be copied word-for-word from that source's page_text (20-300 characters), with that source's url.
 - If you have no quote, the verdict must be UNVERIFIABLE.
 - "what_is_wrong": one short sentence on exactly which part is wrong ("" if VERIFIED or UNVERIFIABLE).
 - "explanation": 1-2 short sentences in {lang}, for a non-technical elderly reader.
 - "timeline": for OUTDATED claims, key dated events from the evidence, else [].
Also write "summary": 3-6 short lines in {lang} telling the user what is true, what is false, and whether to forward it.
Return JSON:
{{"claims":[{{"claim_id":"C1","claim":"...","verdict":"...","confidence":0.0,"what_is_wrong":"...","explanation":"...",
   "timeline":[{{"date":"YYYY-MM-DD","event":"..."}}],
   "evidence":[{{"quote":"...","url":"...","source":"...","tier":"...","date":"..."}}]}}],
 "summary":"..."}}
CLAIMS:
{claims}
EVIDENCE:
{evidence}
"""

VERDICTS = {"VERIFIED", "FALSE", "OUTDATED", "PARTLY_TRUE", "UNVERIFIABLE"}


def judge_claims(claims: list[dict], evidence: list[dict], language: str, today: str) -> dict:
    if not claims:
        return {"claims": [], "summary": ""}
    slim_claims = [{k: c.get(k) for k in ("id", "text", "kind", "time_ref")} for c in claims]
    slim_ev = [{k: e.get(k) for k in ("claim_id", "url", "source", "tier", "date")}
               | {"page_text": (e.get("page_text") or "")[:2500]} for e in evidence]
    out = generate_json(PROMPT.format(today=today, lang=LANG_NAME.get(language, "simple English"),
                                      claims=json.dumps(slim_claims, ensure_ascii=False),
                                      evidence=json.dumps(slim_ev, ensure_ascii=False)))
    text_of = {c["id"]: c["text"] for c in claims}
    verdicts = []
    for v in out.get("claims", []):
        v["verdict"] = v.get("verdict") if v.get("verdict") in VERDICTS else "UNVERIFIABLE"
        v["claim"] = v.get("claim") or text_of.get(v.get("claim_id"), "")
        for k, default in (("evidence", []), ("timeline", []), ("what_is_wrong", ""), ("explanation", ""), ("confidence", 0.0)):
            v[k] = v.get(k) or default
        verdicts.append(v)
    return {"claims": verdicts, "summary": out.get("summary", "")}


def overall_verdict(verdicts: list[dict]) -> str:
    vs = [v["verdict"] for v in verdicts]
    if not vs:
        return "NO_CLAIMS"
    known = [v for v in vs if v != "UNVERIFIABLE"]
    if not known:
        return "UNVERIFIABLE"
    if "FALSE" in known:
        return "MISLEADING" if ("VERIFIED" in known or "PARTLY_TRUE" in known) else "FALSE"
    if "OUTDATED" in known:
        return "OUTDATED"
    if "PARTLY_TRUE" in known:
        return "PARTLY_TRUE"
    return "TRUE"
