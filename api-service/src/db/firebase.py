"""
PlayNext Firebase/Firestore Client

Provides Firebase Admin SDK initialization and Firestore access.
"""

import logging
from pathlib import Path
from typing import Optional

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1 import Client

from ..core.config import settings

logger = logging.getLogger("playnext-api.firebase")

# Global Firestore client
_firestore_client: Optional[Client] = None


def initialize_firebase() -> None:
    """Initialize Firebase Admin SDK."""
    global _firestore_client

    if _firestore_client is not None:
        logger.debug("Firebase already initialized")
        return

    try:
        # Check if already initialized
        firebase_admin.get_app()
        logger.debug("Firebase app already exists")
    except ValueError:
        # Initialize new app
        cred_path = Path(settings.firebase_credentials_path)

        if cred_path.exists():
            cred = credentials.Certificate(str(cred_path))
            firebase_admin.initialize_app(cred, {
                "projectId": settings.firebase_project_id
            })
            logger.info("Firebase initialized with service account")
        elif settings.firebase_project_id:
            # Use default credentials (for Cloud Run)
            firebase_admin.initialize_app(options={
                "projectId": settings.firebase_project_id
            })
            logger.info("Firebase initialized with default credentials")
        else:
            raise ValueError(
                "Firebase credentials not found. "
                "Provide serviceAccountKey.json or set FIREBASE_PROJECT_ID."
            )

    _firestore_client = firestore.client()
    logger.info("Firestore client initialized")


def get_firestore() -> Client:
    """Get the Firestore client instance."""
    if _firestore_client is None:
        initialize_firebase()
    return _firestore_client


def get_collection(collection_name: str):
    """Get a Firestore collection reference."""
    return get_firestore().collection(collection_name)


# Collection names
GAMES_COLLECTION = "games"
USERS_COLLECTION = "users"
SIGNALS_COLLECTION = "user_signals"
SESSIONS_COLLECTION = "sessions"
