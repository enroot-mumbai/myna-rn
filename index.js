/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import messaging from '@react-native-firebase/messaging';

messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Message handled in the background!', remoteMessage);
  console.log('BG data:', remoteMessage?.data);
  console.log('BG url:', remoteMessage?.data?.url);
  return Promise.resolve();
});

AppRegistry.registerComponent(appName, () => App);
