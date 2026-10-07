# FwdCheck — Is this forward true?

> Forward it to us before you forward it to family.

FwdCheck checks WhatsApp forwards — **text, screenshots, voice notes, PDFs or links** — against trusted, dated sources and replies **claim by claim**, in the user's language, with the proof.

Hack on Track 2026 · Domain: GenAI · PS 3 "Is This Forward True?"

**Live:** [fwd-check.vercel.app](https://fwd-check.vercel.app) · API [fwdcheck.onrender.com](https://fwdcheck.onrender.com/health) (free tier: the first request after a quiet spell takes ~30 s to wake up)

## What makes it different

| Feature | What it does |
|---|---|
| 🔬 **Claim X-Ray** | Splits a forward into separate claims; each gets its own verdict: Verified · False · Outdated · Partly true · Cannot be confirmed |
| ⏳ **Time-Travel Check** | Catches old news shared as new by comparing the claim with source publish dates |
| 🎙️ **Voice in, voice out** | Send a Hindi/Marathi voice note, get a voice reply in the same language |
| 🖼️ **Rebuttal Card** | Shareable image with the verdict and sources to post back in the family group |
| 📎 **No source, no verdict** | Every quote is checked against the real source page in code; unproven claims become "Cannot be confirmed" |
| 🚩 **Manipulation Radar** | Flags urgency, fear, chain-forward, fake authority, miracle claims, suspicious links |
| 🔥 **Trending fakes + instant answers** | Repeat forwards answered from cache; board of the week's most-checked fakes (only False / Misleading / Outdated / Partly true, so personal messages never show up) |
| 📲 **Share straight from WhatsApp** | Installable app (PWA): Android "Share → FwdCheck" opens a live "Checking…" screen, and results can be sent back to the group in one tap |

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
- **Website:** Next.js 16 + React 19 + Tailwind CSS v4 on Vercel — `web/`
- **Motion:** Three.js (forward-network globe), GSAP + ScrollTrigger + SplitText (scroll-driven Claim X-Ray demo, sliding pipeline), Lenis smooth scroll; all motion is off for users with "reduce motion" set
- **AI:** Google Gemini Flash-Lite (Groq as backup)
- **Evidence:** Google Fact Check Tools API, Tavily / Serper / DuckDuckGo, trafilatura
- **Database:** MongoDB Atlas (free M0) — repeat forwards matched by a normalised-text fingerprint
- **Voice:** edge-tts neural voices (Hindi, Marathi, English)
- **Bots:** Telegram Bot API; WhatsApp via the Twilio Sandbox (no business verification needed; Meta Cloud API adapter also included)

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

Optional `NEXT_PUBLIC_SITE_URL` sets the public address printed on share cards (on Vercel it is detected automatically).

**Tests**
```bash
cd api
python -m pytest               # offline tests; live tests run automatically when keys are set
python tests/eval/run_eval.py  # accuracy on known forwards
```

## Project structure

```
api/   FastAPI backend: ingest → extract → sources → judge → guardrail → pipeline, bots, voice
web/   Next.js website
  app/         pages: home, /r/[id] result, /trending, /share (+ /share/checking), /api/card/[id] share image
  components/  globe (Three.js), Claim X-Ray demo, pipeline, motion layer, progress steps
  public/      PWA manifest, service worker (share target), icons
```
