from sources import tier_of, is_allowed


def test_tiers():
    assert tier_of("https://rbi.org.in/Scripts/x.aspx") == "official"
    assert tier_of("https://pib.gov.in/PressRelease.aspx") == "official"
    assert tier_of("https://factcheck.pib.gov.in/x") == "factchecker"
    assert tier_of("https://www.altnews.in/some-check/") == "factchecker"
    assert tier_of("https://www.thehindu.com/news/x") == "news"
    assert tier_of("https://randomblog.xyz/x") == "other"


def test_lookalike_domain_not_trusted():
    assert tier_of("https://fakegov.in.scam.xyz/x") == "other"
    assert tier_of("https://notrbi.org.in.example.com") == "other"


def test_allowlist():
    assert is_allowed("https://www.who.int/news")
    assert not is_allowed("https://rbi-note-badlo.in")
