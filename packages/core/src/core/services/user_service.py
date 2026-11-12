from uuid import UUID

from pydantic import EmailStr
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.db.models.user import User


async def get_by_email(db: AsyncSession, email: EmailStr):
    return await db.scalar(select(User).where(func.lower(User.email) == email.lower()))


async def get_by_id(db: AsyncSession, user_id: UUID):
    return await db.get(User, user_id)
