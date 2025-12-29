"""
PlayNext API Routes

FastAPI route definitions.
"""

from .routes_recommend import router as recommend_router
from .routes_games import router as games_router
from .routes_signals import router as signals_router

__all__ = [
    "recommend_router",
    "games_router",
    "signals_router",
]
