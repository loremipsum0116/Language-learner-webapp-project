// src/screens/settings/SettingsScreen.tsx
// 설정 화면

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TabScreenProps } from '../../navigation/types';
import { useThemedStyles } from '../../context/ThemeContext';
import { Theme } from '../../theme';

type Props = TabScreenProps<'Settings'>;

const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>설정 화면</Text>
      <Text style={styles.subtitle}>앱 설정을 관리하세요</Text>
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

export default SettingsScreen;