"""Twilio WhatsApp sandbox: signature check, webhook route and reply flow, all offline."""
import asyncio

import pytest
from fastapi.testclient import TestClient

import main
import pipeline
import ratelimit
import twilio_bot

client = TestClient(main.app)
URL = "https://fwdcheck.onrender.com/twilio/webhook"
FORM = {"From": "whatsapp:+919800000000", "To": "whatsapp:+14155238886", "Body": "RBI ne ₹2000 band kiye 🚨",
        "NumMedia": "0", "MessageSid": "SM123", "WaId": "919800000000", "ProfileName": "Test"}
# Computed with Twilio's official RequestValidator for token "12345" (pins our implementation to theirs).
OFFICIAL_SIG = "TmUFIfWGkZ/MLkZ7oVkTNBXF5Kg="
RESULT = {"id": "abc", "summary": "Not true.", "language": "hi", "red_flags": [],
          "claims": [{"claim": "RBI banned 2000 notes", "verdict": "FALSE"}]}


@pytest.fixture(autouse=True)
def env(monkeypatch):
    ratelimit._hits.clear()
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "AC123")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "12345")
    monkeypatch.setenv("WEB_ORIGIN", "https://fwd-check.vercel.app")


def test_signature_matches_twilio_official():
    assert twilio_bot.valid_signature(URL, FORM, OFFICIAL_SIG, "12345")
    assert not twilio_bot.valid_signature(URL, FORM, "forged", "12345")
    assert not twilio_bot.valid_signature(URL, {**FORM, "Body": "changed"}, OFFICIAL_SIG, "12345")


def test_webhook_rejects_unsigned_and_accepts_signed(monkeypatch):
    calls = []

    async def fake_handle(form, base):
        calls.append((form, base))
    monkeypatch.setattr(twilio_bot, "handle", fake_handle)
    headers = {"host": "fwdcheck.onrender.com", "x-forwarded-proto": "https"}
    assert client.post("/twilio/webhook", data=FORM, headers=headers).status_code == 403
    ok = client.post("/twilio/webhook", data=FORM, headers={**headers, "X-Twilio-Signature": OFFICIAL_SIG})
    assert ok.status_code == 200 and "<Response/>" in ok.text
    assert calls == [(FORM, "https://fwdcheck.onrender.com")]


def test_webhook_refuses_everything_without_token(monkeypatch):
    monkeypatch.delenv("TWILIO_AUTH_TOKEN")
    r = client.post("/twilio/webhook", data=FORM, headers={"X-Twilio-Signature": OFFICIAL_SIG})
    assert r.status_code == 403


def _capture(monkeypatch):
    sent = []

    async def fake_send(c, to, body=None, media=None):
        sent.append((to, body, media))
    monkeypatch.setattr(twilio_bot, "_send", fake_send)
    return sent


def test_text_forward_gets_verdict_voice_and_card(monkeypatch):
    sent = _capture(monkeypatch)

    async def fake_check(**kw):
        assert kw["text"] == FORM["Body"] and kw["file"] is None
        return RESULT
    monkeypatch.setattr(pipeline, "run_check", fake_check)
    asyncio.run(twilio_bot.handle(FORM, "https://fwdcheck.onrender.com"))
    assert len(sent) == 3                                  # 3 messages per check: trial has only 100
    assert "Not true." in sent[0][1] and "https://fwd-check.vercel.app/r/abc" in sent[0][1]
    assert sent[1][2] == "https://fwdcheck.onrender.com/check/abc/voice.mp3"
    assert sent[2][2] == "https://fwd-check.vercel.app/api/card/abc"


def test_greeting_gets_welcome_without_a_check(monkeypatch):
    sent = _capture(monkeypatch)

    async def must_not_run(**kw):
        raise AssertionError("greeting should not be fact-checked")
    monkeypatch.setattr(pipeline, "run_check", must_not_run)
    asyncio.run(twilio_bot.handle({**FORM, "Body": "Hi!"}, "https://fwdcheck.onrender.com"))
    assert sent == [(FORM["From"], twilio_bot.WELCOME, None)]


def test_long_reply_keeps_proof_link():
    link = "https://fwd-check.vercel.app/r/abc"
    out = twilio_bot._fit("x" * 5000 + "\n" + link, link)
    assert len(out) <= twilio_bot.MAX_BODY and out.endswith(link)
