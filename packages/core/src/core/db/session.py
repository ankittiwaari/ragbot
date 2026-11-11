from core.config import settings
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

engine = create_async_engine(
    settings.database_url, echo=settings.db_echo, pool_pre_ping=True
)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
