// src/screens/splash/SplashScreen.tsx
// 스플래시 화면

import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useThemedStyles } from '../../context/ThemeContext';
import { Theme } from '../../theme';

const SplashScreen: React.FC = () => {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Language Learner</Text>
      <Text style={styles.subtitle}>언어 학습의 새로운 경험</Text>
      <ActivityIndicator 
        size="large" 
        color={styles.loader.color} 
        style={styles.loader} 
      />
    </View>
  );
};

const createStyles = (theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: theme.spacing.lg,
  },
  title: {
    ...theme.typography.display1,
    color: theme.colors.textInverse,
    textAlign: 'center' as const,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    ...theme.typography.subtitle1,
    color: theme.colors.textInverse,
    textAlign: 'center' as const,
    opacity: 0.9,
    marginBottom: theme.spacing.xl,
  },
  loader: {
    color: theme.colors.textInverse,
    marginTop: theme.spacing.xl,
  },
});

export default SplashScreen;