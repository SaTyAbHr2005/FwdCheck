import re

# Manipulation tricks typical of fake forwards. Hindi in Roman and Devanagari script.
RULES = {
    "chain_forward": re.compile(r"forward\s*(to|kar|karo|kare|kara|करो|करें)|\b\d+\s*(groups?|logon|people|लोगों)|share\s+with\s+\d+", re.I),
    "fear": re.compile(r"bura hoga|nahi to|warna|otherwise.{0,30}(lose|bad)|doob ja|बुरा होगा|वरना", re.I),
    "urgency": re.compile(r"\burgent\b|zaroori|turant|\babhi\b|only till|last date|aakhri|तुरंत|जरूरी|🚨", re.I),
    # case-sensitive acronyms so the English pronoun "who" is not flagged
    "authority": re.compile(r"\b(WHO|NASA|UNICEF|RBI|ICMR|Google|Harvard)\b.{0,30}(?i:confirm|says|ne kaha|bataya|ने कहा)"),
    "miracle": re.compile(r"\bcure[sd]?\b|theek ho|khatam ho jata|100%\s*(guarantee|effective)|chamatkar|ठीक हो", re.I),
}
OFFICIAL = (".gov.in", ".nic.in", "rbi.org.in", "who.int", "india.gov.in")
DOMAIN = re.compile(r"\b((?:https?://)?(?:[a-z0-9-]+\.)+(?:in|com|org|net|xyz|info|online|site|top|co|link|live)\b)", re.I)


def radar(text: str) -> list[dict]:
    flags = []
    for kind, pat in RULES.items():
        m = pat.search(text)
        if m:
            flags.append({"type": kind, "text": m.group(0)})
    for m in DOMAIN.finditer(text):
        host = re.sub(r"^https?://", "", m.group(1).lower()).removeprefix("www.")
        if not (host.endswith(OFFICIAL) or host in {o.lstrip(".") for o in OFFICIAL}):
            flags.append({"type": "suspicious_link", "text": host})
    return flags
