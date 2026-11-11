import uuid
from datetime import datetime
from http import HTTPStatus
from typing import Annotated

from core.services import auth_service
from fastapi import APIRouter, FastAPI, Response
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from starlette.responses import JSONResponse

from api.deps import DB

app = FastAPI(
    generate_unique_id_function=lambda route: route.name,
)
router = APIRouter(prefix="/api/v1")


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


@app.exception_handler(auth_service.EmailTakenError)
async def _(request, exc):
    return JSONResponse({"detail": "Email already registered"}, status_code=409)


@app.get("/health")
async def health():
    return Response(status_code=HTTPStatus.OK)


@router.post("/auth/signup", response_model=UserOut, status_code=201, tags=["Auth"])
async def signup(user_body: CreateUserRequest, db: DB):
    return await auth_service.signup(
        first_name=user_body.first_name,
        last_name=user_body.last_name,
        email=user_body.email,
        password=user_body.password,
        db=db,
    )


app.include_router(router=router)
