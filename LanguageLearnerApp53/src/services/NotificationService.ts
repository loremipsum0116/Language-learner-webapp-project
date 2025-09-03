import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import {Platform, PermissionsAndroid, Alert} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_TOKEN_KEY = '@notification_token';
const NOTIFICATION_PERMISSION_KEY = '@notification_permission';

export interface NotificationData {
  title?: string;
  body?: string;
  data?: Record<string, any>;
  messageId?: string;
  sentTime?: Date;
}

class NotificationService {
  private static instance: NotificationService;
  private messageListeners: Map<string, (message: NotificationData) => void> =
    new Map();
  private isInitialized = false;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.requestPermission();
      await this.registerAppWithFCM();
      await this.getToken();
      this.setupMessageHandlers();
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize notification service:', error);
    }
  }

  async requestPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        await AsyncStorage.setItem(
          NOTIFICATION_PERMISSION_KEY,
          enabled.toString(),
        );
        return enabled;
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        const enabled = granted === PermissionsAndroid.RESULTS.GRANTED;
        await AsyncStorage.setItem(
          NOTIFICATION_PERMISSION_KEY,
          enabled.toString(),
        );
        return enabled;
      }
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  }

  async getPermissionStatus(): Promise<boolean> {
    const status = await AsyncStorage.getItem(NOTIFICATION_PERMISSION_KEY);
    return status === 'true';
  }

  private async registerAppWithFCM(): Promise<void> {
    if (Platform.OS === 'ios') {
      await messaging().registerDeviceForRemoteMessages();
    }
  }

  async getToken(): Promise<string | null> {
    try {
      const token = await messaging().getToken();
      if (token) {
        await AsyncStorage.setItem(NOTIFICATION_TOKEN_KEY, token);
        console.log('FCM Token:', token);
        return token;
      }
      return null;
    } catch (error) {
      console.error('Failed to get FCM token:', error);
      return null;
    }
  }

  async getSavedToken(): Promise<string | null> {
    return AsyncStorage.getItem(NOTIFICATION_TOKEN_KEY);
  }

  private setupMessageHandlers(): void {
    messaging().onMessage(async remoteMessage => {
      console.log('Foreground message received:', remoteMessage);
      this.handleMessage(remoteMessage);
    });

    messaging().setBackgroundMessageHandler(async remoteMessage => {
      console.log('Background message received:', remoteMessage);
      this.handleMessage(remoteMessage);
    });

    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('Notification opened app:', remoteMessage);
      this.handleNotificationOpen(remoteMessage);
    });

    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('Initial notification:', remoteMessage);
          this.handleNotificationOpen(remoteMessage);
        }
      });

    messaging().onTokenRefresh(async token => {
      console.log('Token refreshed:', token);
      await AsyncStorage.setItem(NOTIFICATION_TOKEN_KEY, token);
      await this.sendTokenToServer(token);
    });
  }

  private handleMessage(
    remoteMessage: FirebaseMessagingTypes.RemoteMessage,
  ): void {
    const notification: NotificationData = {
      title: remoteMessage.notification?.title,
      body: remoteMessage.notification?.body,
      data: remoteMessage.data,
      messageId: remoteMessage.messageId,
      sentTime: remoteMessage.sentTime
        ? new Date(remoteMessage.sentTime)
        : undefined,
    };

    this.messageListeners.forEach(listener => {
      listener(notification);
    });

    if (Platform.OS === 'android' && remoteMessage.notification) {
      this.showLocalNotification(notification);
    }
  }

  private handleNotificationOpen(
    remoteMessage: FirebaseMessagingTypes.RemoteMessage,
  ): void {
    const data = remoteMessage.data;
    if (data?.screen) {
      this.navigateToScreen(data.screen as string, data);
    }
  }

  private showLocalNotification(notification: NotificationData): void {
    Alert.alert(
      notification.title || 'New Notification',
      notification.body || '',
      [
        {
          text: 'OK',
          onPress: () => {
            if (notification.data?.screen) {
              this.navigateToScreen(
                notification.data.screen as string,
                notification.data,
              );
            }
          },
        },
      ],
    );
  }

  private navigateToScreen(screen: string, params?: any): void {
    console.log('Navigate to screen:', screen, 'with params:', params);
  }

  async sendTokenToServer(token: string): Promise<void> {
    try {
      console.log('Sending token to server:', token);
    } catch (error) {
      console.error('Failed to send token to server:', error);
    }
  }

  subscribeToTopic(topic: string): Promise<void> {
    return messaging().subscribeToTopic(topic);
  }

  unsubscribeFromTopic(topic: string): Promise<void> {
    return messaging().unsubscribeFromTopic(topic);
  }

  addMessageListener(
    id: string,
    listener: (message: NotificationData) => void,
  ): void {
    this.messageListeners.set(id, listener);
  }

  removeMessageListener(id: string): void {
    this.messageListeners.delete(id);
  }

  async deleteToken(): Promise<void> {
    try {
      await messaging().deleteToken();
      await AsyncStorage.removeItem(NOTIFICATION_TOKEN_KEY);
    } catch (error) {
      console.error('Failed to delete token:', error);
    }
  }

  async getAPNSToken(): Promise<string | null> {
    if (Platform.OS === 'ios') {
      return messaging().getAPNSToken();
    }
    return null;
  }

  async hasPermission(): Promise<boolean> {
    const authStatus = await messaging().hasPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  }
}

export default NotificationService.getInstance();