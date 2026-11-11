## Project structure

A uv workspace monorepo. The API and the (upcoming) MCP server are separate apps that both import a shared `core` package holding the domain logic: database models, RAG pipeline, storage and services.

```
project/
├── pyproject.toml            # uv workspace root ([tool.uv.workspace] members)
├── uv.lock                   # single lockfile for all Python packages
├── .python-version
├── .env.example              # copy to .env (DATABASE_URL, ...)
├── docker-compose.yml        # Postgres with pgvector
├── README.md
│
├── packages/
│   └── core/                 # shared domain logic, no web framework imports
│       ├── pyproject.toml
│       └── src/core/
│           ├── config.py             # pydantic-settings (env-validated config)
│           ├── db/
│           │   ├── base.py           # DeclarativeBase + constraint naming convention
│           │   ├── session.py        # async engine (asyncpg) + session factory
│           │   └── models/           # document.py, chunk.py
│           ├── rag/
│           │   ├── ingestion/        # loaders.py, chunking.py, pipeline.py
│           │   ├── embeddings.py
│           │   ├── vector_store.py
│           │   ├── retriever.py
│           │   ├── generator.py      # prompt assembly + LLM call
│           │   └── prompts/
│           ├── llm/
│           │   └── client.py         # single OpenRouter client
│           ├── storage/
│           │   ├── base.py           # Storage protocol: save / open / delete
│           │   ├── local.py
│           │   └── s3.py             # later
│           └── services/             # use cases: document_service.py, chat_service.py
│
├── apps/
│   ├── api/                  # FastAPI backend
│   │   ├── pyproject.toml            # depends on core (workspace = true)
│   │   ├── alembic.ini
│   │   ├── migrations/
│   │   │   ├── env.py                # async template, uses core.db.base metadata
│   │   │   └── versions/
│   │   ├── src/api/
│   │   │   ├── main.py               # app, lifespan, routers
│   │   │   ├── deps.py               # get_db, get_storage, ...
│   │   │   ├── routers/              # health.py, documents.py, uploads.py, chat.py
│   │   │   ├── schemas/              # pydantic request/response models
│   │   │   └── middleware/
│   │   └── tests/
│   │
│   ├── mcp_server/           # later: FastMCP tools calling core.services
│   │   ├── pyproject.toml
│   │   └── src/mcp_server/
│   │       ├── server.py
│   │       └── tools/
│   │
│   └── web/                  # React (Vite + TS), not part of the uv workspace
│       ├── package.json
│       ├── vite.config.ts            # proxies /api to localhost:8000
│       └── src/
│           ├── api/                  # client generated from FastAPI's OpenAPI schema
│           ├── components/
│           ├── pages/
│           └── main.tsx
│
├── data/                     # gitignored
│   └── uploads/              # raw uploaded files (local storage backend)
│
└── scripts/                  # seed.py, reindex.py, eval_rag.py
```

### Conventions

- **Logic lives in `core`.** API routers and MCP tools are thin adapters over `core.services`.
- **Dependencies go to the package that imports them**: `uv add --package core <pkg>` or `uv add --package api <pkg>`. Never `pip install` into `.venv`.
- **Models live in `core`, migrations in `apps/api`.** Every new model must be imported in `core/db/models/__init__.py` so Alembic autogenerate sees it.
- **Uploads are stored under generated keys**, never the client's filename; ingestion (parse, chunk, embed) runs after the upload request, not inside it.
