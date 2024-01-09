import messaging from '@react-native-firebase/messaging';
import axios from 'axios';
import React, {useEffect, useState} from 'react';
import {Alert, BackHandler, Platform, PermissionsAndroid} from 'react-native';
import PushNotification, {Importance} from 'react-native-push-notification';
import WebView, {WebViewMessageEvent} from 'react-native-webview';
import {Provider} from 'react-redux';
import {SimpleLoader} from './src/components/Loader';
import SafeAreaProvider from './src/components/SafeAreaProvider';
import {useAppDispatch} from './src/context/redux/hooks';
import {removeToken, saveToken} from './src/context/redux/slice/app';
import store from './src/context/redux/store';

const API_URL = 'https://myna-dev.enrootmumbai.in';
const WEB_URL = 'https://mynafe-git-feature-holidays-enroot-mumbai.vercel.app';

export interface onMessagePayload {
  type?: string;
  payload?: {};
}

const ProviderApp = () => {
  return (
    <Provider store={store}>
      <App />
    </Provider>
  );
};

const App = () => {
  const webRef = React.useRef();
  const dispatch = useAppDispatch();
  const [tokenState, setTokenState] = useState('');
  const [fcmTokenState, setFCMTokenState] = useState('');
  const [channelId, setChannelId] = useState(
    'fcm_fallback_notification_channel',
  );

  const onMessage = (payload: WebViewMessageEvent) => {
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
        console.log('data?.payload?.token', data?.payload?.token);
        setTokenState(data?.payload?.token);
        return dispatch(saveToken(data?.payload?.token));
      case 'LOG_OUT':
        setTokenState('');
        setFCMTokenState('');
        return dispatch(removeToken());
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

          // You can send this token to your server for later use
        } else {
          console.log('No FCM token available');
        }
      })
      .catch(error => {
        console.log('Error getting FCM token:', error);
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

  const requestNotificationPermission = async () => {
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
      console.warn(err);
    }
  };

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
    const unsubscribeForeground = messaging().onMessage(async remoteMessage => {
      console.log('A new foreground notification arrived:', remoteMessage);

      // Display the notification to the user using a UI component or custom logic
    });

    // Listen for notifications when the app is in the background or terminated
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      console.log('A new background notification arrived:', remoteMessage);
      // Create a local notification
      PushNotification.localNotification({
        channelId: channelId,
        id: Date.now().toString(),
        title: remoteMessage.notification.title,
        message: remoteMessage.notification.body,
      });

      // Handle the background notification and trigger custom logic
    });

    // Clean up the subscriptions when the component is unmounted
    return () => {
      unsubscribeForeground();
    };
  }, []);

  useEffect(() => {
    if (tokenState) {
      createChannel();
      createFCMToken();
    }
  }, [tokenState]);

  return (
    <SafeAreaProvider>
      <WebView
        ref={webRef}
        source={{uri: `${WEB_URL}/login`}}
        allowsBackForwardNavigationGestures={true}
        injectedJavaScriptBeforeContentLoaded={INJECTED_JAVASCRIPT}
        javaScriptEnabled={true}
        onMessage={onMessage}
        cacheEnabled
        originWhitelist={['https://*', 'http://*', 'data:*']}
        allowsFullscreenVideo={true}
        onError={error => Alert.alert('Something went wrong', error.type)}
        scalesPageToFit={true}
        startInLoadingState={true}
        renderLoading={() => <SimpleLoader />}
        // onTouchEnd={e => {
        //   if (e.nativeEvent?.pageX > 30) webRef?.current?.goForward();
        // }}
      />
    </SafeAreaProvider>
  );
};

export default ProviderApp;
