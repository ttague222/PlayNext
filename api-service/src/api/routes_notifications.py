"""
PlayNxt Notification Routes — device registration + weekly send trigger.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from ..core.config import settings
from ..services import get_notification_service
from .auth import get_user_id

logger = logging.getLogger("playnext-api.routes.notifications")

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class RegisterRequest(BaseModel):
    expo_push_token: str
    platform: str


class UnregisterRequest(BaseModel):
    expo_push_token: str


@router.post("/register")
async def register(body: RegisterRequest, user_id: Optional[str] = Depends(get_user_id)):
    """Register or refresh a device's push token (anonymous devices allowed)."""
    service = get_notification_service()
    if not service.register_device(body.expo_push_token, body.platform, user_id):
        raise HTTPException(status_code=400, detail="Invalid push token")
    return {"message": "registered"}


@router.post("/unregister")
async def unregister(body: UnregisterRequest):
    """Disable notifications for a device."""
    get_notification_service().unregister_device(body.expo_push_token)
    return {"message": "unregistered"}


@router.post("/send-weekly")
async def send_weekly(x_cron_secret: Optional[str] = Header(default=None)):
    """Trigger the weekly send. Protected by a shared secret (Cloud Scheduler)."""
    if not settings.cron_secret or x_cron_secret != settings.cron_secret:
        raise HTTPException(status_code=403, detail="Forbidden")
    result = await get_notification_service().run_weekly_send()
    return result
