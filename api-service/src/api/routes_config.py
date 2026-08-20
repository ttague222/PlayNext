"""
PlayNxt Config Routes

Remote configuration endpoint for mobile app feature flags.
Essential for App Store review control (disable ads without app update).
"""

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from ..core.config import settings

router = APIRouter(prefix="/config", tags=["Config"])


class AppConfig(BaseModel):
    """Remote configuration response model."""

    # Ad control
    ads_enabled: bool = True
    ads_test_mode: bool = False
    # 3 -> 4 on 2026-08-20: direct response to the "ads every 2 suggestions"
    # Play review. Watch ad_watched vs retention in Firebase before tuning again.
    ad_interval: int = 4

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
async def update_app_config(
    config: AppConfig,
    x_cron_secret: Optional[str] = Header(default=None),
):
    """
    Update remote app configuration. Protected by the shared cron secret —
    this was previously unauthenticated, which let anyone flip ads_enabled
    or maintenance_mode on the public API.

    Note: updates in-memory config only (resets on instance restart). The
    durable way to change a flag is editing the AppConfig defaults and
    letting CI redeploy.
    """
    if not settings.cron_secret or x_cron_secret != settings.cron_secret:
        raise HTTPException(status_code=403, detail="Forbidden")
    set_config(config)
    return config
