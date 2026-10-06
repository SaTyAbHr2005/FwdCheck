from check_keys import hide_secrets


def test_hides_keys_in_error_messages():
    msg = hide_secrets("403 for url 'https://x.googleapis.com/search?query=a&key=AIzaSECRET123' Bearer tvly-abc mongodb+srv://u:p@c.net/db")
    assert "AIzaSECRET123" not in msg and "tvly-abc" not in msg and "u:p@c.net" not in msg
