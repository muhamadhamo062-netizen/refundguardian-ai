"""ORM models: users, Gmail credentials, orders with per-user isolation."""

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    gmail: Mapped[Optional["UserGmail"]] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    orders: Mapped[list["OrderRecord"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class UserGmail(Base):
    """Encrypted App Password storage — one row per user."""

    __tablename__ = "user_gmail"

    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    gmail_address: Mapped[str] = mapped_column(String(255))
    encrypted_app_password: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="gmail")


class OrderRecord(Base):
    """
    Extracted order row per email. Users only access rows where user_id matches JWT.
    """

    __tablename__ = "order_records"
    __table_args__ = (UniqueConstraint("user_id", "email_message_id", name="uq_user_message"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    source_sender: Mapped[str] = mapped_column(String(255))
    email_message_id: Mapped[str] = mapped_column(String(512))
    subject: Mapped[str] = mapped_column(String(1024), default="")
    order_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    delivery_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    raw_excerpt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_delayed: Mapped[bool] = mapped_column(Boolean, default=False)
    delay_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    complaint_letter: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(64), default="processed")  # processed, error, etc.
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="orders")
