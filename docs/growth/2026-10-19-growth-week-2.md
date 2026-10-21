# PlayNxt growth week 2: what we built

October 19, 2026. Started from two briefs: the cozy October scenario page draft
and the week-2 tagged link inventory. The page took an hour. What it turned up
took the rest of the day.

## Status at a glance

| Piece | Status | Where |
|---|---|---|
| Scenario page `/play/cozy-october-games` | Live | playnxt.io |
| Unpacking subscription fix on two older pages | Live | playnxt.io |
| Tagged links for `playnxt-cozy-october` | Live on the page | `docs/ACTIVATION-TRACKING.md` |
| Weekly scenario drift check | Active, two manual runs green | `playnxt-web/.github/workflows/scenario-drift.yml` |
| Catalog audit | Written, Tier 1 and Tier 3 item 12 applied | `docs/CATALOG-AUDIT-2026-10-19.md` |
| Catalog corrections | 29 records written to production | Firestore |
| Subscription pipeline hardening | PR open, unmerged, nothing written | [ttague222/PlayNext#25](https://github.com/ttague222/PlayNext/pull/25) |
| Shareable results (web) | On branch, unpushed, no PR | `feat/shareable-results-web-loop` |
| Scenario page `/play/spooky-october-games` (added Oct 20) | Live | playnxt.io |
| Tagged links for `playnxt-spooky-october` (added Oct 20) | Live on the page | `docs/ACTIVATION-TRACKING.md` |

## 1. The scenario page

Live at https://playnxt.io/play/cozy-october-games, campaign
`playnxt-cozy-october`, slug reusable next October.

The engine has no horror, so the page is framed as cozy October evenings rather
than spooky ones. The draft was explicit about not retrofitting a Halloween
angle onto cozy picks, and that was the right call. (That stopped being true a
day later: see section 7 for the horror catalog expansion and the spooky page
built on it.)

Picks: Garden Story, Unpacking, Dragon Quest Builders 2. Before publishing,
the deployed engine was sampled 42 times at 60 minutes + Wind Down to confirm
all three are reachable output and not a one-off. In the 30-run tally (90
slots), garden-story came back 5 times, unpacking 3 and
dragon-quest-builders-2 once, from a pool of roughly 35 cozy games.

Corrected from the draft, all against the catalog record:

- **"Time-to-fun: under 10 minutes" and "under 5 minutes" became "Jump right
  in".** The catalog only records `time_to_fun: short`. The minute figures were
  invented precision, and the four existing pages all say "Jump right in".
- **Energy-match lines now use the catalog's own mood tags.** "Warm, gentle,
  wholesome" became "Cozy, charming, relaxing"; "heartwarming" and "unhurried"
  are not tags.
- **Em dashes removed**, same as week 1.
- Added Garden Story's catalog fun fact, and took Unpacking's description
  verbatim from the catalog.

## 2. Unpacking had been wrong on two live pages for six months

The draft listed Unpacking as "Included with Apple Arcade". The two live pages
said it had no subscription. One of them had to be wrong.

The catalog was right: Unpacking+ joined Apple Arcade on 2026-04-02 (Apple
Newsroom, and App Store listing id6751239710). The 30 minute and 15 minute
pages shipped on September 30 and October 1, nearly six months later, still
showing no subscription.

The cause is visible in the week 1 notes. The draft those pages came from
claimed "On PS Plus", which was correctly cut as wrong, and the field was then
left empty instead of being refilled with what the catalog actually said.
Cutting a wrong claim and restoring the right one are two different jobs.

Both pages now show Apple Arcade, with their `updated` dates bumped so the
sitemap reflects the change.

This is also a caution about one search being enough: the first search for
Unpacking's Arcade status found a paid $9.99 App Store release and no sign of
Arcade, which is true of 2023 and wrong for today. Apple's own newsroom
settled it.

## 3. The drift check

The real problem was not one stale field, it was that nothing would ever
notice. Scenario pages hand-copy catalog facts so a human vets every claim
before it ships, and that design has no mechanism for catching the catalog
moving afterwards.

Two options were considered: fetch the facts from the catalog at render time,
or keep them committed and add a check. The check won, because the
hand-vetting is the point. Fetching at render time would have put unreviewed
catalog data straight onto public pages, which is a worse failure than a stale
field.

`playnxt-web/.github/workflows/scenario-drift.yml` runs Mondays at 13:00 UTC,
walks every pick in `SCENARIOS`, compares it against the catalog record, and
files an issue on drift. It stays green when it finds drift, on the reasoning
that a permanently red default branch stops being a signal. It only fails if
the check itself could not run. The issue-filing path is untested until real
drift appears.

The same pass corrected the facts that had already drifted, which is why
`/play/1-hour-focused` now shows Netflix Games on Into the Breach and Apple
Arcade on Monster Train.

## 4. Tagged links

Campaign `playnxt-cozy-october`, both stores, recorded in
`docs/ACTIVATION-TRACKING.md` and the scorecard's Link inventory.

Four things in the week-2 brief were wrong and were not followed:

- **"Create the campaign in App Store Connect, then use the campaign link."**
  Not needed. Provider token `128357651` is fixed for the account, as week 1
  established, and results appear under Analytics > Acquisition > Campaigns
  once traffic arrives.
- **`<provider-token>` left as a placeholder.** It is `128357651`.
- **`https://app.playnxt.io/auth/join?ctx=<campaign>`** does not exist. There
  is no such host anywhere in the project. The real in-browser CTA, which the
  page template already emits, is
  `playnxt.io/?utm_source=scenario-pages&utm_medium=web&utm_campaign=<campaign>`.
- **"Add three rows to `playnxt-scorecard.xlsx`"**, which then lists four. The
  file is `docs/growth/PlayNxt-Activation-Scorecard.xlsx`, and the other three
  campaigns were already in it. Only cozy October was missing.

## 5. The catalog audit

Full writeup in `docs/CATALOG-AUDIT-2026-10-19.md`. It started from one bad
record and found a class of them.

Applied to production, 29 records, each approved individually:

| Change | Records |
|---|---|
| Deleted: `unpacking-zen`, `unpacking-2`, `abzu-2`, `xdefiant` | 4 |
| Store links merged before deletion: `unpacking`, `abzu` | 2 |
| Stale `xbox_game_pass` tags removed | 4 |
| Subscription tags added | 7 |
| Wrong store links corrected (Tier 3 item 12) | 12 |

Catalog went from 1407 to 1403 records. Full before-state backup in
`api-service/scripts/catalog_audit_2026_10_19_backup.json`, so all of it is
reversible.

Worth knowing why a wrong subscription tag matters more than it looks. It
feeds four things: the `on_subscriptions` hard filter, the `SUBSCRIPTION_BOOST`
ranking nudge, the platform list `GameCard.js` derives from subscription
config, and the badge `ShareCard.tsx` stamps onto shared images. A wrong tag
tells a user their subscription covers a game they would have to buy.

Root cause of the stale Game Pass tags: the refresh runs monthly on the 3rd,
but Game Pass rotates mid-month. The 2026-10-15 departure batch left four
records falsely claiming coverage for up to 19 days.

**Still undecided:** Tier 2, the rest of Tier 3, and PR #25.

## 6. Scorecard

`docs/growth/PlayNxt-Activation-Scorecard.xlsx` (not committed)

- Link inventory: two rows for `playnxt-cozy-october`, one per store.
- Scoreboard: a new App Store Connect column group for the campaign, and a
  `/play/cozy-october-games` page views column.
- The file still needs opening in Excel once and saving. It was edited with
  openpyxl, which strips cached formula values, and LibreOffice was not
  available to recalculate. All 155 formulas are byte-identical to the
  pre-edit backup, and the sheet has no data yet, so nothing displays
  differently in the meantime.

## 7. Added October 20: the spooky October page

Live at https://playnxt.io/play/spooky-october-games, campaign
`playnxt-spooky-october`, the spooky counterpart to cozy October.

It became possible because of the horror catalog expansion the same day. The
Horror chip matches the exact `horror` genre tag, and 13 well-known horror
games were tagged only `survival-horror` or similar, so the chip never
returned them. The expansion added that tag to 19 existing records and 75 new,
store-verified horror games, taking the horror pool from 79 to 173. Ten
low-energy horror games also lost a stray `intense` mood tag that was costing
them points at Wind Down. At 60 minutes + Casual + Horror, the engine went from
about 10 distinct games over 20 runs to 16.

Picks: Luigi's Mansion 3, Slay the Princess, Costume Quest. They are one real
run (run 7 of 25) at 1 hour + Casual with the Horror filter, the same params
as the app's "Spooky games for a dark night" collection. The 25 runs returned
14 distinct games and none used the fallback. The run was chosen because its
three picks span the range: family ghost-catching, a dark visual novel, and a
Halloween RPG on Game Pass.

Same rules as the cozy page:

- **Every fact comes from the catalog record.** Platforms, subscription,
  time-to-fun, stopping point and the Energy match words are all checked by
  the drift check, which passed for all 9 pages after the page was added.
- **No fun facts**, because none of the three records has one.
- **Slay the Princess says it is rated M** in its own copy, since it sits on a
  page that also has a family pick.
- **No em dashes.**

Tagged links for both stores are in `docs/ACTIVATION-TRACKING.md`. Not yet
done: the scorecard rows and the Search Console check, both added below.

## Still to do

1. **Open the scorecard in Excel and save it**, to restore cached values.
2. **Push three docs commits** on PlayNxt `main`.
3. **Decide PR #25.** Note the property that matters: the workflow runs
   `--apply` on cron with no human gate, so merging it *is* the apply. It is
   not a change that can be merged and evaluated later. Recommendation is to
   resolve the `ea-fc-25` / `ea-sports-fc-25` duplicate in the same pass,
   because the first run otherwise leaves both halves of a duplicate carrying
   subscription tags for the same game, both able to surface in filtered
   results and both able to be stamped onto a share card.
4. **Tier 2 decisions**, now better informed: `crash-bandicoot-4`, the record
   originally recommended for keeping, turned out to carry a dead PlayStation
   link.
5. **The rest of Tier 3.**
6. **Shareable results**: branch unpushed, no PR. Six rounds of hardening
   landed on the `why` field; the recorded root fix is a signed recommendation
   id that `create_share` verifies, so free text never enters.
7. **Check Search Console** in a few days for whether the new page is indexed.
8. **Decide what happens to the page in November.** The slug is reusable each
   October, so the options are to leave it, deindex it, or rewrite it
   seasonally. The same decision now covers `/play/spooky-october-games`.
9. ~~**Add `playnxt-spooky-october` to the scorecard**~~ Done October 21: two
   Link inventory rows, an App Store Connect column group and a page views
   column, plus the How to fill steps now name both October pages. The
   workbook is set to recalculate fully when Excel opens it. The three
   October 20 pages (post-travel wind-down, long flight, holiday couch
   multiplayer) got the same columns, and their Link inventory rows now say
   LIVE, placed 2026-10-20.
10. **Check Search Console** for the spooky page being indexed, alongside the
    cozy one.

## A note on running several sessions in one checkout

Several sessions worked in `Projects/PlayNxt` at once today, four of them
writing. Two things came out of that worth remembering:

- One session's `fetch_subscription_sources.py` run rewrote source lists while
  another had them staged, and uncommitted edits to the audit doc blocked a
  third session's branch checkout twice. Nothing was lost, because each
  session committed only its own files, but that was discipline rather than
  luck.
- A session's report is not proof. Several claims checked out; several did
  not, in both directions, and the only reliable check was reading the live
  API or the code rather than the summary.

## Code locations

- Site: `playnxt-web/api/_scenarios.js`, `api/play.js`,
  `.github/workflows/scenario-drift.yml`
- Docs: `PlayNxt/docs/ACTIVATION-TRACKING.md`,
  `docs/CATALOG-AUDIT-2026-10-19.md`
- Catalog scripts: `api-service/scripts/subscription_refresh.py`,
  `fetch_subscription_sources.py`, `subscription_data/`,
  `catalog_audit_2026_10_19_backup.json`
- Subscription ranking: `api-service/src/services/recommendation_service.py`
