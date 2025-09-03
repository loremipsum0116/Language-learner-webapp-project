// src/navigation/RootNavigator.tsx
// 최상위 루트 네비게이터

import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList, NavigationState } from './types';
import { useTheme } from '../context/ThemeContext';
import { navigationRef } from './NavigationService';

// Navigators & Screens
import MainStackNavigator from './MainStackNavigator';
import SplashScreen from '../screens/splash/SplashScreen';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';

// Deep linking
import { linkingConfig } from './LinkingConfig';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Navigation state storage keys
const NAVIGATION_STATE_KEY = '@navigation_state';
const NAVIGATION_PERSISTENCE_KEY = '@navigation_persistence';

const RootNavigator: React.FC = () => {
  const { theme, isDark } = useTheme();
  const [isReady, setIsReady] = useState(false);
  const [initialState, setInitialState] = useState();
  const [navState, setNavState] = useState<NavigationState>({
    isAuthenticated: false,
    hasSeenOnboarding: false,
    lastActiveTab: undefined,
    deepLinkHandled: false,
  });

  // Navigation theme
  const navTheme = {
    ...isDark ? DarkTheme : DefaultTheme,
    colors: {
      ...isDark ? DarkTheme.colors : DefaultTheme.colors,
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.error,
    },
  };

  // Initialize navigation state
  useEffect(() => {
    const restoreState = async () => {
      try {
        const savedStateString = await AsyncStorage.getItem(NAVIGATION_STATE_KEY);
        const savedNavState = savedStateString ? JSON.parse(savedStateString) : null;

        if (savedNavState) {
          setNavState(savedNavState);
        }

        // Restore navigation state for development
        if (__DEV__) {
          const savedNavStateString = await AsyncStorage.getItem(NAVIGATION_PERSISTENCE_KEY);
          const state = savedNavStateString ? JSON.parse(savedNavStateString) : undefined;
          
          if (state !== undefined) {
            setInitialState(state);
          }
        }
      } catch (e) {
        console.error('Failed to restore navigation state:', e);
      } finally {
        setIsReady(true);
      }
    };

    if (!isReady) {
      restoreState();
    }
  }, [isReady]);

  // Save navigation state
  const handleStateChange = async (state: any) => {
    if (__DEV__) {
      await AsyncStorage.setItem(NAVIGATION_PERSISTENCE_KEY, JSON.stringify(state));
    }
    
    // Update navigation state based on current route
    const currentRoute = navigationRef.current?.getCurrentRoute();
    if (currentRoute) {
      const updatedNavState = {
        ...navState,
        deepLinkHandled: true,
      };
      
      await AsyncStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(updatedNavState));
      setNavState(updatedNavState);
    }
  };

  // Show splash screen while loading
  if (!isReady) {
    return <SplashScreen />;
  }

  // Determine initial route based on state
  const getInitialRouteName = (): keyof RootStackParamList => {
    if (!navState.hasSeenOnboarding) {
      return 'Onboarding';
    }
    
    return 'App'; // MainStackNavigator will handle auth state
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      initialState={initialState}
      onStateChange={handleStateChange}
      linking={linkingConfig}
      theme={navTheme}
      fallback={<LoadingScreen />}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          gestureEnabled: false,
        }}
        initialRouteName={getInitialRouteName()}
      >
        <Stack.Screen
          name="Splash"
          component={SplashScreen}
          options={{
            animationTypeForReplace: 'push',
          }}
        />
        
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{
            animationTypeForReplace: 'push',
          }}
        />
        
        <Stack.Screen
          name="App"
          component={MainStackNavigator}
          options={{
            animationTypeForReplace: 'push',
          }}
        />
        
        <Stack.Screen
          name="DeepLink"
          component={DeepLinkHandler}
          options={{
            presentation: 'transparentModal',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// Loading fallback component
const LoadingScreen: React.FC = () => {
  return (
    <View style={{ 
      flex: 1, 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#ffffff' 
    }}>
      <Text>로딩 중...</Text>
    </View>
  );
};

// Deep link handler component
interface DeepLinkHandlerProps {
  route: {
    params: {
      screen: string;
      params?: any;
    };
  };
  navigation: any;
}

const DeepLinkHandler: React.FC<DeepLinkHandlerProps> = ({ route, navigation }) => {
  const { screen, params } = route.params;

  useEffect(() => {
    // Handle deep link navigation
    const handleDeepLink = async () => {
      try {
        // Navigate to the appropriate screen
        navigation.navigate('App', {
          screen: 'Main',
          params: {
            screen: screen,
            params: params,
          },
        });
      } catch (error) {
        console.error('Deep link navigation error:', error);
        // Fallback to main screen
        navigation.navigate('App');
      }
    };

    handleDeepLink();
  }, [screen, params, navigation]);

  return <LoadingScreen />;
};

export default RootNavigator;