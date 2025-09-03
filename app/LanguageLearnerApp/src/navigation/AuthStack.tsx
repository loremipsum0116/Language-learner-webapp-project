import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthStackParamList } from './types';

// Screens will be imported here once created
// import LoginScreen from '@/screens/auth/LoginScreen';
// import RegisterScreen from '@/screens/auth/RegisterScreen';
// import ForgotPasswordScreen from '@/screens/auth/ForgotPasswordScreen';

const Stack = createStackNavigator<AuthStackParamList>();

// Temporary placeholder screens
const PlaceholderScreen = ({ route }: { route: any }) => {
  const React = require('react');
  const { View, Text, StyleSheet } = require('react-native');
  
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{route.name} Screen</Text>
      <Text style={styles.subtext}>Coming soon...</Text>
    </View>
  );
};

const styles = {
  container: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: '#f5f5f5',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    marginBottom: 10,
  },
  subtext: {
    fontSize: 16,
    color: '#666',
  },
};

export default function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#2196F3',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}>
      <Stack.Screen 
        name="Login" 
        component={PlaceholderScreen}
        options={{ title: 'Sign In' }}
      />
      <Stack.Screen 
        name="Register" 
        component={PlaceholderScreen}
        options={{ title: 'Create Account' }}
      />
      <Stack.Screen 
        name="ForgotPassword" 
        component={PlaceholderScreen}
        options={{ title: 'Reset Password' }}
      />
    </Stack.Navigator>
  );
}