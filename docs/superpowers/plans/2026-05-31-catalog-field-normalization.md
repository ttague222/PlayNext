# Catalog Field Normalization + Engine Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize the ~718 legacy-schema game docs to the canonical field names the models/engine expect, and fix the half-migrated indie-boost so it reads `genre_tags`.

**Architecture:** Two code changes + one data operation. (1) A one-line read fix in the recommendation engine. (2) A new idempotent, additive Firestore migration script with a pure, unit-tested transform function. (3) A reviewed dry-run → apply → audit execution against the live `playnxt-1a2c6` Firestore.

**Tech Stack:** Python 3.14, FastAPI, firebase_admin / Firestore, pytest + pytest-asyncio (`asyncio_mode = auto`).

**Working directory for all commands:** `C:\Users\ttagu\Projects\PlayNxt\api-service`

---

### Task 1: Fix indie boost to read `genre_tags`

The indie boost in `_apply_surprise_boost` reads the legacy `genres` field, so it never fires for canonical-schema games (which store `genre_tags`). Change it to read `genre_tags`, falling back to `genres`.

**Files:**
- Modify: `src/services/recommendation_service.py:405`
- Test: `tests/test_recommendation_service.py` (add one test to the existing `TestSurpriseMode` class)

- [ ] **Step 1: Write the failing test**

Add this method inside the existing `class TestSurpriseMode:` in `tests/test_recommendation_service.py` (it reuses that class's `service` fixture):

```python
    @pytest.mark.asyncio
    async def test_indie_boost_reads_genre_tags(self, service):
        """Indie boost must use the canonical genre_tags field, not legacy genres."""
        service._get_global_popularity = AsyncMock(return_value={})
        service._get_user_game_history = AsyncMock(return_value=set())

        games = [
            {"game_id": "indie-1", "title": "Tiny Quest",
             "genre_tags": ["indie"], "subscription_services": [], "score": 0.5},
            {"game_id": "action-1", "title": "Big Shooter",
             "genre_tags": ["action"], "subscription_services": [], "score": 0.5},
        ]

        with patch("random.uniform", return_value=0.0):
            boosted = await service._apply_surprise_boost(games, None)

        indie = next(g for g in boosted if g["game_id"] == "indie-1")
        action = next(g for g in boosted if g["game_id"] == "action-1")

        # Only the indie game receives the +0.55 boost, so it must score higher.
        assert indie["score"] > action["score"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_recommendation_service.py::TestSurpriseMode::test_indie_boost_reads_genre_tags -v`
Expected: FAIL — both scores equal (0.65), assertion `indie > action` is False, because the code reads `genres` (absent) so no boost is applied.

- [ ] **Step 3: Apply the one-line fix**

In `src/services/recommendation_service.py`, change line 405 from:

```python
            genres = game.get("genres", [])
```

to:

```python
            genres = game.get("genre_tags") or game.get("genres", [])
```

(The `if "indie" in genres:` check on the following line is unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_recommendation_service.py::TestSurpriseMode::test_indie_boost_reads_genre_tags -v`
Expected: PASS — indie game scores ~1.0 (clamped), action game ~0.65.

- [ ] **Step 5: Run the full surprise-mode + filter suites to check for regressions**

Run: `python -m pytest tests/test_recommendation_service.py -v`
Expected: all tests PASS (the existing surprise-boost tests use games without a `genres`/`genre_tags` key, so the fallback `or game.get("genres", [])` keeps them unchanged).

- [ ] **Step 6: Commit** *(only if the user has approved committing)*

```bash
git add src/services/recommendation_service.py tests/test_recommendation_service.py
git commit -m "fix(recommend): indie boost reads canonical genre_tags field"
```

---

### Task 2: Create the migration script with a unit-tested transform

The transform logic (copy old→new only when new is empty) is a pure function so it can be unit-tested without Firestore. Firebase init is deferred into `run()` so importing the module in tests does not connect to Firestore.

**Files:**
- Create: `migrate_field_names.py` (at `api-service/` root, alongside `add_genre_games.py`)
- Create: `tests/test_migrate_field_names.py`

- [ ] **Step 1: Write the failing unit tests**

Create `tests/test_migrate_field_names.py`:

```python
"""Unit tests for the field-normalization transform."""

from migrate_field_names import compute_field_updates


def test_copies_old_to_new_when_new_missing():
    doc = {"year": 2014, "genres": ["puzzle"], "moods": ["chill"]}
    updates = compute_field_updates(doc)
    assert updates == {
        "release_year": 2014,
        "genre_tags": ["puzzle"],
        "mood_tags": ["chill"],
    }


def test_does_not_overwrite_existing_new_value():
    # New value is curated/authoritative; conflict must NOT be overwritten.
    doc = {"genres": ["puzzle"], "genre_tags": ["indie", "puzzle"]}
    updates = compute_field_updates(doc)
    assert "genre_tags" not in updates


def test_treats_empty_new_value_as_missing():
    doc = {"genres": ["puzzle"], "genre_tags": []}
    updates = compute_field_updates(doc)
    assert updates == {"genre_tags": ["puzzle"]}


def test_no_updates_when_nothing_to_copy():
    doc = {"release_year": 2022, "genre_tags": ["action"]}
    assert compute_field_updates(doc) == {}


def test_copies_energy_and_multiplayer_and_warnings():
    doc = {"energy": "low", "multiplayer": ["solo"], "warnings": ["violence"]}
    assert compute_field_updates(doc) == {
        "energy_level": "low",
        "multiplayer_modes": ["solo"],
        "content_warnings": ["violence"],
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_migrate_field_names.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'migrate_field_names'`.

- [ ] **Step 3: Implement the migration module**

Create `migrate_field_names.py`:

```python
"""
Normalize legacy game-doc field names to the canonical schema in
src/models/game.py. Additive and reversible: copies each old field into its
new counterpart ONLY when the new field is empty/missing, and never touches
the old field. Curated new values always win (auto-resolves conflict docs).

Firestore project: playnxt-1a2c6, collection: games.

Usage:
    python migrate_field_names.py --dry-run   # preview, no writes
    python migrate_field_names.py             # apply
"""

import sys
from datetime import datetime, timezone

# old field name -> canonical (new) field name
FIELD_PAIRS = [
    ("year", "release_year"),
    ("genres", "genre_tags"),
    ("moods", "mood_tags"),
    ("energy", "energy_level"),
    ("warnings", "content_warnings"),
    ("multiplayer", "multiplayer_modes"),
]

# Required fields on the canonical Game model (used to flag still-invalid docs).
REQUIRED_FIELDS = [
    "release_year", "energy_level", "time_to_fun",
    "stop_friendliness", "description_short", "title",
]


def _is_empty(value):
    return value is None or value == [] or value == ""


def compute_field_updates(doc: dict) -> dict:
    """Return {new_field: value} for each old->new pair where old has a value
    and new is empty/missing. Never includes a pair whose new field is set."""
    updates = {}
    for old, new in FIELD_PAIRS:
        if not _is_empty(doc.get(old)) and _is_empty(doc.get(new)):
            updates[new] = doc[old]
    return updates


def run(dry_run: bool) -> None:
    import firebase_admin
    from firebase_admin import credentials, firestore

    if not firebase_admin._apps:
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {"projectId": "playnxt-1a2c6"})

    games_ref = firestore.client().collection("games")

    changed = 0
    still_invalid = []

    for doc in games_ref.stream():
        g = doc.to_dict()
        updates = compute_field_updates(g)

        if updates:
            changed += 1
            if dry_run:
                print(f"[dry-run] {doc.id}: {updates}")
            else:
                write = dict(updates)
                write["updated_at"] = datetime.now(timezone.utc)
                games_ref.document(doc.id).update(write)
                print(f"Updated {doc.id}: {list(updates)}")

        merged = {**g, **updates}
        if any(_is_empty(merged.get(f)) for f in REQUIRED_FIELDS):
            still_invalid.append(doc.id)

    verb = "would change" if dry_run else "changed"
    print(f"\n{'DRY RUN: ' if dry_run else ''}{changed} docs {verb}")
    if still_invalid:
        print(f"{len(still_invalid)} docs still missing a required field "
              f"(manual follow-up): {still_invalid}")


if __name__ == "__main__":
    run(dry_run="--dry-run" in sys.argv)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_migrate_field_names.py -v`
Expected: all 5 tests PASS.

- [ ] **Step 5: Commit** *(only if the user has approved committing)*

```bash
git add migrate_field_names.py tests/test_migrate_field_names.py
git commit -m "feat: add additive field-normalization migration script"
```

---

### Task 3: Execute the migration (dry-run → review → apply → verify)

This task writes to the live production Firestore. It is gated on user review of the dry-run output. Not a TDD task — it is a one-shot, reviewed data operation.

**Files:** none modified. Operates on Firestore `games` collection.

- [ ] **Step 1: Dry-run and review**

Run: `python migrate_field_names.py --dry-run`
Expected: prints `[dry-run] <id>: {...}` lines and a summary `DRY RUN: ~718 docs would change`, plus a `~5 docs still missing a required field` line.
**STOP. Present this output to the user and get approval before Step 2.**

- [ ] **Step 2: Apply the migration**

Run: `python migrate_field_names.py`
Expected: `Updated <id>: [...]` lines and `~718 docs changed`.

- [ ] **Step 3: Verify with the schema audit**

Run:

```bash
python -c "
import firebase_admin
from firebase_admin import credentials, firestore
cred = credentials.Certificate('serviceAccountKey.json')
firebase_admin.initialize_app(cred, {'projectId':'playnxt-1a2c6'})
db = firestore.client()
docs = [d.to_dict() for d in db.collection('games').stream()]
n = len(docs)
for f in ['release_year','genre_tags','mood_tags','energy_level']:
    nulls = sum(1 for g in docs if g.get(f) in (None, [], ''))
    print(f'{f}: {nulls} empty / {n}')
"
```

Expected: each empty-count drops to roughly the ~5 flagged docs (down from 718/718/718/106).

- [ ] **Step 4: Spot-check two migrated docs**

Run:

```bash
python -c "
import firebase_admin
from firebase_admin import credentials, firestore
cred = credentials.Certificate('serviceAccountKey.json')
firebase_admin.initialize_app(cred, {'projectId':'playnxt-1a2c6'})
db = firestore.client()
for gid in ['god-of-war-2018','1000xresist']:
    g = db.collection('games').document(gid).get().to_dict()
    print(gid, '-> release_year=', g.get('release_year'),
          'genre_tags=', g.get('genre_tags'), 'mood_tags=', g.get('mood_tags'))
"
```

Expected: both show populated `release_year`, `genre_tags`, and `mood_tags`.

- [ ] **Step 5: Record the ~5 still-invalid doc ids**

Report the doc ids printed in Step 1/Step 2's "still missing a required field" line to the user for manual follow-up. Do not invent values for them.

---

## Notes on commits & production writes

- Commit steps are marked *(only if the user has approved committing)* — this repo's owner commits on request only.
- Task 3 writes to the live database that powers the published apps; the Step 1 dry-run review gate is mandatory before applying.
