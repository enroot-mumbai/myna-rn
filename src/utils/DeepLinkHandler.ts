import AsyncStorage from '@react-native-async-storage/async-storage';
import { WEB_HOST } from './config';

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

// Check if user is logged in
export const isUserLoggedIn = async (): Promise<boolean> => {
  try {
    const token = await AsyncStorage.getItem('token');
    return token !== null && token !== '';
  } catch (error) {
    console.error('❌ Error checking login status:', error);
    return false;
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
export const getStoredProgram = async (): Promise<{program?: string; language?: string; ref?: string}> => {
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
          ref: storedRef || undefined
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
    }

    return {hasReferrer: false};
  } catch (error) {
    console.error('❌ Error getting install referrer:', error);
    return {hasReferrer: false};
  }
};

// Handle deep links
export const handleDeepLink = (url: string, WEB_URL: string): string | null => {
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
          if (url.includes(WEB_HOST) || 
              url.includes('localhost') || 
              url.includes('mynafe-git-feature-languagesuppo-df59ca-enroot-mumbais-projects.vercel.app')) {
            const urlObj = new URL(url);
            pathname = urlObj.pathname;
            // Parse query parameters from web URL
            for (const [key, value] of urlObj.searchParams.entries()) {
              queryParams[key] = value;
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

    // Handle various paths
    if (path === 'signup' || path === '/signup') {
      const language = queryParams['language'] || queryParams['lang'];
      return buildSignupUrl(WEB_URL, {
        program: queryParams['program'],
        language,
        ref: queryParams['ref'],
      });
    }

    // Handle other web paths (like /learn/physical-health, /dashboard, etc.)
    if (path && path !== '/' && path !== '') {
      return handleRouteUrl(path, WEB_URL, queryParams);
    }

    // If no specific path, return the base URL
    if (path === '/' || path === '') {
      return WEB_URL;
    }

    return null;
  } catch (error) {
    console.error('❌ Error handling deep link:', error);
    return null;
  }
};

// Handle route URLs (like /learn/physical-health, /dashboard, etc.)
export const handleRouteUrl = (route: string, WEB_URL: string, queryParams: Record<string, string> = {}): string => {
  if (!route || route === '/' || route === '') {
    return WEB_URL;
  }

  // Ensure route starts with /
  const cleanRoute = route.startsWith('/') ? route : `/${route}`;
  let webViewUrl = `${WEB_URL}${cleanRoute}`;
  
  // Add any query parameters
  if (Object.keys(queryParams).length > 0) {
    const params = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      params.append(key, value);
    });
    webViewUrl += `?${params.toString()}`;
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

// Resolve deep link URL with welcome-first flow for new users
export const resolveDeepLinkUrl = async (
  url: string,
  WEB_URL: string,
): Promise<string | null> => {
  const resolvedUrl = handleDeepLink(url, WEB_URL);
  if (!resolvedUrl) return null;

  if (resolvedUrl.includes('/signup')) {
    try {
      const urlObj = new URL(resolvedUrl);
      await storeReferrerParams({
        program: urlObj.searchParams.get('program') || undefined,
        route: 'signup',
        language: urlObj.searchParams.get('language') || undefined,
        ref: urlObj.searchParams.get('ref') || undefined,
      });

      return resolveSignupDestination(WEB_URL, {
        program: urlObj.searchParams.get('program') || undefined,
        language: urlObj.searchParams.get('language') || undefined,
        ref: urlObj.searchParams.get('ref') || undefined,
      });
    } catch (error) {
      console.error('❌ Error resolving signup deep link:', error);
    }
  }

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
        if (notificationUrl.includes(WEB_HOST) || notificationUrl.includes('localhost')) {
          return {hasNotification: true, url: notificationUrl};
        } else {
          // External URL, open in external browser
          const { Linking } = require('react-native');
          Linking.openURL(notificationUrl);
          return {hasNotification: false};
        }
      }
      
      // Default: treat as route and append to base URL
      const fullUrl = notificationUrl.startsWith('/') ? `${WEB_URL}${notificationUrl}` : `${WEB_URL}/${notificationUrl}`;
      return {hasNotification: true, url: fullUrl};
    }
    
    return {hasNotification: false};
  } catch (error) {
    console.error('❌ Error checking pending notification:', error);
    return {hasNotification: false};
  }
};