// src/utils/haptics.ts
// 햅틱 피드백 유틸리티

import { Vibration } from 'react-native';
// TODO: Install expo-haptics for better haptic feedback
// import * as Haptics from 'expo-haptics';

export type HapticFeedbackType = 'success' | 'error' | 'warning' | 'light' | 'medium' | 'heavy' | 'selection';

class HapticService {
  private static instance: HapticService;
  private enabled: boolean = true;

  static getInstance(): HapticService {
    if (!HapticService.instance) {
      HapticService.instance = new HapticService();
    }
    return HapticService.instance;
  }

  /**
   * 햅틱 피드백 활성화/비활성화 설정
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * 햅틱 피드백 활성화 상태 확인
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 햅틱 피드백 트리거
   */
  async trigger(type: HapticFeedbackType): Promise<void> {
    if (!this.enabled) return;

    try {
      // TODO: Use expo-haptics when available
      // switch (type) {
      //   case 'success':
      //     await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      //     break;
      //   case 'error':
      //     await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      //     break;
      //   case 'warning':
      //     await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      //     break;
      //   case 'light':
      //     await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      //     break;
      //   case 'medium':
      //     await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      //     break;
      //   case 'heavy':
      //     await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      //     break;
      //   case 'selection':
      //     await Haptics.selectionAsync();
      //     break;
      //   default:
      //     await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // }

      // Fallback to system vibration
      this.vibrationFallback(type);
    } catch (error) {
      console.warn('Haptic feedback failed, using vibration fallback:', error);
      this.vibrationFallback(type);
    }
  }

  /**
   * 시스템 진동 대체 구현
   */
  private vibrationFallback(type: HapticFeedbackType): void {
    try {
      switch (type) {
        case 'success':
          Vibration.vibrate([0, 100, 50, 100]); // Short-long-short pattern
          break;
        case 'error':
          Vibration.vibrate([0, 200, 100, 200, 100, 200]); // Long-short-long-short pattern
          break;
        case 'warning':
          Vibration.vibrate([0, 150, 50, 150]); // Medium pattern
          break;
        case 'light':
          Vibration.vibrate(50); // Very short
          break;
        case 'medium':
          Vibration.vibrate(100); // Short
          break;
        case 'heavy':
          Vibration.vibrate(200); // Long
          break;
        case 'selection':
          Vibration.vibrate(25); // Very light tap
          break;
        default:
          Vibration.vibrate(50);
      }
    } catch (error) {
      console.warn('Vibration fallback failed:', error);
    }
  }

  /**
   * 커스텀 진동 패턴 실행
   */
  async customPattern(pattern: number[]): Promise<void> {
    if (!this.enabled) return;

    try {
      Vibration.vibrate(pattern);
    } catch (error) {
      console.warn('Custom vibration pattern failed:', error);
    }
  }

  /**
   * 특정 상황에 맞는 햅틱 피드백 실행
   */
  async forAction(action: 'buttonPress' | 'swipe' | 'cardFlip' | 'answerCorrect' | 'answerIncorrect' | 'achievement' | 'levelUp' | 'streakBroken' | 'cardMastered'): Promise<void> {
    switch (action) {
      case 'buttonPress':
        await this.trigger('light');
        break;
      case 'swipe':
        await this.trigger('selection');
        break;
      case 'cardFlip':
        await this.trigger('medium');
        break;
      case 'answerCorrect':
        await this.trigger('success');
        break;
      case 'answerIncorrect':
        await this.trigger('error');
        break;
      case 'achievement':
      case 'levelUp':
      case 'cardMastered':
        // Special celebration pattern
        await this.customPattern([0, 100, 50, 100, 50, 200]);
        break;
      case 'streakBroken':
        await this.trigger('warning');
        break;
      default:
        await this.trigger('light');
    }
  }

  /**
   * 연속 햅틱 피드백 (카운트다운 등)
   */
  async sequence(count: number, interval: number = 200, type: HapticFeedbackType = 'light'): Promise<void> {
    for (let i = 0; i < count; i++) {
      await this.trigger(type);
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
  }

  /**
   * 점진적 강도 증가 햅틱 피드백
   */
  async crescendo(): Promise<void> {
    await this.trigger('light');
    await new Promise(resolve => setTimeout(resolve, 100));
    await this.trigger('medium');
    await new Promise(resolve => setTimeout(resolve, 100));
    await this.trigger('heavy');
  }

  /**
   * 모든 햅틱 피드백 중지
   */
  cancel(): void {
    try {
      Vibration.cancel();
    } catch (error) {
      console.warn('Failed to cancel vibration:', error);
    }
  }
}

// Singleton instance
const hapticService = HapticService.getInstance();

// Export convenient methods
export const haptics = {
  success: () => hapticService.trigger('success'),
  error: () => hapticService.trigger('error'),
  warning: () => hapticService.trigger('warning'),
  light: () => hapticService.trigger('light'),
  medium: () => hapticService.trigger('medium'),
  heavy: () => hapticService.trigger('heavy'),
  selection: () => hapticService.trigger('selection'),
  
  // Action-specific haptics
  buttonPress: () => hapticService.forAction('buttonPress'),
  swipe: () => hapticService.forAction('swipe'),
  cardFlip: () => hapticService.forAction('cardFlip'),
  answerCorrect: () => hapticService.forAction('answerCorrect'),
  answerIncorrect: () => hapticService.forAction('answerIncorrect'),
  achievement: () => hapticService.forAction('achievement'),
  levelUp: () => hapticService.forAction('levelUp'),
  streakBroken: () => hapticService.forAction('streakBroken'),
  cardMastered: () => hapticService.forAction('cardMastered'),
  
  // Advanced patterns
  sequence: (count: number, interval?: number, type?: HapticFeedbackType) => 
    hapticService.sequence(count, interval, type),
  crescendo: () => hapticService.crescendo(),
  customPattern: (pattern: number[]) => hapticService.customPattern(pattern),
  
  // Control
  setEnabled: (enabled: boolean) => hapticService.setEnabled(enabled),
  isEnabled: () => hapticService.isEnabled(),
  cancel: () => hapticService.cancel(),
};

export default hapticService;