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
