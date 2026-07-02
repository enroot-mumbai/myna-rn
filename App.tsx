import messaging from '@react-native-firebase/messaging';
import axios from 'axios';
import * as React from 'react';
import {useEffect, useState, useRef} from 'react';
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
import {
  SafeAreaProvider as SafeAreaContextProvider,
  initialWindowMetrics,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {Provider} from 'react-redux';
import {SimpleLoader} from './src/components/Loader';
import SafeAreaProvider from './src/components/SafeAreaProvider';
import {useAppDispatch} from './src/context/redux/hooks';
import {removeToken, saveToken} from './src/context/redux/slice/app';
import crashlytics from '@react-native-firebase/crashlytics';
import store from './src/context/redux/store';
import { WEB_URL, WEB_HOST } from './src/utils/config';
import {
  checkStoredReferrer,
  checkInstallReferrer,
  handleDeepLink,
  resolveDeepLinkUrl,
  getInitialAppUrl,
  getStoredProgram,
  storeNotificationUrl,
  getStoredNotificationUrl,
  clearStoredNotificationUrl,
  checkPendingNotification,
  clearReferrerData,
  markAppAsLaunched,
} from './src/utils/DeepLinkHandler';

const {InstallReferrer} = NativeModules;

const API_URL = 'https://myna-prod.enrootmumbai.in';
// const API_URL = 'https://myna-stg.enrootmumbai.in';

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
      <SafeAreaContextProvider initialMetrics={initialWindowMetrics}>
        <App />
      </SafeAreaContextProvider>
    </Provider>
  );
};

const App = () => {
  const webRef = useRef<WebView>(null);
  const insets = useSafeAreaInsets();
  //   console.log("WEB_URL", WEB_URL);
  const [initialUrl, setInitialUrl] = useState(WEB_URL);

  const dispatch = useAppDispatch();
  const [tokenState, setTokenState] = useState('');
  const [fcmTokenState, setFCMTokenState] = useState('');
  const [channelId, setChannelId] = useState(
    'fcm_fallback_notification_channel',
  );
  const [userInteraction, setUserInteraction] = useState(false);
  const [isWebViewReady, setIsWebViewReady] = useState(false);
  const [pendingNotificationUrl, setPendingNotificationUrl] = useState<string | null>(null);

  const navigateWebView = (url: string) => {
    if (webRef?.current && isWebViewReady) {
      webRef?.current?.injectJavaScript(`
        window.location.href = '${url}';
      `);
    } else {
      setPendingNotificationUrl(url);
    }
  };

  // Function to handle notification URLs
  const handleNotificationUrl = async (url: string | null) => {
    if (!url) return;
    
    // Store the notification URL for persistence
    await storeNotificationUrl(url);
    
    // If it's a route URL (like /learn/physical-health), handle it as a deep link
    if (url.startsWith('/') || !url.startsWith('http')) {
      const deepLinkUrl = handleDeepLink(url, WEB_URL);
      if (deepLinkUrl) {
        navigateWebView(deepLinkUrl);
        return;
      }
    }
    
    // If it's a full URL, check if it's our domain
    if (url.startsWith('http')) {
      if (url.includes(WEB_HOST) || url.includes('localhost')) {
        // It's our domain, navigate to it
        navigateWebView(url);
        return;
      } else {
        // External URL, open in external browser
        Linking.openURL(url);
        return;
      }
    }
    
    // Default: treat as route and append to base URL
    const fullUrl = url.startsWith('/') ? `${WEB_URL}${url}` : `${WEB_URL}/${url}`;
    navigateWebView(fullUrl);
  };

  // Helper function to extract URL from notification data
  const extractNotificationUrl = (notification: any): string | null => {
    if (typeof notification?.data?.url === 'string') {
      return notification.data.url;
    }
    if (typeof (notification as any)?.userInfo?.url === 'string') {
      return (notification as any).userInfo.url;
    }
    return null;
  };

  PushNotification.configure({
    // (optional) Called when Token is generated (iOS and Android)
    onRegister: function (_token) {},

    // (required) Called when a remote is received or opened, or local notification is opened
    onNotification: function (notification) {
      setUserInteraction(notification.userInteraction);
      if (notification.userInteraction) {
        const url = extractNotificationUrl(notification);
        if (url) {
          handleNotificationUrl(url);
        }
      }
    },
    onAction: function (notification) {
      // no-op
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

      

      switch (data?.type) {
        case 'LOG_IN':
          if (!isTokenAvailable) {
            dispatch(removeToken());
            setTokenState('');
            setFCMTokenState('');
            return;
          }
          

          // Make sure we're setting a string value to the state
          const token = data?.payload?.token || '';
          setTokenState(token);
          dispatch(saveToken(token));
          
          // Clear any stored notification URLs after successful login
          await clearStoredNotificationUrl();
          return;
        case 'LOG_OUT':
          setTokenState('');
          setFCMTokenState('');
          return dispatch(removeToken());

        case 'GET_STORED_PROGRAM':
          const storedProgramData = await getStoredProgram();
          webRef?.current?.postMessage(
            JSON.stringify({
              type: 'STORED_PROGRAM_RESPONSE',
              payload: storedProgramData,
            }),
          );
          return;

        case 'SHARE_REFERRAL':
          const {shareMessage, signupUrl} = data.payload || {};
          if (shareMessage && signupUrl) {
            try {
              await Share.share(
                {
                  message: shareMessage,
                  url: signupUrl,
                  title: 'Share Myna App',
                },
                {
                  dialogTitle: 'Share via',
                },
              );
            } catch (error) {
              crashlytics().recordError(error as Error);
            }
          }
          return;

        case 'CLEAR_REFERRER_DATA':
          // Clear referrer data after successful signup
          await clearReferrerData();
          return;

        case 'MARK_WELCOME_COMPLETE':
          await markAppAsLaunched();
          return;

        default:
          if (payload.nativeEvent.data.startsWith('share:')) {
            const param = JSON.parse(
              payload.nativeEvent.data.replace('share:', ''),
            );
            handleShareContent(param);
          }
      }
    } catch (e: any) {
      crashlytics().recordError(e);
    }
  };

  const handleShareContent = async (param: {
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
    
    // Add function to get stored program data
    window.getStoredProgram = function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'GET_STORED_PROGRAM'}));
    };
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
    } catch (error) {
      setFCMTokenState('');
    }
  };

  const createFCMToken = () => {
    // Request permission to receive notifications (optional)
    messaging().requestPermission();

    // Get the FCM token
    messaging()
      .getToken()
      .then(async token => {
        if (token) {
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
        // carry through URL so onNotification tap has access
        userInfo: {url: remoteMessage?.data?.url},
      });
    });

    // Listen for notifications when the app is in the background or terminated
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      

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
        userInfo: {url: remoteMessage?.data?.url},
      });
    });
  }, []);

  useEffect(() => {
    const notificationListener = async () => {
      await messaging().onNotificationOpenedApp(remoteMessage => {
        
        const openedUrl = remoteMessage?.data?.url;
        if (openedUrl && typeof openedUrl === 'string') {
          handleNotificationUrl(openedUrl);
        }
      });

      const initialNoti = await messaging().getInitialNotification();
      if (initialNoti) {
        const initialUrlFromNoti = initialNoti?.data?.url;
        if (initialUrlFromNoti && typeof initialUrlFromNoti === 'string') {
          // Store the notification URL to apply after WebView is ready
          setPendingNotificationUrl(initialUrlFromNoti);
        }
      }
    };
    notificationListener();
  }, []);

  // Apply pending notification URL when WebView is ready
  useEffect(() => {
    if (isWebViewReady && pendingNotificationUrl) {
      handleNotificationUrl(pendingNotificationUrl);
      setPendingNotificationUrl(null);
    }
  }, [isWebViewReady, pendingNotificationUrl]);

  // Check for stored notification URLs when WebView is ready
  useEffect(() => {
    if (isWebViewReady) {
      const checkStoredNotifications = async () => {
        const storedUrl = await getStoredNotificationUrl();
        if (storedUrl) {
          handleNotificationUrl(storedUrl);
        }
      };
      
      checkStoredNotifications();
    }
  }, [isWebViewReady]);

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

  useEffect(() => {
    const initializeApp = async () => {
      // Priority 1: Check for pending notification URLs (highest priority)
      const {hasNotification, url: notificationUrl} = await checkPendingNotification(WEB_URL);
      if (hasNotification && notificationUrl) {
        setInitialUrl(notificationUrl);
        return;
      }

      // Priority 2: Check for deep links
      try {
        const url = await Linking.getInitialURL();
        if (url) {
          const deepLinkUrl = await resolveDeepLinkUrl(url, WEB_URL);
          if (deepLinkUrl) {
            setInitialUrl(deepLinkUrl);
            return;
          }
        }
      } catch (error) {
        console.error('❌ Error initializing deep links:', error);
      }

      // Priority 3: Check stored referrer (only if no notification or deep link)
      const {hasStoredReferrer, url: storedUrl} = await checkStoredReferrer(WEB_URL);
      if (hasStoredReferrer && storedUrl) {
        setInitialUrl(storedUrl);
        return;
      }

      // Priority 4: Check install referrer (lowest priority)
      try {
        const {hasReferrer, url: referrerUrl} = await checkInstallReferrer(
          WEB_URL,
          InstallReferrer,
        );
        if (hasReferrer && referrerUrl) {
          setInitialUrl(referrerUrl);
          return;
        }
      } catch (error) {
        console.error('❌ Error checking install referrer:', error);
      }

      // Priority 5: First-time users without referral data see welcome
      const initialAppUrl = await getInitialAppUrl(WEB_URL);
      setInitialUrl(initialAppUrl);

      // Set up URL event listener
      const subscription = Linking.addEventListener('url', async ({url}) => {
        const deepLinkUrl = await resolveDeepLinkUrl(url, WEB_URL);
        if (deepLinkUrl) {
          setInitialUrl(deepLinkUrl);
        }
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

  const injectSafeAreaInsets = () => {
    webRef?.current?.injectJavaScript(`
      (function() {
        var root = document.documentElement;
        root.style.setProperty('--safe-area-inset-top', '${insets.top}px');
        root.style.setProperty('--safe-area-inset-bottom', '${insets.bottom}px');
        root.setAttribute('data-native-app', 'true');
      })();
      true;
    `);
  };

  useEffect(() => {
    if (isWebViewReady) {
      injectSafeAreaInsets();
    }
  }, [isWebViewReady, insets.top, insets.bottom]);

  useEffect(() => {
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
          style={{flex: 1}}
          allowsBackForwardNavigationGestures={true}
          injectedJavaScriptBeforeContentLoaded={INJECTED_JAVASCRIPT}
          javaScriptEnabled={true}
          onMessage={onMessage}
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
          onLoad={() => {
            setIsWebViewReady(true);
            injectSafeAreaInsets();
          }}
        />
      </>
    </SafeAreaProvider>
  );
};
export default ProviderApp;
