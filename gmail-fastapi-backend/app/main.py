"""
FastAPI application entrypoint.

Endpoints:
  GET  /              — Mobile-friendly HTML form (connect Gmail + scan).
  POST /connect       — Save AES-encrypted App Password for a Gmail address.
  POST /scan          — IMAP fetch → parse → delay check → OpenAI letter if delayed.

Run locally:
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
"""

from __future__ import annotations

import traceback
from typing import List

from fastapi import FastAPI, Form, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse

from app.config import settings
from app.credentials_store import load_encrypted_app_password, save_encrypted_app_password
from app.email_parser import ParsedEmail, parse_raw_email
from app.imap_service import fetch_matching_messages
from app.openai_service import generate_complaint_letter

app = FastAPI(title="Gmail Refund Scanner API", version="1.0.0")


# ---------------------------------------------------------------------------
# Trust / marketing copy (requested verbatim). Review legally before production:
# App Password still grants IMAP access to the mailbox — only SEARCH is narrowed.
# ---------------------------------------------------------------------------
TRUST_HOOK_HTML = (
    "Uses Google App Password for 100% security. No access to your private emails or main password. "
    "We only scan delivery receipts from Amazon, Uber, and DoorDash to find your refunds. Cancel anytime."
)


def _base_styles() -> str:
    """Inline CSS for a simple, large-touch-target mobile layout."""
    return """
    :root { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
    body { margin: 0; padding: 16px; background: #0f1115; color: #e8eaed; max-width: 520px; margin-inline: auto; }
    label { display: block; font-size: 14px; margin-bottom: 6px; color: #bdc1c6; }
    input[type="email"], input[type="password"] {
      width: 100%; box-sizing: border-box; font-size: 16px; padding: 14px 12px;
      border-radius: 12px; border: 1px solid #3c4043; background: #202124; color: #fff;
    }
    .field { margin-bottom: 16px; }
    button[type="submit"] {
      width: 100%; font-size: 18px; font-weight: 600; padding: 16px; border: 0; border-radius: 14px;
      background: #1a73e8; color: #fff; cursor: pointer; margin-top: 8px;
    }
    button[type="submit"]:active { opacity: 0.9; }
    .trust { font-size: 13px; line-height: 1.45; color: #9aa0a6; margin-top: 14px; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    .sub { color: #9aa0a6; font-size: 14px; margin-bottom: 20px; }
    .card { background: #17181c; border: 1px solid #3c4043; border-radius: 16px; padding: 18px; margin-bottom: 18px; }
    pre { white-space: pre-wrap; word-break: break-word; font-size: 12px; background: #000; padding: 10px; border-radius: 8px;}
    a { color: #8ab4f8; }
    """


def _page(title: str, inner: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>{title}</title>
  <style>{_base_styles()}</style>
</head>
<body>
{inner}
</body>
</html>"""


@app.get("/", response_class=HTMLResponse)
async def home() -> str:
    """Serve the connect + scan mobile-friendly forms."""
    inner = f"""
  <h1>RefundGuardian — Gmail</h1>
  <p class="sub">Connect with a Google App Password. Scan transactional senders only.</p>

  <div class="card">
    <h2 style="font-size:17px;margin:0 0 12px;">1. Save App Password (encrypted)</h2>
    <form method="post" action="/connect" autocomplete="on">
      <div class="field">
        <label for="email">Gmail address</label>
        <input id="email" name="email" type="email" required placeholder="you@gmail.com" autocomplete="username"/>
      </div>
      <div class="field">
        <label for="app_password">Google App Password</label>
        <input id="app_password" name="app_password" type="password" required
               placeholder="16-character app password" autocomplete="current-password"/>
      </div>
      <button type="submit">Connect Gmail Securely</button>
      <p class="trust">{TRUST_HOOK_HTML}</p>
    </form>
  </div>

  <div class="card">
    <h2 style="font-size:17px;margin:0 0 12px;">2. Scan for late deliveries</h2>
    <form method="post" action="/scan">
      <div class="field">
        <label for="scan_email">Gmail address (must match saved)</label>
        <input id="scan_email" name="email" type="email" required placeholder="you@gmail.com"/>
      </div>
      <button type="submit">Scan my receipts</button>
    </form>
  </div>
"""
    return _page("Connect Gmail", inner)


@app.post("/connect")
async def connect(email: str = Form(...), app_password: str = Form(...)):
    """
    Receive App Password over HTTPS (TLS), encrypt with Fernet, persist locally.

    Production: never log passwords; use HTTPS termination (nginx / cloud).
    """
    if not settings.fernet_key:
        raise HTTPException(500, "Server misconfigured: FERNET_KEY not set.")

    email_n = email.strip().lower()
    if not email_n.endswith("@gmail.com") and not email_n.endswith("@googlemail.com"):
        # Gmail IMAP still works for Google Workspace in many cases — warn only.
        pass

    try:
        save_encrypted_app_password(email_n, app_password.strip())
    except Exception as e:
        raise HTTPException(500, f"Could not save credentials: {e}") from e

    inner = f"""
  <h1>Saved</h1>
  <p class="sub">Your App Password was encrypted and stored on this server.</p>
  <p><a href="/">← Back</a></p>
"""
    return HTMLResponse(_page("Saved", inner))


@app.post("/scan")
async def scan(email: str = Form(...)):
    """
    Load encrypted App Password, IMAP search allowed senders, parse each message,
    and for delays > 15 minutes call OpenAI for a complaint letter.
    """
    if not settings.fernet_key:
        raise HTTPException(500, "Server misconfigured: FERNET_KEY not set.")
    if not settings.openai_api_key:
        raise HTTPException(500, "Server misconfigured: OPENAI_API_KEY not set.")

    email_n = email.strip().lower()
    app_pw = load_encrypted_app_password(email_n)
    if not app_pw:
        raise HTTPException(400, "No saved App Password for this email. Use Connect first.")

    try:
        raw_messages: List[bytes] = fetch_matching_messages(email_n, app_pw)
    except Exception as e:
        raise HTTPException(502, f"IMAP error (check App Password / IMAP enabled): {e}") from e

    results: List[ParsedEmail] = []
    for raw in raw_messages:
        parsed = parse_raw_email(raw)
        if parsed.is_delayed_over_15_min:
            try:
                parsed.complaint_letter = generate_complaint_letter(parsed)
            except Exception:
                parsed.complaint_letter = f"(OpenAI error: {traceback.format_exc()[:400]})"
        results.append(parsed)

    # Build simple HTML report (mobile-friendly)
    blocks = []
    for i, r in enumerate(results, 1):
        letter = r.complaint_letter or "—"
        blocks.append(
            f"""
  <div class="card">
    <h2 style="font-size:16px;margin:0 0 8px;">Message {i}</h2>
    <p style="font-size:13px;color:#9aa0a6;margin:4px 0;"><b>Subject:</b> {r.subject[:200]}</p>
    <p style="font-size:13px;color:#9aa0a6;margin:4px 0;"><b>From:</b> {r.from_addr[:200]}</p>
    <p style="font-size:13px;margin:8px 0;"><b>Delayed (&gt;15 min):</b> {"Yes" if r.is_delayed_over_15_min else "No"}</p>
    <p style="font-size:13px;color:#9aa0a6;">{r.delay_reason}</p>
    <pre>{letter}</pre>
  </div>
"""
        )

    inner = f"""
  <h1>Scan results</h1>
  <p class="sub">{len(results)} message(s) from allowed senders.</p>
  {''.join(blocks) if blocks else '<p>No matching messages in INBOX.</p>'}
  <p><a href="/">← Back</a></p>
"""
    return HTMLResponse(_page("Results", inner))


@app.get("/api/health")
async def health():
    """JSON health check for load balancers."""
    ok_key = bool(settings.fernet_key)
    ok_ai = bool(settings.openai_api_key)
    return JSONResponse({"status": "ok" if ok_key and ok_ai else "degraded", "fernet": ok_key, "openai": ok_ai})


