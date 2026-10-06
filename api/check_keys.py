"""Pings every external service once. Run: python check_keys.py"""
import os
import httpx
from dotenv import load_dotenv

load_dotenv()
E = os.environ.get


def ok(name, fn):
    try:
        fn()
        print(f"OK   {name}")
    except Exception as e:
        print(f"FAIL {name}: {str(e)[:200]}")


def gemini():
    from google import genai
    r = genai.Client(api_key=E("GEMINI_API_KEY")).models.generate_content(model=E("GEMINI_MODEL"), contents="Say OK")
    assert r.text


def groq():
    from groq import Groq
    r = Groq(api_key=E("GROQ_API_KEY")).chat.completions.create(
        model=E("GROQ_MODEL", "openai/gpt-oss-120b"), messages=[{"role": "user", "content": "Say OK"}])
    assert r.choices[0].message.content


def factcheck():
    r = httpx.get("https://factchecktools.googleapis.com/v1alpha1/claims:search",
                  params={"query": "lemon cures cancer", "key": E("FACTCHECK_API_KEY")}, timeout=20)
    r.raise_for_status()


def tavily():
    r = httpx.post("https://api.tavily.com/search", headers={"Authorization": f"Bearer {E('TAVILY_API_KEY')}"},
                   json={"query": "RBI 2000 note withdrawal", "max_results": 1}, timeout=30)
    r.raise_for_status()


def serper():
    r = httpx.post("https://google.serper.dev/search", headers={"X-API-KEY": E("SERPER_API_KEY")},
                   json={"q": "RBI 2000 note withdrawal", "gl": "in"}, timeout=20)
    r.raise_for_status()


def supabase():
    from supabase import create_client
    create_client(E("SUPABASE_URL"), E("SUPABASE_SERVICE_KEY")).table("checks").select("id").limit(1).execute()


if __name__ == "__main__":
    for n, f in [("Gemini", gemini), ("Groq", groq), ("FactCheck", factcheck), ("Tavily", tavily),
                 ("Serper", serper), ("Supabase", supabase)]:
        ok(n, f)
