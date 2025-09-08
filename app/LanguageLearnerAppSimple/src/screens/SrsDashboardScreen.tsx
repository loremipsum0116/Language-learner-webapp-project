import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  RefreshControl,
  Modal,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../services/apiClient';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('ko');
dayjs.tz.setDefault('Asia/Seoul');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface FolderItem {
  id: number;
  name: string;
  type?: string;
  kind: string;
  stage: number;
  total: number;
  isDue: boolean;
  isMastered: boolean;
  isCompleted: boolean;
  nextReviewDate: string;
  nextReviewAt?: string;
  alarmActive: boolean;
  learningCurveType: string;
  createdDate?: string;
  createdAt?: string;
  date?: string;
  childrenCount?: number;
  completionCount?: number;
  counts?: {
    learned: number;
    remaining: number;
  };
}

interface StreakInfo {
  streak: number;
  requiredDaily: number;
  dailyQuizCount: number;
  status: {
    icon: string;
    color: string;
    message: string;
  };
  bonus?: {
    current?: {
      emoji: string;
      title: string;
    };
    next?: {
      emoji: string;
      title: string;
      days: number;
    };
  };
}

interface SrsStatus {
  shouldShowAlarm: boolean;
  overdueCount: number;
  alarmInfo?: {
    currentPeriod: string;
    nextAlarmAtKst: string;
    minutesToNextAlarm: number;
    periodProgress: number;
  };
}

interface StudyLog {
  studies: Array<{
    vocab?: { lemma: string };
    lemma: string;
    lastReviewedAt: string;
    isTodayStudy: boolean;
    todayFirstResult: boolean | null;
    learningCurveType: string;
    folderId: number;
  }>;
  stats?: {
    errorRate: number;
    todayTotalAttempts: number;
    totalAttempts: number;
  };
}

const fmt = (d: string | null | undefined): string => {
  if (!d) return '-';
  return dayjs.utc(d).tz('Asia/Seoul').format('YYYY.MM.DD (ddd)');
};

const isDue = (nextReviewDate: string): boolean => {
  const kstNow = dayjs().tz('Asia/Seoul');
  return (
    dayjs(nextReviewDate).tz('Asia/Seoul').isSame(kstNow, 'day') ||
    dayjs(nextReviewDate).tz('Asia/Seoul').isBefore(kstNow, 'day')
  );
};

export default function SrsDashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [learningCurveType, setLearningCurveType] = useState<'long' | 'short' | 'free'>('long');
  const [streakInfo, setStreakInfo] = useState<StreakInfo | null>(null);
  const [wrongAnswersCount, setWrongAnswersCount] = useState(0);
  const [srsStatus, setSrsStatus] = useState<SrsStatus | null>(null);
  const [todayStudyLog, setTodayStudyLog] = useState<StudyLog | null>(null);
  const [showStudyDetails, setShowStudyDetails] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const reload = async () => {
    try {
      const dashboardResponse = await apiClient.get('/srs/dashboard');
      const normalized = (dashboardResponse.data || []).map((f: any) => ({
        ...f,
        nextReviewDate: f.nextReviewDate ?? f.nextReviewAt,
        isDue: f.nextReviewDate ? isDue(f.nextReviewDate) : f.kind === 'manual' && !f.isCompleted,
      }));
      setFolders(normalized);

      const streakRes = await apiClient.get('/srs/streak');
      setStreakInfo(streakRes.data);

      const wrongRes = await apiClient.get('/srs/wrong-answers?includeCompleted=false');
      setWrongAnswersCount(wrongRes.data.length);

      const statusRes = await apiClient.get('/srs/status');
      setSrsStatus(statusRes.data);

      const today = dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');
      try {
        const studyLogRes = await apiClient.get(`/srs/study-log?date=${today}`);
        setTodayStudyLog(studyLogRes.data || studyLogRes);
      } catch (err) {
        console.warn('Study log API failed:', err);
        setTodayStudyLog({
          studies: [],
          stats: {
            totalAttempts: 0,
            todayTotalAttempts: 0,
            errorRate: 0,
          },
        });
      }
    } catch (error) {
      console.error('Dashboard reload error:', error);
      Alert.alert('오류', '데이터를 불러오는 중 오류가 발생했습니다.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      reload().finally(() => setLoading(false));
    }, [])
  );

  const processTodayStudyData = () => {
    const actualStudyCount = streakInfo?.dailyQuizCount || 0;

    if (!todayStudyLog || !todayStudyLog.studies) {
      return {
        wordCounts: {},
        totalAttempts: actualStudyCount,
        wrongAttempts: 0,
        errorRate: 0,
        isEstimated: actualStudyCount > 0,
        wordFirstAttempts: {},
      };
    }

    const wordCounts: Record<string, { correct: number; wrong: number; total: number }> = {};
    const wordFirstAttempts: Record<string, any> = {};
    const firstStudyByLemma = new Map();

    todayStudyLog.studies.forEach((card) => {
      const lemma = card.vocab?.lemma || card.lemma;
      if (!lemma) return;

      if (firstStudyByLemma.has(lemma)) {
        const existingCard = firstStudyByLemma.get(lemma);
        if (new Date(card.lastReviewedAt) < new Date(existingCard.lastReviewedAt)) {
          firstStudyByLemma.set(lemma, card);
        }
      } else {
        firstStudyByLemma.set(lemma, card);
      }
    });

    let totalAttempts = 0;
    Array.from(firstStudyByLemma.values()).forEach((card: any) => {
      const word = card.vocab?.lemma || card.lemma || '미상';

      if (card.todayFirstResult !== null && card.todayFirstResult !== undefined || !card.isTodayStudy) {
        totalAttempts++;

        let isCorrect;
        if (card.todayFirstResult !== null && card.todayFirstResult !== undefined) {
          isCorrect = card.todayFirstResult;
        } else {
          isCorrect = !card.isTodayStudy;
        }

        const reviewTime = new Date(card.lastReviewedAt);
        const wordKey = `${word}_first`;

        wordFirstAttempts[wordKey] = {
          word: word,
          time: reviewTime,
          isCorrect: isCorrect,
          card: card,
          isFirstStudyToday: true,
          isTodayStudy: card.isTodayStudy,
          studyType: 'valid',
          folderId: card.folderId,
        };

        if (!wordCounts[word]) {
          wordCounts[word] = { correct: 0, wrong: 0, total: 0 };
        }

        wordCounts[word].total++;
        if (isCorrect) {
          wordCounts[word].correct++;
        } else {
          wordCounts[word].wrong++;
        }
      }
    });

    let errorRate = 0;
    let finalTotalAttempts = totalAttempts;

    if (todayStudyLog.stats) {
      errorRate = todayStudyLog.stats.errorRate || 0;
      if (todayStudyLog.stats.todayTotalAttempts !== undefined) {
        finalTotalAttempts = todayStudyLog.stats.todayTotalAttempts;
      } else {
        finalTotalAttempts = totalAttempts;
      }
    } else {
      const validAttempts = Object.values(wordFirstAttempts);
      const validWrongAttempts = validAttempts.filter((attempt: any) => !attempt.isCorrect);
      errorRate = validAttempts.length > 0 ? Math.round((validWrongAttempts.length / validAttempts.length) * 100) : 0;
    }

    return {
      wordCounts,
      wordFirstAttempts,
      totalAttempts: finalTotalAttempts,
      errorRate,
      isEstimated: false,
    };
  };

  const { wordCounts, wordFirstAttempts, totalAttempts, errorRate, isEstimated } = processTodayStudyData();

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      Alert.alert('오류', '폴더 이름을 입력하세요.');
      return;
    }
    
    try {
      await apiClient.post('/srs/folders', {
        name,
        parentId: null,
        learningCurveType: learningCurveType,
      });
      setNewFolderName('');
      setLearningCurveType('long');
      setShowCreateModal(false);
      await reload();
    } catch (error) {
      Alert.alert('오류', `폴더 생성 실패: ${error}`);
    }
  };

  const deleteFolderSafely = async (id: number) => {
    Alert.alert(
      '폴더 삭제',
      '폴더를 삭제하시겠습니까? (연결된 아이템도 함께 삭제)',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/srs/folders/${id}`);
              await reload();
            } catch (error) {
              Alert.alert('오류', `폴더 삭제 실패: ${error}`);
            }
          },
        },
      ]
    );
  };

  const toggleAlarm = async (folder: FolderItem) => {
    const turnOn = !folder.alarmActive;
    if (turnOn) {
      Alert.alert(
        '알림 켜기',
        '알림을 다시 켜면 진행도가 stage 0으로 초기화됩니다. 계속하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '계속',
            onPress: async () => {
              try {
                await apiClient.post(`/srs/folders/${folder.id}/alarm`, { active: turnOn });
                await reload();
              } catch (error) {
                Alert.alert('오류', `알림 상태 변경 실패: ${error}`);
              }
            },
          },
        ]
      );
    } else {
      try {
        await apiClient.post(`/srs/folders/${folder.id}/alarm`, { active: turnOn });
        await reload();
      } catch (error) {
        Alert.alert('오류', `알림 상태 변경 실패: ${error}`);
      }
    }
  };

  const restartMasteredFolder = async (folder: FolderItem) => {
    Alert.alert(
      '폴더 재시작',
      `${folder.name}을 새로운 120일 사이클로 재시작하시겠습니까?\n\n모든 단어가 미학습 상태로 리셋되고 Stage 0부터 다시 시작합니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '재시작',
          onPress: async () => {
            try {
              await apiClient.post(`/srs/folders/${folder.id}/restart`);
              Alert.alert('완료', '마스터된 폴더가 재시작되었습니다. 새로운 120일 사이클이 시작됩니다!');
              await reload();
            } catch (error) {
              Alert.alert('오류', `폴더 재시작 실패: ${error}`);
            }
          },
        },
      ]
    );
  };

  const OverdueAlertBanner = () => {
    if (!srsStatus?.shouldShowAlarm || !srsStatus?.alarmInfo) return null;

    const { overdueCount, alarmInfo } = srsStatus;
    const { currentPeriod, nextAlarmAtKst, minutesToNextAlarm, periodProgress } = alarmInfo;

    return (
      <View style={styles.overdueAlert}>
        <View style={styles.overdueHeader}>
          <Text style={styles.overdueTitle}>🔔 복습 알림</Text>
          <View style={styles.overdueBadge}>
            <Text style={styles.overdueBadgeText}>{overdueCount}개</Text>
          </View>
          <Text style={styles.overduePeriod}>({currentPeriod})</Text>
        </View>
        <Text style={styles.overdueMessage}>
          복습이 필요한 단어가 <Text style={styles.bold}>{overdueCount}개</Text> 있습니다.
        </Text>
        <Text style={styles.overdueNext}>
          다음 알림: {nextAlarmAtKst} ({minutesToNextAlarm}분 후)
        </Text>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${periodProgress}%` }]} />
        </View>
        <TouchableOpacity 
          style={styles.reviewButton}
          onPress={() => navigation.navigate('SrsQuizScreen' as any)}
        >
          <Text style={styles.reviewButtonText}>지금 복습하기</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>SRS 학습</Text>

        <OverdueAlertBanner />

        {/* Streak 정보 및 오답노트 */}
        {streakInfo && (
          <View style={styles.statsContainer}>
            <View style={styles.streakCard}>
              <View style={styles.streakHeader}>
                <View>
                  <Text style={styles.streakTitle}>
                    {streakInfo?.status?.icon || '🔥'} 연속 학습
                  </Text>
                  <Text style={[styles.streakDays, { color: getStreakColor(streakInfo?.status?.color) }]}>
                    {streakInfo.streak}일
                  </Text>
                  <Text style={styles.streakMessage}>{streakInfo?.status?.message || ''}</Text>
                </View>
                {/* 보너스 뱃지 */}
                {streakInfo?.bonus?.current && (
                  <View style={styles.bonusBadge}>
                    <Text style={styles.bonusText}>
                      {streakInfo.bonus.current.emoji} {streakInfo.bonus.current.title}
                    </Text>
                  </View>
                )}
              </View>

              {/* 진행률 바 */}
              <View style={styles.progressContainer}>
                <View 
                  style={[
                    styles.progressBar, 
                    { 
                      width: `${Math.min(100, (totalAttempts / streakInfo.requiredDaily) * 100)}%`,
                      backgroundColor: totalAttempts >= streakInfo.requiredDaily ? '#28a745' : '#007AFF'
                    }
                  ]} 
                />
                <Text style={styles.progressText}>
                  {totalAttempts}/{streakInfo.requiredDaily}
                </Text>
              </View>

              {/* 상태 메시지 */}
              <Text style={styles.statusMessage}>
                {totalAttempts >= streakInfo.requiredDaily ? 
                  '오늘 목표 달성! 🎉' : 
                  `오늘 ${streakInfo.requiredDaily - totalAttempts}개 더 필요`}
              </Text>

              {streakInfo?.bonus?.next && (
                <Text style={styles.nextBonus}>
                  다음: {streakInfo.bonus.next.emoji} {streakInfo.bonus.next.title} 
                  ({streakInfo.bonus.next.days - streakInfo.streak}일 남음)
                </Text>
              )}

              {/* 오늘 학습 상세 정보 */}
              <View style={styles.studyDetails}>
                <View style={styles.studyDetailsHeader}>
                  <Text style={styles.studyDetailsText}>
                    {totalAttempts > 0 ? (
                      <>📊 오늘 학습: {totalAttempts}회 | 오답율: <Text style={getErrorRateStyle(errorRate)}>{errorRate}%</Text>
                      {isEstimated && <Text style={styles.estimated}> (추정)</Text>}</>
                    ) : (
                      <>📊 오늘 학습: 0회 | 오답율: 0%</>
                    )}
                  </Text>
                  <TouchableOpacity 
                    onPress={() => setShowStudyDetails(!showStudyDetails)}
                    style={styles.detailsToggle}
                  >
                    <Text style={styles.detailsToggleText}>
                      {showStudyDetails ? '숨기기 ▲' : '상세보기 ▼'}
                    </Text>
                  </TouchableOpacity>
                </View>
                
                {/* 드롭다운 상세 정보 */}
                {showStudyDetails && (
                  <View style={styles.studyDetailsContent}>
                    <Text style={styles.studyWordsTitle}>오늘 학습한 단어들:</Text>
                    {Object.keys(wordFirstAttempts).length > 0 ? (
                      <View style={styles.wordsList}>
                        {Object.values(wordFirstAttempts)
                          .sort((a: any, b: any) => new Date(b.time).getTime() - new Date(a.time).getTime())
                          .map((attempt: any, index: number) => {
                            const badgeStyle = attempt.isCorrect ? styles.correctBadge : styles.wrongBadge;
                            const icon = attempt.isCorrect ? '✅' : '❌';
                            
                            return (
                              <View key={`${attempt.word}_${index}`} style={[styles.wordBadge, badgeStyle]}>
                                <Text style={styles.wordBadgeText}>
                                  {icon} {attempt.word} [F{attempt.folderId}] 첫학습
                                </Text>
                              </View>
                            );
                          })
                        }
                      </View>
                    ) : totalAttempts > 0 && isEstimated ? (
                      <View style={styles.estimatedInfo}>
                        <Text style={styles.estimatedText}>📚 {totalAttempts}회 학습 완료!</Text>
                        <Text style={styles.estimatedSubtext}>상세 학습 기록을 불러올 수 없습니다.</Text>
                      </View>
                    ) : (
                      <View style={styles.noStudyInfo}>
                        <Text style={styles.noStudyText}>🦜 아직 학습한 단어가 없습니다.</Text>
                        <Text style={styles.noStudySubtext}>SRS 학습을 시작해보세요!</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>

            <View style={styles.wrongAnswersCard}>
              <Text style={styles.wrongAnswersTitle}>📝 오답노트</Text>
              <Text style={styles.wrongAnswersCount}>{wrongAnswersCount}개</Text>
              <TouchableOpacity 
                style={styles.wrongAnswersButton}
                onPress={() => navigation.navigate('WrongAnswersScreen' as any)}
              >
                <Text style={styles.wrongAnswersButtonText}>오답노트 보기</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 폴더 생성 버튼 */}
        <TouchableOpacity 
          style={styles.createFolderButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.createFolderButtonText}>🆕 새 학습 폴더 만들기</Text>
        </TouchableOpacity>

        {/* 폴더 목록 */}
        <View style={styles.foldersContainer}>
          {folders.map(f => (
            <View key={f.id} style={styles.folderCard}>
              <TouchableOpacity
                onPress={() => {
                  if (f.type === 'parent') {
                    navigation.navigate('SrsParentFolderScreen' as any, { folderId: f.id });
                  } else {
                    navigation.navigate('SrsFolderDetailScreen' as any, { folderId: f.id });
                  }
                }}
                style={styles.folderContent}
              >
                <Text style={[styles.folderName, f.isDue && !f.isMastered && styles.dueFolder]}>
                  📁 {f.name}
                </Text>
                
                <View style={styles.folderBadges}>
                  {f.type === 'parent' && <View style={[styles.badge, styles.parentBadge]}><Text style={styles.badgeText}>상위폴더</Text></View>}
                  {f.kind === 'manual' && !f.isMastered && !f.type && <View style={[styles.badge, styles.manualBadge]}><Text style={styles.badgeText}>수동</Text></View>}
                  {f.kind === 'review' && !f.isMastered && !f.type && <View style={[styles.badge, styles.reviewBadge]}><Text style={styles.badgeText}>복습</Text></View>}
                  {f.learningCurveType === 'short' && !f.type && <View style={[styles.badge, styles.shortBadge]}><Text style={styles.badgeText}>🐰 스퍼트곡선</Text></View>}
                  {f.learningCurveType === 'long' && !f.type && <View style={[styles.badge, styles.longBadge]}><Text style={styles.badgeText}>🐢 장기곡선</Text></View>}
                  {f.learningCurveType === 'free' && !f.type && <View style={[styles.badge, styles.freeBadge]}><Text style={styles.badgeText}>🎯 자율모드</Text></View>}
                  {f.isMastered && <View style={[styles.badge, styles.masteredBadge]}><Text style={styles.badgeText}>🏆 마스터</Text></View>}
                  {f.isCompleted && !f.isMastered && <View style={[styles.badge, styles.completedBadge]}><Text style={styles.badgeText}>완료</Text></View>}
                </View>

                <Text style={styles.folderInfo}>
                  생성일: <Text style={styles.bold}>{fmt(f.createdDate ?? f.createdAt ?? f.date ?? null)}</Text>
                  {' | '}
                  {f.type === 'parent' ? (
                    <>
                      하위폴더 <Text style={styles.bold}>{f.childrenCount || 0}개</Text>
                      {' | '}
                      총 카드 <Text style={styles.bold}>{f.total ?? 0}개</Text>
                    </>
                  ) : f.isMastered ? (
                    <>
                      <Text style={styles.masteredText}>🏆 {f.completionCount || 1}회차 마스터 완료</Text>
                      {' | '}
                      <Text style={styles.alarmOff}>알림 비활성화</Text>
                    </>
                  ) : (
                    <>
                      {f.kind === 'manual' && !f.isCompleted ? 
                        <Text style={styles.learning}>학습 중</Text> :
                        f.isDue
                          ? <Text style={styles.dueText}>오늘 복습!</Text>
                          : (
                            <>
                              다음 복습: <Text style={styles.bold}>{fmt(f.nextReviewDate)}</Text>
                            </>
                          )}
                      {' | '}
                      Stage {f.stage}
                      {' | '}
                      카드 {f.total ?? 0}개
                    </>
                  )}
                  {f.counts && (
                    <>
                      {' | '}
                      <Text style={styles.learned}>완료 {f.counts.learned}</Text> / 
                      <Text style={styles.remaining}> 남은 {f.counts.remaining}</Text>
                    </>
                  )}
                </Text>
              </TouchableOpacity>

              <View style={styles.folderActions}>
                {f.type === 'parent' ? (
                  <Text style={styles.parentNote}>하위폴더에서 카드 관리</Text>
                ) : f.isMastered ? (
                  <>
                    <TouchableOpacity
                      style={styles.restartButton}
                      onPress={() => restartMasteredFolder(f)}
                    >
                      <Text style={styles.restartButtonText}>🔄 재시작</Text>
                    </TouchableOpacity>
                    <Text style={styles.alarmOffText}>🔕 알림 OFF</Text>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.alarmButton}
                    onPress={() => toggleAlarm(f)}
                  >
                    <Text style={styles.alarmButtonText}>
                      {f.alarmActive ? '🔔' : '🔕'}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteFolderSafely(f.id)}
                >
                  <Text style={styles.deleteButtonText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {!loading && folders.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>복습할 폴더가 없습니다.</Text>
            <Text style={styles.emptySubtitle}>위에서 새 복습 폴더를 만들어 단어를 추가해보세요.</Text>
          </View>
        )}
      </ScrollView>

      {/* 폴더 생성 모달 */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Text style={styles.modalCancel}>취소</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>새 학습 폴더</Text>
            <TouchableOpacity onPress={handleCreateFolder}>
              <Text style={styles.modalCreate}>만들기</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <TextInput
              style={styles.folderNameInput}
              placeholder="새 학습 폴더 이름..."
              value={newFolderName}
              onChangeText={setNewFolderName}
            />

            <Text style={styles.curveTitle}>📊 학습 곡선 선택 (중요!)</Text>
            <Text style={styles.curveSubtitle}>폴더 생성 후 변경 불가능, 신중히 선택하세요</Text>
            
            <View style={styles.curveInfo}>
              <Text style={styles.curveInfoText}>
                💡 선택 가이드: 체계적 장기 기억을 원한다면 🐢 장기곡선, 시험 등 빠른 암기가 필요하다면 🐰 스퍼트곡선, 자유롭게 학습하고 싶다면 🎯 자율모드를 선택하세요.
              </Text>
            </View>

            <View style={styles.curveOptions}>
              <TouchableOpacity
                style={[styles.curveOption, learningCurveType === 'long' && styles.curveOptionSelected]}
                onPress={() => setLearningCurveType('long')}
              >
                <Text style={styles.curveOptionTitle}>🐢 장기 학습 곡선 (추천)</Text>
                <Text style={styles.curveOptionDesc}>
                  1시간 → 1일 → 3일 → 7일 → 13일 → 29일 → 60일{'\n'}
                  7단계에서 마스터 완료{'\n'}
                  점진적 간격 확장으로 장기 기억 형성
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.curveOption, learningCurveType === 'short' && styles.curveOptionSelected]}
                onPress={() => setLearningCurveType('short')}
              >
                <Text style={styles.curveOptionTitle}>🐰 단기 스퍼트 곡선</Text>
                <Text style={styles.curveOptionDesc}>
                  1시간 → 1일 → 2일 고정 간격 반복{'\n'}
                  10단계에서 마스터 완료{'\n'}
                  빠른 반복으로 단기 집중 학습
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.curveOption, learningCurveType === 'free' && styles.curveOptionSelected]}
                onPress={() => setLearningCurveType('free')}
              >
                <Text style={styles.curveOptionTitle}>🎯 자율 학습 모드</Text>
                <Text style={styles.curveOptionDesc}>
                  타이머 없음, 자유로운 복습{'\n'}
                  학습 기록만 저장{'\n'}
                  원하는 대로 학습 가능
                </Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.curveTip}>
              💡 팁: 장기곡선은 망각곡선 이론에 최적화, 스퍼트곡선은 시험 대비용, 자율모드는 스케줄 없이 편안한 학습이 가능합니다.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const getStreakColor = (color: string) => {
  switch (color) {
    case 'gray': return '#6c757d';
    case 'blue': return '#0d6efd';
    case 'green': return '#198754';
    case 'orange': return '#fd7e14';
    case 'purple': return '#6f42c1';
    default: return '#0d6efd';
  }
};

const getErrorRateStyle = (errorRate: number) => ({
  color: errorRate > 30 ? '#dc3545' : errorRate > 15 ? '#ffc107' : '#198754'
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    margin: 16,
    color: '#333',
  },
  overdueAlert: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    margin: 16,
  },
  overdueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  overdueTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  overdueBadge: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  overdueBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  overduePeriod: {
    color: '#6c757d',
    fontSize: 14,
  },
  overdueMessage: {
    fontSize: 14,
    marginBottom: 4,
  },
  overdueNext: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 8,
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#e9ecef',
    borderRadius: 2,
    marginBottom: 12,
    position: 'relative',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#ffc107',
    borderRadius: 2,
  },
  progressText: {
    position: 'absolute',
    right: 0,
    top: -20,
    fontSize: 12,
    fontWeight: 'bold',
  },
  reviewButton: {
    backgroundColor: '#ffc107',
    padding: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  reviewButtonText: {
    color: '#212529',
    fontWeight: 'bold',
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: 'row',
    margin: 16,
    gap: 8,
  },
  streakCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  streakHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  streakTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  streakDays: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  streakMessage: {
    fontSize: 12,
    color: '#6c757d',
  },
  bonusBadge: {
    backgroundColor: '#ffc107',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  bonusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#212529',
  },
  statusMessage: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  nextBonus: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 12,
  },
  studyDetails: {
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
    paddingTop: 12,
  },
  studyDetailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  studyDetailsText: {
    fontSize: 12,
    color: '#6c757d',
    flex: 1,
  },
  detailsToggle: {
    padding: 4,
  },
  detailsToggleText: {
    fontSize: 10,
    color: '#6c757d',
  },
  studyDetailsContent: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 4,
  },
  studyWordsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  wordsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  wordBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  correctBadge: {
    backgroundColor: '#28a745',
  },
  wrongBadge: {
    backgroundColor: '#dc3545',
  },
  wordBadgeText: {
    color: 'white',
    fontSize: 10,
  },
  estimatedInfo: {
    alignItems: 'center',
    padding: 12,
  },
  estimatedText: {
    color: '#007AFF',
    fontSize: 14,
  },
  estimatedSubtext: {
    color: '#6c757d',
    fontSize: 12,
    marginTop: 4,
  },
  noStudyInfo: {
    alignItems: 'center',
    padding: 12,
  },
  noStudyText: {
    color: '#6c757d',
    fontSize: 14,
  },
  noStudySubtext: {
    color: '#6c757d',
    fontSize: 12,
    marginTop: 4,
  },
  estimated: {
    color: '#007AFF',
  },
  wrongAnswersCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  wrongAnswersTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  wrongAnswersCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffc107',
    marginBottom: 12,
  },
  wrongAnswersButton: {
    borderColor: '#ffc107',
    borderWidth: 1,
    padding: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  wrongAnswersButtonText: {
    color: '#ffc107',
    fontSize: 14,
  },
  createFolderButton: {
    backgroundColor: '#007AFF',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  createFolderButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  foldersContainer: {
    margin: 16,
  },
  folderCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  folderContent: {
    padding: 16,
  },
  folderName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  dueFolder: {
    color: '#007AFF',
  },
  folderBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
  },
  parentBadge: {
    backgroundColor: '#007AFF',
  },
  manualBadge: {
    backgroundColor: '#6c757d',
  },
  reviewBadge: {
    backgroundColor: '#17a2b8',
  },
  shortBadge: {
    backgroundColor: '#ffc107',
  },
  longBadge: {
    backgroundColor: '#007AFF',
  },
  freeBadge: {
    backgroundColor: '#28a745',
  },
  masteredBadge: {
    backgroundColor: '#ffc107',
  },
  completedBadge: {
    backgroundColor: '#28a745',
  },
  folderInfo: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 20,
  },
  bold: {
    fontWeight: 'bold',
  },
  masteredText: {
    color: '#ffc107',
    fontWeight: 'bold',
  },
  alarmOff: {
    color: '#6c757d',
  },
  learning: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  dueText: {
    color: '#28a745',
    fontWeight: 'bold',
  },
  learned: {
    color: '#28a745',
  },
  remaining: {
    color: '#ffc107',
  },
  folderActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 0,
  },
  parentNote: {
    fontSize: 12,
    color: '#6c757d',
    flex: 1,
  },
  restartButton: {
    backgroundColor: '#ffc107',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginRight: 8,
  },
  restartButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  alarmOffText: {
    fontSize: 12,
    color: '#6c757d',
    flex: 1,
  },
  alarmButton: {
    padding: 8,
  },
  alarmButtonText: {
    fontSize: 16,
  },
  deleteButton: {
    padding: 8,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#f8f9fa',
    margin: 16,
    borderRadius: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
    backgroundColor: 'white',
  },
  modalCancel: {
    color: '#007AFF',
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalCreate: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  folderNameInput: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
    fontSize: 16,
    marginBottom: 24,
  },
  curveTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  curveSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 12,
  },
  curveInfo: {
    backgroundColor: '#d1ecf1',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  curveInfoText: {
    fontSize: 14,
    color: '#0c5460',
  },
  curveOptions: {
    gap: 12,
    marginBottom: 16,
  },
  curveOption: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  curveOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  curveOptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  curveOptionDesc: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 20,
  },
  curveTip: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 20,
  },
});