// src/screens/main/StudyScreen.tsx
// SRS 학습 화면 (React Native 버전) - 제스처 인식 및 햅틱 피드백 포함

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
  PanGestureHandler,
  Dimensions,
  Alert,
  Vibration,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PanGestureHandlerGestureEvent, State } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
// TODO: Install expo-haptics
// import * as Haptics from 'expo-haptics';

import { useAuth } from '../../hooks/useAuth';
import { AlertBanner, LoadingSpinner } from '../../components/common';
import { FadeInView, SlideInView } from '../../components/animations';
import Pron from '../../components/Pron';
import { MainTabsParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<MainTabsParamList, 'Study'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

interface QuizCard {
  cardId: number;
  vocabId: number;
  question: string;
  answer: string;
  learned: boolean;
  wrongCount: number;
  stage: number;
  pron?: {
    ipa?: string;
    ipaKo?: string;
  };
  nextReviewAt?: string;
  waitingUntil?: string;
  isOverdue: boolean;
  overdueDeadline?: string;
  frozenUntil?: string;
  isFromWrongAnswer: boolean;
  isFrozen?: boolean;
}

interface StreakInfo {
  streak: number;
  dailyQuizCount: number;
  requiredDaily: number;
  isCompletedToday: boolean;
  remainingForStreak: number;
  progressPercent: number;
  status?: {
    icon: string;
  };
  bonus?: {
    current: {
      emoji: string;
      title: string;
    };
  };
}

interface Progress {
  total: number;
  learned: number;
  remaining: number;
}

// Haptic feedback utility
const triggerHaptic = async (type: 'success' | 'error' | 'warning' | 'light') => {
  try {
    // TODO: Use expo-haptics when installed
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
    // }
    
    // Fallback to system vibration
    if (type === 'success') {
      Vibration.vibrate(100);
    } else if (type === 'error') {
      Vibration.vibrate([0, 200, 100, 200]);
    } else if (type === 'warning') {
      Vibration.vibrate([0, 100]);
    } else {
      Vibration.vibrate(50);
    }
  } catch (error) {
    console.warn('Haptic feedback failed:', error);
  }
};

const StudyScreen: React.FC<Props> = ({ navigation, route }) => {
  const { user } = useAuth();
  const folderId = route.params?.folderId;
  const allOverdue = route.params?.allOverdue || false;

  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QuizCard[]>([]);
  const [idx, setIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streakInfo, setStreakInfo] = useState<StreakInfo | null>(null);

  // Gesture and animation
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  const fetchQuizData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate parameters
      if (!allOverdue && (!folderId || isNaN(folderId))) {
        throw new Error('폴더가 지정되지 않았습니다.');
      }

      // TODO: Replace with actual API calls
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock data
      const mockQueue: QuizCard[] = [
        {
          cardId: 1,
          vocabId: 101,
          question: 'apple',
          answer: '사과',
          learned: false,
          wrongCount: 0,
          stage: 1,
          pron: { ipa: 'ˈæpl', ipaKo: '애플' },
          isOverdue: false,
          isFromWrongAnswer: false,
        },
        {
          cardId: 2,
          vocabId: 102,
          question: 'banana',
          answer: '바나나',
          learned: false,
          wrongCount: 1,
          stage: 2,
          pron: { ipa: 'bəˈnænə', ipaKo: '버나나' },
          isOverdue: true,
          isFromWrongAnswer: false,
        },
        {
          cardId: 3,
          vocabId: 103,
          question: 'orange',
          answer: '오렌지',
          learned: false,
          wrongCount: 0,
          stage: 0,
          isOverdue: false,
          isFromWrongAnswer: true,
        },
      ];

      const mockStreakInfo: StreakInfo = {
        streak: 7,
        dailyQuizCount: 8,
        requiredDaily: 10,
        isCompletedToday: false,
        remainingForStreak: 2,
        progressPercent: 80,
        status: { icon: '🔥' },
        bonus: {
          current: { emoji: '⚡', title: '연속 학습 보너스' }
        }
      };

      setQueue(mockQueue);
      setIdx(0);
      setStreakInfo(mockStreakInfo);

    } catch (err: any) {
      console.error('Quiz data fetch failed:', err);
      setError(err.message || '퀴즈를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [folderId, allOverdue]);

  useEffect(() => {
    fetchQuizData();
  }, [fetchQuizData]);

  const current = queue[idx];

  // Progress calculation
  const progress: Progress = {
    total: queue.length,
    learned: queue.filter(q => q.learned).length,
    remaining: queue.filter(q => !q.learned).length,
  };

  // Submit answer
  const submitAnswer = async (correct: boolean) => {
    if (!current || submitting) return;

    try {
      setSubmitting(true);
      
      // Trigger appropriate haptic feedback
      await triggerHaptic(correct ? 'success' : 'error');

      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock response
      const mockResponse = {
        data: {
          stage: correct ? current.stage + 1 : current.stage,
          canUpdateCardState: true,
          isMasteryAchieved: correct && current.stage >= 5,
          message: correct ? '정답!' : '오답입니다.',
        }
      };

      const { stage, canUpdateCardState, isMasteryAchieved } = mockResponse.data;

      // Show mastery achievement
      if (isMasteryAchieved) {
        await triggerHaptic('success');
        Alert.alert('🎉 마스터 완료!', '축하합니다! 단어를 완전히 마스터했습니다!');
      }

      // Update local state
      const updatedQueue = queue.map((item, index) => {
        if (index === idx) {
          return {
            ...item,
            learned: canUpdateCardState ? correct : item.learned,
            wrongCount: correct ? item.wrongCount : (item.wrongCount || 0) + 1,
            stage: stage !== undefined ? stage : item.stage,
          };
        }
        return item;
      });

      setQueue(updatedQueue);

      // Find next question
      const nextIndex = updatedQueue.findIndex((q, i) => i > idx && !q.learned);
      const fallbackIndex = updatedQueue.findIndex(q => !q.learned);

      if (nextIndex !== -1) {
        setIdx(nextIndex);
      } else if (fallbackIndex !== -1) {
        setIdx(fallbackIndex);
      } else {
        // All questions completed
        await triggerHaptic('success');
        Alert.alert(
          '🎉 학습 완료!',
          '모든 카드를 학습했습니다!',
          [
            { text: '확인', onPress: () => navigation.goBack() }
          ]
        );
      }

    } catch (err: any) {
      console.error('Submit answer failed:', err);
      await triggerHaptic('error');
      Alert.alert('오류', '정답 제출에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  // Gesture handling
  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = async (event: PanGestureHandlerGestureEvent) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, velocityX } = event.nativeEvent;

      // Determine swipe direction and trigger appropriate action
      if (Math.abs(translationX) > SWIPE_THRESHOLD || Math.abs(velocityX) > 1000) {
        await triggerHaptic('light');
        
        if (translationX > 0) {
          // Swipe right = Correct
          runOnJS(submitAnswer)(true);
        } else {
          // Swipe left = Incorrect
          runOnJS(submitAnswer)(false);
        }

        // Animate card off screen
        const direction = translationX > 0 ? SCREEN_WIDTH : -SCREEN_WIDTH;
        Animated.parallel([
          Animated.timing(translateX, {
            toValue: direction,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.8,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(rotation, {
            toValue: translationX > 0 ? 15 : -15,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Reset animations
          translateX.setValue(0);
          scale.setValue(1);
          rotation.setValue(0);
        });
      } else {
        // Snap back to center
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" />
          <Text style={styles.loadingText}>퀴즈를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <AlertBanner
            type="error"
            title="오류 발생"
            message={error}
          />
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchQuizData}
            activeOpacity={0.7}
          >
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // No questions available
  if (!current && progress.remaining === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <FadeInView style={styles.completedContainer}>
          <Text style={styles.completedTitle}>✨ 모든 카드를 학습했습니다!</Text>
          <Text style={styles.completedSubtitle}>
            새로운 단어를 추가하거나 다른 폴더를 복습해보세요.
          </Text>
          <View style={styles.completedActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryButton]}
              onPress={() => navigation.navigate('Vocabulary')}
              activeOpacity={0.7}
            >
              <Text style={styles.actionButtonText}>+ 단어 추가</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={() => navigation.navigate('Home')}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>대시보드</Text>
            </TouchableOpacity>
          </View>
        </FadeInView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FadeInView style={styles.content}>
        {/* Streak Info Banner */}
        {streakInfo && (
          <SlideInView direction="down" style={styles.streakBanner}>
            <View style={styles.streakContent}>
              <View style={styles.streakLeft}>
                <Text style={styles.streakIcon}>
                  {streakInfo.status?.icon || '🔥'}
                </Text>
                <View style={styles.streakInfo}>
                  <Text style={styles.streakText}>
                    연속 {streakInfo.streak}일째 학습 중
                  </Text>
                  <View style={styles.streakBadges}>
                    <Text style={styles.streakBadge}>
                      {streakInfo.dailyQuizCount}/{streakInfo.requiredDaily}
                    </Text>
                    {streakInfo.bonus?.current && (
                      <Text style={styles.bonusBadge}>
                        {streakInfo.bonus.current.emoji} {streakInfo.bonus.current.title}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
              <Text style={styles.streakStatus}>
                {streakInfo.isCompletedToday 
                  ? '✅ 오늘 목표 달성!' 
                  : `${streakInfo.remainingForStreak}개 더 필요`
                }
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill,
                  { 
                    width: `${streakInfo.progressPercent}%`,
                    backgroundColor: streakInfo.isCompletedToday ? '#10b981' : '#3b82f6'
                  }
                ]}
              />
            </View>
          </SlideInView>
        )}

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>SRS 복습 퀴즈</Text>
          <Text style={styles.progressText}>
            {progress.learned} / {progress.total}
          </Text>
        </View>

        {/* Quiz Card */}
        <PanGestureHandler
          onGestureEvent={onGestureEvent}
          onHandlerStateChange={onHandlerStateChange}
          enabled={!submitting}
        >
          <Animated.View
            style={[
              styles.cardContainer,
              {
                transform: [
                  { translateX },
                  { scale },
                  { rotate: rotation.interpolate({
                      inputRange: [-50, 0, 50],
                      outputRange: ['-15deg', '0deg', '15deg'],
                    })
                  }
                ],
              },
            ]}
          >
            <View style={styles.card}>
              <View style={styles.cardContent}>
                <Text style={styles.question}>{current?.question ?? '—'}</Text>
                {current?.pron && (
                  <View style={styles.pronContainer}>
                    <Pron ipa={current.pron.ipa} ipaKo={current.pron.ipaKo} />
                  </View>
                )}
              </View>

              {/* Gesture Hints */}
              <View style={styles.gestureHints}>
                <View style={[styles.hint, styles.correctHint]}>
                  <Text style={styles.hintText}>👍</Text>
                  <Text style={styles.hintLabel}>맞음</Text>
                </View>
                <View style={[styles.hint, styles.incorrectHint]}>
                  <Text style={styles.hintText}>👎</Text>
                  <Text style={styles.hintLabel}>틀림</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        </PanGestureHandler>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.answerButton, styles.incorrectButton]}
            onPress={() => submitAnswer(false)}
            disabled={submitting}
            activeOpacity={0.7}
          >
            <Text style={styles.answerButtonText}>❌ 틀림</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.answerButton, styles.correctButton]}
            onPress={() => submitAnswer(true)}
            disabled={submitting}
            activeOpacity={0.7}
          >
            <Text style={styles.answerButtonText}>✅ 맞음</Text>
          </TouchableOpacity>
        </View>

        {/* Swipe Instructions */}
        <Text style={styles.swipeInstructions}>
          👈 왼쪽 스와이프: 틀림 | 오른쪽 스와이프: 맞음 👉
        </Text>
      </FadeInView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 16,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  completedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  completedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  completedSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  completedActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
  },
  secondaryButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  streakBanner: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  streakContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  streakIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  streakInfo: {
    flex: 1,
  },
  streakText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  streakBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  streakBadge: {
    backgroundColor: '#3b82f6',
    color: 'white',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
  },
  bonusBadge: {
    backgroundColor: '#fbbf24',
    color: '#92400e',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
  },
  streakStatus: {
    fontSize: 12,
    color: '#6b7280',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  progressText: {
    backgroundColor: '#1f2937',
    color: 'white',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  cardContent: {
    alignItems: 'center',
  },
  question: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  pronContainer: {
    marginBottom: 24,
  },
  gestureHints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 32,
  },
  hint: {
    alignItems: 'center',
    opacity: 0.5,
  },
  correctHint: {},
  incorrectHint: {},
  hintText: {
    fontSize: 24,
    marginBottom: 4,
  },
  hintLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
    marginTop: 24,
  },
  answerButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  correctButton: {
    backgroundColor: '#10b981',
  },
  incorrectButton: {
    backgroundColor: '#ef4444',
  },
  answerButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  swipeInstructions: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
});

export default StudyScreen;