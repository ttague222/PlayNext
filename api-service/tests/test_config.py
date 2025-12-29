"""
Tests for configuration module.

These tests verify settings loading and parsing.
"""

import pytest
from unittest.mock import patch
import os


class TestSettings:
    """Test Settings class."""

    def test_cors_origins_wildcard(self):
        """Test CORS origins with wildcard."""
        from src.core.config import Settings

        with patch.dict(os.environ, {"CORS_ORIGINS": "*"}):
            settings = Settings()
            assert settings.cors_origins_list == ["*"]

    def test_cors_origins_multiple(self):
        """Test CORS origins with multiple values."""
        from src.core.config import Settings

        with patch.dict(os.environ, {"CORS_ORIGINS": "http://localhost:3000,https://example.com"}):
            settings = Settings()
            origins = settings.cors_origins_list
            assert "http://localhost:3000" in origins
            assert "https://example.com" in origins

    def test_default_values(self):
        """Test default configuration values."""
        from src.core.config import Settings

        # Use minimal env to test defaults
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()

            assert settings.app_name == "PlayNxt API"
            assert settings.app_port == 8000
            assert settings.environment == "development"
            assert settings.max_recommendations == 3
            assert settings.rate_limit_requests == 100

    def test_recommendation_settings(self):
        """Test recommendation-specific settings."""
        from src.core.config import Settings

        settings = Settings()

        assert settings.max_recommendations == 3
        assert settings.default_time_bracket == 60
        assert settings.recommendation_cache_ttl == 300

    def test_rate_limit_settings(self):
        """Test rate limiting settings."""
        from src.core.config import Settings

        settings = Settings()

        assert settings.rate_limit_requests > 0
        assert settings.rate_limit_window > 0
