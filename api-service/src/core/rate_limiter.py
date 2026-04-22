from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from fastapi.responses import JSONResponse

from .config import settings


def get_real_ip(request: Request) -> str:
    """
    Extract real client IP for rate limiting.

    Cloud Run sits behind Google's load balancer, which sets X-Forwarded-For.
    Without this, get_remote_address() sees the proxy IP and rate limits fail —
    all requests appear to come from the same source.

    Taking the last X-Forwarded-For entry is more resilient than the first:
    Google's infrastructure appends the verified client IP as the final entry,
    whereas earlier entries can be set by the client before the request arrives.
    For a recommendation API this tradeoff is acceptable; use Cloud Armor for
    stricter enforcement at scale.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


limiter = Limiter(
    key_func=get_real_ip,
    default_limits=[f"{settings.rate_limit_requests}/minute"]
)


async def rate_limit_exceeded_handler(
    request: Request,
    exc: RateLimitExceeded
) -> JSONResponse:
    """Handle rate limit exceeded errors."""
    return JSONResponse(
        status_code=429,
        content={
            "error": "rate_limit_exceeded",
            "message": "Too many requests. Please try again later.",
            "retry_after": exc.detail
        }
    )
