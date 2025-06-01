import AsyncStorage from '@react-native-async-storage/async-storage';

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

// Check for stored referrer data
export const checkStoredReferrer = async (
  WEB_URL: string,
): Promise<{hasStoredReferrer: boolean; url?: string}> => {
  try {
    const storedProgram = await AsyncStorage.getItem('referrer_program');
    const storedRoute = await AsyncStorage.getItem('referrer_route');
    const storedTimestamp = await AsyncStorage.getItem('referrer_timestamp');

    if (storedProgram && storedRoute && storedTimestamp) {
      const referrerAge = Date.now() - parseInt(storedTimestamp);
      const ninetyDaysInMs = 90 * 24 * 60 * 60 * 1000;

      if (referrerAge < ninetyDaysInMs) {
        if (storedRoute === 'signup' || storedRoute === '/signup') {
          const webViewUrl = `${WEB_URL}/signup?program=${encodeURIComponent(
            storedProgram,
          )}`;
          return {hasStoredReferrer: true, url: webViewUrl};
        }
      } else {
        await AsyncStorage.removeItem('referrer_program');
        await AsyncStorage.removeItem('referrer_route');
        await AsyncStorage.removeItem('referrer_timestamp');
      }
    }

    return {hasStoredReferrer: false};
  } catch (error) {
    console.error('❌ Error checking stored referrer:', error);
    return {hasStoredReferrer: false};
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

      if (program) {
        await AsyncStorage.setItem('referrer_program', program);
      }

      if (route) {
        await AsyncStorage.setItem('referrer_route', route);
      }

      await AsyncStorage.setItem('referrer_timestamp', Date.now().toString());

      if (program && (route === 'signup' || route === '/signup')) {
        const webViewUrl = `${WEB_URL}/signup?program=${encodeURIComponent(
          program,
        )}`;
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
    let programParam: string | null = null;

    if (url.startsWith('mynarnapp://')) {
      const urlWithoutScheme = url.replace('mynarnapp://', '');
      const [pathPart, queryPart] = urlWithoutScheme.split('?');
      path = pathPart;

      if (queryPart) {
        const params = parseQueryString(queryPart);
        programParam = params['program'] || null;
      }
    } else {
      let pathname = url;

      if (url.startsWith('http://') || url.startsWith('https://')) {
        const domainEndIndex = url.indexOf('/', url.indexOf('//') + 2);
        if (domainEndIndex !== -1) {
          pathname = url.substring(domainEndIndex);
        } else {
          pathname = '/';
        }
      }

      const [pathPart, queryPart] = pathname.split('?');
      path = pathPart;

      if (queryPart) {
        const params = parseQueryString(queryPart);
        programParam = params['program'] || null;
      }
    }

    if (path === 'signup' || path === '/signup') {
      return programParam
        ? `${WEB_URL}/signup?program=${encodeURIComponent(programParam)}`
        : `${WEB_URL}/signup`;
    }

    return null;
  } catch (error) {
    console.error('❌ Error handling deep link:', error);
    return null;
  }
};
