"""API tests that need no keys: the pipeline is replaced with a fake."""
import os
from fastapi.testclient import TestClient

import main
import pipeline
from llm import LLMError

client = TestClient(main.app)


def test_health():
    assert client.get("/health").json() == {"ok": True}


def test_empty_request_rejected():
    assert client.post("/check", data={"text": "   "}).status_code == 400


def test_wrong_file_type_rejected():
    r = client.post("/check", files={"file": ("x.exe", b"MZ", "application/x-msdownload")})
    assert r.status_code == 415


def test_llm_down_gives_503(monkeypatch):
    async def boom(*a, **k):
        raise LLMError("quota")
    monkeypatch.setattr(pipeline, "run_check", boom)
    assert client.post("/check", data={"text": "RBI banned 2000 notes"}).status_code == 503


def test_check_passes_text_to_pipeline(monkeypatch):
    seen = {}

    async def fake(text, url, data, mime, channel):
        seen.update(text=text, channel=channel)
        return {"id": "x", "overall": "FALSE"}
    monkeypatch.setattr(pipeline, "run_check", fake)
    assert client.post("/check", data={"text": "hello"}).json()["overall"] == "FALSE"
    assert seen == {"text": "hello", "channel": "web"}


def test_whatsapp_verify(monkeypatch):
    monkeypatch.setenv("WA_VERIFY_TOKEN", "abc")
    ok = client.get("/whatsapp/webhook", params={"hub.mode": "subscribe", "hub.verify_token": "abc", "hub.challenge": "42"})
    assert ok.text == "42"
    bad = client.get("/whatsapp/webhook", params={"hub.mode": "subscribe", "hub.verify_token": "no", "hub.challenge": "42"})
    assert bad.status_code == 403


def test_telegram_rejects_wrong_secret(monkeypatch):
    monkeypatch.setenv("TELEGRAM_SECRET", "s3cret")
    r = client.post("/telegram/webhook", json={}, headers={"X-Telegram-Bot-Api-Secret-Token": "wrong"})
    assert r.status_code == 403
