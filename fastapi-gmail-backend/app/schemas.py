"""Pydantic request/response models."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class GmailConnect(BaseModel):
    gmail_address: EmailStr
    app_password: str = Field(min_length=8, description="Google App Password (16 chars, spaces optional)")


class OrderOut(BaseModel):
    id: int
    source_sender: str
    subject: str
    order_date: Optional[datetime]
    delivery_time: Optional[datetime]
    is_delayed: bool
    delay_minutes: Optional[int]
    complaint_letter: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class OrderUpdate(BaseModel):
    """Allow user to edit notes or clear letter — keep minimal."""

    complaint_letter: Optional[str] = None
    status: Optional[str] = None
