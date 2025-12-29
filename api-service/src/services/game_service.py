"""
PlayNext Game Service

Service for managing game catalog operations.
"""

import logging
from datetime import datetime
from typing import Optional

from ..db.firebase import get_collection, GAMES_COLLECTION
from ..models import Game, GameCreate, GameSummary, Platform

logger = logging.getLogger("playnext-api.games")


class GameService:
    """Service for game catalog operations."""

    def __init__(self):
        self.collection = get_collection(GAMES_COLLECTION)

    async def get_game(self, game_id: str) -> Optional[Game]:
        """Get a single game by ID."""
        try:
            doc = self.collection.document(game_id).get()
            if doc.exists:
                data = doc.to_dict()
                data["game_id"] = doc.id
                return Game(**data)
            return None
        except Exception as e:
            logger.error(f"Error fetching game {game_id}: {e}")
            return None

    async def list_games(
        self,
        limit: int = 50,
        offset: int = 0,
        platform: Optional[Platform] = None
    ) -> list[GameSummary]:
        """List games with optional filtering."""
        try:
            query = self.collection.limit(limit).offset(offset)

            if platform:
                query = query.where("platforms", "array_contains", platform.value)

            docs = query.stream()
            games = []

            for doc in docs:
                data = doc.to_dict()
                games.append(GameSummary(
                    game_id=doc.id,
                    title=data.get("title", ""),
                    platforms=[Platform(p) for p in data.get("platforms", [])],
                    description_short=data.get("description_short", ""),
                    time_to_fun=data.get("time_to_fun", "medium"),
                    stop_friendliness=data.get("stop_friendliness", "checkpoints"),
                ))

            return games
        except Exception as e:
            logger.error(f"Error listing games: {e}")
            return []

    async def create_game(self, game: GameCreate) -> Game:
        """Create a new game in the catalog."""
        try:
            data = game.model_dump()
            data["created_at"] = datetime.utcnow()
            data["updated_at"] = datetime.utcnow()

            # Convert enums to values
            data["platforms"] = [p.value for p in game.platforms]
            data["play_style"] = [s.value for s in game.play_style]
            data["multiplayer_modes"] = [m.value for m in game.multiplayer_modes]
            data["energy_level"] = game.energy_level.value
            data["time_to_fun"] = game.time_to_fun.value
            data["stop_friendliness"] = game.stop_friendliness.value

            self.collection.document(game.game_id).set(data)
            logger.info(f"Created game: {game.game_id}")

            return Game(**data)
        except Exception as e:
            logger.error(f"Error creating game: {e}")
            raise

    async def update_game(self, game_id: str, updates: dict) -> Optional[Game]:
        """Update an existing game."""
        try:
            doc_ref = self.collection.document(game_id)
            doc = doc_ref.get()

            if not doc.exists:
                return None

            updates["updated_at"] = datetime.utcnow()
            doc_ref.update(updates)

            updated_doc = doc_ref.get()
            data = updated_doc.to_dict()
            data["game_id"] = game_id

            return Game(**data)
        except Exception as e:
            logger.error(f"Error updating game {game_id}: {e}")
            raise

    async def delete_game(self, game_id: str) -> bool:
        """Delete a game from the catalog."""
        try:
            self.collection.document(game_id).delete()
            logger.info(f"Deleted game: {game_id}")
            return True
        except Exception as e:
            logger.error(f"Error deleting game {game_id}: {e}")
            return False

    async def seed_game(self, game_data: dict) -> bool:
        """Seed a single game into the catalog (for bulk import)."""
        try:
            game_id = game_data.get("game_id")
            if not game_id:
                return False

            game_data["created_at"] = datetime.utcnow()
            game_data["updated_at"] = datetime.utcnow()

            self.collection.document(game_id).set(game_data)
            return True
        except Exception as e:
            logger.error(f"Error seeding game: {e}")
            return False

    async def get_catalog_stats(self) -> dict:
        """Get statistics about the game catalog."""
        try:
            docs = list(self.collection.stream())
            total = len(docs)

            platforms = {}
            play_styles = {}
            energy_levels = {}

            for doc in docs:
                data = doc.to_dict()

                for p in data.get("platforms", []):
                    platforms[p] = platforms.get(p, 0) + 1

                for s in data.get("play_style", []):
                    play_styles[s] = play_styles.get(s, 0) + 1

                energy = data.get("energy_level")
                if energy:
                    energy_levels[energy] = energy_levels.get(energy, 0) + 1

            return {
                "total_games": total,
                "by_platform": platforms,
                "by_play_style": play_styles,
                "by_energy_level": energy_levels,
            }
        except Exception as e:
            logger.error(f"Error getting catalog stats: {e}")
            return {"total_games": 0}


# Singleton instance
_game_service: Optional[GameService] = None


def get_game_service() -> GameService:
    """Get the game service instance."""
    global _game_service
    if _game_service is None:
        _game_service = GameService()
    return _game_service
