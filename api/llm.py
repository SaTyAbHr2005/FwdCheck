import os
import json
import re
from functools import cache


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


def generate_json(prompt: str, files: list[tuple[bytes, str]] | None = None) -> dict:
    """Ask the LLM for a JSON object. files = [(bytes, mime_type)].
    Gemini first; Groq as text-only fallback. Raises LLMError if both fail."""
    try:
        from google.genai import types
        parts = [types.Part.from_bytes(data=b, mime_type=m) for b, m in (files or [])] + [prompt]
        r = _gemini().models.generate_content(
            model=os.environ["GEMINI_MODEL"], contents=parts,
            config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.1))
        return _parse(r.text)
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
