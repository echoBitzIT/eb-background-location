/**
 * @format
 */

import { AppRegistry } from 'react-native';
import {
  getMessaging,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';
import { registerNotifeeBackgroundHandler } from './src/services/pushNotificationService';

const messaging = getMessaging();

// Required for data messages / background delivery on Android.
setBackgroundMessageHandler(messaging, async (remoteMessage) => {
  // OS already shows the notification payload; log for debugging only.
  if (__DEV__) {
    console.log('[FCM]', 'background message', {
      messageId: remoteMessage?.messageId,
      title: remoteMessage?.notification?.title,
      body: remoteMessage?.notification?.body,
      data: remoteMessage?.data,
    });
  }
});

// Required so Notifee delivers press events when the app is backgrounded.
registerNotifeeBackgroundHandler();

AppRegistry.registerComponent(appName, () => App);
