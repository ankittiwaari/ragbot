from dataclasses import dataclass

import aio_pika
from aio_pika.abc import AbstractChannel, AbstractExchange, AbstractQueue

EXCHANGE = "ragbot"
DLX = "ragbot.dlx"

INGEST_KEY = "documents.ingest"
INGEST_QUEUE = "documents.ingest"
INGEST_DLQ = "documents.ingest.dlq"


@dataclass(frozen=True)
class Topology:
    exchange: AbstractExchange
    ingest_queue: AbstractQueue


async def declare_topology(channel: AbstractChannel) -> Topology:
    exchange = await channel.declare_exchange(
        EXCHANGE, aio_pika.ExchangeType.DIRECT, durable=True
    )
    dlx = await channel.declare_exchange(
        DLX, aio_pika.ExchangeType.DIRECT, durable=True
    )
    dlq = await channel.declare_queue(
        INGEST_DLQ, durable=True, arguments={"x-queue-type": "quorum"}
    )
    await dlq.bind(dlx, routing_key=INGEST_KEY)
    ingest = await channel.declare_queue(
        INGEST_QUEUE,
        durable=True,
        arguments={
            "x-queue-type": "quorum",
            "x-dead-letter-exchange": DLX,
            "x-dead-letter-routing-key": INGEST_KEY,
            "x-delivery-limit": 5,
        },
    )
    await ingest.bind(exchange, routing_key=INGEST_KEY)
    return Topology(exchange=exchange, ingest_queue=ingest)
