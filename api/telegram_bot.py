import os
import httpx

import pipeline
import voice
from llm import LLMError

EMOJI = {"VERIFIED": "🟢", "FALSE": "🔴", "OUTDATED": "⏳", "PARTLY_TRUE": "🟠"}
WELCOME = ("Namaste 🙏 Forward me any message, screenshot, voice note, PDF or link "
           "and I'll check if it's true.")
SORRY = "Sorry, I couldn't check this right now. Please try again in a minute."


def format_reply(r: dict, link: str) -> str:
    lines = [r["summary"], ""]
    for c in r["claims"]:
        lines.append(f"{EMOJI.get(c['verdict'], '⚪')} {c['claim']}")
    if r["red_flags"]:
        lines.append("\n🚩 " + ", ".join(sorted({f["type"].replace("_", " ") for f in r["red_flags"]})))
    lines.append(f"\n🔗 Full proof + share card: {link}")
    return "\n".join(lines)[:4000]


def _base() -> str:
    return f"https://api.telegram.org/bot{os.environ['TELEGRAM_BOT_TOKEN']}"


async def _download(c: httpx.AsyncClient, file_id: str) -> bytes:
    path = (await c.get(f"{_base()}/getFile", params={"file_id": file_id})).json()["result"]["file_path"]
    return (await c.get(f"https://api.telegram.org/file/bot{os.environ['TELEGRAM_BOT_TOKEN']}/{path}")).content


async def handle_update(update: dict):
    msg = update.get("message") or {}
    chat = msg.get("chat", {}).get("id")
    if not chat:
        return
    base, web = _base(), os.environ["WEB_ORIGIN"]
    async with httpx.AsyncClient(timeout=60) as c:
        text = msg.get("text") or msg.get("caption")
        if text == "/start":
            await c.post(f"{base}/sendMessage", json={"chat_id": chat, "text": WELCOME})
            return
        await c.post(f"{base}/sendMessage", json={"chat_id": chat, "text": "🔍 Checking… about 15 seconds"})
        try:
            data = mime = None
            if "photo" in msg:
                data, mime = await _download(c, msg["photo"][-1]["file_id"]), "image/jpeg"
            elif "voice" in msg or "audio" in msg:
                a = msg.get("voice") or msg["audio"]
                data, mime = await _download(c, a["file_id"]), a.get("mime_type", "audio/ogg")
            elif msg.get("document", {}).get("mime_type") in ("application/pdf", "image/png", "image/jpeg"):
                data, mime = await _download(c, msg["document"]["file_id"]), msg["document"]["mime_type"]
            elif not text:
                await c.post(f"{base}/sendMessage", json={"chat_id": chat, "text": WELCOME})
                return
            r = await pipeline.run_check(text=None if data else text, file=data, mime=mime, channel="telegram")
            await c.post(f"{base}/sendMessage", json={"chat_id": chat, "text": format_reply(r, f"{web}/r/{r['id']}")})
            audio = await voice.tts(r["summary"], r["language"])
            await c.post(f"{base}/sendAudio", data={"chat_id": chat, "title": "FwdCheck"},
                         files={"audio": ("fwdcheck.mp3", audio, "audio/mpeg")})
            await c.post(f"{base}/sendPhoto", json={"chat_id": chat, "photo": f"{web}/api/card/{r['id']}"})
        except (LLMError, ValueError, httpx.HTTPError):
            await c.post(f"{base}/sendMessage", json={"chat_id": chat, "text": SORRY})
