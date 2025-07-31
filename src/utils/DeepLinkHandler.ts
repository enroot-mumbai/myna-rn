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

    if (storedProgram && storedRoute && storedTimestamp) {
      const referrerAge = Date.now() - parseInt(storedTimestamp);
      const ninetyDaysInMs = 90 * 24 * 60 * 60 * 1000;

      if (referrerAge < ninetyDaysInMs) {
        // Check if user is logged in and if this is first launch
        const isLoggedIn = await isUserLoggedIn();
        const firstLaunch = await isFirstLaunch();

        // Only redirect to signup if it's first launch or user is not logged in
        if ((storedRoute === 'signup' || storedRoute === '/signup') && (!isLoggedIn || firstLaunch)) {
          let webViewUrl = `${WEB_URL}/signup?program=${encodeURIComponent(storedProgram)}`;
          webViewUrl = buildUrlWithLanguage(webViewUrl, storedLanguage || undefined);
          
          // Add ref parameter if stored
          if (storedRef) {
            const separator = webViewUrl.includes('?') ? '&' : '?';
            webViewUrl += `${separator}ref=${encodeURIComponent(storedRef)}`;
          }
          
          // Mark app as launched after first signup redirect
          if (firstLaunch) {
            await markAppAsLaunched();
          }
          
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

    if (storedProgram && storedTimestamp) {
      const referrerAge = Date.now() - parseInt(storedTimestamp);
      const ninetyDaysInMs = 90 * 24 * 60 * 60 * 1000;

      if (referrerAge < ninetyDaysInMs) {
        return {
          program: storedProgram, 
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

      // Check if user is logged in and if this is first launch
      const isLoggedIn = await isUserLoggedIn();
      const firstLaunch = await isFirstLaunch();

      // Only redirect to signup if it's first launch or user is not logged in
      if (program && (route === 'signup' || route === '/signup') && (!isLoggedIn || firstLaunch)) {
        let webViewUrl = `${WEB_URL}/signup?program=${encodeURIComponent(program)}`;
        webViewUrl = buildUrlWithLanguage(webViewUrl, language);
        
        // Add ref parameter if present
        if (ref) {
          const separator = webViewUrl.includes('?') ? '&' : '?';
          webViewUrl += `${separator}ref=${encodeURIComponent(ref)}`;
        }
        
        // Mark app as launched after first signup redirect
        if (firstLaunch) {
          await markAppAsLaunched();
        }
        
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
          if (url.includes('mynafe.vercel.app') || 
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
      let webViewUrl = `${WEB_URL}/signup`;
      
      // Add program parameter if present
      if (queryParams['program']) {
        webViewUrl += `?program=${encodeURIComponent(queryParams['program'])}`;
      }
      
      // Add language parameter if present
      if (queryParams['language'] || queryParams['lang']) {
        const language = queryParams['language'] || queryParams['lang'];
        webViewUrl = buildUrlWithLanguage(webViewUrl, language);
      }
      
      // Add ref parameter if present
      if (queryParams['ref']) {
        const separator = webViewUrl.includes('?') ? '&' : '?';
        webViewUrl += `${separator}ref=${encodeURIComponent(queryParams['ref'])}`;
      }
      
      return webViewUrl;
    }

    // Handle other web paths (like /learn/physical-health)
    if (path && path !== '/' && path !== '') {
      let webViewUrl = `${WEB_URL}${path.startsWith('/') ? path : '/' + path}`;
      
      // Add any query parameters
      const params = new URLSearchParams();
      Object.entries(queryParams).forEach(([key, value]) => {
        params.append(key, value);
      });
      
      if (params.toString()) {
        webViewUrl += `?${params.toString()}`;
      }
      
      return webViewUrl;
    }

    return null;
  } catch (error) {
    console.error('❌ Error handling deep link:', error);
    return null;
  }
};
