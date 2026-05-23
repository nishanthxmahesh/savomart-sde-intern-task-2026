from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 7

    otp_expire_seconds: int = 300

    stores_api_url: str = "https://internal-service.savomart.in/bridge/api/store/list?is_operational=True"
    stores_api_token: str = "savo-bridge-cron-secret"
    stores_cache_ttl_seconds: int = 300

    cors_origins: str = "http://localhost:5173"

    ai_provider: str = "groq"
    ai_model: str = "llama-3.3-70b-versatile"
    groq_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
