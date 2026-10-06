import os
import httpx

import pipeline
import voice
from llm import LLMError
from telegram_bot import format_reply, SORRY


def _g() -> str:
    return f"https://graph.facebook.com/{os.environ.get('GRAPH_VERSION', 'v23.0')}"


def _h() -> dict:
    return {"Authorization": f"Bearer {os.environ['WA_TOKEN']}"}


async def _send(c: httpx.AsyncClient, to: str, payload: dict):
    await c.post(f"{_g()}/{os.environ['WA_PHONE_NUMBER_ID']}/messages", headers=_h(),
                 json={"messaging_product": "whatsapp", "to": to, **payload})


async def _media(c: httpx.AsyncClient, media_id: str) -> tuple[bytes, str]:
    meta = (await c.get(f"{_g()}/{media_id}", headers=_h())).json()
    return (await c.get(meta["url"], headers=_h())).content, meta["mime_type"].split(";")[0].strip()


async def handle(body: dict):
    try:
        msg = body["entry"][0]["changes"][0]["value"]["messages"][0]
    except (KeyError, IndexError):
        return                                     # delivery/read status updates: ignore
    to, kind, web = msg["from"], msg["type"], os.environ["WEB_ORIGIN"]
    async with httpx.AsyncClient(timeout=60) as c:
        if kind not in ("text", "image", "audio", "document"):
            await _send(c, to, {"type": "text", "text": {"body": "Please send text, a screenshot, a voice note, a PDF or a link."}})
            return
        await _send(c, to, {"type": "text", "text": {"body": "🔍 Checking… about 15 seconds"}})
        try:
            text = data = mime = None
            if kind == "text":
                text = msg["text"]["body"]
            else:
                data, mime = await _media(c, msg[kind]["id"])
            r = await pipeline.run_check(text=text, file=data, mime=mime, channel="whatsapp")
            await _send(c, to, {"type": "text", "text": {"body": format_reply(r, f"{web}/r/{r['id']}")}})
            audio = await voice.tts(r["summary"], r["language"])
            up = await c.post(f"{_g()}/{os.environ['WA_PHONE_NUMBER_ID']}/media", headers=_h(),
                              data={"messaging_product": "whatsapp", "type": "audio/mpeg"},
                              files={"file": ("reply.mp3", audio, "audio/mpeg")})
            if media_id := up.json().get("id"):
                await _send(c, to, {"type": "audio", "audio": {"id": media_id}})
            await _send(c, to, {"type": "image", "image": {"link": f"{web}/api/card/{r['id']}"}})
        except (LLMError, ValueError, httpx.HTTPError):
            await _send(c, to, {"type": "text", "text": {"body": SORRY}})
