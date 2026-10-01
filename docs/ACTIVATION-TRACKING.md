# Activation tracking

Firebase Analytics events for the acquisition-to-activation scoreboard (Growth
Playbook), as implemented. Built from the analytics event brief of 2026-09-30.
Older events (`rec_requested`, `rec_accepted`, `share_completed`,
`purchase_completed`) still fire alongside these; nothing was removed.

## Events

| Event | Fires when | Params |
|---|---|---|
| `app_first_open` | First launch of a fresh install | `platform` ios/android, `app_version`, `install_source` |
| `recommendation_started` | User submits time + mood (not on reroll) | `minutes`, `mood`, `platform_filter`, `library_mode` |
| `recommendation_viewed` | A non-empty set of picks comes back (initial and reroll) | `result_count`, `latency_ms`, `install_source` |
| `game_selected` ⭐ | User taps "I'll play this!" on a pick | `game_id`, `rank` 1-3, `minutes`, `mood` |
| `result_shared` | Share sheet completes | `surface` card/link, `scenario`, `game_count` |
| `premium_purchase` | Unlock succeeds | `platform`, `entry_screen` |

Every event logged after startup also carries `install_source` (set as a
default event parameter), and the user has `install_source` / `install_campaign`
user properties. Register `install_source` as a custom dimension (event scope,
and user scope for the property) in Firebase before the release ships;
registration isn't retroactive.

## Where this differs from the brief, and why

- **`source` is `install_source`.** Firebase predefines `source` as a
  campaign-attribution param (`campaign_details`). Since this one rides on
  every event, including automatic ones, reusing that name risks colliding
  with GA4's own traffic attribution and its built-in Source dimension.

- **`first_open` is `app_first_open`.** Firebase reserves `first_open` and logs
  it automatically; the SDK rejects a custom event with that name. Use the
  built-in `first_open` for raw install counts and `app_first_open` for the
  per-source split. Users upgrading from a build without this code don't fire
  it (install older than 24h), so it counts new installs only.
- **iOS `install_source` is always `organic`.** App Store Connect campaign links report
  inside App Store Connect only; iOS gives the app nothing to read. iOS
  channel comparison has to come from ASC's Campaigns report, and iOS
  "organic" includes campaign installs.
- **Android links must use the `referrer` param.** The Play Install Referrer
  API (and Firebase's own attribution) reads `&referrer=<url-encoded utm
  string>`, not bare `utm_*` params on the store URL. See links below.
- **`mood` values are the app's:** `wind_down | casual | focused | intense`.
  So `scenario` reads `30min_wind_down`, not `30min_low_energy`.
- **`platform_filter`** is the sorted, comma-joined selection (`pc,switch`)
  or `none`. The app's options are pc, playstation, xbox, switch, mobile;
  there is no steam_deck filter.
- **`library_mode`** is `steam_synced` in Backlog Mode, else `none`. The app
  has no manual library, so `manual` never fires.
- **`game_count`** is always 1: shares are one game at a time.
- **`result_shared` on Android** fires when the image share sheet closes;
  Android doesn't report whether the user actually picked a target, so it
  overcounts a little there.
- **`entry_screen`** values: `results`, `backlog`, `profile`, plus the existing
  feature sources `smart_history`, `advanced_filters`, `worked_signal`, and
  `unknown` for any path not tagged yet.

## Tagged links

Naming: `utm_source` = `scenario-pages | reddit | creator | newsletter`,
plus the site's own `web_quiz` (quiz pages and the card's get-the-app sheet)
and `pick_page` (share landing pages),
`utm_medium` = `web | social | email`, `utm_campaign` = `playnxt-<slug>`.

### Google Play (ready)

| Placement | URL |
|---|---|
| Scenario page, 30 min low energy | `https://play.google.com/store/apps/details?id=com.playnxt.app&referrer=utm_source%3Dscenario-pages%26utm_medium%3Dweb%26utm_campaign%3Dplaynxt-30min-lowenergy` |
| Reddit | `https://play.google.com/store/apps/details?id=com.playnxt.app&referrer=utm_source%3Dreddit%26utm_medium%3Dsocial%26utm_campaign%3Dplaynxt-community` |
| Creator outreach | `https://play.google.com/store/apps/details?id=com.playnxt.app&referrer=utm_source%3Dcreator%26utm_medium%3Demail%26utm_campaign%3Dplaynxt-challenge` |
| Web quiz card, "I'll play this!" sheet | `https://play.google.com/store/apps/details?id=com.playnxt.app&referrer=utm_source%3Dweb_quiz%26utm_medium%3Dweb%26utm_campaign%3Dplaynxt-web-pick` |

The scenario page builds its own link from `campaign` in
`playnxt-web/api/_scenarios.js`.

### App Store (ready)

Provider token `128357651` is fixed for the account; a new campaign is the
same URL with a different `ct`. No setup needed in App Store Connect, results
show under Analytics > Acquisition > Campaigns once traffic arrives.

| Placement | URL |
|---|---|
| Scenario page, 30 min low energy | `https://apps.apple.com/app/apple-store/id6757089064?pt=128357651&ct=playnxt-30min-lowenergy&mt=8` |
| Reddit / community | `https://apps.apple.com/app/apple-store/id6757089064?pt=128357651&ct=playnxt-community&mt=8` |
| Creator outreach | `https://apps.apple.com/app/apple-store/id6757089064?pt=128357651&ct=playnxt-challenge&mt=8` |
| Web quiz card, "I'll play this!" sheet | `https://apps.apple.com/app/apple-store/id6757089064?pt=128357651&ct=playnxt-web-pick&mt=8` |

New scenario pages: put the link in `iosCampaignUrl` in
`playnxt-web/api/_scenarios.js` (falls back to the plain App Store URL).

## Code

- `mobile-app/src/services/attributionService.ts`: referrer parsing, `install_source`, `app_first_open`
- `mobile-app/src/context/RecommendationContext.js`: started, viewed, selected
- `mobile-app/src/services/shareService.js`: result_shared
- `mobile-app/src/context/PremiumContext.js`: premium_purchase
- Tests: `__tests__/activationEvents.test.js`, `__tests__/premiumPurchaseEvent.test.js`,
  `src/services/__tests__/attributionService.test.js`, `shareService.test.js`

Ships with the next app build (needs a native build: adds `expo-application`).
