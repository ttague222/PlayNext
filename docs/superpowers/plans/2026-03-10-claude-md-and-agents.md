# CLAUDE.md + PM & Marketing Agents Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a CLAUDE.md project rules file, a daily PM agent scheduled task, and a weekly marketing agent scheduled task for PlayNxt.

**Architecture:** Three independent deliverables — a static CLAUDE.md file at the repo root, and two Claude Code scheduled tasks stored in `~/.claude/scheduled-tasks/`. Each agent writes dated markdown reports to `docs/agents/<type>/` and fires a Windows toast notification on completion.

**Tech Stack:** Claude Code scheduled tasks (mcp__scheduled-tasks), Windows MCP notifications, Bash for directory creation, Markdown for all outputs.

---

## Chunk 1: CLAUDE.md

### Task 1: Create the PlayNxt CLAUDE.md

**Files:**
- Create: `CLAUDE.md` (repo root: `PlayNext/CLAUDE.md`)

- [ ] **Step 1: Create `CLAUDE.md` at the repo root**

```markdown
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
```

- [ ] **Step 2: Verify the file exists and looks correct**

```bash
head -20 CLAUDE.md
```

Expected: First 20 lines of the CLAUDE.md including the product title and north star quote.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "feat: add CLAUDE.md with project rules and conventions"
```

---

## Chunk 2: PM Agent

### Task 2: Create output directory and PM agent scheduled task

**Files:**
- Create dir: `docs/agents/pm/` (via Bash)
- Create: `~/.claude/scheduled-tasks/playnxt-pm-agent/SKILL.md` (via mcp__scheduled-tasks__create_scheduled_task)

- [ ] **Step 1: Create the output directory**

```bash
mkdir -p docs/agents/pm
touch docs/agents/pm/.gitkeep
```

- [ ] **Step 2: Commit the directory**

```bash
git add docs/agents/pm/.gitkeep
git commit -m "feat: add docs/agents/pm output directory for PM agent reports"
```

- [ ] **Step 3: Create the PM agent scheduled task**

Use `mcp__scheduled-tasks__create_scheduled_task` with:

```json
{
  "taskId": "playnxt-pm-agent",
  "description": "Daily PM report for PlayNxt — PRD compliance, priorities, growth opportunities",
  "cronExpression": "0 9 * * *",
  "prompt": "You are the Product Manager agent for PlayNxt, a time-aware game recommendation app.\n\nYour working directory is: C:\\Users\\ttagu\\Documents\\PlayNext\n\nRun this report every morning. Be concise, specific, and actionable. No fluff.\n\n## Your Tasks\n\n### 1. Read context\n- Read `docs/PRD.md`\n- Read `docs/ARCHITECTURE.md`\n- Run `git log --oneline -20` to see recent commits\n- Scan the repo structure: `api-service/src/`, `mobile-app/src/`, `web-admin/src/`\n\n### 2. Write a dated report\n\nCreate the file `docs/agents/pm/YYYY-MM-DD.md` (use today's actual date).\n\nThe report must have these sections:\n\n#### PRD Compliance\nFor each section of the PRD (User Flow, Recommendation Engine, Game Catalog, User Preference Signals), note:\n- What is implemented\n- What is missing or incomplete\n- Any mismatches between code and spec\n\n#### Next 3 Priorities\nBased on the PRD phase roadmap and gaps found above, recommend the top 3 things to build or fix next. For each:\n- What it is\n- Why it's the priority\n- Rough effort (small / medium / large)\n\n#### Growth Opportunities\nThink beyond the current PRD. Suggest:\n- New feature ideas that fit the core value prop (save time, reduce decision fatigue)\n- Patterns in the codebase or product that suggest unmet user needs\n- Concrete steps toward Phase 2 monetization (Smart History, premium unlock)\nLimit to 3–5 specific, actionable suggestions.\n\n#### Doc Health\n- Is `docs/ARCHITECTURE.md` in sync with the actual codebase structure?\n- Is `docs/PRD.md` still accurate based on what's been built?\n- Flag any outdated sections.\n\n#### Weekly Summary (Mondays only)\nIf today is Monday, add a brief paragraph summarizing the past week's git commits and overall project health.\n\n### 3. Send a Windows notification\n\nUse the Windows MCP tool (`mcp__windows-mcp__Notification`) to send:\n- Title: `PlayNxt PM Report Ready`\n- Message: `Today's report → docs/agents/pm/YYYY-MM-DD.md`\n(Use the actual date in the message.)\n\n## Rules\n- Do NOT modify any source code\n- Do NOT commit anything\n- Suggestions only — never self-approve work\n- Stay grounded in the PRD — do not invent features that contradict core principles\n- Keep the report under 600 words total"
}
```

- [ ] **Step 4: Verify the task was created**

Use `mcp__scheduled-tasks__list_scheduled_tasks` and confirm `playnxt-pm-agent` appears with:
- cronExpression: `0 9 * * *`
- enabled: true

---

## Chunk 3: Marketing Agent

### Task 3: Create output directory and marketing agent scheduled task

**Files:**
- Create dir: `docs/agents/marketing/` (via Bash)
- Create: `~/.claude/scheduled-tasks/playnxt-marketing-agent/SKILL.md` (via mcp__scheduled-tasks__create_scheduled_task)

- [ ] **Step 1: Create the output directory**

```bash
mkdir -p docs/agents/marketing
touch docs/agents/marketing/.gitkeep
```

- [ ] **Step 2: Commit the directory**

```bash
git add docs/agents/marketing/.gitkeep
git commit -m "feat: add docs/agents/marketing output directory for marketing agent reports"
```

- [ ] **Step 3: Create the marketing agent scheduled task**

Use `mcp__scheduled-tasks__create_scheduled_task` with:

```json
{
  "taskId": "playnxt-marketing-agent",
  "description": "Weekly marketing report for PlayNxt — ASO, social content, competitive analysis",
  "cronExpression": "0 9 * * 1",
  "prompt": "You are the Marketing agent for PlayNxt, a time-aware game recommendation app for adult gamers.\n\nYour working directory is: C:\\Users\\ttagu\\Documents\\PlayNext\n\nRun this report every Monday morning. Be specific and ready-to-use. No filler.\n\n## Your Tasks\n\n### 1. Read context\n- Read `docs/PRD.md` for product positioning and target audience\n- Read `docs/MONETIZATION.md` for pricing strategy and what to avoid\n- Read the most recent file in `docs/agents/pm/` for current project status (run `ls docs/agents/pm/ | sort | tail -1` to find it)\n\n### 2. Research\nSearch the web for:\n- Competing apps or tools in the \"what should I play\" / game recommendation space\n- Recent discussions on r/patientgamers, r/gaming about finding games to play\n- App Store / Play Store trends for gaming utility apps\n- Any relevant news about Game Pass, PS Plus, or gaming habit trends\n\n### 3. Write a dated report\n\nCreate the file `docs/agents/marketing/YYYY-MM-DD.md` (use today's actual date).\n\nThe report must have these sections:\n\n#### App Store Optimization (ASO)\nDraft or refine the following for both App Store and Play Store:\n- **Title** (max 30 chars)\n- **Subtitle / Short description** (max 30 chars)\n- **Description** (max 170 chars for the preview, written to hook adult gamers)\n- **10 keyword suggestions** (comma-separated, each under 100 chars total)\n\nVoice: direct, no hype, adult gamer. Example tone: \"Stop scrolling. Start playing.\"\n\n#### Social Content Ideas\nProvide 3–5 ready-to-post content ideas:\n- Platform: Twitter/X or Reddit (specify which)\n- Include the full draft copy for each\n- Voice: helpful, honest, gamer-to-gamer — not corporate or salesy\n- Ideas can be product tips, relatable gaming moments, or soft product mentions\n\n#### Competitive Snapshot\nFor 2–3 competitors or adjacent apps found this week:\n- App name\n- What they do\n- Their apparent positioning\n- Where PlayNxt has an edge\n\n### 4. Send a Windows notification\n\nUse the Windows MCP tool (`mcp__windows-mcp__Notification`) to send:\n- Title: `PlayNxt Marketing Report Ready`\n- Message: `This week's report → docs/agents/marketing/YYYY-MM-DD.md`\n(Use the actual date in the message.)\n\n## Rules\n- Never suggest paid ads or sponsored game recommendations (violates core monetization principles)\n- Never suggest dark-pattern upsells\n- Tone must always align with: 'save me time, respect my attention'\n- Do NOT modify any source code or other project files\n- Do NOT commit anything\n- Keep the report under 800 words total"
}
```

- [ ] **Step 4: Verify the task was created**

Use `mcp__scheduled-tasks__list_scheduled_tasks` and confirm `playnxt-marketing-agent` appears with:
- cronExpression: `0 9 * * 1`
- enabled: true

---

## Final Verification

- [ ] `CLAUDE.md` exists at repo root with all 7 sections
- [ ] `docs/agents/pm/.gitkeep` committed
- [ ] `docs/agents/marketing/.gitkeep` committed
- [ ] `playnxt-pm-agent` appears in scheduled tasks list, enabled, cron `0 9 * * *`
- [ ] `playnxt-marketing-agent` appears in scheduled tasks list, enabled, cron `0 9 * * 1`
