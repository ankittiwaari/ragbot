import uuid
from typing import TYPE_CHECKING

from core.db.base import Base
from pgvector.sqlalchemy import VECTOR
from sqlalchemy import ARRAY, ForeignKey, Index, Integer, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from core.db.models.document import Document


class Chunk(Base):
    __tablename__ = "chunks"
    __table_args__ = (Index("chunks_hash_idx", "chunk_hash", "embed_model"),)

    doc_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("documents.id", ondelete="CASCADE"),
        primary_key=True,
    )
    doc_version: Mapped[str] = mapped_column(Text, primary_key=True)
    chunk_index: Mapped[int] = mapped_column(Integer, primary_key=True)

    chunk_hash: Mapped[str] = mapped_column(Text)
    # raw text shown to users / the LLM
    content: Mapped[str] = mapped_column(Text)
    # heading path + content: embedded and BM25-indexed
    embed_text: Mapped[str] = mapped_column(Text)
    heading_path: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default="{}")
    pages: Mapped[list[int]] = mapped_column(ARRAY(Integer), server_default="{}")
    item_types: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default="{}")
    # never reuse a vector across embedding models
    embed_model: Mapped[str] = mapped_column(Text)
    # cache only: no vector index, Postgres doesn't search
    embedding: Mapped[list[float]] = mapped_column(VECTOR())

    document: Mapped["Document"] = relationship(back_populates="chunks", lazy="raise")
