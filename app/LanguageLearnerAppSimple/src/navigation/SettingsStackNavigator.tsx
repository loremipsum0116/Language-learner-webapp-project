// src/navigation/SettingsStackNavigator.tsx
// 설정 스택 네비게이터

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettingsStackParamList } from './types';
import { useColors } from '../context/ThemeContext';

// Screens
import SettingsScreen from '../screens/settings/SettingsScreen';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

// Placeholder screens (TODO: 실제 화면 구현 후 교체)
const ProfileScreen = SettingsScreen;
const AccountScreen = SettingsScreen;
const PreferencesScreen = SettingsScreen;
const ThemeScreen = SettingsScreen;
const NotificationsScreen = SettingsScreen;
const PrivacyScreen = SettingsScreen;
const AboutScreen = SettingsScreen;
const HelpScreen = SettingsScreen;
const FeedbackScreen = SettingsScreen;

const SettingsStackNavigator: React.FC = () => {
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
      initialRouteName="SettingsMain"
    >
      <Stack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{
          title: '설정',
          headerShown: false, // 탭 네비게이터에서 관리
        }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: '프로필',
        }}
      />
      <Stack.Screen
        name="Account"
        component={AccountScreen}
        options={{
          title: '계정 설정',
        }}
      />
      <Stack.Screen
        name="Preferences"
        component={PreferencesScreen}
        options={{
          title: '환경설정',
        }}
      />
      <Stack.Screen
        name="Theme"
        component={ThemeScreen}
        options={{
          title: '테마 설정',
        }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: '알림 설정',
        }}
      />
      <Stack.Screen
        name="Privacy"
        component={PrivacyScreen}
        options={{
          title: '개인정보 설정',
        }}
      />
      <Stack.Screen
        name="About"
        component={AboutScreen}
        options={{
          title: '앱 정보',
        }}
      />
      <Stack.Screen
        name="Help"
        component={HelpScreen}
        options={{
          title: '도움말',
        }}
      />
      <Stack.Screen
        name="Feedback"
        component={FeedbackScreen}
        options={{
          title: '피드백',
          presentation: 'modal', // 모달 형태로 표시
        }}
      />
    </Stack.Navigator>
  );
};

export default SettingsStackNavigator;