import aio_pika
from aio_pika.abc import AbstractExchange
from pydantic import BaseModel


class Publisher:
    def __init__(self, exchange: AbstractExchange) -> None:
        self._exchange = exchange

    async def publish(
        self, routing_key: str, msg: BaseModel, *, message_id: str
    ) -> None:
        await self._exchange.publish(
            aio_pika.Message(
                body=msg.model_dump_json().encode(),
                content_type="application/json",
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                message_id=message_id,
            ),
            routing_key=routing_key,
        )
