/*
  AppHeader.tsx — React Native 버전
  ------------------------------------------------------------
  웹 Header.jsx를 모바일 앱에 맞게 리팩토링
  네비게이션 헤더 컴포넌트
*/

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../hooks/useAuth';

interface AppHeaderProps {
  title?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightButton?: React.ReactNode;
  navigation?: any;
}

export default function AppHeader({
  title,
  showBackButton = false,
  onBackPress,
  rightButton,
  navigation,
}: AppHeaderProps) {
  const { user, logout } = useAuth();
  const isLoggedIn = !!user;

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else if (navigation) {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Left Section */}
        <View style={styles.leftSection}>
          {showBackButton ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackPress}
              activeOpacity={0.7}
            >
              <Icon name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
          ) : (
            <View style={styles.logoContainer}>
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoEmoji}>🦆</Text>
              </View>
              <Text style={styles.brandText}>단무새</Text>
            </View>
          )}
        </View>

        {/* Center Section */}
        <View style={styles.centerSection}>
          {title && <Text style={styles.titleText}>{title}</Text>}
        </View>

        {/* Right Section */}
        <View style={styles.rightSection}>
          {rightButton || (
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => navigation?.navigate('Profile')}
              activeOpacity={0.7}
            >
              <Icon 
                name={isLoggedIn ? "person-circle" : "menu"} 
                size={24} 
                color="#333" 
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  container: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  leftSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 2,
    alignItems: 'center',
  },
  rightSection: {
    flex: 1,
    alignItems: 'flex-end',
  },
  backButton: {
    padding: 4,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logoPlaceholder: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: {
    fontSize: 24,
  },
  brandText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8b4513',
  },
  titleText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  menuButton: {
    padding: 4,
  },
});