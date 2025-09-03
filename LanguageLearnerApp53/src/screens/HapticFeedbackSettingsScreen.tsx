// src/screens/HapticFeedbackSettingsScreen.tsx
// 햅틱 피드백 설정 화면

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useThemedStyles, useColors } from '../context/ThemeContext';
import { Theme } from '../theme';
import { TouchFeedback } from '../components/animations';
import NavigationHeader from '../navigation/components/NavigationHeader';
import { 
  GestureScreen,
  useScreenGestures 
} from '../components/gestures';
import { hapticService, HapticType, useHapticFeedback } from '../services/HapticFeedbackService';

const HapticFeedbackSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const { trigger, testHaptic } = useHapticFeedback();
  
  const [settings, setSettings] = useState(hapticService.getSettings());
  const [isSupported, setIsSupported] = useState(hapticService.isSupported());

  const {
    isRefreshing,
    createRefreshHandler,
    createContextMenu,
  } = useScreenGestures('HapticFeedbackSettings');

  // 새로고침 핸들러
  const handleRefresh = createRefreshHandler(async () => {
    const currentSettings = hapticService.getSettings();
    setSettings(currentSettings);
  });

  // 컨텍스트 메뉴 옵션
  const contextMenuOptions = createContextMenu([
    {
      title: '모든 햅틱 테스트',
      icon: '🧪',
      onPress: handleTestAllHaptics,
    },
    {
      title: '기본값으로 복원',
      icon: '🔄',
      onPress: handleResetToDefaults,
    },
  ]);

  // 설정 변경 시 자동 저장
  useEffect(() => {
    hapticService.updateSettings(settings);
  }, [settings]);

  // 전체 햅틱 활성화/비활성화
  const toggleHapticEnabled = (enabled: boolean) => {
    if (enabled) {
      trigger(HapticType.SUCCESS);
    }
    setSettings(prev => ({ ...prev, enabled }));
  };

  // 강도 변경
  const changeIntensity = (intensity: 'light' | 'medium' | 'heavy') => {
    trigger(HapticType.SELECTION);
    setSettings(prev => ({ ...prev, intensity }));
  };

  // 개별 햅틱 타입 토글
  const toggleHapticType = (type: HapticType, enabled: boolean) => {
    if (enabled) {
      testHaptic(type);
    }
    setSettings(prev => ({
      ...prev,
      enabledTypes: {
        ...prev.enabledTypes,
        [type]: enabled,
      },
    }));
  };

  // 모든 햅틱 테스트
  function handleTestAllHaptics() {
    hapticService.testAllHaptics();
  }

  // 기본값으로 복원
  function handleResetToDefaults() {
    Alert.alert(
      '기본값으로 복원',
      '모든 햅틱 피드백 설정을 기본값으로 복원하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '복원',
          style: 'destructive',
          onPress: () => {
            hapticService.resetSettings().then(() => {
              const defaultSettings = hapticService.getSettings();
              setSettings(defaultSettings);
              trigger(HapticType.SUCCESS);
            });
          },
        },
      ]
    );
  }

  // 햅틱 타입별 설정 항목들
  const hapticTypeSettings = [
    {
      type: HapticType.BUTTON_PRESS,
      title: '버튼 터치',
      description: '버튼을 누를 때',
      icon: '👆',
    },
    {
      type: HapticType.CORRECT_ANSWER,
      title: '정답',
      description: '정답을 맞혔을 때',
      icon: '✅',
    },
    {
      type: HapticType.WRONG_ANSWER,
      title: '오답',
      description: '답을 틀렸을 때',
      icon: '❌',
    },
    {
      type: HapticType.CARD_SWIPE,
      title: '카드 스와이프',
      description: '학습 카드를 넘길 때',
      icon: '👉',
    },
    {
      type: HapticType.LEVEL_UP,
      title: '레벨 업',
      description: '레벨이 상승할 때',
      icon: '⬆️',
    },
    {
      type: HapticType.ACHIEVEMENT,
      title: '성취',
      description: '업적을 달성했을 때',
      icon: '🏆',
    },
    {
      type: HapticType.NAVIGATION,
      title: '네비게이션',
      description: '화면 전환 시',
      icon: '🧭',
    },
    {
      type: HapticType.LONG_PRESS,
      title: '길게 누르기',
      description: '롱 프레스 메뉴 표시 시',
      icon: '👆',
    },
    {
      type: HapticType.PULL_TO_REFRESH,
      title: '당겨서 새로고침',
      description: '새로고침 동작 시',
      icon: '🔄',
    },
  ];

  // 강도 옵션들
  const intensityOptions = [
    { value: 'light' as const, label: '약함', description: '미묘한 진동' },
    { value: 'medium' as const, label: '보통', description: '적절한 강도' },
    { value: 'heavy' as const, label: '강함', description: '강한 진동' },
  ];

  if (!isSupported) {
    return (
      <View style={styles.container}>
        <NavigationHeader title="햅틱 피드백" />
        <View style={styles.unsupportedContainer}>
          <Text style={styles.unsupportedTitle}>지원하지 않는 기기</Text>
          <Text style={styles.unsupportedText}>
            이 기기에서는 햅틱 피드백이 지원되지 않습니다.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <GestureScreen
      screenName="HapticFeedbackSettings"
      refreshHandler={handleRefresh}
      contextMenuOptions={contextMenuOptions}
      refreshing={isRefreshing}
    >
      <NavigationHeader title="햅틱 피드백" />
      
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* 전체 설정 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>전체 설정</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>햅틱 피드백 사용</Text>
              <Text style={styles.settingDescription}>
                모든 햅틱 피드백 활성화/비활성화
              </Text>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={toggleHapticEnabled}
              trackColor={{ false: colors.backgroundTertiary, true: colors.primaryLight }}
              thumbColor={settings.enabled ? colors.primary : colors.textSecondary}
            />
          </View>
        </View>

        {/* 강도 설정 */}
        {settings.enabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>진동 강도</Text>
            <Text style={styles.sectionDescription}>
              햅틱 피드백의 전체적인 강도를 조정합니다
            </Text>
            
            {intensityOptions.map((option) => (
              <TouchFeedback
                key={option.value}
                style={[
                  styles.optionItem,
                  settings.intensity === option.value && styles.selectedOption,
                ]}
                onPress={() => changeIntensity(option.value)}
                hapticType={HapticType.SELECTION}
              >
                <View style={styles.radioButton}>
                  <View
                    style={[
                      styles.radioInner,
                      settings.intensity === option.value && styles.radioSelected,
                    ]}
                  />
                </View>
                <View style={styles.optionContent}>
                  <Text
                    style={[
                      styles.optionText,
                      settings.intensity === option.value && styles.selectedOptionText,
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text style={styles.optionDescription}>
                    {option.description}
                  </Text>
                </View>
              </TouchFeedback>
            ))}
          </View>
        )}

        {/* 개별 햅틱 설정 */}
        {settings.enabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>세부 설정</Text>
            <Text style={styles.sectionDescription}>
              각 상황별로 햅틱 피드백을 개별적으로 설정할 수 있습니다
            </Text>
            
            {hapticTypeSettings.map(({ type, title, description, icon }) => (
              <View key={type} style={styles.settingItem}>
                <View style={styles.hapticItemInfo}>
                  <Text style={styles.hapticIcon}>{icon}</Text>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>{title}</Text>
                    <Text style={styles.settingDescription}>{description}</Text>
                  </View>
                </View>
                <Switch
                  value={settings.enabledTypes[type] ?? true}
                  onValueChange={(enabled) => toggleHapticType(type, enabled)}
                  trackColor={{ false: colors.backgroundTertiary, true: colors.primaryLight }}
                  thumbColor={
                    settings.enabledTypes[type] ? colors.primary : colors.textSecondary
                  }
                />
              </View>
            ))}
          </View>
        )}

        {/* 테스트 섹션 */}
        {settings.enabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>테스트</Text>
            <Text style={styles.sectionDescription}>
              각 햅틱 피드백을 미리 체험해볼 수 있습니다
            </Text>
            
            <View style={styles.testButtonContainer}>
              {hapticTypeSettings.slice(0, 6).map(({ type, title, icon }) => (
                <TouchFeedback
                  key={type}
                  style={styles.testButton}
                  onPress={() => testHaptic(type)}
                  hapticType={type}
                >
                  <Text style={styles.testButtonIcon}>{icon}</Text>
                  <Text style={styles.testButtonText}>{title}</Text>
                </TouchFeedback>
              ))}
            </View>

            <TouchFeedback
              style={styles.testAllButton}
              onPress={handleTestAllHaptics}
              hapticType={HapticType.IMPORTANT_ACTION}
            >
              <Text style={styles.testAllButtonText}>모든 햅틱 순서대로 테스트</Text>
            </TouchFeedback>
          </View>
        )}

        {/* 도움말 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>도움말</Text>
          
          <View style={styles.helpItem}>
            <Text style={styles.helpTitle}>🎯 정확한 피드백</Text>
            <Text style={styles.helpText}>
              각 상황에 맞는 적절한 햅틱 피드백으로 학습 경험을 향상시킵니다.
            </Text>
          </View>

          <View style={styles.helpItem}>
            <Text style={styles.helpTitle}>⚡ 즉시 반응</Text>
            <Text style={styles.helpText}>
              터치나 액션과 동시에 피드백이 제공되어 더 자연스러운 상호작용을 제공합니다.
            </Text>
          </View>

          <View style={styles.helpItem}>
            <Text style={styles.helpTitle}>🔋 배터리 절약</Text>
            <Text style={styles.helpText}>
              필요한 상황에만 선택적으로 햅틱 피드백을 사용하여 배터리를 절약할 수 있습니다.
            </Text>
          </View>
        </View>
        
        <View style={styles.bottomPadding} />
      </ScrollView>
    </GestureScreen>
  );
};

const createStyles = (theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  unsupportedContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: theme.spacing.xl,
  },
  unsupportedTitle: {
    ...theme.typography.h2,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    textAlign: 'center' as const,
  },
  unsupportedText: {
    ...theme.typography.body1,
    color: theme.colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 24,
  },
  section: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    borderRadius: theme.spacing.md,
    padding: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.typography.h4,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  sectionDescription: {
    ...theme.typography.body2,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    lineHeight: 20,
  },
  settingItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  hapticItemInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flex: 1,
  },
  hapticIcon: {
    fontSize: 20,
    marginRight: theme.spacing.sm,
    width: 30,
    textAlign: 'center' as const,
  },
  settingInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  settingTitle: {
    ...theme.typography.body1,
    color: theme.colors.text,
    fontWeight: theme.typography.fontWeight.medium,
    marginBottom: theme.spacing.xs / 2,
  },
  settingDescription: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  optionItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.xs / 2,
    borderRadius: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  selectedOption: {
    backgroundColor: theme.colors.primaryLight,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  radioSelected: {
    backgroundColor: theme.colors.primary,
  },
  optionContent: {
    flex: 1,
  },
  optionText: {
    ...theme.typography.body1,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs / 2,
  },
  selectedOptionText: {
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  optionDescription: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  testButtonContainer: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  testButton: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.colors.background,
    borderRadius: theme.spacing.sm,
    padding: theme.spacing.sm,
    minWidth: 80,
    minHeight: 80,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  testButtonIcon: {
    fontSize: 24,
    marginBottom: theme.spacing.xs,
  },
  testButtonText: {
    ...theme.typography.caption,
    color: theme.colors.text,
    textAlign: 'center' as const,
  },
  testAllButton: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.spacing.sm,
    padding: theme.spacing.md,
    alignItems: 'center' as const,
  },
  testAllButtonText: {
    ...theme.typography.button,
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  helpItem: {
    marginBottom: theme.spacing.md,
  },
  helpTitle: {
    ...theme.typography.body1,
    color: theme.colors.text,
    fontWeight: theme.typography.fontWeight.medium,
    marginBottom: theme.spacing.xs,
  },
  helpText: {
    ...theme.typography.body2,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  bottomPadding: {
    height: theme.spacing.xl,
  },
});

export default HapticFeedbackSettingsScreen;