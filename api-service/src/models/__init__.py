"""
PlayNxt Models

Pydantic models for the PlayNxt API.
"""

from .game import (
    EnergyLevel,
    TimeToFun,
    StopFriendliness,
    Platform,
    PlayStyle,
    MultiplayerMode,
    ExplanationTemplates,
    StoreLinks,
    GameBase,
    GameCreate,
    Game,
    GameSummary,
)

from .recommendation import (
    EnergyMood,
    SessionType,
    DiscoveryMode,
    RecommendationRequest,
    RecommendationExplanation,
    GameRecommendation,
    RecommendationResponse,
)

from .user import (
    SignalType,
    PremiumTier,
    PremiumFeatures,
    UserBase,
    UserCreate,
    User,
    SignalContext,
    WhyNotReason,
    UserSignalCreate,
    UserSignal,
    SessionCreate,
    Session,
    FeedbackRequest,
    RatingUpdate,
    RatingSummary,
)

from .library import (
    SteamSyncRequest,
    LibraryGameEntry,
    SteamSyncResult,
    SteamLibraryStatus,
)

from .bucket import (
    BucketType,
    BUCKET_CONFIG,
    BucketGameBase,
    BucketGameCreate,
    BucketGame,
    BucketBase,
    BucketCreate,
    Bucket,
    BucketWithGames,
    BucketSummary,
    UserBucketsResponse,
    AddGameToBucketRequest,
    MoveGameRequest,
)

__all__ = [
    # Game models
    "EnergyLevel",
    "TimeToFun",
    "StopFriendliness",
    "Platform",
    "PlayStyle",
    "MultiplayerMode",
    "ExplanationTemplates",
    "StoreLinks",
    "GameBase",
    "GameCreate",
    "Game",
    "GameSummary",
    # Recommendation models
    "EnergyMood",
    "SessionType",
    "DiscoveryMode",
    "RecommendationRequest",
    "RecommendationExplanation",
    "GameRecommendation",
    "RecommendationResponse",
    # User models
    "SignalType",
    "PremiumTier",
    "PremiumFeatures",
    "UserBase",
    "UserCreate",
    "User",
    "SignalContext",
    "WhyNotReason",
    "UserSignalCreate",
    "UserSignal",
    "SessionCreate",
    "Session",
    "FeedbackRequest",
    "RatingUpdate",
    "RatingSummary",
    # Library models
    "SteamSyncRequest",
    "LibraryGameEntry",
    "SteamSyncResult",
    "SteamLibraryStatus",
    # Bucket models
    "BucketType",
    "BUCKET_CONFIG",
    "BucketGameBase",
    "BucketGameCreate",
    "BucketGame",
    "BucketBase",
    "BucketCreate",
    "Bucket",
    "BucketWithGames",
    "BucketSummary",
    "UserBucketsResponse",
    "AddGameToBucketRequest",
    "MoveGameRequest",
]
