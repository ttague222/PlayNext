# Seasonal Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the full seasonal system (six seasons of collections and palettes, remote-driven, with a bundled fallback) in PlayNxt 1.8.0, with Harvest 2026 live on Nov 1.

**Architecture:** One validated content file in the API (`src/content/seasonal.json`) served at `GET /api/seasonal`; the app picks the active season on the device by local date, falls back to a bundled copy, renders a Seasonal card whose picks are live `/api/recommend` output cached per collection per day, and applies the season's palette through a new theme token system where brand pink stays locked on every interactive element. A shared contrast + ΔE2000 guardrail runs in Python (CI) and JS (device) against the same test vectors.

**Tech Stack:** FastAPI + Pydantic v2 + pytest (api-service); Expo SDK 54 / React Native 0.81, jest-expo, @testing-library/react-native (mobile-app); Vite + vitest (playnxt-web).

**Spec:** `docs/superpowers/specs/2026-10-20-seasonal-themes-design.md` (read it first; section numbers below refer to it).

## Global Constraints

- Branch `feat/seasonal-themes` in `PlayNxt`, branch `feat/horror-all-moods` in `playnxt-web`. Never commit to `main` directly; never commit `.env`, `serviceAccountKey.json`, `*.keystore`.
- User-facing copy: plain English, no em dashes (Tom's voice rule).
- Brand pink `#f857a6 → #ff5858` is locked on every tappable/selected element; seasons override only `bg.*`, `accent.season`, `onAccent.season` (spec §6.2).
- Guardrail thresholds (spec §6.3): `#ffffff` on every bg stop ≥ 4.5; `text.secondary` on the middle stop ≥ 4.5; `accent.brand` on the lightest stop ≥ 3.0; `onAccent.season` on `accent.season` ≥ 4.5; `accent.season` ΔE2000 ≥ 12 from every `mood.*`, `semantic.*` and `accent.brand`.
- Locked reference colors: mood `#7c3aed` (wind_down), `#06b6d4` (casual), `#f59e0b` (focused), `#ef4444` (intense); semantic success `#4ade80`, error `#ef4444`, warning `#f59e0b`, rating `#fbbf24`; brand `#f857a6`.
- Collection `params` allow only `time_available`, `energy_mood`, `genres`, `session_type`, `discovery_mode` (spec §4.1).
- Season dates are inclusive and compared as device-local `YYYY-MM-DD` strings. At most 2 collections visible at once. Seasons never overlap.
- Mobile: new non-test files are `.tsx`/`.ts`; tests are `.js` under `__tests__/` (jest `testMatch` only picks up `.test.js`). Screens make no API calls (services only); functions passed as props use `useCallback`.
- API: thin routes with `response_model=`, logic in `src/services/`, `logging.getLogger("playnext-api.<module>")`, no `print()`.
- The default palette must render identically to today except the two §6.4 fixes.

## Review Focus

1. **Season boundary dates:** the first and last day of a season, a date in a gap, and Winter Holidays spanning Dec 31 → Jan 1 must select correctly. Pinned in Task 8.
2. **Stale cache vs. date:** a cached payload fetched during Spooky must not keep Spooky active once the device date is in Harvest; selection always re-runs on the date. Pinned in Task 8.
3. **Malformed remote payload:** missing `seasons`, wrong `schema_version`, or a season missing `palette` must be ignored in favor of cache, then bundle, never crash the Play tab. Pinned in Task 8.
4. **Collection picks across midnight or a micro-moment start:** the picks cache is keyed by `collection_id` + local date, so Feb 14's collection never shows Feb 13's picks and a new day refetches. Pinned in Task 9.
5. **A palette that fails on device:** the app renders the default palette but the Seasonal card still shows. Pinned in Task 10.

---

## Part A: API (`PlayNxt/api-service`)

### Task 1: Palette guardrail (Python) + shared test vectors

**Files:**
- Create: `api-service/src/services/palette_check.py`
- Create: `api-service/tests/fixtures/palette_vectors.json`
- Test: `api-service/tests/test_palette_check.py`

**Interfaces:**
- Produces: `contrast_ratio(a: str, b: str) -> float`, `delta_e2000(a: str, b: str) -> float`, `palette_violations(palette: dict) -> list[str]` (empty list = safe), module constants `LOCKED_REFERENCE_COLORS: dict[str, str]`, `TEXT_SECONDARY = "#a0a0a0"`, `BRAND = "#f857a6"`.
- `palette` dict shape (same as the JSON in Task 2): `{"bg_gradient": [s0, s1, s2], "bg_decor": str, "accent_season": str, "on_accent_season": str}`. "Lightest stop" = stop with highest relative luminance; "middle stop" = `bg_gradient[1]`.
- Vectors file shape: `{"contrast": [[a, b, expected]], "delta_e": [[a, b, expected]], "palettes": [{"name": str, "palette": {...}, "safe": bool}]}` with tolerance 0.05.

- [ ] **Step 1: Write the vectors file and failing tests**

Vectors must include at least: `["#ffffff","#f857a6",3.04]`, `["#0a0a1a","#f857a6",6.45]`, `["#808080","#302b63",3.22]`, `["#a0a0a0","#302b63",4.86]`; ΔE `["#f0a33a","#f59e0b",3.1]`, `["#ff8a3d","#f59e0b",13.0]`, `["#a8dcf0","#06b6d4",14.8]`, `["#ffd23f","#fbbf24",5.5]`; palettes: Spooky from spec §6.5 `safe: true`, Harvest from §6.5 `safe: false`, Summer from §6.5 `safe: false`, and one with `on_accent_season: "#ffffff"` on `#ff8a3d` `safe: false`.

```python
def test_contrast_vectors(vectors):
    for a, b, want in vectors["contrast"]:
        assert contrast_ratio(a, b) == pytest.approx(want, abs=0.05)

def test_delta_e_vectors(vectors):
    for a, b, want in vectors["delta_e"]:
        assert delta_e2000(a, b) == pytest.approx(want, abs=0.05)

def test_palette_vectors(vectors):
    for case in vectors["palettes"]:
        assert (palette_violations(case["palette"]) == []) is case["safe"], case["name"]

def test_violation_messages_name_the_rule():
    bad = {**SPOOKY, "accent_season": "#f0a33a", "on_accent_season": "#1f1300"}
    assert any("focused" in v and "delta" in v.lower() for v in palette_violations(bad))
```

- [ ] **Step 2: Run** `cd api-service && pytest tests/test_palette_check.py -v` → FAIL (module missing).
- [ ] **Step 3: Implement `palette_check.py`.** WCAG 2.x relative luminance (sRGB threshold 0.03928) for contrast; CIEDE2000 via sRGB → XYZ (D65) → Lab. Each violation string names the rule, the colors and the measured value.
- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Commit** `feat(api): palette contrast and delta-E guardrail with shared vectors`

### Task 2: Seasonal content model, loader and validation

**Files:**
- Create: `api-service/src/models/seasonal.py`
- Create: `api-service/src/services/seasonal_service.py`
- Create: `api-service/src/content/seasonal.json` (placeholder: a single valid Harvest 2026 season using spec §6.5 Spooky-safe values; real content lands in Task 4)
- Test: `api-service/tests/test_seasonal_service.py`, fixtures inline in the test

**Interfaces:**
- Consumes: `palette_violations` (Task 1); `EnergyMood`, `SessionType`, `DiscoveryMode` from `src/models/recommendation.py`.
- Produces (models, all `model_config = ConfigDict(extra="forbid")`):
  - `CollectionParams(time_available: int [15..240], energy_mood: EnergyMood, genres: list[str] | None = None, session_type: SessionType = SessionType.ANY, discovery_mode: DiscoveryMode = DiscoveryMode.FAMILIAR)`
  - `Collection(id: str, title: str, blurb: str, params: CollectionParams, starts: date | None = None, ends: date | None = None)`
  - `Palette(bg_gradient: list[str] (len 3), bg_decor: str, accent_season: str, on_accent_season: str)` — hex `^#[0-9a-fA-F]{6}$`
  - `HeaderImage(url: HttpUrl, alt: str)`
  - `Season(id: str, name: str, starts: date, ends: date, palette: Palette, header_image: HeaderImage | None = None, collections: list[Collection])`
  - `SeasonalContent(schema_version: Literal[1], seasons: list[Season])`
- Produces (service): `load_seasonal(path: Path = DEFAULT_PATH) -> SeasonalContent` raising `SeasonalContentError(list[str])`; `validate_rules(content: SeasonalContent) -> list[str]`; `get_seasonal() -> SeasonalContent` (loads once, module-level cache).

- [ ] **Step 1: Write failing tests**

```python
def test_shipped_file_is_valid():
    assert validate_rules(load_seasonal()) == []

def test_premium_param_rejected():          # extra="forbid"
    with pytest.raises(ValidationError): CollectionParams(time_available=60, energy_mood="casual", on_subscriptions=["game_pass"])

def test_library_only_rejected(): ...       # same pattern, library_only=True

def test_overlapping_seasons_rejected():    # Nov 1–30 and Nov 30–Dec 5 → message contains "overlap"
def test_end_before_start_rejected():
def test_three_concurrent_collections_rejected():   # two season collections + a micro-moment on the same date → "more than 2"
def test_micro_moment_outside_season_rejected():
def test_failing_palette_rejected():        # Harvest §6.5 palette → violation mentions "focused"
def test_duplicate_collection_ids_rejected():
def test_concurrent_collections_with_identical_params_rejected():   # spec §4.1a note
```

- [ ] **Step 2: Run** `pytest tests/test_seasonal_service.py -v` → FAIL.
- [ ] **Step 3: Implement models and service.** `validate_rules` checks: start ≤ end; no overlap between seasons (inclusive dates); collection windows inside their season; for every date in each season, visible collections ≤ 2 (iterate days; seasons are short); unique ids across file; concurrent collections must differ in `params`; `palette_violations` per season (prefix messages with the season id). `load_seasonal` raises `SeasonalContentError` if parsing or rules fail.
- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Commit** `feat(api): seasonal content model with schema and rule validation`

### Task 3: `GET /api/seasonal` route + startup check

**Files:**
- Create: `api-service/src/api/routes_seasonal.py`
- Modify: `api-service/src/api/__init__.py` (export `seasonal_router`), `api-service/src/main.py:139-146` (`app.include_router(seasonal_router, prefix="/api")`)
- Test: `api-service/tests/test_seasonal_route.py`

**Interfaces:**
- Consumes: `get_seasonal()`, `SeasonalContent` (Task 2).
- Produces: `GET /api/seasonal` → `SeasonalContent` JSON (dates as `YYYY-MM-DD`), header `Cache-Control: public, max-age=3600`.

- [ ] **Step 1: Failing tests** (use the existing `client` fixture from `tests/conftest.py`):

```python
def test_seasonal_returns_content(client):
    r = client.get("/api/seasonal")
    assert r.status_code == 200
    body = r.json()
    assert body["schema_version"] == 1 and len(body["seasons"]) >= 1
    assert r.headers["cache-control"] == "public, max-age=3600"

def test_seasonal_dates_are_iso_strings(client):
    s = client.get("/api/seasonal").json()["seasons"][0]
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", s["starts"])
```

- [ ] **Step 2: Run** → FAIL. **Step 3:** implement the thin route (catch `Exception` → log + 500). Call `get_seasonal()` once in the FastAPI lifespan/startup so a bad file fails the container boot, not the first request. **Step 4:** `pytest -q` (whole suite) → PASS.
- [ ] **Step 5: Commit** `feat(api): serve seasonal content at /api/seasonal`

### Task 4: Engine sampling script

**Files:**
- Create: `api-service/scripts/validate_seasonal.py`
- Test: `api-service/tests/test_validate_seasonal.py`

**Interfaces:**
- Consumes: `load_seasonal` (Task 2).
- Produces: CLI `python scripts/validate_seasonal.py [--api URL] [--runs 20] [--collection ID]`, default API `https://playnxt-api-167253232570.us-central1.run.app/api` (never the PlayBeacon URL). Pure function `summarize(runs: list[dict]) -> dict` returning `{"tally": [(game_id, count)], "empty_runs": int, "fallback_runs": int}`. Exit code 1 if any collection (unfiltered, or with any single platform of `pc, playstation, xbox, switch, mobile`) has `empty_runs` or `fallback_runs` > 0.

- [ ] **Step 1: Failing test** for `summarize` with three canned responses (one `fallback_applied: true`, one empty) asserting counts and tally order.
- [ ] **Step 2: Run** → FAIL. **Step 3:** implement; POST payload = collection params + `platforms`, `session_id: "validate-seasonal"`, `excluded_game_ids: []`; print a per-collection tally table (top 10) and the platform fallback report via `logging` configured to stdout. **Step 4:** test PASS; run once against prod for the placeholder file and confirm output.
- [ ] **Step 5: Commit** `feat(api): validate_seasonal sampling script`

### Task 5: Real content for all six seasons (Tom gate)

**Files:**
- Modify: `api-service/src/content/seasonal.json`
- Create: `docs/growth/2026-10-seasonal-copy-draft.md` (copy + params + tallies for Tom)

**Interfaces:**
- Consumes: Tasks 1, 2, 4. Calendar and starting params: spec §4.1a. Palettes: spec §6.5.
- Produces: seasons `harvest-2026`, `winter-holidays-2026`, `deep-winter-2027`, `spring-2027`, `summer-2027`, `spooky-2027` with year-scoped collection ids (e.g. `harvest-2026-long-weekend`, `deep-winter-2027-valentines` with `starts`/`ends` `2027-02-14`).

- [ ] **Step 1: Adjust palettes.** Move Harvest's accent toward russet/copper and Summer's toward sun-orange or butter yellow until `palette_violations` returns `[]` for both; re-run for all six.
- [ ] **Step 2: Differentiate concurrent collections.** Spooky (horror vs wind_down) is already distinct. Winter Holidays' second, Summer's second ("long flight") and Deep Winter's pair need distinct params; propose one differentiator each (genre, `discovery_mode: "surprise"`, or time), run `validate_seasonal.py --collection <id>` and keep the one whose tally matches the title. Valentine's and Harvest use `session_type: "couch_coop"`.
- [ ] **Step 3: Draft copy** for every collection (title ≤ 40 chars, blurb ≤ 90 chars, Tom's voice, no em dashes) into the draft doc next to each collection's params, top-10 tally and palette swatch hexes.
- [ ] **Step 4: STOP for Tom.** Present the draft doc; Tom edits/approves copy and the adjusted Harvest + Summer palettes. Do not merge content until he does (Harvest copy is the hard gate; later seasons can be edited after release).
- [ ] **Step 5:** Write approved content into `seasonal.json`; `pytest -q` → PASS; `python scripts/validate_seasonal.py` → exit 0.
- [ ] **Step 6: Commit** `content: seasonal calendar Harvest 2026 through Spooky 2027`

## Part B: Web (`playnxt-web`)

### Task 6: Horror chip for every mood (web)

**Files:**
- Create: `playnxt-web/src/quizOptions.js` (move `MOOD_TO_GENRES` out of `src/App.jsx:58-65` and export it)
- Modify: `playnxt-web/src/App.jsx` (import it)
- Test: `playnxt-web/src/quizOptions.test.js`

- [ ] **Step 1: Failing test:** `for (const mood of ['wind_down','casual','focused','intense']) expect(MOOD_TO_GENRES[mood]).toContain('horror')`.
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** append `'horror'` to `casual` and `wind_down`. **Step 4:** `npm test` → PASS; `npm run build` succeeds.
- [ ] **Step 5:** Manual: run the local preview (`vite.local.config.js`), pick Horror at Casual and Wind Down 3 times each; every pick is horror-tagged and no fallback banner shows.
- [ ] **Step 6: Commit** `feat: offer the Horror chip for every mood`. Open a PR; Tom merges (Vercel deploys `main`).

## Part C: App (`PlayNxt/mobile-app`)

### Task 7: Horror chip for every mood (app)

**Files:**
- Modify: `mobile-app/src/screens/OptionalFiltersScreen.js:63` (export `MOOD_TO_GENRES`; add `'horror'` to `casual` and `wind_down`)
- Test: `mobile-app/src/screens/__tests__/OptionalFiltersScreen.genres.test.js`

- [ ] Steps: same failing test as Task 6 against the exported map → FAIL → change → `npx jest OptionalFiltersScreen.genres` PASS → commit `feat(app): offer the Horror chip for every mood`.

### Task 8: Theme tokens, palette guardrail (JS) and ThemeProvider

**Files:**
- Create: `mobile-app/src/theme/tokens.ts`, `mobile-app/src/theme/palette.ts`, `mobile-app/src/theme/ThemeContext.tsx`
- Test: `mobile-app/src/theme/__tests__/palette.test.js`, `mobile-app/src/theme/__tests__/ThemeContext.test.js`

**Interfaces:**
- Consumes: `api-service/tests/fixtures/palette_vectors.json` (require via relative path `../../../../api-service/tests/fixtures/palette_vectors.json`).
- Produces:
  - `type Theme` with roles from spec §6.2: `bg: { home: [string,string,string]; flow: [string,string,string]; decor: string | null }`, `accent: { season: string | null; brand: string; brandEnd: string }`, `onAccent: { season: string | null; brand: string; brandSmall: string }`, `glow: { brand: string }`, `text: { primary: string; secondary: string; muted: string }`, `surface: { card: string; chip: string }`, `semantic: { success; error; warning; rating }`, `mood: { windDown; casual; focused; intense }`, `overlay: { scrim: string }`, `share: { gradient: [string,string,string] }`.
  - `DEFAULT_THEME: Theme` with today's values: `bg.home = ['#0a0a1a','#1a1a2e','#16213e']`, `bg.flow = ['#0f0c29','#302b63','#24243e']`, `bg.decor = null`, `accent.season = null` (null means "component keeps its current literal", so default renders identically), `accent.brand = '#f857a6'`, `accent.brandEnd = '#ff5858'`, `onAccent.brand = '#ffffff'`, `onAccent.brandSmall = '#0a0a1a'`, `text.secondary = '#a0a0a0'`, `overlay.scrim = '#0f0c29'`, `share.gradient = ['#0f0c29','#1a1a2e','#16213e']`, mood/semantic per Global Constraints.
  - `type SeasonPalette = { bg_gradient: [string,string,string]; bg_decor: string; accent_season: string; on_accent_season: string }`
  - `themeForPalette(p: SeasonPalette | null): Theme` (null or unsafe → `DEFAULT_THEME`; safe → default with `bg.home = bg.flow = p.bg_gradient`, `bg.decor`, `accent.season`, `onAccent.season`, `overlay.scrim = p.bg_gradient[0]`).
  - `contrastRatio(a, b): number`, `deltaE2000(a, b): number`, `paletteViolations(p: SeasonPalette): string[]` (same rules as Task 1), `alpha(hex: string, a: number): string` → `rgba(r,g,b,a)`.
  - `ThemeProvider({ palette, children })`, `useTheme(): Theme`.

- [ ] **Step 1: Failing tests:** the three vector loops from Task 1 against the JS functions (same tolerance); `themeForPalette(null)` deep-equals `DEFAULT_THEME`; `themeForPalette(<Harvest §6.5>)` deep-equals `DEFAULT_THEME` (unsafe → default); `themeForPalette(<Spooky>)` has `bg.flow[1] === '#22103a'` and `accent.brand === '#f857a6'` (locked); `alpha('#f857a6', 0.2) === 'rgba(248,87,166,0.2)'`; rendering a probe component under `<ThemeProvider palette={spooky}>` reads `accent.season === '#ff8a3d'`, and with no provider reads `DEFAULT_THEME`.
- [ ] **Step 2:** `npx jest src/theme` → FAIL. **Step 3:** implement (port of Task 1). **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(app): theme tokens, palette guardrail and ThemeProvider`

### Task 9: Seasonal service, API client and bundled fallback

**Files:**
- Create: `mobile-app/src/services/seasonalService.ts`
- Create: `mobile-app/src/config/seasonal.fallback.json`, `mobile-app/scripts/sync-seasonal.js`
- Modify: `mobile-app/src/services/api.js` (add `getSeasonal: async () => GET /seasonal`), `mobile-app/package.json` (script `"sync-seasonal": "node scripts/sync-seasonal.js"`)
- Test: `mobile-app/src/services/__tests__/seasonalService.test.js`, `mobile-app/src/config/__tests__/seasonalFallback.test.js`

**Interfaces:**
- Consumes: `localDateString` from `services/tonightService.js`; `api.getRecommendations`.
- Produces:
  - Types `SeasonalContent`, `Season`, `Collection` mirroring Task 2 (dates as strings).
  - `SEASONAL_CACHE_KEY = '@playnxt_seasonal_content'`, `COLLECTION_PICKS_KEY = '@playnxt_collection_picks'`, `REFRESH_MS = 6 * 60 * 60 * 1000`.
  - `isValidContent(x: unknown): x is SeasonalContent` (shape check: `schema_version === 1`, `seasons` array, each with `id`, `starts`, `ends`, `palette.bg_gradient` length 3, `collections` array).
  - `loadSeasonalContent({ now }?): Promise<SeasonalContent>`: fetch if cache older than `REFRESH_MS`; on fetch failure or invalid payload use cache if valid, else the bundled fallback. Never throws.
  - `getCachedSeasonalContentSync(): SeasonalContent` (last value loaded in memory, else bundled; for cold start).
  - `activeSeason(content, date = localDateString()): Season | null`
  - `visibleCollections(season, date = localDateString()): Collection[]` (micro-moment collections active on `date` first, then season collections without a window, sliced to 2).
  - `fetchCollectionPicks(collection, { platforms }): Promise<{ date: string; collectionId: string; sessionId: string; games: object[]; fallbackApplied: boolean; fallbackMessage: string | null }>`: single-flight per collection id; cache keyed `${collectionId}|${date}`; request = collection params + `platforms` (null if empty) + `session_id: 'local-seasonal-<ts>'` + `excluded_game_ids: []`.
  - `getCachedCollectionPicks(collectionId, date?)`.

- [ ] **Step 1: Failing tests** (mock `api` and AsyncStorage as `tonightService.test.js` does):
  - `activeSeason` on `2026-11-01` and `2026-11-30` → harvest; `2026-10-31` with no Spooky 2026 → null; `2026-12-31` and `2027-01-01` → winter-holidays-2026; `2027-01-08` → deep-winter.
  - Stale cache: cache holds content fetched "during Spooky"; with date `2026-11-02` `activeSeason` returns harvest (selection re-runs on date).
  - `loadSeasonalContent` with fetch rejecting and no cache → bundled content; with fetch returning `{ schema_version: 2 }` and a valid cache → cache; with a season missing `palette` → falls back.
  - `visibleCollections` on `2027-02-14` returns the Valentine's collection first and at most 2; on `2027-02-13` excludes it.
  - `fetchCollectionPicks` called twice concurrently → one API call; cached for date D is not returned for date D+1; a cached result for collection A is not returned for collection B.
  - Fallback test: `require('../seasonal.fallback.json')` deep-equals `require('../../../../api-service/src/content/seasonal.json')`.
- [ ] **Step 2:** FAIL. **Step 3:** implement; `sync-seasonal.js` copies the API file verbatim. Run `npm run sync-seasonal`. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(app): seasonal content service with bundled fallback`

### Task 10: Mount ThemeProvider with the active season

**Files:**
- Modify: `mobile-app/App.js` (wrap the main tree, inside `SafeAreaProvider`, with a `SeasonalThemeRoot` that renders `ThemeProvider`)
- Create: `mobile-app/src/theme/SeasonalThemeRoot.tsx`
- Test: `mobile-app/src/theme/__tests__/SeasonalThemeRoot.test.js`

**Interfaces:**
- Consumes: `getCachedSeasonalContentSync`, `loadSeasonalContent`, `activeSeason` (Task 9); `ThemeProvider` (Task 8).
- Produces: `SeasonalThemeRoot({ children })`: initial palette from `getCachedSeasonalContentSync()` (no default-flash on cold start), refreshes via `loadSeasonalContent()` on mount and on `AppState` → `active`, recomputes `activeSeason` on each refresh.

- [ ] **Step 1: Failing tests:** with a mocked content whose Harvest palette is safe and date `2026-11-05`, a probe reads `bg.flow[1]` equal to Harvest's middle stop; with an injected unsafe Harvest palette the probe reads `DEFAULT_THEME` **and** `visibleCollections` still returns the Harvest collection (card unaffected by palette failure); with date `2026-10-25` probe reads `DEFAULT_THEME`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(app): apply the active season's palette app-wide`

### Task 11: Convert home + Tonight card to tokens

**Files:**
- Modify: `mobile-app/src/screens/PlayScreen.js` (gradient L235-244 → `theme.bg.home`; decorative circles incl. `#667eea` → `theme.bg.decor ?? <current literal>`; brand button L279 → `[theme.accent.brand, theme.accent.brandEnd]`; pink rgba at L254, L395 → `alpha(theme.accent.brand, a)`; pink `shadowColor` L435 → `theme.glow.brand`)
- Modify: `mobile-app/src/components/TonightCard.js` (border/eyebrow → `theme.accent.season ?? <current literal>`)
- Test: `mobile-app/src/screens/__tests__/PlayScreen.theme.test.js`

- [ ] **Step 1: Failing test:** render `PlayScreen` under `ThemeProvider palette={spooky}` and assert the root `LinearGradient` `colors` equal Spooky's `bg_gradient` and the Start Playing gradient equals `['#f857a6','#ff5858']`; under no provider the root gradient equals `['#0a0a1a','#1a1a2e','#16213e']`.
- [ ] **Step 2–4:** FAIL → move color-bearing styles into `useMemo(() => makeStyles(theme), [theme])` (or inline overrides) → PASS; existing `PlayScreen.tonight.test.js` and `TonightCard.test.js` still PASS.
- [ ] **Step 5: Commit** `refactor(app): theme tokens on the Play screen`

### Task 12: Convert quiz screens to tokens

**Files:**
- Modify: `mobile-app/src/screens/TimeSelectScreen.js` (bg → `theme.bg.flow`; pink rgba L214 → `alpha`; `shadowColor` L287, L372 → `theme.glow.brand`; `modePillActive` 14px label → `theme.onAccent.brandSmall` per spec §6.4)
- Modify: `mobile-app/src/screens/MoodSelectScreen.js` (bg only + `shadowColor` L314; mood colors → `theme.mood.*`; **no** `accent.season` on this screen)
- Modify: `mobile-app/src/screens/OptionalFiltersScreen.js` (bg; pink rgba L216; button L550 → brand tokens; `shadowColor` L613, L830; no `accent.season` on chips)
- Test: `mobile-app/src/screens/__tests__/QuizScreens.theme.test.js`

- [ ] **Step 1: Failing test:** each of the three screens under Spooky renders its root gradient with Spooky's stops; `TimeSelectScreen` active mode-pill label color is `#0a0a1a`; `MoodSelectScreen` contains no element styled with `#ff8a3d`.
- [ ] **Step 2–4:** FAIL → convert → PASS; `TimeSelectScreen.test.js` still PASS.
- [ ] **Step 5: Commit** `refactor(app): theme tokens on the quiz screens`

### Task 13: Convert results + GameCard; lock remaining brand gradients

**Files:**
- Modify: `mobile-app/src/screens/ResultsScreen.js` (gradients L519, L536 → `theme.bg.flow`; button L545 → brand tokens; `#808080` text → `theme.text.secondary` = `#a0a0a0` per spec §6.4)
- Modify: `mobile-app/src/components/GameCard.js` (buttons L516, L559 → brand tokens; scrim `rgba(15,12,41,…)` L507 → `alpha(theme.overlay.scrim, …)`; pink rgba L473, L766 → `alpha`; `shadowColor` L981; fallback tile `#667eea/#764ba2` → `[theme.bg.flow[1], theme.bg.flow[2]]`)
- Modify (brand tokens only, no seasonal roles): `components/AdOrPremiumModal.js:86`, `components/CelebrationModal.js:230`, `components/DailyCapUpsellModal.js:31`, `screens/WelcomeScreen.js:178`, `components/ShareCard.tsx:180` (→ `theme.share.gradient`, which seasons never override)
- Test: `mobile-app/src/screens/__tests__/ResultsScreen.theme.test.js`, extend `mobile-app/src/components/__tests__/ShareCard.test.js`

- [ ] **Step 1: Failing tests:** Results under Spooky uses Spooky stops; secondary text color is `#a0a0a0` under default; GameCard scrim color starts with `rgba(13,7,22,` under Spooky; `ShareCard` under Spooky still renders `['#0f0c29','#1a1a2e','#16213e']`.
- [ ] **Step 2–4:** FAIL → convert → PASS; full `npx jest` PASS.
- [ ] **Step 5:** `grep -rn "'#f857a6', '#ff5858'" src` returns nothing.
- [ ] **Step 6: Commit** `refactor(app): theme tokens on results, game card and brand gradients`

### Task 14: Collection sessions and analytics in RecommendationContext

**Files:**
- Modify: `mobile-app/src/context/RecommendationContext.js` (`sessionSource` gains `'seasonal'`; new `collectionId` state; `startCollectionSession`; `recommendation_started` gains `pick_source`; seasonal params on events; skip `saveLastContext`/`saveTonightCache` when source is not `'flow'` — already gated, keep it)
- Test: `mobile-app/src/context/__tests__/RecommendationContext.seasonal.test.js`

**Interfaces:**
- Consumes: result shape of `fetchCollectionPicks` (Task 9).
- Produces: `startCollectionSession(collection: Collection, picks: { sessionId; games; fallbackApplied; fallbackMessage }): boolean` exposed on the context. Seeds results like `startTonightSession` (`RecommendationContext.js:207`), sets preferences from `collection.params` (keeping the user's saved platforms), `sessionSource = 'seasonal'`, `collectionId = collection.id`, sets `fallbackApplied`/`fallbackMessage` from picks, logs `recommendation_started { minutes, mood, platform_filter, library_mode: 'none', pick_source: 'seasonal', collection_id }` then `recommendation_viewed` with `collection_id`.
- Every later `recommendation_viewed`, `rec_requested`, `game_selected`, `rec_accepted` in that session adds `collection_id` when `sessionSource === 'seasonal'`. Starting a normal flow (`startSession`) clears `collectionId`.

- [ ] **Step 1: Failing tests:** after `startCollectionSession`, `logEvent` was called with `('recommendation_started', expect.objectContaining({ pick_source: 'seasonal', collection_id: 'harvest-2026-long-weekend' }))`; accepting a pick logs `game_selected` with the same `collection_id`; a reroll's `rec_requested` keeps it; `saveTonightCache` is never called; `fallbackApplied` true in picks surfaces as context `fallbackApplied === true`; after `startSession()` a normal `getRecommendations` logs `recommendation_started` with `pick_source: 'flow'` and no `collection_id`.
- [ ] **Step 2–4:** FAIL → implement → PASS; `RecommendationContext.tonight.test.js` still PASS.
- [ ] **Step 5: Commit** `feat(app): seasonal collection sessions with collection_id analytics`

### Task 15: Seasonal card on the Play screen

**Files:**
- Create: `mobile-app/src/components/SeasonalCard.tsx`
- Modify: `mobile-app/src/screens/PlayScreen.js` (render below `TonightCard` at ~L292-300, or in the feature-pill slot when no Tonight card; load content + prefetch picks in the existing `useFocusEffect`; tap → `startCollectionSession` → navigate to Results, mirroring the Tonight tap handler at L102-113)
- Test: `mobile-app/src/components/__tests__/SeasonalCard.test.js`, `mobile-app/src/screens/__tests__/PlayScreen.seasonal.test.js`

**Interfaces:**
- Consumes: `activeSeason`, `visibleCollections`, `fetchCollectionPicks`, `getCachedCollectionPicks` (Task 9); `startCollectionSession` (Task 14); `useTheme` (Task 8). The `platforms` passed to `fetchCollectionPicks` are the user's saved platforms (`savedPlatforms` already in `RecommendationContext`), per spec §5.2.
- Produces: `SeasonalCard({ collection, picks, status: 'loading'|'ready'|'error', onPress, onRetry })`, presentation only. Context line format `"<minutes> min · <Mood label> · <Couch co-op|With friends|…>"` (omit the session part when `any`). Border/eyebrow use `theme.accent.season ?? theme.accent.brand`; optional `header_image` renders with its `alt` as `accessibilityLabel`.
- Events: `seasonal_collection_viewed { collection_id, season_id }` once per collection per local date (store last-logged date per id in AsyncStorage key `@playnxt_seasonal_viewed`); `seasonal_collection_tapped { collection_id, season_id }` on press.

- [ ] **Step 1: Failing tests:** card renders title, blurb, context line `"60 min · Casual · Couch co-op"`, three thumbnails when ready, retry text on error; PlayScreen with date in Harvest shows the card and tapping it calls `startCollectionSession` then navigates to `Results`; date `2026-10-25` shows no card; `seasonal_collection_viewed` fires once across two focus events on the same date and again on the next date; the hero "Start Playing" CTA is still the first button.
- [ ] **Step 2–4:** FAIL → implement → PASS; full `npx jest` PASS.
- [ ] **Step 5: Commit** `feat(app): seasonal card on the Play screen`

### Task 16: Docs, device pass and release handoff

**Files:**
- Modify: `docs/ACTIVATION-TRACKING.md` (new events, `pick_source: seasonal`, `collection_id`, `season_id`), `docs/PRD.md` (seasonal section), `mobile-app/src/config/changelog.js` (1.8.0 What's New entry, plain copy, no em dashes)

- [ ] **Step 1:** Update the three docs; commit `docs: seasonal themes tracking, PRD and what's new`.
- [ ] **Step 2: Device pass (emulator recipe from `docs/growth/2026-09-30-growth-week-1.md`).** For default and Harvest (set device date to 2026-11-05) capture screenshots of Play, Time, Mood, Filters, Results, GameCard detail and the share card. Default screenshots must match pre-change ones except the two §6.4 fixes.
- [ ] **Step 3: DebugView.** `adb shell setprop debug.firebase.analytics.app com.playnxt.app`; tap the Harvest card, accept a pick, reroll once; confirm `seasonal_collection_viewed`, `seasonal_collection_tapped`, `recommendation_started`, `recommendation_viewed`, `game_selected` all carry `collection_id = harvest-2026-long-weekend`.
- [ ] **Step 3b: Horror spot-check (spec §8).** In the app, Horror + each of the four moods, 3 runs each: every pick horror-tagged, no fallback message.
- [ ] **Step 4: Offline check.** Airplane mode with cleared app storage: Harvest card and palette still appear (bundled fallback).
- [ ] **Step 5: Tom (console):** register `collection_id` and `season_id` as event-scoped custom dimensions in Firebase.
- [ ] **Step 6:** Open PRs (API, app; web from Task 6) and hand off to `/mobile-release playnxt` for the 1.8.0 build. Submission waits until 1.7.0 is released or rejected; target submit ≈ 2026-10-28.
