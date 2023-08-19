import React, {useEffect, useState} from 'react';
import WebView, {WebViewMessageEvent} from 'react-native-webview';
import SafeAreaProvider from './src/components/SafeAreaProvider';
import {Provider, useSelector} from 'react-redux';
import store from './src/context/redux/store';
import {useAppDispatch, useAppSelector} from './src/context/redux/hooks';
import {
  removeToken,
  saveToken,
  saveFCMToken,
} from './src/context/redux/slice/app';
import {SimpleLoader} from './src/components/Loader';
import {Alert, BackHandler, Platform} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import axios from 'axios';
import PushNotification from 'react-native-push-notification';

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
  const fcmToken = useAppSelector(state => state.fcmToken);
  const appToken = useAppSelector(state => state.token);
  const [tokenState, setTokenState] = useState('');
  const [fcmTokenState, setFCMTokenState] = useState('');

  const onMessage = (payload: WebViewMessageEvent) => {
    const data: onMessagePayload = JSON.parse(payload.nativeEvent.data);
    const isTokenAvailable =
      data?.payload?.token !== '' &&
      data?.payload?.token !== null &&
      data?.payload?.token !== undefined;
    console.log(data);
    switch (data?.type) {
      case 'LOG_IN':
        if (!isTokenAvailable) {
          return;
        }
        console.log('data?.payload?.token', data?.payload?.token);
        setTokenState(data?.payload?.token);
        return dispatch(saveToken(data?.payload?.token));
      case 'LOG_OUT':
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
    console.log('fcmToken', fcmToken);
    if (!fcmToken) {
      // Request permission to receive notifications (optional)
      messaging().requestPermission();

      // Get the FCM token
      messaging()
        .getToken()
        .then(async token => {
          if (token) {
            console.log('FCM Token:', token);
            dispatch(saveFCMToken(token));
            setFCMTokenState(token);

            // You can send this token to your server for later use
          } else {
            console.log('No FCM token available');
          }
        })
        .catch(error => {
          console.log('Error getting FCM token:', error);
        });
    }
  }, [fcmToken]);

  useEffect(() => {
    // Listen for foreground notifications
    const unsubscribeForeground = messaging().onMessage(async remoteMessage => {
      console.log('A new foreground notification arrived:', remoteMessage);

      // Display the notification to the user using a UI component or custom logic
    });

    // Listen for notifications when the app is in the background or terminated
    const unsubscribeBackground = messaging().setBackgroundMessageHandler(
      async remoteMessage => {
        console.log('A new background notification arrived:', remoteMessage);
        // Create a local notification
        PushNotification.localNotification({
          id: Date.now().toString(),
          title: remoteMessage.notification.title,
          message: remoteMessage.notification.body,
        });

        // Handle the background notification and trigger custom logic
      },
    );

    // Clean up the subscriptions when the component is unmounted
    return () => {
      unsubscribeForeground();
    };
  }, []);

  useEffect(() => {
    console.log('===============');
    console.log('tokenState', tokenState);
    console.log('fcmTokenState', fcmTokenState);
    console.log('===============');
    if (tokenState && fcmTokenState) {
      updateUserProfile(fcmTokenState);
    }
  }, [tokenState, fcmTokenState]);

  const updateUserProfile = async (token): Promise<{}> => {
    try {
      console.log('tokenState', tokenState);
      console.log('payload', {deviceToken: token});
      const res = await axios.put(
        `http://43.204.9.189:3001/user/update`,
        {deviceToken: token},
        {
          headers: {
            Authorization: tokenState,
          },
        },
      );
      console.log('\n\nres', res);
    } catch (error) {
      console.log('\n\nerror', error.response);
      return {
        isError: true,
        data: error.response && error.response.data,
      };
    }
  };

  const frontButtonHandler = () => {
    if (webRef.current) webRef?.current?.goForward();
  };

  return (
    <SafeAreaProvider>
      <WebView
        ref={webRef}
        source={{uri: 'http://192.168.1.9:3000/login'}}
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
        onTouchEnd={e => {
          if (e.nativeEvent?.pageX > 30) webRef?.current?.goForward();
        }}
      />
    </SafeAreaProvider>
  );
};

export default ProviderApp;
