import { handleShareUrl } from '../deepLinkService';
import { logEvent } from '../analyticsService';

jest.mock('../analyticsService', () => ({
  logEvent: jest.fn(),
}));

describe('handleShareUrl', () => {
  beforeEach(() => jest.clearAllMocks());

  it('logs app_open_from_share with the share id and reports the link handled', () => {
    const handled = handleShareUrl('https://playnxt.io/s/aK3m9Qp2Rb?utm_source=share');

    expect(handled).toBe(true);
    expect(logEvent).toHaveBeenCalledWith('app_open_from_share', {
      share_id: 'aK3m9Qp2Rb',
    });
  });

  it('leaves non-share links alone', () => {
    const handled = handleShareUrl('playnxt://auth/oauth?code=abc');

    expect(handled).toBe(false);
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('leaves junk alone', () => {
    expect(handleShareUrl(null)).toBe(false);
    expect(logEvent).not.toHaveBeenCalled();
  });
});
