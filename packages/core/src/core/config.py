from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(ROOT_DIR / ".env",), extra="ignore")
    database_url: str
    db_echo: bool = False
    jwt_secret: SecretStr
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 30
    rabbitmq_url: SecretStr
    worker_prefetch: int = 4
    embed_tokenizer: str
    max_token: int
    open_router_base_url: str
    open_router_api_key: SecretStr
    open_router_model: str
    embedding_model: str


settings = Settings()  # type: ignore
