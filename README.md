# FwdCheck: Is this forward true?

> Forward it to us before you forward it to family.

FwdCheck checks WhatsApp forwards (**text, screenshots, voice notes, PDFs or links**) against trusted, dated sources and replies **claim by claim**, in the user's language, with the proof.

Hack on Track 2026 · Team VisionX · Domain: GenAI · PS 3 "Is This Forward True?"

| | |
|---|---|
| **Website / app** | [fwd-check.vercel.app](https://fwd-check.vercel.app) |
| **API** | [fwdcheck.onrender.com](https://fwdcheck.onrender.com/health) · interactive docs at [`/docs`](https://fwdcheck.onrender.com/docs) |
| **Telegram bot** | [@FwdCheck_AI_Bot](https://t.me/FwdCheck_AI_Bot) |

The API runs on Render's free tier: after about 15 idle minutes it sleeps, and the next request takes ~30 s to wake it.

## What makes it different

| Feature | What it does |
|---|---|
| 🔬 **Claim X-Ray** | Splits a forward into separate claims; each gets its own verdict: Verified · False · Misleading · Outdated · Partly true · Cannot be confirmed |
| ⏳ **Time-Travel Check** | Catches old news shared as new by comparing the claim with source publish dates |
| 🎙️ **Voice in, voice out** | Send a Hindi/Marathi voice note, get a voice reply in the same language |
| 🖼️ **Rebuttal Card** | Shareable image with the verdict and sources to post back in the family group |
| 📎 **No source, no verdict** | Every quote is checked against the real source page in code; unproven claims become "Cannot be confirmed" |
| 🚩 **Manipulation Radar** | Flags urgency, fear, chain-forward, fake authority, miracle claims, suspicious links |
| 🔥 **Trending fakes + instant answers** | Repeat forwards answered from cache in under a second; board of the week's most-checked fakes (only False / Misleading / Outdated / Partly true, so personal messages never show up) |
| 📲 **Share straight from WhatsApp** | Installable app (PWA): Android "Share → FwdCheck" opens a live "Checking…" screen, and results go back to the group in one tap |

## How it works

```
input (website / Android share / Telegram / WhatsApp)
  → gate: rate limit, webhook signature check
  → read it: PyMuPDF for text PDFs, trafilatura for links, Gemini for screenshots, voice notes, scanned PDFs
  → already checked? (SHA-256 fingerprint in MongoDB) → instant answer
  → split into claims + manipulation radar                       (AI call 1)
  → evidence: Google Fact Check API → trusted-site search (Tavily → Serper → DuckDuckGo) → read pages
  → verdict per claim, with quotes + publish dates                (AI call 2)
  → guardrail: drop quotes not found on the source page
  → reply: short text in the user's language + voice note + rebuttal card + full report link
```

If Gemini is overloaded the API retries (after 8 s, then 20 s) and then falls back to Groq.

## Tech stack (100% free tier)

| Layer | Tools |
|---|---|
| Website | Next.js 16, React 19, TypeScript, Tailwind CSS v4 on Vercel (`web/`) |
| Motion | Three.js (forward-network globe), GSAP + ScrollTrigger + SplitText, Lenis smooth scroll; all motion is off for users with "reduce motion" set |
| App | PWA with Web Share Target and a service worker |
| Backend | Python, FastAPI, Uvicorn, httpx on Render (`api/`) |
| AI | Google Gemini 3.1 Flash-Lite; Groq `openai/gpt-oss-120b` as backup |
| Evidence | Google Fact Check Tools API, Tavily / Serper / DuckDuckGo, trafilatura, PyMuPDF |
| Database | MongoDB Atlas (free M0): results, repeat-forward cache, trending |
| Voice | edge-tts neural voices (Hindi, Marathi, English) |
| Bots | Telegram Bot API; WhatsApp via the Twilio Sandbox or the Meta Cloud API |
| Tests | pytest (72 tests, including live reads of a real screenshot, PDFs and a voice note) |

## Use it

**On a laptop:** open [fwd-check.vercel.app](https://fwd-check.vercel.app), then paste the forward, paste a link, or drop a screenshot, PDF or voice note on the box.

**On an Android phone** (checks straight from WhatsApp):
1. Open [fwd-check.vercel.app](https://fwd-check.vercel.app) in Chrome → ⋮ menu → **Add to Home screen / Install app**.
2. In WhatsApp, long-press a forward (text, photo, voice note or PDF) → **Share** → **FwdCheck**.
3. The app opens on a live "Checking…" screen and shows the verdict. Tap **Send to the group** to post the answer back to the group.

**On an iPhone:** iOS doesn't let web apps appear in the Share menu, so use the website (copy and paste, or upload) or the Telegram bot.

**On Telegram:** message [@FwdCheck_AI_Bot](https://t.me/FwdCheck_AI_Bot), or forward any message to it.

## Set up locally

### 1. Prerequisites

- **Python 3.10+** and **Node.js 20.9+** (with npm)
- Free accounts for the keys below. Only Gemini is required to run; the rest add features and fall back gracefully when missing.

| Key | Where to get it (free) | Needed for |
|---|---|---|
| `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | **Required.** Reading media, claims, verdicts |
| `GROQ_API_KEY` | [console.groq.com/keys](https://console.groq.com/keys) | Backup AI when Gemini is busy |
| `FACTCHECK_API_KEY` | [Google Cloud console](https://console.cloud.google.com/apis/library/factchecktools.googleapis.com): enable *Fact Check Tools API*, then *Credentials → Create API key* | Existing fact-checks |
| `TAVILY_API_KEY` | [app.tavily.com](https://app.tavily.com) | Web search (first choice) |
| `SERPER_API_KEY` | [serper.dev](https://serper.dev) | Web search (second choice; DuckDuckGo needs no key and is the last fallback) |
| `MONGODB_URI` | [MongoDB Atlas](https://cloud.mongodb.com): free M0 cluster → *Connect → Drivers*; allow your IP (or `0.0.0.0/0` for Render) under *Network Access* | Saving results, cache, trending. Without it results live in memory and vanish on restart |
| `TELEGRAM_BOT_TOKEN` | [@BotFather](https://t.me/BotFather) → `/newbot` | Telegram bot |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | [console.twilio.com](https://console.twilio.com) home page | WhatsApp via the Twilio Sandbox |
| `WA_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_APP_SECRET` | [developers.facebook.com](https://developers.facebook.com) → your app → WhatsApp → API Setup | WhatsApp via the Meta Cloud API (needs business verification to message the public) |

### 2. Backend (`api/`)

```bash
cd api
python -m pip install -r requirements.txt
cp .env.example .env
```

On Windows Command Prompt use `copy .env.example .env` instead of `cp`. Then open `api/.env` and fill in:

| Variable | Value |
|---|---|
| `GEMINI_API_KEY` | your key |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` |
| `WEB_ORIGIN` | `http://localhost:3000` (comma-separate several; the first is used for links in bot replies) |
| `GROQ_API_KEY`, `GROQ_MODEL` | your key, `openai/gpt-oss-120b` |
| `FACTCHECK_API_KEY`, `TAVILY_API_KEY`, `SERPER_API_KEY`, `MONGODB_URI` | from the table above |
| `CHECKS_PER_MINUTE` | optional, checks per IP per minute (default `6`) |
| Bot variables | only if you run the bots, see [Bots](#bots) |

Check every key, then start the API:

```bash
python check_keys.py
python -m uvicorn main:app --reload --port 8000
```

`check_keys.py` prints `OK` for each working service and `not set yet` for any you skipped. The API is now at http://localhost:8000; try http://localhost:8000/docs. MongoDB indexes are created automatically on start.

### 3. Website (`web/`)

In a second terminal:

```bash
cd web
npm install
echo NEXT_PUBLIC_API_URL=http://localhost:8000 > .env.local
npm run dev
```

Open http://localhost:3000. Optional `NEXT_PUBLIC_SITE_URL` sets the public address printed on share cards (on Vercel it is detected automatically).

The Android Share target only works on the deployed HTTPS site, not on localhost.

### 4. Tests

```bash
cd api
python -m pytest
python tests/eval/run_eval.py
```

`pytest` runs the offline tests; the live tests (real Gemini reads of `tests/fixtures/`: a Marathi screenshot, a text PDF, a scanned PDF, a voice note) run automatically when `GEMINI_API_KEY` is set. `run_eval.py` measures accuracy on the known forwards in `tests/eval/forwards.jsonl`.

Lint the website with `npm run lint` inside `web/`.

## Deploy (free)

### API on Render

New **Web Service** from this repo:

| Setting | Value |
|---|---|
| Root Directory | `api` |
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Instance type | Free |
| Environment | the same variables as `api/.env`, with `WEB_ORIGIN=https://<your-site>.vercel.app` |

Optional: a free [cron-job.org](https://cron-job.org) job that calls `https://<your-api>.onrender.com/health` every 10 minutes keeps it from sleeping.

### Website on Vercel

Import the repo, set **Root Directory** to `web` (framework: Next.js), and add the environment variable `NEXT_PUBLIC_API_URL=https://<your-api>.onrender.com`. Every push to `main` redeploys both Vercel and Render.

### Bots

**Telegram:** set `TELEGRAM_BOT_TOKEN` and a random `TELEGRAM_SECRET` on Render, then register the webhook once by opening:

```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<your-api>.onrender.com/telegram/webhook&secret_token=<TELEGRAM_SECRET>
```

**WhatsApp (Twilio Sandbox):** set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_WHATSAPP_FROM` (your sandbox number, e.g. `whatsapp:+14155238886`) on Render. In the Twilio console go to *Messaging → Try it out → Send a WhatsApp message → Sandbox settings* and set **When a message comes in** to `https://<your-api>.onrender.com/twilio/webhook` (POST). Each tester first sends the sandbox's `join <code>` message. Every request is checked against Twilio's signature. The free trial includes a limited number of messages, and some newer trial accounts must upgrade before the sandbox webhook can be set.

**WhatsApp (Meta Cloud API):** set `WA_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_APP_SECRET`, a random `WA_VERIFY_TOKEN` and optionally `GRAPH_VERSION` (default `v23.0`). In the Meta app's WhatsApp → Configuration, use callback URL `https://<your-api>.onrender.com/whatsapp/webhook` with the same verify token and subscribe to `messages`.

## API

| Method | Path | What it does |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `POST` | `/check` | Form fields `text`, `url` or `file` (image, audio or PDF, max 15 MB) → full result |
| `GET` | `/check/{id}` | A saved result |
| `GET` | `/check/{id}/voice.mp3` | Spoken summary in the result's language |
| `GET` | `/trending` | Most-checked fakes this week |
| `POST` | `/telegram/webhook` | Telegram updates (secret-token checked) |
| `GET`, `POST` | `/whatsapp/webhook` | Meta verification and messages (signature checked) |
| `POST` | `/twilio/webhook` | Twilio WhatsApp messages (signature checked) |

## Project structure

```
api/                 FastAPI backend
  main.py            routes, CORS, webhooks
  pipeline.py        ingest → cache → extract → evidence → judge → guardrail → save
  ingest.py          text, links, PDFs, images, voice notes → text
  extract.py         claims + red flags (AI call 1)      radar.py      manipulation rules
  sources.py         fact-check API, web search, trusted-site tiers, page reading
  judge.py           verdict per claim (AI call 2)       guardrail.py  quote-on-page check
  llm.py             Gemini with retries + Groq fallback
  db.py              MongoDB (or in-memory) storage, fingerprint cache, trending
  voice.py           edge-tts voice replies
  telegram_bot.py, twilio_bot.py, whatsapp_bot.py
  check_keys.py      verifies every configured key
  tests/             pytest suite, fixtures, accuracy eval
web/                 Next.js website + PWA
  app/               pages: home, /r/[id] result, /trending, /share (+ /share/checking), /api/card/[id] share image
  components/        globe (Three.js), Claim X-Ray demo, pipeline, motion layer, progress steps
  lib/api.ts         API client and verdict styles
  public/            PWA manifest, service worker (share target), icons
```
