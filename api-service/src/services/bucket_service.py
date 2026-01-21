"""
PlayNext Bucket Service

Service for managing user save buckets (game collections).
"""

import logging
import uuid
from datetime import datetime
from typing import Optional

from ..db.firebase import get_collection, BUCKETS_COLLECTION
from ..models import (
    BucketType,
    BUCKET_CONFIG,
    Bucket,
    BucketGame,
    BucketWithGames,
    BucketSummary,
    UserBucketsResponse,
    AddGameToBucketRequest,
)

logger = logging.getLogger("playnext-api.buckets")


class BucketService:
    """Service for managing user save buckets."""

    def __init__(self):
        self.buckets_collection = get_collection(BUCKETS_COLLECTION)

    def _get_user_bucket_ref(self, user_id: str, bucket_type: BucketType):
        """Get reference to a user's bucket document."""
        return self.buckets_collection.document(user_id).collection("buckets").document(bucket_type.value)

    def _get_bucket_games_ref(self, user_id: str, bucket_type: BucketType):
        """Get reference to games subcollection in a bucket."""
        return self._get_user_bucket_ref(user_id, bucket_type).collection("games")

    async def ensure_user_buckets(self, user_id: str) -> list[BucketSummary]:
        """
        Ensure all default buckets exist for a user.
        Creates any missing buckets with default settings.
        Returns list of all user buckets.
        """
        buckets = []
        now = datetime.utcnow()

        for bucket_type in BucketType:
            config = BUCKET_CONFIG[bucket_type]
            bucket_ref = self._get_user_bucket_ref(user_id, bucket_type)
            doc = bucket_ref.get()

            if not doc.exists:
                # Create the bucket
                bucket_data = {
                    "bucket_id": f"{user_id}_{bucket_type.value}",
                    "user_id": user_id,
                    "bucket_type": bucket_type.value,
                    "name": config["name"],
                    "icon": config["icon"],
                    "emoji": config["emoji"],
                    "color": config["color"],
                    "game_count": 0,
                    "created_at": now,
                    "updated_at": now,
                }
                bucket_ref.set(bucket_data)
                logger.info(f"Created bucket {bucket_type.value} for user {user_id}")
            else:
                bucket_data = doc.to_dict()

            buckets.append(BucketSummary(
                bucket_id=bucket_data.get("bucket_id", f"{user_id}_{bucket_type.value}"),
                bucket_type=bucket_type,
                name=bucket_data.get("name", config["name"]),
                icon=bucket_data.get("icon", config["icon"]),
                emoji=bucket_data.get("emoji", config["emoji"]),
                color=bucket_data.get("color", config["color"]),
                game_count=bucket_data.get("game_count", 0),
            ))

        # Sort by order defined in config
        buckets.sort(key=lambda b: BUCKET_CONFIG[b.bucket_type]["order"])
        return buckets

    async def get_user_buckets(self, user_id: str) -> UserBucketsResponse:
        """Get all buckets for a user."""
        buckets = await self.ensure_user_buckets(user_id)
        total_games = sum(b.game_count for b in buckets)

        return UserBucketsResponse(
            buckets=buckets,
            total_games=total_games,
        )

    async def get_bucket_with_games(
        self,
        user_id: str,
        bucket_type: BucketType,
        limit: int = 50,
        offset: int = 0
    ) -> BucketWithGames:
        """Get a bucket with its games."""
        # Ensure bucket exists
        await self.ensure_user_buckets(user_id)

        bucket_ref = self._get_user_bucket_ref(user_id, bucket_type)
        bucket_doc = bucket_ref.get()

        if not bucket_doc.exists:
            raise ValueError(f"Bucket {bucket_type.value} not found")

        bucket_data = bucket_doc.to_dict()
        config = BUCKET_CONFIG[bucket_type]

        # Get games - simple query without ordering to avoid index requirements
        games_ref = self._get_bucket_games_ref(user_id, bucket_type)
        games_docs = games_ref.limit(limit).stream()

        games = []
        for doc in games_docs:
            game_data = doc.to_dict()
            games.append(BucketGame(
                game_id=game_data.get("game_id", doc.id),
                game_title=game_data.get("game_title", "Unknown Game"),
                added_at=game_data.get("added_at", datetime.utcnow()),
                notes=game_data.get("notes"),
            ))

        # Sort by added_at in Python (most recent first)
        games.sort(key=lambda g: g.added_at, reverse=True)

        return BucketWithGames(
            bucket_id=bucket_data.get("bucket_id", f"{user_id}_{bucket_type.value}"),
            user_id=user_id,
            bucket_type=bucket_type,
            name=bucket_data.get("name", config["name"]),
            icon=bucket_data.get("icon", config["icon"]),
            emoji=bucket_data.get("emoji", config["emoji"]),
            color=bucket_data.get("color", config["color"]),
            game_count=bucket_data.get("game_count", 0),
            created_at=bucket_data.get("created_at", datetime.utcnow()),
            updated_at=bucket_data.get("updated_at", datetime.utcnow()),
            games=games,
        )

    async def add_game_to_bucket(
        self,
        user_id: str,
        bucket_type: BucketType,
        request: AddGameToBucketRequest
    ) -> BucketGame:
        """Add a game to a bucket."""
        # Ensure bucket exists
        await self.ensure_user_buckets(user_id)

        # Check if game already exists in this bucket
        games_ref = self._get_bucket_games_ref(user_id, bucket_type)
        existing = games_ref.document(request.game_id).get()

        now = datetime.utcnow()

        if existing.exists:
            # Update existing entry
            games_ref.document(request.game_id).update({
                "notes": request.notes,
                "added_at": now,  # Bump to top
            })
            logger.info(f"Updated game {request.game_id} in bucket {bucket_type.value}")
        else:
            # Add new game
            game_data = {
                "game_id": request.game_id,
                "game_title": request.game_title,
                "added_at": now,
                "notes": request.notes,
            }
            games_ref.document(request.game_id).set(game_data)

            # Update game count
            bucket_ref = self._get_user_bucket_ref(user_id, bucket_type)
            bucket_ref.update({
                "game_count": firestore_increment(1),
                "updated_at": now,
            })
            logger.info(f"Added game {request.game_id} to bucket {bucket_type.value}")

        # Remove from other buckets (a game can only be in one bucket)
        for other_type in BucketType:
            if other_type != bucket_type:
                await self._remove_game_if_exists(user_id, other_type, request.game_id)

        return BucketGame(
            game_id=request.game_id,
            game_title=request.game_title,
            added_at=now,
            notes=request.notes,
        )

    async def _remove_game_if_exists(
        self,
        user_id: str,
        bucket_type: BucketType,
        game_id: str
    ) -> bool:
        """Remove a game from a bucket if it exists. Returns True if removed."""
        games_ref = self._get_bucket_games_ref(user_id, bucket_type)
        game_doc = games_ref.document(game_id).get()

        if game_doc.exists:
            games_ref.document(game_id).delete()
            bucket_ref = self._get_user_bucket_ref(user_id, bucket_type)
            bucket_ref.update({
                "game_count": firestore_increment(-1),
                "updated_at": datetime.utcnow(),
            })
            logger.info(f"Removed game {game_id} from bucket {bucket_type.value}")
            return True
        return False

    async def remove_game_from_bucket(
        self,
        user_id: str,
        bucket_type: BucketType,
        game_id: str
    ) -> bool:
        """Remove a game from a specific bucket."""
        removed = await self._remove_game_if_exists(user_id, bucket_type, game_id)
        if not removed:
            raise ValueError(f"Game {game_id} not found in bucket {bucket_type.value}")
        return True

    async def move_game(
        self,
        user_id: str,
        from_bucket_type: BucketType,
        to_bucket_type: BucketType,
        game_id: str
    ) -> BucketGame:
        """Move a game from one bucket to another."""
        # Get game data from source bucket
        from_games_ref = self._get_bucket_games_ref(user_id, from_bucket_type)
        game_doc = from_games_ref.document(game_id).get()

        if not game_doc.exists:
            raise ValueError(f"Game {game_id} not found in bucket {from_bucket_type.value}")

        game_data = game_doc.to_dict()

        # Add to destination using the add method (handles count updates)
        return await self.add_game_to_bucket(
            user_id,
            to_bucket_type,
            AddGameToBucketRequest(
                game_id=game_data["game_id"],
                game_title=game_data["game_title"],
                notes=game_data.get("notes"),
            )
        )

    async def get_game_bucket(
        self,
        user_id: str,
        game_id: str
    ) -> Optional[BucketType]:
        """Find which bucket a game is in, if any."""
        for bucket_type in BucketType:
            games_ref = self._get_bucket_games_ref(user_id, bucket_type)
            game_doc = games_ref.document(game_id).get()
            if game_doc.exists:
                return bucket_type
        return None


def firestore_increment(value: int):
    """Helper for Firestore increment."""
    from google.cloud.firestore_v1 import Increment
    return Increment(value)


# Singleton instance
_bucket_service: Optional[BucketService] = None


def get_bucket_service() -> BucketService:
    """Get the bucket service instance."""
    global _bucket_service
    if _bucket_service is None:
        _bucket_service = BucketService()
    return _bucket_service
