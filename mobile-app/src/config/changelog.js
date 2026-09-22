/**
 * In-app changelog, one entry per release (spec 2026-09-22).
 * Shown once by ChangelogModal on first launch after an update.
 * cta.screen values are navigation route names; params optional.
 */
export const CHANGELOG = {
  '1.4.0': {
    title: "What's new in PlayNxt",
    features: [
      {
        icon: 'logo-steam',
        headline: 'Steam library sync',
        body: 'Connect Steam and picks skip games you already played.',
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
        headline: 'Coming Soon + ratings',
        body: "See what's launching next, and rate games you've played.",
        cta: { label: "See What's New", screen: 'WhatsNew' },
      },
    ],
  },
};
