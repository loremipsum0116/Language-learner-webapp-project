import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Import screens
import HomeScreen from './src/screens/HomeScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import LearnVocabScreen from './src/screens/LearnVocabScreen';
import GrammarQuizScreen from './src/screens/GrammarQuizScreen';
import DictionaryScreen from './src/screens/DictionaryScreen';
import ListeningListScreen from './src/screens/ListeningListScreen';
import IdiomsScreen from './src/screens/IdiomsScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator initialRouteName="Home">
          <Stack.Screen 
            name="Home" 
            component={HomeScreen} 
            options={{ title: 'Language Learner' }}
          />
          <Stack.Screen 
            name="Dashboard" 
            component={DashboardScreen} 
            options={{ title: '대시보드' }}
          />
          <Stack.Screen 
            name="LearnVocab" 
            component={LearnVocabScreen} 
            options={{ title: '단어 학습' }}
          />
          <Stack.Screen 
            name="GrammarQuiz" 
            component={GrammarQuizScreen} 
            options={{ title: '문법 퀴즈' }}
          />
          <Stack.Screen 
            name="Dictionary" 
            component={DictionaryScreen} 
            options={{ title: '사전' }}
          />
          <Stack.Screen 
            name="ListeningList" 
            component={ListeningListScreen} 
            options={{ title: '듣기 연습' }}
          />
          <Stack.Screen 
            name="Idioms" 
            component={IdiomsScreen} 
            options={{ title: '관용구' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}