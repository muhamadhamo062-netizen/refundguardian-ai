"""
Application configuration loaded from environment variables.
Never commit real secrets — use a local `.env` file (gitignored).
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings — env vars use UPPER_SNAKE_CASE (e.g. OPENAI_API_KEY)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Gmail Order Monitor"
    secret_key: str = "change-me-in-production-use-long-random-string"  # JWT signing
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # Fernet key: generate with `from cryptography.fernet import Fernet; Fernet.generate_key()`
    app_encryption_key: str = ""

    database_url: str = "sqlite:///./app.db"

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"


@lru_cache
def get_settings() -> Settings:
    return Settings()
