/*
  SrsQuizScreen.tsx — React Native 버전
  ------------------------------------------------------------
  웹 SrsQuiz.jsx를 모바일 앱에 맞게 리팩토링
*/

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Vibration,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiClient } from '../../services/apiClient';
import { AppHeader } from '../../components/common/AppHeader';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SrsQuiz'>;

interface QuizItem {
  cardId: number;
  vocabId: number;
  question: string;
  answer?: string;
  learned: boolean;
  wrongCount: number;
  stage?: number;
  nextReviewAt?: string;
  waitingUntil?: string;
  isOverdue?: boolean;
  overdueDeadline?: string;
  frozenUntil?: string;
  isFromWrongAnswer?: boolean;
  isFrozen?: boolean;
  contextSentence?: string;
  pron?: {
    ipa?: string;
    ipaKo?: string;
  };
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
    current?: {
      emoji: string;
      title: string;
    };
  };
}

export default function SrsQuizScreen({ navigation, route }: Props) {
  const { folderId, allOverdue } = route.params || {};
  
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QuizItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streakInfo, setStreakInfo] = useState<StreakInfo | null>(null);
  
  // 애니메이션
  const fadeAnim = new Animated.Value(1);
  const scaleAnim = new Animated.Value(1);

  const loadQuizData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 폴더 검증
      if (!allOverdue && (!folderId || isNaN(Number(folderId)))) {
        setError('폴더가 지정되지 않았습니다.');
        return;
      }

      // API 호출
      let queueUrl = allOverdue 
        ? '/srs/queue?all=true' 
        : `/srs/queue?folderId=${folderId}`;
      
      const [queueResponse, streakResponse] = await Promise.all([
        apiClient.get(queueUrl),
        apiClient.get('/srs/streak')
      ]);
      
      if (queueResponse.success) {
        const queueData = Array.isArray(queueResponse.data) ? queueResponse.data : [];
        setQueue(queueData);
        setCurrentIndex(0);
      }
      
      if (streakResponse.success) {
        setStreakInfo(streakResponse.data);
      }
    } catch (error: any) {
      console.error('Failed to load quiz data:', error);
      setError(`퀴즈를 불러오는 데 실패했습니다: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [folderId, allOverdue]);

  useEffect(() => {
    loadQuizData();
  }, [loadQuizData]);

  const current = queue[currentIndex];

  // 진행률 계산
  const progress = useMemo(() => {
    if (queue.length === 0) return { total: 0, learned: 0, remaining: 0 };
    const learnedCount = queue.filter(q => q.learned).length;
    const total = queue.length;
    return { total, learned: learnedCount, remaining: total - learnedCount };
  }, [queue]);

  // 정답/오답 애니메이션
  const animateAnswer = useCallback((correct: boolean) => {
    // 진동 피드백
    if (correct) {
      Vibration.vibrate(50); // 짧은 진동
    } else {
      Vibration.vibrate([0, 100, 50, 100]); // 패턴 진동
    }

    // 스케일 애니메이션
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: correct ? 1.1 : 0.9,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    // 페이드 애니메이션
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.8,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, fadeAnim]);

  // 정답/오답 제출
  const handleSubmit = useCallback(async (correct: boolean) => {
    if (!current || submitting) return;

    try {
      setSubmitting(true);
      animateAnswer(correct);
      
      // 백엔드에 답안 제출
      const response = await apiClient.post('/quiz/answer', {
        folderId,
        cardId: current.cardId,
        correct
      });
      
      if (response.success) {
        const data = response.data || {};
        
        // 연속학습일 정보 갱신
        if (data.canUpdateCardState) {
          try {
            const streakResponse = await apiClient.get('/srs/streak');
            if (streakResponse.success) {
              setStreakInfo(streakResponse.data);
            }
          } catch (err) {
            console.warn('Failed to update streak info:', err);
          }
        }

        // 동결 상태 처리
        if (data.isFrozen) {
          Alert.alert('동결 상태', '🧊 카드가 동결 상태입니다. 학습이 불가능합니다.');
          return;
        }

        // 마스터 달성 축하
        if (data.isMasteryAchieved) {
          Alert.alert(
            '축하합니다! 🎉',
            '🌟 마스터 완료! 축하합니다! 🌟',
            [{ text: '확인' }]
          );
        }

        // 로컬 상태 업데이트
        const updatedQueue = queue.map((item, index) => {
          if (index === currentIndex) {
            return {
              ...item,
              learned: data.canUpdateCardState ? correct : item.learned,
              wrongCount: (correct || !data.canUpdateCardState) 
                ? item.wrongCount 
                : (item.wrongCount || 0) + 1,
              stage: data.stage !== undefined ? data.stage : item.stage,
              nextReviewAt: data.nextReviewAt || item.nextReviewAt,
              waitingUntil: data.waitingUntil || item.waitingUntil,
              isOverdue: data.isOverdue !== undefined ? data.isOverdue : item.isOverdue,
              isFrozen: data.isFrozen !== undefined ? data.isFrozen : item.isFrozen,
            };
          }
          return item;
        });

        setQueue(updatedQueue);

        // 오답노트 기록 (오답이면서 SRS 상태 변경 가능할 때)
        if (!correct && data.canUpdateCardState) {
          try {
            await apiClient.post('/api/odat-note/create', {
              itemType: 'vocab',
              itemId: current.vocabId || current.cardId,
              wrongData: {
                question: current.question || '알 수 없는 단어',
                answer: current.question || '정답',
                userAnswer: 'incorrect',
                quizType: 'srs-meaning',
                folderId: folderId,
                vocabId: current.vocabId || current.cardId,
                ko_gloss: current.answer || '뜻 정보 없음',
                context: current.contextSentence || null,
                pron: current.pron || null
              }
            });
          } catch (error) {
            console.warn('Failed to record wrong answer:', error);
          }
        }

        // 다음 문제 찾기
        const nextIndex = updatedQueue.findIndex((q, i) => i > currentIndex && !q.learned);
        const fallbackIndex = updatedQueue.findIndex(q => !q.learned);

        if (nextIndex !== -1) {
          setCurrentIndex(nextIndex);
        } else if (fallbackIndex !== -1) {
          setCurrentIndex(fallbackIndex);
        } else {
          // 모든 문제 완료
          Alert.alert(
            '학습 완료! 🎉',
            '모든 카드를 학습했습니다!',
            [
              {
                text: '확인',
                onPress: () => {
                  if (folderId) {
                    navigation.navigate('SrsFolderDetail', { id: folderId.toString() });
                  } else {
                    navigation.navigate('SrsDashboard');
                  }
                }
              }
            ]
          );
        }
      }
    } catch (error: any) {
      console.error('Submit failed:', error);
      Alert.alert('오류', '정답 제출에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  }, [current, submitting, folderId, currentIndex, queue, navigation, animateAnswer]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader 
          title="SRS 복습 퀴즈"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>퀴즈를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader 
          title="SRS 복습 퀴즈"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>퀴즈 로드 실패</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadQuizData}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // 풀 문제가 없는 경우
  if (!current && progress.remaining === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader 
          title="SRS 복습 퀴즈"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.completedContainer}>
          <Text style={styles.completedIcon}>✨</Text>
          <Text style={styles.completedTitle}>이 폴더의 모든 카드를 학습했습니다!</Text>
          <Text style={styles.completedSubtitle}>
            새로운 단어를 추가하거나 다른 폴더를 복습해보세요.
          </Text>
          
          <View style={styles.completedActions}>
            {folderId && (
              <TouchableOpacity
                style={styles.addWordsButton}
                onPress={() => navigation.navigate('VocabList', { addToFolder: folderId })}
                activeOpacity={0.8}
              >
                <Text style={styles.addWordsButtonText}>+ 단어 추가</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={styles.dashboardButton}
              onPress={() => navigation.navigate('SrsDashboard')}
              activeOpacity={0.8}
            >
              <Text style={styles.dashboardButtonText}>대시보드</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader 
        title="SRS 복습 퀴즈"
        onBack={() => navigation.goBack()}
        subtitle={`${progress.learned} / ${progress.total}`}
      />
      
      <View style={styles.content}>
        {/* 연속학습일 정보 */}
        {streakInfo && (
          <View style={styles.streakBanner}>
            <View style={styles.streakInfo}>
              <Text style={styles.streakIcon}>
                {streakInfo.status?.icon || '🔥'}
              </Text>
              <View style={styles.streakDetails}>
                <Text style={styles.streakText}>
                  연속 {streakInfo.streak}일째 학습 중
                </Text>
                <View style={styles.streakBadges}>
                  <View style={styles.streakBadge}>
                    <Text style={styles.streakBadgeText}>
                      {streakInfo.dailyQuizCount}/{streakInfo.requiredDaily}
                    </Text>
                  </View>
                  {streakInfo.bonus?.current && (
                    <View style={styles.bonusBadge}>
                      <Text style={styles.bonusBadgeText}>
                        {streakInfo.bonus.current.emoji} {streakInfo.bonus.current.title}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
            
            <Text style={styles.streakStatus}>
              {streakInfo.isCompletedToday 
                ? '✅ 오늘 목표 달성!' 
                : `${streakInfo.remainingForStreak}개 더 필요`}
            </Text>
            
            {/* 진행바 */}
            <View style={styles.streakProgressContainer}>
              <View 
                style={[
                  styles.streakProgressBar,
                  { 
                    width: `${streakInfo.progressPercent}%`,
                    backgroundColor: streakInfo.isCompletedToday ? '#10b981' : '#3b82f6'
                  }
                ]}
              />
            </View>
          </View>
        )}

        {/* 퀴즈 카드 */}
        <Animated.View 
          style={[
            styles.quizCard,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <View style={styles.quizContent}>
            <Text style={styles.questionText} lang="en">
              {current?.question ?? '—'}
            </Text>
            
            {/* 발음 정보 */}
            {current?.pron && (current.pron.ipa || current.pron.ipaKo) && (
              <View style={styles.pronContainer}>
                {current.pron.ipa && (
                  <Text style={styles.pronText}>/{current.pron.ipa}/</Text>
                )}
                {current.pron.ipaKo && (
                  <Text style={styles.pronKoText}>[{current.pron.ipaKo}]</Text>
                )}
              </View>
            )}
            
            {/* 답안 버튼 */}
            <View style={styles.answerButtons}>
              <TouchableOpacity
                style={[
                  styles.answerButton,
                  styles.correctButton,
                  submitting && styles.answerButtonDisabled
                ]}
                onPress={() => handleSubmit(true)}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.answerButtonText}>맞음</Text>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.answerButton,
                  styles.incorrectButton,
                  submitting && styles.answerButtonDisabled
                ]}
                onPress={() => handleSubmit(false)}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.answerButtonText}>틀림</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
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
    alignItems: 'center',
    padding: 32,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
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
    padding: 32,
  },
  completedIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  completedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 12,
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
  addWordsButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addWordsButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  dashboardButton: {
    backgroundColor: '#6b7280',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  dashboardButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  streakBanner: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  streakInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  streakIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  streakDetails: {
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
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  streakBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  bonusBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  bonusBadgeText: {
    color: '#1f2937',
    fontSize: 12,
    fontWeight: '600',
  },
  streakStatus: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    marginBottom: 8,
  },
  streakProgressContainer: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
  },
  streakProgressBar: {
    height: '100%',
    borderRadius: 2,
  },
  quizCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    flex: 1,
    justifyContent: 'center',
  },
  quizContent: {
    alignItems: 'center',
    width: '100%',
  },
  questionText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 40,
  },
  pronContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  pronText: {
    fontSize: 18,
    color: '#3b82f6',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  pronKoText: {
    fontSize: 16,
    color: '#6b7280',
  },
  answerButtons: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  answerButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  correctButton: {
    backgroundColor: '#10b981',
  },
  incorrectButton: {
    backgroundColor: '#ef4444',
  },
  answerButtonDisabled: {
    opacity: 0.7,
  },
  answerButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});