from llm import generate_json
from radar import radar

PROMPT = """You are a fact-check assistant for Indian WhatsApp forwards.
Split the MESSAGE into small, separate, checkable claims (atomic: one fact each).
For each claim give:
 - "id": "C1","C2",...
 - "text": the claim in English, short
 - "kind": "fact" (can be checked), "opinion", or "personal" (personal story/anecdote)
 - "category": "health","scheme","money","news" or "other"
 - "time_ref": any date/deadline/time mentioned for this claim, else null
 - "search_query": a short English web-search query to verify this claim
Also give "language" of the MESSAGE: "hi","mr","en","hinglish" or "other",
and "red_flags": manipulation tricks found, each {"type": "urgency|fear|chain_forward|authority|miracle|suspicious_link|other", "text": quote}.
If there is nothing checkable (greetings, jokes, ads), return "claims": [].
Return JSON: {"language": "...", "claims": [...], "red_flags": [...]}
MESSAGE:
"""

MAX_CLAIMS = 8   # free-tier quota + speed


def extract_claims(text: str) -> dict:
    out = generate_json(PROMPT + text)
    claims = [c for c in out.get("claims", []) if c.get("text")][:MAX_CLAIMS]
    for i, c in enumerate(claims, 1):
        c.setdefault("id", f"C{i}")
        c.setdefault("search_query", c["text"])
    llm_flags = [f for f in out.get("red_flags", []) if f.get("type") and f.get("text")]
    seen = {f["type"] for f in llm_flags}
    flags = llm_flags + [f for f in radar(text) if f["type"] not in seen]
    return {"language": out.get("language") or "en", "claims": claims, "red_flags": flags}
