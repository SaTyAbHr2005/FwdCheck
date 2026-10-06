# FwdCheck — Is this forward true?

> Forward it to us before you forward it to family.

FwdCheck checks WhatsApp forwards — **text, screenshots, voice notes, PDFs or links** — against trusted, dated sources and replies **claim by claim**, in the user's language, with the proof.

Hack on Track 2026 · Domain: GenAI · PS 3 "Is This Forward True?"

## What makes it different

| Feature | What it does |
|---|---|
| 🔬 **Claim X-Ray** | Splits a forward into separate claims; each gets its own verdict: Verified · False · Outdated · Partly true · Cannot be confirmed |
| ⏳ **Time-Travel Check** | Catches old news shared as new by comparing the claim with source publish dates |
| 🎙️ **Voice in, voice out** | Send a Hindi/Marathi voice note, get a voice reply in the same language |
| 🖼️ **Rebuttal Card** | Shareable image with the verdict and sources to post back in the family group |
| 📎 **No source, no verdict** | Every quote is checked against the real source page in code; unproven claims become "Cannot be confirmed" |
| 🚩 **Manipulation Radar** | Flags urgency, fear, chain-forward, fake authority, miracle claims, suspicious links |
| 🔥 **Trending fakes + instant answers** | Repeat forwards answered from cache; dashboard of the most-checked fakes |

## How it works

```
input (WhatsApp / Telegram / website / Android share)
  → read it (Gemini reads screenshots, voice notes, PDFs)
  → already checked? → instant answer
  → split into claims + manipulation radar           (AI call 1)
  → evidence: Google Fact Check API → trusted-site search → read pages
  → verdict per claim, with quotes + dates            (AI call 2)
  → guardrail: drop quotes not found on the source page
  → reply: simple text in user's language + voice note + card + full report link
```

## Tech stack (100% free tier)

- **Backend:** Python FastAPI on Render — `api/`
- **Website:** Next.js on Vercel — `web/`
- **AI:** Google Gemini Flash-Lite (Groq as backup)
- **Evidence:** Google Fact Check Tools API, Tavily / Serper / DuckDuckGo, trafilatura
- **Database:** MongoDB Atlas (free M0) — repeat forwards matched by a normalised-text fingerprint
- **Voice:** edge-tts neural voices (Hindi, Marathi, English)
- **Bots:** WhatsApp Cloud API, Telegram Bot API

## Run locally

**Backend**
```bash
cd api
python -m pip install -r requirements.txt
cp .env.example .env     # then fill in your free API keys
python check_keys.py     # every service should say OK
python -m uvicorn main:app --reload --port 8000
```
Database: create a free MongoDB Atlas M0 cluster and put its connection string in `MONGODB_URI` (indexes are created automatically).

**Website**
```bash
cd web
npm install
echo NEXT_PUBLIC_API_URL=http://localhost:8000 > .env.local
npm run dev
```
Open http://localhost:3000

**Tests**
```bash
cd api
python -m pytest               # offline tests; live tests run automatically when keys are set
python tests/eval/run_eval.py  # accuracy on known forwards
```

## Project structure

```
api/   FastAPI backend: ingest → extract → sources → judge → guardrail → pipeline, bots, voice
web/   Next.js website: check form, claim x-ray result, rebuttal card, trending, PWA share target
```
