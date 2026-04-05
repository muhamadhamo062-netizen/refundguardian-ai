"""
Tiny JSON file store for encrypted app passwords keyed by Gmail address.

Production: replace with PostgreSQL + KMS, Vault, or cloud secret storage.
"""

import json
from pathlib import Path
from typing import Optional

from app.config import settings
from app.crypto_utils import decrypt_secret, encrypt_secret


def _ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def save_encrypted_app_password(gmail_address: str, app_password_plain: str) -> None:
    """Encrypt app password and persist under the user's email key."""
    path = settings.credentials_store_path
    _ensure_parent(path)

    data: dict = {}
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            data = {}

    token = encrypt_secret(app_password_plain, settings.fernet_key)
    data[gmail_address.lower().strip()] = {"encrypted_app_password": token}
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def load_encrypted_app_password(gmail_address: str) -> Optional[str]:
    """Return decrypted app password if present."""
    path = settings.credentials_store_path
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None

    row = data.get(gmail_address.lower().strip())
    if not row or "encrypted_app_password" not in row:
        return None
    return decrypt_secret(row["encrypted_app_password"], settings.fernet_key)
