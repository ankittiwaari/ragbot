import uuid
from pathlib import Path
from uuid import UUID

import aiofiles
from core.config import ROOT_DIR
from core.db.models.document import Document
from core.messaging.message import IngestDocument
from core.messaging.topology import INGEST_KEY
from fastapi import APIRouter, HTTPException, UploadFile, status

from api.deps import DB, CurrentUser, PublisherDep
from api.files.file_requests import UploadFileResponse

router = APIRouter(prefix="/files")

UPLOAD_DIR = ROOT_DIR / "uploads"
MAX_BYTES = 20 * 1024 * 1024  # 20 MB
CHUNK = 1024 * 1024  # 1 MB
ALLOWED_TYPES = {
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
ALLOWED_EXT = {".pdf", ".txt", ".md", ".docx"}


def get_user_upload_dir(uid: UUID) -> Path:
    return UPLOAD_DIR / str(uid)


def _validate_file(file: UploadFile) -> str:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, f"Extension {ext!r} not allowed"
        )
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, f"TYpe {ext!r} not allowed"
        )
    return ext


@router.post("/", response_model=UploadFileResponse)
async def upload_file(
    file: UploadFile, db: DB, user: CurrentUser, publisher: PublisherDep
):
    upload_dir = get_user_upload_dir(user.id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    ext = _validate_file(file)
    stored_name = f"{uuid.uuid4().hex}{ext}"
    destination = upload_dir / stored_name
    size = 0
    try:
        async with aiofiles.open(destination, "wb") as out:
            while chunk := await file.read(CHUNK):
                size += len(chunk)
                if size > MAX_BYTES:
                    raise HTTPException(
                        status.HTTP_413_CONTENT_TOO_LARGE, "File too large"
                    )
                await out.write(chunk)
        document = Document(
            tenant_id=user.id,
            source=str(destination),
            active_version="01",
            status="queued",
        )
        db.add(document)
        await db.commit()

        await publisher.publish(
            INGEST_KEY,
            IngestDocument(document_id=document.id, tenant_id=user.id),
            message_id=str(document.id),
        )
    except HTTPException:
        destination.unlink(missing_ok=True)
        raise
    finally:
        await file.close()

    return {
        "document_id": document.id,
        "stored_name": stored_name,
        "original_name": file.filename,
        "content_type": file.content_type,
        "size": size,
    }
