# PlayNxt

AI-powered board game recommendations based on mood and available time. Live on iOS App Store and Google Play.

- **GitHub:** https://github.com/ttague222/PlayNext
- **App Store:** https://apps.apple.com/us/app/playnxt-game-recommendations/id6757089064
- **Google Play:** https://play.google.com/store/apps/details?id=com.playnxt.app

## Structure

```
PlayNxt/
├── mobile-app/      # React Native + Expo — main user-facing app
│   └── src/
│       ├── components/
│       ├── config/
│       ├── context/
│       ├── hooks/
│       ├── navigation/
│       ├── screens/
│       ├── services/
│       └── utils/
├── api-service/     # Python FastAPI — recommendation engine
│   └── src/
│       ├── api/     # Routes: recommend, games, signals, buckets, config
│       ├── core/    # Config, logging, rate limiter
│       ├── db/      # Firebase integration
│       ├── models/
│       └── services/
├── web-admin/       # React — admin dashboard (Vite + Firebase Auth)
│   └── src/
│       ├── api/
│       ├── components/
│       ├── context/
│       └── pages/
└── docs/
```

## Tech Stack
- **Mobile:** React Native, Expo, Firebase Auth
- **API:** Python, FastAPI, Firebase Firestore, Sentry, SlowAPI rate limiting
- **Admin:** React, Vite, Firebase Auth
- **CI/CD:** GitHub Actions → Google Cloud Run (API), Vercel (web-admin)
- **Game data:** RAWG API (requires `EXPO_PUBLIC_RAWG_API_KEY` EAS secret)

## Mobile App Conventions

### Component & Screen Patterns
- Screens use arrow function const: `const PlayScreen = () => { ... }` — not function declarations
- Use `useNavigation()` hook for navigation — do not pass `navigation` as a prop
- Styles at the bottom of each file via `StyleSheet.create({})`
- All user-facing strings are plain English (no i18n yet); keep them in JSX for now
- New files should use TypeScript (`.tsx`); existing JS files stay JS unless significantly changed

### Auth & Data Flow
- Auth supports Anonymous, Google, and Apple Sign-In — all three paths must work
- Auth state from `useAuth()` (wraps `AuthContext`) — never initialize Firebase Auth in a component
- All API calls through `services/api.js` — screens never use axios directly
- API base URL comes from `Constants.expoConfig?.extra?.apiBaseUrl` — never hardcode localhost in production paths

### Context & Hooks
- App-wide state in `context/` — Auth, Recommendation, SavedGames, Premium, Ads
- Screens consume context via custom hooks, not raw `useContext`
- `useCallback` required for any function passed as a prop
- Firebase listeners and subscriptions belong in context providers

### Structure Rules
- `screens/` — navigation layer only; no direct API calls or business logic
- `services/` — all API and Firebase calls; token attached via `apiClient` interceptor
- `components/` — reusable UI; must not import from `screens/`

## API Service Conventions (`api-service/`)

### Structure Rules
- Route handlers live in `src/api/routes_*.py` — one file per domain (games, recommend, signals, buckets, config)
- Route handlers are thin: validate input, call one service method, handle exceptions, return response model
- All business logic lives in `src/services/` — never in route handlers
- Firestore access lives in `src/db/firebase.py` — services call `get_collection()`, never instantiate Firestore directly

### Patterns
- Every router: `router = APIRouter(prefix="/path", tags=["Tag"])`
- Every endpoint: explicit `response_model=` on the decorator
- Auth: `user_id: Optional[str] = Depends(get_user_id)` — the `get_user_id` dependency handles token verification
- Logging: `logger = logging.getLogger("playnext-api.<module>")` at module level
- Constants (score weights, thresholds, mapping tables) defined at module level in the service file that owns them
- Never use `print()` — always `logger.info/warning/error()`

### Error Handling
- Route handlers catch `Exception`, log it with `logger.error()`, and raise `HTTPException(status_code=500)`
- Validation errors (bad input) raise `HTTPException(status_code=400)` with a clear `detail` message
- Services raise plain exceptions — they do not raise HTTPException

## Golden Examples
- **Screen pattern:** `mobile-app/src/screens/PlayScreen.js` — canonical screen layout, animation, SafeAreaView, useNavigation
- **API router pattern:** `api-service/src/api/routes_recommend.py` — thin route handlers, Depends auth, response_model, service delegation

## Key Conventions
- API routers live in `api-service/src/api/` — `recommend_router`, `games_router`, `signals_router`, `buckets_router`, `config_router`
- Firebase initialized in `api-service/src/db/firebase.py`
- Mobile app config in `mobile-app/src/config/`
- Never commit `serviceAccountKey.json` or `.env` files

## Running Locally

```bash
# API
cd api-service
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn src.main:app --reload

# Mobile
cd mobile-app
npm install
npx expo start

# Web admin
cd web-admin
npm install
cp .env.example .env
npm run dev
```

## ⚠️ Known Issues
- RAWG API key was rotated — new key must be set as EAS Secret `EXPO_PUBLIC_RAWG_API_KEY` in the Expo dashboard for production builds
