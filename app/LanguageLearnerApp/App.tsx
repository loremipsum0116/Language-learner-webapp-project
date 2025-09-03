/**
 * Language Learner Mobile App - Expo Compatible Version
 * Main App Component with Navigation Setup
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import simple screens for Expo Go compatibility
import SimpleDictionaryScreen from './src/screens/SimpleDictionaryScreen';
import SimpleWordbookScreen from './src/screens/SimpleWordbookScreen';
import {
  ReadingPlaceholder,
  ListeningPlaceholder,
  QuizPlaceholder,
  SrsPlaceholder,
} from './src/screens/PlaceholderScreen';

// Import context providers
import { AuthProvider } from './src/context/SimpleAuthContext';
import { ThemeProvider } from './src/context/SimpleThemeContext';

// Simple main navigation stack
const Stack = createNativeStackNavigator();

// Simple home screen for navigation
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

const HomeScreen = ({ navigation }: any) => {
  const menuItems = [
    { title: '🔍 사전', subtitle: '영어 단어 검색', screen: 'Dictionary' },
    { title: '📚 내 단어장', subtitle: '저장된 단어 관리', screen: 'Wordbook' },
    { title: '🎯 SRS 학습', subtitle: '간격 반복 시스템', screen: 'SrsDashboard' },
    { title: '📖 리딩', subtitle: '독해 연습', screen: 'Reading' },
    { title: '🎧 리스닝', subtitle: '듣기 연습', screen: 'Listening' },
    { title: '🧠 퀴즈', subtitle: '문법 및 어휘 퀴즈', screen: 'Quiz' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Language Learner</Text>
        <Text style={styles.subtitle}>영어 학습 앱</Text>
      </View>
      
      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={() => navigation.navigate(item.screen)}
          >
            <Text style={styles.menuTitle}>{item.title}</Text>
            <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contentContainer: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  menuContainer: {
    gap: 16,
  },
  menuItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <NavigationContainer>
            <StatusBar style="auto" />
            <Stack.Navigator
              initialRouteName="Home"
              screenOptions={{
                headerStyle: {
                  backgroundColor: '#3b82f6',
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            >
              <Stack.Screen 
                name="Home" 
                component={HomeScreen} 
                options={{ 
                  title: 'Language Learner',
                  headerShown: false,
                }} 
              />
              <Stack.Screen 
                name="Dictionary" 
                component={SimpleDictionaryScreen} 
                options={{ title: '사전' }} 
              />
              <Stack.Screen 
                name="Wordbook" 
                component={SimpleWordbookScreen} 
                options={{ title: '내 단어장' }} 
              />
              <Stack.Screen 
                name="SrsDashboard" 
                component={SrsPlaceholder} 
                options={{ title: 'SRS 학습' }} 
              />
              <Stack.Screen 
                name="Reading" 
                component={ReadingPlaceholder} 
                options={{ title: '리딩' }} 
              />
              <Stack.Screen 
                name="Listening" 
                component={ListeningPlaceholder} 
                options={{ title: '리스닝' }} 
              />
              <Stack.Screen 
                name="Quiz" 
                component={QuizPlaceholder} 
                options={{ title: '퀴즈' }} 
              />
            </Stack.Navigator>
          </NavigationContainer>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}