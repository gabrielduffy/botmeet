from fastapi import Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import logging
import os

from shared_models.models import User, APIToken
from shared_models.database import get_db

logger = logging.getLogger("bot_manager.auth")

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)

async def get_api_key(api_key: str = Security(API_KEY_HEADER),
                    db: AsyncSession = Depends(get_db)) -> tuple[str, User]:
    """Dependency to verify X-API-Key and return the (api_key_string, User_object) tuple."""
    if not api_key:
        logger.warning("API token missing from header")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing API token (X-API-Key header)"
        )
    
    # Try to validate against ADMIN_TOKEN from environment
    admin_token_env = os.getenv("ADMIN_TOKEN") or os.getenv("ADMIN_API_TOKEN")
    if admin_token_env and api_key == admin_token_env:
        logger.info("Admin token validated from environment")
        
        # We MUST have a user in the database to link his ID to the tokens
        result = await db.execute(select(User).order_by(User.id))
        user_obj = result.scalars().first()
        
        if not user_obj:
            logger.info("No users found in DB, creating system admin user")
            user_obj = User(
                email="admin@benemax.com.br", 
                name="System Administrator",
                # id logic typically handled by DB, but we need it here
            )
            db.add(user_obj)
            await db.commit()
            await db.refresh(user_obj)
            
        return (api_key, user_obj)

    # Log the API key received for debugging
    logger.info(f"Received API key: {api_key[:5]}...")
    
    # Find the token in the database
    result = await db.execute(
        select(APIToken, User)
        .join(User, APIToken.user_id == User.id)
        .where(APIToken.token == api_key)
    )
    token_user = result.first()
    
    if not token_user:
        logger.warning(f"Invalid API token provided: {api_key[:5]}...")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API token"
        )
    
    # Extract User object from the result row
    user_obj = token_user[1] # Assuming User is the second element
    if not isinstance(user_obj, User):
         logger.error(f"get_api_key did not retrieve a valid User object: {type(user_obj)}")
         raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Authentication data error")

    logger.info(f"API key validated for user {user_obj.id}. Returning key string and user object.")
    return (api_key, user_obj)

async def get_user_and_token(token_user_tuple: tuple[str, User] = Depends(get_api_key)) -> tuple[str, User]:
    """Dependency to unpack and provide the (api_key_string, User_object) tuple."""
    # Basic validation, could add more type checks if needed
    if not isinstance(token_user_tuple, tuple) or len(token_user_tuple) != 2:
        logger.error(f"get_user_and_token received invalid input: {type(token_user_tuple)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Authentication processing error")
    logger.info(f"Providing API key and User object for user {token_user_tuple[1].id}")
    return token_user_tuple # Return the tuple (api_key_string, User_object)

async def get_current_user(user_and_token: tuple[str, User] = Depends(get_user_and_token)) -> User:
    """Dependency to get only the User object from the (api_key_string, User) tuple."""
    _api_key, user = user_and_token # Unpack the tuple
    logger.info(f"get_current_user providing User object for user {user.id}")
    return user # Return only the User object

# --- Remove Admin Auth --- 
# async def verify_admin_token(admin_token: str = Security(API_KEY_HEADER)):
#    ... 