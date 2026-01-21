"""
PlayNxt API

Main FastAPI application entry point.
"""

import logging
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .core.config import settings
from .core.logging_config import setup_logging
from .core.rate_limiter import limiter
from .db.firebase import initialize_firebase
from .api import recommend_router, games_router, signals_router, buckets_router, config_router


# Setup logging
logger = setup_logging(
    app_name="playnxt-api",
    log_level=settings.log_level,
    json_format=settings.log_json_format
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info(f"Starting PlayNxt API ({settings.environment})")

    # Initialize Sentry if configured
    if settings.sentry_dsn:
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.environment,
            traces_sample_rate=0.1,
        )
        logger.info("Sentry initialized")

    # Initialize Firebase
    try:
        initialize_firebase()
        logger.info("Firebase initialized")
    except Exception as e:
        logger.error(f"Failed to initialize Firebase: {e}")
        if settings.environment == "production":
            raise

    yield

    # Shutdown
    logger.info("Shutting down PlayNxt API")


# Create FastAPI app
app = FastAPI(
    title="PlayNxt API",
    description="Time-aware, mood-aware game recommendation API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# Add rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle uncaught exceptions."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)

    if settings.sentry_dsn:
        sentry_sdk.capture_exception(exc)

    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_error",
            "message": "An unexpected error occurred"
        }
    )


# Health check endpoints
@app.get("/health")
async def health_check():
    """Basic health check."""
    return {"status": "healthy", "service": "playnxt-api"}


@app.get("/health/detailed")
async def detailed_health_check():
    """Detailed health check including dependencies."""
    from .db.firebase import get_firestore

    checks = {
        "api": "healthy",
        "firebase": "unknown",
    }

    try:
        # Check Firestore connection
        db = get_firestore()
        db.collection("_health").limit(1).get()
        checks["firebase"] = "healthy"
    except Exception as e:
        checks["firebase"] = f"unhealthy: {str(e)}"

    overall = "healthy" if all(v == "healthy" for v in checks.values()) else "degraded"

    return {
        "status": overall,
        "checks": checks,
        "environment": settings.environment,
    }


# Include routers
app.include_router(recommend_router, prefix="/api")
app.include_router(games_router, prefix="/api")
app.include_router(signals_router, prefix="/api")
app.include_router(buckets_router, prefix="/api")
app.include_router(config_router, prefix="/api")


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "PlayNxt API",
        "version": "1.0.0",
        "description": "What should I play right now?",
        "docs": "/docs" if settings.debug else None,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.debug,
    )
