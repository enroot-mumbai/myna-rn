import React from 'react';
import WebView, {WebViewMessageEvent} from 'react-native-webview';
import SafeAreaProvider from './src/components/SafeAreaProvider';
import {Provider} from 'react-redux';
import store from './src/context/redux/store';
import {useAppDispatch} from './src/context/redux/hooks';
import {removeToken, saveToken} from './src/context/redux/slice/app';

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

  return (
    <SafeAreaProvider>
      <WebView
        source={{uri: 'http://192.168.1.103:3000'}}
        allowsBackForwardNavigationGestures={true}
        injectedJavaScriptBeforeContentLoaded={INJECTED_JAVASCRIPT}
        javaScriptEnabled={true}
        onMessage={onMessage}
        cacheEnabled
        originWhitelist={['https://*', 'http://*', 'data:*']}
        allowsFullscreenVideo={true}
      />
    </SafeAreaProvider>
  );
};

export default ProviderApp;
