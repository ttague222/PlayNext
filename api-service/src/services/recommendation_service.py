"""
PlayNext Recommendation Service

Core recommendation engine with deterministic heuristics.
"""

import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional

from ..db.firebase import get_collection, GAMES_COLLECTION, SIGNALS_COLLECTION
from ..models import (
    RecommendationRequest,
    RecommendationResponse,
    GameRecommendation,
    RecommendationExplanation,
    EnergyMood,
    SessionType,
    DiscoveryMode,
    Platform,
    PlayStyle,
    EnergyLevel,
    TimeToFun,
    StopFriendliness,
    MultiplayerMode,
)
from ..core.config import settings

logger = logging.getLogger("playnext-api.recommendation")


# Mapping from user mood to game energy level
MOOD_TO_ENERGY = {
    EnergyMood.WIND_DOWN: EnergyLevel.LOW,
    EnergyMood.CASUAL: EnergyLevel.LOW,
    EnergyMood.FOCUSED: EnergyLevel.MEDIUM,
    EnergyMood.INTENSE: EnergyLevel.HIGH,
}

# Mapping from session type to multiplayer modes
SESSION_TO_MULTIPLAYER = {
    SessionType.SOLO: [MultiplayerMode.SOLO],
    SessionType.COUCH_COOP: [MultiplayerMode.LOCAL_COOP],
    SessionType.ONLINE_FRIENDS: [MultiplayerMode.ONLINE_COOP, MultiplayerMode.COMPETITIVE],
    SessionType.ANY: None,  # No filter
}

# Time bracket mapping (user input -> compatible time tags)
TIME_BRACKETS = {
    15: [15],
    30: [15, 30],
    60: [15, 30, 60],
    90: [15, 30, 60, 90],
    120: [15, 30, 60, 90, 120],
}


class RecommendationService:
    """Service for generating game recommendations."""

    def __init__(self):
        self.games_collection = get_collection(GAMES_COLLECTION)
        self.signals_collection = get_collection(SIGNALS_COLLECTION)

    async def get_recommendations(
        self,
        request: RecommendationRequest,
        user_id: Optional[str] = None
    ) -> RecommendationResponse:
        """
        Generate game recommendations based on user input.

        Args:
            request: Recommendation request with user preferences
            user_id: Optional user ID for personalization

        Returns:
            RecommendationResponse with 1-3 games
        """
        session_id = request.session_id or str(uuid.uuid4())

        # Get all games
        games = await self._fetch_games()

        if not games:
            logger.warning("No games in catalog")
            return self._empty_response(session_id)

        # Apply filters with fallback logic
        filtered_games, fallback_applied, fallback_message = await self._filter_games(
            games=games,
            request=request,
            user_id=user_id
        )

        if not filtered_games:
            logger.warning("No games matched filters even with fallback")
            return self._empty_response(session_id)

        # Score and rank games
        scored_games = self._score_games(filtered_games, request)

        # Apply discovery mode
        if request.discovery_mode == DiscoveryMode.SURPRISE:
            scored_games = await self._apply_surprise_boost(scored_games, user_id)

        # Sort by score and take top 3, ensuring franchise diversity
        scored_games.sort(key=lambda x: x["score"], reverse=True)
        top_games = self._ensure_franchise_diversity(scored_games, settings.max_recommendations)

        # Build recommendations
        recommendations = [
            self._build_recommendation(game, request)
            for game in top_games
        ]

        return RecommendationResponse(
            recommendations=recommendations,
            session_id=session_id,
            fallback_applied=fallback_applied,
            fallback_message=fallback_message,
            generated_at=datetime.utcnow()
        )

    async def _fetch_games(self) -> list[dict]:
        """Fetch all games from Firestore."""
        try:
            docs = self.games_collection.stream()
            return [doc.to_dict() | {"game_id": doc.id} for doc in docs]
        except Exception as e:
            logger.error(f"Error fetching games: {e}")
            return []

    async def _filter_games(
        self,
        games: list[dict],
        request: RecommendationRequest,
        user_id: Optional[str]
    ) -> tuple[list[dict], bool, Optional[str]]:
        """
        Filter games with fallback hierarchy.

        Returns:
            Tuple of (filtered_games, fallback_applied, fallback_message)
        """
        excluded = set(request.excluded_game_ids)

        # Get recently shown games for user (from history)
        if user_id:
            recent = await self._get_recently_shown(user_id)
            excluded.update(recent)
            logger.info(f"User {user_id}: Excluding {len(recent)} games from history: {recent}")

        # Remove excluded games
        original_count = len(games)
        games = [g for g in games if g["game_id"] not in excluded]
        logger.info(f"Filtered from {original_count} to {len(games)} games after exclusions")

        # Try exact match first
        filtered = self._apply_filters(games, request, strict=True)
        if filtered:
            return filtered, False, None

        # Fallback 1: Relax platform
        logger.info("Applying fallback: relaxing platform filter")
        relaxed_request = request.model_copy()
        relaxed_request.platform = None
        relaxed_request.platforms = None
        filtered = self._apply_filters(games, relaxed_request, strict=True)
        if filtered:
            return filtered, True, "Showing games across all platforms"

        # Fallback 2: Relax play style
        logger.info("Applying fallback: relaxing play style filter")
        relaxed_request.play_style = None
        relaxed_request.play_styles = None
        filtered = self._apply_filters(games, relaxed_request, strict=True)
        if filtered:
            return filtered, True, "Showing games across all play styles"

        # Fallback 3: Relax time bracket
        logger.info("Applying fallback: relaxing time filter")
        filtered = self._apply_filters(games, relaxed_request, strict=False)
        if filtered:
            original_time = request.time_available
            return filtered, True, f"No exact matches for {original_time} minutes. Showing nearby options."

        # Final fallback: return best partial matches
        logger.warning("All filters relaxed, returning partial matches")
        return games[:10], True, "Showing best available matches"

    def _apply_filters(
        self,
        games: list[dict],
        request: RecommendationRequest,
        strict: bool = True
    ) -> list[dict]:
        """Apply filters to game list."""
        filtered = games

        # Time filter
        time_tags = TIME_BRACKETS.get(request.time_available, [request.time_available])
        if not strict:
            # Expand time bracket by one level
            expanded = set(time_tags)
            for bracket, tags in TIME_BRACKETS.items():
                if any(t in time_tags for t in tags):
                    expanded.update(tags)
            time_tags = list(expanded)

        filtered = [
            g for g in filtered
            if any(t in g.get("time_tags", []) for t in time_tags)
        ]

        # Energy/mood filter
        target_energy = MOOD_TO_ENERGY.get(request.energy_mood)
        if target_energy:
            filtered = [
                g for g in filtered
                if g.get("energy_level") == target_energy.value
                or self._energy_compatible(g.get("energy_level"), target_energy)
            ]

        # Play style filter (if specified) - support both single and list
        play_styles = request.play_styles or ([request.play_style] if request.play_style else None)
        if play_styles:
            style_values = [s.value for s in play_styles]
            filtered = [
                g for g in filtered
                if any(s in g.get("play_style", []) for s in style_values)
            ]

        # Platform filter (if specified) - support both single and list
        platforms = request.platforms or ([request.platform] if request.platform else None)
        if platforms:
            platform_values = [p.value for p in platforms]
            filtered = [
                g for g in filtered
                if any(p in g.get("platforms", []) for p in platform_values)
            ]

        # Session type / multiplayer filter
        if request.session_type != SessionType.ANY:
            required_modes = SESSION_TO_MULTIPLAYER.get(request.session_type)
            if required_modes:
                filtered = [
                    g for g in filtered
                    if any(m.value in g.get("multiplayer_modes", []) for m in required_modes)
                ]

        return filtered

    def _energy_compatible(self, game_energy: str, target: EnergyLevel) -> bool:
        """Check if game energy is compatible with target (allows adjacent levels)."""
        energy_order = [EnergyLevel.LOW, EnergyLevel.MEDIUM, EnergyLevel.HIGH]
        try:
            game_idx = energy_order.index(EnergyLevel(game_energy))
            target_idx = energy_order.index(target)
            return abs(game_idx - target_idx) <= 1
        except (ValueError, IndexError):
            return False

    def _score_games(
        self,
        games: list[dict],
        request: RecommendationRequest
    ) -> list[dict]:
        """Score games based on match quality."""
        scored = []

        for game in games:
            score = 0.0

            # Stop-friendliness boost (0-0.25)
            stop = game.get("stop_friendliness", "")
            if stop == StopFriendliness.ANYTIME.value:
                score += 0.25
            elif stop == StopFriendliness.CHECKPOINTS.value:
                score += 0.15

            # Time-to-fun boost (0-0.2)
            ttf = game.get("time_to_fun", "")
            if ttf == TimeToFun.SHORT.value:
                score += 0.2
            elif ttf == TimeToFun.MEDIUM.value:
                score += 0.1

            # Mood match boost (0-0.2)
            target_energy = MOOD_TO_ENERGY.get(request.energy_mood)
            if target_energy and game.get("energy_level") == target_energy.value:
                score += 0.2

            # Play style match boost (0-0.15)
            play_styles = request.play_styles or ([request.play_style] if request.play_style else None)
            if play_styles:
                style_values = [s.value for s in play_styles]
                game_styles = game.get("play_style", [])
                matching_styles = sum(1 for s in style_values if s in game_styles)
                if matching_styles > 0:
                    # More matching styles = higher boost
                    score += 0.15 * min(matching_styles / len(style_values), 1.0)

            # Platform match boost (0-0.1)
            req_platforms = request.platforms or ([request.platform] if request.platform else None)
            game_platforms = game.get("platforms", [])
            if req_platforms:
                platform_values = [p.value for p in req_platforms]
                if any(p in game_platforms for p in platform_values):
                    score += 0.1
            elif len(game_platforms) >= 2:
                # Bonus for multi-platform games when no platform specified
                score += 0.05

            # Subscription availability boost (0-0.1)
            if game.get("subscription_services"):
                score += 0.1

            scored.append({**game, "score": min(score, 1.0)})

        return scored

    async def _apply_surprise_boost(
        self,
        games: list[dict],
        user_id: Optional[str]
    ) -> list[dict]:
        """
        Boost lesser-known games for surprise mode.

        Strategy:
        1. Strongly boost indie games (tagged with 'indie' genre)
        2. Penalize well-known AAA franchises
        3. Reduce score for globally popular games (many accepts)
        4. Boost games the user hasn't interacted with before
        5. Add random variation to surface variety
        """
        import random

        # Known AAA franchises to deprioritize in surprise mode
        AAA_FRANCHISES = {
            'assassin', 'call of duty', 'battlefield', 'far cry', 'god of war',
            'spider-man', 'horizon', 'final fantasy', 'resident evil', 'zelda',
            'mario', 'pokemon', 'fifa', 'madden', 'nba 2k', 'forza', 'gran turismo',
            'halo', 'gears of war', 'uncharted', 'last of us', 'ghost of tsushima',
            'red dead', 'grand theft auto', 'gta', 'cyberpunk', 'witcher',
            'elder scrolls', 'fallout', 'doom', 'diablo', 'overwatch', 'starfield',
            'monster hunter', 'death stranding', 'metal gear', 'kingdom hearts'
        }

        # Get global popularity data for all games
        game_popularity = await self._get_global_popularity([g["game_id"] for g in games])

        # Get user's previous interactions
        user_games = set()
        if user_id:
            user_games = await self._get_user_game_history(user_id)

        # Find the max popularity to normalize
        max_popularity = max(game_popularity.values()) if game_popularity else 1

        for game in games:
            game_id = game["game_id"]
            title_lower = game.get("title", "").lower()
            genres = game.get("genres", [])

            # 1. Strong indie boost: games tagged as indie get significant boost
            if "indie" in genres:
                game["score"] += 0.4  # Strong boost for indie games

            # 2. AAA penalty: well-known franchises get heavily penalized
            is_aaa = any(franchise in title_lower for franchise in AAA_FRANCHISES)
            if is_aaa:
                game["score"] -= 0.5  # Strong penalty for AAA franchises

            # 3. Popularity penalty: reduce score for popular games in our app
            popularity = game_popularity.get(game_id, 0)
            if max_popularity > 0:
                popularity_ratio = popularity / max_popularity
                # Popular games get up to -0.15, unknown games get +0.15
                popularity_adjustment = 0.15 - (popularity_ratio * 0.3)
                game["score"] += popularity_adjustment

            # 4. Novelty boost: boost games user hasn't seen before
            if user_id and game_id not in user_games:
                game["score"] += 0.1

            # 5. Smaller studio boost: games without major subscription services
            # (except Xbox Game Pass which has many indies) might be smaller
            subscriptions = game.get("subscription_services", [])
            major_only_services = {"ubisoft_plus", "ea_play"}
            if subscriptions and all(s in major_only_services for s in subscriptions):
                # Only on publisher-specific services = likely AAA
                game["score"] -= 0.1

            # 6. Random variation to add variety
            game["score"] += random.uniform(-0.08, 0.08)

            # Clamp score to valid range
            game["score"] = max(0, min(1, game["score"]))

        return games

    async def _get_global_popularity(self, game_ids: list[str]) -> dict[str, int]:
        """Get acceptance counts for games to measure popularity."""
        try:
            popularity = {}
            for game_id in game_ids:
                # Count accepted signals for this game
                docs = (
                    self.signals_collection
                    .where("game_id", "==", game_id)
                    .where("signal_type", "==", "accepted")
                    .stream()
                )
                popularity[game_id] = len(list(docs))
            return popularity
        except Exception as e:
            logger.error(f"Error fetching game popularity: {e}")
            return {}

    async def _get_user_game_history(self, user_id: str) -> set[str]:
        """Get all games a user has interacted with."""
        try:
            docs = (
                self.signals_collection
                .where("user_id", "==", user_id)
                .stream()
            )
            return {doc.to_dict().get("game_id") for doc in docs if doc.to_dict().get("game_id")}
        except Exception as e:
            logger.error(f"Error fetching user game history: {e}")
            return set()

    async def _get_recently_shown(self, user_id: str) -> set[str]:
        """Get games shown to user in the last 7 days."""
        try:
            cutoff = datetime.utcnow() - timedelta(days=7)
            # Fetch all user signals first (single field query - no index needed)
            docs = list(
                self.signals_collection
                .where("user_id", "==", user_id)
                .stream()
            )
            # Filter by timestamp in Python to avoid needing composite index
            recent_games = set()
            for doc in docs:
                data = doc.to_dict()
                timestamp = data.get("timestamp")
                # Handle both Firestore Timestamp and Python datetime
                if timestamp:
                    # Convert Firestore Timestamp to datetime if needed
                    if hasattr(timestamp, 'timestamp'):
                        # It's a Firestore Timestamp, convert to datetime
                        timestamp_dt = datetime.utcfromtimestamp(timestamp.timestamp())
                    else:
                        timestamp_dt = timestamp

                    if timestamp_dt >= cutoff:
                        game_id = data.get("game_id")
                        if game_id:
                            recent_games.add(game_id)
            return recent_games
        except Exception as e:
            logger.error(f"Error fetching recent signals: {e}")
            return set()

    def _ensure_franchise_diversity(
        self,
        scored_games: list[dict],
        max_count: int
    ) -> list[dict]:
        """
        Select top games while ensuring no two games from the same franchise.

        Uses the 'franchise' field if present, otherwise infers from title patterns.
        """
        import re

        selected = []
        seen_franchises = set()

        for game in scored_games:
            if len(selected) >= max_count:
                break

            # Get franchise identifier
            franchise = game.get("franchise") or self._infer_franchise(game["title"])

            if franchise and franchise.lower() in seen_franchises:
                # Skip games from already-shown franchises
                continue

            selected.append(game)
            if franchise:
                seen_franchises.add(franchise.lower())

        return selected

    def _infer_franchise(self, title: str) -> Optional[str]:
        """
        Infer franchise from game title by detecting sequel patterns.

        Handles patterns like:
        - "Game Name 2" or "Game Name II"
        - "Game Name: Subtitle"
        - "Game Name - Something"
        """
        import re

        # Remove common sequel indicators to get base title
        # Pattern 1: Trailing numbers (1, 2, 3, etc.) or Roman numerals (II, III, IV, V, VI)
        sequel_pattern = r'\s*[:\-–]?\s*(?:\d+|II|III|IV|V|VI|VII|VIII|IX|X)$'
        base = re.sub(sequel_pattern, '', title, flags=re.IGNORECASE)

        # Pattern 2: Subtitle after colon or dash
        subtitle_pattern = r'\s*[:\-–]\s*.+$'
        base = re.sub(subtitle_pattern, '', base)

        # Pattern 3: Common sequel words
        sequel_words = r'\s+(?:Remastered|Remake|Deluxe|Complete|Definitive|Enhanced|Ultimate|Collection|Episode|DLC|Expansion).*$'
        base = re.sub(sequel_words, '', base, flags=re.IGNORECASE)

        # Clean up whitespace
        base = base.strip()

        # Return base title if it differs from original (meaning we found a pattern)
        if base and base.lower() != title.lower():
            return base

        # No franchise pattern detected
        return None

    def _build_recommendation(
        self,
        game: dict,
        request: RecommendationRequest
    ) -> GameRecommendation:
        """Build a GameRecommendation from game data."""
        # Build explanation from templates
        templates = game.get("explanation_templates", {})
        explanation_parts = []

        if templates.get("time_fit"):
            explanation_parts.append(
                templates["time_fit"].replace("{time}", str(request.time_available))
            )
        if templates.get("mood_fit"):
            explanation_parts.append(templates["mood_fit"])
        if templates.get("stop_fit"):
            explanation_parts.append(templates["stop_fit"])

        summary = " ".join(explanation_parts) if explanation_parts else (
            f"Great fit for your {request.time_available}-minute {request.energy_mood.value.replace('_', ' ')} session."
        )

        return GameRecommendation(
            game_id=game["game_id"],
            title=game["title"],
            platforms=[Platform(p) for p in game.get("platforms", [])],
            description_short=game.get("description_short", ""),
            explanation=RecommendationExplanation(
                summary=summary,
                time_fit=templates.get("time_fit"),
                mood_fit=templates.get("mood_fit"),
                stop_fit=templates.get("stop_fit"),
                style_fit=templates.get("style_fit"),
                session_fit=templates.get("session_fit"),
            ),
            time_to_fun=TimeToFun(game.get("time_to_fun", "medium")),
            stop_friendliness=StopFriendliness(game.get("stop_friendliness", "checkpoints")),
            subscription_services=game.get("subscription_services", []),
            fun_fact=game.get("fun_fact"),
            match_score=game.get("score", 0.5)
        )

    def _empty_response(self, session_id: str) -> RecommendationResponse:
        """Return empty response when no games available."""
        return RecommendationResponse(
            recommendations=[],
            session_id=session_id,
            fallback_applied=True,
            fallback_message="No games available. Please try different filters.",
            generated_at=datetime.utcnow()
        )


# Singleton instance
_recommendation_service: Optional[RecommendationService] = None


def get_recommendation_service() -> RecommendationService:
    """Get the recommendation service instance."""
    global _recommendation_service
    if _recommendation_service is None:
        _recommendation_service = RecommendationService()
    return _recommendation_service
