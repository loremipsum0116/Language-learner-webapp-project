/**
 * Language Learner Mobile App
 * Main App Component with Redux and Navigation Setup
 *
 * @format
 */

import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { store } from './src/store';
import RootNavigator from './src/navigation/RootNavigator';
import { NavigationGestureProvider } from './src/components/gestures';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <NavigationGestureProvider
          initialConfig={{
            enableSwipeBack: true,
            enablePullToRefresh: true,
            enableLongPress: true,
            hapticFeedback: true,
          }}
        >
          <StatusBar
            barStyle={isDarkMode ? 'light-content' : 'dark-content'}
            backgroundColor={isDarkMode ? '#1a1a1a' : '#2196F3'}
          />
          <RootNavigator />
        </NavigationGestureProvider>
      </SafeAreaProvider>
    </Provider>
  );
}

export default App;
