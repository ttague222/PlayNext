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
    UserSignalCreate,
    UserSignal,
    SessionCreate,
    Session,
    FeedbackRequest,
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
    "UserSignalCreate",
    "UserSignal",
    "SessionCreate",
    "Session",
    "FeedbackRequest",
]
