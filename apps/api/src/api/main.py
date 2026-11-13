from contextlib import asynccontextmanager
from http import HTTPStatus

import aio_pika
from core.config import settings
from core.messaging.publisher import Publisher
from core.messaging.topology import declare_topology
from core.services import auth_service
from fastapi import FastAPI, Response
from starlette.responses import JSONResponse

from api.auth.auth_router import auth_router
from api.files import file_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    connection = await aio_pika.connect_robust(settings.rabbitmq_url.get_secret_value())
    channel = await connection.channel(publisher_confirms=True)
    topology = await declare_topology(channel=channel)
    app.state.publisher = Publisher(topology.exchange)
    try:
        yield
    finally:
        await connection.close()


app = FastAPI(
    lifespan=lifespan,
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
app.include_router(router=file_router.router)
