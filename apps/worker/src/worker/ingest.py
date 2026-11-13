from core.db.models.document import Document
from core.db.session import SessionLocal
from core.messaging.message import IngestDocument


class PermanentError(Exception):
    """Retrying won't help: corrupt file, unsupported format, etc."""


async def handle_ingest(body: bytes) -> None:
    try:
        payload = IngestDocument.model_validate_json(body)
    except ValueError as e:
        raise PermanentError("bad message") from e

    async with SessionLocal() as db:
        doc = await db.get(Document, payload.document_id)
        if doc is None or doc.status == "ready":
            return

        doc.status = "indexing"
        await db.commit()

        path = doc.source
        try:
            print(path)
        except PermanentError as e:
            doc.status, doc.error = "failed", str(e)
            await db.commit()
            raise

        doc.status, doc.error = "ready", None
        await db.commit()
