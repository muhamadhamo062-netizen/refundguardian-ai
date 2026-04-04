"""Registration, login, logout — JWT in HttpOnly cookie for browser clients."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.auth_jwt import create_access_token, get_user_by_email, hash_password, verify_password
from app.database import get_db
from app.models import User
from app.schemas import TokenResponse, UserCreate, UserLogin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

COOKIE_NAME = "access_token"


@router.post("/register", response_model=TokenResponse)
def register(user_in: UserCreate, response: Response, db: Session = Depends(get_db)):
    if get_user_by_email(db, user_in.email.lower()):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(email=user_in.email.lower(), hashed_password=hash_password(user_in.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(subject=user.email, user_id=user.id)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        max_age=60 * 60 * 24 * 7,
        samesite="lax",
        secure=False,  # set True behind HTTPS in production
    )
    logger.info("User registered id=%s", user.id)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(creds: UserLogin, response: Response, db: Session = Depends(get_db)):
    user = get_user_by_email(db, creds.email.lower())
    if not user or not verify_password(creds.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_access_token(subject=user.email, user_id=user.id)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        max_age=60 * 60 * 24 * 7,
        samesite="lax",
        secure=False,
    )
    logger.info("User login id=%s", user.id)
    return TokenResponse(access_token=token)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME)
    return {"ok": True}
