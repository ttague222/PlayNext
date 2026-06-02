import {
  smartHistoryState,
  smartHistoryRowAction,
  lockedFilterAction,
  nextSingleSelectChip,
  nextMultiSelectChips,
} from '../premiumGating';

describe('smartHistoryState', () => {
  it('returns teaser when not premium', () => {
    expect(smartHistoryState({
      isPremium: false, isAnonymous: true, hasSignedInUser: false, positiveSignalsCount: 0,
    })).toBe('teaser');
    expect(smartHistoryState({
      isPremium: false, isAnonymous: false, hasSignedInUser: true, positiveSignalsCount: 10,
    })).toBe('teaser');
  });

  it('returns anonymous when premium but not signed in', () => {
    expect(smartHistoryState({
      isPremium: true, isAnonymous: true, hasSignedInUser: false, positiveSignalsCount: 0,
    })).toBe('anonymous');
  });

  it('returns anonymous when premium but no user object', () => {
    expect(smartHistoryState({
      isPremium: true, isAnonymous: false, hasSignedInUser: false, positiveSignalsCount: 0,
    })).toBe('anonymous');
  });

  it('returns empty when premium + signed in but no signals', () => {
    expect(smartHistoryState({
      isPremium: true, isAnonymous: false, hasSignedInUser: true, positiveSignalsCount: 0,
    })).toBe('empty');
  });

  it('returns list when premium + signed in + signals exist', () => {
    expect(smartHistoryState({
      isPremium: true, isAnonymous: false, hasSignedInUser: true, positiveSignalsCount: 3,
    })).toBe('list');
  });
});

describe('smartHistoryRowAction', () => {
  it('teaser routes to Premium with source=smart_history', () => {
    expect(smartHistoryRowAction('teaser')).toEqual({
      type: 'navigate', screen: 'Premium', params: { source: 'smart_history' },
    });
  });

  it('anonymous routes to SignIn', () => {
    expect(smartHistoryRowAction('anonymous')).toEqual({
      type: 'navigate', screen: 'SignIn', params: null,
    });
  });

  it('empty and list have no row-level action', () => {
    expect(smartHistoryRowAction('empty')).toBeNull();
    expect(smartHistoryRowAction('list')).toBeNull();
  });
});

describe('lockedFilterAction', () => {
  it('always routes to Premium with source=advanced_filters', () => {
    expect(lockedFilterAction()).toEqual({
      type: 'navigate', screen: 'Premium', params: { source: 'advanced_filters' },
    });
  });
});

describe('nextSingleSelectChip', () => {
  it('selecting a new value returns it', () => {
    expect(nextSingleSelectChip(null, 'anytime')).toBe('anytime');
    expect(nextSingleSelectChip('checkpoints', 'anytime')).toBe('anytime');
  });

  it('tapping the active value clears it (null)', () => {
    expect(nextSingleSelectChip('anytime', 'anytime')).toBeNull();
  });
});

describe('nextMultiSelectChips', () => {
  it('adds when absent', () => {
    expect(nextMultiSelectChips([], 'game_pass')).toEqual(['game_pass']);
    expect(nextMultiSelectChips(['ps_plus'], 'game_pass')).toEqual(['ps_plus', 'game_pass']);
  });

  it('removes when present', () => {
    expect(nextMultiSelectChips(['game_pass', 'ps_plus'], 'game_pass')).toEqual(['ps_plus']);
  });

  it('handles a null/undefined list as empty', () => {
    expect(nextMultiSelectChips(null, 'game_pass')).toEqual(['game_pass']);
    expect(nextMultiSelectChips(undefined, 'game_pass')).toEqual(['game_pass']);
  });
});
