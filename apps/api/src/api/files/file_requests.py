from uuid import UUID

from pydantic import BaseModel


class UploadFileResponse(BaseModel):
    document_id: UUID
    stored_name: str
    original_name: str
    content_type: str
    size: int
