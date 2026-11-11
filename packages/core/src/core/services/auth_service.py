from core.db.models.user import User
from pwdlib import PasswordHash
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

ph = PasswordHash.recommended()


class EmailTakenError(Exception):
    pass


async def signup(
    db: AsyncSession, email: str, password: str, first_name: str, last_name: str
) -> User:
    hash = ph.hash(password)
    user = User(
        email=email, first_name=first_name, last_name=last_name, password_hash=hash
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        if "uq_users_email_lower" in str(e.orig):
            raise EmailTakenError("Email taken!")
    return user
