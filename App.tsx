import messaging from '@react-native-firebase/messaging';
import axios from 'axios';
import React, {useEffect, useState} from 'react';
import {
  Alert,
  BackHandler,
  Platform,
  PermissionsAndroid,
  Share,
  Linking,
  NativeModules,
} from 'react-native';
import PushNotification, {Importance} from 'react-native-push-notification';
import WebView, {WebViewMessageEvent} from 'react-native-webview';
import {Provider} from 'react-redux';
import {SimpleLoader} from './src/components/Loader';
import SafeAreaProvider from './src/components/SafeAreaProvider';
import {useAppDispatch} from './src/context/redux/hooks';
import {removeToken, saveToken} from './src/context/redux/slice/app';
import crashlytics from '@react-native-firebase/crashlytics';
import store from './src/context/redux/store';
import {PlayInstallReferrer} from 'react-native-play-install-referrer';

// import AsyncStorage from '@react-native-async-storage/async-storage';
// const {InstallReferrer} = NativeModules;

const API_URL = 'https://myna-prod.enrootmumbai.in';
// const WEB_URL = 'https://mynafe-git-fix-pdf-enroot-mumbais-projects.vercel.app';
// const WEB_URL = 'https://mynafe.vercel.app';
// const API_URL = 'http://localhost:3001';
const WEB_URL =
  'https://mynafe-enroot-mumbai-enroot-mumbais-projects.vercel.app';

export interface onMessagePayload {
  type?: string;
  payload?: {
    token?: string;
    [key: string]: any;
  };
}

const ProviderApp = () => {
  return (
    <Provider store={store}>
      <App />
    </Provider>
  );
};

const App = () => {
  const webRef = React.useRef<WebView>(null);
  //   console.log("WEB_URL", WEB_URL);
  const [initialUrl, setInitialUrl] = useState(WEB_URL);

  const dispatch = useAppDispatch();
  const [tokenState, setTokenState] = useState('');
  const [fcmTokenState, setFCMTokenState] = useState('');
  const [channelId, setChannelId] = useState(
    'fcm_fallback_notification_channel',
  );
  const [userInteraction, setUserInteraction] = useState(false);

  useEffect(() => {
    PlayInstallReferrer.getInstallReferrerInfo(
      (installReferrerInfo: any, error) => {
        if (!error) {
          console.log(
            'Install referrer = ' + installReferrerInfo.installReferrer,
          );
          console.log(
            'Referrer click timestamp seconds = ' +
              installReferrerInfo.referrerClickTimestampSeconds,
          );
          console.log(
            'Install begin timestamp seconds = ' +
              installReferrerInfo.installBeginTimestampSeconds,
          );
          console.log(
            'Referrer click timestamp server seconds = ' +
              installReferrerInfo.referrerClickTimestampServerSeconds,
          );
          console.log(
            'Install begin timestamp server seconds = ' +
              installReferrerInfo.installBeginTimestampServerSeconds,
          );
          console.log(
            'Install version = ' + installReferrerInfo.installVersion,
          );
          console.log(
            'Google Play instant = ' + installReferrerInfo.googlePlayInstant,
          );
        } else {
          console.log('Failed to get install referrer info!');
          console.log('Response code: ' + error.responseCode);
          console.log('Message: ' + error.message);
        }
      },
    );
  }, []);

  PushNotification.configure({
    // (optional) Called when Token is generated (iOS and Android)
    onRegister: function (token) {
      console.log('TOKEN:', token);
    },

    // (required) Called when a remote is received or opened, or local notification is opened
    onNotification: function (notification) {
      console.log('NOTIFICATION:', notification);
      setUserInteraction(notification.userInteraction);
      if (notification.userInteraction) {
        const url = notification.data?.url;
        if (url) {
          webRef?.current?.injectJavaScript(`
          window.location.href = '${url}';
        `);
        }
      }
    },
    onAction: function (notification) {
      console.log('ACTION:', notification.action);
      console.log('NOTIFICATION:', notification);
    },
    onRegistrationError: function (err) {
      console.error(err.message, err);
    },
    permissions: {
      alert: true,
      badge: true,
      sound: true,
    },
    popInitialNotification: true,
    requestPermissions: true,
  });

  const onMessage = async (payload: WebViewMessageEvent) => {
    try {
      const data: onMessagePayload = JSON.parse(payload.nativeEvent.data);
      const isTokenAvailable =
        data?.payload?.token !== '' &&
        data?.payload?.token !== null &&
        data?.payload?.token !== undefined;

      console.log('data', data);

      switch (data?.type) {
        case 'LOG_IN':
          if (!isTokenAvailable) {
            dispatch(removeToken());
            setTokenState('');
            setFCMTokenState('');
            return;
          }
          console.log('data?.payload?.token', data?.payload?.token);

          // Make sure we're setting a string value to the state
          const token = data?.payload?.token || '';
          setTokenState(token);
          return dispatch(saveToken(token));
        case 'LOG_OUT':
          setTokenState('');
          setFCMTokenState('');
          return dispatch(removeToken());

        default:
          if (payload.nativeEvent.data.startsWith('share:')) {
            const param = JSON.parse(
              payload.nativeEvent.data.replace('share:', ''),
            );
            handleShare(param);
          }
      }
    } catch (e: any) {
      console.log(e);
      crashlytics().recordError(e);
    }
  };

  const handleShare = async (param: {
    title?: string;
    text?: string;
    url?: string;
  }) => {
    try {
      // Make sure url is not undefined for Share.share
      const shareParams = {
        ...param,
        url: param.url || '', // Provide default empty string if url is undefined
      };
      await Share.share(shareParams);
    } catch (error) {
      Alert.alert('Error', 'An error occurred while sharing');
    }
  };

  const INJECTED_JAVASCRIPT = `(function(message) {
    const tokenLocalStorage = window.localStorage.getItem('token');
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'LOG_IN',payload:{token:tokenLocalStorage}}));
  })();`;

  const onAndroidBackPress = () => {
    if (webRef?.current) {
      webRef?.current?.goBack();
      return true; // prevent default behavior (exit app)
    }
    return false;
  };

  // updates the FCM token in the user profile
  const updateUserProfile = async (token: string): Promise<void> => {
    try {
      console.log('token', token);
      const res = await axios.put(
        `${API_URL}/user/update`,
        {deviceToken: token},
        {
          headers: {
            Authorization: tokenState,
          },
        },
      );
      setFCMTokenState(token || '');
      console.log('token', token);
    } catch (error) {
      setFCMTokenState('');
      console.log('error', error);
    }
  };

  //  creates an FCM token used to send notification to the app and stores it in the user profile
  const createFCMToken = () => {
    // Request permission to receive notifications (optional)
    messaging().requestPermission();

    // Get the FCM token
    messaging()
      .getToken()
      .then(async token => {
        if (token) {
          console.log('FCM Token:', token);
          updateUserProfile(token);
        } else {
          console.log('No FCM token available');
        }
      })
      .catch(error => {
        console.log('Error getting FCM token:', error);
        crashlytics().log('Error getting FCM token:');
        crashlytics().recordError(error);
      });
  };

  const createChannel = () => {
    PushNotification.createChannel(
      {
        channelId: 'channel_1', // (required)
        channelName: 'My channel', // (required)
        channelDescription: 'A channel to categorise your notifications', // (optional) default: undefined.
        playSound: false, // (optional) default: true
        soundName: 'default', // (optional) See `soundName` parameter of `localNotification` function
        importance: Importance.HIGH, // (optional) default: Importance.HIGH. Int value of the Android notification importance
        vibrate: true, // (optional) default: true. Creates the default vibration pattern if true.
      },
      () => {
        PushNotification.getChannels(channelIds => {
          console.log(channelIds);
          setChannelId(channelIds[0]);
        });
      },
    );
  };

  async function requestNotificationPermission() {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        console.log('Notification permission granted');
      } else {
        console.log('Notification permission denied');
      }
    } catch (err) {
      console.error(err);
    }
  }
  useEffect(() => {
    if (Platform.OS === 'android') {
      requestNotificationPermission();
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      BackHandler.addEventListener('hardwareBackPress', onAndroidBackPress);
      return () => {
        BackHandler.removeEventListener(
          'hardwareBackPress',
          onAndroidBackPress,
        );
      };
    }
  }, []);

  useEffect(() => {
    // Listen for foreground notifications
    messaging().onMessage(async remoteMessage => {
      console.log('A new foreground notification arrived:', remoteMessage);

      // Safely access notification properties with proper null checks
      const notificationTitle =
        remoteMessage?.notification?.title || 'New Notification';
      const notificationBody =
        remoteMessage?.notification?.body || 'You have a new notification';

      PushNotification.localNotification({
        channelId: channelId,
        id: Date.now().toString(),
        title: notificationTitle,
        message: notificationBody,
        playSound: true,
        soundName: 'default',
        importance: 'high',
        vibrate: true,
        vibration: 300,
        actions: ['yes', 'no'],
      });
    });

    // Listen for notifications when the app is in the background or terminated
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      console.log('A new background notification arrived:', remoteMessage);

      // Safely access notification properties with proper null checks
      const notificationTitle =
        remoteMessage?.notification?.title || 'New Notification';
      const notificationBody =
        remoteMessage?.notification?.body || 'You have a new notification';

      // Create a local notification
      PushNotification.localNotification({
        channelId: channelId,
        id: Date.now().toString(),
        title: notificationTitle,
        message: notificationBody,
        playSound: true,
        soundName: 'default',
        importance: 'high',
        vibrate: true,
        vibration: 300,
        actions: ['yes', 'no'],
      });
    });
  }, []);

  useEffect(() => {
    const notificationListener = async () => {
      await messaging().onNotificationOpenedApp(remoteMessage => {
        console.log(
          'Notification caused app to open from background state:',
          remoteMessage.data,
        );
      });

      const initialNoti = await messaging().getInitialNotification();
      if (initialNoti) {
        console.log(
          'Notification caused app to open from quit state:',
          initialNoti.data,
        );
      }
    };
    notificationListener();
  }, []);

  useEffect(() => {
    if (tokenState) {
      createChannel();
      createFCMToken();
    }
  }, [tokenState]);

  // crashlytics enabled
  useEffect(() => {
    crashlytics().setCrashlyticsCollectionEnabled(true);
  }, []);

  // Add this helper function at the top of your file, outside of any component
  const parseQueryString = (queryString: string): Record<string, string> => {
    console.log('Parsing query string:', queryString);

    const params: Record<string, string> = {};

    // Handle empty or undefined query string
    if (!queryString) {
      return params;
    }

    // Split the string on & to get key-value pairs
    const pairs = queryString.split('&');

    for (const pair of pairs) {
      // Split each pair on = to get key and value
      const [key, value] = pair.split('=');

      if (key && value) {
        // Decode both key and value
        const decodedKey = decodeURIComponent(key);
        const decodedValue = decodeURIComponent(value);

        console.log(`Parsed param: ${decodedKey} = ${decodedValue}`);

        params[decodedKey] = decodedValue;
      }
    }

    return params;
  };

  const handleDeepLink = async (url: string) => {
    if (!url) return;

    console.log('🔗 Deep link received:', url);

    try {
      // Handle both custom scheme and http/https URLs
      let path: string;
      let programParam: string | null = null;

      if (url.startsWith('mynarnapp://')) {
        console.log('🔗 Processing custom scheme URL');
        // Custom scheme
        const urlWithoutScheme = url.replace('mynarnapp://', '');
        const [pathPart, queryPart] = urlWithoutScheme.split('?');
        path = pathPart;

        // Extract program parameter if present
        if (queryPart) {
          const params = parseQueryString(queryPart);
          programParam = params['program'] || null;
          console.log('🔗 Custom scheme params:', params);
        }
      } else {
        console.log('🔗 Processing HTTP/HTTPS URL');
        // Standard http/https URL - manually parse it
        // Remove protocol and domain
        let pathname = url;

        // Remove protocol and domain for http/https URLs
        if (url.startsWith('http://') || url.startsWith('https://')) {
          // Find the first slash after the protocol and domain
          const domainEndIndex = url.indexOf('/', url.indexOf('//') + 2);
          if (domainEndIndex !== -1) {
            pathname = url.substring(domainEndIndex);
          } else {
            pathname = '/';
          }
        }

        // Split path and query
        const [pathPart, queryPart] = pathname.split('?');
        path = pathPart;

        // Parse query parameters
        if (queryPart) {
          const params = parseQueryString(queryPart);
          programParam = params['program'] || null;
          console.log('🔗 HTTP URL params:', params);
        }
      }

      console.log(
        '🔗 Parsed deep link - path:',
        path,
        'program:',
        programParam,
      );

      // Check if it's a signup link
      if (path === 'signup' || path === '/signup') {
        // Construct the WebView URL with program parameter
        const webViewUrl = programParam
          ? `${WEB_URL}/signup?program=${encodeURIComponent(programParam)}`
          : `${WEB_URL}/signup`;

        console.log('🔗 Setting WebView URL to:', webViewUrl);
        setInitialUrl(webViewUrl);
      } else {
        console.log('🔗 Not a signup path, ignoring');
      }
    } catch (error) {
      console.error('❌ Error handling deep link:', error);
      crashlytics().recordError(new Error(`Deep link parsing error: ${error}`));
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      console.log('🚀 Initializing deep links...');

      console.log('🚀 Checking for initial URL...');
      try {
        const url = await Linking.getInitialURL();
        if (url) {
          console.log('🚀 Initial URL found:', url);
          handleDeepLink(url);
        } else {
          console.log('🚀 No initial URL found');
        }
      } catch (error) {
        console.error('❌ Error initializing deep links:', error);
      }

      const subscription = Linking.addEventListener('url', ({url}) => {
        console.log('URL event received:', url);
        handleDeepLink(url);
      });

      return () => subscription.remove();
    };

    initializeApp();
  }, []);

  // Modify WebView props to handle navigation state changes
  const handleNavigationStateChange = (navState: any) => {
    // Check if URL is Play Store
    if (navState.url.includes('play.google.com')) {
      Linking.openURL(navState.url);
      return false; // Prevent WebView from loading Play Store
    }
    return true;
  };

  useEffect(() => {
    console.log('App initialized with WEB_URL:', WEB_URL);

    // Debug deep linking
    Linking.getInitialURL().then(url => {
      console.log('Initial URL:', url);
    });

    const subscription = Linking.addEventListener('url', ({url}) => {
      console.log('URL event received:', url);
    });

    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <>
        <WebView
          ref={webRef}
          source={{uri: initialUrl}}
          allowsBackForwardNavigationGestures={true}
          injectedJavaScriptBeforeContentLoaded={INJECTED_JAVASCRIPT}
          javaScriptEnabled={true}
          onMessage={onMessage}
          onNavigationStateChange={handleNavigationStateChange}
          cacheEnabled
          originWhitelist={['https://*', 'http://*', 'data:*']}
          allowsFullscreenVideo={true}
          onError={(error: any) => {
            console.log('error', error);
            Alert.alert('something went wrong', JSON.stringify(error));
            crashlytics().recordError(error);
          }}
          scalesPageToFit={true}
          startInLoadingState={true}
          renderLoading={() => <SimpleLoader />}
          onHttpError={syntheticEvent => {
            const {nativeEvent} = syntheticEvent;
            console.warn(
              'WebView HTTP Error',
              `URL: ${nativeEvent.url}, Status: ${nativeEvent.statusCode}`,
            );
          }}
          onLoadStart={syntheticEvent => {
            const {nativeEvent} = syntheticEvent;
            console.log('Loading URL:', nativeEvent.url);
          }}
        />
      </>
    </SafeAreaProvider>
  );
};
export default ProviderApp;
