import { MOOD_TO_GENRES } from '../OptionalFiltersScreen';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
}));

describe('OptionalFiltersScreen MOOD_TO_GENRES', () => {
  test.each(['wind_down', 'casual', 'focused', 'intense'])(
    'offers the Horror chip at %s',
    (mood) => {
      expect(MOOD_TO_GENRES[mood]).toContain('horror');
    },
  );
});
