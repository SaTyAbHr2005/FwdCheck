from radar import radar


def types(t):
    return {f["type"] for f in radar(t)}


def test_chain_forward():
    assert "chain_forward" in types("Ye message 10 groups mein forward karo")


def test_fear():
    assert "fear" in types("forward nahi kiya to bura hoga")


def test_urgency():
    assert "urgency" in types("URGENT!! only till tomorrow")


def test_fake_authority():
    assert "authority" in types("WHO ne confirm kiya hai")


def test_english_pronoun_who_not_flagged():
    assert "authority" not in types("people who confirm their booking get a refund")


def test_suspicious_link():
    assert "suspicious_link" in types("Register at rbi-note-badlo.in now")


def test_official_link_ok():
    assert "suspicious_link" not in types("See https://rbi.org.in/press and https://www.pib.gov.in/x")


def test_clean_text():
    assert radar("Good morning, have a nice day") == []
