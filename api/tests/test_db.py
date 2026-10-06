from db import fingerprint

FWD = "🚨 ZAROORI SUCHNA 🚨\nRBI ne ₹2000 ke note band kar diye hain!"


def test_same_forward_with_different_spacing_emoji_case_matches():
    assert fingerprint(FWD) == fingerprint("zaroori   suchna RBI ne ₹2000 ke NOTE band kar diye hain")


def test_different_message_does_not_match():
    assert fingerprint(FWD) != fingerprint("RBI ne ₹500 ke note band kar diye hain")


def test_hindi_vowel_signs_are_kept():
    # नमस्ते vs नमस्ता differ only by a vowel sign; they must not collide
    assert fingerprint("नमस्ते दोस्तों") != fingerprint("नमस्ता दोस्तों")
    assert fingerprint("नमस्ते  दोस्तों!!") == fingerprint("नमस्ते दोस्तों")
