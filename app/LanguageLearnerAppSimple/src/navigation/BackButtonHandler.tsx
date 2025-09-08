// src/navigation/BackButtonHandler.tsx
// Android 뒤로가기 버튼 핸들링

import { useEffect } from 'react';
import { BackHandler, Platform, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { navigationService } from './NavigationService';

// Back button behavior configuration
interface BackButtonConfig {
  preventBack?: boolean;
  showExitConfirmation?: boolean;
  customHandler?: () => boolean;
  exitAppConfirmation?: {
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
  };
}

// Default exit confirmation
const DEFAULT_EXIT_CONFIRMATION = {
  title: '앱 종료',
  message: '정말로 앱을 종료하시겠습니까?',
  confirmText: '종료',
  cancelText: '취소',
};

// Hook for handling back button behavior
export const useBackButtonHandler = (config: BackButtonConfig = {}) => {
  const {
    preventBack = false,
    showExitConfirmation = false,
    customHandler,
    exitAppConfirmation = DEFAULT_EXIT_CONFIRMATION,
  } = config;

  useFocusEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const handleBackPress = (): boolean => {
      // Custom handler takes precedence
      if (customHandler) {
        return customHandler();
      }

      // Prevent back action
      if (preventBack) {
        return true;
      }

      // Handle back with navigation service
      const canGoBack = navigationService.canGoBack();
      
      if (canGoBack) {
        navigationService.goBack();
        return true;
      } else if (showExitConfirmation) {
        // Show exit confirmation
        Alert.alert(
          exitAppConfirmation.title,
          exitAppConfirmation.message,
          [
            {
              text: exitAppConfirmation.cancelText,
              style: 'cancel',
            },
            {
              text: exitAppConfirmation.confirmText,
              style: 'destructive',
              onPress: () => BackHandler.exitApp(),
            },
          ]
        );
        return true;
      }

      // Let system handle (exit app)
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);

    return () => subscription.remove();
  });
};

// Component wrapper for back button handling
interface BackButtonHandlerProps {
  children: React.ReactNode;
  config?: BackButtonConfig;
}

export const BackButtonHandler: React.FC<BackButtonHandlerProps> = ({ 
  children, 
  config = {} 
}) => {
  useBackButtonHandler(config);
  return <>{children}</>;
};

// Screen-specific back button handlers
export const useQuizBackButtonHandler = () => {
  useBackButtonHandler({
    customHandler: () => {
      Alert.alert(
        '퀴즈 종료',
        '퀴즈를 종료하시겠습니까? 진행상황이 저장되지 않을 수 있습니다.',
        [
          {
            text: '계속하기',
            style: 'cancel',
          },
          {
            text: '종료',
            style: 'destructive',
            onPress: () => navigationService.goBack(),
          },
        ]
      );
      return true; // Prevent default back action
    },
  });
};

export const useAuthBackButtonHandler = () => {
  useBackButtonHandler({
    showExitConfirmation: true,
    exitAppConfirmation: {
      title: '앱 종료',
      message: '로그인을 완료하지 않고 앱을 종료하시겠습니까?',
      confirmText: '종료',
      cancelText: '취소',
    },
  });
};

export const useModalBackButtonHandler = (onClose: () => void) => {
  useBackButtonHandler({
    customHandler: () => {
      onClose();
      return true;
    },
  });
};

// Global back button handler component
export const GlobalBackButtonHandler: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const handleBackPress = (): boolean => {
      return navigationService.handleAndroidBackButton();
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);

    return () => subscription.remove();
  }, []);

  return <>{children}</>;
};

// Double tap to exit handler
let exitAppCount = 0;
let exitAppTimeout: NodeJS.Timeout;

export const useDoubleTapExitHandler = (timeout: number = 2000) => {
  useBackButtonHandler({
    customHandler: () => {
      const canGoBack = navigationService.canGoBack();
      
      if (canGoBack) {
        navigationService.goBack();
        return true;
      }

      // Double tap to exit logic
      exitAppCount += 1;
      
      if (exitAppCount === 1) {
        // Show toast message
        Alert.alert('', '뒤로가기를 한번 더 누르면 앱이 종료됩니다.');
        
        exitAppTimeout = setTimeout(() => {
          exitAppCount = 0;
        }, timeout);
        
        return true;
      } else if (exitAppCount === 2) {
        clearTimeout(exitAppTimeout);
        BackHandler.exitApp();
        return true;
      }
      
      return false;
    },
  });
};

// Export default hook
export default useBackButtonHandler;