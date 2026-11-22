import asyncio
from typing import Self

from openai import AsyncOpenAI

from core.config import settings


class AI_Service:
    _instance: Self | None = None
    client: AsyncOpenAI

    def __new__(cls) -> Self:
        if cls._instance is None:
            instance = super().__new__(cls)
            instance.client = AsyncOpenAI(
                base_url=settings.open_router_base_url,
                api_key=settings.open_router_api_key.get_secret_value(),
            )
            cls._instance = instance
        return cls._instance

    @classmethod
    async def _embed_batch(cls, batch: list[str], sem: asyncio.Semaphore):
        async with sem:
            resp = await cls.client.embeddings.create(
                model=settings.embedding_model, input=batch, encoding_format="float"
            )
            if len(resp.data) != len(batch):
                raise RuntimeError(
                    f"Expected {len(batch)} embeddings, got only {len(resp.data)}"
                )
            return [d.embedding for d in sorted(resp.data, key=lambda d: d.index)]

    @classmethod
    async def embed(
        cls, texts: list[str], batch_size: int = 64, concurrency: int = 8
    ) -> list[list[float]]:
        """Embed many texts: batched requests, at most `concurrency` in flight at once.

        For a limit shared by every job in a worker, create one semaphore at startup
        and pass it in instead of creating one per call.
        """
        sem = asyncio.Semaphore(concurrency)
        batches = [texts[i : i + batch_size] for i in range(0, len(texts), batch_size)]
        results = await asyncio.gather(*(cls._embed_batch(b, sem=sem) for b in batches))
        return [v for batch in results for v in batch]

    @classmethod
    async def embed_one(cls, text: str) -> list[float]:
        """Query time: embed a single user query."""
        return (await cls.embed([text]))[0]
