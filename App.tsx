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
import {WEB_URL, WEB_HOST} from './src/utils/config';
import {
  checkStoredReferrer,
  checkInstallReferrer,
  handleDeepLink,
  resolveDeepLinkUrl,
  getInitialAppUrl,
  getStoredProgram,
  storeNotificationUrl,
  clearStoredNotificationUrl,
  checkPendingNotification,
  clearReferrerData,
  markAppAsLaunched,
  getPendingPostLoginUrl,
  clearPendingPostLoginUrl,
} from './src/utils/DeepLinkHandler';
import {
  cancelNativeRecording,
  startNativeRecording,
  stopNativeRecording,
} from './src/utils/nativeAudioRecorder';

const {InstallReferrer} = NativeModules;

const API_URL = 'https://myna-prod.enrootmumbai.in';

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
  const [initialUrl, setInitialUrl] = useState(WEB_URL);

  const dispatch = useAppDispatch();
  const [tokenState, setTokenState] = useState('');
  const [channelId, setChannelId] = useState(
    'fcm_fallback_notification_channel',
  );
  const [isWebViewReady, setIsWebViewReady] = useState(false);
  const [pendingNotificationUrl, setPendingNotificationUrl] = useState<
    string | null
  >(null);
  const isLoggedInRef = useRef(false);
  const [webViewNavKey, setWebViewNavKey] = useState(0);

  const navigateWebView = (url: string) => {
    console.log('[PendingPostLogin] navigateWebView via source remount →', url);
    setIsWebViewReady(false);
    setInitialUrl(url);
    setWebViewNavKey(k => k + 1);
  };

  const postToWeb = (message: {
    type: string;
    payload?: Record<string, unknown>;
  }) => {
    webRef?.current?.postMessage(JSON.stringify(message));
  };

  const restorePendingPostLoginUrl = async (reason: string) => {
    const pendingUrl = await getPendingPostLoginUrl();
    if (!pendingUrl) {
      console.log(`[PendingPostLogin] ${reason} no pending → stay put`);
      return false;
    }
    console.log(`[PendingPostLogin] ${reason} restore →`, pendingUrl);
    await clearPendingPostLoginUrl();
    navigateWebView(pendingUrl);
    return true;
  };

  const handleNotificationUrl = async (url: string | null) => {
    if (!url) return;

    await storeNotificationUrl(url);

    if (url.startsWith('/') || !url.startsWith('http')) {
      const deepLinkUrl = handleDeepLink(url, WEB_URL);
      if (deepLinkUrl) {
        navigateWebView(deepLinkUrl);
        return;
      }
    }

    if (url.startsWith('http')) {
      if (url.includes(WEB_HOST) || url.includes('localhost')) {
        navigateWebView(url);
        return;
      }
      Linking.openURL(url);
      return;
    }

    const fullUrl = url.startsWith('/')
      ? `${WEB_URL}${url}`
      : `${WEB_URL}/${url}`;
    navigateWebView(fullUrl);
  };

  const extractNotificationUrl = (notification: any): string | null => {
    if (typeof notification?.data?.url === 'string') {
      return notification.data.url;
    }
    if (typeof notification?.userInfo?.url === 'string') {
      return notification.userInfo.url;
    }
    return null;
  };

  const onMessage = async (payload: WebViewMessageEvent) => {
    try {
      const data: onMessagePayload = JSON.parse(payload.nativeEvent.data);
      const isTokenAvailable =
        data?.payload?.token !== '' &&
        data?.payload?.token !== null &&
        data?.payload?.token !== undefined;

      switch (data?.type) {
        case 'LOG_IN':
          console.log(
            '[PendingPostLogin] LOG_IN tokenAvailable=',
            isTokenAvailable,
            'wasLoggedIn=',
            isLoggedInRef.current,
          );
          if (!isTokenAvailable) {
            isLoggedInRef.current = false;
            dispatch(removeToken());
            setTokenState('');
            console.log('[PendingPostLogin] LOG_IN empty token → skip restore');
            return;
          }

          const token = data?.payload?.token || '';
          const justLoggedIn = !isLoggedInRef.current;
          isLoggedInRef.current = true;
          setTokenState(token);
          dispatch(saveToken(token));

          await clearStoredNotificationUrl();

          if (!justLoggedIn) {
            console.log('[PendingPostLogin] LOG_IN echo → skip restore');
            return;
          }

          await restorePendingPostLoginUrl('LOG_IN');
          return;
        case 'LOG_OUT':
          isLoggedInRef.current = false;
          setTokenState('');
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
          // Web fires this after successful signup — restore deep-link destination
          await clearReferrerData();
          isLoggedInRef.current = true;
          await restorePendingPostLoginUrl('SIGNUP');
          return;

        case 'MARK_WELCOME_COMPLETE':
          await markAppAsLaunched();
          return;

        case 'START_NATIVE_RECORDING':
          try {
            await startNativeRecording();
            postToWeb({type: 'NATIVE_RECORDING_STARTED'});
          } catch (error: any) {
            postToWeb({
              type: 'NATIVE_RECORDING_ERROR',
              payload: {
                message:
                  error?.message ||
                  'Could not start recording. Please try again.',
              },
            });
          }
          return;

        case 'STOP_NATIVE_RECORDING':
          try {
            const recording = await stopNativeRecording();
            postToWeb({
              type: 'NATIVE_RECORDING_STOPPED',
              payload: recording,
            });
          } catch (error: any) {
            postToWeb({
              type: 'NATIVE_RECORDING_ERROR',
              payload: {
                message:
                  error?.message ||
                  'Could not save the recording. Please try again.',
              },
            });
          }
          return;

        case 'CANCEL_NATIVE_RECORDING':
          await cancelNativeRecording();
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
      await Share.share({
        ...param,
        url: param.url || '',
      });
    } catch (error) {
      Alert.alert('Error', 'An error occurred while sharing');
    }
  };

  const INJECTED_JAVASCRIPT = `(function() {
    const tokenLocalStorage = window.localStorage.getItem('token');
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'LOG_IN',payload:{token:tokenLocalStorage}}));

    window.getStoredProgram = function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'GET_STORED_PROGRAM'}));
    };

    if (!navigator.mediaDevices) {
      navigator.mediaDevices = {};
    }

    if (!navigator.mediaDevices.getUserMedia) {
      const legacyGetUserMedia =
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.getUserMedia;

      if (legacyGetUserMedia) {
        navigator.mediaDevices.getUserMedia = function(constraints) {
          return new Promise(function(resolve, reject) {
            legacyGetUserMedia.call(navigator, constraints, resolve, reject);
          });
        };
      }
    }
  })();`;

  const onAndroidBackPress = () => {
    if (webRef?.current) {
      webRef?.current?.goBack();
      return true;
    }
    return false;
  };

  const updateUserProfile = async (token: string): Promise<void> => {
    try {
      await axios.put(
        `${API_URL}/user/update`,
        {deviceToken: token},
        {
          headers: {
            Authorization: tokenState,
          },
        },
      );
    } catch (error) {
      // ignore — FCM registration best-effort
    }
  };

  const createFCMToken = () => {
    messaging().requestPermission();

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
        channelId: 'channel_1',
        channelName: 'My channel',
        channelDescription: 'A channel to categorise your notifications',
        playSound: false,
        soundName: 'default',
        importance: Importance.HIGH,
        vibrate: true,
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
    PushNotification.configure({
      onNotification: function (notification) {
        if (notification.userInteraction) {
          const url = extractNotificationUrl(notification);
          if (url) {
            handleNotificationUrl(url);
          }
        }
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

  async function requestMicrophonePermissionOnLaunch() {
    if (Platform.OS !== 'android') {
      return;
    }

    try {
      const alreadyGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );

      if (alreadyGranted) {
        return;
      }

      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message:
            'Myna needs microphone access so you can send voice messages in chat.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    if (Platform.OS === 'android') {
      requestNotificationPermission();
      requestMicrophonePermissionOnLaunch();
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      BackHandler.addEventListener('hardwareBackPress', onAndroidBackPress);
    }
  }, []);

  useEffect(() => {
    messaging().onMessage(async remoteMessage => {
      console.log('A new foreground notification arrived:', remoteMessage);

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
        userInfo: {url: remoteMessage?.data?.url},
      });
    });

    messaging().setBackgroundMessageHandler(async remoteMessage => {
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
        userInfo: {url: remoteMessage?.data?.url},
      });
    });
  }, []);

  useEffect(() => {
    const notificationListener = async () => {
      messaging().onNotificationOpenedApp(remoteMessage => {
        const openedUrl = remoteMessage?.data?.url;
        if (openedUrl && typeof openedUrl === 'string') {
          handleNotificationUrl(openedUrl);
        }
      });

      const initialNoti = await messaging().getInitialNotification();
      if (initialNoti) {
        const initialUrlFromNoti = initialNoti?.data?.url;
        if (initialUrlFromNoti && typeof initialUrlFromNoti === 'string') {
          setPendingNotificationUrl(initialUrlFromNoti);
        }
      }
    };
    notificationListener();
  }, []);

  useEffect(() => {
    if (isWebViewReady && pendingNotificationUrl) {
      handleNotificationUrl(pendingNotificationUrl);
      setPendingNotificationUrl(null);
    }
  }, [isWebViewReady, pendingNotificationUrl]);

  useEffect(() => {
    if (tokenState) {
      createChannel();
      createFCMToken();
    }
  }, [tokenState]);

  useEffect(() => {
    crashlytics().setCrashlyticsCollectionEnabled(true);
  }, []);

  useEffect(() => {
    const initializeApp = async () => {
      console.log('[PendingPostLogin] initializeApp start');

      const {hasNotification, url: notificationUrl} =
        await checkPendingNotification(WEB_URL);
      if (hasNotification && notificationUrl) {
        console.log(
          '[PendingPostLogin] init P1 notification →',
          notificationUrl,
        );
        setInitialUrl(notificationUrl);
        return;
      }

      try {
        const url = await Linking.getInitialURL();
        console.log('[PendingPostLogin] init P2 getInitialURL →', url);
        if (url) {
          const deepLinkUrl = await resolveDeepLinkUrl(url, WEB_URL);
          if (deepLinkUrl) {
            console.log(
              '[PendingPostLogin] init P2 setInitialUrl →',
              deepLinkUrl,
            );
            setInitialUrl(deepLinkUrl);
            return;
          }
        }
      } catch (error) {
        console.error('❌ Error initializing deep links:', error);
      }

      const {hasStoredReferrer, url: storedUrl} = await checkStoredReferrer(
        WEB_URL,
      );
      if (hasStoredReferrer && storedUrl) {
        console.log('[PendingPostLogin] init P3 referrer →', storedUrl);
        setInitialUrl(storedUrl);
        return;
      }

      try {
        const {hasReferrer, url: referrerUrl} = await checkInstallReferrer(
          WEB_URL,
          InstallReferrer,
        );
        if (hasReferrer && referrerUrl) {
          console.log(
            '[PendingPostLogin] init P4 installReferrer →',
            referrerUrl,
          );
          setInitialUrl(referrerUrl);
          return;
        }
      } catch (error) {
        console.error('❌ Error checking install referrer:', error);
      }

      const initialAppUrl = await getInitialAppUrl(WEB_URL);
      console.log('[PendingPostLogin] init P5 default →', initialAppUrl);
      setInitialUrl(initialAppUrl);
    };

    initializeApp();
  }, []);

  // Always register — was previously only wired on P5 path
  useEffect(() => {
    const subscription = Linking.addEventListener('url', async ({url}) => {
      console.log('[PendingPostLogin] Linking url event →', url);
      const deepLinkUrl = await resolveDeepLinkUrl(url, WEB_URL);
      if (deepLinkUrl) {
        console.log(
          '[PendingPostLogin] url event setInitialUrl →',
          deepLinkUrl,
        );
        setInitialUrl(deepLinkUrl);
      }
    });

    return () => subscription.remove();
  }, []);

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

  return (
    <SafeAreaProvider>
      <WebView
        key={webViewNavKey}
        ref={webRef}
        source={{uri: initialUrl}}
        style={{flex: 1}}
        allowsBackForwardNavigationGestures={true}
        injectedJavaScriptBeforeContentLoaded={INJECTED_JAVASCRIPT}
        javaScriptEnabled={true}
        onMessage={onMessage}
        originWhitelist={['https://*', 'http://*', 'data:*']}
        allowsFullscreenVideo={true}
        allowsInlineMediaPlayback={true}
        mediaCapturePermissionGrantType="grant"
        domStorageEnabled={true}
        mixedContentMode="always"
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
        }}
      />
    </SafeAreaProvider>
  );
};
export default ProviderApp;
