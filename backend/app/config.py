from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/ai_txn"
    secret_key: str = "dev-only-secret-change-me-before-deploying-0000"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # Browser origins allowed to call the API (the Vite dev server by default). JSON list in .env.
    # 5173 = Vite (web/), 8081 = Expo's web dev server (mobile/). Native phone builds don't use CORS at all.
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000",
                               "http://localhost:8081", "http://127.0.0.1:8081"]

    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-haiku-4-5-20251001"
    # Suggestions at or above this confidence are applied automatically.
    auto_categorize_threshold: float = 0.75


settings = Settings()
