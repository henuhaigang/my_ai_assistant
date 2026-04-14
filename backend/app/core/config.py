from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    BAIDU_ACCESS_INTERVAL: int = 300  # 默认5分钟（单位：秒）
    
    class Config:
        env_file = ".env"

settings = Settings()