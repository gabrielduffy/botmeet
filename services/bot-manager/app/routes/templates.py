"""
HTML Template Routes
Serves static HTML pages for the dashboard.
"""
from fastapi import APIRouter
from fastapi.responses import HTMLResponse
import os

router = APIRouter(tags=["Templates"])

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")

@router.get("/tokens", response_class=HTMLResponse, include_in_schema=False)
async def tokens_page():
    """Serve the API tokens management page."""
    tokens_html_path = os.path.join(TEMPLATES_DIR, "tokens.html")
    with open(tokens_html_path, "r", encoding="utf-8") as f:
        return f.read()
