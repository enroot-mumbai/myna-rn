const mockMemory = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async (k: string, v: string) => {
      mockMemory.set(k, v);
    }),
    getItem: jest.fn(async (k: string) => mockMemory.get(k) ?? null),
    removeItem: jest.fn(async (k: string) => {
      mockMemory.delete(k);
    }),
  },
}));

import {
  isAuthOnlyPath,
  isPublicPath,
  shouldStashPendingPostLogin,
  isOurAppUrl,
  extractPathFromWebUrl,
  storePendingPostLoginUrl,
  getPendingPostLoginUrl,
  clearPendingPostLoginUrl,
  resolveDeepLinkUrl,
  checkInstallReferrer,
} from '../DeepLinkHandler';
import {WEB_HOST, WEB_URL} from '../config';

beforeEach(() => {
  mockMemory.clear();
  jest.clearAllMocks();
});

describe('pending post-login url storage', () => {
  const goodUrl = `https://${WEB_HOST}/learn/physical-health`;

  it('stores and returns url within TTL', async () => {
    await storePendingPostLoginUrl(goodUrl);
    await expect(getPendingPostLoginUrl()).resolves.toBe(goodUrl);
  });

  it('rejects external url on store', async () => {
    await storePendingPostLoginUrl('https://evil.example/learn');
    await expect(getPendingPostLoginUrl()).resolves.toBeNull();
  });

  it('returns null and clears when expired', async () => {
    await storePendingPostLoginUrl(goodUrl);
    const eightDaysAgo = (Date.now() - 8 * 24 * 60 * 60 * 1000).toString();
    mockMemory.set('pending_post_login_timestamp', eightDaysAgo);
    await expect(getPendingPostLoginUrl()).resolves.toBeNull();
    expect(mockMemory.has('pending_post_login_url')).toBe(false);
  });

  it('clearPendingPostLoginUrl removes keys', async () => {
    await storePendingPostLoginUrl(goodUrl);
    await clearPendingPostLoginUrl();
    await expect(getPendingPostLoginUrl()).resolves.toBeNull();
  });

  it('get clears malformed / non-app url', async () => {
    mockMemory.set('pending_post_login_url', 'https://evil.example/x');
    mockMemory.set('pending_post_login_timestamp', Date.now().toString());
    await expect(getPendingPostLoginUrl()).resolves.toBeNull();
  });
});

describe('isAuthOnlyPath', () => {
  it.each([
    ['/', true],
    ['', true],
    ['signup', true],
    ['/signup', true],
    ['welcome', true],
    ['/welcome', true],
    ['login', true],
    ['/login', true],
    ['/learn/physical-health', false],
    ['/period-tracking', false],
    ['/profile', false],
    ['/home', false],
    ['/telehealth', false],
  ])('%s → %s', (path, expected) => {
    expect(isAuthOnlyPath(path)).toBe(expected);
  });
});

describe('isPublicPath / shouldStashPendingPostLogin', () => {
  it.each([
    ['/privacy-policy', true],
    ['privacy-policy', true],
    ['/terms-of-service', true],
    ['/terms', true],
    ['/cookie-policy', true],
    ['/learn/physical-health', false],
    ['/login', false],
  ])('isPublicPath(%s) → %s', (path, expected) => {
    expect(isPublicPath(path)).toBe(expected);
  });

  it('does not stash public or auth-only paths', () => {
    expect(shouldStashPendingPostLogin('/privacy-policy')).toBe(false);
    expect(shouldStashPendingPostLogin('/login')).toBe(false);
    expect(shouldStashPendingPostLogin('/learn/foo')).toBe(true);
  });
});

describe('isOurAppUrl', () => {
  it('accepts WEB_HOST and localhost', () => {
    expect(isOurAppUrl(`https://${WEB_HOST}/learn`)).toBe(true);
    expect(isOurAppUrl('http://localhost:3000/learn')).toBe(true);
  });

  it('rejects external hosts', () => {
    expect(isOurAppUrl('https://evil.example/learn')).toBe(false);
  });
});

describe('extractPathFromWebUrl', () => {
  it('returns pathname without query', () => {
    expect(extractPathFromWebUrl(`https://${WEB_HOST}/learn/foo?x=1`)).toBe(
      '/learn/foo',
    );
  });
});

describe('resolveDeepLinkUrl pending stash', () => {
  it('stashes learn path when logged out and returns WEB_URL', async () => {
    mockMemory.delete('token');
    const input = `https://${WEB_HOST}/learn/physical-health`;
    const result = await resolveDeepLinkUrl(input, WEB_URL);
    expect(result).toBe(WEB_URL);
    expect(mockMemory.get('pending_post_login_url')).toBe(
      `${WEB_URL}/learn/physical-health`,
    );
  });

  it('passes through privacy-policy when logged out (no stash)', async () => {
    mockMemory.delete('token');
    const input = `https://${WEB_HOST}/privacy-policy`;
    const result = await resolveDeepLinkUrl(input, WEB_URL);
    expect(result).toBe(`${WEB_URL}/privacy-policy`);
    expect(mockMemory.get('pending_post_login_url')).toBeUndefined();
  });

  it('does not stash signup', async () => {
    mockMemory.delete('token');
    mockMemory.delete('pending_post_login_url');
    const result = await resolveDeepLinkUrl(
      `https://${WEB_HOST}/signup?program=x`,
      WEB_URL,
    );
    expect(mockMemory.get('pending_post_login_url')).toBeUndefined();
    expect(result).toBeTruthy();
    expect(result!.includes('/learn')).toBe(false);
  });

  it('navigates immediately when logged in', async () => {
    mockMemory.set('token', 'abc');
    const input = `https://${WEB_HOST}/telehealth`;
    const result = await resolveDeepLinkUrl(input, WEB_URL);
    expect(result).toBe(`${WEB_URL}/telehealth`);
    expect(mockMemory.get('pending_post_login_url')).toBeUndefined();
  });

  it('honors isLoggedIn override when AsyncStorage has no token', async () => {
    mockMemory.delete('token');
    const input = `https://${WEB_HOST}/learn/mental-health/iq-eq-sq?overview=false`;
    const result = await resolveDeepLinkUrl(input, WEB_URL, {isLoggedIn: true});
    expect(result).toBe(
      `${WEB_URL}/learn/mental-health/iq-eq-sq?overview=false`,
    );
    expect(mockMemory.get('pending_post_login_url')).toBeUndefined();
  });
});

describe('checkInstallReferrer pending route', () => {
  it('stashes non-signup route and returns WEB_URL when logged out', async () => {
    mockMemory.delete('token');
    const InstallReferrer = {
      getReferrer: async () => ({
        installReferrer: 'route=%2Flearn%2Fphysical-health',
      }),
    };
    const result = await checkInstallReferrer(WEB_URL, InstallReferrer);
    expect(result).toEqual({hasReferrer: true, url: WEB_URL});
    expect(mockMemory.get('pending_post_login_url')).toBe(
      `${WEB_URL}/learn/physical-health`,
    );
  });
});
