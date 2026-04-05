"""
OpenAI: optional delay analysis when heuristics are ambiguous, and complaint letter generation.
API key is read only from environment — never hardcoded.
"""

import json
import logging
import math
from datetime import datetime
from typing import Any, Optional, Tuple

from openai import OpenAI

from app.config import get_settings

logger = logging.getLogger(__name__)


def _client() -> OpenAI:
    key = get_settings().openai_api_key.strip()
    if not key:
        raise RuntimeError("OPENAI_API_KEY is not set in the environment.")
    return OpenAI(api_key=key)


def compute_delay_minutes(order_date: Optional[datetime], delivery_time: Optional[datetime]) -> Optional[float]:
    """If both timestamps exist, return minutes from order to delivery (positive = delivery after order)."""
    if not order_date or not delivery_time:
        return None
    try:
        return (delivery_time - order_date).total_seconds() / 60.0
    except Exception:
        return None


def is_delayed_over_15_minutes(
    order_date: Optional[datetime],
    delivery_time: Optional[datetime],
    raw_excerpt: str,
) -> Tuple[bool, Optional[int], str]:
    """
    Decide if delivery is more than 15 minutes late.
    Prefer deterministic math when both datetimes are present; otherwise ask the model once.
    Returns (delayed, delay_minutes_or_none, source_note).
    """
    minutes = compute_delay_minutes(order_date, delivery_time)
    if minutes is not None and not math.isnan(minutes):
        # Negative usually means mis-parsed order vs delivery — fall back to model.
        if minutes >= 0:
            delayed = minutes > 15
            return delayed, int(round(minutes)), "computed_from_timestamps"

    # Ambiguous — use OpenAI on excerpt
    try:
        return _openai_delay_judgment(raw_excerpt or "", order_date, delivery_time)
    except Exception as e:
        logger.exception("OpenAI delay judgment failed: %s", e)
        return False, None, f"openai_error:{e}"


def _openai_delay_judgment(
    excerpt: str,
    order_date: Optional[datetime],
    delivery_time: Optional[datetime],
) -> Tuple[bool, Optional[int], str]:
    """Single JSON-shaped completion for delay classification."""
    client = _client()
    model = get_settings().openai_model
    ctx = {
        "order_date": order_date.isoformat() if order_date else None,
        "delivery_time": delivery_time.isoformat() if delivery_time else None,
        "email_excerpt": excerpt[:6000],
    }
    prompt = (
        "You decide if a delivery was MORE THAN 15 MINUTES late compared to what was promised or expected.\n"
        "Return ONLY valid JSON: {\"delayed\": boolean, \"delay_minutes\": integer or null, \"reason\": string}.\n"
        "If you cannot tell, set delayed=false and delay_minutes=null.\n"
        f"Context JSON: {json.dumps(ctx)}"
    )
    resp = client.chat.completions.create(
        model=model,
        temperature=0.1,
        max_tokens=300,
        messages=[
            {"role": "system", "content": "You output only compact JSON. No markdown."},
            {"role": "user", "content": prompt},
        ],
    )
    text = (resp.choices[0].message.content or "").strip()
    try:
        data = _parse_json_loose(text)
    except Exception:
        logger.warning("OpenAI delay JSON parse failed, body=%s", text[:200])
        return False, None, "openai_parse_failed"
    delayed = bool(data.get("delayed"))
    dm = data.get("delay_minutes")
    delay_int = int(dm) if isinstance(dm, (int, float)) else None
    return delayed, delay_int, "openai_excerpt_analysis"


def _parse_json_loose(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[-1]
        if text.startswith("json"):
            text = text[4:].lstrip()
    return json.loads(text)


def generate_complaint_letter(
    source_sender: str,
    subject: str,
    order_date: Optional[datetime],
    delivery_time: Optional[datetime],
    delay_minutes: Optional[int],
    raw_excerpt: str,
) -> str:
    """Generate a unique, professional US English complaint letter."""
    client = _client()
    model = get_settings().openai_model
    facts = {
        "merchant_from": source_sender,
        "subject": subject,
        "order_date": order_date.isoformat() if order_date else None,
        "delivery_time": delivery_time.isoformat() if delivery_time else None,
        "approx_delay_minutes": delay_minutes,
    }
    user = (
        "Write a short, professional complaint letter to customer support (US English) about a late delivery.\n"
        "Requirements:\n"
        "- Unique wording; do not use a template phrase repeated from common AI letters.\n"
        "- Polite but firm; ask for an appropriate credit or resolution per policy.\n"
        "- Do not claim guaranteed refunds.\n"
        "- 3–6 sentences, one short paragraph.\n"
        "- No markdown, no greeting line like 'Dear Support' unless natural.\n"
        f"Facts JSON: {json.dumps(facts)}\n"
        f"Email excerpt (trimmed): {raw_excerpt[:2000]}"
    )
    resp = client.chat.completions.create(
        model=model,
        temperature=0.85,
        max_tokens=400,
        messages=[
            {
                "role": "system",
                "content": "You write concise consumer complaint letters. No placeholders like [Your name].",
            },
            {"role": "user", "content": user},
        ],
    )
    letter = (resp.choices[0].message.content or "").strip()
    if not letter:
        raise RuntimeError("Empty letter from OpenAI")
    return letter
