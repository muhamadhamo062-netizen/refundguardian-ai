"""
Deprecated backend.

This repository is now Supabase-authenticated Next.js only.
Do not deploy this service; it intentionally returns 410 for all requests.
"""

from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI(title="Deprecated", version="0.0.0")


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
def deprecated(_path: str):
    return JSONResponse({"ok": False, "error": "deprecated"}, status_code=410)
