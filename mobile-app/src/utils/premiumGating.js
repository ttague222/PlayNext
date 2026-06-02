/**
 * Pure helpers that encode the premium-gating decisions used across the UI.
 *
 * These are extracted so the behavior is unit-testable without rendering whole
 * screens (which would require mocking every context the screens depend on).
 *
 * Used by:
 * - OptionalFiltersScreen (advanced filter chips and toggles)
 * - HistoryScreen (Smart History section)
 */

/**
 * Smart History section state in HistoryScreen.
 * Mutually exclusive: exactly one state is rendered.
 *
 *   not premium                  → 'teaser'           → tap navigates to Premium
 *   premium, anonymous           → 'anonymous'        → tap navigates to SignIn
 *   premium, signed in, empty    → 'empty'            → no-op (informational copy)
 *   premium, signed in, has data → 'list'             → render rows
 */
export function smartHistoryState({ isPremium, isAnonymous, hasSignedInUser, positiveSignalsCount }) {
  if (!isPremium) return 'teaser';
  if (isAnonymous || !hasSignedInUser) return 'anonymous';
  if (!positiveSignalsCount || positiveSignalsCount <= 0) return 'empty';
  return 'list';
}

/**
 * What the Smart History row tap should do.
 * Returns an object describing the intended navigation, or null if no nav.
 */
export function smartHistoryRowAction(state) {
  if (state === 'teaser') return { type: 'navigate', screen: 'Premium', params: { source: 'smart_history' } };
  if (state === 'anonymous') return { type: 'navigate', screen: 'SignIn', params: null };
  return null;
}

/**
 * What happens when a free user taps a premium-gated advanced filter row.
 * Returns an object describing the navigation, never null — the gate must fire.
 */
export function lockedFilterAction() {
  return { type: 'navigate', screen: 'Premium', params: { source: 'advanced_filters' } };
}

/**
 * Single-select chip toggle for an advanced filter (stop-friendliness, time-to-fun).
 * Returns the next value: null when the chip is being un-toggled (current === tapped),
 * otherwise the tapped value.
 *
 * Caller is responsible for the gate check — this only computes the next state.
 */
export function nextSingleSelectChip(currentValue, tappedValue) {
  return currentValue === tappedValue ? null : tappedValue;
}

/**
 * Multi-select chip toggle for an advanced filter (on_subscriptions).
 * Returns the next list with the tapped value toggled in/out.
 */
export function nextMultiSelectChips(currentList, tappedValue) {
  const list = currentList || [];
  return list.includes(tappedValue)
    ? list.filter((v) => v !== tappedValue)
    : [...list, tappedValue];
}
