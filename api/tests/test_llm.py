import pytest

import llm


@pytest.fixture(autouse=True)
def no_wait(monkeypatch):
    monkeypatch.setattr(llm, "RATE_LIMIT_WAITS", (0, 0))


def test_retries_once_on_rate_limit(monkeypatch):
    calls = []

    def flaky(prompt, files):
        calls.append(1)
        if len(calls) == 1:
            raise RuntimeError("429 RESOURCE_EXHAUSTED")
        return {"ok": True}
    monkeypatch.setattr(llm, "_gemini_json", flaky)
    assert llm.generate_json("hi") == {"ok": True} and len(calls) == 2


def test_gives_up_after_three_rate_limited_tries(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    calls = []

    def limited(prompt, files):
        calls.append(1)
        raise RuntimeError("429 RESOURCE_EXHAUSTED")
    monkeypatch.setattr(llm, "_gemini_json", limited)
    with pytest.raises(llm.LLMError):
        llm.generate_json("hi")
    assert len(calls) == 3


def test_other_errors_raise_llmerror_without_groq(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)

    def broken(prompt, files):
        raise RuntimeError("500 internal")
    monkeypatch.setattr(llm, "_gemini_json", broken)
    with pytest.raises(llm.LLMError):
        llm.generate_json("hi")


def test_parse_strips_code_fences():
    assert llm._parse('```json\n{"a": 1}\n```') == {"a": 1}
