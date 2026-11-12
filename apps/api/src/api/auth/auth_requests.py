import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CreateUserRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    first_name: Annotated[str, Field(min_length=1, max_length=100)]
    last_name: Annotated[str, Field(min_length=1, max_length=100)]
    email: EmailStr
    password: Annotated[str, Field(min_length=8, max_length=128)]


class UserOut(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )  # lets Pydantic read a SQLAlchemy User object

    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    created_at: datetime


class LoginCredentials(BaseModel):
    email: EmailStr
    password: str


class LoginDetails(BaseModel):
    token: str
    user: UserOut
