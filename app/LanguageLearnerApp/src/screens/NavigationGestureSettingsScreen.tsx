// src/screens/NavigationGestureSettingsScreen.tsx
// 네비게이션 제스처 설정 화면

import React, { useState } from 'react';
import { View, Text, ScrollView, Switch, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useThemedStyles, useColors } from '../context/ThemeContext';
import { Theme } from '../theme';
import { TouchFeedback } from '../components/animations';
import NavigationHeader from '../navigation/components/NavigationHeader';
import { 
  GestureScreen,
  useGestureConfig,
  useScreenGestures 
} from '../components/gestures/NavigationGestureProvider';

const NavigationGestureSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  
  const {
    config,
    toggleSwipeBack,
    togglePullToRefresh,
    toggleLongPress,
    toggleHapticFeedback,
    setSwipeThreshold,
    setLongPressDuration,
    setRefreshThreshold,
  } = useGestureConfig();

  const {
    isRefreshing,
    createRefreshHandler,
    createContextMenu,
  } = useScreenGestures('NavigationGestureSettings');

  const [selectedThreshold, setSelectedThreshold] = useState(config.swipeBackThreshold);
  const [selectedDuration, setSelectedDuration] = useState(config.longPressDuration);
  const [selectedRefreshThreshold, setSelectedRefreshThreshold] = useState(config.refreshThreshold);

  // 새로고침 핸들러
  const handleRefresh = createRefreshHandler(async () => {
    // 설정을 다시 로드하는 로직
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  // 컨텍스트 메뉴 옵션
  const contextMenuOptions = createContextMenu([
    {
      title: '기본값으로 복원',
      icon: '🔄',
      onPress: handleResetToDefaults,
    },
    {
      title: '제스처 테스트',
      icon: '🧪',
      onPress: handleTestGestures,
    },
  ]);

  // 기본값으로 복원
  function handleResetToDefaults() {
    Alert.alert(
      '기본값으로 복원',
      '모든 제스처 설정을 기본값으로 복원하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '복원',
          style: 'destructive',
          onPress: () => {
            setSwipeThreshold(100);
            setLongPressDuration(500);
            setRefreshThreshold(80);
            setSelectedThreshold(100);
            setSelectedDuration(500);
            setSelectedRefreshThreshold(80);
          },
        },
      ]
    );
  }

  // 제스처 테스트
  function handleTestGestures() {
    Alert.alert(
      '제스처 테스트',
      '다음 제스처들을 테스트해보세요:\n\n' +
      '• 화면 왼쪽 가장자리에서 오른쪽으로 스와이프 (뒤로가기)\n' +
      '• 화면을 아래로 당기기 (새로고침)\n' +
      '• 카드나 버튼을 길게 누르기 (옵션 메뉴)',
      [{ text: '확인' }]
    );
  }

  // 임계값 선택 옵션들
  const thresholdOptions = [
    { label: '민감함 (50px)', value: 50 },
    { label: '보통 (100px)', value: 100 },
    { label: '둔감함 (150px)', value: 150 },
    { label: '매우 둔감함 (200px)', value: 200 },
  ];

  const durationOptions = [
    { label: '매우 빠름 (300ms)', value: 300 },
    { label: '빠름 (500ms)', value: 500 },
    { label: '보통 (700ms)', value: 700 },
    { label: '느림 (1000ms)', value: 1000 },
  ];

  const refreshThresholdOptions = [
    { label: '민감함 (60px)', value: 60 },
    { label: '보통 (80px)', value: 80 },
    { label: '둔감함 (100px)', value: 100 },
    { label: '매우 둔감함 (120px)', value: 120 },
  ];

  return (
    <GestureScreen
      screenName="NavigationGestureSettings"
      refreshHandler={handleRefresh}
      contextMenuOptions={contextMenuOptions}
      refreshing={isRefreshing}
    >
      <NavigationHeader title="제스처 설정" />
      
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* 기본 제스처 활성화/비활성화 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>기본 제스처</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>스와이프 뒤로가기</Text>
              <Text style={styles.settingDescription}>
                화면 왼쪽 가장자리에서 스와이프하여 뒤로가기
              </Text>
            </View>
            <Switch
              value={config.enableSwipeBack}
              onValueChange={toggleSwipeBack}
              trackColor={{ false: colors.backgroundTertiary, true: colors.primaryLight }}
              thumbColor={config.enableSwipeBack ? colors.primary : colors.textSecondary}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>당겨서 새로고침</Text>
              <Text style={styles.settingDescription}>
                화면을 아래로 당겨서 새로고침
              </Text>
            </View>
            <Switch
              value={config.enablePullToRefresh}
              onValueChange={togglePullToRefresh}
              trackColor={{ false: colors.backgroundTertiary, true: colors.primaryLight }}
              thumbColor={config.enablePullToRefresh ? colors.primary : colors.textSecondary}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>길게 누르기 메뉴</Text>
              <Text style={styles.settingDescription}>
                항목을 길게 눌러서 옵션 메뉴 표시
              </Text>
            </View>
            <Switch
              value={config.enableLongPress}
              onValueChange={toggleLongPress}
              trackColor={{ false: colors.backgroundTertiary, true: colors.primaryLight }}
              thumbColor={config.enableLongPress ? colors.primary : colors.textSecondary}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>햅틱 피드백</Text>
              <Text style={styles.settingDescription}>
                제스처 실행 시 진동 피드백
              </Text>
            </View>
            <Switch
              value={config.hapticFeedback}
              onValueChange={toggleHapticFeedback}
              trackColor={{ false: colors.backgroundTertiary, true: colors.primaryLight }}
              thumbColor={config.hapticFeedback ? colors.primary : colors.textSecondary}
            />
          </View>
        </View>

        {/* 스와이프 임계값 설정 */}
        {config.enableSwipeBack && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>스와이프 뒤로가기 감도</Text>
            <Text style={styles.sectionDescription}>
              뒤로가기 제스처가 동작할 거리를 설정합니다
            </Text>
            
            {thresholdOptions.map((option) => (
              <TouchFeedback
                key={option.value}
                style={[
                  styles.optionItem,
                  selectedThreshold === option.value && styles.selectedOption,
                ]}
                onPress={() => {
                  setSelectedThreshold(option.value);
                  setSwipeThreshold(option.value);
                }}
              >
                <View style={styles.radioButton}>
                  <View
                    style={[
                      styles.radioInner,
                      selectedThreshold === option.value && styles.radioSelected,
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.optionText,
                    selectedThreshold === option.value && styles.selectedOptionText,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchFeedback>
            ))}
          </View>
        )}

        {/* 길게 누르기 지속시간 설정 */}
        {config.enableLongPress && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>길게 누르기 지속시간</Text>
            <Text style={styles.sectionDescription}>
              옵션 메뉴가 나타날 때까지의 시간을 설정합니다
            </Text>
            
            {durationOptions.map((option) => (
              <TouchFeedback
                key={option.value}
                style={[
                  styles.optionItem,
                  selectedDuration === option.value && styles.selectedOption,
                ]}
                onPress={() => {
                  setSelectedDuration(option.value);
                  setLongPressDuration(option.value);
                }}
              >
                <View style={styles.radioButton}>
                  <View
                    style={[
                      styles.radioInner,
                      selectedDuration === option.value && styles.radioSelected,
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.optionText,
                    selectedDuration === option.value && styles.selectedOptionText,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchFeedback>
            ))}
          </View>
        )}

        {/* 새로고침 임계값 설정 */}
        {config.enablePullToRefresh && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>새로고침 감도</Text>
            <Text style={styles.sectionDescription}>
              새로고침이 실행될 당김 거리를 설정합니다
            </Text>
            
            {refreshThresholdOptions.map((option) => (
              <TouchFeedback
                key={option.value}
                style={[
                  styles.optionItem,
                  selectedRefreshThreshold === option.value && styles.selectedOption,
                ]}
                onPress={() => {
                  setSelectedRefreshThreshold(option.value);
                  setRefreshThreshold(option.value);
                }}
              >
                <View style={styles.radioButton}>
                  <View
                    style={[
                      styles.radioInner,
                      selectedRefreshThreshold === option.value && styles.radioSelected,
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.optionText,
                    selectedRefreshThreshold === option.value && styles.selectedOptionText,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchFeedback>
            ))}
          </View>
        )}

        {/* 도움말 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>도움말</Text>
          
          <View style={styles.helpItem}>
            <Text style={styles.helpTitle}>💫 스와이프 뒤로가기</Text>
            <Text style={styles.helpText}>
              화면 왼쪽 가장자리 (약 20px 이내)에서 시작하여 오른쪽으로 스와이프하면 이전 화면으로 돌아갑니다.
            </Text>
          </View>

          <View style={styles.helpItem}>
            <Text style={styles.helpTitle}>🔄 당겨서 새로고침</Text>
            <Text style={styles.helpText}>
              화면 최상단에서 아래로 당기면 현재 화면의 내용을 새로고침할 수 있습니다.
            </Text>
          </View>

          <View style={styles.helpItem}>
            <Text style={styles.helpTitle}>📱 길게 누르기</Text>
            <Text style={styles.helpText}>
              카드나 버튼을 설정한 시간만큼 길게 누르면 관련 옵션 메뉴가 나타납니다.
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
  },
  settingItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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
  optionText: {
    ...theme.typography.body1,
    color: theme.colors.text,
  },
  selectedOptionText: {
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

export default NavigationGestureSettingsScreen;