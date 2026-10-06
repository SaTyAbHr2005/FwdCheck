# FwdCheck — "Is This Forward True?" (PS 3, GenAI)

Hack on Track 2026 · FCRIT Vashi · Plan v1 (5 Oct 2026)

---

## 0. What the PS actually asks (from the PDF, page 4)

Build an AI system that:

| Requirement in PS | What it means for us |
|---|---|
| Verify claims from **WhatsApp messages, screenshots, voice notes, PDFs, URLs** | 5 input types → all normalized to text |
| Check them **against reliable sources** | Retrieval from trusted sources, not "LLM's opinion" |
| **Show the supporting evidence** | Every verdict carries quotes + links + dates |
| **Explain in simple language** | Plain-language explanation, in the user's language |
| 5 labels: **verified, false, outdated, partly supported, cannot be confirmed** | Exactly these 5 verdicts, per claim |
| "reader isn't comfortable in English" | Hindi/Marathi/other Indian languages, voice reply |
| "bare true/false doesn't help… what exactly is wrong, and why" | Claim-by-claim breakdown, highlight the wrong part |

SDGs: 4 (Quality Education), 9 (Industry & Innovation), 16 (Peace, Justice & Strong Institutions).

## 1. How the hackathon works (from Unstop) — and why it changes the strategy

- **Round 1 (now):** PPT/abstract for a chosen domain. Judged on **innovation, feasibility, relevance**. ~5 days left to register.
- **Round 2 (15–16 Oct, offline, 24 h):** your **domain (GenAI) stays fixed**, but at check-in you pick a colour → **GenAI PS-1, GenAI PS-2 (both secret), or Open Innovation**. Predefined PS = no switching. Progress via **scheduled Git check-ins**.
- **Round 3:** top 10 → 7 min pitch + 3 min Q&A, **live working demo mandatory**.

**Consequence:** the PS 3 project you build now is guaranteed useful only for Round 1. In Round 2 you have ~1/3 chance (Open Innovation) to keep it. So build it as a **reusable GenAI engine**, not a one-off app:

```
[ any input ] → [ multimodal ingest ] → [ LLM extraction ] → [ retrieval from trusted sources ]
             → [ grounded LLM reasoning with citations ] → [ multilingual text + voice output ] → [ web + WhatsApp ]
```

Almost every GenAI hackathon PS (legal doc assistant, health info bot, scheme finder, exam helper, complaint triage…) reuses 60–80% of this plumbing. You walk in on 15 Oct with ingestion, RAG-with-citations, Indic voice, WhatsApp bot and Vercel/Render deploy already solved — and only swap the domain logic.

> ⚠️ Ask the organisers (Unstop discussion tab / email) whether pre-written code is allowed in Round 2. Git check-ins suggest they want to see building happen live. Safe framing: "our own reusable starter/library", committed fresh into the event repo. Don't walk in with a finished repo and an empty commit history.

## 2. What it is: **Website (PWA) + WhatsApp bot**, one backend

| Form | Use it? | Why |
|---|---|---|
| **WhatsApp bot** | ✅ Primary channel | The fake forwards live in WhatsApp. User forwards the message / screenshot / voice note to our number → gets verdict back. Zero install. This is the demo "wow". |
| **Website (installable PWA)** | ✅ Second channel + judge-facing UI | Rich evidence view, history, trending dashboard. On Android, the PWA appears in the **Share** menu (Web Share Target API) → share any WhatsApp message/image/PDF straight into FwdCheck. |
| Telegram bot | ⚙️ Backup | 100% free, no Meta approval. Keep in your pocket if WhatsApp setup fails on demo day. |
| Browser extension | ❌ Skip | Forwards are on phones, not desktops. |
| Native app | ❌ Skip | PWA gives 95% of it for free, no Play Store. |

## 3. Unique features (what gets you shortlisted)

Most teams will build "paste text → ChatGPT says true/false". Judges will see 20 of those. Ours stands out with these — **lead the PPT with the top 4**.

### ⭐ USP 1 — Claim X-Ray (per-claim verdicts, highlighted on the original)
A forward usually mixes true + false + emotional bait. We split it into **atomic claims**, give each its own verdict + confidence, and **colour-highlight the exact sentence** in the original message/screenshot (green / red / amber / grey). Directly answers the PS's "what exactly is wrong".

> "PM-Kisan gives ₹6,000/year ✅ · now increased to ₹12,000 ❌ · register at pmkisan-free.in ❌ (not a govt domain)"

### ⭐ USP 2 — Time-Travel Check (the "Outdated" verdict, done properly)
The PS explicitly asks for "outdated" — most fact-checkers ignore it. We extract the time context of each claim and compare with source **publication dates**: *"This scheme was real in 2019 but was discontinued in March 2023 (source: PIB, 14-Mar-2023)."* Shows a mini timeline. Old-news-reshared-as-new is one of the commonest Indian WhatsApp fakes.

### ⭐ USP 3 — Vernacular voice-in, voice-out
Send a **Hindi/Marathi/Odia voice note** → get a **voice note reply** in the same language + simple text. Built for grandparents who can't read English. Strongest "relevance/impact" point for SDG 4/16.

### ⭐ USP 4 — Reply-ready Rebuttal Card
Generates a clean shareable image: verdict + 1-line correction + source logos + QR to full evidence. The user posts it back **in the same family group** where the fake arrived. Closes the loop — fact-checks spread the same way fakes do.

### USP 5 — "No source, no verdict" grounding guardrail
Anti-hallucination rule, enforced in code, not prompt:
- A verdict other than *Cannot be confirmed* needs ≥1 retrieved source.
- Every evidence quote is **string-matched against the fetched page text**; fake quotes are dropped. If nothing survives → auto-downgrade to *Cannot be confirmed*.
- Judges always ask "what if the AI hallucinates?" — this is the answer.

### USP 6 — Manipulation Radar
Even when a claim can't be confirmed, explain *why it smells*: "forward to 10 people", fake urgency, fake authority ("WHO/NASA confirms"), unofficial links, miracle-cure language. Teaches users to spot fakes themselves (SDG 4 — media literacy).

### USP 7 — Trending Fakes dashboard + instant cache
Every checked message and claim is stored. Same or near-identical forward (Postgres `pg_trgm` text similarity) arrives again → instant answer. Public dashboard: "Top 10 forwards being checked this week", by category (health / schemes / finance / news). Shows scale thinking.

## 4. Tech stack — ₹0, no credit card anywhere (verified 5 Oct 2026)

| Layer | Choice | Free limits (verified) |
|---|---|---|
| Frontend | **Next.js (App Router) + Tailwind + shadcn/ui**, PWA | **Vercel Hobby**: no card, 1M function invocations/mo, 100 GB bandwidth, non-commercial only (fine for hackathon) |
| Rebuttal card | `next/og` (`ImageResponse`) route on Vercel | included in Vercel Hobby |
| Backend | **Python FastAPI** | **Render free web service**: no card, 512 MB RAM, 0.1 CPU, sleeps after 15 min idle (~1 min wake-up), 750 h/month = one service 24×7. Keep warm with **cron-job.org** (free) ping every 10 min. Don't use Render's free Postgres (deleted after 30 days) |
| Main LLM (OCR + voice + PDF + reasoning) | **Gemini Flash-Lite** via Google AI Studio key | no card, **~500 requests/day** per project. Full Flash models dropped to **~20/day** free (Sept 2026), so use Flash-Lite. Check live quota at aistudio.google.com/rate-limit |
| Backup LLM | **Groq `openai/gpt-oss-120b`** | no card, 1,000 req/day, 30/min, 8K tokens/min (Llama models were removed from free tier Aug 2026) |
| Backup speech-to-text | **Groq `whisper-large-v3-turbo`** | 2,000 audio req/day, 25 MB/file |
| Fact-check database | **Google Fact Check Tools API** (PIB Fact Check, Alt News, BOOM, Factly, Vishvas News…) | plain API key from a Google Cloud project; no pricing published, no billing needed |
| Web search #1 | **Tavily** | 1,000 credits/month, no card |
| Web search #2 | **Serper** | 2,500 queries one-time, no card |
| Web search #3 (unlimited, unofficial) | `ddgs` (DuckDuckGo) Python lib + **Wikipedia API** | no key; rate-limited; last-resort fallback |
| Page/PDF extraction | `trafilatura`, `PyMuPDF` | open source |
| Voice reply | `edge-tts` (`hi-IN-SwaraNeural`, `mr-IN-AarohiNeural`, …); if it fails, the text reply is still sent | free (unofficial service, so voice is optional, never blocking) |
| Database + "already seen" cache | **Supabase** Postgres + `pg_trgm` text similarity (forwards are copy-pasted, so near-identical text matching is enough; no embedding model needed) | no card, 500 MB, 2 projects, pauses after 7 days idle (the cron ping keeps it awake) |
| WhatsApp | **Meta WhatsApp Cloud API** test number | free; can only message **up to 5 pre-verified phone numbers**; 1,000 free service messages/month per number (from 1 Oct 2026). Needs a Facebook account; make a permanent System-User token (test token expires in 24 h) |
| Telegram (open to anyone, e.g. judges) | Bot API via @BotFather | free, unlimited |
| Local webhook testing | **Cloudflare Tunnel** (`cloudflared tunnel --url`) | free, no account needed for quick tunnels |

**Quota maths:** each check = **2 LLM calls** (call 1: read input + split claims + manipulation flags; call 2: judge all claims together). So 500/day ÷ 2 ≈ **250 checks/day** on one key. Each teammate develops on their own key; keep one key untouched for demo day. Cache demo forwards beforehand so the live demo costs ~0.

> Simpler alternative: everything (incl. webhook) in Next.js on Vercel. We keep FastAPI on Render because Python has the best libs for scraping/PDF/TTS and it lets the team split frontend/backend work.

## 5. Architecture

```
          WhatsApp user                        Web / PWA user (or Android "Share →")
               │                                          │
     Meta Cloud API webhook                       Next.js on Vercel
               │                                          │ POST /check (multipart)
               └──────────────► FastAPI on Render ◄───────┘
                                     │
   1. INGEST     text | image | audio(.ogg) | pdf | url
                 → Gemini multimodal → plain text + detected language
                 (url → trafilatura; long pdf → PyMuPDF chunk)
                                     │
   2. EXTRACT    Gemini (JSON schema) → [{claim, category, entities, time_ref, checkable}]
                 + manipulation signals
                                     │
   3. CACHE      pg_trgm similarity(raw_text) ≥ 0.8 & fresh? → reuse verdict
                                     │
   4. RETRIEVE   per claim, in parallel:
                 a) Google Fact Check Tools API
                 b) Tavily/Serper search on trusted-domain allowlist
                 c) fetch top pages → trafilatura → relevant passages + publish date
                                     │
   5. REASON     Gemini (JSON schema): verdict ∈ {VERIFIED, FALSE, OUTDATED,
                 PARTLY_TRUE, UNVERIFIABLE}, confidence, what_is_wrong,
                 evidence[{quote, url, source, date}], simple_explanation
                                     │
   6. GUARDRAIL  quotes must string-match fetched text; no surviving
                 evidence → UNVERIFIABLE                     (plain Python)
                                     │
   7. RESPOND    translate to user language · edge-tts voice note ·
                 rebuttal card URL · save to Supabase
                                     │
               ┌─────────────────────┴───────────────────┐
     WhatsApp: text + voice note + card          Web: Claim X-Ray view, evidence,
                                                 timeline, card download
```

### Trusted-source allowlist (starter)
`pib.gov.in`, `*.gov.in`, `*.nic.in`, `who.int`, `mohfw.gov.in`, `icmr.gov.in`, `rbi.org.in`, `sebi.gov.in`, `eci.gov.in`, `factcheck.pib.gov.in`, `altnews.in`, `boomlive.in`, `factly.in`, `vishvasnews.com`, `thequint.com/news/webqoof`, `reuters.com`, `apnews.com`, `thehindu.com`, `indianexpress.com`, `bbc.com`. Each source gets a tier (Govt/Official > Fact-checker > Major news) shown as a badge.

### Data model (Supabase)
```sql
create extension if not exists pg_trgm;
create table checks (
  id uuid primary key default gen_random_uuid(),
  channel text,             -- web | whatsapp | telegram
  input_type text,          -- text | image | audio | pdf | url
  language text,
  raw_text text,
  overall_verdict text,
  created_at timestamptz default now()
);
create index on checks using gin (raw_text gin_trgm_ops);
create table claims (
  id uuid primary key default gen_random_uuid(),
  check_id uuid references checks(id) on delete cascade,
  claim text,
  category text,
  verdict text check (verdict in ('VERIFIED','FALSE','OUTDATED','PARTLY_TRUE','UNVERIFIABLE')),
  confidence real,
  what_is_wrong text,
  explanation text,
  evidence jsonb,           -- [{quote,url,source,tier,date}]
  created_at timestamptz default now()
);
```
Privacy: never store phone numbers in plain text — store a salted hash only.

## 6. Folder structure

```
Hack_on_Track/
├─ web/                     Next.js → Vercel
│  ├─ app/page.tsx          input box (paste / upload / record / URL)
│  ├─ app/result/[id]/      Claim X-Ray + evidence + timeline
│  ├─ app/trending/         dashboard
│  ├─ app/api/card/[id]/    next/og rebuttal card PNG
│  └─ public/manifest.json  PWA + share_target
├─ api/                     FastAPI → Render
│  ├─ main.py               /check, /whatsapp/webhook, /telegram/webhook
│  ├─ pipeline.py           ingest → extract → retrieve → reason → guardrail
│  ├─ sources.py            fact-check API, search, allowlist, fetch
│  ├─ voice.py              edge-tts
│  ├─ requirements.txt
│  └─ test_pipeline.py      30 known forwards → accuracy number
└─ PLAN.md
```

## 7. Timeline (today = Mon 5 Oct; hackathon = 15–16 Oct)

| Dates | Goal | Done when |
|---|---|---|
| **5–6 Oct** | Register on Unstop (₹250). Get keys: Gemini, Fact Check Tools, Tavily, Supabase. Backend pipeline for **text + URL** working locally. | `curl /check` returns per-claim JSON with real sources |
| **6–7 Oct** | Add **image + voice + PDF** via Gemini. Guardrail. Next.js UI with Claim X-Ray. Deploy Vercel + Render. | Live public URL works on phone |
| **7–8 Oct** | Draft & polish **Round-1 PPT** (section 8). Record 60–90 s demo video. | PPT has live link + video + QR |
| **8–9 Oct** | WhatsApp Cloud API bot (text → verdict; voice → voice). Rebuttal card. Telegram backup. | Forward a fake to the number, get a reply |
| **9 Oct** | **Submit Round 1** (check exact deadline on Unstop — don't wait for the last day) | Submitted |
| **10–13 Oct** | Time-Travel Check, Manipulation Radar, cache + Trending dashboard. Build the **30-forward eval set** (from PIB Fact Check / Alt News, known answers) → report accuracy. Write a reusable "GenAI starter" README for Round 2. | Accuracy number + all USPs in demo |
| **14 Oct** | **Pivot drill:** pick a random GenAI PS (e.g. "explain legal documents in Hindi") and rebuild on the engine in 3 h. Fix what slowed you down. Assign team roles for event day. | You know you can pivot fast |
| **15–16 Oct** | Hackathon. Open Innovation → extend FwdCheck. Predefined PS → reuse engine, swap domain logic. Frequent small Git commits. | Live demo ready by hour 20; last 4 h = polish + pitch |

### Team split (for 4 people; merge roles if fewer)
1. **AI/pipeline** — prompts, JSON schemas, guardrail, eval set
2. **Backend/integrations** — FastAPI, search/fact-check APIs, WhatsApp/Telegram, Supabase
3. **Frontend** — Next.js UI, Claim X-Ray, PWA share target, rebuttal card, dashboard
4. **Pitch/research** — PPT, demo video, collecting real fake forwards, Q&A prep, testing in Hindi/Marathi

## 8. Round-1 PPT (≈10–12 slides)

Judged on **innovation · feasibility · relevance** — every slide should serve one of these.

1. **Title** — FwdCheck: "Forward it to us before you forward it to family." Team, domain GenAI, PS 3.
2. **Problem** — real examples of Indian WhatsApp fakes (health cure, fake scheme, old news recycled), 1–2 stats with citations.
3. **Why existing solutions fail** — fact-check sites: English, manual, slow, need you to search; ChatGPT: no sources, hallucinates, bare true/false.
4. **Our solution in one line + demo screenshot** — WhatsApp in, verdict + evidence + voice out.
5. **USPs** — Claim X-Ray, Time-Travel Check, Vernacular voice, Rebuttal Card (one icon each).
6. **How it works** — the architecture diagram (section 5), simplified.
7. **5-verdict system + grounding guardrail** — "No source, no verdict".
8. **Tech stack** — logos; "runs on free tier = ₹0 to operate a pilot".
9. **Demo** — QR to live site + WhatsApp number + link to 90 s video. *(Huge feasibility signal — most teams only show mockups.)*
10. **Impact & SDGs** — 4, 9, 16; users: elderly, rural, non-English; accuracy on 30-forward eval set.
11. **Scalability / future** — Bhashini for 22 languages, deepfake audio/image detection, partnerships with PIB/fact-checkers, API for newsrooms.
12. **Team.**

## 9. Judge Q&A prep

| Question | Answer |
|---|---|
| What if the AI hallucinates? | Code-level guardrail: quotes must match fetched source text; no evidence → "Cannot be confirmed". We never guess. |
| How is this different from ChatGPT? | Per-claim verdicts, retrieved & dated sources, outdated detection, Indian languages by voice, works inside WhatsApp, shareable correction. |
| Satire / opinions? | Extraction step marks opinions as non-checkable; we say "this is an opinion, not a fact". |
| Bias in sources? | Transparent allowlist with tiers, every source shown, user can open it. |
| Cost at scale? | Free tier for pilot; claim cache means repeat viral forwards cost ~0; Flash-class models are cheap. |
| Privacy? | No phone numbers stored in plain text; content stored only for cache/dashboard; can be disabled. |
| Accuracy? | Show the eval-set number honestly, including failure cases. |

## 10. Risks & fallbacks

| Risk | Fallback |
|---|---|
| Render free tier cold start (~50 s) on demo | cron-job.org ping every 10 min; open the site 5 min before pitch |
| WhatsApp Cloud API setup/verification issues | Telegram bot (same backend) |
| Gemini free-tier rate limit during demo | Groq fallback; pre-warm cache with demo forwards |
| Venue Wi-Fi dies | Phone hotspot + recorded demo video |
| Search API credits run out | Fact Check Tools API (free) + second search provider key |
