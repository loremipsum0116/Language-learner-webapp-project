import {useEffect, useState, useCallback} from 'react';
import NotificationService, {
  NotificationData,
} from '../services/NotificationService';

export interface UseNotificationsReturn {
  isPermissionGranted: boolean;
  fcmToken: string | null;
  lastNotification: NotificationData | null;
  requestPermission: () => Promise<boolean>;
  subscribeToTopic: (topic: string) => Promise<void>;
  unsubscribeFromTopic: (topic: string) => Promise<void>;
  clearNotification: () => void;
}

export const useNotifications = (): UseNotificationsReturn => {
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [lastNotification, setLastNotification] =
    useState<NotificationData | null>(null);

  useEffect(() => {
    const initializeNotifications = async () => {
      await NotificationService.initialize();
      
      const permissionStatus = await NotificationService.getPermissionStatus();
      setIsPermissionGranted(permissionStatus);

      const token = await NotificationService.getSavedToken();
      setFcmToken(token);
    };

    initializeNotifications();

    const listenerId = 'notification-hook';
    NotificationService.addMessageListener(
      listenerId,
      (notification: NotificationData) => {
        setLastNotification(notification);
      },
    );

    return () => {
      NotificationService.removeMessageListener(listenerId);
    };
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const granted = await NotificationService.requestPermission();
    setIsPermissionGranted(granted);
    
    if (granted) {
      const token = await NotificationService.getToken();
      setFcmToken(token);
    }
    
    return granted;
  }, []);

  const subscribeToTopic = useCallback(async (topic: string): Promise<void> => {
    await NotificationService.subscribeToTopic(topic);
  }, []);

  const unsubscribeFromTopic = useCallback(
    async (topic: string): Promise<void> => {
      await NotificationService.unsubscribeFromTopic(topic);
    },
    [],
  );

  const clearNotification = useCallback(() => {
    setLastNotification(null);
  }, []);

  return {
    isPermissionGranted,
    fcmToken,
    lastNotification,
    requestPermission,
    subscribeToTopic,
    unsubscribeFromTopic,
    clearNotification,
  };
};