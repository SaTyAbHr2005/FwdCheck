"""API response schemas. Also used to validate/normalise LLM output before it is stored."""
from typing import Literal

from pydantic import BaseModel

ClaimVerdictKind = Literal["VERIFIED", "FALSE", "OUTDATED", "PARTLY_TRUE", "UNVERIFIABLE"]
OverallKind = Literal["TRUE", "FALSE", "MISLEADING", "OUTDATED", "PARTLY_TRUE", "UNVERIFIABLE", "NO_CLAIMS"]


class Evidence(BaseModel):
    quote: str
    url: str
    source: str = ""
    tier: str = "other"
    date: str | None = None


class TimelineEvent(BaseModel):
    date: str | None = None
    event: str = ""


class ClaimVerdict(BaseModel):
    claim_id: str
    claim: str = ""
    verdict: ClaimVerdictKind = "UNVERIFIABLE"
    confidence: float = 0.0
    what_is_wrong: str = ""
    explanation: str = ""
    timeline: list[TimelineEvent] = []
    evidence: list[Evidence] = []


class RedFlag(BaseModel):
    type: str
    text: str


class CheckResult(BaseModel):
    id: str
    language: str
    input_type: str
    text: str
    overall: OverallKind
    summary: str
    claims: list[ClaimVerdict]
    red_flags: list[RedFlag]
    cached: bool = False
    latency_ms: int | None = None


class TrendingItem(BaseModel):
    id: str
    raw_text: str
    overall: str
    hit_count: int
    created_at: str
