import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

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

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
        },
        headerStyle: {
          backgroundColor: '#2196F3',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}>
      <Tab.Screen
        name="Home"
        component={PlaceholderScreen}
        options={{
          title: 'Home',
          tabBarIcon: () => null, // Will add icons later
        }}
      />
      <Tab.Screen
        name="Vocabulary"
        component={PlaceholderScreen}
        options={{
          title: 'Vocabulary',
          tabBarIcon: () => null,
        }}
      />
      <Tab.Screen
        name="Quiz"
        component={PlaceholderScreen}
        options={{
          title: 'Quiz',
          tabBarIcon: () => null,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={PlaceholderScreen}
        options={{
          title: 'Profile',
          tabBarIcon: () => null,
        }}
      />
    </Tab.Navigator>
  );
}