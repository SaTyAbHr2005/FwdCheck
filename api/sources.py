import os
import asyncio
import json
from urllib.parse import urlparse

import httpx
import trafilatura

OFFICIAL = ["gov.in", "nic.in", "rbi.org.in", "who.int", "sebi.gov.in", "icmr.gov.in", "eci.gov.in", "un.org"]
FACTCHECKERS = ["factcheck.pib.gov.in", "altnews.in", "boomlive.in", "factly.in", "vishvasnews.com",
                "thequint.com", "newschecker.in", "factcrescendo.com", "indiatoday.in"]
NEWS = ["reuters.com", "apnews.com", "thehindu.com", "indianexpress.com", "bbc.com", "ndtv.com",
        "hindustantimes.com", "livemint.com", "wikipedia.org"]
UA = {"User-Agent": "Mozilla/5.0 (FwdCheck fact-checker)"}
E = os.environ.get


def _host(url: str) -> str:
    return urlparse(url).netloc.lower().removeprefix("www.")


def _match(host: str, domains: list[str]) -> bool:
    return any(host == d or host.endswith("." + d) for d in domains)


def tier_of(url: str) -> str:
    h = _host(url)
    if _match(h, FACTCHECKERS):
        return "factchecker"
    if _match(h, OFFICIAL):
        return "official"
    if _match(h, NEWS):
        return "news"
    return "other"


def is_allowed(url: str) -> bool:
    return tier_of(url) != "other"


async def factcheck_api(c: httpx.AsyncClient, q: str) -> list[dict]:
    """Google Fact Check Tools: existing fact-checks (PIB, Alt News, BOOM...)."""
    if not E("FACTCHECK_API_KEY"):
        return []
    r = await c.get("https://factchecktools.googleapis.com/v1alpha1/claims:search",
                    params={"query": q, "key": E("FACTCHECK_API_KEY"), "pageSize": 5})
    out = []
    for cl in r.json().get("claims", []):
        for rv in cl.get("claimReview", []):
            if not rv.get("url"):
                continue
            text = f'{cl.get("text", "")} — Rating: {rv.get("textualRating", "")}. {rv.get("title", "")}'
            out.append({"url": rv["url"], "source": rv.get("publisher", {}).get("name") or _host(rv["url"]),
                        "date": (rv.get("reviewDate") or "")[:10] or None, "title": rv.get("title", ""),
                        "page_text": text})
    return out


async def search(c: httpx.AsyncClient, q: str) -> list[str]:
    """Candidate URLs from trusted domains. Tavily -> Serper -> DuckDuckGo."""
    if E("TAVILY_API_KEY"):
        try:
            r = await c.post("https://api.tavily.com/search", headers={"Authorization": f"Bearer {E('TAVILY_API_KEY')}"},
                             json={"query": q, "max_results": 5, "include_domains": OFFICIAL + FACTCHECKERS + NEWS})
            urls = [x["url"] for x in r.json().get("results", []) if is_allowed(x["url"])]
            if urls:
                return urls
        except Exception:
            pass
    if E("SERPER_API_KEY"):
        try:
            r = await c.post("https://google.serper.dev/search", headers={"X-API-KEY": E("SERPER_API_KEY")},
                             json={"q": q, "gl": "in", "num": 10})
            urls = [x["link"] for x in r.json().get("organic", []) if is_allowed(x["link"])]
            if urls:
                return urls
        except Exception:
            pass
    try:
        from ddgs import DDGS
        res = await asyncio.to_thread(lambda: DDGS().text(q, max_results=10, region="in-en"))
        return [x["href"] for x in res if is_allowed(x["href"])]
    except Exception:
        return []


async def fetch_page(c: httpx.AsyncClient, url: str) -> dict | None:
    """Download + extract article text and publish date. Any failure -> None (source skipped)."""
    try:
        r = await c.get(url, headers=UA, follow_redirects=True, timeout=15)
        data = json.loads(trafilatura.extract(r.text, output_format="json", with_metadata=True) or "null")
        if not data or not data.get("text"):
            return None
        return {"url": url, "source": data.get("sitename") or _host(url), "date": data.get("date"),
                "title": data.get("title") or "", "page_text": data["text"][:8000]}
    except Exception:
        return None


async def evidence_for(c: httpx.AsyncClient, claim: dict) -> list[dict]:
    q = claim.get("search_query") or claim["text"]
    fc, urls = await asyncio.gather(factcheck_api(c, q), search(c, q), return_exceptions=True)
    fc = fc if isinstance(fc, list) else []
    urls = urls if isinstance(urls, list) else []
    seen = {f["url"] for f in fc}
    to_fetch = [u for u in dict.fromkeys(urls) if u not in seen][:4]
    pages = await asyncio.gather(*(fetch_page(c, u) for u in to_fetch))
    ev = fc[:3] + [p for p in pages if p][:3]
    for e in ev:
        e["claim_id"] = claim["id"]
        e["tier"] = tier_of(e["url"])
    return ev


async def gather_evidence(claims: list[dict]) -> list[dict]:
    checkable = [c for c in claims if c.get("kind", "fact") == "fact"]
    async with httpx.AsyncClient(timeout=20) as c:
        groups = await asyncio.gather(*(evidence_for(c, cl) for cl in checkable))
    return [e for g in groups for e in g]
