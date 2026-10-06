import httpx
import trafilatura
from llm import generate_json

READ_PROMPT = """You receive a forwarded message (as an image, audio or PDF).
1. Write out ALL its text exactly (transcribe audio, read text in images; keep the original language and script).
2. Detect the language: one of "hi","mr","en","hinglish","other".
Return JSON: {"text": "...", "language": "..."}"""

MAX_CHARS = 12000


def fetch_url_text(url: str) -> str:
    try:
        html = httpx.get(url, timeout=20, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0"}).text
    except httpx.HTTPError as e:
        raise ValueError("Couldn't open that link") from e
    return trafilatura.extract(html) or ""


def to_text(text: str | None = None, url: str | None = None, file: bytes | None = None, mime: str | None = None) -> dict:
    """Any input -> {"text", "language", "input_type"}. language is None when the extract step must detect it."""
    if file and mime == "application/pdf":
        import pymupdf
        pdf_text = "\n".join(p.get_text() for p in pymupdf.open(stream=file, filetype="pdf"))[:MAX_CHARS]
        if pdf_text.strip():                                  # text PDF: no LLM call needed
            return {"text": pdf_text, "language": None, "input_type": "pdf"}
        # scanned PDF: fall through and let Gemini read it
    if file:
        out = generate_json(READ_PROMPT, files=[(file, mime)])
        kind = "pdf" if mime == "application/pdf" else mime.split("/")[0]   # image | audio
        return {"text": (out.get("text") or "")[:MAX_CHARS], "language": out.get("language"), "input_type": kind}
    if url:
        return {"text": fetch_url_text(url)[:MAX_CHARS], "language": None, "input_type": "url"}
    t = (text or "").strip()[:MAX_CHARS]
    if t.startswith("http") and " " not in t:                 # user pasted only a link
        return to_text(url=t)
    return {"text": t, "language": None, "input_type": "text"}
