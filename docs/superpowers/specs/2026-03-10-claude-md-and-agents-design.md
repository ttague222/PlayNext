# Design: CLAUDE.md + PM Agent + Marketing Agent

**Date:** 2026-03-10
**Project:** PlayNxt
**Approach:** Option A — focused single-purpose agents

---

## Overview

Three deliverables:
1. `CLAUDE.md` — project rules file for AI assistants working on the repo
2. `playnxt-pm-agent` — daily scheduled agent (9 AM) for project management
3. `playnxt-marketing-agent` — weekly scheduled agent (Mondays 9 AM) for marketing

---

## Section 1: CLAUDE.md

**Location:** `PlayNext/CLAUDE.md`

**Contents:**
- One-sentence product description + north star quote from PRD
- 8 core product non-negotiables (PRD §3) — must be enforced in all AI work
- GCP warning: never use `playbeacon` project; always use `playnxt-1a2c6`
- Tech stack at a glance: FastAPI / React Native+Expo / React+Vite / Firestore / Cloud Run
- Repo structure: `api-service/`, `mobile-app/`, `web-admin/`
- Links to key docs: PRD, ARCHITECTURE, MONETIZATION
- Working conventions: deterministic logic over ML, no account required for MVP, WCAG 2.1 AA target

---

## Section 2: PM Agent (Daily)

**Scheduled task name:** `playnxt-pm-agent`
**Schedule:** Daily at 9 AM local time
**Output location:** `docs/agents/pm/YYYY-MM-DD.md`
**Notification:** Windows toast when report is written

**Report sections:**
1. **PRD Compliance** — what's built vs PRD requirements, flagged gaps
2. **Next 3 Priorities** — ranked by PRD phase and implementation effort
3. **Growth Opportunities** — new feature ideas beyond the roadmap, market opportunities from signal patterns, post-MVP acceleration suggestions toward Phase 2 (Smart History, premium)
4. **Doc Health** — flags if ARCHITECTURE or PRD is out of sync with actual code
5. **Weekly Summary** — (Mondays only) rolling paragraph of the week's progress

**Guardrails:**
- Read-only on codebase — no code changes
- Suggestions only, never self-approves work
- Grounded in PRD, no hallucinated features

---

## Section 3: Marketing Agent (Weekly)

**Scheduled task name:** `playnxt-marketing-agent`
**Schedule:** Every Monday at 9 AM local time
**Output location:** `docs/agents/marketing/YYYY-MM-DD.md`
**Notification:** Windows toast when report is written

**Report sections:**
1. **ASO** — draft/refined App Store and Play Store title, subtitle, description, 10 keyword suggestions
2. **Social Content** — 3–5 ready-to-post ideas for Twitter/X and Reddit; voice: helpful adult gamer tool, no hype
3. **Competitive Snapshot** — 2–3 competitors or adjacent apps, what they're doing, PlayNxt's edge

**Research inputs:**
- `docs/PRD.md`, `docs/MONETIZATION.md`, latest PM report
- Web research: competitors, gaming app trends, r/patientgamers, r/gaming

**Guardrails:**
- No paid ad or sponsored recommendation suggestions (violates monetization principles)
- Tone aligned with "save me time, respect my attention"

---

## File Structure After Implementation

```
PlayNext/
├── CLAUDE.md                          # NEW: project rules for AI assistants
└── docs/
    ├── PRD.md
    ├── ARCHITECTURE.md
    ├── MONETIZATION.md
    └── agents/
        ├── pm/
        │   └── YYYY-MM-DD.md          # Daily PM reports
        └── marketing/
            └── YYYY-MM-DD.md          # Weekly marketing reports
```

Scheduled tasks stored in: `~/.claude/scheduled-tasks/`
- `playnxt-pm-agent/SKILL.md`
- `playnxt-marketing-agent/SKILL.md`
