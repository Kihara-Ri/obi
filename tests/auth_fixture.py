"""Authenticator setup for tests that need an owner's session."""
from time import time

from security import STEP_SECONDS, totp_code

# Public interoperability test key from RFC 6238 Appendix B.
TEST_SECRET = b'12345678901234567890'


def current_code():
    return totp_code(TEST_SECRET, int(time()) // STEP_SECONDS)


def enroll_test_owner(auth):
    auth.enroll_totp(TEST_SECRET, current_code())
