import asyncio
import hashlib
import hmac
import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Form, File, UploadFile, HTTPException, Request, BackgroundTasks  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import Response, PlainTextResponse  # noqa: E402

import db  # noqa: E402
import pipeline  # noqa: E402
import ratelimit  # noqa: E402
import voice  # noqa: E402
import telegram_bot  # noqa: E402
import twilio_bot  # noqa: E402
import whatsapp_bot  # noqa: E402
from llm import LLMError  # noqa: E402
from models import CheckResult, TrendingItem  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("fwdcheck")

REQUIRED_ENV = ["GEMINI_API_KEY", "GEMINI_MODEL", "WEB_ORIGIN"]
MAX_FILE = 15 * 1024 * 1024
ALLOWED = ("image/", "audio/", "application/pdf")
# Phones often send files with no type or "application/octet-stream" (WhatsApp .opus voice notes,
# iPhone .m4a memos and HEIC photos), so fall back to the file extension. Gemini reads all of these.
BY_EXT = {"opus": "audio/ogg", "ogg": "audio/ogg", "oga": "audio/ogg", "m4a": "audio/mp4", "aac": "audio/aac",
          "mp3": "audio/mpeg", "wav": "audio/wav", "amr": "audio/amr", "heic": "image/heic", "heif": "image/heif",
          "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp", "pdf": "application/pdf"}
CHECKS_PER_MINUTE = int(os.environ.get("CHECKS_PER_MINUTE", "6"))


@asynccontextmanager
async def lifespan(_: FastAPI):
    if missing := [k for k in REQUIRED_ENV if not os.environ.get(k)]:
        log.warning("missing env vars: %s (see api/.env.example)", ", ".join(missing))
    if not db.using_mongo():
        log.warning("MONGODB_URI not set: results are kept in memory and lost on restart")
    try:
        await asyncio.to_thread(db.warm_up)
    except Exception as e:
        log.error("database not reachable at startup: %s", e)
    yield


app = FastAPI(title="FwdCheck API", version="1.0.0", lifespan=lifespan,
              description="Checks forwarded messages claim-by-claim against trusted, dated sources.")
app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in os.environ.get("WEB_ORIGIN", "*").split(",")],
                   allow_methods=["GET", "POST"], allow_headers=["*"])


@app.get("/health")
def health():
    return {"ok": True, "version": app.version}


@app.post("/check", response_model=CheckResult)
async def check(request: Request, text: str | None = Form(None), url: str | None = Form(None),
                file: UploadFile | None = File(None)):
    if not ratelimit.allow(f"ip:{ratelimit.client_ip(request.headers, request.client.host)}", CHECKS_PER_MINUTE):
        raise HTTPException(429, "Too many checks. Please wait a minute and try again.")
    data = mime = None
    if file and file.filename:
        data = await file.read()
        mime = (file.content_type or "").split(";")[0]
        if not mime.startswith(ALLOWED):
            mime = BY_EXT.get(file.filename.rsplit(".", 1)[-1].lower(), mime)
        if len(data) > MAX_FILE:
            raise HTTPException(413, "File too large (max 15 MB)")
        if not mime.startswith(ALLOWED):
            raise HTTPException(415, "Send text, an image, audio, a PDF or a link")
    if not ((text and text.strip()) or url or data):
        raise HTTPException(400, "Nothing to check")
    try:
        return await pipeline.run_check(text, url, data, mime, "web")
    except LLMError as e:
        log.error("llm failure: %s", e)
        raise HTTPException(503, "AI service busy, please try again in a minute")
    except ValueError as e:
        raise HTTPException(422, str(e))


@app.get("/check/{check_id}", response_model=CheckResult)
def get_check(check_id: str):
    r = db.get(check_id)
    if not r:
        raise HTTPException(404, "Not found")
    return r


@app.get("/check/{check_id}/voice.mp3")
async def get_voice(check_id: str):
    r = db.get(check_id)
    if not r:
        raise HTTPException(404, "Not found")
    audio = await voice.tts(r["summary"], r["language"])
    if not audio:
        raise HTTPException(503, "Voice service unavailable, please try again later")
    return Response(audio, media_type="audio/mpeg", headers={"Cache-Control": "public, max-age=86400"})


@app.get("/trending", response_model=list[TrendingItem])
def get_trending():
    return db.trending()


@app.post("/telegram/webhook")
async def tg_webhook(req: Request, bg: BackgroundTasks):
    if req.headers.get("X-Telegram-Bot-Api-Secret-Token") != os.environ.get("TELEGRAM_SECRET"):
        raise HTTPException(403)
    bg.add_task(telegram_bot.handle_update, await req.json())
    return {"ok": True}          # answer instantly; the check runs in the background


@app.get("/whatsapp/webhook")
def wa_verify(req: Request):
    p = req.query_params
    if p.get("hub.mode") == "subscribe" and p.get("hub.verify_token") == os.environ.get("WA_VERIFY_TOKEN"):
        return PlainTextResponse(p.get("hub.challenge"))
    raise HTTPException(403)


def valid_meta_signature(body: bytes, header: str | None, secret: str) -> bool:
    expected = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header or "")


@app.post("/whatsapp/webhook")
async def wa_webhook(req: Request, bg: BackgroundTasks):
    body = await req.body()
    secret = os.environ.get("WA_APP_SECRET")
    if secret and not valid_meta_signature(body, req.headers.get("X-Hub-Signature-256"), secret):
        raise HTTPException(403)
    bg.add_task(whatsapp_bot.handle, await req.json())
    return {"ok": True}


@app.post("/twilio/webhook")
async def twilio_webhook(req: Request, bg: BackgroundTasks):
    form = {k: str(v) for k, v in (await req.form()).items()}
    # Twilio signs the public https URL it called; behind Render's proxy req.url says http, so rebuild it.
    url = f"{req.headers.get('x-forwarded-proto', req.url.scheme)}://{req.headers.get('host')}{req.url.path}"
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    if not token or not twilio_bot.valid_signature(url, form, req.headers.get("X-Twilio-Signature"), token):
        raise HTTPException(403)
    bg.add_task(twilio_bot.handle, form, url.removesuffix(req.url.path))
    return Response("<Response/>", media_type="application/xml")   # empty TwiML: replies are sent via the REST API
