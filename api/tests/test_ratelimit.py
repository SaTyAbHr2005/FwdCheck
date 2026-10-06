import ratelimit


def test_allows_up_to_limit_then_blocks():
    ratelimit._hits.clear()
    assert [ratelimit.allow("k", limit=3) for _ in range(4)] == [True, True, True, False]


def test_keys_are_independent():
    ratelimit._hits.clear()
    assert ratelimit.allow("a", limit=1) and ratelimit.allow("b", limit=1)
    assert not ratelimit.allow("a", limit=1)


def test_window_expires(monkeypatch):
    ratelimit._hits.clear()
    now = [1000.0]
    monkeypatch.setattr(ratelimit.time, "monotonic", lambda: now[0])
    assert ratelimit.allow("k", limit=1, window=60)
    assert not ratelimit.allow("k", limit=1, window=60)
    now[0] += 61
    assert ratelimit.allow("k", limit=1, window=60)


def test_client_ip_prefers_cloudflare_header():
    assert ratelimit.client_ip({"cf-connecting-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1"}, "x") == "9.9.9.9"
    assert ratelimit.client_ip({"x-forwarded-for": "1.1.1.1, 10.0.0.1"}, "x") == "1.1.1.1"
    assert ratelimit.client_ip({}, "127.0.0.1") == "127.0.0.1"
