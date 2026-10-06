import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Form, File, UploadFile, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, PlainTextResponse

import db
import pipeline
import voice
import telegram_bot
import whatsapp_bot
from llm import LLMError

app = FastAPI(title="FwdCheck API")
app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in os.environ.get("WEB_ORIGIN", "*").split(",")],
                   allow_methods=["*"], allow_headers=["*"])

MAX_FILE = 15 * 1024 * 1024
ALLOWED = ("image/", "audio/", "application/pdf")


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/check")
async def check(text: str | None = Form(None), url: str | None = Form(None), file: UploadFile | None = File(None)):
    data = mime = None
    if file and file.filename:
        data = await file.read()
        mime = (file.content_type or "").split(";")[0]
        if len(data) > MAX_FILE:
            raise HTTPException(413, "File too large (max 15 MB)")
        if not mime.startswith(ALLOWED):
            raise HTTPException(415, "Send text, an image, audio, a PDF or a link")
    if not ((text and text.strip()) or url or data):
        raise HTTPException(400, "Nothing to check")
    try:
        return await pipeline.run_check(text, url, data, mime, "web")
    except LLMError:
        raise HTTPException(503, "AI service busy, please try again in a minute")
    except ValueError as e:
        raise HTTPException(422, str(e))


@app.get("/check/{check_id}")
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
    return Response(await voice.tts(r["summary"], r["language"]), media_type="audio/mpeg")


@app.get("/trending")
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


@app.post("/whatsapp/webhook")
async def wa_webhook(req: Request, bg: BackgroundTasks):
    bg.add_task(whatsapp_bot.handle, await req.json())
    return {"ok": True}
