import logging

log = logging.getLogger("fwdcheck.voice")

VOICES = {"hi": "hi-IN-SwaraNeural", "hinglish": "hi-IN-SwaraNeural", "mr": "mr-IN-AarohiNeural",
          "en": "en-IN-NeerjaNeural"}


async def tts(text: str, language: str) -> bytes:
    """Text -> mp3 bytes using edge-tts neural voices. Returns b"" if the voice service fails,
    so callers can still send the text reply."""
    try:
        import edge_tts
        buf = b""
        async for chunk in edge_tts.Communicate(text[:1500], VOICES.get(language, VOICES["en"])).stream():
            if chunk["type"] == "audio":
                buf += chunk["data"]
        return buf
    except Exception as e:
        log.warning("tts failed: %s", e)
        return b""
