from guardrail import enforce_grounding

EV = [{"claim_id": "C1", "url": "https://rbi.org.in/x", "source": "RBI", "tier": "official", "date": "2023-05-19",
       "page_text": "The Reserve Bank of India has decided to withdraw the  ₹2000 denomination banknotes from circulation. "
                    "The ₹2000 banknotes will continue to be legal tender."}]


def v(quote, url="https://rbi.org.in/x", verdict="PARTLY_TRUE"):
    return [{"claim_id": "C1", "verdict": verdict, "what_is_wrong": "x", "confidence": 0.9,
             "evidence": [{"quote": quote, "url": url, "source": "made up name"}]}]


def test_real_quote_kept_with_our_metadata():
    out = enforce_grounding(v("will continue to be legal tender"), EV)
    assert out[0]["verdict"] == "PARTLY_TRUE"
    assert out[0]["evidence"][0]["source"] == "RBI" and out[0]["evidence"][0]["tier"] == "official"


def test_whitespace_and_case_tolerant():
    out = enforce_grounding(v("decided to WITHDRAW the ₹2000   denomination"), EV)
    assert len(out[0]["evidence"]) == 1


def test_fake_quote_dropped_and_downgraded():
    out = enforce_grounding(v("RBI says all notes are banned forever"), EV)
    assert out[0]["verdict"] == "UNVERIFIABLE" and out[0]["evidence"] == [] and out[0]["confidence"] == 0.0


def test_fake_url_dropped():
    out = enforce_grounding(v("will continue to be legal tender", url="https://made-up.com"), EV)
    assert out[0]["verdict"] == "UNVERIFIABLE"


def test_too_short_quote_dropped():
    out = enforce_grounding(v("the"), EV)
    assert out[0]["verdict"] == "UNVERIFIABLE"


def test_unverifiable_untouched():
    out = enforce_grounding([{"claim_id": "C2", "verdict": "UNVERIFIABLE", "evidence": []}], EV)
    assert out[0]["verdict"] == "UNVERIFIABLE"
