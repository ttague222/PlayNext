"""
PlayNext Database

Database clients and utilities.
"""

from .firebase import (
    initialize_firebase,
    get_firestore,
    get_collection,
    GAMES_COLLECTION,
    USERS_COLLECTION,
    SIGNALS_COLLECTION,
    SESSIONS_COLLECTION,
)

__all__ = [
    "initialize_firebase",
    "get_firestore",
    "get_collection",
    "GAMES_COLLECTION",
    "USERS_COLLECTION",
    "SIGNALS_COLLECTION",
    "SESSIONS_COLLECTION",
]
