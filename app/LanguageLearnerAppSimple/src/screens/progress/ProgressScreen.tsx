// src/screens/progress/ProgressScreen.tsx
// 진도 화면

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TabScreenProps } from '../../navigation/types';
import { useThemedStyles } from '../../context/ThemeContext';
import { Theme } from '../../theme';

type Props = TabScreenProps<'Progress'>;

const ProgressScreen: React.FC<Props> = ({ navigation }) => {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>진도 화면</Text>
      <Text style={styles.subtitle}>학습 진도와 통계를 확인하세요</Text>
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

export default ProgressScreen;