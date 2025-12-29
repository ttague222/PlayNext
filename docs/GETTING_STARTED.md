# Getting Started with PlayNxt

## Prerequisites

- Node.js 18+
- Python 3.11+
- Firebase project with Firestore enabled
- (Optional) Expo account for mobile builds

## 1. Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Firestore Database
3. Enable Authentication (Anonymous + Google providers)
4. Download service account key for API service
5. Copy web config for mobile app and web admin

## 2. API Service Setup

```bash
cd api-service

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your Firebase credentials

# Run locally
cd src
uvicorn main:app --reload --port 8000
```

API will be available at `http://localhost:8000`

## 3. Mobile App Setup

```bash
cd mobile-app

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Firebase config and API URL

# Start Expo
npm start
```

Press `i` for iOS simulator, `a` for Android emulator, or scan QR code with Expo Go.

## 4. Web Admin Setup

```bash
cd web-admin

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Firebase config

# Start development server
npm run dev
```

Admin dashboard will be available at `http://localhost:3000`

## 5. Seed Initial Data

Before using the app, you need games in the catalog. You can:

### Option A: Manual Entry (Web Admin)
1. Open web admin at `http://localhost:3000`
2. Sign in with your Firebase account
3. Go to Game Catalog → Add Game
4. Fill in game metadata

### Option B: Seed Script (API)
Create a seed script or use the API directly:

```python
# Example: Seed Vampire Survivors
import requests

game = {
    "game_id": "vampire-survivors",
    "title": "Vampire Survivors",
    "platforms": ["pc", "console", "handheld"],
    "release_year": 2022,
    "genre_tags": ["roguelike", "action", "arcade"],
    "time_tags": [15, 30, 60],
    "energy_level": "low",
    "mood_tags": ["relaxing", "satisfying"],
    "play_style": ["action"],
    "time_to_fun": "short",
    "stop_friendliness": "anytime",
    "multiplayer_modes": ["solo", "local_coop"],
    "description_short": "Mow down thousands of monsters in this hypnotic auto-battler.",
    "explanation_templates": {
        "time_fit": "Quick runs fit perfectly in {time}-minute windows",
        "mood_fit": "Low-stakes gameplay for winding down",
        "stop_fit": "Quit anytime—progress auto-saves"
    },
    "subscription_services": ["game_pass"]
}

response = requests.post(
    "http://localhost:8000/api/games",
    json=game,
    headers={"Authorization": f"Bearer {YOUR_FIREBASE_TOKEN}"}
)
```

## Testing the Flow

1. Open mobile app
2. Tap "What should I play?"
3. Select time: 30 minutes
4. Select mood: Wind down
5. (Optional) Add filters
6. Tap "Show me what to play"
7. View recommendations
8. Tap "I'll play this" or "Give me other options"

## Next Steps

- Add more games to the catalog (target: 200-300 for MVP)
- Configure Sentry for error tracking
- Set up CI/CD pipelines
- Deploy to production

## Troubleshooting

### API returns 401 Unauthorized
- Check Firebase service account key path
- Verify Firebase project ID matches

### Mobile app can't connect to API
- Check `EXPO_PUBLIC_API_BASE_URL` in `.env`
- Ensure API is running and accessible
- For physical device, use your machine's IP instead of localhost

### Firestore permission denied
- Check Firestore rules allow your operations
- Verify user is authenticated

### No recommendations returned
- Ensure games exist in the catalog
- Check game metadata matches filter criteria
