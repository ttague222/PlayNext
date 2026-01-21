"""
PlayNxt Config Routes

Remote configuration endpoint for mobile app feature flags.
Essential for App Store review control (disable ads without app update).
"""

from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/config", tags=["Config"])


class AppConfig(BaseModel):
    """Remote configuration response model."""

    # Ad control
    ads_enabled: bool = True
    ads_test_mode: bool = False
    ad_interval: int = 3

    # Feature flags
    maintenance_mode: bool = False
    premium_enabled: bool = True

    # Version control
    min_app_version: str = "1.0.0"
    force_update: bool = False

    # Optional announcement
    announcement: Optional[str] = None


# In-memory config (can be replaced with Firestore for dynamic updates)
_config = AppConfig()


def get_config() -> AppConfig:
    """
    Get current configuration.

    In production, this could fetch from Firestore for dynamic updates:

    ```python
    from ..db.firebase import get_firestore
    db = get_firestore()
    doc = db.collection("config").document("app").get()
    if doc.exists:
        return AppConfig(**doc.to_dict())
    return AppConfig()
    ```
    """
    return _config


def set_config(config: AppConfig):
    """Update in-memory configuration."""
    global _config
    _config = config


@router.get("", response_model=AppConfig)
async def get_app_config(request: Request):
    """
    Get remote app configuration.

    Returns feature flags and settings that can be updated without
    releasing a new app version. Essential for:

    - Disabling ads during App Store review
    - A/B testing features
    - Emergency maintenance mode
    - Force update prompts

    Example response:
    ```json
    {
        "ads_enabled": true,
        "ads_test_mode": false,
        "ad_interval": 3,
        "maintenance_mode": false,
        "premium_enabled": true,
        "min_app_version": "1.0.0",
        "force_update": false,
        "announcement": null
    }
    ```
    """
    config = get_config()

    # Log request info for debugging (optional)
    app_version = request.headers.get("X-App-Version", "unknown")
    platform = request.headers.get("X-Platform", "unknown")

    # Could add version-specific config logic here
    # if app_version < "1.1.0":
    #     config.force_update = True

    return config


@router.post("", response_model=AppConfig)
async def update_app_config(config: AppConfig):
    """
    Update remote app configuration.

    This endpoint allows updating the configuration dynamically.
    In production, consider:
    - Adding authentication (admin only)
    - Persisting to Firestore
    - Adding audit logging

    For now, this updates in-memory config (resets on restart).
    """
    set_config(config)
    return config
