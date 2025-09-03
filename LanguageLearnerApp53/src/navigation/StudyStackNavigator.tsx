// src/navigation/StudyStackNavigator.tsx
// 학습 스택 네비게이터

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StudyStackParamList } from './types';
import { useColors } from '../context/ThemeContext';

// Screens
import StudyScreen from '../screens/main/StudyScreen';

const Stack = createNativeStackNavigator<StudyStackParamList>();

// Placeholder screens (TODO: 실제 화면 구현 후 교체)
const StudyModeScreen = StudyScreen;
const VocabDetailScreen = StudyScreen;
const QuizResultScreen = StudyScreen;
const ReviewSessionScreen = StudyScreen;

const StudyStackNavigator: React.FC = () => {
  const colors = useColors();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: true,
        animation: 'slide_from_right',
        gestureEnabled: true,
        headerBackTitleVisible: false,
        headerLeftLabelVisible: false,
      }}
      initialRouteName="StudyMode"
    >
      <Stack.Screen
        name="StudyMode"
        component={StudyModeScreen}
        options={{
          title: '학습 모드 선택',
        }}
      />
      <Stack.Screen
        name="SrsQuiz"
        component={StudyScreen}
        options={({ route }) => ({
          title: route.params?.reviewMode ? '복습 퀴즈' : 'SRS 퀴즈',
          headerLeft: () => null, // 뒤로가기 버튼 제거 (퀴즈 중 실수 방지)
        })}
      />
      <Stack.Screen
        name="VocabDetail"
        component={VocabDetailScreen}
        options={{
          title: '단어 상세',
          presentation: 'modal', // 모달 형태로 표시
        }}
      />
      <Stack.Screen
        name="QuizResult"
        component={QuizResultScreen}
        options={{
          title: '퀴즈 결과',
          headerLeft: () => null, // 뒤로가기 버튼 제거
          gestureEnabled: false, // 스와이프로 닫기 방지
        }}
      />
      <Stack.Screen
        name="ReviewSession"
        component={ReviewSessionScreen}
        options={{
          title: '오답 복습',
        }}
      />
    </Stack.Navigator>
  );
};

export default StudyStackNavigator;