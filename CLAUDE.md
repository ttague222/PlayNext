# PlayNxt — Claude Code Rules

## What is PlayNxt?

PlayNxt is a time-aware, mood-aware game recommendation app that helps adult gamers decide what to play right now. It returns 1–3 confident, explainable recommendations optimized for **decision confidence**, not browsing depth.

> **North Star:** "PlayNxt helps gamers stop deciding and start playing by delivering confident, time-aware recommendations with minimal friction."

---

## Core Product Non-Negotiables (Must Be Enforced)

These rules come directly from the PRD and must never be violated:

1. **Time available is always required input** — never make it optional
2. **Energy/mood is always required input** — never make it optional
3. **Platform input is optional** — must never block results
4. **Maximum of 3 recommendations per session** — never return more
5. **Every recommendation must include a clear explanation** — no bare results
6. **No account required for MVP** — anonymous use must always work
7. **Preference learning must be lightweight and contextual** — no profile-building UX
8. **Simple, explainable heuristics over machine learning** — deterministic logic only

---

## GCP / Firebase Warning

**IMPORTANT:** PlayNxt uses the `playnxt-1a2c6` GCP project (project number: 167253232570).

- **Correct API URL:** `https://playnxt-api-167253232570.us-central1.run.app/api`
- **Firebase Project ID:** `playnxt-1a2c6`

There is a stray API service deployed under the `playbeacon` project (`playnxt-api-346141384720.us-central1.run.app`). **Do NOT use this URL for PlayNxt.** The PlayBeacon project is for a separate Roblox games app.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile app | React Native + Expo 52 |
| Admin dashboard | React 18 + Vite 5 |
| API backend | FastAPI (Python 3.11) |
| Database | Firebase Firestore |
| Vector DB | Pinecone (optional) |
| Auth | Firebase Authentication |
| Hosting | Google Cloud Run |
| Error tracking | Sentry |

---

## Repo Structure

```
PlayNext/
├── api-service/      # FastAPI backend
│   └── src/
│       ├── api/      # Route handlers
│       ├── core/     # Config, logging, rate limiting
│       ├── db/       # Database clients
│       ├── models/   # Pydantic models
│       └── services/ # Business logic (recommendation engine)
├── mobile-app/       # React Native + Expo
│   └── src/
│       ├── components/
│       ├── screens/
│       ├── context/
│       ├── services/
│       └── hooks/
├── web-admin/        # React + Vite admin dashboard
└── docs/
    ├── PRD.md
    ├── ARCHITECTURE.md
    └── MONETIZATION.md
```

---

## Key Docs

- **PRD:** `docs/PRD.md` — full product requirements and user flows
- **Architecture:** `docs/ARCHITECTURE.md` — system design, API endpoints, data models
- **Monetization:** `docs/MONETIZATION.md` — pricing strategy and what to never do

---

## Working Conventions

- **No ML:** Recommendation engine uses deterministic weighted scoring — do not introduce machine learning
- **No ads, no sponsored results:** Core monetization principle — these destroy user trust
- **Anonymous first:** All recommendation endpoints must work without authentication
- **Accessibility:** Target WCAG 2.1 AA compliance in all UI work
- **Fallback always:** Recommendation engine must never return empty results (see PRD §5.6 for fallback hierarchy)
- **Explanation required:** Every recommendation card must include a "why this fits" explanation
- **Max 3 recs:** Never return more than 3 recommendations in a single response
