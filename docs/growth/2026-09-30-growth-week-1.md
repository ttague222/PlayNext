# PlayNxt growth week 1: what we built

September 30, 2026. Started from three briefs: the analytics event brief, the
"30 minutes, low energy" scenario page draft, and the tagged link inventory.

## Status at a glance

| Piece | Status | Where |
|---|---|---|
| Scenario page `/play/30-minutes-low-energy` | Live | playnxt.io |
| Tagged store links (Android + iOS) | Ready, scenario links live | `docs/ACTIVATION-TRACKING.md` |
| `sitemap.xml` + `robots.txt` | Live, sitemap submitted to Search Console | playnxt.io |
| Website results card (app 1.5.0 design) | Live | playnxt.io quiz + landing demo |
| Six activation events in the app | PR open, ships with next release | [ttague222/PlayNext#16](https://github.com/ttague222/PlayNext/pull/16) |
| Activation scorecard | Built, empty until the release ships | `docs/growth/PlayNxt-Activation-Scorecard.xlsx` |
| API explanation quality fix | Running in a separate session | its own PR when done |

## 1. Analytics events (app)

PR [ttague222/PlayNext#16](https://github.com/ttague222/PlayNext/pull/16),
branch `analytics-activation-events`. Not merged yet.

| Event | Fires when |
|---|---|
| `app_first_open` | First launch of a new install (platform, app_version, install_source) |
| `recommendation_started` | User submits time + mood |
| `recommendation_viewed` | A set of picks comes back, including rerolls |
| `game_selected` | User taps "I'll play this!" (the activation event) |
| `result_shared` | Share sheet completes, card or link |
| `premium_purchase` | Unlock succeeds, with the screen that led there |

Every event also carries `install_source`, read from the Google Play install
referrer on Android.

Where it differs from the brief, and why:

- **`first_open` became `app_first_open`.** Firebase reserves `first_open` and
  logs it on its own.
- **`source` became `install_source`.** Firebase already uses `source` for its
  own campaign tracking, and ours rides on every event.
- **iOS installs always show as organic.** Apple doesn't let the app read
  campaign links, so iOS channel numbers come from App Store Connect's
  Campaigns report.
- **Mood values are the app's own,** so the scenario reads `30min_wind_down`.

Tests: 36 suites, 256 tests passing, clean type check. Adds a native module
(`expo-application`), so it needs a full EAS build, not an update pushed to
existing installs.

## 2. Scenario page (website)

Live at https://playnxt.io/play/30-minutes-low-energy

- Real picks from the engine: Hidden Folks, Unpacking, Tinykin. All three show
  on a phone without scrolling.
- Every fact was checked against the catalog. Cut from the draft: the
  Unpacking "On PS Plus" line, a Tinykin fun fact that looked invented, the
  "lowers your heart rate" claim, and the em dashes.
- Store buttons carry the `playnxt-30min-lowenergy` campaign on both stores.
- Adding a scenario page means adding an entry to `playnxt-web/api/_scenarios.js`.
  The sitemap picks it up automatically.

## 3. Tagged links

- **Android:** must use `&referrer=<encoded utm string>`. The original link doc
  put utm tags directly on the Play URL, and the app can't read those.
- **iOS:** the provider token is `pt=128357651` for every campaign. A new campaign link
  is `https://apps.apple.com/app/apple-store/id6757089064?pt=128357651&ct=<campaign>&mt=8`,
  and nothing needs to be created in App Store Connect first.

Campaigns so far: `playnxt-30min-lowenergy` (live), `playnxt-community`
(Reddit), `playnxt-challenge` (creators), `playnxt-web-pick` (the website
card's "I'll play this!" panel, live). Full list in `docs/ACTIVATION-TRACKING.md`
and the scorecard's Link inventory tab.

## 4. Search Console

- playnxt.io verified as a Domain property, using a TXT record in Vercel DNS.
- Sitemap submitted: `https://playnxt.io/sitemap.xml`
- Before this, `/robots.txt` and `/sitemap.xml` were returning the homepage
  HTML.

## 5. Website results card (app 1.5.0 design)

Live on the playnxt.io quiz and the landing page demo.

- Same order as the app: art with TOP PICK, then the title and match %, a short
  description and the "I'll play this!" button. The why bullets and a plain
  "Where to play" row come after.
- Motion matches the app: the first set animates in card by card with the
  match % counting up, rerolls crossfade, and buttons shrink slightly on press.
  "Reduce motion" turns it all into simple fades.
- "I'll play this!" opens a small get-the-app panel with tagged store links.
  "Played it" and "Not for me" stay app-only.
- Cover art from RAWG can take 15 to 20 seconds, so cards shimmer for up to 4
  seconds, then show a colored tile, and fade the art in when it arrives.

## 6. Activation scorecard

`docs/growth/PlayNxt-Activation-Scorecard.xlsx` (not committed)

- **Scoreboard:** weekly from September 28, first opens and activated users
  for seven sources (scenario-pages, reddit, creator, newsletter, web_quiz,
  pick_page, organic), activation rates, D7 return, App Store campaign
  columns, scenario page views.
- **Other tabs:** link inventory, event definitions, how to fill it each week.

## Still to do

1. **Tom, before the release:** in Firebase → Analytics → Custom definitions,
   register `install_source` once as an event-scoped dimension and once as a
   user-scoped one. Firebase only collects from the moment you register.
2. **The release:** merge PR #16, make a full EAS build, submit to both stores.
   Then confirm all six events fire in Firebase DebugView.
3. **Review the API fix PR** when the background session finishes. It covers
   the generic, repeated "why" text and every pick scoring 100%.
4. Upload the scorecard to Drive and start filling it weekly after the release.
5. Put the Reddit and creator links to use.
6. Check whether the scenario page is indexed in Search Console in a few days.

## Code locations

- App: `PlayNxt/mobile-app/src/services/attributionService.ts`,
  `src/context/RecommendationContext.js`, `src/services/shareService.js`,
  `src/context/PremiumContext.js`
- Site: `playnxt-web/api/play.js`, `api/_scenarios.js`, `api/_shell.js`,
  `api/sitemap.js`, `public/robots.txt`, `src/App.jsx` (GameCard, GetAppSheet),
  `src/styles.css`
- Docs: `PlayNxt/docs/ACTIVATION-TRACKING.md`
