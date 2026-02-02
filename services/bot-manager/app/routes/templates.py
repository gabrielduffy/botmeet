"""
HTML Template Routes
Serves static HTML pages for the dashboard.
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
import os
import logging

router = APIRouter(tags=["Templates"])
logger = logging.getLogger(__name__)

# Try multiple possible paths for templates
def get_templates_dir():
    possible_paths = [
        os.path.join(os.path.dirname(__file__), "..", "templates"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates"),
        "/app/services/bot-manager/app/templates",
        "./app/templates"
    ]
    
    for path in possible_paths:
        abs_path = os.path.abspath(path)
        if os.path.exists(abs_path):
            logger.info(f"Found templates directory at: {abs_path}")
            return abs_path
    
    logger.error("Templates directory not found in any expected location")
    return None

@router.get("/tokens", response_class=HTMLResponse, include_in_schema=False)
async def tokens_page():
    """Serve the API tokens management page."""
    templates_dir = get_templates_dir()
    
    if not templates_dir:
        raise HTTPException(status_code=500, detail="Templates directory not found")
    
    tokens_html_path = os.path.join(templates_dir, "tokens.html")
    
    if not os.path.exists(tokens_html_path):
        logger.error(f"tokens.html not found at: {tokens_html_path}")
        raise HTTPException(status_code=404, detail="Tokens page not found")
    
    try:
        with open(tokens_html_path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        logger.error(f"Error reading tokens.html: {e}")
        raise HTTPException(status_code=500, detail="Error loading tokens page")
