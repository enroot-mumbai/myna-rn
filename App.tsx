import React, {useEffect} from 'react';
import WebView, {WebViewMessageEvent} from 'react-native-webview';
import SafeAreaProvider from './src/components/SafeAreaProvider';
import {Provider} from 'react-redux';
import store from './src/context/redux/store';
import {useAppDispatch} from './src/context/redux/hooks';
import {removeToken, saveToken} from './src/context/redux/slice/app';
import {SimpleLoader} from './src/components/Loader';
import {BackHandler, Platform} from 'react-native';
import messaging from '@react-native-firebase/messaging';


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
    // Request permission to receive notifications (optional)
    messaging().requestPermission();

    // Get the FCM token
    messaging()
      .getToken()
      .then((fcmToken) => {
        if (fcmToken) {
          console.log('FCM Token:', fcmToken);
          // You can send this token to your server for later use
        } else {
          console.log('No FCM token available');
        }
      })
      .catch((error) => {
        console.log('Error getting FCM token:', error);
      });
  }, []);
  
  const frontButtonHandler = () => {
    if (webRef.current) webRef?.current?.goForward();
  };

  return (
    <SafeAreaProvider>
      <WebView
        ref={webRef}
        source={{uri: 'https://mynafe.vercel.app/login'}}
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
