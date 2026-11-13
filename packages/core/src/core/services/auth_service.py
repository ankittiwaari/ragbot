import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import jwt
from pwdlib import PasswordHash
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.db.models.user import User
from core.services import user_service

ph = PasswordHash.recommended()
_DUMMY_HASH = ph.hash("dummy-password-for-timing")


class EmailTakenError(Exception):
    pass


class InvalidCredentialsError(Exception):
    pass


async def signup(
    db: AsyncSession, email: str, password: str, first_name: str, last_name: str
) -> User:
    hashed_password = await asyncio.to_thread(ph.hash, password)
    user = User(
        email=email,
        first_name=first_name,
        last_name=last_name,
        password_hash=hashed_password,
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        if "uq_users_email_lower" in str(e.orig):
            raise EmailTakenError("Email taken!") from e
        raise
    return user


async def login(db: AsyncSession, email: str, password: str) -> dict[str, Any]:
    user = await user_service.get_by_email(db=db, email=email)
    if user is None:
        await asyncio.to_thread(ph.verify, password, _DUMMY_HASH)
        raise InvalidCredentialsError("Invalid credentials")
    password_matched = await asyncio.to_thread(ph.verify, password, user.password_hash)
    if not password_matched:
        raise InvalidCredentialsError("Invalid credentials")
    token = await create_access_token(user.id)
    return {
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "id": user.id,
        "created_at": user.created_at,
        "token": token,
    }


async def get_user_from_token(db: AsyncSession, token: str) -> User:
    user_id = await decode_access_token(token)
    user = await user_service.get_by_id(db, user_id=user_id)
    if user is None or not user.is_active:
        raise jwt.InvalidTokenError("Invalid token")
    return user


async def create_access_token(user_id):
    now = datetime.now(UTC)
    ttl = timedelta(minutes=settings.access_token_ttl_minutes)
    return jwt.encode(
        {"sub": str(user_id), "iat": now, "exp": now + ttl},
        settings.jwt_secret.get_secret_value(),
        algorithm=settings.jwt_algorithm,
    )


async def decode_access_token(token: str) -> UUID:
    try:
        decoded = jwt.decode(
            token,
            settings.jwt_secret.get_secret_value(),
            algorithms=[settings.jwt_algorithm],
            options={"require": ["sub", "exp"]},
        )
        return UUID(decoded["sub"])
    except (jwt.PyJWTError, ValueError) as e:
        raise jwt.InvalidTokenError("Invalid token") from e
