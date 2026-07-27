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
  isOurAppUrl,
  extractPathFromWebUrl,
} from '../DeepLinkHandler';
import {WEB_HOST} from '../config';

beforeEach(() => {
  mockMemory.clear();
  jest.clearAllMocks();
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

export {mockMemory};
