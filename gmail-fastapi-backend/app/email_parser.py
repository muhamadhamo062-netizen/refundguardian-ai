"""
Parse raw RFC822 email bytes → structured fields (order date, delivery times).

Real merchant templates change often — extend REGEX_PATTERNS and extract_from_soup()
for your production accuracy. This module is intentionally defensive: missing data
returns None instead of crashing.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from email import message_from_bytes
from email.message import Message
from typing import Optional

from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Heuristic regexes (US-centric). Tune per merchant after sampling real emails.
# ---------------------------------------------------------------------------
_US_DATE = re.compile(
    r"\b(?P<m>\d{1,2})[/.-](?P<d>\d{1,2})[/.-](?P<y>\d{2,4})\b",
    re.IGNORECASE,
)
_MONTH_NAME = re.compile(
    r"\b(?P<mon>Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+"
    r"(?P<d>\d{1,2}),?\s+(?P<y>\d{4})\b",
    re.IGNORECASE,
)
_ISO_LIKE = re.compile(
    r"\b(?P<y>\d{4})-(?P<m>\d{2})-(?P<d>\d{2})[T\s](?P<H>\d{2}):(?P<M>\d{2})",
)
_TIME_12 = re.compile(
    r"\b(?P<h>\d{1,2}):(?P<m>\d{2})\s*(?P<ampm>AM|PM)\b",
    re.IGNORECASE,
)
_TIME_24 = re.compile(r"\b(?P<h>\d{1,2}):(?P<m>\d{2})\b")

_MONTH_MAP = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}


@dataclass
class ParsedEmail:
    """One scanned message with extracted timing fields + delay verdict."""

    subject: str
    from_addr: str
    order_date: Optional[datetime] = None
    delivery_time_promised: Optional[datetime] = None  # ETA / window end
    delivery_time_actual: Optional[datetime] = None  # "Delivered at" if found
    is_delayed_over_15_min: bool = False
    delay_reason: str = ""
    raw_text_snippet: str = ""
    complaint_letter: Optional[str] = None  # filled later if delayed
    meta: dict = field(default_factory=dict)


def _parse_us_date(m: re.Match) -> Optional[datetime]:
    mo, d, y = int(m.group("m")), int(m.group("d")), int(m.group("y"))
    if y < 100:
        y += 2000
    try:
        return datetime(y, mo, d)
    except ValueError:
        return None


def _parse_month_name(m: re.Match) -> Optional[datetime]:
    mon = _MONTH_MAP.get(m.group("mon")[:3].lower())
    if not mon:
        return None
    d, y = int(m.group("d")), int(m.group("y"))
    try:
        return datetime(y, mon, d)
    except ValueError:
        return None


def _parse_iso(m: re.Match) -> Optional[datetime]:
    y, mo, d = int(m.group("y")), int(m.group("m")), int(m.group("d"))
    H, M = int(m.group("H")), int(m.group("M"))
    try:
        return datetime(y, mo, d, H, M)
    except ValueError:
        return None


def _combine_date_time(base_date: Optional[datetime], text: str) -> Optional[datetime]:
    """Attach first time found in text to base_date (date-only)."""
    if base_date is None:
        return None
    tm = _TIME_12.search(text)
    if tm:
        h, m = int(tm.group("h")), int(tm.group("m"))
        ampm = tm.group("ampm").upper()
        if ampm == "PM" and h != 12:
            h += 12
        if ampm == "AM" and h == 12:
            h = 0
        try:
            return base_date.replace(hour=h, minute=m, second=0, microsecond=0)
        except ValueError:
            return base_date
    tm = _TIME_24.search(text)
    if tm:
        h, m = int(tm.group("h")), int(tm.group("m"))
        if h > 23:
            return base_date
        try:
            return base_date.replace(hour=h, minute=m, second=0, microsecond=0)
        except ValueError:
            return base_date
    return base_date


def _first_datetime_in_text(text: str) -> Optional[datetime]:
    """Best-effort: first recognizable datetime in blob."""
    for rx, fn in (
        (_ISO_LIKE, _parse_iso),
        (_US_DATE, _parse_us_date),
        (_MONTH_NAME, _parse_month_name),
    ):
        m = rx.search(text)
        if m:
            dt = fn(m)
            if dt:
                if rx is _US_DATE or rx is _MONTH_NAME:
                    return _combine_date_time(dt, text[m.end() : m.end() + 80])
                return dt
    return None


def _flatten_email_parts(msg: Message) -> tuple[str, Optional[str]]:
    """Return (plain_text, html) from multipart message."""
    plain_chunks: list[str] = []
    html_chunks: list[str] = []

    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            if ctype == "text/plain":
                try:
                    plain_chunks.append(part.get_payload(decode=True).decode("utf-8", errors="replace"))
                except Exception:
                    pass
            elif ctype == "text/html":
                try:
                    html_chunks.append(part.get_payload(decode=True).decode("utf-8", errors="replace"))
                except Exception:
                    pass
    else:
        try:
            body = msg.get_payload(decode=True)
            if body:
                decoded = body.decode("utf-8", errors="replace")
                if msg.get_content_type() == "text/html":
                    html_chunks.append(decoded)
                else:
                    plain_chunks.append(decoded)
        except Exception:
            pass

    plain = "\n".join(plain_chunks)
    html = "\n".join(html_chunks) if html_chunks else None
    return plain, html


def _html_to_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    return soup.get_text(separator="\n", strip=True)


def evaluate_delay(
    promised: Optional[datetime],
    actual: Optional[datetime],
    threshold_minutes: int = 15,
) -> tuple[bool, str]:
    """
    Delay rule: actual delivery is more than `threshold_minutes` after promised time.

    If `actual` is missing but promised exists, we cannot prove lateness from email alone
    (we don't know real delivery time) → not delayed for automation purposes.
    """
    if promised is None or actual is None:
        return False, "Insufficient structured times (need both promised and actual delivery times)."
    delta = actual - promised
    if delta > timedelta(minutes=threshold_minutes):
        return True, f"Delivered {delta.total_seconds() / 60:.0f} minutes after promised window end."
    return False, "Within 15 minutes of promised time or early."


def parse_raw_email(raw_bytes: bytes) -> ParsedEmail:
    """
    Main entry: RFC822 bytes → ParsedEmail with order/delivery fields + delay flag.
    """
    msg = message_from_bytes(raw_bytes)
    subject = msg.get("Subject", "") or ""
    from_addr = msg.get("From", "") or ""

    plain, html = _flatten_email_parts(msg)
    text = plain
    if html:
        text = text + "\n" + _html_to_text(html)
    text = text.strip()
    snippet = text[:1200] if len(text) > 1200 else text

    lower = text.lower()
    # Merchant hints (extend as you learn real copy)
    promised = None
    actual = None
    order_dt = _first_datetime_in_text(text)

    # Look for "delivered" / "arrived" lines — often after promised ETA in same email
    if "delivered" in lower or "arrived" in lower or "delivery time" in lower:
        # Naive: last ISO or time-like pair wins for "actual"
        for m in _ISO_LIKE.finditer(text):
            actual = _parse_iso(m) or actual
        if actual is None:
            actual = _first_datetime_in_text(text)

    # Promised: keywords common in shipping emails
    for key in ("expected delivery", "estimated delivery", "arriving by", "delivery window", "by "):
        idx = lower.find(key)
        if idx != -1:
            window = text[idx : idx + 200]
            promised = _first_datetime_in_text(window) or promised

    if promised is None:
        promised = order_dt

    # If we only have one datetime, treat as order_date; try to split promised vs actual heuristically
    od = order_dt
    delayed, reason = evaluate_delay(promised, actual)

    # Second heuristic: explicit "late" / "delay" in marketing/support copy (weak signal)
    if not delayed and actual and promised and actual <= promised + timedelta(minutes=15):
        pass
    elif not delayed and ("running late" in lower or "delayed" in lower) and promised:
        # If email admits delay but we lack actual, optionally mark for human review — here skip OpenAI
        pass

    return ParsedEmail(
        subject=subject,
        from_addr=from_addr,
        order_date=od,
        delivery_time_promised=promised,
        delivery_time_actual=actual,
        is_delayed_over_15_min=delayed,
        delay_reason=reason,
        raw_text_snippet=snippet,
        meta={"parser_version": "1.0-heuristic"},
    )
