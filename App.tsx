import messaging from '@react-native-firebase/messaging';
import axios from 'axios';
import * as React from 'react';
import {useEffect, useState, useRef, useMemo} from 'react';
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
import BootSplash from 'react-native-bootsplash';
import WebView, {WebViewMessageEvent} from 'react-native-webview';
import {Provider} from 'react-redux';
import {SimpleLoader} from './src/components/Loader';
import SafeAreaProvider from './src/components/SafeAreaProvider';
import {useAppDispatch} from './src/context/redux/hooks';
import {removeToken, saveToken} from './src/context/redux/slice/app';
import crashlytics from '@react-native-firebase/crashlytics';
import store from './src/context/redux/store';
import {
  checkStoredReferrer,
  checkInstallReferrer,
  handleDeepLink,
  getStoredProgram,
} from './src/utils/DeepLinkHandler';
import AsyncStorage from '@react-native-async-storage/async-storage';

const {InstallReferrer} = NativeModules;

const API_URL = 'https://myna-stg.enrootmumbai.in';
const WEB_URL = 'https://test-mynafe.vercel.app';

const SYNC_TOKEN_JS = `
(function() {
  try {
    var token = window.localStorage.getItem('token');
    if (token) {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'LOG_IN',payload:{token:token}}));
    }
  } catch (e) {}
})();
true;
`;

const INJECTED_JAVASCRIPT = `(function() {
  window.getStoredProgram = function() {
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'GET_STORED_PROGRAM'}));
  };
})();`;

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
  const webRef = useRef<WebView>(null);
  const bootSplashHidden = useRef(false);
  //   console.log("WEB_URL", WEB_URL);
  const [initialUrl, setInitialUrl] = useState(WEB_URL);
  const webViewSource = useMemo(() => ({uri: initialUrl}), [initialUrl]);

  const dispatch = useAppDispatch();
  const [tokenState, setTokenState] = useState('');
  const [fcmTokenState, setFCMTokenState] = useState('');

  // Load token from AsyncStorage on startup
  useEffect(() => {
    const loadSavedToken = async () => {
      try {
        const savedToken = await AsyncStorage.getItem('token');
        if (savedToken) {
          setTokenState(savedToken);
          dispatch(saveToken(savedToken));
        }
      } catch (error) {
        console.error('❌ Error loading saved token:', error);
      }
    };
    loadSavedToken();
  }, []);

  const injectedJs = useMemo(() => {
    let js = INJECTED_JAVASCRIPT;
    if (tokenState) {
      js = `
        (function() {
          try {
            window.localStorage.setItem('token', '${tokenState}');
          } catch (e) {}
        })();
        ${js}
      `;
    }
    return js;
  }, [tokenState]);
  const [channelId, setChannelId] = useState(
    'fcm_fallback_notification_channel',
  );
  const [userInteraction, setUserInteraction] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    PushNotification.configure({
      onRegister: function (token) {
        console.log('TOKEN:', token);
      },
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
  }, []);

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
            return;
          }
          console.log('data?.payload?.token', data?.payload?.token);

          // Make sure we're setting a string value to the state
          const token = data?.payload?.token || '';
          if (token !== tokenState) {
            setTokenState(token);
            dispatch(saveToken(token));
            await AsyncStorage.setItem('token', token);
          }
          return;
        case 'LOG_OUT':
          setTokenState('');
          setFCMTokenState('');
          await AsyncStorage.removeItem('token');
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
              console.error('Error sharing referral: 123', error);
              crashlytics().recordError(error as Error);
            }
          }
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
      console.log(e);
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

  const createFCMToken = async () => {
    try {
      await messaging().requestPermission();

      if (
        Platform.OS === 'ios' &&
        !messaging().isDeviceRegisteredForRemoteMessages
      ) {
        await messaging().registerDeviceForRemoteMessages();
      }

      const token = await messaging().getToken();
      if (token) {
        console.log('FCM Token:', token);
        await updateUserProfile(token);
      } else {
        console.log('No FCM token available');
      }
    } catch (error) {
      console.log('Error getting FCM token:', error);
      crashlytics().log('Error getting FCM token:');
      crashlytics().recordError(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  };

  const createChannel = () => {
    if (Platform.OS !== 'android') {
      return;
    }

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

  useEffect(() => {
    const initializeApp = async () => {
      // Check stored referrer first
      const {hasStoredReferrer, url: storedUrl} = await checkStoredReferrer(
        WEB_URL,
      );
      if (hasStoredReferrer && storedUrl) {
        setInitialUrl(storedUrl);
        return;
      }

      // Check for deep links
      try {
        const url = await Linking.getInitialURL();
        if (url) {
          const deepLinkUrl = handleDeepLink(url, WEB_URL);
          if (deepLinkUrl) {
            setInitialUrl(deepLinkUrl);
          }
        } else {
          // Check install referrer if no deep link
          const {hasReferrer, url: referrerUrl} = await checkInstallReferrer(
            WEB_URL,
            InstallReferrer,
          );
          if (hasReferrer && referrerUrl) {
            setInitialUrl(referrerUrl);
          }
        }
      } catch (error) {
        console.error('❌ Error initializing deep links:', error);
      }

      // Set up URL event listener
      const subscription = Linking.addEventListener('url', ({url}) => {
        const deepLinkUrl = handleDeepLink(url, WEB_URL);
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

  useEffect(() => {
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
          source={webViewSource}
          onShouldStartLoadWithRequest={handleNavigationStateChange}
          allowsBackForwardNavigationGestures={true}
          injectedJavaScriptBeforeContentLoaded={injectedJs}
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
          onLoadEnd={() => {
            webRef.current?.injectJavaScript(SYNC_TOKEN_JS);
            if (bootSplashHidden.current) {
              return;
            }
            bootSplashHidden.current = true;
            BootSplash.hide({fade: true});
          }}
        />
      </>
    </SafeAreaProvider>
  );
};
export default ProviderApp;
