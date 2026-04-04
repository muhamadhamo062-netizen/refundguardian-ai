"""
AES-based encryption for sensitive credentials (Gmail App Password).

We use Fernet from the cryptography library:
- Under the hood: AES-128 in CBC mode + HMAC-SHA256 for authentication.
- Tokens are url-safe base64 and include timestamp (optional verification).

IMPORTANT: The FERNET_KEY must never be committed to git. Rotate if leaked.
"""

from cryptography.fernet import Fernet, InvalidToken


def get_fernet(fernet_key: str) -> Fernet:
    """Build a Fernet instance from a url-safe base64 32-byte key string."""
    if not fernet_key or not str(fernet_key).strip():
        raise ValueError(
            "FERNET_KEY is missing. Generate with: "
            'python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
        )
    try:
        return Fernet(str(fernet_key).strip().encode("utf-8"))
    except Exception as e:
        raise ValueError("FERNET_KEY is not a valid Fernet key.") from e


def encrypt_secret(plain: str, fernet_key: str) -> str:
    """Encrypt plaintext (e.g. App Password) → base64 token string for storage."""
    f = get_fernet(fernet_key)
    return f.encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt_secret(token: str, fernet_key: str) -> str:
    """Decrypt stored token back to plaintext."""
    f = get_fernet(fernet_key)
    try:
        return f.decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken as e:
        raise ValueError("Could not decrypt credential — wrong FERNET_KEY or corrupted data.") from e
