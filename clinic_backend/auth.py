"""
Authentication helpers — Supabase client creation and user verification.
"""
from typing import Optional
from fastapi import Header, HTTPException, Depends, status
from supabase import create_client
from supabase_auth.errors import AuthApiError
from clinic_backend.config import SUPABASE_URL, SUPABASE_KEY


def get_bearer_token(authorization: Optional[str] = Header(None)) -> str:
    """Extract and return the raw bearer token from the Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )
    return authorization.split(" ", 1)[1]


def create_supabase_client_for_user(access_token: str):
    """Create a Supabase client scoped to the user's session token."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Supabase URL or key is missing")

    if not access_token or len(access_token.split(".")) != 3:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Supabase access token",
        )

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    try:
        sb.auth.set_session(access_token, "")
    except (AuthApiError, IndexError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Supabase access token",
        )
    return sb


def get_current_supabase_user(access_token: str):
    """Return (supabase_client, user_id) for a valid bearer token.

    The session-scoped client ensures Row Level Security is enforced.
    """
    sb = create_supabase_client_for_user(access_token)
    try:
        user_response = sb.auth.get_user(access_token)
    except AuthApiError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Supabase access token",
        )

    user = getattr(user_response, "user", None) if user_response else None
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Supabase access token",
        )

    return sb, user.id
