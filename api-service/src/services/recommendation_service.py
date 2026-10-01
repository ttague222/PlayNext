"""
PlayNext Recommendation Service

Core recommendation engine with heuristics and randomization for variety.
"""

import logging
import random
import re
import time
import uuid
from datetime import datetime, timedelta
from typing import Optional

from ..db.firebase import get_collection, GAMES_COLLECTION, SIGNALS_COLLECTION, LIBRARIES_COLLECTION
from .game_service import is_released
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
    StoreLinks,
)
from ..core.config import settings

logger = logging.getLogger("playnext-api.recommendation")


# Mapping from user mood to game energy level
# Width of the random variety term added to every ranking score.
# Reroll freshness comes primarily from excluding already-shown games
# (see _filter_games); this term spreads FIRST responses across near-fits.
# A game fitting `gap` worse wins with probability (r - gap)^2 / (2 r^2):
# at 0.25 that is ~2% for a 0.20 gap and ~18% for a 0.10 gap. Raised from
# 0.15 when mood-tag affinity broke the old 100%-match ties: at 0.15 one
# game took over half of fresh responses for 6-11 of 20 request types;
# 0.25 matched the pre-affinity spread (2 of 20) while keeping match % <90%
# for 22% of picks (2026-10-01 sweep, production catalog).
RANDOM_VARIETY_RANGE = 0.25

MOOD_TO_ENERGY = {
    EnergyMood.WIND_DOWN: EnergyLevel.LOW,
    EnergyMood.CASUAL: EnergyLevel.LOW,
    EnergyMood.FOCUSED: EnergyLevel.MEDIUM,
    EnergyMood.INTENSE: EnergyLevel.HIGH,
}

# Mood-tag affinity. MOOD_TO_ENERGY is a yes/no check every strong pick
# passes, so on its own it left 100+ games tied at a 100% match. mood_tags
# (on every catalog game, 272-tag vocabulary) grade how well a game's feel
# fits the requested mood. Only tags that exist in the catalog are listed;
# vague ones ("fun", "immersive", "nostalgic") are deliberately left out.
MOOD_TAG_AFFINITY = {
    EnergyMood.WIND_DOWN: frozenset({
        "relaxing", "peaceful", "zen", "cozy", "meditative", "contemplative",
        "wholesome", "heartwarming", "beautiful", "atmospheric", "dreamlike",
        "whimsical", "charming", "artistic",
    }),
    EnergyMood.CASUAL: frozenset({
        "charming", "cozy", "relaxing", "cute", "funny", "humorous", "silly",
        "quirky", "lighthearted", "whimsical", "colorful", "joyful", "wholesome",
        "hilarious", "family-friendly", "casual", "accessible", "social",
        "heartwarming", "satisfying",
    }),
    EnergyMood.FOCUSED: frozenset({
        "strategic", "thoughtful", "tactical", "clever", "challenging", "complex",
        "cerebral", "thought-provoking", "mind-bending", "brain-teasing", "deep",
        "precise", "technical", "rewarding", "satisfying", "mysterious", "focused",
        "story-rich", "philosophical",
    }),
    EnergyMood.INTENSE: frozenset({
        "intense", "action-packed", "tense", "exciting", "fast", "fast-paced",
        "competitive", "challenging", "chaotic", "epic", "brutal", "thrilling",
        "explosive", "aggressive", "terrifying", "scary", "over-the-top",
    }),
}
# Tags that work against the requested mood (a "competitive" golf game for
# a wind-down session).
MOOD_TAG_CLASH = {
    EnergyMood.WIND_DOWN: frozenset({
        "intense", "tense", "scary", "terrifying", "creepy", "stressful", "chaotic",
        "competitive", "brutal", "frustrating", "aggressive", "action-packed",
        "fast-paced", "fast", "disturbing", "explosive",
    }),
    EnergyMood.CASUAL: frozenset({
        "brutal", "terrifying", "stressful", "frustrating", "disturbing", "complex",
        "tense", "scary", "creepy",
    }),
    EnergyMood.FOCUSED: frozenset({"chaotic", "silly", "over-the-top"}),
    EnergyMood.INTENSE: frozenset({
        "relaxing", "peaceful", "zen", "cozy", "meditative", "wholesome", "contemplative",
    }),
}
# 0.10 rather than 0.15: at 0.15 the most on-mood games won too often on a
# fresh request (Tiny Bookshop in 31 of 40 for 15-minute wind-down).
MOOD_TAG_AFFINITY_MAX = 0.10
# Affinity is the share of a game's mood_tags that are on-mood, with the
# denominator floored here so one lucky tag can't earn full affinity.
MOOD_TAG_MIN_DENOMINATOR = 3
MOOD_TAG_CLASH_PENALTY = 0.05
MOOD_TAG_CLASH_CAP = 0.10

# Mapping from session type to multiplayer modes
SESSION_TO_MULTIPLAYER = {
    SessionType.SOLO: [MultiplayerMode.SOLO],
    SessionType.COUCH_COOP: [MultiplayerMode.LOCAL_COOP],
    SessionType.ONLINE_FRIENDS: [MultiplayerMode.ONLINE_COOP, MultiplayerMode.COMPETITIVE],
    SessionType.MULTIPLAYER: [MultiplayerMode.LOCAL_COOP, MultiplayerMode.ONLINE_COOP, MultiplayerMode.COMPETITIVE],
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

# Subscription taxonomy aliases. The mobile filter UI sends short forms
# (game_pass, ps_plus) while game data and the client's badge config use
# long forms (xbox_game_pass, playstation_plus). Both are baked into the
# shipped 1.1.0 binary, so the server bridges: normalize both sides of the
# filter so any combination matches. Canonical data form is the LONG form.
SUBSCRIPTION_ALIASES = {
    "game_pass": "xbox_game_pass",
    "ps_plus": "playstation_plus",
}

# Free-tier learning ("Why not?" feature). Games with these signals are
# permanently excluded from a signed-in user's results, and their tags feed
# the avoid-profile penalty in scoring.
REJECTED_SIGNAL_TYPES = {"not_good_fit", "played_didnt_stick", "rated_down"}
# Positive signals feed the free-tier taste nudge (same set the premium
# favor_history profile uses).
POSITIVE_SIGNAL_TYPES = {"worked", "played_loved", "accepted", "rated_up"}
# Free-tier nudges are deliberately smaller than the premium favor_history
# boost (0.15): enough to shift near-ties, not enough to override fit.
FREE_TASTE_STEP = 0.05
FREE_TASTE_CAP = 0.10

# Backlog Mode (premium): flat boost for library games with zero recorded
# playtime — surfacing true backlog dust is the feature's magic moment.
# Small on purpose: it breaks ties, it doesn't override fit.
BACKLOG_NEVER_PLAYED_BOOST = 0.05

# Shown when Backlog Mode finds nothing suitable and the engine falls back
# to the full catalog (results must never be empty, PRD §5.6).
BACKLOG_FALLBACK_MESSAGE = (
    "Nothing in your backlog fits this session — here are picks from the full catalog."
)

# Game card refresh (P0.2): bullets are capped at 2 per game and chosen
# most-game-specific-first. Known filler strings are never emitted.
EXPLANATION_FIELD_PRIORITY = ["style_fit", "stop_fit", "mood_fit", "session_fit", "time_fit"]
MAX_EXPLANATION_BULLETS = 2

# Shipped clients render only these three explanation fields (plus
# library_fit, which is assembled separately). session_fit/time_fit are
# reserved for future card versions and must never crowd out a renderable
# bullet — see the fallback guarantee in _build_recommendation.
RENDERABLE_EXPLANATION_FIELDS = frozenset({"style_fit", "stop_fit", "mood_fit"})

GENERIC_FILLER = frozenset({
    "enjoyable gameplay experience",
    "freedom to create and explore at your pace",
    "unwind and enjoy at your own pace",
    "easy to pause whenever you need",
    "perfect for unwinding gentle pace lets you relax",
    "a great way to pass the time",
    "fun for everyone",
})

# Catalog template strings carried by more than this many games are seeded
# boilerplate, not game-specific copy. On 2026-09-30, 1,011 of the 1,249
# games with templates carried ONLY strings shared by 10+ games ("Quick to
# jump in - you'll be having fun in minutes." alone sits on 535), and 158
# more had no templates at all. Shared strings are skipped in favor of
# bullets generated from the game's own catalog fields (generate_bullets).
# Two lets a franchise pair share hand-written copy.
MAX_TEMPLATE_SHARE = 2

# genre_tags -> noun phrase, most specific first: the first entry a game
# carries wins, so a roguelike also tagged "action" reads as a roguelike.
# Tags absent here (indie, casual, co-op, comedy, ...) describe audience or
# tone rather than how the game plays, so they never name the game.
GENRE_NOUNS = {
    "metroidvania": "metroidvania",
    "souls-like": "soulslike",
    "roguelike": "roguelike",
    "roguelite": "roguelite",
    "deckbuilder": "deckbuilder",
    "card-game": "card game",
    "tower-defense": "tower defense game",
    "city-builder": "city builder",
    "visual-novel": "visual novel",
    "rhythm": "rhythm game",
    "fighting": "fighting game",
    "racing": "racing game",
    "soccer": "soccer game",
    "sports": "sports game",
    "party": "party game",
    "jrpg": "JRPG",
    "action-rpg": "action RPG",
    "rpg": "RPG",
    "tactics": "tactics game",
    "strategy": "strategy game",
    "farming": "farming sim",
    "life-sim": "life sim",
    "management": "management sim",
    "survival": "survival game",
    "horror": "horror game",
    "stealth": "stealth game",
    "hack-and-slash": "hack-and-slash",
    "fps": "shooter",
    "shooter": "shooter",
    "platformer": "platformer",
    "puzzle": "puzzle game",
    "mystery": "mystery",
    "building": "building game",
    "sandbox": "sandbox game",
    "simulation": "sim",
    "open-world": "open-world game",
    "action-adventure": "action-adventure",
    "adventure": "adventure",
    "narrative": "story game",
    "arcade": "arcade game",
    "exploration": "exploration game",
    "action": "action game",
}

# play_style -> noun phrase, used when no genre_tag maps.
PLAY_STYLE_NOUNS = {
    PlayStyle.CARD_GAME.value: "card game",
    PlayStyle.TACTICS.value: "tactics game",
    PlayStyle.PUZZLE_STRATEGY.value: "puzzle-strategy game",
    PlayStyle.PUZZLE.value: "puzzle game",
    PlayStyle.STRATEGY.value: "strategy game",
    PlayStyle.SANDBOX_CREATIVE.value: "sandbox game",
    PlayStyle.NARRATIVE.value: "story-driven game",
    PlayStyle.ACTION.value: "action game",
}

# mood_tags too vague to describe a game by themselves.
VAGUE_MOOD_TAGS = frozenset({"fun", "unique", "casual", "addictive"})

TIME_TO_FUN_CLAUSES = {
    TimeToFun.SHORT.value: "that's fun within minutes",
    TimeToFun.MEDIUM.value: "that gets going after a short warm-up",
    TimeToFun.LONG.value: "that rewards time spent learning it",
}

# (generic phrasing, phrasing naming the game via {thing}). The second form
# keeps the bullet unique when another pick in the response shares this
# stop_friendliness value.
STOP_TEMPLATES = {
    StopFriendliness.ANYTIME.value: (
        "Saves anytime, so you can stop the moment your {time} minutes are up.",
        "Saves anytime, so you can put {thing} down the moment your {time} minutes are up.",
    ),
    StopFriendliness.CHECKPOINTS.value: (
        "Regular checkpoints, so stopping after {time} minutes rarely costs progress.",
        "Regular checkpoints, so you can leave {thing} after {time} minutes without losing much.",
    ),
    StopFriendliness.COMMITMENT.value: (
        "Plays best in one sitting, so plan to use all {time} minutes.",
        "{thing} plays best in one sitting, so plan to use all {time} minutes.",
    ),
}


def _normalize_bullet(text: str) -> str:
    """Lowercase words only, for filler and near-duplicate checks.

    Collapsing punctuation means "Save and quit whenever - no progress lost."
    and "Save and quit whenever: no progress lost!" count as the same bullet.
    """
    return " ".join(re.findall(r"[a-z0-9{}']+", text.lower()))


def _with_article(phrase: str) -> str:
    """Prefix "a"/"an"; acronyms like RPG go by letter sound ("an RPG")."""
    first = phrase.split()[0]
    if first.isupper() and len(first) > 1:
        vowel_sound = first[0] in "AEFHILMNORSX"
    else:
        vowel_sound = first[0].lower() in "aeiou"
    return f"{'an' if vowel_sound else 'a'} {phrase}"


def _genre_noun(game: dict) -> str:
    tags = set(game.get("genre_tags") or [])
    for tag, noun in GENRE_NOUNS.items():
        if tag in tags:
            return noun
    styles = set(game.get("play_style") or [])
    for style, noun in PLAY_STYLE_NOUNS.items():
        if style in styles:
            return noun
    return "game"


def _mood_adjectives(game: dict, noun: str) -> list[str]:
    """Descriptive mood_tags in catalog order, minus ones echoing the noun
    ("strategic strategy game", "action-packed action game")."""
    return [
        tag for tag in (game.get("mood_tags") or [])
        if tag not in VAGUE_MOOD_TAGS and tag[:5] not in noun
    ]


def generate_bullets(game: dict, time_available: int) -> dict[str, list[str]]:
    """Explanation bullets built from the game's own catalog fields.

    Every catalog game has genre/play_style, time_to_fun, and
    stop_friendliness, so this always yields bullets with a game-specific
    clause. Each field's candidates run most-natural first and end with a
    title-bearing variant, which is unique within a response (titles are
    unique after franchise diversity), so cross-game dedupe never runs dry.
    """
    title = game.get("title") or "this game"
    noun = _genre_noun(game)
    clause = TIME_TO_FUN_CLAUSES.get(game.get("time_to_fun"), TIME_TO_FUN_CLAUSES["medium"])
    adjectives = _mood_adjectives(game, noun)

    descriptions = [_with_article(f"{adj} {noun}") for adj in adjectives[:2]] or [_with_article(noun)]
    style = [f"{d[0].upper()}{d[1:]} {clause}." for d in descriptions]
    style.append(f"{title} is {descriptions[0]} {clause}.")

    generic, named = STOP_TEMPLATES.get(
        game.get("stop_friendliness"), STOP_TEMPLATES[StopFriendliness.CHECKPOINTS.value]
    )
    this_noun = f"this {noun}"
    stop = [
        generic.format(time=time_available),
        named.format(thing=this_noun, time=time_available),
        named.format(thing=title, time=time_available),
    ]
    stop = [s[0].upper() + s[1:] for s in stop]
    return {"style_fit": style, "stop_fit": stop}


def count_template_share(games: list[dict]) -> dict[str, int]:
    """How many games carry each (normalized) explanation template string."""
    counts: dict[str, int] = {}
    for g in games or []:
        texts = {
            _normalize_bullet(v)
            for v in (g.get("explanation_templates") or {}).values()
            if isinstance(v, str) and v.strip()
        }
        for t in texts:
            counts[t] = counts.get(t, 0) + 1
    return counts


def normalize_subscriptions(values) -> set:
    """Map subscription identifiers to their canonical (long) form."""
    return {SUBSCRIPTION_ALIASES.get(v, v) for v in (values or [])}


def ensure_sentence(text: str) -> str:
    """Close a template fragment with terminal punctuation.

    Catalog explanation templates are inconsistently punctuated, and joining
    unpunctuated fragments produced run-on summaries ("...for 30 minutes A
    beautiful, emotional journey..."). Normalizing here fixes every client
    at once without a catalog data migration.
    """
    text = (text or "").strip()
    if text and text[-1] not in ".!?…":
        text += "."
    return text


def build_taste_profile(games: list[dict]) -> dict:
    """Frequency map of genre_tags and mood_tags across a list of game dicts.

    Pure function so it can be unit-tested without Firestore.
    """
    genres: dict[str, int] = {}
    moods: dict[str, int] = {}
    for g in games or []:
        for t in g.get("genre_tags") or []:
            genres[t] = genres.get(t, 0) + 1
        for t in g.get("mood_tags") or []:
            moods[t] = moods.get(t, 0) + 1
    return {"genres": genres, "moods": moods}


class RecommendationService:
    """Service for generating game recommendations."""

    def __init__(self):
        self.games_collection = get_collection(GAMES_COLLECTION)
        self.signals_collection = get_collection(SIGNALS_COLLECTION)
        self.libraries_collection = get_collection(LIBRARIES_COLLECTION)
        self._games_cache: Optional[list[dict]] = None
        self._games_cache_at: float = 0.0
        self._template_share: dict[str, int] = {}

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

        # One pass over the user's signals feeds staleness exclusion, the
        # permanent "not for me" exclusion, and the free-tier taste nudges.
        signal_data: Optional[dict] = None
        if user_id:
            signal_data = await self._get_user_signal_data(user_id)

        # Synced Steam library (free tier): played games are excluded like
        # Not For Me; owned-but-unplayed games get an "in your library" flag.
        library_data: Optional[dict] = None
        if user_id:
            library_data = await self._get_library_data(user_id)

        # Backlog Mode (premium): restrict candidates to the user's synced,
        # underplayed library. Requires a synced library — the mobile app
        # routes to Connect Steam first, but the API guards regardless.
        if request.library_only and not library_data:
            raise ValueError(
                "Backlog Mode needs a synced Steam library — connect Steam in Settings first"
            )

        backlog_active = False
        filtered_games: list[dict] = []
        fallback_applied = False
        fallback_message: Optional[str] = None

        if request.library_only:
            backlog_pool = [
                g for g in games if g["game_id"] in library_data["owned_unplayed"]
            ]
            if backlog_pool:
                # Platform/genre/time relax within the pool, but never the
                # partial-match catch-all: a wrong-mood backlog game is a
                # worse answer than a right-mood catalog game, and mood is
                # a required input. No fit here → full-catalog fallback.
                filtered_games, fallback_applied, fallback_message = await self._filter_games(
                    games=backlog_pool,
                    request=request,
                    user_id=user_id,
                    signal_data=signal_data,
                    allow_partial=False,
                )
                backlog_active = bool(filtered_games)
            if not backlog_active:
                logger.info(
                    f"User {user_id}: backlog pool has no fit "
                    f"({len(backlog_pool)} candidates) — falling back to catalog"
                )

        if not filtered_games:
            # Standard path, and the Backlog Mode full-catalog fallback.
            filtered_games, fallback_applied, fallback_message = await self._filter_games(
                games=games,
                request=request,
                user_id=user_id,
                signal_data=signal_data,
                library_played=library_data["played"] if library_data else None,
            )
            if request.library_only and filtered_games:
                fallback_applied = True
                fallback_message = BACKLOG_FALLBACK_MESSAGE

        if not filtered_games:
            logger.warning("No games matched filters even with fallback")
            return self._empty_response(session_id)

        games_by_id = {g["game_id"]: g for g in games}

        # Premium: build a taste profile from the user's positive signals when
        # favor_history is requested. Off by default, no-op for anonymous users.
        taste_profile: Optional[dict] = None
        if request.favor_history and signal_data:
            positive_games = [
                games_by_id[gid]
                for gid in signal_data["positive_ids"][:50]
                if gid in games_by_id
            ]
            if positive_games:
                taste_profile = build_taste_profile(positive_games)

        # Free-tier learning from the user's own signals — always on for
        # signed-in users, no flag. The positive nudge stands down when the
        # premium favor_history profile is active (same signals, bigger boost);
        # the avoid penalty applies to everyone.
        free_profile: Optional[dict] = None
        avoid_profile: Optional[dict] = None
        if signal_data:
            if taste_profile is None:
                positive_games = [
                    games_by_id[gid]
                    for gid in signal_data["positive_ids"][:50]
                    if gid in games_by_id
                ]
                if positive_games:
                    free_profile = build_taste_profile(positive_games)
            negative_games = [
                games_by_id[gid]
                for gid in signal_data["negative_ids"][:50]
                if gid in games_by_id
            ]
            if negative_games:
                avoid_profile = build_taste_profile(negative_games)

        # Score and rank games
        scored_games = self._score_games(
            filtered_games, request, taste_profile=taste_profile,
            free_profile=free_profile, avoid_profile=avoid_profile,
        )

        # Backlog Mode: nudge never-launched games above barely-played ones.
        if backlog_active:
            for g in scored_games:
                if library_data["playtimes"].get(g["game_id"], 1) == 0:
                    g["score"] += BACKLOG_NEVER_PLAYED_BOOST

        # Apply discovery mode
        if request.discovery_mode == DiscoveryMode.SURPRISE:
            scored_games = await self._apply_surprise_boost(scored_games, user_id)

        # Sort by score and take top 3, ensuring franchise diversity
        scored_games.sort(key=lambda x: x["score"], reverse=True)
        top_games = self._ensure_franchise_diversity(scored_games, settings.max_recommendations)

        # Build recommendations — one shared used_bullets set so no two
        # games in this response show an identical explanation bullet.
        owned_unplayed = library_data["owned_unplayed"] if library_data else None
        used_bullets: set = set()
        recommendations = []
        for game in top_games:
            recommendations.append(
                self._build_recommendation(
                    game,
                    request,
                    in_library_ids=owned_unplayed,
                    library_playtimes=library_data["playtimes"] if backlog_active else None,
                    used_bullets=used_bullets,
                )
            )

        return RecommendationResponse(
            recommendations=recommendations,
            session_id=session_id,
            fallback_applied=fallback_applied,
            fallback_message=fallback_message,
            generated_at=datetime.utcnow()
        )

    async def _fetch_games(self) -> list[dict]:
        """Fetch all games, cached in-process for settings.recommendation_cache_ttl.

        Every recommendation request previously streamed the full games
        collection from Firestore (~1,100 document reads per request). The
        catalog changes rarely (seed scripts, admin edits), so a short TTL
        cache eliminates the dominant read cost. Scoring copies game dicts
        before mutation, so serving shared cached dicts is safe. Failures
        fall back to a stale cache when one exists.
        """
        now = time.monotonic()
        ttl = getattr(settings, "recommendation_cache_ttl", 300) or 0
        if self._games_cache is not None and now - self._games_cache_at < ttl:
            return self._games_cache
        try:
            docs = self.games_collection.stream()
            games = [doc.to_dict() | {"game_id": doc.id} for doc in docs]
            self._games_cache = games
            self._games_cache_at = now
            self._template_share = count_template_share(games)
            return games
        except Exception as e:
            logger.error(f"Error fetching games: {e}")
            if self._games_cache is not None:
                logger.warning("Serving stale games cache after fetch failure")
                return self._games_cache
            return []

    async def _filter_games(
        self,
        games: list[dict],
        request: RecommendationRequest,
        user_id: Optional[str],
        signal_data: Optional[dict] = None,
        library_played: Optional[set] = None,
        allow_partial: bool = True,
    ) -> tuple[list[dict], bool, Optional[str]]:
        """
        Filter games with fallback hierarchy.

        Returns:
            Tuple of (filtered_games, fallback_applied, fallback_message)
        """
        excluded = set(request.excluded_game_ids)

        # Get recently shown games to prevent staleness. Signed-in users also
        # get their rejected games ("Why not?" / not_good_fit) excluded
        # permanently, server-side — the client exclusion list is a courtesy,
        # not the source of truth.
        if signal_data is not None:
            excluded.update(signal_data["recently_shown"])
            excluded.update(signal_data["rejected"])
            logger.info(
                f"User {user_id}: excluding {len(signal_data['recently_shown'])} "
                f"recently shown + {len(signal_data['rejected'])} rejected games"
            )
        elif user_id:
            recent = await self._get_recently_shown(user_id)
            excluded.update(recent)
            logger.info(f"User {user_id}: Excluding {len(recent)} recently shown games")
        elif request.session_id:
            recent = await self._get_recently_shown_for_session(request.session_id)
            excluded.update(recent)
            logger.info(f"Session {request.session_id}: Excluding {len(recent)} recently shown games")

        # Free-tier Steam sync: games the user has real playtime in are
        # excluded like Not For Me — no premium flag, always on once synced.
        if library_played:
            excluded.update(library_played)
            logger.info(f"User {user_id}: excluding {len(library_played)} played library games")

        # Unreleased games (future release_date) are catalog-visible for the
        # Coming Soon section but must never be recommended - the engine only
        # suggests games the user can play tonight.
        games = [g for g in games if is_released(g.get("release_date"))]

        # Remove excluded games
        original_count = len(games)
        games = [g for g in games if g["game_id"] not in excluded]
        logger.info(f"Filtered from {original_count} to {len(games)} games after exclusions")

        # Premium "hide games I've played": fetch the user's full game history once
        # so every _apply_filters call below can short-circuit on it.
        user_history: Optional[set[str]] = None
        if request.exclude_played and user_id:
            user_history = await self._get_user_game_history(user_id)

        # Try exact match first
        filtered = self._apply_filters(games, request, strict=True, user_history=user_history)
        if filtered:
            return filtered, False, None

        # Fallback 1: Relax platform
        logger.info("Applying fallback: relaxing platform filter")
        relaxed_request = request.model_copy()
        relaxed_request.platform = None
        relaxed_request.platforms = None
        filtered = self._apply_filters(games, relaxed_request, strict=True, user_history=user_history)
        if filtered:
            return filtered, True, "Showing games across all platforms"

        # Fallback 2: Relax genres/play style
        logger.info("Applying fallback: relaxing genre filter")
        relaxed_request.genres = None
        relaxed_request.play_style = None
        relaxed_request.play_styles = None
        filtered = self._apply_filters(games, relaxed_request, strict=True, user_history=user_history)
        if filtered:
            return filtered, True, "Showing games across all genres"

        # Fallback 3: Relax time bracket
        logger.info("Applying fallback: relaxing time filter")
        filtered = self._apply_filters(games, relaxed_request, strict=False, user_history=user_history)
        if filtered:
            original_time = request.time_available
            return filtered, True, f"No exact matches for {original_time} minutes. Showing nearby options."

        # Final fallback: return best partial matches. Backlog Mode opts out
        # (allow_partial=False) so a no-fit backlog hands over to the full
        # catalog instead of surfacing wrong-mood library games.
        if not allow_partial:
            return [], True, None
        logger.warning("All filters relaxed, returning partial matches")
        return games[:10], True, "Showing best available matches"

    def _apply_filters(
        self,
        games: list[dict],
        request: RecommendationRequest,
        strict: bool = True,
        user_history: Optional[set[str]] = None,
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

        # Genre filter - matches both play_style and genre_tags fields
        # Also supports legacy play_styles for backwards compatibility
        genres = request.genres
        if not genres:
            # Fallback to legacy play_styles if genres not provided
            play_styles = request.play_styles or ([request.play_style] if request.play_style else None)
            if play_styles:
                genres = [s.value for s in play_styles]

        if genres:
            filtered = [
                g for g in filtered
                if any(genre in g.get("play_style", []) for genre in genres)
                or any(genre in g.get("genre_tags", []) for genre in genres)
            ]

        # Platform filter (if specified) - support both single and list
        # Strict matching: only match exact platform values
        # Legacy mapping (console/handheld) only used for backwards compatibility with old database entries
        platforms = request.platforms or ([request.platform] if request.platform else None)
        if platforms:
            platform_values = set()
            for p in platforms:
                platform_values.add(p.value)
                # Only map legacy values for console platforms (playstation/xbox -> console)
                # Do NOT map mobile/switch to handheld - these should be strict matches
                if p.value == "playstation" or p.value == "xbox":
                    platform_values.add("console")
                # Note: mobile and switch are now strict - they only match their exact value
                # If database has old "handheld" entries, run migration to update to specific platforms

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

        # Premium filter: stop_friendliness (exact value)
        if request.stop_friendliness:
            filtered = [
                g for g in filtered
                if g.get("stop_friendliness") == request.stop_friendliness.value
            ]

        # Premium filter: time_to_fun (exact value)
        if request.time_to_fun:
            filtered = [
                g for g in filtered
                if g.get("time_to_fun") == request.time_to_fun.value
            ]

        # Premium filter: on_subscriptions (game must be on at least one).
        # Normalized on both sides — see SUBSCRIPTION_ALIASES.
        if request.on_subscriptions:
            wanted = normalize_subscriptions(request.on_subscriptions)
            filtered = [
                g for g in filtered
                if wanted.intersection(normalize_subscriptions(g.get("subscription_services")))
            ]

        # Premium filter: exclude games the user has interacted with.
        if request.exclude_played and user_history:
            filtered = [g for g in filtered if g.get("game_id") not in user_history]

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
        request: RecommendationRequest,
        taste_profile: Optional[dict] = None,
        free_profile: Optional[dict] = None,
        avoid_profile: Optional[dict] = None,
    ) -> list[dict]:
        """Score games based on match quality."""
        games = games.copy()

        scored = []

        # Resolve request-only inputs once — identical for every game in this
        # call — and use them both for fit_max and inside the per-game loop
        # below (genres/req_platforms previously re-derived every iteration).
        genres = request.genres
        if not genres:
            play_styles = request.play_styles or ([request.play_style] if request.play_style else None)
            if play_styles:
                genres = [s.value for s in play_styles]

        req_platforms = request.platforms or ([request.platform] if request.platform else None)
        on_mood_tags = MOOD_TAG_AFFINITY.get(request.energy_mood, frozenset())
        clash_mood_tags = MOOD_TAG_CLASH.get(request.energy_mood, frozenset())

        # Time-affinity ceiling is POOL-relative, not request-relative: the
        # full 0.1 is only attainable when some candidate's time_tags can
        # actually reach request.time_available. Most of the catalog tops
        # out well under long (e.g. 120-minute) sessions, so anchoring the
        # denominator to the full 0.1 made the ratio silently cap under 100%
        # for long-session requests even when a game earned everything the
        # pool could offer. best_depth mirrors the per-game earning formula
        # (min(max(tags), time_available)) but takes the max across the pool.
        best_depth = max(
            (min(max(g["time_tags"]), request.time_available) for g in games if g.get("time_tags")),
            default=0,
        )

        # fit_max: the maximum deterministic request-fit points achievable
        # for THIS request context, used to normalize the display match %
        # (see fit_points below). Identical for every game in this call.
        # Subscription availability and multi-platform reach are ranking-only
        # (see below), so they are not part of fit_max either.
        fit_max = 0.25 + 0.2 + 0.2 + MOOD_TAG_AFFINITY_MAX  # stop + time-to-fun + mood + mood tags
        if genres:
            fit_max += 0.15
        if taste_profile and request.favor_history:
            fit_max += 0.15
        if free_profile:
            fit_max += FREE_TASTE_CAP
        if req_platforms:
            fit_max += 0.1
        if request.time_available and best_depth:
            fit_max += 0.1 * (best_depth / request.time_available)

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

            # Mood-tag affinity (0-MOOD_TAG_AFFINITY_MAX) minus clash penalty (0-0.10)
            game_mood_tags = set(game.get("mood_tags") or [])
            if game_mood_tags:
                on_mood = len(game_mood_tags & on_mood_tags)
                score += MOOD_TAG_AFFINITY_MAX * on_mood / max(len(game_mood_tags), MOOD_TAG_MIN_DENOMINATOR)
                clashes = len(game_mood_tags & clash_mood_tags)
                score -= min(clashes * MOOD_TAG_CLASH_PENALTY, MOOD_TAG_CLASH_CAP)

            # Genre match boost (0-0.15)
            # Supports new genres field and legacy play_styles.
            # `genres` is resolved once above the loop (request-only input).
            if genres:
                game_styles = game.get("play_style", [])
                game_genre_tags = game.get("genre_tags", [])
                all_game_genres = game_styles + game_genre_tags
                matching_genres = sum(1 for g in genres if g in all_game_genres)
                if matching_genres > 0:
                    # More matching genres = higher boost
                    score += 0.15 * min(matching_genres / len(genres), 1.0)

            # Premium: favor games matching the user's taste profile (capped at 0.15).
            if taste_profile and request.favor_history:
                profile_genres = taste_profile.get("genres", {})
                profile_moods = taste_profile.get("moods", {})
                matches = (
                    sum(1 for t in (game.get("genre_tags") or []) if t in profile_genres)
                    + sum(1 for t in (game.get("mood_tags") or []) if t in profile_moods)
                )
                if matches:
                    score += min(matches * 0.05, 0.15)

            # Free-tier learning: small nudges from the user's own signals.
            # The positive nudge is only passed in when the premium taste
            # boost is inactive (same underlying signals, smaller cap); the
            # avoid penalty from "Why not?" rejections applies to everyone.
            if free_profile:
                matches = (
                    sum(1 for t in (game.get("genre_tags") or [])
                        if t in free_profile.get("genres", {}))
                    + sum(1 for t in (game.get("mood_tags") or [])
                          if t in free_profile.get("moods", {}))
                )
                if matches:
                    score += min(matches * FREE_TASTE_STEP, FREE_TASTE_CAP)
            if avoid_profile:
                matches = (
                    sum(1 for t in (game.get("genre_tags") or [])
                        if t in avoid_profile.get("genres", {}))
                    + sum(1 for t in (game.get("mood_tags") or [])
                          if t in avoid_profile.get("moods", {}))
                )
                if matches:
                    score -= min(matches * FREE_TASTE_STEP, FREE_TASTE_CAP)

            # Platform match boost (0-0.1)
            # `req_platforms` is resolved once above the loop (request-only input).
            game_platforms = game.get("platforms", [])
            if req_platforms:
                platform_values = [p.value for p in req_platforms]
                if any(p in game_platforms for p in platform_values):
                    score += 0.1

            # Time affinity boost (0-0.1): reward depth that matches the
            # session length. Short games legitimately pass the time filter
            # for long sessions, but a 2-hour request should rank deep games
            # above quick-hitters. For short requests every eligible game
            # reaches the full ratio, so short-session ranking is unchanged.
            # (The fit_max denominator above uses this same formula, maxed
            # across the candidate pool, so a game hitting the pool's best
            # attainable depth earns a full match_ratio contribution here.)
            game_time_tags = game.get("time_tags") or []
            if game_time_tags and request.time_available:
                depth = min(max(game_time_tags), request.time_available)
                score += 0.1 * (depth / request.time_available)

            # fit_points: the deterministic request-fit boosts accumulated so
            # far (stop, time-to-fun, mood, mood-tag affinity and clash, genre,
            # taste, free nudge, avoid penalty, requested platform, time
            # affinity) — everything above
            # this line, and nothing below it. This deliberately excludes the
            # ranking-only boosts and random variety term added next, and
            # ranking-only adjustments applied outside this method (surprise
            # mode's indie/popularity boosts, BACKLOG_NEVER_PLAYED_BOOST).
            fit_points = score

            # Ranking-only boosts: being on a subscription or on several
            # platforms makes a pick easier to act on, but says nothing about
            # fit to the request. Counting them in the match % inflated the
            # 100% tier (2026-09-30: 85% of returned picks showed 100%).
            if len(game_platforms) >= 2 and not req_platforms:
                score += 0.05  # multi-platform reach (0-0.05)
            if game.get("subscription_services"):
                score += 0.1  # subscription availability (0-0.1)

            # Add randomness so near-ties shuffle between rerolls.
            score += random.uniform(0, RANDOM_VARIETY_RANGE)

            # The ranking score is deliberately UNCAPPED. The deterministic
            # boosts above total 1.20 (1.30 with the free-tier nudge, 1.35 with
            # the premium taste profile; the avoid penalty and mood-tag clash
            # can each subtract 0.10),
            # so clamping here pinned every strong match to exactly 1.0 and let
            # weaker games tie them. Ranking stays uncapped; the displayed
            # match % instead uses `match_ratio` below, normalized against
            # fit_max (the fit points achievable for THIS request), so a
            # genuinely perfect fit for a narrow request reads as 100% without
            # every top pick saturating regardless of how well it actually fits.
            match_ratio = (max(0.0, fit_points) / fit_max) if fit_max > 0 else 0.5

            scored.append({**game, "score": score, "match_ratio": match_ratio})

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
            genres = game.get("genre_tags") or game.get("genres", [])

            # 1. Strong indie boost: games tagged as indie get significant boost
            if "indie" in genres:
                game["score"] += 0.55  # Strong boost for indie games

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

            # Floor only. A ceiling here would re-compress the strong matches
            # that _score_games intentionally leaves uncapped.
            game["score"] = max(0.0, game["score"])

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

    async def _get_user_signal_data(self, user_id: str) -> dict:
        """One pass over a user's signals for everything ranking needs.

        Returns:
            recently_shown: games signaled in the last 7 days (staleness window)
            rejected: games with a REJECTED_SIGNAL_TYPES signal (not_good_fit /
                played_didnt_stick / rated_down) — excluded permanently, no
                time window
            positive_ids / negative_ids: newest-first deduped game ids feeding
                the free-tier taste profiles
        """
        out: dict = {"recently_shown": set(), "rejected": set(),
                     "positive_ids": [], "negative_ids": []}
        try:
            docs = list(
                self.signals_collection.where("user_id", "==", user_id).stream()
            )
        except Exception as e:
            logger.error(f"Error fetching user signals: {e}")
            return out

        cutoff = datetime.utcnow() - timedelta(days=7)
        rows = []
        for doc in docs:
            data = doc.to_dict()
            gid = data.get("game_id")
            if not gid:
                continue
            ts = data.get("timestamp")
            if ts is not None and hasattr(ts, "timestamp"):
                ts = datetime.utcfromtimestamp(ts.timestamp())
            st = data.get("signal_type")
            rows.append((ts, gid, st))
            if ts and ts >= cutoff:
                out["recently_shown"].add(gid)
            if st in REJECTED_SIGNAL_TYPES:
                out["rejected"].add(gid)

        # Newest-first so the profiles reflect current taste when truncated.
        rows.sort(key=lambda r: r[0] or datetime.min, reverse=True)
        seen_pos: set = set()
        seen_neg: set = set()
        for _, gid, st in rows:
            if st in POSITIVE_SIGNAL_TYPES and gid not in seen_pos:
                seen_pos.add(gid)
                out["positive_ids"].append(gid)
            elif st in REJECTED_SIGNAL_TYPES and gid not in seen_neg:
                seen_neg.add(gid)
                out["negative_ids"].append(gid)
        return out

    async def _get_library_data(self, user_id: str) -> Optional[dict]:
        """Read the user's synced library (one document read).

        Returns {"played": set, "owned_unplayed": set, "playtimes": dict}
        of catalog game ids (playtimes maps matched game_id -> minutes),
        or None when no library is synced. The derived arrays are written
        by library_service at sync time.
        """
        try:
            doc = self.libraries_collection.document(user_id).get()
            if not doc.exists:
                return None
            data = doc.to_dict() or {}
            played = set(data.get("played_game_ids") or [])
            owned_unplayed = set(data.get("owned_unplayed_game_ids") or [])
            playtimes = {
                entry["game_id"]: int(entry.get("playtime_minutes") or 0)
                for entry in (data.get("games") or [])
                if isinstance(entry, dict) and entry.get("game_id")
            }
        except Exception as e:
            # A broken library doc must never block recommendations
            logger.error(f"Error fetching user library: {e}")
            return None
        if not played and not owned_unplayed:
            return None
        return {"played": played, "owned_unplayed": owned_unplayed, "playtimes": playtimes}

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

    async def _get_recently_shown_for_session(self, session_id: str) -> set[str]:
        """Get games shown in the current anonymous session (no user account)."""
        try:
            docs = list(
                self.signals_collection
                .where("session_id", "==", session_id)
                .stream()
            )
            game_ids = set()
            for doc in docs:
                data = doc.to_dict()
                game_id = data.get("game_id")
                if game_id:
                    game_ids.add(game_id)
            return game_ids
        except Exception as e:
            logger.error(f"Error fetching session signals: {e}")
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

    def _select_explanation_fields(
        self, templates: dict, used: set, time_available: Optional[int] = None
    ) -> list:
        """Pick at most MAX_EXPLANATION_BULLETS distinctive catalog (field, text) pairs.

        Priority favors game-specific fields. Skipped: known filler,
        boilerplate shared across the catalog (MAX_TEMPLATE_SHARE), bullets
        already emitted for another game in this response, and a
        non-renderable field that would take the last slot before any
        renderable bullet is chosen. `used` is mutated with the normalized
        rendered text of every selected bullet.
        """
        share = getattr(self, "_template_share", None) or {}
        selected = []
        for field in EXPLANATION_FIELD_PRIORITY:
            text = (templates or {}).get(field)
            if not text:
                continue
            if share.get(_normalize_bullet(text), 0) > MAX_TEMPLATE_SHARE:
                continue
            if (
                field not in RENDERABLE_EXPLANATION_FIELDS
                and len(selected) == MAX_EXPLANATION_BULLETS - 1
                and not any(f in RENDERABLE_EXPLANATION_FIELDS for f, _ in selected)
            ):
                continue
            if time_available is not None:
                text = text.replace("{time}", str(time_available))
            norm = _normalize_bullet(text)
            if norm in GENERIC_FILLER or norm in used:
                continue
            selected.append((field, text))
            used.add(norm)
            if len(selected) >= MAX_EXPLANATION_BULLETS:
                break
        return selected

    def _build_recommendation(
        self,
        game: dict,
        request: RecommendationRequest,
        in_library_ids: Optional[set] = None,
        library_playtimes: Optional[dict] = None,
        used_bullets: Optional[set] = None,
    ) -> GameRecommendation:
        """Build a GameRecommendation from game data.

        `used_bullets` is mutated in place and shared across every game in
        one response, so bullets never repeat across the (up to 3)
        recommendations returned to the client.
        """
        # Build explanation: at most 2 game-specific bullets, deduped across
        # the whole response (docs/GAME-CARD-REFRESH.md P0.2). Distinctive
        # hand-written catalog copy goes first; open slots are filled from
        # bullets generated off the game's own catalog fields. The old
        # "Fits a casual 30-minute session." fallback carried nothing about
        # the game and won for most of the catalog, so it is gone.
        if used_bullets is None:
            used_bullets = set()
        selected = self._select_explanation_fields(
            game.get("explanation_templates"), used_bullets, request.time_available
        )

        generated = generate_bullets(game, request.time_available)
        for field, candidates in generated.items():
            if len(selected) >= MAX_EXPLANATION_BULLETS:
                break
            if any(f == field for f, _ in selected):
                continue
            for text in candidates:
                norm = _normalize_bullet(text)
                if norm not in used_bullets:
                    selected.append((field, text))
                    used_bullets.add(norm)
                    break

        # Guarantee at least one bullet a shipped client renders (PRD: every
        # rec has a clear explanation). Only reachable if two picks share a
        # title, since the title variants are otherwise unique.
        if not any(field in RENDERABLE_EXPLANATION_FIELDS for field, _ in selected):
            selected = [("style_fit", generated["style_fit"][-1])] + selected[: MAX_EXPLANATION_BULLETS - 1]

        selected.sort(key=lambda pair: EXPLANATION_FIELD_PRIORITY.index(pair[0]))
        emitted = {}
        explanation_parts = []
        for field, text in selected:
            emitted[field] = text
            explanation_parts.append(ensure_sentence(text))

        summary = " ".join(explanation_parts)

        # Backlog Mode: say why this pick comes from the user's own library.
        # Only set when the pick actually came from the backlog pool —
        # catalog-fallback picks don't pretend to be backlog finds.
        library_fit = None
        if library_playtimes is not None and game["game_id"] in library_playtimes:
            minutes = library_playtimes[game["game_id"]]
            if minutes == 0:
                library_fit = "It's been sitting unplayed in your Steam library."
            else:
                library_fit = (
                    f"It's in your Steam library with only {minutes} minutes played."
                )
            summary = f"{summary} {library_fit}"

        # Build store links from game data
        store_links_data = game.get("store_links", {})
        store_links = None
        if store_links_data and any(store_links_data.values()):
            store_links = StoreLinks(**store_links_data)

        return GameRecommendation(
            game_id=game["game_id"],
            title=game["title"],
            platforms=[Platform(p) for p in game.get("platforms", [])],
            description_short=game.get("description_short", ""),
            explanation=RecommendationExplanation(
                summary=summary,
                time_fit=emitted.get("time_fit"),
                mood_fit=emitted.get("mood_fit"),
                stop_fit=emitted.get("stop_fit"),
                style_fit=emitted.get("style_fit"),
                session_fit=emitted.get("session_fit"),
                library_fit=library_fit,
            ),
            time_to_fun=TimeToFun(game.get("time_to_fun", "medium")),
            stop_friendliness=StopFriendliness(game.get("stop_friendliness", "checkpoints")),
            subscription_services=game.get("subscription_services", []),
            store_links=store_links,
            fun_fact=game.get("fun_fact"),
            match_score=min(max(game.get("match_ratio", game.get("score", 0.5)), 0.0), 1.0),
            in_library=bool(in_library_ids and game["game_id"] in in_library_ids),
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
