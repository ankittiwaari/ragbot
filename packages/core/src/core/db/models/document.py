import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from core.db.base import Base
from sqlalchemy import DateTime, ForeignKey, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from core.db.models.chunk import Chunk
    from core.db.models.user import User


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
        primary_key=True,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    source: Mapped[str] = mapped_column(Text)
    active_version: Mapped[str | None] = mapped_column(Text)
    # queued | indexing | ready | failed
    status: Mapped[str] = mapped_column(Text, server_default="queued")
    error: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    tenant: Mapped["User"] = relationship(back_populates="documents", lazy="raise")
    chunks: Mapped[list["Chunk"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="raise",
    )
