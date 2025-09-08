// src/screens/onboarding/OnboardingScreen.tsx
// 온보딩 화면

import React from 'react';
import { View, Text } from 'react-native';
import { useThemedStyles } from '../../context/ThemeContext';
import { Theme } from '../../theme';

const OnboardingScreen: React.FC = () => {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>온보딩 화면</Text>
      <Text style={styles.subtitle}>앱 사용법을 안내합니다</Text>
    </View>
  );
};

const createStyles = (theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: theme.spacing.lg,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  subtitle: {
    ...theme.typography.body1,
    color: theme.colors.textSecondary,
    textAlign: 'center' as const,
  },
});

export default OnboardingScreen;