# PlayNxt

A time-aware, mood-aware game recommendation app that helps you find the perfect game for your current moment.

## Project Structure

```
PlayNxt/
├── api-service/      # FastAPI backend
├── web-admin/        # React admin dashboard
├── mobile-app/       # React Native + Expo mobile app
└── .github/          # CI/CD workflows
```

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker (optional, for containerized deployment)

### API Service

```bash
cd api-service

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

### Web Admin Dashboard

```bash
cd web-admin

# Install dependencies
npm install

# Run development server
npm run dev
```

The admin dashboard will be available at `http://localhost:5173`

### Mobile App

```bash
cd mobile-app

# Install dependencies
npm install

# Start Expo development server
npx expo start
```

## Environment Variables

### API Service

Create `api-service/.env`:

```env
# Firebase
FIREBASE_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# Sentry (optional)
SENTRY_DSN=your-sentry-dsn

# Environment
ENVIRONMENT=development
```

### Web Admin

Create `web-admin/.env`:

```env
VITE_API_URL=http://localhost:8000
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_PROJECT_ID=your-project-id
```

### Mobile App

Create `mobile-app/.env`:

```env
EXPO_PUBLIC_API_URL=http://localhost:8000
```

## Testing

### API Tests

```bash
cd api-service
pytest
```

## Deployment

### GitHub Actions

The project includes CI/CD workflows for:

- **API Service**: Deploys to Google Cloud Run on push to `main`
- **Web Admin**: Builds and deploys to Cloud Run on push to `main`
- **Mobile App**: Triggers EAS builds for iOS/Android

### Required GitHub Secrets

```
GCP_PROJECT_ID          # Google Cloud project ID
GCP_SA_KEY              # Service account key (JSON)
GCP_REGION              # e.g., us-central1
EXPO_TOKEN              # EAS token for mobile builds
```

### Manual Deployment

#### API Service

```bash
cd api-service
gcloud run deploy playnxt-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

#### Web Admin

```bash
cd web-admin
npm run build
gcloud run deploy playnxt-web-admin \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

## Game Catalog

The game catalog contains 200+ curated games with:

- **Mood tags**: relaxing, exciting, challenging, cozy, etc.
- **Genre tags**: action, rpg, puzzle, indie, etc.
- **Time estimates**: time_to_fun, stop_friendliness
- **Platform info**: PC, PlayStation, Xbox, Switch, Mobile
- **Subscription services**: Game Pass, PS Plus, etc.

Games can be managed via the web admin dashboard.

## Architecture

- **API**: FastAPI with Firestore database
- **Recommendations**: Mood + time + platform filtering with weighted scoring
- **Mobile**: React Native with Expo for cross-platform support
- **Admin**: React with Vite for game catalog management

## License

Proprietary - All rights reserved
