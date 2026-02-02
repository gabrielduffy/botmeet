"""
API Token Management Routes
Handles creation, listing, and deletion of API tokens for users.
"""
import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from typing import List
from datetime import datetime

from shared_models.database import get_db
from shared_models.models import APIToken, User
from app.auth import get_user_and_token

router = APIRouter(prefix="/api/tokens", tags=["API Tokens"])


def generate_secure_token() -> str:
    """Generate a secure random API token."""
    return f"vexa_{secrets.token_urlsafe(32)}"


@router.get("/", summary="List all API tokens for the authenticated user")
async def list_tokens(
    auth_data: tuple[str, User] = Depends(get_user_and_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns all API tokens belonging to the authenticated user.
    Does not return the full token value for security.
    """
    token, user = auth_data
    
    stmt = select(APIToken).where(APIToken.user_id == user.id).order_by(APIToken.created_at.desc())
    result = await db.execute(stmt)
    tokens = result.scalars().all()
    
    return {
        "tokens": [
            {
                "id": t.id,
                "token_preview": f"{t.token[:15]}...{t.token[-4:]}",
                "created_at": t.created_at.isoformat()
            }
            for t in tokens
        ]
    }


@router.post("/", status_code=status.HTTP_201_CREATED, summary="Create a new API token")
async def create_token(
    auth_data: tuple[str, User] = Depends(get_user_and_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Creates a new API token for the authenticated user.
    Returns the full token value - this is the ONLY time it will be shown.
    """
    token, user = auth_data
    
    # Generate new token
    new_token_value = generate_secure_token()
    
    # Create token record
    new_token = APIToken(
        token=new_token_value,
        user_id=user.id
    )
    
    db.add(new_token)
    await db.commit()
    await db.refresh(new_token)
    
    return {
        "id": new_token.id,
        "token": new_token_value,  # Full token shown ONLY on creation
        "created_at": new_token.created_at.isoformat(),
        "warning": "Save this token securely. It will not be shown again."
    }


@router.delete("/{token_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete an API token")
async def delete_token(
    token_id: int,
    auth_data: tuple[str, User] = Depends(get_user_and_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Deletes an API token. Users can only delete their own tokens.
    """
    token, user = auth_data
    
    # Verify token belongs to user
    stmt = select(APIToken).where(
        APIToken.id == token_id,
        APIToken.user_id == user.id
    )
    result = await db.execute(stmt)
    token_to_delete = result.scalar_one_or_none()
    
    if not token_to_delete:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token not found or does not belong to you"
        )
    
    # Prevent deleting the currently used token
    if token_to_delete.token == token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the token you are currently using"
        )
    
    await db.delete(token_to_delete)
    await db.commit()
    
    return None
