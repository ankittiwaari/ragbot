from http import HTTPStatus

from core.services import auth_service
from fastapi import APIRouter

from api.auth.auth_requests import (
    CreateUserRequest,
    LoginCredentials,
    LoginDetails,
    UserOut,
)
from api.deps import DB, CurrentUser

auth_router = APIRouter(prefix="/api/v1")


@auth_router.post(
    "/auth/signup", response_model=UserOut, status_code=201, tags=["Auth"]
)
async def signup(user_body: CreateUserRequest, db: DB):
    return await auth_service.signup(
        first_name=user_body.first_name,
        last_name=user_body.last_name,
        email=user_body.email,
        password=user_body.password,
        db=db,
    )


@auth_router.post(
    "/auth/login", response_model=LoginDetails, status_code=HTTPStatus.OK, tags=["Auth"]
)
async def login(credentials: LoginCredentials, db: DB):
    login_data = await auth_service.login(
        db=db, email=credentials.email, password=credentials.password
    )
    return LoginDetails(
        token=login_data["token"],
        user=UserOut(
            id=login_data["id"],
            email=login_data["email"],
            first_name=login_data["first_name"],
            last_name=login_data["last_name"],
            created_at=login_data["created_at"],
        ),
    )


@auth_router.get("/auth/me", response_model=UserOut, tags=["Auth"])
async def me(user: CurrentUser):
    return user
