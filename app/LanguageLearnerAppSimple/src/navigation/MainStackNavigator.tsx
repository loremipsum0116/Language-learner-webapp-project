// src/navigation/MainStackNavigator.tsx
// 메인 스택 네비게이터 (전체 앱 구조 관리)

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainStackParamList } from './types';
import { useColors } from '../context/ThemeContext';

// Navigators
import AuthStackNavigator from './AuthStackNavigator';
import TabNavigator from './TabNavigator';
import StudyStackNavigator from './StudyStackNavigator';

// Screens
import DictionaryScreen from '../screens/DictionaryScreen';
import WordbookScreen from '../screens/WordbookScreen';
import SrsDashboardScreen from '../screens/SrsDashboardScreen';
import ReadingScreen from '../screens/ReadingScreen';
import ListeningScreen from '../screens/ListeningScreen';
import QuizScreen from '../screens/QuizScreen';

// Modal Components
import CardReportModal from '../components/CardReportModal';
import VocabCard from '../components/VocabCard';

const Stack = createNativeStackNavigator<MainStackParamList>();

const MainStackNavigator: React.FC = () => {
  const colors = useColors();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false, // 각 네비게이터에서 자체 헤더 관리
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
      initialRouteName="Auth" // TODO: 인증 상태에 따라 동적으로 설정
    >
      {/* 인증 스택 */}
      <Stack.Screen
        name="Auth"
        component={AuthStackNavigator}
        options={{
          animationTypeForReplace: 'push',
        }}
      />

      {/* 메인 앱 (탭 네비게이터) */}
      <Stack.Screen
        name="Main"
        component={TabNavigator}
        options={{
          animationTypeForReplace: 'push',
        }}
      />

      {/* 학습 플로우 */}
      <Stack.Screen
        name="StudyFlow"
        component={StudyStackNavigator}
        options={{
          presentation: 'card',
        }}
      />
      
      {/* 개별 스크린들 - 웹 라우팅과 동일하게 구성 */}
      <Stack.Screen
        name="Dictionary"
        component={DictionaryScreen}
        options={{ title: '사전' }}
      />
      
      <Stack.Screen
        name="Wordbook"
        component={WordbookScreen}
        options={{ title: '내 단어장' }}
      />
      
      <Stack.Screen
        name="SrsDashboard"
        component={SrsDashboardScreen}
        options={{ title: 'SRS 학습' }}
      />
      
      <Stack.Screen
        name="Reading"
        component={ReadingScreen}
        options={{ title: '리딩' }}
      />
      
      <Stack.Screen
        name="Listening"
        component={ListeningScreen}
        options={{ title: '리스닝' }}
      />
      
      <Stack.Screen
        name="Quiz"
        component={QuizScreen}
        options={{ title: '퀴즈' }}
      />

      {/* 모달 스크린들 */}
      <Stack.Group screenOptions={{ presentation: 'modal' }}>
        <Stack.Screen
          name="Modal"
          component={ModalScreen}
          options={{
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
      </Stack.Group>
    </Stack.Navigator>
  );
};

// 모달 컴포넌트 래퍼
interface ModalScreenProps {
  route: {
    params: {
      component: 'CardReport' | 'VocabDetail' | 'Settings';
      params?: any;
    };
  };
  navigation: any;
}

const ModalScreen: React.FC<ModalScreenProps> = ({ route, navigation }) => {
  const { component, params } = route.params;

  const handleClose = () => {
    navigation.goBack();
  };

  switch (component) {
    case 'CardReport':
      return (
        <CardReportModal
          isOpen={true}
          onClose={handleClose}
          vocabId={params?.vocabId}
          vocabLemma={params?.vocabLemma}
          onReportSubmitted={params?.onReportSubmitted}
        />
      );
    case 'VocabDetail':
      // TODO: VocabDetailModal 컴포넌트 구현 후 교체
      return (
        <VocabCard
          vocab={params?.vocab}
          card={params?.card}
          onPress={handleClose}
        />
      );
    case 'Settings':
      // TODO: SettingsModal 컴포넌트 구현 후 교체
      return null;
    default:
      return null;
  }
};

export default MainStackNavigator;