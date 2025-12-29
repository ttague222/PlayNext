# PlayNxt Architecture

## Overview

PlayNxt follows a multi-tier microservice architecture with three main components:

```
┌─────────────────┐     ┌─────────────────┐
│   Mobile App    │     │   Web Admin     │
│  (React Native) │     │  (React + Vite) │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │      API Service      │
         │       (FastAPI)       │
         └───────────┬───────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│    Firebase     │    │    Pinecone     │
│   (Firestore)   │    │  (Vector DB)    │
└─────────────────┘    └─────────────────┘
```

## Repository Structure

```
PlayNext/
├── api-service/          # FastAPI backend
│   ├── src/
│   │   ├── api/          # Route handlers
│   │   ├── core/         # Config, logging, rate limiting
│   │   ├── db/           # Database clients
│   │   ├── models/       # Pydantic models
│   │   └── services/     # Business logic
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
│
├── mobile-app/           # React Native (Expo) app
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── screens/      # Screen components
│   │   ├── context/      # React Context providers
│   │   ├── services/     # API client
│   │   ├── hooks/        # Custom React hooks
│   │   ├── navigation/   # React Navigation setup
│   │   ├── config/       # Firebase, etc.
│   │   └── styles/       # Theme and styling
│   ├── assets/
│   ├── App.js
│   ├── app.config.js
│   └── package.json
│
├── web-admin/            # React (Vite) admin dashboard
│   ├── src/
│   │   ├── api/          # API client
│   │   ├── components/   # React components
│   │   ├── context/      # Auth context
│   │   ├── pages/        # Page components
│   │   └── styles/       # CSS
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── docs/                 # Documentation
    ├── PRD.md
    └── ARCHITECTURE.md
```

## Technology Stack

### Mobile App
- **Framework:** React Native + Expo 52
- **Navigation:** React Navigation 7
- **State:** React Context API
- **HTTP:** Axios
- **Auth:** Firebase Auth
- **Error Tracking:** Sentry

### Web Admin
- **Framework:** React 18
- **Build Tool:** Vite 5
- **Routing:** React Router DOM 6
- **HTTP:** Axios
- **Auth:** Firebase Auth

### API Service
- **Framework:** FastAPI
- **Language:** Python 3.11
- **Database:** Firebase/Firestore
- **Vector DB:** Pinecone (optional)
- **Rate Limiting:** SlowAPI
- **Error Tracking:** Sentry

### Infrastructure
- **Containerization:** Docker
- **Hosting:** Google Cloud Run
- **Auth Provider:** Firebase Authentication
- **Logging:** JSON-structured (GCP compatible)

## API Endpoints

### Recommendations
- `POST /api/recommend` - Get game recommendations
- `POST /api/recommend/reroll` - Get new recommendations

### Games
- `GET /api/games` - List games
- `GET /api/games/{id}` - Get single game
- `POST /api/games` - Create game (admin)
- `PUT /api/games/{id}` - Update game (admin)
- `DELETE /api/games/{id}` - Delete game (admin)
- `GET /api/games/stats` - Catalog statistics

### Signals
- `POST /api/signals/feedback` - Submit feedback
- `POST /api/signals/accept` - Accept recommendation
- `POST /api/signals/session` - Create session
- `GET /api/signals/session/{id}` - Get session
- `GET /api/signals/history` - User signal history
- `GET /api/signals/game/{id}` - Game signal stats

### Health
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health check

## Authentication

### Mobile App
- Anonymous sign-in by default (no account required for MVP)
- Optional Google sign-in (post-MVP)
- Firebase ID tokens passed in Authorization header

### Web Admin
- Email/password or Google sign-in
- Firebase ID tokens added via Axios interceptor
- Protected routes redirect to login

### API Service
- Validates Firebase ID tokens
- Anonymous requests allowed for recommendation endpoints
- Admin endpoints require authenticated user

## Data Models

### Game (Firestore: `/games`)
```typescript
{
  game_id: string;
  title: string;
  platforms: ['pc', 'console', 'handheld'];
  release_year: number;
  genre_tags: string[];
  time_tags: [15, 30, 60, 90, 120];
  energy_level: 'low' | 'medium' | 'high';
  mood_tags: string[];
  play_style: ['narrative', 'action', 'puzzle_strategy', 'sandbox_creative'];
  time_to_fun: 'short' | 'medium' | 'long';
  stop_friendliness: 'anytime' | 'checkpoints' | 'commitment';
  multiplayer_modes: ['solo', 'local_coop', 'online_coop', 'competitive'];
  description_short: string;
  explanation_templates: {
    time_fit?: string;
    mood_fit?: string;
    stop_fit?: string;
    style_fit?: string;
    session_fit?: string;
  };
  avg_session_length?: number;
  subscription_services?: string[];
  content_warnings?: string[];
}
```

### User Signal (Firestore: `/user_signals`)
```typescript
{
  signal_id: string;
  user_id?: string;
  session_id: string;
  game_id: string;
  signal_type: 'worked' | 'not_good_fit' | 'played_loved' |
               'played_neutral' | 'played_didnt_stick' | 'skipped' | 'accepted';
  context?: {
    time_selected: number;
    mood_selected: string;
    play_style_selected?: string;
  };
  timestamp: datetime;
}
```

### Session (Firestore: `/sessions`)
```typescript
{
  session_id: string;
  user_id?: string;
  started_at: datetime;
  ended_at?: datetime;
  games_shown: string[];
  reroll_count: number;
  accepted_game_id?: string;
}
```

## Recommendation Engine

### Flow
1. User provides: time, mood, (optional) play style, platform, session type
2. Engine filters games by compatibility
3. Engine scores remaining games using heuristics
4. Top 1-3 games returned with explanations

### Scoring Heuristics
- Stop-friendliness: +0.25 (anytime), +0.15 (checkpoints)
- Time-to-fun: +0.2 (short), +0.1 (medium)
- Mood match: +0.2
- Play style match: +0.15
- Platform availability: +0.1 (multi-platform)
- Subscription availability: +0.1

### Fallback Logic
When no exact matches found:
1. Relax platform filter
2. Relax play style filter
3. Relax time bracket (±1 level)
4. Return best partial matches with explanation

## Deployment

### API Service (Cloud Run)
```bash
# Build and deploy
gcloud run deploy playnxt-api \
  --source ./api-service \
  --region us-central1 \
  --allow-unauthenticated
```

### Mobile App (EAS Build)
```bash
# Development build
npx eas build --profile development --platform all

# Production build
npx eas build --profile production --platform all
```

### Web Admin (Cloud Run)
```bash
# Build and deploy
gcloud run deploy playnxt-web-admin \
  --source ./web-admin \
  --region us-central1 \
  --allow-unauthenticated
```

## Environment Variables

See `.env.example` files in each service directory for required configuration.
