import re

MIN_QUOTE = 15


def _norm(s: str | None) -> str:
    return re.sub(r"\s+", " ", s or "").strip().lower()


def enforce_grounding(verdicts: list[dict], evidence: list[dict]) -> list[dict]:
    """'No source, no verdict': keep only quotes that really appear in a fetched source page.
    A verdict left with no evidence is downgraded to UNVERIFIABLE."""
    pages: dict[str, str] = {}
    for e in evidence:
        pages[e["url"]] = pages.get(e["url"], "") + " " + _norm(e.get("page_text"))
    meta = {e["url"]: e for e in evidence}
    for v in verdicts:
        kept = []
        for q in v.get("evidence", []):
            quote, url = _norm(q.get("quote")), q.get("url")
            if len(quote) >= MIN_QUOTE and quote in pages.get(url, ""):
                src = meta[url]   # trust our own source metadata, not the LLM's
                kept.append({"quote": q["quote"], "url": url, "source": src.get("source") or q.get("source", ""),
                             "tier": src.get("tier", "other"), "date": src.get("date")})
        v["evidence"] = kept
        if not kept and v.get("verdict") != "UNVERIFIABLE":
            v["verdict"] = "UNVERIFIABLE"
            v["what_is_wrong"] = ""
            v["confidence"] = 0.0
    return verdicts
