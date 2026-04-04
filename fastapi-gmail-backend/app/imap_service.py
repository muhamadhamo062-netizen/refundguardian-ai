"""
Gmail IMAP: connect with App Password, search only whitelisted senders,
parse each message for order/delivery times.
"""

import email
import logging
from email.message import Message
from typing import Callable, List, Set, Tuple

from imapclient import IMAPClient

from app.email_parse import parse_email_for_order

logger = logging.getLogger(__name__)

# Exact allowlist requested by product spec
ALLOWED_FROM = [
    "auto-confirm@amazon.com",
    "no-reply@uber.com",
    "noreply@uber-eats.com",
    "orders@doordash.com",
]

MAX_MESSAGES = 50


def build_search_callback(gmail_user: str, app_password: str) -> Callable[[], List[Tuple[Message, str, str]]]:
    """
    Return a callable that fetches messages and returns list of (Message, source_sender, message_id_header).
    """

    def run_fetch() -> List[Tuple[Message, str, str]]:
        results: List[Tuple[Message, str, str]] = []
        with IMAPClient("imap.gmail.com", ssl=True) as client:
            client.login(gmail_user, app_password.replace(" ", ""))
            client.select_folder("INBOX", readonly=True)
            # Union UIDs from each allowed From address (portable on Gmail IMAP).
            uid_set: Set[int] = set()
            for addr in ALLOWED_FROM:
                try:
                    uid_set.update(client.search(["FROM", addr]))
                except Exception as ex:
                    logger.warning("IMAP search FROM %s failed: %s", addr, ex)
            if not uid_set:
                logger.info("IMAP: no messages matched sender filter for user=%s", gmail_user[:3] + "***")
                return results
            uids = sorted(uid_set)[-MAX_MESSAGES:]
            response = client.fetch(uids, ["RFC822"])
            for uid, data in response.items():
                raw = data.get(b"RFC822")
                if not raw:
                    continue
                msg = email.message_from_bytes(raw)
                from_addr = _first_from(msg)
                if not _allowed_sender(from_addr):
                    continue
                mid = msg.get("Message-ID") or f"generated-{uid}"
                results.append((msg, from_addr.lower(), mid.strip()))
        logger.info("IMAP fetch: %s messages after sender filter", len(results))
        return results

    return run_fetch


def _first_from(msg: Message) -> str:
    from_hdr = msg.get("From", "") or ""
    if "<" in from_hdr:
        part = from_hdr.split("<")[-1].split(">")[0].strip()
        return part.lower()
    return from_hdr.strip().lower()


ALLOWED_SET = {s.lower() for s in ALLOWED_FROM}


def _allowed_sender(address: str) -> bool:
    """Match only the four configured From addresses (after extracting bare email)."""
    a = address.lower().strip()
    return a in ALLOWED_SET


def process_messages(
    pairs: List[Tuple[Message, str, str]],
) -> List[dict]:
    """Turn raw messages into dicts for DB insert."""
    out: List[dict] = []
    for msg, source_sender, message_id in pairs:
        od, dt, excerpt = parse_email_for_order(msg)
        subj = msg.get("Subject", "") or ""
        out.append(
            {
                "source_sender": source_sender,
                "email_message_id": message_id[:500],
                "subject": subj[:1000],
                "order_date": od,
                "delivery_time": dt,
                "raw_excerpt": excerpt,
            }
        )
    return out
