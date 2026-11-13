import uuid
from typing import Literal

from pydantic import BaseModel


class IngestDocument(BaseModel):
    schema_version: Literal[1] = 1
    document_id: uuid.UUID
    tenant_id: uuid.UUID
