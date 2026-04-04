"""
Gmail IMAP connectivity and targeted mailbox search.

Uses:
- imap.gmail.com:993 with SSL
- Gmail App Password (2FA must be on) — NOT the user's main Google password.

SEARCH criteria are restricted to known transactional senders only (defense in depth).
Still, an App Password grants IMAP access to the whole mailbox; scope minimization
is primarily via SEARCH + product policy.
"""

from __future__ import annotations

import imaplib
import ssl
from typing import List

# Only these From: addresses are queried (per product spec).
ALLOWED_FROM_SENDERS = (
    "auto-confirm@amazon.com",
    "no-reply@uber.com",
)

GMAIL_IMAP_HOST = "imap.gmail.com"
GMAIL_IMAP_PORT = 993


def build_or_search_criteria() -> str:
    """
    IMAP OR criteria for multiple senders.

    Example: (OR FROM "a@b.com" FROM "c@d.com")
    """
    parts = [f'FROM "{addr}"' for addr in ALLOWED_FROM_SENDERS]
    if len(parts) == 1:
        return f"({parts[0]})"
    inner = " OR ".join(parts)
    return f"({inner})"


def fetch_matching_messages(
    gmail_user: str,
    app_password: str,
    max_messages: int = 50,
) -> List[bytes]:
    """
    Connect to Gmail, search INBOX for allowed senders, fetch full RFC822 bodies.

    Returns list of raw email bytes (newest first, up to max_messages).
    """
    ctx = ssl.create_default_context()
    mail = imaplib.IMAP4_SSL(GMAIL_IMAP_HOST, GMAIL_IMAP_PORT, ssl_context=ctx)
    try:
        mail.login(gmail_user, app_password)
        mail.select("INBOX", readonly=True)

        criteria = build_or_search_criteria()
        typ, data = mail.search(None, criteria)
        if typ != "OK" or not data or not data[0]:
            return []

        ids = data[0].split()
        # Newest last in IMAP — reverse and cap
        ids = list(reversed(ids))[:max_messages]

        out: List[bytes] = []
        for num in ids:
            typ, msg_data = mail.fetch(num, "(RFC822)")
            if typ != "OK" or not msg_data or msg_data[0] is None:
                continue
            # msg_data[0] is (b'1 (RFC822) {...}', raw_bytes)
            raw = msg_data[0][1]
            if isinstance(raw, bytes):
                out.append(raw)
        return out
    finally:
        try:
            mail.logout()
        except Exception:
            pass
