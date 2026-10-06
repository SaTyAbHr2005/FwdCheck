import asyncio
import io

VOICES = {"hi": "hi-IN-SwaraNeural", "hinglish": "hi-IN-SwaraNeural", "mr": "mr-IN-AarohiNeural",
          "en": "en-IN-NeerjaNeural"}
GTTS_LANG = {"hi": "hi", "hinglish": "hi", "mr": "mr", "en": "en"}


async def tts(text: str, language: str) -> bytes:
    """Text -> mp3 bytes. edge-tts (neural voices), falls back to gTTS."""
    text = text[:1500]
    try:
        import edge_tts
        buf = b""
        async for chunk in edge_tts.Communicate(text, VOICES.get(language, VOICES["en"])).stream():
            if chunk["type"] == "audio":
                buf += chunk["data"]
        if buf:
            return buf
    except Exception:
        pass
    from gtts import gTTS
    out = io.BytesIO()
    await asyncio.to_thread(lambda: gTTS(text, lang=GTTS_LANG.get(language, "en")).write_to_fp(out))
    return out.getvalue()
