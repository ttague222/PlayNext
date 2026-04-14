# PlayNxt — Find the perfect game for right now

> AI-powered game recommendations based on how much time you have and how you're feeling.

Most recommendation engines ask "what do you like?" PlayNxt asks two better questions: **How much time do you have?** and **What are you in the mood for?** The result is a recommendation that actually fits your current moment — not just your history.

Live on **iOS** and **Android**.

---

## Architecture

```
PlayNxt/
├── api-service/     # FastAPI recommendation engine (Python)
├── mobile-app/      # React Native + Expo (iOS & Android)
└── web-admin/       # React admin dashboard
```

CI/CD via GitHub Actions → cloud deployment.

---

## Tech Stack

![Python](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi)
![React Native](https://img.shields.io/badge/React_Native-20232A?style=flat&logo=react&logoColor=61DAFB)
![Expo](https://img.shields.io/badge/Expo-1B1F23?style=flat&logo=expo&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=flat&logo=Firebase&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=flat&logo=docker&logoColor=white)

---

## Key Features

- **Mood & time-aware recommendations** — not just "what you like" but "what fits right now"
- **Cross-platform** — iOS and Android via Expo
- **FastAPI backend** — lightweight, fast recommendation engine
- **Admin dashboard** — manage content and monitor usage
- **CI/CD pipelines** — automated builds and deployments via GitHub Actions

---

## Getting Started

```bash
# API service
cd api-service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload

# Mobile app
cd mobile-app
npm install
npx expo start
```

---

Built by [Watchlight Interactive](https://watchlightinteractive.com)
