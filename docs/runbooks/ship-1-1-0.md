# Runbook: Ship 1.1.0

> Prepared 2026-08-19. Three one-time unlocks (Tom), then one command ships both stores.
> Metadata strings come from `ASO-PLAN.md` — Apple only for now; hold Google Play per the two-week rollout plan.

## Status as of 2026-08-19 evening

- ✅ Step 1 (iOS credentials) — done; ASC API key for EAS Submit already existed
- ⏳ Step 2 (Play service account) — GCP account + key exist; **Play Console invite stuck at "Invite sent"** (first invite predates the account). Remove and re-invite, then Claude re-tests the API
- ⬜ Step 3 (ASC metadata) — not started; do before Submit for Review
- ⬜ Step 4 (device test) — APK available, checklist below
- 🟡 Step 5 — **builds done and iOS uploaded**: iOS 1.1.0 (12) processing in TestFlight (a stale June build 11 exists there — ignore it, never attach it); Android .aab (versionCode 13) built, awaiting submit via service account or manual Play Console upload
- Gotcha discovered: Apple silently rejects duplicate version+build uploads with a generic EAS error — that's why build 11 wouldn't submit

---

## Step 1 — iOS credentials (one-time, ~5 min)

```bash
cd C:/Users/ttagu/Projects/PlayNxt/mobile-app
npx eas-cli credentials
```

Choose: **iOS** → build profile **production** → sign in with the Apple Developer account → **App Store** distribution → let EAS generate and manage the distribution certificate and provisioning profile (accept the defaults).

Done when: the credentials summary shows a Distribution Certificate and an App Store provisioning profile for `com.playnxt.app`.

## Step 2 — Google Play service-account key (one-time, ~10 min)

Create the service account and key (gcloud is already authenticated):

```bash
gcloud iam service-accounts create playstore-publisher --project playnxt-1a2c6 --display-name "Play Store publisher"
```

```bash
gcloud iam service-accounts keys create C:/Users/ttagu/Projects/PlayNxt/mobile-app/playstore-service-account.json --iam-account playstore-publisher@playnxt-1a2c6.iam.gserviceaccount.com
```

Then grant it Play Console access (must be done in the browser):
1. [Play Console](https://play.google.com/console) → **Users and permissions** → **Invite new user**
2. Email: `playstore-publisher@playnxt-1a2c6.iam.gserviceaccount.com`
3. App permissions → PlayNxt → check **Release to production** and **Release apps to testing tracks** → Invite

Notes: `eas.json` already points at `./playstore-service-account.json`, and the file is gitignored. Done when: the invite shows as active in Users and permissions.

## Step 3 — App Store Connect metadata (~10 min)

Sign in at [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **My Apps** → **PlayNxt**. (Claude can drive this in the browser pane once you're signed in — or do it by hand below.)

1. If there is no editable version: **⊕ Add version** → `1.1.0`.
2. **App Information** (left sidebar):
   - **Name:** `PlayNxt: Game Finder by Mood`
   - **Subtitle:** `What to play in your free time`
3. **1.1.0 version page**:
   - **Keywords** (paste verbatim, 99 chars):
     ```
     backlog,tracker,pick,suggest,recommend,next,steam,deck,xbox,switch,pass,indie,coop,solo,chill,short
     ```
   - **Description:** replace with the long description from `ASO-PLAN.md` §7. At absolute minimum, remove the sentence claiming "Swipe through curated picks" (no swipe exists — reroll button) — this line is a review/conversion risk.
   - **Promotional text** (170 max, changeable anytime):
     ```
     Save games to Backlog, Playing and Played. Tell PlayNxt your time and mood, get up to 3 picks with a reason for each. No account needed.
     ```
   - **What's New:** summarize 1.1.0 (premium features, smarter picks, follow-up notifications).
4. **Save** — do NOT submit for review yet; the build attaches in Step 5.
5. While signed in: verify the **Google Play category** separately in Play Console (should be Entertainment, not Games) — check only, change nothing else on Play yet.

## Step 4 — Device test the consolidated APK (~5 min)

Install the latest CI/preview APK (Expo dashboard → playnxt → Builds), then:

- [ ] App launches; recommendation flow returns games
- [ ] 4th recommendation fetch of the day triggers the rewarded-ad gate
- [ ] Firebase console → Analytics → **Realtime** shows `screen_view` and `rec_requested` within a few minutes
- [ ] Accept a game → celebration + saved to Library

## Step 5 — Build and submit both stores

Bump build numbers in `mobile-app/app.config.js` first (iOS `buildNumber` "11" → "12", Android `versionCode` 12 → 13 — must exceed anything previously uploaded), commit, then:

```bash
cd C:/Users/ttagu/Projects/PlayNxt/mobile-app && npx eas-cli build --platform all --profile production --auto-submit
```

- iOS: after the build uploads, return to ASC, attach the build to 1.1.0, answer the compliance questions (encryption: No — already declared in config), and **Submit for Review**.
- ATT note for review: the tracking prompt appears mid-session before the first ad load. The remote-config kill switch (`ads_enabled`) can disable ads entirely if review complains.
- Android: `--auto-submit` pushes to the production track via the service account; roll out from Play Console.

## After it ships

- Watch Firebase Analytics (paywall_viewed → purchase_completed funnel, att_result grant rate) and store review status.
- ASO: Apple metadata went live with this release. Hold Play title/description for two weeks, compare Apple impressions, then decide (ASO-PLAN §10).
- JS-only fixes from here on: `npx eas-cli update --channel production` (no store review needed).
