from http import HTTPStatus

from core.services import auth_service
from fastapi import FastAPI, Response
from starlette.responses import JSONResponse

from api.auth.auth_router import auth_router

app = FastAPI(
    generate_unique_id_function=lambda route: route.name,
)


@app.exception_handler(auth_service.EmailTakenError)
async def _(request, exc):
    return JSONResponse({"detail": "Email already registered"}, status_code=409)


@app.exception_handler(auth_service.InvalidCredentialsError)
async def _(request, exc):
    return JSONResponse({"detail": "Invalid credentials"}, status_code=401)


@app.get("/health")
async def health():
    return Response(status_code=HTTPStatus.OK)


app.include_router(router=auth_router)
