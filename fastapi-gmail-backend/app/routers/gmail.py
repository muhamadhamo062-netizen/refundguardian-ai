"""Save Gmail credentials (encrypted) and trigger IMAP scan."""

import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crypto_util import encrypt_secret
from app.database import get_db
from app.dependencies import get_current_user
from app.imap_service import build_search_callback, process_messages
from app.models import OrderRecord, User, UserGmail
from app.openai_service import generate_complaint_letter, is_delayed_over_15_minutes
from app.schemas import GmailConnect

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/gmail", tags=["gmail"])

# IMAP is blocking — run in thread pool with timeout (seconds)
IMAP_TIMEOUT = 120
_executor = ThreadPoolExecutor(max_workers=3)


@router.post("/connect")
def connect_gmail(body: GmailConnect, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Encrypt and store App Password; does not verify IMAP until /scan."""
    row = db.query(UserGmail).filter(UserGmail.user_id == user.id).first()
    enc = encrypt_secret(body.app_password.replace(" ", "").strip())
    if row:
        row.gmail_address = body.gmail_address.lower()
        row.encrypted_app_password = enc
    else:
        row = UserGmail(user_id=user.id, gmail_address=body.gmail_address.lower(), encrypted_app_password=enc)
        db.add(row)
    db.commit()
    logger.info("Gmail credentials updated user_id=%s", user.id)
    return {"ok": True, "message": "Gmail credentials saved securely."}


@router.post("/scan")
def scan_inbox(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """
    Connect via IMAP, fetch allowed senders only, upsert orders, run OpenAI delay + letter when applicable.
    """
    from app.crypto_util import decrypt_secret

    row = db.query(UserGmail).filter(UserGmail.user_id == user.id).first()
    if not row:
        raise HTTPException(status_code=400, detail="Connect Gmail first under Settings.")

    try:
        pw = decrypt_secret(row.encrypted_app_password)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    fetcher = build_search_callback(row.gmail_address, pw)

    try:
        future = _executor.submit(fetcher)
        pairs = future.result(timeout=IMAP_TIMEOUT)
    except FuturesTimeout:
        logger.error("IMAP timeout user_id=%s", user.id)
        raise HTTPException(status_code=504, detail="Gmail connection timed out.") from None
    except Exception as e:
        logger.exception("IMAP failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Gmail connection failed: {e!s}") from e

    parsed = process_messages(pairs)
    inserted = 0
    updated = 0

    for p in parsed:
        existing = (
            db.query(OrderRecord)
            .filter(
                OrderRecord.user_id == user.id,
                OrderRecord.email_message_id == p["email_message_id"],
            )
            .first()
        )
        delayed, delay_minutes, note = is_delayed_over_15_minutes(
            p["order_date"],
            p["delivery_time"],
            p["raw_excerpt"] or "",
        )
        letter = None
        if delayed:
            try:
                letter = generate_complaint_letter(
                    p["source_sender"],
                    p["subject"],
                    p["order_date"],
                    p["delivery_time"],
                    delay_minutes,
                    p["raw_excerpt"] or "",
                )
            except Exception as ex:
                logger.warning("Letter generation failed: %s", ex)
                letter = None

        if existing:
            existing.order_date = p["order_date"]
            existing.delivery_time = p["delivery_time"]
            existing.raw_excerpt = p["raw_excerpt"]
            existing.subject = p["subject"]
            existing.is_delayed = delayed
            existing.delay_minutes = delay_minutes
            if letter:
                existing.complaint_letter = letter
            existing.status = "processed"
            updated += 1
        else:
            rec = OrderRecord(
                user_id=user.id,
                source_sender=p["source_sender"],
                email_message_id=p["email_message_id"],
                subject=p["subject"],
                order_date=p["order_date"],
                delivery_time=p["delivery_time"],
                raw_excerpt=p["raw_excerpt"],
                is_delayed=delayed,
                delay_minutes=delay_minutes,
                complaint_letter=letter,
                status="processed",
            )
            db.add(rec)
            inserted += 1

    db.commit()
    logger.info("Scan complete user_id=%s inserted=%s updated=%s batches=%s", user.id, inserted, updated, len(parsed))
    return {
        "ok": True,
        "messages_fetched": len(parsed),
        "rows_inserted": inserted,
        "rows_updated": updated,
    }
