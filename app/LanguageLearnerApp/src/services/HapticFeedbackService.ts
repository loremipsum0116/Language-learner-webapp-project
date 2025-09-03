// src/services/HapticFeedbackService.ts
// 햅틱 피드백 서비스

import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 햅틱 피드백 타입 정의
export enum HapticType {
  // 기본 피드백
  LIGHT = 'impactLight',
  MEDIUM = 'impactMedium',
  HEAVY = 'impactHeavy',
  
  // 알림 피드백
  SUCCESS = 'notificationSuccess',
  WARNING = 'notificationWarning',
  ERROR = 'notificationError',
  
  // 선택 피드백
  SELECTION = 'selection',
  
  // iOS 전용
  RIGID = 'rigid',
  SOFT = 'soft',
  
  // 사용자 정의 타입
  BUTTON_PRESS = 'buttonPress',
  CORRECT_ANSWER = 'correctAnswer',
  WRONG_ANSWER = 'wrongAnswer',
  IMPORTANT_ACTION = 'importantAction',
  CARD_SWIPE = 'cardSwipe',
  LEVEL_UP = 'levelUp',
  ACHIEVEMENT = 'achievement',
  NAVIGATION = 'navigation',
  LONG_PRESS = 'longPress',
  PULL_TO_REFRESH = 'pullToRefresh',
}

// 햅틱 설정 인터페이스
interface HapticSettings {
  enabled: boolean;
  intensity: 'light' | 'medium' | 'heavy';
  enabledTypes: {
    [key in HapticType]?: boolean;
  };
}

// 기본 설정
const defaultSettings: HapticSettings = {
  enabled: true,
  intensity: 'medium',
  enabledTypes: {
    [HapticType.BUTTON_PRESS]: true,
    [HapticType.CORRECT_ANSWER]: true,
    [HapticType.WRONG_ANSWER]: true,
    [HapticType.IMPORTANT_ACTION]: true,
    [HapticType.CARD_SWIPE]: true,
    [HapticType.LEVEL_UP]: true,
    [HapticType.ACHIEVEMENT]: true,
    [HapticType.NAVIGATION]: true,
    [HapticType.LONG_PRESS]: true,
    [HapticType.PULL_TO_REFRESH]: true,
  },
};

// 햅틱 타입별 매핑
const hapticTypeMapping: Record<HapticType, string> = {
  [HapticType.LIGHT]: 'impactLight',
  [HapticType.MEDIUM]: 'impactMedium',
  [HapticType.HEAVY]: 'impactHeavy',
  [HapticType.SUCCESS]: 'notificationSuccess',
  [HapticType.WARNING]: 'notificationWarning',
  [HapticType.ERROR]: 'notificationError',
  [HapticType.SELECTION]: 'selection',
  [HapticType.RIGID]: 'rigid',
  [HapticType.SOFT]: 'soft',
  
  // 사용자 정의 매핑
  [HapticType.BUTTON_PRESS]: 'impactLight',
  [HapticType.CORRECT_ANSWER]: 'notificationSuccess',
  [HapticType.WRONG_ANSWER]: 'notificationError',
  [HapticType.IMPORTANT_ACTION]: 'impactHeavy',
  [HapticType.CARD_SWIPE]: 'selection',
  [HapticType.LEVEL_UP]: 'notificationSuccess',
  [HapticType.ACHIEVEMENT]: 'notificationSuccess',
  [HapticType.NAVIGATION]: 'impactLight',
  [HapticType.LONG_PRESS]: 'impactMedium',
  [HapticType.PULL_TO_REFRESH]: 'impactLight',
};

// 강도별 매핑
const intensityMapping = {
  light: 'impactLight',
  medium: 'impactMedium',
  heavy: 'impactHeavy',
};

class HapticFeedbackService {
  private settings: HapticSettings = defaultSettings;
  private readonly SETTINGS_KEY = '@haptic_settings';

  constructor() {
    this.loadSettings();
  }

  // 설정 로드
  private async loadSettings(): Promise<void> {
    try {
      const savedSettings = await AsyncStorage.getItem(this.SETTINGS_KEY);
      if (savedSettings) {
        this.settings = { ...defaultSettings, ...JSON.parse(savedSettings) };
      }
    } catch (error) {
      console.error('Failed to load haptic settings:', error);
    }
  }

  // 설정 저장
  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save haptic settings:', error);
    }
  }

  // 햅틱 피드백 실행
  public trigger(type: HapticType, options?: { force?: boolean; customIntensity?: 'light' | 'medium' | 'heavy' }): void {
    // 햅틱이 비활성화되어 있고 강제 실행이 아닌 경우
    if (!this.settings.enabled && !options?.force) {
      return;
    }

    // 특정 타입이 비활성화되어 있는 경우
    if (!this.settings.enabledTypes[type] && !options?.force) {
      return;
    }

    // 플랫폼 체크
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      return;
    }

    try {
      const hapticType = options?.customIntensity 
        ? intensityMapping[options.customIntensity]
        : hapticTypeMapping[type];

      const hapticOptions = {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      };

      ReactNativeHapticFeedback.trigger(hapticType, hapticOptions);
    } catch (error) {
      console.error('Haptic feedback error:', error);
    }
  }

  // 복합 햅틱 피드백 (연속 실행)
  public triggerSequence(types: HapticType[], delay: number = 100): void {
    if (!this.settings.enabled) return;

    types.forEach((type, index) => {
      setTimeout(() => {
        this.trigger(type, { force: true });
      }, index * delay);
    });
  }

  // 패턴 기반 햅틱 피드백
  public triggerPattern(pattern: { type: HapticType; delay: number }[]): void {
    if (!this.settings.enabled) return;

    let totalDelay = 0;
    pattern.forEach(({ type, delay }) => {
      setTimeout(() => {
        this.trigger(type, { force: true });
      }, totalDelay);
      totalDelay += delay;
    });
  }

  // 학습 관련 특화 메서드들
  public correctAnswer(): void {
    this.trigger(HapticType.CORRECT_ANSWER);
  }

  public wrongAnswer(): void {
    this.triggerSequence([HapticType.WRONG_ANSWER, HapticType.LIGHT], 150);
  }

  public buttonPress(): void {
    this.trigger(HapticType.BUTTON_PRESS);
  }

  public importantAction(): void {
    this.trigger(HapticType.IMPORTANT_ACTION);
  }

  public cardSwipe(): void {
    this.trigger(HapticType.CARD_SWIPE);
  }

  public levelUp(): void {
    this.triggerSequence([
      HapticType.LEVEL_UP,
      HapticType.MEDIUM,
      HapticType.HEAVY
    ], 100);
  }

  public achievement(): void {
    this.triggerPattern([
      { type: HapticType.LIGHT, delay: 100 },
      { type: HapticType.MEDIUM, delay: 100 },
      { type: HapticType.ACHIEVEMENT, delay: 200 },
    ]);
  }

  public navigation(): void {
    this.trigger(HapticType.NAVIGATION);
  }

  public longPress(): void {
    this.trigger(HapticType.LONG_PRESS);
  }

  public pullToRefresh(): void {
    this.trigger(HapticType.PULL_TO_REFRESH);
  }

  // 마스터 완료 시 특별한 햅틱
  public masterComplete(): void {
    this.triggerPattern([
      { type: HapticType.SUCCESS, delay: 0 },
      { type: HapticType.MEDIUM, delay: 200 },
      { type: HapticType.SUCCESS, delay: 150 },
      { type: HapticType.HEAVY, delay: 100 },
    ]);
  }

  // 연속 정답 시 햅틱
  public correctStreak(count: number): void {
    if (count <= 1) {
      this.correctAnswer();
      return;
    }

    const pattern: { type: HapticType; delay: number }[] = [];
    for (let i = 0; i < Math.min(count, 5); i++) {
      pattern.push({ 
        type: HapticType.SUCCESS, 
        delay: i * 80 
      });
    }
    this.triggerPattern(pattern);
  }

  // 퀴즈 타임아웃 햅틱
  public timeoutWarning(): void {
    this.triggerSequence([
      HapticType.WARNING,
      HapticType.WARNING,
    ], 300);
  }

  // 설정 관리 메서드들
  public getSettings(): HapticSettings {
    return { ...this.settings };
  }

  public async updateSettings(updates: Partial<HapticSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.saveSettings();
  }

  public async setEnabled(enabled: boolean): Promise<void> {
    await this.updateSettings({ enabled });
  }

  public async setIntensity(intensity: 'light' | 'medium' | 'heavy'): Promise<void> {
    await this.updateSettings({ intensity });
  }

  public async setTypeEnabled(type: HapticType, enabled: boolean): Promise<void> {
    const enabledTypes = { ...this.settings.enabledTypes };
    enabledTypes[type] = enabled;
    await this.updateSettings({ enabledTypes });
  }

  // 햅틱 지원 여부 확인
  public isSupported(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  }

  // 설정 초기화
  public async resetSettings(): Promise<void> {
    this.settings = { ...defaultSettings };
    await this.saveSettings();
  }

  // 테스트용 메서드
  public testHaptic(type: HapticType): void {
    this.trigger(type, { force: true });
  }

  // 모든 햅틱 타입 테스트
  public async testAllHaptics(): Promise<void> {
    const types = Object.values(HapticType);
    for (let i = 0; i < types.length; i++) {
      setTimeout(() => {
        this.testHaptic(types[i]);
      }, i * 500);
    }
  }
}

// 싱글톤 인스턴스 생성
export const hapticService = new HapticFeedbackService();

// React Hook
export const useHapticFeedback = () => {
  const trigger = (type: HapticType, options?: { force?: boolean; customIntensity?: 'light' | 'medium' | 'heavy' }) => {
    hapticService.trigger(type, options);
  };

  const triggerSequence = (types: HapticType[], delay?: number) => {
    hapticService.triggerSequence(types, delay);
  };

  const triggerPattern = (pattern: { type: HapticType; delay: number }[]) => {
    hapticService.triggerPattern(pattern);
  };

  return {
    trigger,
    triggerSequence,
    triggerPattern,
    correctAnswer: hapticService.correctAnswer.bind(hapticService),
    wrongAnswer: hapticService.wrongAnswer.bind(hapticService),
    buttonPress: hapticService.buttonPress.bind(hapticService),
    importantAction: hapticService.importantAction.bind(hapticService),
    cardSwipe: hapticService.cardSwipe.bind(hapticService),
    levelUp: hapticService.levelUp.bind(hapticService),
    achievement: hapticService.achievement.bind(hapticService),
    navigation: hapticService.navigation.bind(hapticService),
    longPress: hapticService.longPress.bind(hapticService),
    pullToRefresh: hapticService.pullToRefresh.bind(hapticService),
    masterComplete: hapticService.masterComplete.bind(hapticService),
    correctStreak: hapticService.correctStreak.bind(hapticService),
    timeoutWarning: hapticService.timeoutWarning.bind(hapticService),
  };
};

export default hapticService;