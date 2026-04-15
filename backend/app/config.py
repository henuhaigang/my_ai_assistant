from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    DATABASE_URL: str
    REDIS_URL: str
    OPENAI_API_KEY: Optional[str] = None
    DASHSCOPE_API_KEY: Optional[str] = None
    LLM_PROVIDER: str = "openai"
    OLLAMA_BASE_URL: str = "http://localhost:11434/v1"
    OLLAMA_MODEL: str = "qwen3:30b-a3b"
    OLLAMA_EMBEDDINGS_MODEL: str = "nomic-embed-text"
    CHROMA_PERSIST_DIR: str = "./chroma_data"
    WEATHER_API_KEY: Optional[str] = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
