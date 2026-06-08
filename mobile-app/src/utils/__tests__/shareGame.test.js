import { buildShareMessage } from '../shareGame';

describe('buildShareMessage', () => {
  it('includes the game title', () => {
    const { message } = buildShareMessage({ title: 'Hades' });
    expect(message).toContain('Hades');
  });

  it('includes the iOS App Store link', () => {
    const { message } = buildShareMessage({ title: 'Hades' });
    expect(message).toContain('6757089064');
  });

  it('includes the Android Play Store link', () => {
    const { message } = buildShareMessage({ title: 'Hades' });
    expect(message).toContain('com.playnxt.app');
  });

  it('sets the share title to the game name', () => {
    const { title } = buildShareMessage({ title: 'Vampire Survivors' });
    expect(title).toContain('Vampire Survivors');
  });

  it('handles a game with no title gracefully', () => {
    const { message } = buildShareMessage({});
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(0);
  });
});
