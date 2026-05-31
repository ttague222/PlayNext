# Catalog Field Normalization + Engine Fix — Design

**Date:** 2026-05-31
**Status:** Approved (pending implementation plan)
**Repo:** `ttague222/PlayNext` — `api-service/` (Firestore project `playnxt-1a2c6`, collection `games`)

## Problem

The `games` collection (~1,029 docs) contains **two field schemas**:

- **Canonical/new schema** (~311 docs, incl. the 285 hand-curated + 26 recent additions, matches `src/models/game.py`): `release_year`, `genre_tags`, `mood_tags`, `energy_level`, `content_warnings`, `multiplayer_modes`.
- **Alt/legacy schema** (~718 docs, bulk import): `year`, `genres`, `moods`, `energy`, `warnings`, `multiplayer`, plus extras (`category`, `title_lower`, `search_keywords`, `description`, `franchise`).

The recommendation engine (`src/services/recommendation_service.py`) is **half-migrated**: it reads the new names in most places (`energy_level`, `genre_tags`, `multiplayer_modes`) but reads the old `genres` in one spot (the indie boost, line ~405). Consequences:

- The 718 alt-schema games are degraded in mood/genre/multiplayer filtering (engine reads `energy_level`/`genre_tags`/`multiplayer_modes`; they store `energy`/`genres`/`multiplayer`).
- The new-schema games (incl. the 26 just added) silently miss the **indie boost** (engine reads `genres`; they store `genre_tags`).
- `get_game` (`Game(**data)`) fails for alt-schema docs because `release_year`/`energy_level` are required and absent.

The data is **not missing** — it exists under different field names. No external source (RAWG) is needed.

## Goal

Every doc exposes the canonical field names the models/engine expect, eliminating the half-migrated degradation — additively and reversibly, without fabricating any values.

## Design

### Component 1 — `api-service/migrate_field_names.py` (new)

Standalone script following the existing `add_genre_games.py` pattern (firebase_admin + `ApplicationDefault()` / `serviceAccountKey.json`, iterate the `games` collection).

Field pairs to normalize (old → new):

| old | new |
|---|---|
| `year` | `release_year` |
| `genres` | `genre_tags` |
| `moods` | `mood_tags` |
| `energy` | `energy_level` |
| `warnings` | `content_warnings` |
| `multiplayer` | `multiplayer_modes` |

**Copy rule:** for each pair, copy `old → new` **only if the new field is empty/missing** (`None`, `[]`, `""`). Never overwrite an existing new value. This auto-resolves all 67 "both present" / conflict docs (4 year, 52 genre, 65 mood) by treating the curated new value as authoritative.

**Untouched:** old fields are left in place (additive, reversible). `title_lower`, `franchise`, `category`, `description`, `search_keywords` untouched.

**Behavior:**
- `--dry-run`: print proposed per-doc changes + summary; no writes.
- Default: write only changed docs, set fresh `updated_at`. Idempotent (safe to re-run).
- After processing, report the **~5 docs** still missing a required `Game` field (`release_year`, `energy_level`, `time_to_fun`, `stop_friendliness`, `description_short`, `title`) — list their ids; do **not** invent values.

### Component 2 — `recommendation_service.py` indie-boost fix (line ~405)

Change the indie boost to read `genre_tags` (the canonical field) so it applies to all games post-migration. Keep `genres` as a fallback read for safety:

```python
genres = game.get("genre_tags") or game.get("genres", [])
```

### Component 3 — Verification

Re-run the schema audit script after migration:
- `release_year` / `genre_tags` / `mood_tags` / `energy_level` null-counts drop to ~5 (the flagged docs).
- `Game(**data)` validates for all but the ~5 flagged docs.
- Spot-check 2–3 migrated docs (e.g. `god-of-war-2018`, `1000xresist`) show populated new fields.

## Data flow & safety

1. Run `migrate_field_names.py --dry-run` → user reviews the diff (same gate used for the off-schema fix).
2. Apply migration.
3. Apply the one-line engine fix.
4. Run verification audit.

Additive (no deletions) ⇒ reversible and zero risk to mobile/admin readers that may still reference old names.

## Testing

- Unit test for the indie-boost change in `recommendation_service.py`: a game with `genre_tags=["indie"]` (no `genres`) receives the indie score boost.
- The migration script is validated by its `--dry-run` preview + the post-run audit (one-shot data op; no separate test harness).

## Out of scope

- Deleting old duplicate fields (separate cleanup pass, later).
- The ~5 docs missing required fields (manual follow-up).
- Any RAWG fetch / backfill (unnecessary — data exists locally).
- Deleting the stale `Documents/PlayNext` repo (tracked separately).
