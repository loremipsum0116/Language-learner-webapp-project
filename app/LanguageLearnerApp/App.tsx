/**
 * Language Learner Mobile App - Expo Compatible Version
 * Main App Component with Navigation Setup
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import all refactored screens
import HomeScreen from './src/screens/HomeScreen';
import LandingPageScreen from './src/screens/LandingPageScreen';
import DictionaryScreen from './src/screens/DictionaryScreen';
import GrammarHubScreen from './src/screens/GrammarHubScreen';
import GrammarQuizScreen from './src/screens/GrammarQuizScreen';
import LearnStartScreen from './src/screens/LearnStartScreen';
import LearnVocabPlaceholder from './src/screens/LearnVocabPlaceholder';
import ListeningListScreen from './src/screens/ListeningListScreen';
import ListeningPracticeScreen from './src/screens/ListeningPracticeScreen';
import MasteredWordsScreen from './src/screens/MasteredWordsScreen';
import MiniQuizScreen from './src/screens/MiniQuizScreen';
import SrsParentFolderScreen from './src/screens/srs/SrsParentFolderScreen';
import ReadingListScreen from './src/screens/reading/ReadingListScreen';
import ReadingReviewScreen from './src/screens/reading/ReadingReviewScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import LogoutScreen from './src/screens/auth/LogoutScreen';

// Import context providers (create simple ones if needed)
import { AuthProvider } from './src/context/SimpleAuthContext';
import { ThemeProvider } from './src/context/SimpleThemeContext';

// Simple main navigation stack
const Stack = createNativeStackNavigator();

// Import simple components
import { View, Text } from 'react-native';


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
                name="LandingPage" 
                component={LandingPageScreen} 
                options={{ title: '시작하기' }} 
              />
              <Stack.Screen 
                name="Dictionary" 
                component={DictionaryScreen} 
                options={{ title: '사전' }} 
              />
              <Stack.Screen 
                name="GrammarHub" 
                component={GrammarHubScreen} 
                options={{ title: '문법 허브' }} 
              />
              <Stack.Screen 
                name="GrammarQuiz" 
                component={GrammarQuizScreen} 
                options={{ title: '문법 퀴즈' }} 
              />
              <Stack.Screen 
                name="LearnStart" 
                component={LearnStartScreen} 
                options={{ title: '학습 시작' }} 
              />
              <Stack.Screen 
                name="LearnVocab" 
                component={LearnVocabPlaceholder} 
                options={{ title: '단어 학습' }} 
              />
              <Stack.Screen 
                name="ListeningList" 
                component={ListeningListScreen} 
                options={{ title: '듣기 목록' }} 
              />
              <Stack.Screen 
                name="ListeningPractice" 
                component={ListeningPracticeScreen} 
                options={{ title: '듣기 연습' }} 
              />
              <Stack.Screen 
                name="MasteredWords" 
                component={MasteredWordsScreen} 
                options={{ title: '마스터된 단어' }} 
              />
              <Stack.Screen 
                name="MiniQuiz" 
                component={MiniQuizScreen} 
                options={{ title: '미니 퀴즈' }} 
              />
              <Stack.Screen 
                name="SRS" 
                component={SrsParentFolderScreen} 
                options={{ title: 'SRS 학습' }} 
              />
              <Stack.Screen 
                name="ReadingList" 
                component={ReadingListScreen} 
                options={{ title: '독해 목록' }} 
              />
              <Stack.Screen 
                name="ReadingReview" 
                component={ReadingReviewScreen} 
                options={{ title: '독해 리뷰' }} 
              />
              <Stack.Screen 
                name="Login" 
                component={LoginScreen} 
                options={{ title: '로그인' }} 
              />
              <Stack.Screen 
                name="Logout" 
                component={LogoutScreen} 
                options={{ title: '로그아웃' }} 
              />
            </Stack.Navigator>
          </NavigationContainer>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}