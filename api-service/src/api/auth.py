"""
PlayNext Authentication

Firebase JWT token verification and user context.
"""

import logging
from typing import Optional

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth

logger = logging.getLogger("playnext-api.auth")

# Bearer token security scheme
security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[dict]:
    """
    Verify Firebase JWT token and return user info.

    Returns None for anonymous users (no token provided).
    Raises HTTPException for invalid tokens.
    """
    if credentials is None:
        # Anonymous user - allowed for MVP
        return None

    try:
        token = credentials.credentials
        decoded_token = auth.verify_id_token(token)

        return {
            "uid": decoded_token["uid"],
            "email": decoded_token.get("email"),
            "email_verified": decoded_token.get("email_verified", False),
            "is_anonymous": decoded_token.get("firebase", {}).get("sign_in_provider") == "anonymous",
        }
    except auth.InvalidIdTokenError:
        logger.warning("Invalid ID token provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except auth.ExpiredIdTokenError:
        logger.warning("Expired ID token provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def require_authenticated_user(
    user: Optional[dict] = Depends(get_current_user)
) -> dict:
    """Require an authenticated (non-anonymous) user."""
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def get_user_id(
    user: Optional[dict] = Depends(get_current_user)
) -> Optional[str]:
    """Get just the user ID, or None for anonymous users."""
    return user["uid"] if user else None
