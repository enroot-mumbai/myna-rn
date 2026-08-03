import AsyncStorage from '@react-native-async-storage/async-storage';
import {WEB_HOST} from './config';

const PENDING_POST_LOGIN_URL_KEY = 'pending_post_login_url';
const PENDING_POST_LOGIN_TIMESTAMP_KEY = 'pending_post_login_timestamp';
const PENDING_POST_LOGIN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Parse query string into key-value pairs
export const parseQueryString = (
  queryString: string,
): Record<string, string> => {
  const params: Record<string, string> = {};

  if (!queryString) {
    return params;
  }

  const pairs = queryString.split('&');

  for (const pair of pairs) {
    const [key, value] = pair.split('=');

    if (key && value) {
      const decodedKey = decodeURIComponent(key);
      const decodedValue = decodeURIComponent(value);
      params[decodedKey] = decodedValue;
    }
  }

  return params;
};

const normalizeAppPath = (path: string): string => {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized === '/' || path === '') {
    return '/';
  }
  return normalized.split('?')[0].replace(/\/$/, '') || '/';
};

export const isAuthOnlyPath = (path: string): boolean => {
  const base = normalizeAppPath(path);
  return (
    base === '/' ||
    base === '/signup' ||
    base === '/welcome' ||
    base === '/login'
  );
};

// Logged-out deep links that must open as-is (no stash → login redirect)
const PUBLIC_PATHS = new Set([
  '/privacy-policy',
  '/terms',
  '/terms-of-service',
  '/terms-and-conditions',
  '/cookie-policy',
]);

export const isPublicPath = (path: string): boolean =>
  PUBLIC_PATHS.has(normalizeAppPath(path));

export const shouldStashPendingPostLogin = (path: string): boolean =>
  !isAuthOnlyPath(path) && !isPublicPath(path);

export const isOurAppUrl = (url: string): boolean => {
  if (!url) return false;
  return url.includes(WEB_HOST) || url.includes('localhost');
};

export const extractPathFromWebUrl = (url: string): string => {
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const withoutScheme = url.replace(/^https?:\/\//, '');
      const pathStart = withoutScheme.indexOf('/');
      if (pathStart === -1) return '/';
      const pathAndQuery = withoutScheme.substring(pathStart);
      const q = pathAndQuery.indexOf('?');
      return q === -1 ? pathAndQuery : pathAndQuery.substring(0, q);
    }
    const [pathPart] = url.split('?');
    if (!pathPart || pathPart === '') return '/';
    return pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  } catch {
    return '/';
  }
};

export const storePendingPostLoginUrl = async (url: string): Promise<void> => {
  try {
    if (!isOurAppUrl(url)) {
      console.warn('[PendingPostLogin] store refused (not app host):', url);
      return;
    }
    await AsyncStorage.setItem(PENDING_POST_LOGIN_URL_KEY, url);
    await AsyncStorage.setItem(
      PENDING_POST_LOGIN_TIMESTAMP_KEY,
      Date.now().toString(),
    );
    console.log('[PendingPostLogin] stored:', url);
  } catch (error) {
    console.error('[PendingPostLogin] store error:', error);
  }
};

export const clearPendingPostLoginUrl = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(PENDING_POST_LOGIN_URL_KEY);
    await AsyncStorage.removeItem(PENDING_POST_LOGIN_TIMESTAMP_KEY);
    console.log('[PendingPostLogin] cleared');
  } catch (error) {
    console.error('[PendingPostLogin] clear error:', error);
  }
};

export const getPendingPostLoginUrl = async (): Promise<string | null> => {
  try {
    const url = await AsyncStorage.getItem(PENDING_POST_LOGIN_URL_KEY);
    const timestamp = await AsyncStorage.getItem(
      PENDING_POST_LOGIN_TIMESTAMP_KEY,
    );

    if (!url || !timestamp) {
      console.log('[PendingPostLogin] get → none');
      return null;
    }

    const age = Date.now() - parseInt(timestamp, 10);
    if (age >= PENDING_POST_LOGIN_TTL_MS || Number.isNaN(age)) {
      console.log('[PendingPostLogin] get → expired, ageMs=', age);
      await clearPendingPostLoginUrl();
      return null;
    }

    if (!isOurAppUrl(url)) {
      console.warn('[PendingPostLogin] get → bad host, clearing:', url);
      await clearPendingPostLoginUrl();
      return null;
    }

    console.log('[PendingPostLogin] get →', url, 'ageMs=', age);
    return url;
  } catch (error) {
    console.error('[PendingPostLogin] get error:', error);
    return null;
  }
};

// Check if this is the first app launch after install
export const isFirstLaunch = async (): Promise<boolean> => {
  try {
    const hasLaunched = await AsyncStorage.getItem('app_has_launched');
    return hasLaunched === null;
  } catch (error) {
    console.error('❌ Error checking first launch:', error);
    return false;
  }
};

// Mark app as launched
export const markAppAsLaunched = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem('app_has_launched', 'true');
  } catch (error) {
    console.error('❌ Error marking app as launched:', error);
  }
};

// Check if user is logged in (native AsyncStorage mirror of web localStorage token)
export const isUserLoggedIn = async (): Promise<boolean> => {
  try {
    const token = await AsyncStorage.getItem('token');
    const loggedIn = token !== null && token !== '';
    console.log('[DeepLink] isUserLoggedIn →', loggedIn);
    return loggedIn;
  } catch (error) {
    console.error('[DeepLink] isUserLoggedIn error', error);
    return false;
  }
};

// Keep AsyncStorage in sync with WebView LOG_IN / LOG_OUT (isUserLoggedIn reads this)
export const setNativeLoginToken = async (token: string): Promise<void> => {
  try {
    if (!token) {
      await AsyncStorage.removeItem('token');
      console.log('[DeepLink] setNativeLoginToken cleared (empty)');
      return;
    }
    await AsyncStorage.setItem('token', token);
    console.log('[DeepLink] setNativeLoginToken saved');
  } catch (error) {
    console.error('[DeepLink] setNativeLoginToken error', error);
  }
};

export const clearNativeLoginToken = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('token');
    console.log('[DeepLink] clearNativeLoginToken');
  } catch (error) {
    console.error('[DeepLink] clearNativeLoginToken error', error);
  }
};

// Build URL with language parameter
const buildUrlWithLanguage = (baseUrl: string, language?: string): string => {
  if (!language) return baseUrl;

  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}language=${encodeURIComponent(language)}`;
};

export const getWelcomeUrl = (WEB_URL: string): string => `${WEB_URL}/welcome`;

export const storeReferrerParams = async (params: {
  program?: string;
  route?: string;
  language?: string;
  ref?: string;
}): Promise<void> => {
  try {
    if (params.program) {
      await AsyncStorage.setItem('referrer_program', params.program);
    }
    if (params.route) {
      await AsyncStorage.setItem('referrer_route', params.route);
    }
    if (params.language) {
      await AsyncStorage.setItem('referrer_language', params.language);
    }
    if (params.ref) {
      await AsyncStorage.setItem('referrer_ref', params.ref);
    }
    await AsyncStorage.setItem('referrer_timestamp', Date.now().toString());
  } catch (error) {
    console.error('❌ Error storing referrer params:', error);
  }
};

export const buildSignupUrl = (
  WEB_URL: string,
  params: {program?: string; language?: string; ref?: string} = {},
): string => {
  let webViewUrl = `${WEB_URL}/signup`;

  if (params.program) {
    webViewUrl += `?program=${encodeURIComponent(params.program)}`;
  }

  webViewUrl = buildUrlWithLanguage(webViewUrl, params.language);

  if (params.ref) {
    const separator = webViewUrl.includes('?') ? '&' : '?';
    webViewUrl += `${separator}ref=${encodeURIComponent(params.ref)}`;
  }

  return webViewUrl;
};

const resolveSignupDestination = async (
  WEB_URL: string,
  params: {program?: string; language?: string; ref?: string},
): Promise<string> => {
  const isLoggedIn = await isUserLoggedIn();
  const firstLaunch = await isFirstLaunch();

  if (!isLoggedIn && firstLaunch) {
    return getWelcomeUrl(WEB_URL);
  }

  if (!isLoggedIn) {
    return buildSignupUrl(WEB_URL, params);
  }

  return WEB_URL;
};

// Check for stored referrer data
export const checkStoredReferrer = async (
  WEB_URL: string,
): Promise<{hasStoredReferrer: boolean; url?: string}> => {
  try {
    const storedProgram = await AsyncStorage.getItem('referrer_program');
    const storedRoute = await AsyncStorage.getItem('referrer_route');
    const storedLanguage = await AsyncStorage.getItem('referrer_language');
    const storedRef = await AsyncStorage.getItem('referrer_ref');
    const storedTimestamp = await AsyncStorage.getItem('referrer_timestamp');

    if (storedRoute && storedTimestamp) {
      const referrerAge = Date.now() - parseInt(storedTimestamp);
      const ninetyDaysInMs = 90 * 24 * 60 * 60 * 1000;

      if (referrerAge < ninetyDaysInMs) {
        const isLoggedIn = await isUserLoggedIn();

        // Redirect new users through welcome first; returning guests go to signup
        if (
          (storedRoute === 'signup' || storedRoute === '/signup') &&
          !isLoggedIn
        ) {
          const webViewUrl = await resolveSignupDestination(WEB_URL, {
            program: storedProgram || undefined,
            language: storedLanguage || undefined,
            ref: storedRef || undefined,
          });

          return {hasStoredReferrer: true, url: webViewUrl};
        }
      } else {
        // Clean up expired referrer data
        await AsyncStorage.removeItem('referrer_program');
        await AsyncStorage.removeItem('referrer_route');
        await AsyncStorage.removeItem('referrer_language');
        await AsyncStorage.removeItem('referrer_ref');
        await AsyncStorage.removeItem('referrer_timestamp');
      }
    }

    return {hasStoredReferrer: false};
  } catch (error) {
    console.error('❌ Error checking stored referrer:', error);
    return {hasStoredReferrer: false};
  }
};

// Get stored program for prefilling forms
export const getStoredProgram = async (): Promise<{
  program?: string;
  language?: string;
  ref?: string;
}> => {
  try {
    const storedProgram = await AsyncStorage.getItem('referrer_program');
    const storedLanguage = await AsyncStorage.getItem('referrer_language');
    const storedRef = await AsyncStorage.getItem('referrer_ref');
    const storedTimestamp = await AsyncStorage.getItem('referrer_timestamp');

    if (storedTimestamp) {
      const referrerAge = Date.now() - parseInt(storedTimestamp);
      const ninetyDaysInMs = 90 * 24 * 60 * 60 * 1000;

      if (referrerAge < ninetyDaysInMs) {
        return {
          program: storedProgram || undefined,
          language: storedLanguage || undefined,
          ref: storedRef || undefined,
        };
      }
    }

    return {};
  } catch (error) {
    console.error('❌ Error getting stored program:', error);
    return {};
  }
};

// Check install referrer
export const checkInstallReferrer = async (
  WEB_URL: string,
  InstallReferrer: any,
): Promise<{hasReferrer: boolean; url?: string}> => {
  try {
    const referrerDetails = await InstallReferrer.getReferrer();

    if (referrerDetails && referrerDetails.installReferrer) {
      const referrerString = referrerDetails.installReferrer;
      const params = parseQueryString(referrerString);

      const program = params['program'] || params['utm_campaign'];
      const route = params['route'] || params['utm_content'];
      const language = params['language'] || params['lang'];
      const ref = params['ref'];

      // Store referrer data
      if (program) {
        await AsyncStorage.setItem('referrer_program', program);
      }

      if (route) {
        await AsyncStorage.setItem('referrer_route', route);
      }

      if (language) {
        await AsyncStorage.setItem('referrer_language', language);
      }

      if (ref) {
        await AsyncStorage.setItem('referrer_ref', ref);
      }

      await AsyncStorage.setItem('referrer_timestamp', Date.now().toString());

      const isLoggedIn = await isUserLoggedIn();

      // Redirect new users through welcome first; returning guests go to signup
      if ((route === 'signup' || route === '/signup') && !isLoggedIn) {
        const webViewUrl = await resolveSignupDestination(WEB_URL, {
          program: program || undefined,
          language: language || undefined,
          ref: ref || undefined,
        });

        return {hasReferrer: true, url: webViewUrl};
      }

      if (route && !isLoggedIn && shouldStashPendingPostLogin(route)) {
        const destination = handleRouteUrl(route, WEB_URL, {
          ...(program ? {program} : {}),
          ...(language ? {language} : {}),
          ...(ref ? {ref} : {}),
        });
        console.log(
          '[PendingPostLogin] installReferrer stash route=',
          route,
          '→',
          destination,
        );
        await storePendingPostLoginUrl(destination);
        return {hasReferrer: true, url: WEB_URL};
      }
    }

    return {hasReferrer: false};
  } catch (error) {
    console.error('❌ Error getting install referrer:', error);
    return {hasReferrer: false};
  }
};

// Handle deep links
export const handleDeepLink = (url: string, WEB_URL: string): string | null => {
  console.log('[DeepLink] handleDeepLink in=', url, 'WEB_URL=', WEB_URL);
  if (!url) return null;

  try {
    let path: string;
    let queryParams: Record<string, string> = {};

    if (url.startsWith('mynarnapp://')) {
      const urlWithoutScheme = url.replace('mynarnapp://', '');
      const [pathPart, queryPart] = urlWithoutScheme.split('?');
      path = pathPart;

      if (queryPart) {
        queryParams = parseQueryString(queryPart);
      }
    } else {
      let pathname = url;

      if (url.startsWith('http://') || url.startsWith('https://')) {
        // Check if it's any of our supported domains
        if (
          url.includes(WEB_HOST) ||
          url.includes('localhost') ||
          url.includes(
            'mynafe-git-feature-languagesuppo-df59ca-enroot-mumbais-projects.vercel.app',
          )
        ) {
          const urlWithoutScheme = url.replace(/^https?:\/\//, '');
          const pathStartIndex = urlWithoutScheme.indexOf('/');
          const pathAndQuery =
            pathStartIndex !== -1
              ? urlWithoutScheme.substring(pathStartIndex)
              : '/';
          const queryIndex = pathAndQuery.indexOf('?');
          pathname =
            queryIndex !== -1
              ? pathAndQuery.substring(0, queryIndex)
              : pathAndQuery;
          if (queryIndex !== -1) {
            queryParams = parseQueryString(
              pathAndQuery.substring(queryIndex + 1),
            );
          }
        } else {
          const domainEndIndex = url.indexOf('/', url.indexOf('//') + 2);
          if (domainEndIndex !== -1) {
            pathname = url.substring(domainEndIndex);
          } else {
            pathname = '/';
          }
        }
      }

      const [pathPart, queryPart] = pathname.split('?');
      path = pathPart;

      if (queryPart && Object.keys(queryParams).length === 0) {
        queryParams = parseQueryString(queryPart);
      }
    }

    console.log(
      '[DeepLink] handleDeepLink parsed path=',
      path,
      'params=',
      queryParams,
    );

    // Handle various paths
    if (path === 'signup' || path === '/signup') {
      const language = queryParams['language'] || queryParams['lang'];
      const signupUrl = buildSignupUrl(WEB_URL, {
        program: queryParams['program'],
        language,
        ref: queryParams['ref'],
      });
      console.log('[DeepLink] handleDeepLink signup →', signupUrl);
      return signupUrl;
    }

    // Handle other web paths (like /learn/physical-health, /dashboard, etc.)
    if (path && path !== '/' && path !== '') {
      const routeUrl = handleRouteUrl(path, WEB_URL, queryParams);
      console.log('[DeepLink] handleDeepLink route →', routeUrl);
      return routeUrl;
    }

    // If no specific path, return the base URL
    if (path === '/' || path === '') {
      console.log('[DeepLink] handleDeepLink root →', WEB_URL);
      return WEB_URL;
    }

    console.log('[DeepLink] handleDeepLink unmatched → null');
    return null;
  } catch (error) {
    console.error('[DeepLink] handleDeepLink error', error);
    return null;
  }
};

// Handle route URLs (like /learn/physical-health, /dashboard, etc.)
export const handleRouteUrl = (
  route: string,
  WEB_URL: string,
  queryParams: Record<string, string> = {},
): string => {
  if (!route || route === '/' || route === '') {
    return WEB_URL;
  }

  // Ensure route starts with /
  const cleanRoute = route.startsWith('/') ? route : `/${route}`;
  let webViewUrl = `${WEB_URL}${cleanRoute}`;

  // Add any query parameters
  if (Object.keys(queryParams).length > 0) {
    const pairs = Object.entries(queryParams).map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    );
    webViewUrl += `?${pairs.join('&')}`;
  }

  return webViewUrl;
};

// Store notification URL for later use
export const storeNotificationUrl = async (url: string): Promise<void> => {
  try {
    await AsyncStorage.setItem('pending_notification_url', url);
    await AsyncStorage.setItem('notification_timestamp', Date.now().toString());
  } catch (error) {
    console.error('❌ Error storing notification URL:', error);
  }
};

// Get stored notification URL
export const getStoredNotificationUrl = async (): Promise<string | null> => {
  try {
    const url = await AsyncStorage.getItem('pending_notification_url');
    const timestamp = await AsyncStorage.getItem('notification_timestamp');

    if (url && timestamp) {
      const urlAge = Date.now() - parseInt(timestamp);
      const oneHourInMs = 60 * 60 * 1000; // 1 hour

      if (urlAge < oneHourInMs) {
        // Clean up old notification data
        await AsyncStorage.removeItem('pending_notification_url');
        await AsyncStorage.removeItem('notification_timestamp');
        return url;
      } else {
        // Clean up expired notification data
        await AsyncStorage.removeItem('pending_notification_url');
        await AsyncStorage.removeItem('notification_timestamp');
      }
    }

    return null;
  } catch (error) {
    console.error('❌ Error getting stored notification URL:', error);
    return null;
  }
};

// Clear stored notification URL
export const clearStoredNotificationUrl = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('pending_notification_url');
    await AsyncStorage.removeItem('notification_timestamp');
  } catch (error) {
    console.error('❌ Error clearing stored notification URL:', error);
  }
};

// Clear all referrer data (call this after successful signup)
export const clearReferrerData = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('referrer_program');
    await AsyncStorage.removeItem('referrer_route');
    await AsyncStorage.removeItem('referrer_language');
    await AsyncStorage.removeItem('referrer_ref');
    await AsyncStorage.removeItem('referrer_timestamp');
    console.log('✅ Referrer data cleared after successful signup');
  } catch (error) {
    console.error('❌ Error clearing referrer data:', error);
  }
};

// Resolve deep link URL with welcome-first flow for new users.
// Pass isLoggedIn when caller already knows (e.g. warm start via isLoggedInRef) —
// AsyncStorage token may lag behind WebView session.
export const resolveDeepLinkUrl = async (
  url: string,
  WEB_URL: string,
  options?: {isLoggedIn?: boolean},
): Promise<string | null> => {
  console.log(
    '[PendingPostLogin] resolveDeepLinkUrl input=',
    url,
    'opts=',
    options,
  );
  const resolvedUrl = handleDeepLink(url, WEB_URL);
  if (!resolvedUrl) {
    console.log('[PendingPostLogin] handleDeepLink → null');
    return null;
  }
  console.log('[PendingPostLogin] handleDeepLink →', resolvedUrl);

  if (resolvedUrl.includes('/signup')) {
    try {
      const queryIndex = resolvedUrl.indexOf('?');
      const queryPart =
        queryIndex !== -1 ? resolvedUrl.substring(queryIndex + 1) : '';
      const queryParams = parseQueryString(queryPart);
      await storeReferrerParams({
        program: queryParams.program || undefined,
        route: 'signup',
        language: queryParams.language || undefined,
        ref: queryParams.ref || undefined,
      });

      const signupDest = await resolveSignupDestination(WEB_URL, {
        program: queryParams.program || undefined,
        language: queryParams.language || undefined,
        ref: queryParams.ref || undefined,
      });
      console.log('[PendingPostLogin] signup branch →', signupDest);
      return signupDest;
    } catch (error) {
      console.error('❌ Error resolving signup deep link:', error);
    }
  }

  try {
    const path = extractPathFromWebUrl(resolvedUrl);
    const loggedIn =
      options?.isLoggedIn !== undefined
        ? options.isLoggedIn
        : await isUserLoggedIn();
    const stash = shouldStashPendingPostLogin(path);
    console.log(
      '[PendingPostLogin] path=',
      path,
      'loggedIn=',
      loggedIn,
      'stash=',
      stash,
      'public=',
      isPublicPath(path),
      'override=',
      options?.isLoggedIn,
    );
    if (!loggedIn && stash) {
      await storePendingPostLoginUrl(resolvedUrl);
      console.log('[PendingPostLogin] stash+login → return WEB_URL');
      return WEB_URL;
    }
    // Logged-in (or public) open — drop stale pending so LOG_IN echo can't hijack
    if (loggedIn) {
      await clearPendingPostLoginUrl();
    }
  } catch (error) {
    console.error('[PendingPostLogin] stash error:', error);
  }

  console.log('[PendingPostLogin] passthrough →', resolvedUrl);
  return resolvedUrl;
};

// Get initial app URL for first-time users without referral data
export const getInitialAppUrl = async (WEB_URL: string): Promise<string> => {
  const isLoggedIn = await isUserLoggedIn();
  const firstLaunch = await isFirstLaunch();

  if (!isLoggedIn && firstLaunch) {
    return getWelcomeUrl(WEB_URL);
  }

  return WEB_URL;
};

// Check for pending notification URL (highest priority)
export const checkPendingNotification = async (
  WEB_URL: string,
): Promise<{hasNotification: boolean; url?: string}> => {
  try {
    const notificationUrl = await getStoredNotificationUrl();
    if (notificationUrl) {
      // Clear the stored notification URL since we're using it
      await clearStoredNotificationUrl();

      // Handle the notification URL as a deep link
      const deepLinkUrl = await resolveDeepLinkUrl(notificationUrl, WEB_URL);
      if (deepLinkUrl) {
        return {hasNotification: true, url: deepLinkUrl};
      }

      // If it's a full URL, check if it's our domain
      if (notificationUrl.startsWith('http')) {
        if (
          notificationUrl.includes(WEB_HOST) ||
          notificationUrl.includes('localhost')
        ) {
          return {hasNotification: true, url: notificationUrl};
        } else {
          // External URL, open in external browser
          const {Linking} = require('react-native');
          Linking.openURL(notificationUrl);
          return {hasNotification: false};
        }
      }

      // Default: treat as route and append to base URL
      const fullUrl = notificationUrl.startsWith('/')
        ? `${WEB_URL}${notificationUrl}`
        : `${WEB_URL}/${notificationUrl}`;
      return {hasNotification: true, url: fullUrl};
    }

    return {hasNotification: false};
  } catch (error) {
    console.error('❌ Error checking pending notification:', error);
    return {hasNotification: false};
  }
};
