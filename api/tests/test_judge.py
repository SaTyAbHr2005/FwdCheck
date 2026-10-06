from judge import overall_verdict


def V(*vs):
    return [{"verdict": v} for v in vs]


def test_all_true():
    assert overall_verdict(V("VERIFIED", "VERIFIED")) == "TRUE"


def test_all_false():
    assert overall_verdict(V("FALSE")) == "FALSE"


def test_mixed():
    assert overall_verdict(V("VERIFIED", "FALSE")) == "MISLEADING"


def test_outdated():
    assert overall_verdict(V("VERIFIED", "OUTDATED")) == "OUTDATED"


def test_unverifiable():
    assert overall_verdict(V("UNVERIFIABLE")) == "UNVERIFIABLE"


def test_partly():
    assert overall_verdict(V("VERIFIED", "PARTLY_TRUE")) == "PARTLY_TRUE"


def test_empty():
    assert overall_verdict([]) == "NO_CLAIMS"


def test_ignores_unverifiable_when_false_present():
    assert overall_verdict(V("FALSE", "UNVERIFIABLE")) == "FALSE"
