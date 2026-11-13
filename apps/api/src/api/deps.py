from collections.abc import AsyncIterator
from typing import Annotated

import jwt
from core.db.models.user import User
from core.db.session import SessionLocal
from core.messaging.publisher import Publisher
from core.services.auth_service import TokenExpired, get_user_from_token
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


DB = Annotated[AsyncSession, Depends(get_db)]

bearer_scheme = HTTPBearer(auto_error=False)
_credentials_error = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    db: DB,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User:
    if creds is None:
        raise _credentials_error
    try:
        return await get_user_from_token(db=db, token=creds.credentials)
    except (TokenExpired, jwt.InvalidTokenError) as e:
        raise _credentials_error from e


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_publisher(request: Request) -> Publisher:
    return request.app.state.publisher


PublisherDep = Annotated[Publisher, Depends(get_publisher)]
