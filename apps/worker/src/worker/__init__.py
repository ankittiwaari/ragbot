import asyncio

import aio_pika
from aio_pika.abc import AbstractIncomingMessage
from core.config import settings
from core.messaging.topology import declare_topology

from worker.ingest import PermanentError, handle_ingest


async def on_message(message: AbstractIncomingMessage) -> None:
    try:
        await handle_ingest(message.body)
    except PermanentError:
        await message.reject(requeue=False)
    except Exception:
        await message.nack(requeue=True)
    else:
        await message.ack()


async def run() -> None:
    connection = await aio_pika.connect_robust(settings.rabbitmq_url.get_secret_value())
    async with connection:
        channel = await connection.channel()
        await channel.set_qos(prefetch_count=settings.worker_prefetch)
        topology = await declare_topology(channel)

        await topology.ingest_queue.consume(on_message)
        await asyncio.Future()


def main() -> None:
    asyncio.run(run())
