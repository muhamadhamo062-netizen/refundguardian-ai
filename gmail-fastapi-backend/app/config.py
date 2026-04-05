"""
Application configuration loaded from environment variables.

FERNET_KEY must be set in production — used to encrypt/decrypt Gmail App Passwords at rest.
"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Symmetric key for Fernet (AES + HMAC). Generate once and store in secrets manager.
    fernet_key: str = ""

    openai_api_key: str = ""

    # Local JSON file holding encrypted app passwords (demo only — use a real DB in production).
    credentials_store_path: Path = Path("./data/encrypted_credentials.json")


settings = Settings()
