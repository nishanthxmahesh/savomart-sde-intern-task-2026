from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 7

    # Admin JWT uses a separate secret + shorter expiry so that even if a
    # customer JWT is leaked, it can never authenticate admin endpoints.
    admin_jwt_secret: str = "dev-admin-secret-change-me-too"
    admin_jwt_expire_hours: int = 8

    # Seeded admin accounts (overrideable via env for production)
    admin_superadmin_email: str = "admin@savomart.in"
    admin_superadmin_password: str = "Admin@123"
    admin_store_manager_email: str = "manager.indiranagar@savomart.in"
    admin_store_manager_password: str = "Store@123"
    admin_store_manager_store_id: str = "indiranagar"

    otp_expire_seconds: int = 300

    stores_api_url: str = "https://internal-service.savomart.in/bridge/api/store/list?is_operational=True"
    stores_api_token: str = "savo-bridge-cron-secret"
    stores_cache_ttl_seconds: int = 300

    cors_origins: str = "http://localhost:5173"

    ai_provider: str = "groq"
    ai_model: str = "llama-3.3-70b-versatile"
    groq_api_key: str = ""

    environment: str = "development"  # "development" | "production"
    frontend_url: str = ""  # additional CORS origin (set in Render env)

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
