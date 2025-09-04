/*
  LogoutScreen.tsx — React Native 버전
  ------------------------------------------------------------
  웹 Logout.jsx를 모바일 앱에 맞게 리팩토링
*/

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../hooks/useAuth';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Logout'>;

export default function LogoutScreen({ navigation }: Props) {
  const { logout } = useAuth();

  useEffect(() => {
    const performLogout = async () => {
      try {
        await logout();
      } finally {
        // 로그아웃 후 로그인 화면으로 이동
        // 하지만 일반적으로 React Native에서는 authentication state change가
        // RootNavigator에서 자동으로 처리되므로 명시적 navigation이 필요없을 수 있음
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }
    };

    performLogout();
  }, [logout, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.message}>로그아웃 중...</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
});