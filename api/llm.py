import os
import json
import re
import time
from functools import cache

RATE_LIMIT_WAIT = 6   # seconds


class LLMError(Exception):
    pass


@cache
def _gemini():
    from google import genai
    return genai.Client(api_key=os.environ["GEMINI_API_KEY"])


@cache
def _groq():
    from groq import Groq
    return Groq(api_key=os.environ["GROQ_API_KEY"])


def _parse(text: str) -> dict:
    text = re.sub(r"^```(json)?|```$", "", (text or "").strip(), flags=re.M).strip()
    return json.loads(text)


def _is_rate_limit(e: Exception) -> bool:
    return "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e)


def _gemini_json(prompt: str, files: list[tuple[bytes, str]] | None) -> dict:
    from google.genai import types
    parts = [types.Part.from_bytes(data=b, mime_type=m) for b, m in (files or [])] + [prompt]
    r = _gemini().models.generate_content(
        model=os.environ["GEMINI_MODEL"], contents=parts,
        config=types.GenerateContentConfig(
            response_mime_type="application/json", temperature=0.1,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True)))
    return _parse(r.text)


def generate_json(prompt: str, files: list[tuple[bytes, str]] | None = None) -> dict:
    """Ask the LLM for a JSON object. files = [(bytes, mime_type)].
    Gemini first (one retry if rate-limited); Groq as text-only fallback. Raises LLMError if both fail."""
    try:
        try:
            return _gemini_json(prompt, files)
        except Exception as e:
            if not _is_rate_limit(e):
                raise
            time.sleep(RATE_LIMIT_WAIT)      # free tier allows only a few requests per minute
            return _gemini_json(prompt, files)
    except Exception as e:
        if files or not os.environ.get("GROQ_API_KEY"):
            raise LLMError(f"Gemini failed: {e}") from e
        try:
            r = _groq().chat.completions.create(
                model=os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b"),
                messages=[{"role": "user", "content": prompt + "\nReturn only JSON."}],
                response_format={"type": "json_object"}, temperature=0.1)
            return _parse(r.choices[0].message.content)
        except Exception as e2:
            raise LLMError(f"Gemini: {e} | Groq: {e2}") from e2
