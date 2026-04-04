"""AES (Fernet) encryption for Gmail App Passwords at rest."""

import logging
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings

logger = logging.getLogger(__name__)


@lru_cache
def _fernet() -> Fernet:
    key = get_settings().app_encryption_key.strip()
    if not key:
        raise RuntimeError(
            "APP_ENCRYPTION_KEY is not set. Generate one: "
            "`python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"`"
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_secret(plain: str) -> str:
    """Encrypt plaintext; store returned string in DB."""
    return _fernet().encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt_secret(token: str) -> str:
    """Decrypt DB ciphertext to plaintext App Password."""
    try:
        return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except InvalidToken as e:
        logger.error("Failed to decrypt stored secret: wrong APP_ENCRYPTION_KEY?")
        raise ValueError("Could not decrypt credentials") from e
