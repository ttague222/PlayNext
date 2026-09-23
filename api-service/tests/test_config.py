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


VALID_STEAM_KEY = "0123456789ABCDEF0123456789ABCDEF"


class TestSteamWebApiKeyValidation:
    """Steam key sanitization — guards against shell-ingestion corruption
    (e.g. a stored secret containing `-n "<key>"` plus CRLF from cmd.exe)."""

    def test_valid_key_passes_through(self):
        from src.core.config import Settings

        with patch.dict(os.environ, {"STEAM_WEB_API_KEY": VALID_STEAM_KEY}):
            settings = Settings()
            assert settings.steam_web_api_key == VALID_STEAM_KEY

    def test_surrounding_whitespace_and_crlf_stripped(self):
        from src.core.config import Settings

        with patch.dict(os.environ, {"STEAM_WEB_API_KEY": f"  {VALID_STEAM_KEY}\r\n"}):
            settings = Settings()
            assert settings.steam_web_api_key == VALID_STEAM_KEY

    def test_echo_n_artifact_rejected_and_logged(self, caplog):
        """The 2026-09-21 production incident: secret contained `-n "<key>"`."""
        from src.core.config import Settings

        with patch.dict(os.environ, {"STEAM_WEB_API_KEY": f'-n "{VALID_STEAM_KEY}"\r\n'}):
            with caplog.at_level("ERROR", logger="playnext-api.config"):
                settings = Settings()
        assert settings.steam_web_api_key is None
        assert any("steam_web_api_key" in r.message for r in caplog.records)

    def test_malformed_value_never_logged_verbatim(self, caplog):
        from src.core.config import Settings

        with patch.dict(os.environ, {"STEAM_WEB_API_KEY": f'-n "{VALID_STEAM_KEY}"'}):
            with caplog.at_level("ERROR", logger="playnext-api.config"):
                Settings()
        assert all(VALID_STEAM_KEY not in r.getMessage() for r in caplog.records)

    def test_non_hex_key_rejected(self):
        from src.core.config import Settings

        with patch.dict(os.environ, {"STEAM_WEB_API_KEY": "Z" * 32}):
            settings = Settings()
            assert settings.steam_web_api_key is None

    def test_wrong_length_key_rejected(self):
        from src.core.config import Settings

        with patch.dict(os.environ, {"STEAM_WEB_API_KEY": "ABCDEF0123"}):
            settings = Settings()
            assert settings.steam_web_api_key is None

    def test_empty_and_whitespace_only_treated_as_unset(self):
        from src.core.config import Settings

        for raw in ("", "   ", "\r\n"):
            with patch.dict(os.environ, {"STEAM_WEB_API_KEY": raw}):
                settings = Settings()
                assert settings.steam_web_api_key is None

    def test_unset_key_stays_none(self):
        from src.core.config import Settings

        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()
            assert settings.steam_web_api_key is None
