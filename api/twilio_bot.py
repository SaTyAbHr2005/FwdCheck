"""WhatsApp through the Twilio Sandbox: no Meta business verification needed.
Free trial: 100 WhatsApp messages, up to 5 verified numbers, each user first sends "join <code>" to the sandbox."""
import base64
import hashlib
import hmac
import logging
import os

import httpx

import pipeline
import ratelimit
from llm import LLMError
from telegram_bot import format_reply, SORRY, SLOW_DOWN, WELCOME

log = logging.getLogger("fwdcheck.twilio")
API = "https://api.twilio.com/2010-04-01"
MAX_BODY = 1600                       # Twilio's limit for one WhatsApp message
GREETINGS = {"hi", "hello", "hey", "start", "/start", "namaste"}
SUPPORTED = ("image/", "audio/", "application/pdf")


def valid_signature(url: str, params: dict[str, str], signature: str | None, token: str) -> bool:
    """Twilio signs: base64(HMAC-SHA1(auth_token, url + each sorted param name + value))."""
    data = url + "".join(k + params[k] for k in sorted(params))
    expected = base64.b64encode(hmac.new(token.encode(), data.encode(), hashlib.sha1).digest()).decode()
    return hmac.compare_digest(expected, signature or "")


def _auth() -> tuple[str, str]:
    return os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"]


async def _send(c: httpx.AsyncClient, to: str, body: str | None = None, media: str | None = None):
    data = {"From": os.environ.get("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886"), "To": to}
    if body:
        data["Body"] = body
    if media:
        data["MediaUrl"] = media      # Twilio fetches it; must be a public URL
    r = await c.post(f"{API}/Accounts/{_auth()[0]}/Messages.json", data=data, auth=_auth())
    if r.is_error:
        log.warning("twilio send failed %s: %s", r.status_code, r.text[:300])


def _fit(reply: str, link: str) -> str:
    """Trim to one WhatsApp message but always keep the proof link at the end."""
    return reply if len(reply) <= MAX_BODY else reply[:MAX_BODY - len(link) - 3] + "…\n" + link


async def handle(form: dict[str, str], api_base: str):
    """form = Twilio's webhook fields; api_base = this API's public URL (for the voice-note link)."""
    to = form.get("From", "")
    if not to:
        return
    text = form.get("Body", "").strip()
    has_media = int(form.get("NumMedia", "0") or 0) > 0
    mime = form.get("MediaContentType0", "").split(";")[0].strip() if has_media else None
    web = os.environ["WEB_ORIGIN"].split(",")[0].strip()
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as c:
        if not has_media and text.lower().strip("!.🙏 ") in GREETINGS:
            await _send(c, to, WELCOME)
            return
        if has_media and not mime.startswith(SUPPORTED):
            await _send(c, to, "Please send text, a screenshot, a voice note, a PDF or a link.")
            return
        if not ratelimit.allow(f"tw:{to}", limit=5):
            await _send(c, to, SLOW_DOWN)
            return
        try:
            data = (await c.get(form["MediaUrl0"], auth=_auth())).content if has_media else None
            r = await pipeline.run_check(text=None if data else text, file=data, mime=mime, channel="whatsapp")
            link = f"{web}/r/{r['id']}"
            await _send(c, to, _fit(format_reply(r, link), link))
            await _send(c, to, media=f"{api_base}/check/{r['id']}/voice.mp3")
            if r["claims"]:
                await _send(c, to, media=f"{web}/api/card/{r['id']}")
        except (LLMError, ValueError, httpx.HTTPError):
            await _send(c, to, SORRY)
