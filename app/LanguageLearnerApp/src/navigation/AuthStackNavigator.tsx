// src/navigation/AuthStackNavigator.tsx
// 인증 스택 네비게이터

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './types';
import { useColors } from '../context/ThemeContext';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthStackNavigator: React.FC = () => {
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
      }}
      initialRouteName="Login"
    >
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{
          title: '로그인',
          headerShown: false, // 로그인 화면은 자체 헤더 사용
        }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{
          title: '회원가입',
          headerBackTitleVisible: false,
          headerLeftLabelVisible: false,
        }}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={LoginScreen} // TODO: ForgotPasswordScreen 생성 후 교체
        options={{
          title: '비밀번호 찾기',
          headerBackTitleVisible: false,
          headerLeftLabelVisible: false,
        }}
      />
      <Stack.Screen
        name="ResetPassword"
        component={LoginScreen} // TODO: ResetPasswordScreen 생성 후 교체
        options={{
          title: '비밀번호 재설정',
          headerBackTitleVisible: false,
          headerLeftLabelVisible: false,
        }}
      />
    </Stack.Navigator>
  );
};

export default AuthStackNavigator;