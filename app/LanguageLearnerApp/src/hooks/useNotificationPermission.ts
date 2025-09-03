import {useState, useEffect} from 'react';
import {Platform, Alert} from 'react-native';
import NotificationService from '../services/NotificationService';

export interface UseNotificationPermissionReturn {
  hasPermission: boolean;
  isLoading: boolean;
  requestPermission: () => Promise<void>;
  checkPermission: () => Promise<void>;
}

export const useNotificationPermission = (): UseNotificationPermissionReturn => {
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkPermission = async () => {
    try {
      setIsLoading(true);
      const permission = await NotificationService.hasPermission();
      setHasPermission(permission);
    } catch (error) {
      console.error('Error checking notification permission:', error);
      setHasPermission(false);
    } finally {
      setIsLoading(false);
    }
  };

  const requestPermission = async () => {
    try {
      const granted = await NotificationService.requestPermission();
      setHasPermission(granted);

      if (!granted) {
        Alert.alert(
          'Notifications Disabled',
          'To receive important updates and reminders, please enable notifications in your device settings.',
          [
            {text: 'Cancel', style: 'cancel'},
            {
              text: 'Open Settings',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  const Linking = require('react-native').Linking;
                  Linking.openURL('app-settings:');
                } else {
                  const Linking = require('react-native').Linking;
                  Linking.openSettings();
                }
              },
            },
          ],
        );
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      Alert.alert(
        'Permission Error',
        'Failed to request notification permission. Please try again.',
      );
    }
  };

  useEffect(() => {
    checkPermission();
  }, []);

  return {
    hasPermission,
    isLoading,
    requestPermission,
    checkPermission,
  };
};