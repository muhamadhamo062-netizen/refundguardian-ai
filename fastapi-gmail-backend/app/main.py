"""
FastAPI application entry: templates, static files, API routers, DB init.
"""

import logging
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from app.database import Base, engine
from app.dependencies import get_current_user_optional
from app.models import User  # noqa: F401 — register models
from app.routers import auth as auth_router
from app.routers import gmail as gmail_router
from app.routers import orders as orders_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

app = FastAPI(title="Gmail Order Monitor", version="1.0.0")

app.include_router(auth_router.router)
app.include_router(gmail_router.router)
app.include_router(orders_router.router)

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables ensured.")


@app.get("/", response_class=HTMLResponse)
def home(
    request: Request,
    user: Optional[User] = Depends(get_current_user_optional),
):
    if user:
        return RedirectResponse(url="/dashboard", status_code=302)
    return templates.TemplateResponse("login.html", {"request": request})


@app.get("/register", response_class=HTMLResponse)
def page_register(request: Request, user: Optional[User] = Depends(get_current_user_optional)):
    if user:
        return RedirectResponse(url="/dashboard", status_code=302)
    return templates.TemplateResponse("register.html", {"request": request})


@app.get("/dashboard", response_class=HTMLResponse)
def page_dashboard(request: Request, user: Optional[User] = Depends(get_current_user_optional)):
    if not user:
        return RedirectResponse(url="/", status_code=302)
    return templates.TemplateResponse("dashboard.html", {"request": request, "user_email": user.email})
