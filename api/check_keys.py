"""Pings every external service once. Run: python check_keys.py"""
import os
import re
import httpx
from dotenv import load_dotenv

load_dotenv()
E = os.environ.get


def gemini():
    from google import genai
    client = genai.Client(api_key=E("GEMINI_API_KEY"))     # keep a reference: the client closes when garbage-collected
    assert client.models.generate_content(model=E("GEMINI_MODEL"), contents="Say OK").text


def groq():
    from groq import Groq
    r = Groq(api_key=E("GROQ_API_KEY")).chat.completions.create(
        model=E("GROQ_MODEL", "openai/gpt-oss-120b"), messages=[{"role": "user", "content": "Say OK"}])
    assert r.choices[0].message.content


def factcheck():
    httpx.get("https://factchecktools.googleapis.com/v1alpha1/claims:search",
              params={"query": "lemon cures cancer", "key": E("FACTCHECK_API_KEY")}, timeout=20).raise_for_status()


def tavily():
    httpx.post("https://api.tavily.com/search", headers={"Authorization": f"Bearer {E('TAVILY_API_KEY')}"},
               json={"query": "RBI 2000 note withdrawal", "max_results": 1}, timeout=30).raise_for_status()


def serper():
    httpx.post("https://google.serper.dev/search", headers={"X-API-KEY": E("SERPER_API_KEY")},
               json={"q": "RBI 2000 note withdrawal", "gl": "in"}, timeout=20).raise_for_status()


def mongodb():
    from pymongo import MongoClient
    MongoClient(E("MONGODB_URI"), serverSelectionTimeoutMS=8000).admin.command("ping")


CHECKS = [("Gemini", ["GEMINI_API_KEY", "GEMINI_MODEL"], gemini), ("Groq", ["GROQ_API_KEY"], groq),
          ("FactCheck", ["FACTCHECK_API_KEY"], factcheck), ("Tavily", ["TAVILY_API_KEY"], tavily),
          ("Serper", ["SERPER_API_KEY"], serper), ("MongoDB", ["MONGODB_URI"], mongodb)]


def hide_secrets(msg: str) -> str:
    return re.sub(r"(key=|Bearer |mongodb(\+srv)?://)[^\s'\"&]+", r"\1[hidden]", msg)


if __name__ == "__main__":
    for name, env_vars, fn in CHECKS:
        if missing := [v for v in env_vars if not E(v)]:
            print(f"--   {name}: not set yet ({', '.join(missing)})")
            continue
        try:
            fn()
            print(f"OK   {name}")
        except Exception as e:
            print(f"FAIL {name}: {hide_secrets(str(e))[:200]}")
