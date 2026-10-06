# FwdCheck — Implementation Plan (Start → End)

> Build order: **M0 → M19**. Never start a module until the previous module's **✅ CHECKPOINT** passes.
> Tick boxes `- [x]` as you go. Spec: [PLAN.md](PLAN.md) (product, USPs, free stack).

**Goal:** WhatsApp/Telegram bot + website that takes a forward (text, screenshot, voice note, PDF, link), splits it into claims, checks each against trusted sources, and replies with per-claim verdicts, evidence, simple Hindi/English/Marathi explanation, voice note and a shareable card.

**Architecture:** One Python **FastAPI** backend on **Render** runs the whole pipeline (`ingest → extract → retrieve → judge → guardrail → respond`) and stores results in **Supabase**. A **Next.js** site on **Vercel** is only UI (calls the backend). Bots (Telegram, WhatsApp) are webhooks on the same backend.

**Tech stack:** Python 3.12, FastAPI, google-genai (Gemini Flash-Lite), groq, httpx, trafilatura, PyMuPDF, ddgs, edge-tts, supabase-py, pytest · Next.js (App Router, TypeScript, Tailwind) · Supabase Postgres + pg_trgm · Render free · Vercel Hobby · cron-job.org.

## Global constraints
- ₹0 and **no credit card** anywhere. Only services listed in PLAN.md §4.
- Max **2 LLM calls per check** (call 1 = read + split claims; call 2 = judge all claims).
- Exactly 5 claim verdicts: `VERIFIED`, `FALSE`, `OUTDATED`, `PARTLY_TRUE`, `UNVERIFIABLE`.
- No verdict other than `UNVERIFIABLE` without at least one evidence quote that string-matches a fetched source.
- Secrets only in `.env` (local) / Render & Vercel env settings. `.env` is in `.gitignore`. Never in the frontend except `NEXT_PUBLIC_API_URL`.
- Phone numbers / Telegram IDs never stored in plain text.
- Reply in the user's input language (Hindi, Marathi, English, Hinglish at minimum).

## Review focus (things that will break in real use — each has a test in its module)
1. **Empty / non-claim input** ("Good morning 🌸" image) → reply "No checkable facts found", not a crash. *(M4, M8)*
2. **LLM invents a quote or URL** → dropped by guardrail, verdict downgraded. *(M7)*
3. **Gemini quota exhausted / API down** → Groq fallback, else friendly error; never a 500 to WhatsApp. *(M2, M8)*
4. **Source page fails to load / blocks scraping** → skip that source, continue with others. *(M5)*
5. **Same forward sent twice** → second reply comes from cache in ~1–2 s. *(M8)*

---

## Module map (remember this)

| # | Module | Output you can see |
|---|---|---|
| M0 | Setup: accounts, tools, repo, keys | `check_keys.py` all ✅ |
| M1 | Backend skeleton | `/health` returns ok |
| M2 | LLM client (Gemini + Groq fallback) | JSON answer from AI |
| M3 | Ingest (text/url/image/audio/pdf → text) | text + language for all 5 types |
| M4 | Claim X-Ray + Manipulation Radar | list of claims + red flags |
| M5 | Evidence retrieval | sources with quotes + dates |
| M6 | Judge + Time-Travel Check | verdict per claim |
| M7 | Guardrail "No source, no verdict" | fake quotes removed |
| M8 | Pipeline + `/check` API + Supabase + cache | full JSON result, saved, cached |
| M9 | Deploy backend (Render + cron) | public `/health` URL |
| M10 | Website (Next.js on Vercel) | paste → see Claim X-Ray |
| M11 | Rebuttal Card | PNG image URL |
| M12 | Voice reply (TTS) | Hindi mp3 |
| M13 | Telegram bot | bot replies on phone |
| M14 | WhatsApp bot | WhatsApp replies |
| M15 | PWA + Android Share target | "Share → FwdCheck" works |
| M16 | Trending dashboard | /trending page |
| M17 | Eval set + accuracy | accuracy % for PPT |
| M18 | Demo hardening + pivot drill | demo checklist all ✅ |
| M19 | **Submission: prototype + PPT** | submitted on Unstop |

## Final file structure

```
Hack_on_Track/
├─ PLAN.md, IMPLEMENTATION_PLAN.md
├─ .gitignore
├─ api/                         ← Render
│  ├─ .env.example
│  ├─ requirements.txt
│  ├─ check_keys.py             M0  ping every API
│  ├─ main.py                   M1  FastAPI app + routes
│  ├─ llm.py                    M2  generate_json()
│  ├─ ingest.py                 M3  to_text()
│  ├─ extract.py                M4  extract_claims()
│  ├─ radar.py                  M4  rule-based red flags
│  ├─ sources.py                M5  gather_evidence()
│  ├─ judge.py                  M6  judge_claims(), overall_verdict()
│  ├─ guardrail.py              M7  enforce_grounding()
│  ├─ db.py                     M8  save/find/get
│  ├─ pipeline.py               M8  run_check()
│  ├─ voice.py                  M12 tts()
│  ├─ telegram_bot.py           M13
│  ├─ whatsapp_bot.py           M14
│  ├─ schema.sql                M8  Supabase tables
│  └─ tests/
│     ├─ fixtures/              forward.txt, forward.png, note.ogg, circular.pdf
│     ├─ test_radar.py, test_guardrail.py, test_judge.py, test_sources.py
│     ├─ test_live.py           (uses real keys; run manually)
│     └─ eval/forwards.jsonl, run_eval.py   M17
└─ web/                         ← Vercel
   ├─ app/page.tsx              M10 input
   ├─ app/r/[id]/page.tsx       M10 result (Claim X-Ray)
   ├─ app/api/card/[id]/route.tsx M11
   ├─ app/share/route.ts        M15
   ├─ app/trending/page.tsx     M16
   ├─ lib/api.ts                M10 types + fetch helpers
   └─ public/manifest.json, sw.js, icon-192.png, icon-512.png  M15
```

## The shared contract (every module uses these shapes)

```python
# Output of M3
Ingested = {"text": str, "language": str, "input_type": "text|url|image|audio|pdf"}

# Output of M4 (one per claim)
Claim = {"id": "C1", "text": str, "kind": "fact|opinion|personal",
         "category": "health|scheme|money|news|other", "time_ref": str | None,
         "search_query": str}

# Output of M5 (one per source found for a claim)
Evidence = {"claim_id": "C1", "url": str, "source": str, "tier": "official|factchecker|news|other",
            "date": str | None, "title": str, "page_text": str}

# Output of M6/M7 (one per claim)
Verdict = {"claim_id": "C1", "claim": str,
           "verdict": "VERIFIED|FALSE|OUTDATED|PARTLY_TRUE|UNVERIFIABLE",
           "confidence": float, "what_is_wrong": str, "explanation": str,
           "timeline": [{"date": str, "event": str}],
           "evidence": [{"quote": str, "url": str, "source": str, "tier": str, "date": str | None}]}

# Output of M8 (the full result, stored in Supabase checks.result, returned by /check)
Result = {"id": uuid, "language": str, "input_type": str, "text": str,
          "overall": "TRUE|FALSE|MISLEADING|OUTDATED|PARTLY_TRUE|UNVERIFIABLE|NO_CLAIMS",
          "summary": str,            # simple-language answer in user's language
          "claims": [Verdict], "red_flags": [{"type": str, "text": str}],
          "cached": bool}
```

---

## M0 — Setup (accounts, tools, repo, keys)

- [ ] **0.1 Install software** (all free): Python **3.12**, Node.js **22 LTS**, Git, VS Code, Chrome, `cloudflared` (`winget install Cloudflare.cloudflared`).
  ```bash
  python --version
  ```
  ```bash
  node -v
  ```
  ```bash
  git --version
  ```
  Expected: Python 3.12.x, node v22+, git 2.x.

- [ ] **0.2 Create free accounts (no card):** GitHub, Vercel (sign in with GitHub), Render (GitHub), Supabase, Google AI Studio (aistudio.google.com → *Get API key*), Google Cloud Console (new project → enable *Fact Check Tools API* → *Credentials → API key*), Groq (console.groq.com), Tavily, Serper, cron-job.org. (Meta + Telegram come in M13/M14.)

- [ ] **0.3 In AI Studio, open the rate-limit page and copy the exact model ID of the Flash-Lite model that shows ~500 requests/day** (e.g. `gemini-3.1-flash-lite`). This goes in `GEMINI_MODEL`.

- [ ] **0.4 Create repo + folders**
  ```bash
  cd C:/Users/SATYARANJAN/Desktop/Hack_on_Track && git init && mkdir -p api/tests/fixtures api/tests/eval
  ```
  `.gitignore`:
  ```
  .env
  __pycache__/
  node_modules/
  .next/
  *.mp3
  ```

- [ ] **0.5 Python env + deps** — `api/requirements.txt`:
  ```
  fastapi==0.115.*
  uvicorn[standard]
  python-multipart
  python-dotenv
  httpx
  google-genai
  groq
  trafilatura
  pymupdf
  ddgs
  edge-tts
  supabase
  pytest
  ```
  ```bash
  cd api && python -m pip install -r requirements.txt
  ```

- [ ] **0.6 Keys file** — `api/.env.example` (copy to `api/.env` and fill):
  ```
  GEMINI_API_KEY=
  GEMINI_MODEL=gemini-3.1-flash-lite
  GROQ_API_KEY=
  GROQ_MODEL=openai/gpt-oss-120b
  FACTCHECK_API_KEY=
  TAVILY_API_KEY=
  SERPER_API_KEY=
  SUPABASE_URL=
  SUPABASE_SERVICE_KEY=
  WEB_ORIGIN=http://localhost:3000
  PUBLIC_API_URL=http://localhost:8000
  TELEGRAM_BOT_TOKEN=
  TELEGRAM_SECRET=
  WA_TOKEN=
  WA_PHONE_NUMBER_ID=
  WA_VERIFY_TOKEN=
  GRAPH_VERSION=v23.0
  HASH_SALT=change-me
  ```

- [ ] **0.7 `api/check_keys.py`** — pings every service once:
  ```python
  import os, httpx
  from dotenv import load_dotenv
  load_dotenv()
  E = os.environ.get

  def ok(name, fn):
      try:
          fn(); print(f"✅ {name}")
      except Exception as e:
          print(f"❌ {name}: {str(e)[:200]}")

  def gemini():
      from google import genai
      r = genai.Client(api_key=E("GEMINI_API_KEY")).models.generate_content(model=E("GEMINI_MODEL"), contents="Say OK")
      assert r.text
  def groq():
      from groq import Groq
      r = Groq(api_key=E("GROQ_API_KEY")).chat.completions.create(model=E("GROQ_MODEL"), messages=[{"role": "user", "content": "Say OK"}])
      assert r.choices[0].message.content
  def factcheck():
      r = httpx.get("https://factchecktools.googleapis.com/v1alpha1/claims:search",
                    params={"query": "lemon cures cancer", "key": E("FACTCHECK_API_KEY")}, timeout=20)
      r.raise_for_status(); assert "claims" in r.json()
  def tavily():
      r = httpx.post("https://api.tavily.com/search", headers={"Authorization": f"Bearer {E('TAVILY_API_KEY')}"},
                     json={"query": "RBI 2000 note withdrawal", "max_results": 1}, timeout=30)
      r.raise_for_status()
  def serper():
      r = httpx.post("https://google.serper.dev/search", headers={"X-API-KEY": E("SERPER_API_KEY")},
                     json={"q": "RBI 2000 note withdrawal", "gl": "in"}, timeout=20)
      r.raise_for_status()
  def supabase():
      from supabase import create_client
      create_client(E("SUPABASE_URL"), E("SUPABASE_SERVICE_KEY")).table("checks").select("id").limit(1).execute()

  for n, f in [("Gemini", gemini), ("Groq", groq), ("FactCheck", factcheck), ("Tavily", tavily), ("Serper", serper), ("Supabase", supabase)]:
      ok(n, f)
  ```
  (Supabase will show ❌ "relation checks does not exist" until M8 — that still proves the key works.)

### ✅ CHECKPOINT M0
```bash
cd api && python check_keys.py
```
Pass = Gemini, Groq, FactCheck, Tavily, Serper all ✅; Supabase ✅ or "checks does not exist".
Then: `git add -A && git commit -m "chore: setup"` and push to a new GitHub repo.

---

## M1 — Backend skeleton

- [ ] **1.1 `api/main.py`**
  ```python
  import os
  from dotenv import load_dotenv
  load_dotenv()
  from fastapi import FastAPI
  from fastapi.middleware.cors import CORSMiddleware

  app = FastAPI(title="FwdCheck API")
  app.add_middleware(CORSMiddleware, allow_origins=[os.environ.get("WEB_ORIGIN", "*")],
                     allow_methods=["*"], allow_headers=["*"])

  @app.get("/health")
  def health():
      return {"ok": True}
  ```

### ✅ CHECKPOINT M1
```bash
cd api && python -m uvicorn main:app --reload --port 8000
```
Open http://localhost:8000/health → `{"ok":true}`. Open http://localhost:8000/docs → Swagger page loads. Commit.

---

## M2 — LLM client (Gemini, Groq fallback)

**Produces:** `generate_json(prompt: str, files: list[tuple[bytes, str]] | None = None) -> dict` — returns parsed JSON; raises `LLMError` if both providers fail.

- [ ] **2.1 `api/llm.py`**
  ```python
  import os, json, re
  from google import genai
  from google.genai import types
  from groq import Groq

  class LLMError(Exception): ...

  _gemini = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
  _groq = Groq(api_key=os.environ["GROQ_API_KEY"]) if os.environ.get("GROQ_API_KEY") else None

  def _parse(text: str) -> dict:
      text = re.sub(r"^```(json)?|```$", "", text.strip(), flags=re.M).strip()
      return json.loads(text)

  def generate_json(prompt: str, files: list[tuple[bytes, str]] | None = None) -> dict:
      """files = [(bytes, mime_type)]. Only Gemini can read files; Groq is text-only fallback."""
      try:
          parts = [types.Part.from_bytes(data=b, mime_type=m) for b, m in (files or [])] + [prompt]
          r = _gemini.models.generate_content(
              model=os.environ["GEMINI_MODEL"], contents=parts,
              config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.1))
          return _parse(r.text)
      except Exception as e:
          if files or not _groq:
              raise LLMError(f"Gemini failed: {e}") from e
          try:
              r = _groq.chat.completions.create(
                  model=os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b"),
                  messages=[{"role": "user", "content": prompt + "\nReturn only JSON."}],
                  response_format={"type": "json_object"}, temperature=0.1)
              return _parse(r.choices[0].message.content)
          except Exception as e2:
              raise LLMError(f"Gemini: {e} | Groq: {e2}") from e2
  ```

- [ ] **2.2 `api/tests/test_live.py`** (starts here, grows each module; needs real keys)
  ```python
  from dotenv import load_dotenv; load_dotenv()
  from llm import generate_json

  def test_llm_json():
      out = generate_json('Return {"answer": 2+2} as JSON with the number computed.')
      assert out["answer"] == 4
  ```

### ✅ CHECKPOINT M2
```bash
cd api && python -m pytest tests/test_live.py -k llm -v
```
Pass = 1 passed. Also test the fallback once: temporarily set `GEMINI_MODEL=wrong-model` in `.env`, rerun → still passes (Groq answered). Put it back. Commit.

---

## M3 — Ingest: any input → plain text + language

**Consumes:** `generate_json` (M2). **Produces:** `to_text(text: str|None, url: str|None, file: bytes|None, mime: str|None) -> Ingested`.

- [ ] **3.1 Add test fixtures** in `api/tests/fixtures/`:
  - `forward.txt` — the ₹2000/lemon forward from PLAN workflow example.
  - `forward.png` — screenshot of that text (paste in WhatsApp → screenshot).
  - `note.ogg` — record a Hindi voice note on WhatsApp saying "Kya ye sach hai ki nimbu paani se cancer theek hota hai?" and export it.
  - `circular.pdf` — any 1–2 page PDF with a claim (print the forward to PDF).

- [ ] **3.2 `api/ingest.py`**
  ```python
  import httpx, trafilatura, fitz  # fitz = PyMuPDF
  from llm import generate_json

  READ_PROMPT = """You receive a forwarded message (as text, image, audio or PDF).
  1. Write out ALL its text exactly (transcribe audio, read text in images; keep original language/script).
  2. Detect the language: one of "hi","mr","en","hinglish","other".
  Return JSON: {"text": "...", "language": "..."}"""

  LANG_PROMPT = """Detect the language of this text. One of "hi","mr","en","hinglish","other".
  Return JSON: {"language": "..."}\nTEXT:\n"""

  MAX_CHARS = 12000

  def fetch_url_text(url: str) -> str:
      html = httpx.get(url, timeout=20, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0"}).text
      return trafilatura.extract(html) or ""

  def to_text(text=None, url=None, file: bytes | None = None, mime: str | None = None) -> dict:
      if file and mime == "application/pdf":
          doc = fitz.open(stream=file, filetype="pdf")
          pdf_text = "\n".join(p.get_text() for p in doc)[:MAX_CHARS]
          if pdf_text.strip():   # text PDF → no LLM file call needed
              return {"text": pdf_text, "input_type": "pdf", **generate_json(LANG_PROMPT + pdf_text[:2000])}
          # scanned PDF → let Gemini read it
      if file:
          out = generate_json(READ_PROMPT, files=[(file, mime)])
          kind = "pdf" if mime == "application/pdf" else mime.split("/")[0]  # image | audio
          return {"text": out["text"][:MAX_CHARS], "language": out["language"], "input_type": kind}
      if url:
          t = fetch_url_text(url)[:MAX_CHARS]
          return {"text": t, "input_type": "url", **generate_json(LANG_PROMPT + t[:2000])}
      t = (text or "").strip()[:MAX_CHARS]
      if t.startswith("http") and " " not in t:   # user pasted only a link
          return to_text(url=t)
      return {"text": t, "input_type": "text", **generate_json(LANG_PROMPT + t[:2000])}
  ```
  > Ponytail note: language detection for plain text costs an LLM call. To keep the 2-calls rule, M4 also returns `language`; once M4 works, delete `LANG_PROMPT` calls and take language from M4. (Done in M8 step 8.3.)

- [ ] **3.3 Add live tests** to `tests/test_live.py`:
  ```python
  from pathlib import Path
  from ingest import to_text
  F = Path(__file__).parent / "fixtures"

  def test_ingest_image():
      out = to_text(file=(F / "forward.png").read_bytes(), mime="image/png")
      assert "2000" in out["text"] and out["input_type"] == "image"

  def test_ingest_audio():
      out = to_text(file=(F / "note.ogg").read_bytes(), mime="audio/ogg")
      assert out["text"] and out["language"] in ("hi", "hinglish")

  def test_ingest_pdf():
      out = to_text(file=(F / "circular.pdf").read_bytes(), mime="application/pdf")
      assert out["text"] and out["input_type"] == "pdf"

  def test_ingest_url():
      out = to_text(url="https://en.wikipedia.org/wiki/Reserve_Bank_of_India")
      assert "Reserve Bank" in out["text"]
  ```

### ✅ CHECKPOINT M3
```bash
cd api && python -m pytest tests/test_live.py -k ingest -v
```
Pass = 4 passed. Print one output and eyeball it: the Hindi voice note text should be readable Hindi. Commit.

---

## M4 — Claim X-Ray + Manipulation Radar (LLM call #1)

**Consumes:** `generate_json`. **Produces:** `extract_claims(text: str) -> {"language": str, "claims": [Claim], "red_flags": [...]}` and `radar(text: str) -> list[{"type","text"}]`.

- [ ] **4.1 Failing unit test first** — `api/tests/test_radar.py` (offline, no keys):
  ```python
  from radar import radar

  def types(t): return {f["type"] for f in radar(t)}

  def test_chain_forward():
      assert "chain_forward" in types("Ye message 10 groups mein forward karo")
  def test_fear():
      assert "fear" in types("forward nahi kiya to bura hoga")
  def test_urgency():
      assert "urgency" in types("URGENT!! only till tomorrow")
  def test_fake_authority():
      assert "authority" in types("WHO ne confirm kiya hai")
  def test_suspicious_link():
      assert "suspicious_link" in types("Register at rbi-note-badlo.in now")
  def test_official_link_ok():
      assert "suspicious_link" not in types("See https://rbi.org.in/press")
  def test_clean_text():
      assert radar("Good morning, have a nice day") == []
  ```
  Run `pytest tests/test_radar.py` → fails (no module `radar`).

- [ ] **4.2 `api/radar.py`**
  ```python
  import re

  RULES = {
      "chain_forward": r"forward\s*(to|kar|karo|kare|kara)|\b\d+\s*(groups?|logon|people|लोगों)|share\s+with\s+\d+",
      "fear": r"bura hoga|nahi to|warna|otherwise.*(lose|bad)|doob ja|बुरा होगा|वरना",
      "urgency": r"\burgent\b|zaroori|turant|abhi\b|only till|last date|aakhri|तुरंत|जरूरी|🚨",
      "authority": r"\b(who|nasa|unicef|rbi|icmr|google|harvard)\b.{0,30}(confirm|says|ne kaha|ne confirm|bataya)",
      "miracle": r"cure[sd]?|theek ho|khatam ho jata|100%\s*(guarantee|effective)|chamatkar",
  }
  OFFICIAL = (".gov.in", ".nic.in", "rbi.org.in", "who.int", "sebi.gov.in", "india.gov.in")
  DOMAIN = re.compile(r"\b((?:https?://)?(?:[a-z0-9-]+\.)+(?:in|com|org|net|xyz|info|online|site|top|co)\b)[^\s]*", re.I)

  def radar(text: str) -> list[dict]:
      flags = []
      for kind, pat in RULES.items():
          m = re.search(pat, text, re.I)
          if m:
              flags.append({"type": kind, "text": m.group(0)})
      for m in DOMAIN.finditer(text):
          host = re.sub(r"^https?://", "", m.group(1).lower())
          if not host.endswith(OFFICIAL):
              flags.append({"type": "suspicious_link", "text": host})
      return flags
  ```
  Run `pytest tests/test_radar.py -v` → 7 passed.

- [ ] **4.3 `api/extract.py`**
  ```python
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

  def extract_claims(text: str) -> dict:
      out = generate_json(PROMPT + text)
      claims = [c for c in out.get("claims", []) if c.get("text")][:8]   # cap: quota + speed
      seen = {(f["type"], f["text"].lower()) for f in out.get("red_flags", [])}
      flags = out.get("red_flags", []) + [f for f in radar(text) if (f["type"], f["text"].lower()) not in seen]
      return {"language": out.get("language", "en"), "claims": claims, "red_flags": flags}
  ```

- [ ] **4.4 Live tests** append to `tests/test_live.py`:
  ```python
  from extract import extract_claims

  def test_extract_forward():
      out = extract_claims((F / "forward.txt").read_text(encoding="utf-8"))
      assert len(out["claims"]) >= 4
      assert any(c["kind"] == "personal" for c in out["claims"])        # mama ji story
      assert {"chain_forward", "suspicious_link"} <= {f["type"] for f in out["red_flags"]}

  def test_extract_nothing_checkable():                                   # Review focus #1
      assert extract_claims("Good morning 🌸 have a blessed day")["claims"] == []
  ```

### ✅ CHECKPOINT M4
```bash
cd api && python -m pytest tests/test_radar.py tests/test_live.py -k "radar or extract" -v
```
Pass = all green. Print `extract_claims(...)` for the fixture and check that "₹2000 banned", "30 Sept deadline", "money lost", "fake link", "lemon cures cancer", "mama ji" all appear as separate claims. Commit.

---

## M5 — Evidence retrieval

**Produces:** `gather_evidence(claims: list[Claim]) -> list[Evidence]` (async) and `tier_of(url: str) -> str`.

- [ ] **5.1 Failing unit test** — `api/tests/test_sources.py`:
  ```python
  from sources import tier_of, is_allowed

  def test_tiers():
      assert tier_of("https://rbi.org.in/Scripts/x.aspx") == "official"
      assert tier_of("https://pib.gov.in/PressRelease.aspx") == "official"
      assert tier_of("https://www.altnews.in/some-check/") == "factchecker"
      assert tier_of("https://www.thehindu.com/news/x") == "news"
      assert tier_of("https://randomblog.xyz/x") == "other"

  def test_allowlist():
      assert is_allowed("https://www.who.int/news")
      assert not is_allowed("https://rbi-note-badlo.in")
  ```

- [ ] **5.2 `api/sources.py`**
  ```python
  import os, asyncio, json
  from urllib.parse import urlparse
  import httpx, trafilatura
  from ddgs import DDGS

  OFFICIAL = ["gov.in", "nic.in", "rbi.org.in", "who.int", "sebi.gov.in", "icmr.gov.in", "eci.gov.in", "un.org"]
  FACTCHECKERS = ["factcheck.pib.gov.in", "altnews.in", "boomlive.in", "factly.in", "vishvasnews.com",
                  "thequint.com", "newschecker.in", "factcrescendo.com", "indiatoday.in"]
  NEWS = ["reuters.com", "apnews.com", "thehindu.com", "indianexpress.com", "bbc.com", "ndtv.com",
          "hindustantimes.com", "livemint.com", "wikipedia.org"]

  def _host(url): return urlparse(url).netloc.lower().removeprefix("www.")
  def _match(host, domains): return any(host == d or host.endswith("." + d) for d in domains)

  def tier_of(url: str) -> str:
      h = _host(url)
      if _match(h, FACTCHECKERS): return "factchecker"
      if _match(h, OFFICIAL): return "official"
      if _match(h, NEWS): return "news"
      return "other"

  def is_allowed(url: str) -> bool:
      return tier_of(url) != "other"

  E = os.environ.get
  UA = {"User-Agent": "Mozilla/5.0 FwdCheck"}

  async def factcheck_api(c: httpx.AsyncClient, q: str) -> list[dict]:
      if not E("FACTCHECK_API_KEY"): return []
      r = await c.get("https://factchecktools.googleapis.com/v1alpha1/claims:search",
                      params={"query": q, "key": E("FACTCHECK_API_KEY"), "pageSize": 5})
      out = []
      for cl in r.json().get("claims", []):
          for rv in cl.get("claimReview", []):
              text = f'{cl.get("text","")} — Rating: {rv.get("textualRating","")}. {rv.get("title","")}'
              out.append({"url": rv["url"], "source": rv.get("publisher", {}).get("name", _host(rv["url"])),
                          "date": rv.get("reviewDate", "")[:10] or None, "title": rv.get("title", ""),
                          "page_text": text, "prefetched": True})
      return out

  async def search(c: httpx.AsyncClient, q: str) -> list[str]:
      """Return candidate URLs from trusted domains. Tavily → Serper → DuckDuckGo."""
      domains = OFFICIAL + FACTCHECKERS + NEWS
      try:
          if E("TAVILY_API_KEY"):
              r = await c.post("https://api.tavily.com/search", headers={"Authorization": f"Bearer {E('TAVILY_API_KEY')}"},
                               json={"query": q, "max_results": 5, "include_domains": domains})
              urls = [x["url"] for x in r.json().get("results", [])]
              if urls: return urls
      except Exception: pass
      try:
          if E("SERPER_API_KEY"):
              r = await c.post("https://google.serper.dev/search", headers={"X-API-KEY": E("SERPER_API_KEY")},
                               json={"q": q, "gl": "in", "num": 10})
              urls = [x["link"] for x in r.json().get("organic", []) if is_allowed(x["link"])]
              if urls: return urls
      except Exception: pass
      try:
          res = await asyncio.to_thread(lambda: DDGS().text(q, max_results=10, region="in-en"))
          return [x["href"] for x in res if is_allowed(x["href"])]
      except Exception:
          return []

  async def fetch_page(c: httpx.AsyncClient, url: str) -> dict | None:
      try:                                                     # Review focus #4: failures are skipped
          r = await c.get(url, headers=UA, follow_redirects=True, timeout=15)
          data = json.loads(trafilatura.extract(r.text, output_format="json", with_metadata=True) or "null")
          if not data or not data.get("text"): return None
          return {"url": url, "source": data.get("sitename") or _host(url), "date": data.get("date"),
                  "title": data.get("title") or "", "page_text": data["text"][:8000]}
      except Exception:
          return None

  async def evidence_for(c: httpx.AsyncClient, claim: dict) -> list[dict]:
      q = claim["search_query"]
      fc, urls = await asyncio.gather(factcheck_api(c, q), search(c, q), return_exceptions=True)
      fc = fc if isinstance(fc, list) else []
      urls = urls if isinstance(urls, list) else []
      pages = await asyncio.gather(*(fetch_page(c, u) for u in urls[:3]))
      ev = fc[:3] + [p for p in pages if p]
      for e in ev:
          e["claim_id"] = claim["id"]; e["tier"] = tier_of(e["url"]); e.pop("prefetched", None)
      return ev

  async def gather_evidence(claims: list[dict]) -> list[dict]:
      checkable = [c for c in claims if c.get("kind") == "fact"]
      async with httpx.AsyncClient(timeout=20) as c:
          groups = await asyncio.gather(*(evidence_for(c, cl) for cl in checkable))
      return [e for g in groups for e in g]
  ```
  Run `pytest tests/test_sources.py -v` → 2 passed.

- [ ] **5.3 Live test** append:
  ```python
  import asyncio
  from sources import gather_evidence

  def test_evidence_rbi():
      claims = [{"id": "C1", "kind": "fact", "text": "RBI withdrew 2000 rupee notes",
                 "search_query": "RBI withdraws 2000 rupee notes circulation"}]
      ev = asyncio.run(gather_evidence(claims))
      assert ev and all(e["claim_id"] == "C1" for e in ev)
      assert any(e["tier"] in ("official", "factchecker", "news") for e in ev)
  ```

### ✅ CHECKPOINT M5
```bash
cd api && python -m pytest tests/test_sources.py tests/test_live.py -k "tiers or allowlist or evidence" -v
```
Pass = green. Print the evidence list: every item has a URL, a source name and some page text; most have a date. Commit.

---

## M6 — Judge + Time-Travel Check (LLM call #2)

**Consumes:** Claims (M4), Evidence (M5), `generate_json`. **Produces:** `judge_claims(claims, evidence, language, today) -> {"claims": [Verdict], "summary": str}` and `overall_verdict(verdicts) -> str`.

- [ ] **6.1 Failing unit test** — `api/tests/test_judge.py` (offline):
  ```python
  from judge import overall_verdict
  V = lambda *vs: [{"verdict": v} for v in vs]

  def test_all_true():      assert overall_verdict(V("VERIFIED", "VERIFIED")) == "TRUE"
  def test_all_false():     assert overall_verdict(V("FALSE")) == "FALSE"
  def test_mixed():         assert overall_verdict(V("VERIFIED", "FALSE")) == "MISLEADING"
  def test_outdated():      assert overall_verdict(V("VERIFIED", "OUTDATED")) == "OUTDATED"
  def test_unverifiable():  assert overall_verdict(V("UNVERIFIABLE")) == "UNVERIFIABLE"
  def test_partly():        assert overall_verdict(V("VERIFIED", "PARTLY_TRUE")) == "PARTLY_TRUE"
  def test_empty():         assert overall_verdict([]) == "NO_CLAIMS"
  def test_ignores_unverifiable_when_false_present():
      assert overall_verdict(V("FALSE", "UNVERIFIABLE")) == "FALSE"
  ```

- [ ] **6.2 `api/judge.py`**
  ```python
  import json
  from llm import generate_json

  LANG_NAME = {"hi": "simple Hindi (Devanagari)", "mr": "simple Marathi", "hinglish": "simple Hinglish (Roman Hindi)",
               "en": "simple English", "other": "simple English"}

  PROMPT = """You are a careful fact-checker. TODAY is {today}.
  For EACH claim, decide using ONLY the EVIDENCE given (never your own memory):
   - VERIFIED: evidence clearly supports it and it is still true today
   - FALSE: evidence clearly contradicts it
   - OUTDATED: it was true at some time but is no longer true today (old deadline, ended scheme, old news). Compare time_ref and source dates with TODAY.
   - PARTLY_TRUE: part is supported, part is wrong or exaggerated
   - UNVERIFIABLE: evidence is missing or not enough, or it is a personal story/opinion
  Rules:
   - Every quote in "evidence" MUST be copied word-for-word from that source's page_text (max 300 chars).
   - If you have no quote, verdict must be UNVERIFIABLE.
   - "what_is_wrong": one short sentence on exactly which part is wrong ("" if VERIFIED).
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

  def judge_claims(claims: list[dict], evidence: list[dict], language: str, today: str) -> dict:
      if not claims:
          return {"claims": [], "summary": ""}
      slim_claims = [{k: c.get(k) for k in ("id", "text", "kind", "time_ref")} for c in claims]
      slim_ev = [{k: e.get(k) for k in ("claim_id", "url", "source", "tier", "date", "page_text")} for e in evidence]
      for e in slim_ev:
          e["page_text"] = (e["page_text"] or "")[:2500]           # keep prompt within free-tier token limits
      out = generate_json(PROMPT.format(today=today, lang=LANG_NAME.get(language, "simple English"),
                                        claims=json.dumps(slim_claims, ensure_ascii=False),
                                        evidence=json.dumps(slim_ev, ensure_ascii=False)))
      return {"claims": out.get("claims", []), "summary": out.get("summary", "")}

  def overall_verdict(verdicts: list[dict]) -> str:
      vs = [v["verdict"] for v in verdicts]
      if not vs: return "NO_CLAIMS"
      known = [v for v in vs if v != "UNVERIFIABLE"]
      if not known: return "UNVERIFIABLE"
      if "FALSE" in known:
          return "MISLEADING" if ("VERIFIED" in known or "PARTLY_TRUE" in known) else "FALSE"
      if "OUTDATED" in known: return "OUTDATED"
      if "PARTLY_TRUE" in known: return "PARTLY_TRUE"
      return "TRUE"
  ```
  Run `pytest tests/test_judge.py -v` → 8 passed.

- [ ] **6.3 Live test** append (full chain M4 → M5 → M6):
  ```python
  from judge import judge_claims

  def test_judge_outdated_2000_notes():
      claims = [{"id": "C1", "kind": "fact", "text": "Exchange 2000 rupee notes at any bank by 30 September",
                 "time_ref": "30 September", "search_query": "2000 rupee note exchange deadline banks RBI"}]
      ev = asyncio.run(gather_evidence(claims))
      out = judge_claims(claims, ev, "en", "2026-10-06")
      assert out["claims"][0]["verdict"] in ("OUTDATED", "FALSE")
      assert out["claims"][0]["evidence"]
  ```

### ✅ CHECKPOINT M6
```bash
cd api && python -m pytest tests/test_judge.py tests/test_live.py -k judge -v
```
Pass = green. Read the explanation for the outdated test — it must mention 2023. Commit.

---

## M7 — Guardrail "No source, no verdict" (pure Python, fully unit-tested)

**Consumes:** Verdicts (M6), Evidence (M5). **Produces:** `enforce_grounding(verdicts, evidence) -> list[Verdict]`.

- [ ] **7.1 Failing test** — `api/tests/test_guardrail.py`:
  ```python
  from guardrail import enforce_grounding

  EV = [{"claim_id": "C1", "url": "https://rbi.org.in/x", "page_text":
         "The Reserve Bank of India has decided to withdraw the  ₹2000 denomination banknotes from circulation. "
         "The ₹2000 banknotes will continue to be legal tender."}]

  def v(quote, url="https://rbi.org.in/x", verdict="PARTLY_TRUE"):
      return [{"claim_id": "C1", "verdict": verdict, "evidence": [{"quote": quote, "url": url}]}]

  def test_real_quote_kept():
      out = enforce_grounding(v("will continue to be legal tender"), EV)
      assert out[0]["verdict"] == "PARTLY_TRUE" and len(out[0]["evidence"]) == 1

  def test_whitespace_and_case_tolerant():
      out = enforce_grounding(v("decided to WITHDRAW the ₹2000   denomination"), EV)
      assert len(out[0]["evidence"]) == 1

  def test_fake_quote_dropped_and_downgraded():           # Review focus #2
      out = enforce_grounding(v("RBI says all notes are banned forever"), EV)
      assert out[0]["verdict"] == "UNVERIFIABLE" and out[0]["evidence"] == []

  def test_fake_url_dropped():
      out = enforce_grounding(v("will continue to be legal tender", url="https://made-up.com"), EV)
      assert out[0]["verdict"] == "UNVERIFIABLE"

  def test_too_short_quote_dropped():
      out = enforce_grounding(v("the"), EV)
      assert out[0]["verdict"] == "UNVERIFIABLE"

  def test_unverifiable_untouched():
      out = enforce_grounding([{"claim_id": "C2", "verdict": "UNVERIFIABLE", "evidence": []}], EV)
      assert out[0]["verdict"] == "UNVERIFIABLE"
  ```

- [ ] **7.2 `api/guardrail.py`**
  ```python
  import re

  def _norm(s: str) -> str:
      return re.sub(r"\s+", " ", (s or "")).strip().lower()

  def enforce_grounding(verdicts: list[dict], evidence: list[dict]) -> list[dict]:
      pages = {}
      for e in evidence:
          pages.setdefault(e["url"], "")
          pages[e["url"]] += " " + _norm(e.get("page_text", ""))
      for v in verdicts:
          kept = [q for q in v.get("evidence", [])
                  if len(_norm(q.get("quote"))) >= 15 and _norm(q.get("quote")) in pages.get(q.get("url"), "")]
          v["evidence"] = kept
          if not kept and v.get("verdict") != "UNVERIFIABLE":
              v["what_is_wrong"] = ""
              v["verdict"] = "UNVERIFIABLE"
              v["confidence"] = 0.0
      return verdicts
  ```

### ✅ CHECKPOINT M7
```bash
cd api && python -m pytest tests/test_guardrail.py -v
```
Pass = 6 passed. Commit.

---

## M8 — Pipeline + `/check` API + Supabase + cache

**Consumes:** M3–M7. **Produces:** `POST /check` (multipart: `text`, `url`, `file`) → `Result`; `GET /check/{id}` → `Result`; `run_check(...) -> Result`.

- [ ] **8.1 Supabase tables** — `api/schema.sql`, paste into Supabase → SQL Editor → Run:
  ```sql
  create extension if not exists pg_trgm;

  create table if not exists checks (
    id uuid primary key default gen_random_uuid(),
    raw_text text not null,
    channel text default 'web',
    language text,
    input_type text,
    overall text,
    result jsonb not null,
    hit_count int not null default 1,
    created_at timestamptz not null default now()
  );
  create index if not exists checks_trgm on checks using gin (raw_text gin_trgm_ops);
  alter table checks enable row level security;   -- no public access; backend uses service key

  create or replace function find_similar_check(q text, min_sim real default 0.8)
  returns setof checks language sql stable as $$
    select * from checks
    where similarity(raw_text, q) >= min_sim and created_at > now() - interval '30 days'
    order by similarity(raw_text, q) desc limit 1;
  $$;

  create or replace function bump_hit(check_id uuid)
  returns void language sql as $$
    update checks set hit_count = hit_count + 1 where id = check_id;
  $$;
  ```

- [ ] **8.2 `api/db.py`**
  ```python
  import os
  from supabase import create_client

  sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

  def find_similar(text: str) -> dict | None:
      rows = sb.rpc("find_similar_check", {"q": text}).execute().data
      if not rows: return None
      sb.rpc("bump_hit", {"check_id": rows[0]["id"]}).execute()
      return rows[0]["result"] | {"cached": True}

  def save(result: dict, channel: str) -> str:
      row = sb.table("checks").insert({"raw_text": result["text"], "channel": channel, "language": result["language"],
                                       "input_type": result["input_type"], "overall": result["overall"],
                                       "result": result}).execute().data[0]
      sb.table("checks").update({"result": result | {"id": row["id"]}}).eq("id", row["id"]).execute()
      return row["id"]

  def get(check_id: str) -> dict | None:
      rows = sb.table("checks").select("result").eq("id", check_id).limit(1).execute().data
      return rows[0]["result"] if rows else None

  def trending(limit: int = 10) -> list[dict]:
      since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
      return sb.table("checks").select("id,raw_text,overall,hit_count,created_at") \
               .neq("channel", "eval").gte("created_at", since) \
               .order("hit_count", desc=True).limit(limit).execute().data
  ```
  (Add `from datetime import datetime, timedelta, timezone` at the top of `db.py`.)

- [ ] **8.3 `api/pipeline.py`** — the 2-call pipeline. Also remove the `LANG_PROMPT` calls from `ingest.py` now: for text/url/text-PDF return `"language": None`; language comes from `extract_claims`.
  ```python
  import asyncio, datetime
  import db
  from ingest import to_text
  from extract import extract_claims
  from sources import gather_evidence
  from judge import judge_claims, overall_verdict
  from guardrail import enforce_grounding

  NO_CLAIMS_MSG = {"hi": "इस संदेश में जाँचने लायक कोई तथ्य नहीं मिला।", "mr": "या संदेशात तपासण्यासारखे तथ्य आढळले नाही.",
                   "hinglish": "Is message mein check karne layak koi fact nahi mila.", "en": "No checkable facts found in this message."}

  async def run_check(text=None, url=None, file=None, mime=None, channel="web") -> dict:
      ing = await asyncio.to_thread(to_text, text, url, file, mime)                    # 0–1 LLM call (files only)
      if not ing["text"].strip():
          raise ValueError("Could not read any text from the input")
      if hit := await asyncio.to_thread(db.find_similar, ing["text"]):                # Review focus #5
          return hit
      ex = await asyncio.to_thread(extract_claims, ing["text"])                       # LLM call #1
      lang = ing.get("language") or ex["language"]
      facts = [c for c in ex["claims"] if c.get("kind") == "fact"]
      evidence = await gather_evidence(facts)
      today = datetime.date.today().isoformat()
      j = await asyncio.to_thread(judge_claims, ex["claims"], evidence, lang, today)   # LLM call #2
      verdicts = enforce_grounding(j["claims"], evidence)
      result = {"language": lang, "input_type": ing["input_type"], "text": ing["text"],
                "overall": overall_verdict(verdicts),
                "summary": j["summary"] or NO_CLAIMS_MSG.get(lang, NO_CLAIMS_MSG["en"]),
                "claims": verdicts, "red_flags": ex["red_flags"], "cached": False}
      result["id"] = await asyncio.to_thread(db.save, result, channel)
      return result
  ```
  > Files (image/audio/scanned PDF) use 3 LLM calls (read + extract + judge). Acceptable; still ~160 checks/day.

- [ ] **8.4 Routes in `api/main.py`** (append)
  ```python
  from fastapi import Form, File, UploadFile, HTTPException
  from llm import LLMError
  import pipeline, db

  MAX_FILE = 15 * 1024 * 1024
  ALLOWED = ("image/", "audio/", "application/pdf")

  @app.post("/check")
  async def check(text: str | None = Form(None), url: str | None = Form(None), file: UploadFile | None = File(None)):
      data = mime = None
      if file:
          data = await file.read()
          mime = file.content_type or ""
          if len(data) > MAX_FILE: raise HTTPException(413, "File too large (max 15 MB)")
          if not mime.startswith(ALLOWED): raise HTTPException(415, "Send text, image, audio, PDF or a link")
      if not (text or url or data): raise HTTPException(400, "Nothing to check")
      try:
          return await pipeline.run_check(text, url, data, mime, "web")
      except LLMError:                                                  # Review focus #3
          raise HTTPException(503, "AI service busy, please try again in a minute")
      except ValueError as e:
          raise HTTPException(422, str(e))

  @app.get("/check/{check_id}")
  def get_check(check_id: str):
      r = db.get(check_id)
      if not r: raise HTTPException(404, "Not found")
      return r

  @app.get("/trending")
  def get_trending():
      return db.trending()
  ```

### ✅ CHECKPOINT M8
Server running (`uvicorn main:app --reload`), then:
```bash
curl -s -X POST http://localhost:8000/check -F "text=<tests/fixtures/forward.txt" | python -m json.tool
```
Pass =
1. JSON with `overall` = `MISLEADING` or `FALSE`, ≥4 claims, each non-UNVERIFIABLE claim has evidence with a real URL.
2. Row visible in Supabase → Table editor → `checks`.
3. Run the same curl again → returns in ~1–2 s with `"cached": true`, `hit_count` = 2 in Supabase.
4. `curl -X POST http://localhost:8000/check -F "text=Good morning"` → `overall: NO_CLAIMS`, friendly summary.
5. `curl -X POST http://localhost:8000/check -F "file=@tests/fixtures/forward.png"` → same kind of result.
Commit.

---

## M9 — Deploy backend (Render + cron)

- [ ] **9.1** Push to GitHub. Render → *New → Web Service* → pick repo → **Root directory `api`**, Runtime Python, Build `pip install -r requirements.txt`, Start `uvicorn main:app --host 0.0.0.0 --port $PORT`, Instance type **Free**.
- [ ] **9.2** Render → *Environment*: add every key from `api/.env` (set `WEB_ORIGIN` later in M10 to your Vercel URL, `PUBLIC_API_URL` to the Render URL). Add `PYTHON_VERSION=3.12.7`.
- [ ] **9.3** cron-job.org → new job → URL `https://<your-service>.onrender.com/health`, every **10 minutes**.

### ✅ CHECKPOINT M9
```bash
curl https://<your-service>.onrender.com/health
```
→ `{"ok":true}`. Then run the M8 curl against the Render URL → full result. Render *Logs* show no errors. Wait 30 min, curl `/health` again → answers instantly (cron keeps it awake).

---

## M10 — Website (Next.js on Vercel)

**Consumes:** `POST /check`, `GET /check/{id}`. **Produces:** pages `/` and `/r/[id]`.

- [ ] **10.1 Create app**
  ```bash
  cd C:/Users/SATYARANJAN/Desktop/Hack_on_Track && npx create-next-app@latest web --ts --tailwind --app --eslint --no-src-dir --import-alias "@/*" --use-npm --yes
  ```
  `web/.env.local`:
  ```
  NEXT_PUBLIC_API_URL=http://localhost:8000
  ```

- [ ] **10.2 `web/lib/api.ts`** — types mirror the shared contract
  ```ts
  export type VerdictKind = "VERIFIED" | "FALSE" | "OUTDATED" | "PARTLY_TRUE" | "UNVERIFIABLE";
  export type Evidence = { quote: string; url: string; source: string; tier: string; date?: string | null };
  export type Verdict = { claim_id: string; claim: string; verdict: VerdictKind; confidence: number;
    what_is_wrong: string; explanation: string; timeline: { date: string; event: string }[]; evidence: Evidence[] };
  export type Result = { id: string; language: string; input_type: string; text: string; overall: string;
    summary: string; claims: Verdict[]; red_flags: { type: string; text: string }[]; cached: boolean };

  export const API = process.env.NEXT_PUBLIC_API_URL!;

  export const STYLE: Record<string, { label: string; cls: string; emoji: string }> = {
    VERIFIED: { label: "Verified", cls: "bg-green-100 text-green-800 border-green-300", emoji: "🟢" },
    TRUE: { label: "True", cls: "bg-green-100 text-green-800 border-green-300", emoji: "🟢" },
    FALSE: { label: "False", cls: "bg-red-100 text-red-800 border-red-300", emoji: "🔴" },
    MISLEADING: { label: "Misleading", cls: "bg-red-100 text-red-800 border-red-300", emoji: "🔴" },
    OUTDATED: { label: "Outdated", cls: "bg-amber-100 text-amber-800 border-amber-300", emoji: "⏳" },
    PARTLY_TRUE: { label: "Partly true", cls: "bg-amber-100 text-amber-800 border-amber-300", emoji: "🟠" },
    UNVERIFIABLE: { label: "Cannot be confirmed", cls: "bg-gray-100 text-gray-700 border-gray-300", emoji: "⚪" },
    NO_CLAIMS: { label: "Nothing to check", cls: "bg-gray-100 text-gray-700 border-gray-300", emoji: "⚪" },
  };

  export async function getResult(id: string): Promise<Result | null> {
    const r = await fetch(`${API}/check/${id}`, { cache: "no-store" });
    return r.ok ? r.json() : null;
  }
  ```

- [ ] **10.3 `web/app/page.tsx`** — input form
  ```tsx
  "use client";
  import { useState } from "react";
  import { useRouter } from "next/navigation";
  import { API } from "@/lib/api";

  export default function Home() {
    const [text, setText] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const router = useRouter();

    async function submit(e: React.FormEvent) {
      e.preventDefault(); setBusy(true); setErr("");
      const fd = new FormData();
      if (text.trim()) fd.append("text", text.trim());
      if (file) fd.append("file", file);
      try {
        const r = await fetch(`${API}/check`, { method: "POST", body: fd });
        const j = await r.json();
        if (!r.ok) throw new Error(j.detail || "Something went wrong");
        router.push(`/r/${j.id}`);
      } catch (e: any) { setErr(e.message); setBusy(false); }
    }

    return (
      <main className="mx-auto max-w-2xl p-4">
        <h1 className="text-3xl font-bold">FwdCheck 🔍</h1>
        <p className="mt-1 text-gray-600">Forward it to us before you forward it to family.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label htmlFor="msg" className="block font-medium">Paste the message or a link</label>
          <textarea id="msg" value={text} onChange={e => setText(e.target.value)} rows={7}
            className="w-full rounded-lg border p-3" placeholder="Paste the WhatsApp forward here…" />
          <label htmlFor="file" className="block font-medium">…or upload a screenshot, voice note or PDF</label>
          <input id="file" type="file" accept="image/*,audio/*,application/pdf"
            onChange={e => setFile(e.target.files?.[0] ?? null)} className="block w-full" />
          <button disabled={busy || (!text.trim() && !file)}
            className="w-full rounded-lg bg-black py-3 font-semibold text-white disabled:opacity-40">
            {busy ? "Checking… (about 15 seconds)" : "Check this forward"}
          </button>
          {err && <p role="alert" className="text-red-700">{err}</p>}
        </form>
      </main>
    );
  }
  ```

- [ ] **10.4 `web/app/r/[id]/page.tsx`** — Claim X-Ray result
  ```tsx
  import { getResult, STYLE, API } from "@/lib/api";
  import { notFound } from "next/navigation";

  export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const r = await getResult(id);
    if (!r) notFound();
    const o = STYLE[r.overall] ?? STYLE.UNVERIFIABLE;
    return (
      <main className="mx-auto max-w-2xl space-y-6 p-4">
        <div className={`rounded-xl border-2 p-4 ${o.cls}`}>
          <p className="text-2xl font-bold">{o.emoji} {o.label}</p>
          <p className="mt-2 whitespace-pre-line">{r.summary}</p>
          {r.cached && <p className="mt-2 text-sm opacity-70">⚡ Already checked before: instant answer</p>}
        </div>

        <section>
          <h2 className="text-xl font-semibold">Claim X-Ray</h2>
          <ul className="mt-3 space-y-4">
            {r.claims.map(c => {
              const s = STYLE[c.verdict] ?? STYLE.UNVERIFIABLE;
              return (
                <li key={c.claim_id} className={`rounded-lg border p-3 ${s.cls}`}>
                  <p className="font-semibold">{s.emoji} {s.label}: {c.claim}</p>
                  {c.what_is_wrong && <p className="mt-1">❗ {c.what_is_wrong}</p>}
                  <p className="mt-1">{c.explanation}</p>
                  {c.timeline?.length > 0 && (
                    <ol className="mt-2 border-l-2 pl-3 text-sm">
                      {c.timeline.map((t, i) => <li key={i}><b>{t.date}</b>: {t.event}</li>)}
                    </ol>
                  )}
                  {c.evidence.map((e, i) => (
                    <blockquote key={i} className="mt-2 rounded bg-white/70 p-2 text-sm">
                      “{e.quote}” <a className="underline" href={e.url} target="_blank" rel="noreferrer">
                        {e.source}{e.date ? `, ${e.date.slice(0, 10)}` : ""}</a> · {e.tier}
                    </blockquote>
                  ))}
                </li>
              );
            })}
          </ul>
        </section>

        {r.red_flags.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold">🚩 Manipulation Radar</h2>
            <ul className="mt-2 list-disc pl-6">
              {r.red_flags.map((f, i) => <li key={i}><b>{f.type.replace("_", " ")}</b>: “{f.text}”</li>)}
            </ul>
          </section>
        )}

        <section>
          <h2 className="text-xl font-semibold">Original message</h2>
          <p className="mt-2 whitespace-pre-line rounded bg-gray-50 p-3 text-sm">{r.text}</p>
        </section>
      </main>
    );
  }
  ```

- [ ] **10.5 Deploy:** Vercel → *Add New Project* → import repo → **Root Directory `web`** → env `NEXT_PUBLIC_API_URL=https://<your-service>.onrender.com` → Deploy. Then on Render set `WEB_ORIGIN=https://<your-app>.vercel.app` and redeploy.

### ✅ CHECKPOINT M10
1. Local: `cd web && npm run dev` → http://localhost:3000 → paste forward → redirected to `/r/<id>` with coloured claims, evidence quotes with links, red flags.
2. Upload `forward.png` → same.
3. Live: open the Vercel URL **on your phone** → same works; no horizontal scrolling.
4. Kill the backend → submit → red "Something went wrong" message, page doesn't crash.
Commit.

---

## M11 — Rebuttal Card

**Produces:** `GET /api/card/{id}` → 1080×1080 PNG.

- [ ] **11.1 `web/app/api/card/[id]/route.tsx`**
  ```tsx
  import { ImageResponse } from "next/og";
  import { getResult, STYLE } from "@/lib/api";

  const BG: Record<string, string> = { TRUE: "#16a34a", FALSE: "#dc2626", MISLEADING: "#dc2626",
    OUTDATED: "#d97706", PARTLY_TRUE: "#d97706", UNVERIFIABLE: "#6b7280", NO_CLAIMS: "#6b7280" };

  export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const r = await getResult(id);
    if (!r) return new Response("Not found", { status: 404 });
    const s = STYLE[r.overall] ?? STYLE.UNVERIFIABLE;
    const lines = r.claims.filter(c => c.verdict !== "UNVERIFIABLE").slice(0, 4);
    const sources = [...new Set(r.claims.flatMap(c => c.evidence.map(e => e.source)))].slice(0, 3);
    const link = new URL(`/r/${id}`, req.url).toString();
    return new ImageResponse(
      <div style={{ width: 1080, height: 1080, display: "flex", flexDirection: "column", background: "white", fontSize: 36 }}>
        <div style={{ background: BG[r.overall] ?? "#6b7280", color: "white", padding: 48, fontSize: 80, fontWeight: 800 }}>
          {s.label.toUpperCase()}
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: 48, gap: 24, flexGrow: 1 }}>
          {lines.map(c => (
            <div key={c.claim_id} style={{ display: "flex" }}>
              {(STYLE[c.verdict]?.label ?? "")}: {c.claim}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: 48, fontSize: 28, color: "#374151" }}>
          <div>Sources: {sources.join(" · ")}</div>
          <div>Full proof: {link}</div>
          <div style={{ fontWeight: 700 }}>Checked by FwdCheck</div>
        </div>
      </div>,
      { width: 1080, height: 1080 });
  }
  ```
  > Uses English claim text (fonts for Devanagari need a font file; add Noto Sans Devanagari via `fonts` option later only if time allows).

- [ ] **11.2** Add to result page (top box): `<a href={`/api/card/${r.id}`} download className="underline">⬇ Download card to share</a>`.

### ✅ CHECKPOINT M11
Open `https://<your-app>.vercel.app/api/card/<id>` → PNG shows verdict, 2–4 claims, sources, link. Download on phone → share to a WhatsApp chat → looks readable. Commit.

---

## M12 — Voice reply (TTS)

**Produces:** `tts(text: str, language: str) -> bytes` (mp3; `b""` if the voice service fails, so the text reply is still sent).

- [ ] **12.1 `api/voice.py`**
  ```python
  import logging

  log = logging.getLogger("fwdcheck.voice")

  VOICES = {"hi": "hi-IN-SwaraNeural", "hinglish": "hi-IN-SwaraNeural", "mr": "mr-IN-AarohiNeural",
            "en": "en-IN-NeerjaNeural"}

  async def tts(text: str, language: str) -> bytes:
      try:
          import edge_tts
          buf = b""
          async for chunk in edge_tts.Communicate(text[:1500], VOICES.get(language, VOICES["en"])).stream():
              if chunk["type"] == "audio":
                  buf += chunk["data"]
          return buf
      except Exception as e:
          log.warning("tts failed: %s", e)
          return b""
  ```
- [ ] **12.2 Route** in `main.py`:
  ```python
  from fastapi.responses import Response
  import voice

  @app.get("/check/{check_id}/voice.mp3")
  async def get_voice(check_id: str):
      r = db.get(check_id)
      if not r: raise HTTPException(404, "Not found")
      return Response(await voice.tts(r["summary"], r["language"]), media_type="audio/mpeg")
  ```
- [ ] **12.3 Website:** in result page top box add `<audio controls src={`${API}/check/${r.id}/voice.mp3`} className="mt-2 w-full" />`.

### ✅ CHECKPOINT M12
Send `note.ogg` (Hindi voice) through the website → result summary is in Hindi → play button speaks Hindi. Try a Marathi text forward → Marathi voice. Commit.

---

## M13 — Telegram bot

- [ ] **13.1** Telegram → @BotFather → `/newbot` → copy token into `TELEGRAM_BOT_TOKEN`; set `TELEGRAM_SECRET` to any random string. Add both to Render env.
- [ ] **13.2 `api/telegram_bot.py`**
  ```python
  import os, httpx
  import pipeline, voice
  from llm import LLMError

  T = os.environ.get("TELEGRAM_BOT_TOKEN", "")
  BASE = f"https://api.telegram.org/bot{T}"

  def format_reply(r: dict, link: str) -> str:
      lines = [r["summary"], ""]
      for c in r["claims"]:
          emoji = {"VERIFIED": "🟢", "FALSE": "🔴", "OUTDATED": "⏳", "PARTLY_TRUE": "🟠"}.get(c["verdict"], "⚪")
          lines.append(f"{emoji} {c['claim']}")
      if r["red_flags"]:
          lines.append("\n🚩 " + ", ".join(sorted({f['type'].replace('_', ' ') for f in r["red_flags"]})))
      lines.append(f"\n🔗 Full proof + share card: {link}")
      return "\n".join(lines)[:4000]

  async def _download(c: httpx.AsyncClient, file_id: str) -> bytes:
      path = (await c.get(f"{BASE}/getFile", params={"file_id": file_id})).json()["result"]["file_path"]
      return (await c.get(f"https://api.telegram.org/file/bot{T}/{path}")).content

  async def handle_update(update: dict):
      msg = update.get("message") or {}
      chat = msg.get("chat", {}).get("id")
      if not chat: return
      async with httpx.AsyncClient(timeout=60) as c:
          await c.post(f"{BASE}/sendMessage", json={"chat_id": chat, "text": "🔍 Checking… about 15 seconds"})
          try:
              text, data, mime = msg.get("text") or msg.get("caption"), None, None
              if "photo" in msg:   data, mime = await _download(c, msg["photo"][-1]["file_id"]), "image/jpeg"
              elif "voice" in msg: data, mime = await _download(c, msg["voice"]["file_id"]), "audio/ogg"
              elif "document" in msg and msg["document"].get("mime_type") == "application/pdf":
                  data, mime = await _download(c, msg["document"]["file_id"]), "application/pdf"
              if text == "/start":
                  await c.post(f"{BASE}/sendMessage", json={"chat_id": chat, "text":
                      "Namaste 🙏 Forward me any message, screenshot, voice note, PDF or link and I'll check if it's true."})
                  return
              r = await pipeline.run_check(text=None if data else text, file=data, mime=mime, channel="telegram")
              link = f"{os.environ['WEB_ORIGIN']}/r/{r['id']}"
              await c.post(f"{BASE}/sendMessage", json={"chat_id": chat, "text": format_reply(r, link)})
              await c.post(f"{BASE}/sendAudio", data={"chat_id": chat},
                           files={"audio": ("fwdcheck.mp3", await voice.tts(r["summary"], r["language"]), "audio/mpeg")})
              await c.post(f"{BASE}/sendPhoto", json={"chat_id": chat, "photo": f"{os.environ['WEB_ORIGIN']}/api/card/{r['id']}"})
          except (LLMError, ValueError):
              await c.post(f"{BASE}/sendMessage", json={"chat_id": chat, "text": "Sorry, I couldn't check this right now. Please try again in a minute."})
  ```
  > Telegram IDs are not stored anywhere (only `channel="telegram"`), so the privacy rule holds.
- [ ] **13.3 Route** in `main.py`:
  ```python
  from fastapi import Request, BackgroundTasks
  import telegram_bot

  @app.post("/telegram/webhook")
  async def tg_webhook(req: Request, bg: BackgroundTasks):
      if req.headers.get("X-Telegram-Bot-Api-Secret-Token") != os.environ.get("TELEGRAM_SECRET"):
          raise HTTPException(403)
      bg.add_task(telegram_bot.handle_update, await req.json())
      return {"ok": True}                  # answer Telegram instantly; work happens in background
  ```
- [ ] **13.4 Register webhook** (once, after deploying to Render):
  ```bash
  curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-service>.onrender.com/telegram/webhook&secret_token=<TELEGRAM_SECRET>"
  ```
  For local testing instead: `cloudflared tunnel --url http://localhost:8000` and use the printed `trycloudflare.com` URL.

### ✅ CHECKPOINT M13
On your phone, open the bot → `/start` → welcome message. Forward the fake message → "Checking…" → text verdict + Hindi voice + card image. Send a voice note → works. Send a screenshot → works. `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"` shows no `last_error_message`. Commit.

---

## M14 — WhatsApp bot (Meta Cloud API test number)

- [ ] **14.1 Meta setup:** developers.facebook.com → *Create App* → type *Business* → add *WhatsApp* product → *API Setup*: note **Phone number ID**, add up to **5 recipient phone numbers** (your team) and verify each with the OTP. Business settings → *System users* → create admin system user → *Generate token* with `whatsapp_business_messaging` + `whatsapp_business_management` → this permanent token = `WA_TOKEN`. Pick any string as `WA_VERIFY_TOKEN`. Add all to Render env.
- [ ] **14.2 `api/whatsapp_bot.py`**
  ```python
  import os, httpx
  import pipeline, voice
  from llm import LLMError
  from telegram_bot import format_reply      # same text format

  G = f"https://graph.facebook.com/{os.environ.get('GRAPH_VERSION', 'v23.0')}"
  H = lambda: {"Authorization": f"Bearer {os.environ['WA_TOKEN']}"}
  PID = lambda: os.environ["WA_PHONE_NUMBER_ID"]

  async def _send(c, to, payload):
      await c.post(f"{G}/{PID()}/messages", headers=H(), json={"messaging_product": "whatsapp", "to": to, **payload})

  async def _media(c, media_id) -> tuple[bytes, str]:
      meta = (await c.get(f"{G}/{media_id}", headers=H())).json()
      return (await c.get(meta["url"], headers=H())).content, meta["mime_type"].split(";")[0]

  async def handle(body: dict):
      try:
          msg = body["entry"][0]["changes"][0]["value"]["messages"][0]
      except (KeyError, IndexError):
          return                                    # status updates (delivered/read) — ignore
      to, kind = msg["from"], msg["type"]
      async with httpx.AsyncClient(timeout=60) as c:
          await _send(c, to, {"type": "text", "text": {"body": "🔍 Checking… about 15 seconds"}})
          try:
              text = data = mime = None
              if kind == "text": text = msg["text"]["body"]
              elif kind in ("image", "audio", "document"): data, mime = await _media(c, msg[kind]["id"])
              else:
                  await _send(c, to, {"type": "text", "text": {"body": "Please send text, a screenshot, a voice note, a PDF or a link."}})
                  return
              r = await pipeline.run_check(text=text, file=data, mime=mime, channel="whatsapp")
              link = f"{os.environ['WEB_ORIGIN']}/r/{r['id']}"
              await _send(c, to, {"type": "text", "text": {"body": format_reply(r, link)}})
              audio = await voice.tts(r["summary"], r["language"])
              up = await c.post(f"{G}/{PID()}/media", headers=H(), data={"messaging_product": "whatsapp", "type": "audio/mpeg"},
                                files={"file": ("reply.mp3", audio, "audio/mpeg")})
              await _send(c, to, {"type": "audio", "audio": {"id": up.json()["id"]}})
              await _send(c, to, {"type": "image", "image": {"link": f"{os.environ['WEB_ORIGIN']}/api/card/{r['id']}"}})
          except (LLMError, ValueError):
              await _send(c, to, {"type": "text", "text": {"body": "Sorry, I couldn't check this right now. Please try again in a minute."}})
  ```
- [ ] **14.3 Routes** in `main.py`:
  ```python
  from fastapi.responses import PlainTextResponse
  import whatsapp_bot

  @app.get("/whatsapp/webhook")
  def wa_verify(req: Request):
      p = req.query_params
      if p.get("hub.mode") == "subscribe" and p.get("hub.verify_token") == os.environ.get("WA_VERIFY_TOKEN"):
          return PlainTextResponse(p.get("hub.challenge"))
      raise HTTPException(403)

  @app.post("/whatsapp/webhook")
  async def wa_webhook(req: Request, bg: BackgroundTasks):
      bg.add_task(whatsapp_bot.handle, await req.json())
      return {"ok": True}
  ```
- [ ] **14.4** Meta → WhatsApp → *Configuration* → Callback URL `https://<your-service>.onrender.com/whatsapp/webhook`, Verify token = `WA_VERIFY_TOKEN` → *Verify and save* → subscribe to the **messages** field.
- [ ] **14.5** From each verified phone, send "hi" to the test number first (opens the free 24 h reply window).

### ✅ CHECKPOINT M14
From a verified phone: forward the fake → "Checking…" → verdict text + voice note + card. Repeat with a screenshot, a Hindi voice note and a PDF. Render logs show no errors. If the voice note doesn't arrive, check that the `/media` upload returned an `id` (log it). Commit.

---

## M15 — PWA + Android "Share → FwdCheck"

- [ ] **15.1 `web/public/manifest.json`**
  ```json
  {
    "name": "FwdCheck",
    "short_name": "FwdCheck",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#ffffff",
    "theme_color": "#000000",
    "icons": [
      { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
      { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
    ],
    "share_target": {
      "action": "/share",
      "method": "POST",
      "enctype": "multipart/form-data",
      "params": {
        "title": "title", "text": "text", "url": "url",
        "files": [{ "name": "file", "accept": ["image/*", "audio/*", "application/pdf"] }]
      }
    }
  }
  ```
  Make two square PNG icons (any free icon maker) → `icon-192.png`, `icon-512.png`.
- [ ] **15.2 `web/public/sw.js`** (minimal; makes the app installable):
  ```js
  self.addEventListener("fetch", () => {});
  ```
  Register it + link the manifest in `web/app/layout.tsx`: add `export const metadata = { ..., manifest: "/manifest.json" }` and in the body:
  ```tsx
  <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js')` }} />
  ```
- [ ] **15.3 `web/app/share/route.ts`** — receives the share, forwards to backend, redirects to result
  ```ts
  import { API } from "@/lib/api";

  export async function POST(req: Request) {
    const inFd = await req.formData();
    const fd = new FormData();
    const text = [inFd.get("text"), inFd.get("url")].filter(Boolean).join(" ").trim();
    if (text) fd.append("text", text);
    const file = inFd.get("file");
    if (file instanceof File && file.size > 0) fd.append("file", file);
    const r = await fetch(`${API}/check`, { method: "POST", body: fd });
    if (!r.ok) return Response.redirect(new URL("/?error=1", req.url), 303);
    const j = await r.json();
    return Response.redirect(new URL(`/r/${j.id}`, req.url), 303);
  }
  ```

### ✅ CHECKPOINT M15
On an **Android** phone, open the Vercel URL in Chrome → menu → *Install app*. Open WhatsApp → long-press a message → Share → **FwdCheck** appears → tap → after ~15 s the result page opens. Repeat by sharing an image. Commit.

---

## M16 — Trending dashboard

- [ ] **16.1 `web/app/trending/page.tsx`**
  ```tsx
  import { API, STYLE } from "@/lib/api";
  import Link from "next/link";

  export const revalidate = 300;   // refresh every 5 min

  export default async function Trending() {
    const rows: { id: string; raw_text: string; overall: string; hit_count: number }[] =
      await fetch(`${API}/trending`, { next: { revalidate: 300 } }).then(r => r.json()).catch(() => []);
    return (
      <main className="mx-auto max-w-2xl p-4">
        <h1 className="text-2xl font-bold">🔥 Fakes going around this week</h1>
        <ol className="mt-4 space-y-3">
          {rows.map((r, i) => {
            const s = STYLE[r.overall] ?? STYLE.UNVERIFIABLE;
            return (
              <li key={r.id} className={`rounded-lg border p-3 ${s.cls}`}>
                <Link href={`/r/${r.id}`} className="block">
                  <b>#{i + 1} {s.emoji} {s.label}</b> · checked {r.hit_count}×
                  <p className="mt-1 line-clamp-2 text-sm">{r.raw_text}</p>
                </Link>
              </li>
            );
          })}
        </ol>
      </main>
    );
  }
  ```
- [ ] **16.2** Add a "🔥 Trending" link on the home page.

### ✅ CHECKPOINT M16
Check 3 different forwards, one of them 3 times → `/trending` lists them with the repeated one on top showing "checked 3×". Commit.

---

## M17 — Eval set + accuracy number

- [ ] **17.1** Collect **30 real forwards** with known answers from PIB Fact Check, Alt News, BOOM, Factly (mix: 10 health, 10 schemes/money, 5 old news, 5 true news). Save `api/tests/eval/forwards.jsonl`, one per line:
  ```json
  {"text": "Drinking hot water with lemon cures cancer, WHO confirms", "expected": "FALSE", "source": "https://..."}
  ```
  `expected` uses the overall labels: `TRUE | FALSE | MISLEADING | OUTDATED | PARTLY_TRUE | UNVERIFIABLE`.
- [ ] **17.2 `api/tests/eval/run_eval.py`**
  ```python
  import asyncio, json, sys, time
  from pathlib import Path
  sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
  from dotenv import load_dotenv; load_dotenv()
  import pipeline

  # "close enough" groups: a FALSE expected and MISLEADING answer both mean "don't forward"
  GROUP = {"FALSE": "bad", "MISLEADING": "bad", "OUTDATED": "old", "TRUE": "good",
           "PARTLY_TRUE": "mixed", "UNVERIFIABLE": "unknown", "NO_CLAIMS": "unknown"}

  async def main():
      rows = [json.loads(l) for l in open(Path(__file__).parent / "forwards.jsonl", encoding="utf-8") if l.strip()]
      exact = grouped = 0
      for i, row in enumerate(rows, 1):
          r = await pipeline.run_check(text=row["text"], channel="eval")
          exact += r["overall"] == row["expected"]
          grouped += GROUP[r["overall"]] == GROUP[row["expected"]]
          print(f'{i:02d} expected={row["expected"]:12} got={r["overall"]:12} {"✅" if GROUP[r["overall"]] == GROUP[row["expected"]] else "❌"} {row["text"][:60]}')
          time.sleep(8)          # stay under free-tier requests/minute
      print(f"\nExact: {exact}/{len(rows)}  ·  Same meaning: {grouped}/{len(rows)} = {100*grouped//len(rows)}%")

  asyncio.run(main())
  ```

### ✅ CHECKPOINT M17
```bash
cd api && python tests/eval/run_eval.py
```
Pass = it finishes and prints a percentage. Look at every ❌, fix prompts or the allowlist, rerun. Put the final "Same meaning" % and 2 honest failure examples in the PPT. Commit.

---

## M18 — Demo hardening + Round-2 pivot drill

- [ ] **18.1 Demo checklist (run before submitting and again before every demo)**
  - [ ] cron-job.org shows green pings for the last 24 h
  - [ ] Supabase project not paused
  - [ ] AI Studio quota page: demo key has used < 50 today
  - [ ] Pre-check the 3 demo forwards (text, screenshot, Hindi voice) → they now answer from cache instantly
  - [ ] Telegram bot + WhatsApp bot reply on 2 different phones
  - [ ] Website opens on phone over mobile data (not venue Wi-Fi)
  - [ ] Demo video downloaded offline on 2 laptops (backup if internet dies)
  - [ ] `check_keys.py` all ✅
- [ ] **18.2 Pivot drill (after submission):** pick a fake GenAI problem (e.g. "explain government circulars in Hindi"). Copy `api/` → swap only `extract.py` + `judge.py` prompts and the `sources.py` allowlist. Write down what was slow.
- [ ] **18.3** Ask the organisers whether starter code may be reused at the event; plan Git check-ins accordingly.

### ✅ CHECKPOINT M18 (final)
A teammate who didn't build it can: open the website, forward a fake on WhatsApp and Telegram, share from Android, see the trending page, and download a card. All in under 2 minutes, without help.

---

## M19 — Submission: prototype + PPT

- [ ] **19.1 Final deploy check:** Vercel and Render both on the latest commit; run the M18 checklist once more.
- [ ] **19.2 Demo video (60–90 s, phone screen recording):** forward the fake on WhatsApp → reply with text + Hindi voice + card → open the full-proof link (Claim X-Ray, evidence, timeline) → Android "Share → FwdCheck" → trending page. Upload to YouTube (unlisted) or Google Drive (anyone with link).
- [ ] **19.3 README.md** in the repo root: one-line pitch, screenshot, live links (website, Telegram bot), architecture diagram from PLAN.md §5, how to run locally, the free stack, accuracy % from M17.
- [ ] **19.4 PPT** per PLAN.md §8. Add a **"Live prototype" slide** with:
  - Website URL + QR code
  - Telegram bot link (`t.me/<your_bot>`) + QR, so judges can test it themselves
  - WhatsApp: "demo in video" (test number only reaches verified numbers)
  - GitHub repo link + demo video link
  - Accuracy % on 30 real forwards
- [ ] **19.5 Make the repo public** (or add the organisers as collaborators) and double-check no `.env`/keys are committed: `git log -p | grep -i "api_key\|token"` returns nothing secret.
- [ ] **19.6 Submit on Unstop:** PPT (PDF export too) + prototype links.

### ✅ CHECKPOINT M19
Open every link in the PPT from a phone on mobile data, logged out: website works, Telegram bot replies, video plays, GitHub repo opens, no secrets in the repo.

---

## Who does what (4 people)

| Person | Modules |
|---|---|
| A — AI/pipeline | M2, M4, M6, M7, M17 |
| B — Backend/integrations | M0 (keys), M1, M3, M5, M8, M9, M13, M14 |
| C — Frontend | M10, M11, M15, M16 (can start M10 in parallel with mock JSON: save one M8 result to `web/mock.json`) |
| D — Pitch/research/testing | Fixtures (M3.1), eval set (M17.1), PPT, demo video, M12, M18 checklist |

## When something breaks — where to look

| Symptom | Check |
|---|---|
| 503 "AI service busy" | AI Studio quota page; Groq console; `check_keys.py` |
| All claims UNVERIFIABLE | Print M5 evidence: empty? → search keys/credits; non-empty? → print judge output before guardrail (quotes not copied exactly → tighten prompt) |
| Website "Something went wrong" | Browser DevTools → Network → `/check` response; CORS error → fix `WEB_ORIGIN` on Render |
| Bot silent | Render logs; Telegram `getWebhookInfo`; Meta webhook *Test* button; recipient number verified? |
| First request takes ~1 min | Render was asleep → cron-job.org job disabled? |
| Supabase errors | Project paused → dashboard → *Restore* |
