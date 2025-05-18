import messaging from '@react-native-firebase/messaging';
import axios from 'axios';
import React, {useEffect, useState} from 'react';
import {
  Alert,
  BackHandler,
  Platform,
  PermissionsAndroid,
  Share,
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

const API_URL = 'https://myna-prod.enrootmumbai.in';
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
  const dispatch = useAppDispatch();
  const [tokenState, setTokenState] = useState('');
  const [fcmTokenState, setFCMTokenState] = useState('');
  const [channelId, setChannelId] = useState(
    'fcm_fallback_notification_channel',
  );
  const [userInteraction, setUserInteraction] = useState(false);

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

  return (
    <SafeAreaProvider>
      <>
        <WebView
          ref={webRef}
          source={{uri: WEB_URL}}
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
        />
      </>
    </SafeAreaProvider>
  );
};
export default ProviderApp;
