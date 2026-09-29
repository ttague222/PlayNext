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

# 3 -> 4 on 2026-08-20: direct response to the "ads every 2 suggestions" Play
# review. The client's initial results fetch was silently consuming a reroll
# (recordRecommendationFetch() on the first fetch), so the visible ad gate
# effectively fired after 2 rerolls; bumping ad_interval to 4 compensated for
# that off-by-one without a client release. 4 -> 3 on 2026-09-29 now that the
# client bug is fixed (>= 1.5.1 no longer counts the initial fetch): those
# clients get the real default of 3 again. Older clients (< 1.5.1, or an
# unparseable/missing version) still get 4 via the version gate below, since
# they still carry the bug.
LEGACY_AD_INTERVAL = 4
FIXED_CLIENT_VERSION = (1, 5, 1)


def _version_tuple(v: str) -> tuple:
    """Parse a dotted version string into a comparable int tuple.

    Tolerates junk (non-numeric, missing, malformed) by returning (0, 0, 0),
    which sorts as "old" -- the safe default for the buggy fleet.
    """
    try:
        parts = tuple(int(p) for p in v.split("."))
        return parts if parts else (0, 0, 0)
    except (ValueError, AttributeError):
        return (0, 0, 0)


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

    # Clients on old binaries (< 1.5.1) still carry the initial-fetch-counts-
    # as-a-reroll bug, so they still need the compensating ad_interval of 4.
    # Unknown/unparseable versions count as old -- safest for the buggy fleet.
    if _version_tuple(app_version) < FIXED_CLIENT_VERSION:
        config = config.model_copy(update={"ad_interval": LEGACY_AD_INTERVAL})

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
