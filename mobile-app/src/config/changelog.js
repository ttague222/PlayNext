/**
 * In-app changelog, one entry per release (spec 2026-09-22).
 * Shown once by ChangelogModal on first launch after an update.
 * cta.screen values are navigation route names; params optional.
 */
export const CHANGELOG = {
  '1.8.0': {
    title: 'Picks for the season',
    features: [
      {
        icon: 'leaf-outline',
        headline: 'Seasonal picks on the Play tab',
        body: 'Each season now has a few picks made for it, like couch co-op for a long weekend. Tap one and you get three games that fit.',
      },
      {
        icon: 'color-palette-outline',
        headline: 'The app changes with the season',
        body: 'The backgrounds shift with the time of year. Buttons and everything you tap stay the same.',
      },
      {
        icon: 'skull-outline',
        headline: 'Horror for every mood',
        body: 'The Horror filter is now there whatever mood you pick, not just when you want something intense.',
      },
    ],
  },
  '1.7.0': {
    title: 'Share your picks',
    features: [
      {
        icon: 'share-social-outline',
        headline: 'One card, all three picks',
        body: 'Sharing your results now sends a single card with every pick and why it fits, plus a link that shows friends exactly what you got.',
      },
      {
        icon: 'link-outline',
        headline: 'Share links open in the app',
        body: "Tap a friend's PlayNxt link and it opens right here instead of the browser.",
      },
    ],
  },
  '1.6.0': {
    title: "Tonight's Picks",
    features: [
      {
        icon: 'moon-outline',
        headline: 'Your picks, ready every evening',
        body: 'Three games chosen for your usual time and mood, waiting on the Play tab. Same three all day. No more deciding.',
        // Through PlayHome's openTonight deep link: opens the picks, or starts
        // the quiz for upgraders who haven't finished a session yet.
        cta: {
          label: "See tonight's picks",
          screen: 'Main',
          params: {
            screen: 'Play',
            params: { screen: 'PlayHome', params: { openTonight: 'whats_new', openTonightVia: 'whats_new' } },
          },
        },
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
