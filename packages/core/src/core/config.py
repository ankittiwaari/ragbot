from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(ROOT_DIR / ".env",), extra="ignore")
    database_url: str
    db_echo: bool = False
    jwt_secret: SecretStr  # from pydantic; keeps it out of logs
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 30


settings = Settings()  # type: ignore
