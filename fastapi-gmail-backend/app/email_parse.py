"""
Heuristic extraction of Order Date and Delivery Time from merchant emails.
Templates change — extend regexes as you collect real samples.
"""

import re
from datetime import datetime
from email.message import Message
from email.utils import parsedate_to_datetime
from typing import Optional, Tuple

# Common US date patterns
US_DATE = re.compile(r"\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b")
ISO_LIKE = re.compile(
    r"\b(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?\b"
)
# Phrases that often precede times
DELIVERY_HINTS = re.compile(
    r"(delivery|delivered|arrival|arrive|estimated\s+delivery|expected\s+by|by\s+\d)",
    re.I,
)


def _parse_us_date(m: re.Match) -> Optional[datetime]:
    mo, d, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if y < 100:
        y += 2000
    try:
        return datetime(y, mo, d)
    except ValueError:
        return None


def _parse_iso_like(m: re.Match) -> Optional[datetime]:
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    H, Mi = int(m.group(4)), int(m.group(5))
    try:
        return datetime(y, mo, d, H, Mi, 0)
    except ValueError:
        return None


def extract_dates_from_text(text: str) -> Tuple[Optional[datetime], Optional[datetime]]:
    """
    Return (order_date, delivery_time) best-effort from full body + headers context.
    Strategy: first ISO-like wins as structured time; scan for delivery-ish section for second time.
    """
    if not text:
        return None, None

    order_date: Optional[datetime] = None
    delivery_time: Optional[datetime] = None

    # ISO timestamps first
    for m in ISO_LIKE.finditer(text):
        dt = _parse_iso_like(m)
        if dt:
            if order_date is None:
                order_date = dt
            elif delivery_time is None and DELIVERY_HINTS.search(text[max(0, m.start() - 80) : m.end() + 80]):
                delivery_time = dt
            elif delivery_time is None:
                delivery_time = dt

    # US dates
    if order_date is None:
        for m in US_DATE.finditer(text):
            order_date = _parse_us_date(m)
            if order_date:
                break

    # If still no delivery_time, use second ISO or last ISO as delivery
    if delivery_time is None:
        iso_matches = list(ISO_LIKE.finditer(text))
        if len(iso_matches) >= 2:
            delivery_time = _parse_iso_like(iso_matches[-1])
        elif len(iso_matches) == 1 and order_date and iso_matches[0]:
            dt = _parse_iso_like(iso_matches[0])
            if dt and dt != order_date:
                delivery_time = dt

    return order_date, delivery_time


def get_body_text(msg: Message) -> str:
    """Flatten multipart email to plain text for parsing."""
    parts: list[str] = []
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            if ctype == "text/plain":
                try:
                    parts.append(part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", errors="replace"))
                except Exception:
                    continue
            elif ctype == "text/html":
                try:
                    raw = part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", errors="replace")
                    # strip tags roughly
                    raw = re.sub(r"<[^>]+>", " ", raw)
                    parts.append(raw)
                except Exception:
                    continue
    else:
        try:
            parts.append(msg.get_payload(decode=True).decode(msg.get_content_charset() or "utf-8", errors="replace"))
        except Exception:
            parts.append(str(msg.get_payload()))
    return "\n".join(parts)


def parse_email_for_order(msg: Message) -> Tuple[Optional[datetime], Optional[datetime], str]:
    """Combine subject + Date header + body for extraction."""
    subject = msg.get("Subject", "") or ""
    date_hdr = msg.get("Date")
    body = get_body_text(msg)
    blob = f"{subject}\n{body}"
    if date_hdr:
        try:
            parsed = parsedate_to_datetime(date_hdr)
            if parsed and not parsed.tzinfo:
                # keep naive UTC for DB simplicity
                pass
        except Exception:
            parsed = None
    else:
        parsed = None

    od, dt = extract_dates_from_text(blob)
    if od is None and parsed:
        od = parsed.replace(tzinfo=None) if parsed.tzinfo is None else parsed.astimezone().replace(tzinfo=None)
    excerpt = (blob[:4000] + "…") if len(blob) > 4000 else blob
    return od, dt, excerpt
