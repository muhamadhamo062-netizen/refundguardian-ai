"""
OpenAI: generate a unique, professional US English complaint letter when delay is detected.

Uses the official OpenAI Python SDK (v1). Model defaults to gpt-4o-mini for cost/speed;
override via OPENAI_MODEL env if you add it to Settings later.
"""

from __future__ import annotations

from openai import OpenAI

from app.config import settings
from app.email_parser import ParsedEmail


def generate_complaint_letter(email: ParsedEmail) -> str:
    """Produce a polite, firm complaint suitable for merchant support channels."""

    if not settings.openai_api_key.strip():
        raise RuntimeError("OPENAI_API_KEY is not configured.")

    client = OpenAI(api_key=settings.openai_api_key)

    system = (
        "You write concise, professional complaint letters in US English for late "
        "deliveries. Each letter must be unique (vary wording and structure). "
        "No legal threats. No fabricated facts beyond what the user data provides."
    )

    user_payload = (
        f"Subject: {email.subject}\n"
        f"From header: {email.from_addr}\n"
        f"Order date (if known): {email.order_date}\n"
        f"Promised delivery: {email.delivery_time_promised}\n"
        f"Actual delivery: {email.delivery_time_actual}\n"
        f"Delay summary: {email.delay_reason}\n\n"
        f"Email excerpt:\n{email.raw_text_snippet[:800]}\n\n"
        "Write a short letter (under 220 words) asking for appropriate compensation "
        "or resolution for the late delivery. Include placeholders [Order #] if missing."
    )

    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_payload},
        ],
        temperature=0.9,
        max_tokens=500,
    )
    choice = resp.choices[0].message.content
    return (choice or "").strip()
