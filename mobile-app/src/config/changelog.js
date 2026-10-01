/**
 * In-app changelog, one entry per release (spec 2026-09-22).
 * Shown once by ChangelogModal on first launch after an update.
 * cta.screen values are navigation route names; params optional.
 */
export const CHANGELOG = {
  '1.5.0': {
    title: "Tonight's Picks",
    features: [
      {
        icon: 'moon-outline',
        headline: 'Your picks, ready every evening',
        body: 'Three games chosen for your usual time and mood, waiting on the Play tab. Same three all day. No more deciding.',
        cta: { label: "See tonight's picks", screen: 'Main', params: { screen: 'Play' } },
      },
      {
        icon: 'notifications-outline',
        headline: 'Nightly reminder',
        body: 'Want a nudge at 8pm? Turn on the reminder in Profile and pick your time.',
      },
    ],
  },
  '1.4.0': {
    title: "What's new in PlayNxt",
    features: [
      {
        icon: 'logo-steam',
        headline: 'Steam library sync',
        body: "Connect Steam to stop seeing games you've already played.",
        cta: { label: 'Connect Steam', screen: 'ConnectSteam' },
      },
      {
        icon: 'albums-outline',
        headline: 'Backlog Mode',
        body: 'Premium: get picks from games you own but never touched.',
        cta: { label: 'Try Backlog Mode', screen: 'Premium' },
      },
      {
        icon: 'calendar-outline',
        headline: 'Coming soon & ratings',
        body: "See what's launching next, and rate games you've played.",
        cta: { label: "See What's New", screen: 'WhatsNew' },
      },
    ],
  },
};
