// src/navigation/TabNavigator.tsx
// 하단 탭 네비게이터

import React from 'react';
import { Text, View, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TabNavigatorParamList } from './types';
import { useTheme, useColors } from '../context/ThemeContext';
import { scale } from '../utils/responsive';

// Screens
import HomeScreen from '../screens/main/HomeScreen';
import StudyScreen from '../screens/main/StudyScreen';
import ProgressScreen from '../screens/progress/ProgressScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';

// New Feature Screens
import QuizScreen from '../screens/QuizScreen';
import ReadingScreen from '../screens/ReadingScreen';
import ListeningScreen from '../screens/ListeningScreen';
import DictionaryScreen from '../screens/DictionaryScreen';
import ExamVocabScreen from '../screens/ExamVocabScreen';
import IdiomsScreen from '../screens/IdiomsScreen';
import WordbookScreen from '../screens/WordbookScreen';

const Tab = createBottomTabNavigator<TabNavigatorParamList>();

// Tab Icon Component
interface TabIconProps {
  name: string;
  focused: boolean;
  color: string;
  size: number;
}

const TabIcon: React.FC<TabIconProps> = ({ name, focused, color, size }) => {
  const getIcon = () => {
    switch (name) {
      case 'Home':
        return focused ? '🏠' : '🏡';
      case 'Study':
        return focused ? '📚' : '📖';
      case 'Progress':
        return focused ? '📊' : '📈';
      case 'Settings':
        return focused ? '⚙️' : '⚪';
      default:
        return '❓';
    }
  };

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size, color }}>
        {getIcon()}
      </Text>
    </View>
  );
};

// Badge Component
interface BadgeProps {
  count?: number;
  showDot?: boolean;
}

const TabBadge: React.FC<BadgeProps> = ({ count, showDot }) => {
  const colors = useColors();
  
  if (!count && !showDot) return null;
  
  return (
    <View
      style={{
        position: 'absolute',
        right: -6,
        top: -3,
        backgroundColor: colors.error,
        borderRadius: showDot ? 4 : 10,
        minWidth: showDot ? 8 : 20,
        height: showDot ? 8 : 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: colors.surface,
      }}
    >
      {!showDot && count && (
        <Text
          style={{
            color: colors.textInverse,
            fontSize: 12,
            fontWeight: 'bold',
          }}
        >
          {count > 99 ? '99+' : count}
        </Text>
      )}
    </View>
  );
};

const TabNavigator: React.FC = () => {
  const { theme, isDark } = useTheme();
  const colors = useColors();

  // Mock data for badges (실제로는 상태 관리에서 가져와야 함)
  const badges = {
    Study: { count: 5 }, // 복습할 카드 수
    Progress: { showDot: true }, // 새로운 업데이트
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => (
          <View style={{ position: 'relative' }}>
            <TabIcon 
              name={route.name} 
              focused={focused} 
              color={color} 
              size={size} 
            />
            {route.name === 'Study' && badges.Study && (
              <TabBadge count={badges.Study.count} />
            )}
            {route.name === 'Progress' && badges.Progress && (
              <TabBadge showDot={badges.Progress.showDot} />
            )}
          </View>
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 20 : 5,
          paddingTop: 5,
          height: Platform.OS === 'ios' ? 88 : 60,
          shadowColor: colors.shadow,
          shadowOffset: {
            width: 0,
            height: -2,
          },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: scale(12),
          fontWeight: '500',
          marginTop: 4,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        headerShown: false, // 각 화면에서 자체 헤더를 관리
        tabBarHideOnKeyboard: true, // Android에서 키보드 표시시 탭바 숨김
      })}
      initialRouteName="Home"
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: '홈',
          tabBarAccessibilityLabel: '홈 화면',
        }}
      />
      <Tab.Screen
        name="Study"
        component={StudyScreen}
        options={{
          tabBarLabel: '학습',
          tabBarAccessibilityLabel: '학습 화면',
        }}
      />
      <Tab.Screen
        name="Progress"
        component={ProgressScreen}
        options={{
          tabBarLabel: '진도',
          tabBarAccessibilityLabel: '진도 화면',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: '설정',
          tabBarAccessibilityLabel: '설정 화면',
        }}
      />
    </Tab.Navigator>
  );
};

export default TabNavigator;