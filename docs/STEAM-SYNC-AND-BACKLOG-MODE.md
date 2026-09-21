# Steam Sync & Backlog Mode — Feature Spec

> Drafted 2026-09-21. Status: **proposed** — not yet scheduled.
>
> Supersedes the bare "Steam library sync" line in `ROADMAP.md` Phase 3 with a concrete free/premium split. Grounded against `api-service/src/models/recommendation.py`, `game.py`, and the shipped premium flags as of 1.2.0.

## 1. Summary & positioning

Two features built on one integration:

| Tier | Feature | One-line pitch |
|---|---|---|
| **Free** | Steam Sync | "Connect Steam once — we stop recommending what you've already played." |
| **Premium** | Backlog Mode | "Tell us your time and mood — we pick from **your own** backlog." |

**Why this split.** The most common review complaint is that picks ignore games the user already owns or has played. That fix belongs in the free tier: paywalling it leaves the free product feeling broken and repeats NextPlay's mistake (recs gated behind setup + payment). Backlog Mode is the premium hook because it delivers *recurring* value — every gamer has a pile of unplayed Steam games and decision paralysis about them, and no competitor applies time + mood to the user's own library.

**Guardrails (PRD §3 non-negotiables all still hold):**

- Sync is **always optional** and must never block or delay getting a recommendation. The cold flow stays two taps.
- Anonymous users can sync (Firebase anonymous UID is a valid owner for library data). No Steam *login* required — see §3.
- The engine **never returns empty results**: Backlog Mode participates in the existing fallback hierarchy (§5).
- No playtime tracking of our own (PRD §8.4). We read Steam's playtime numbers; we never record sessions.

**Pricing note.** Backlog Mode launch is the moment to move the one-time unlock from $1.99 to $2.99 (the price `MONETIZATION.md` already recommends). Existing purchasers keep everything.

## 2. User stories

- *Free:* "I connected my Steam profile and PlayNxt stopped suggesting Hades, which I've played for 90 hours."
- *Free:* "I have a private profile; the app told me exactly which Steam setting to flip, and everything else kept working meanwhile."
- *Premium:* "I had 45 minutes and picked 'From my backlog' — it suggested an unplayed gem I bought in a sale two years ago, with the usual 'why this fits' reasoning."
- *Premium:* "My backlog had nothing that fit Intense/15 min, so it told me that and gave me normal picks instead of nothing."

## 3. Connecting Steam (free, both tiers)

**No OAuth in v1.** The user pastes their Steam profile URL or vanity name into a Connect Steam screen (Profile tab). We resolve it server-side:

1. `ResolveVanityURL` (if not already a 64-bit SteamID) → SteamID64
2. `IPlayerService/GetOwnedGames` with `include_appinfo=false, include_played_free_games=true`

Requirements & failure modes:

| Case | Behavior |
|---|---|
| Profile private / "game details" private | Sync fails with a specific message + link to Steam privacy settings; nothing else changes |
| Vanity name not found | 400 with clear detail |
| Steam API down | Sync fails softly; any previously synced library stays in effect |
| Huge library | Store all matches; playtime payload is small (id + minutes per game) |

The Steam Web API key lives server-side only (`STEAM_WEB_API_KEY` env var on Cloud Run — never in the mobile bundle). SlowAPI rate-limits the sync endpoints.

**Refresh policy:** free = manual re-sync button (rate-limited to 1/hour). Premium = automatic weekly refresh piggybacking the existing Cloud Scheduler slot. This gives premium an ongoing-freshness perk without gating the core fix.

**Disconnect:** one tap deletes the library document entirely. State it plainly in the UI ("removes your Steam data from PlayNxt").

## 4. Matching Steam apps to the catalog

The catalog already carries Steam URLs (`store_links.steam`), which embed the appid (`store.steampowered.com/app/<appid>/...`). Matching pipeline (as built):

1. At sync time the service builds an appid → game_id map by parsing `store_links.steam` across the catalog (a `steam_appid` field wins when present). The map is cached in-process for an hour, so no catalog backfill script is needed — one moving part removed from the original plan.
2. Intersect the user's owned appids with that map.
3. Report coverage honestly in the sync result: "Matched 143 of your 212 Steam games." All entries are stored with their appid, matched or not, so future catalog additions match on the next re-sync — and the unmatched list is a **demand-driven catalog signal**, exactly the input `ROADMAP.md` says future catalog work should come from.

## 5. Data model & API

New Firestore collection `user_libraries` (doc id = Firebase UID):

```json
{
  "source": "steam",
  "steam_id": "76561198000000000",
  "synced_at": "...",
  "games": [
    { "appid": 1145360, "game_id": "hades", "playtime_minutes": 5400 },
    { "appid": 1868140, "game_id": "dave-the-diver", "playtime_minutes": 0 },
    { "appid": 620, "game_id": null, "playtime_minutes": 300 }
  ],
  "matched_count": 143,
  "total_count": 212,
  "played_game_ids": ["hades"],
  "owned_unplayed_game_ids": ["dave-the-diver"]
}
```

The two derived arrays are written at sync time so the recommendation engine gets everything it needs from a single document read. Unmatched games keep `game_id: null` (the demand-driven catalog signal).

New router `routes_library.py` (`APIRouter(prefix="/library", tags=["Library"])`) + `library_service.py`, following the repo conventions (thin handlers, `Depends(get_user_id)`, explicit `response_model`, logic in the service, Firestore via `get_collection()`):

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /library/steam/sync` | required (anon ok) | Body: `{ "profile": "<url or vanity or steamid64>" }` → sync result with match coverage |
| `GET /library/steam` | required | Status: synced_at, counts, auto_refresh |
| `DELETE /library/steam` | required | Full disconnect + delete |

Mobile: all calls through `services/api.js`; a `LibraryContext` (or extension of `SavedGamesContext`) exposes sync state; Connect Steam UI lives off the Profile screen.

## 6. Free-tier engine behavior

When a synced library exists, the standard recommendation flow treats **played** library games (playtime ≥ 120 min) exactly like the existing "Not For Me"/already-played exclusions: filtered from the candidate pool before scoring. Under ~120 minutes played, the game stays eligible — the user barely touched it, and "you own this and bounced off it once" is Backlog Mode's job to reason about, not an exclusion.

- No new request field needed for this path — the service reads the library server-side by `user_id`, same pattern as `_get_recently_shown`.
- If exclusions empty a bucket, the existing fallback hierarchy already handles it (this is the same mechanics as Not For Me exclusion, shipped in 1.2.0).
- Result cards for **owned-but-unplayed** games get an "In your Steam library" chip — free users see the sync visibly improving relevance, which is also the organic Backlog Mode ad.

## 7. Backlog Mode (premium)

**Entry point:** a mode toggle at the top of the time-select screen — `Anything` (default) vs `My backlog`. Free users see the toggle with a lock; tapping it opens the premium sheet (respecting `MONETIZATION.md` timing rules: it never interrupts the core flow, the default path is untouched).

**Request:** one new premium field on `RecommendationRequest`, alongside the existing premium flags (`exclude_played`, `favor_history`):

```python
library_only: bool = Field(
    default=False,
    description="Restrict candidates to the user's synced, underplayed library games (premium)."
)
```

**Engine behavior** (`recommendation_service.py`):

1. Candidate pool = library games with `playtime_minutes < 120` that match a catalog doc. (Threshold constant at module level, e.g. `BACKLOG_PLAYED_THRESHOLD_MINUTES = 120` — same constant as §6.)
2. Normal filter + scoring pipeline runs unchanged on that pool (time, mood, stop-friendliness, franchise diversity, staleness, Not For Me).
3. Small flat boost for `playtime_minutes == 0` (never installed/launched) — surfacing true backlog dust is the magic moment. Constant, e.g. `+0.05`.
4. Explanation gets a library line via the existing optional-fields pattern on `RecommendationExplanation`: `library_fit: "In your Steam backlog — 0 hours played"`.
5. **Fallback (non-negotiable #5, as built):** platform, genre, and time filters relax *within* the backlog pool (the engine's standard fallback ladder), but the final partial-match catch-all is disabled there — mood is a required input, and a wrong-mood backlog game is a worse answer than a right-mood catalog game. A no-fit backlog falls back to full-catalog recommendations with `fallback_applied=true` and `fallback_message="Nothing in your backlog fits this session — here are picks from the full catalog."` Catalog-fallback picks carry no `library_fit` line — they don't pretend to be backlog finds. Never empty, never silent about the switch.

**No sync yet + toggle on:** the mobile app routes to Connect Steam first; the API also guards (400 with clear detail) so the contract is safe regardless of client state.

## 8. Out of scope (v1)

- Xbox / PlayStation library sync (same pattern later; Steam first per the reviewer signal and API simplicity)
- Steam OpenID login, wishlist import, achievements, recently-played feeds
- Any session/playtime tracking of our own (PRD §8.4 stands)
- "Sort my whole backlog" list views — that drifts into the tracker camp we deliberately avoid (ASO-PLAN §2)

## 9. Build order & estimate

| Step | Scope | Status |
|---|---|---|
| 1 | Appid → catalog matching (sync-time parsing of `store_links.steam`; no backfill needed) | ✅ Built |
| 2 | `library_service` + `/library/steam/*` routes + tests | ✅ Built |
| 3 | Mobile Connect Steam UI + free exclusion wiring + "In your library" chip | ✅ Built |
| 4 | `library_only` engine path + fallback + tests | ✅ Built |
| 5 | Backlog toggle UI + premium gate | ✅ Built |

All five steps are built; premium/store copy names Backlog Mode. Remaining ship prerequisite: create the `STEAM_WEB_API_KEY` secret (see `docs/runbooks/ship-1-3-0.md`). **Pricing: staying at $1.99 for now (Tom's call, 2026-09-21)** — the $2.99 move is deferred until there's conversion data (`backlog_mode_locked_tap` is the signal); copy and paywall are price-agnostic so the move needs no code. Mode choice is deliberately per-session: `libraryOnly` resets with the other session preferences, so the default two-tap flow stays untouched.

## 10. Success metrics

| Metric | Watch for |
|---|---|
| Sync adoption | % of active users with a synced library |
| Match coverage | median matched/total — drives demand-driven catalog additions |
| Backlog Mode share | % of premium sessions using `library_only` |
| Conversion | free→premium rate before vs after Backlog Mode launch (target: toward the 3–5% PRD goal) |
| Complaint signal | new reviews mentioning "already played/own" — should go to zero |
