"""
PlayNext API Configuration

Centralized configuration using Pydantic Settings.
All configuration is loaded from environment variables.
"""

from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = {
        "env_file": str(Path(__file__).parent.parent.parent / ".env"),
        "case_sensitive": False,
        "extra": "ignore",
    }

    # Firebase
    firebase_credentials_path: str = "serviceAccountKey.json"
    firebase_project_id: Optional[str] = None

    # OpenAI (for embeddings)
    openai_api_key: Optional[str] = None
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536

    # Pinecone (vector database)
    pinecone_api_key: Optional[str] = None
    pinecone_index_name: str = "playnxt-games"
    pinecone_environment: str = "us-east-1"

    # Application
    app_name: str = "PlayNxt API"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    environment: str = "development"
    debug: bool = False

    # CORS
    cors_origins: str = "*"

    # Rate Limiting
    rate_limit_requests: int = 100
    rate_limit_window: int = 60  # seconds

    # Logging
    log_level: str = "INFO"
    log_json_format: bool = True
    log_dir: str = "logs"

    # Error Tracking
    sentry_dsn: Optional[str] = None

    # Recommendation Engine
    max_recommendations: int = 3
    default_time_bracket: int = 60  # minutes
    recommendation_cache_ttl: int = 300  # seconds

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins from comma-separated string."""
        if self.cors_origins == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_origins.split(",")]


# Global settings instance
settings = Settings()
