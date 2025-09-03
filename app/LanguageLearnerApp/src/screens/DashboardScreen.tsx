/*
  DashboardScreen.tsx — React Native 버전
  ------------------------------------------------------------
  웹 Dashboard.jsx를 모바일 앱에 맞게 리팩토링
*/

import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../services/apiClient';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

// dayjs (KST 라벨용)
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Seoul");
const todayKst = () => dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  onPress?: () => void;
  loading?: boolean;
  showDetails?: boolean;
  onDetailsPress?: () => void;
}

function StatCard({ title, value, icon, onPress, loading, showDetails, onDetailsPress }: StatCardProps) {
  return (
    <TouchableOpacity 
      style={styles.statCard} 
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.statCardHeader}>
        {icon}
        <Text style={styles.statCardTitle}>{title}</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" />
      ) : (
        <Text style={styles.statCardValue}>{value}</Text>
      )}
      <View style={styles.statCardFooter}>
        {showDetails && (
          <TouchableOpacity style={styles.detailsButton} onPress={onDetailsPress}>
            <Text style={styles.detailsButtonText}>상세보기</Text>
            <Ionicons name="chevron-down" size={12} color="#666" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function DashboardScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [stats, setStats] = useState({ srsQueue: 0, odatNote: 0, masteredWords: 0 });
  const [masteredCards, setMasteredCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [srsStatus, setSrsStatus] = useState<any>(null);
  const [streakInfo, setStreakInfo] = useState<any>(null);
  const [todayStudyLog, setTodayStudyLog] = useState<any>(null);
  const [showStudyDetails, setShowStudyDetails] = useState(false);
  const [showMasteredDetails, setShowMasteredDetails] = useState(false);

  // 오늘(KST) 루트 폴더의 미학습 합계 + 가장 이른 알림시각
  const [alarm, setAlarm] = useState<any>({ totalDue: 0, nextAlarmAtKst: null });

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // 1) 카드/오답/마스터 통계 병렬 로딩
      const [srsQueueRes, odatNoteRes, masteredCardsRes] = await Promise.all([
        apiClient.get('/srs/available'),
        apiClient.get('/srs/wrong-answers?includeCompleted=false'),
        apiClient.get('/srs/mastered-cards'),
      ]);

      const masteredData = Array.isArray(masteredCardsRes.data?.data) ? masteredCardsRes.data.data : 
                          Array.isArray(masteredCardsRes.data) ? masteredCardsRes.data : [];
      const masteredCount = masteredData.length;
      
      setStats({
        srsQueue: Array.isArray(srsQueueRes.data?.data) ? srsQueueRes.data.data.length : 0,
        odatNote: Array.isArray(odatNoteRes.data?.data) ? odatNoteRes.data.data.length : 0,
        masteredWords: masteredCount,
      });
      
      setMasteredCards(masteredData);

      // 2) 오늘 루트(id) 찾고 → 하위 폴더 children-lite로 dueCount/nextAlarmAt 수집
      try {
        const pickerRes = await apiClient.get('/srs/folders/picker');
        const roots = Array.isArray(pickerRes.data) ? pickerRes.data : (pickerRes.data?.data ?? []);
        const root = roots.find((r: any) => r?.name === todayKst());
        
        if (root?.id) {
          const listRes = await apiClient.get(`/srs/folders/${root.id}/children-lite`);
          const children = Array.isArray(listRes.data) ? listRes.data : (listRes.data?.data ?? []);
          const totalDue = children.reduce((s: number, f: any) => s + (f?.dueCount ?? 0), 0);

          const nexts = children.map((c: any) => c?.nextAlarmAt).filter(Boolean);
          const earliest = nexts.length
            ? dayjs(Math.min(...nexts.map((d: string) => new Date(d).getTime()))).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm')
            : null;

          setAlarm({ totalDue, nextAlarmAtKst: earliest, rootId: root.id, children });
        } else {
          setAlarm({ totalDue: 0, nextAlarmAtKst: null });
        }
      } catch {
        setAlarm({ totalDue: 0, nextAlarmAtKst: null });
      }
      
      // 3) SRS 상태 정보 로드
      try {
        const statusRes = await apiClient.get('/srs/status');
        setSrsStatus(statusRes.data?.data || statusRes.data);
      } catch (e) {
        console.warn('SRS 상태 로딩 실패:', e);
      }
      
      // 4) 연속학습일 정보 로드
      try {
        const streakRes = await apiClient.get('/srs/streak');
        setStreakInfo(streakRes.data?.data || streakRes.data);
      } catch (e) {
        console.warn('연속학습일 로딩 실패:', e);
      }
      
      // 5) 오늘 학습 로그 로드
      const today = dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');
      try {
        const studyLogRes = await apiClient.get(`/srs/study-log?date=${today}`);
        setTodayStudyLog(studyLogRes.data?.data || studyLogRes.data);
      } catch (err) {
        console.warn('Study log API failed:', err);
        setTodayStudyLog({
          studies: [],
          stats: {
            totalStudied: 0,
            uniqueWords: 0,
            errorRate: 0,
            successRate: 0
          }
        });
      }
      
    } catch (e) {
      console.error('대시보드 데이터 로딩 실패:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const cefrLevel = user?.profile?.level || 'A1';

  // 오늘 학습한 단어들을 그룹화하고 통계 계산
  const processTodayStudyData = () => {
    const actualStudyCount = streakInfo?.dailyQuizCount || 0;
    
    if (!todayStudyLog || !todayStudyLog.studies) {
      return { 
        wordCounts: {}, 
        wordFirstAttempts: {},
        totalAttempts: actualStudyCount, 
        wrongAttempts: 0, 
        errorRate: 0,
        isEstimated: actualStudyCount > 0
      };
    }

    const wordFirstAttempts: any = {};
    
    todayStudyLog.studies.forEach((card: any) => {
      const lemma = card.vocab?.lemma || card.lemma || '미상';
      
      if (!wordFirstAttempts[lemma]) {
        let isCorrect = false;
        if (card.todayFirstResult !== null && card.todayFirstResult !== undefined) {
          isCorrect = card.todayFirstResult === true;
        } else if (card.isTodayStudy && card.stage !== undefined) {
          isCorrect = card.stage > 0;
        }
        
        wordFirstAttempts[lemma] = {
          word: lemma,
          isCorrect,
          folderId: card.folderId,
          time: card.studiedAt || new Date().toISOString()
        };
      }
    });

    const totalAttempts = todayStudyLog.stats?.todayTotalAttempts || actualStudyCount;
    const errorRate = todayStudyLog.stats?.errorRate || 0;

    return { 
      wordFirstAttempts,
      totalAttempts, 
      errorRate,
      isEstimated: false
    };
  };

  const { wordFirstAttempts, totalAttempts, errorRate, isEstimated } = processTodayStudyData();

  // 알림 문구
  const alarmText = useMemo(() => {
    if (!alarm.totalDue) return null;
    const when = alarm.nextAlarmAtKst ? ` (다음 알림: ${alarm.nextAlarmAtKst})` : '';
    return `오늘 미학습 ${alarm.totalDue}개가 남았습니다.${when}`;
  }, [alarm]);

  // SRS 학습 시작 함수
  const startSrsLearning = async () => {
    try {
      const availableData = await apiClient.get('/srs/available');
      
      if (Array.isArray(availableData?.data?.data) && availableData.data.data.length > 0) {
        const vocabIds = availableData.data.data
          .map((card: any) => card.srsfolderitem?.[0]?.vocabId || card.srsfolderitem?.[0]?.vocab?.id)
          .filter(Boolean);
        
        if (vocabIds.length > 0) {
          navigation.navigate('LearnVocab', {
            mode: 'all_overdue',
            selectedItems: vocabIds.join(',')
          });
        } else {
          Alert.alert('알림', '복습할 단어가 없습니다.');
        }
      } else {
        Alert.alert('알림', '복습할 단어가 없습니다.');
      }
    } catch (error) {
      console.error('Failed to start SRS learning:', error);
      Alert.alert('오류', '학습을 시작할 수 없습니다.');
    }
  };

  const renderMasteredCard = ({ item, index }: { item: any; index: number }) => {
    const vocab = item.srsfolderitem?.[0]?.vocab || {};
    const masterCycles = item.masterCycles || 1;
    
    return (
      <View style={styles.masteredCard}>
        <View style={styles.masteredCardHeader}>
          <Text style={styles.masteredCardTitle}>{vocab.lemma || 'Unknown'}</Text>
          <View style={styles.masteredCycles}>
            <Text style={styles.masteredCyclesText}>⭐ {masterCycles}</Text>
          </View>
        </View>
        {vocab.pos && (
          <Text style={styles.masteredCardPos}>{vocab.pos}</Text>
        )}
        {vocab.ko_gloss && (
          <Text style={styles.masteredCardGloss}>
            {vocab.ko_gloss.slice(0, 50)}{vocab.ko_gloss.length > 50 ? '...' : ''}
          </Text>
        )}
        <Text style={styles.masteredCardDate}>
          🏆 {dayjs(item.masteredAt).format('MM/DD')} 마스터
        </Text>
      </View>
    );
  };

  const renderStudyWord = ({ item, index }: { item: any; index: number }) => (
    <View style={[styles.studyWordBadge, item.isCorrect ? styles.correctBadge : styles.wrongBadge]}>
      <Text style={styles.studyWordText}>
        {item.isCorrect ? '✅' : '❌'} {item.word} [F{item.folderId}]
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* 환영 섹션 */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Welcome, {user?.email}!</Text>
          <Text style={styles.welcomeDesc}>
            현재 설정된 학습 레벨은 <Text style={styles.levelText}>{cefrLevel}</Text> 입니다. 오늘도 꾸준히 학습해 보세요!
          </Text>
        </View>

        {/* 긴급 Overdue 알림 배너 */}
        {srsStatus?.shouldShowAlarm && srsStatus?.alarmInfo && (
          <View style={styles.overdueAlert}>
            <View style={styles.overdueAlertHeader}>
              <Text style={styles.overdueAlertTitle}>⚠️ 긴급 복습 알림</Text>
              <View style={styles.overdueCount}>
                <Text style={styles.overdueCountText}>{srsStatus.overdueCount}개</Text>
              </View>
            </View>
            <Text style={styles.overdueAlertDesc}>
              복습 기한이 임박한 단어가 <Text style={styles.overdueCountInline}>{srsStatus.overdueCount}개</Text> 있습니다.
            </Text>
            <Text style={styles.overdueAlertNext}>
              다음 알림: {srsStatus.alarmInfo.nextAlarmAtKst} ({srsStatus.alarmInfo.minutesToNextAlarm}분 후)
            </Text>
            <TouchableOpacity style={styles.overdueButton} onPress={startSrsLearning}>
              <Text style={styles.overdueButtonText}>지금 복습하기</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 일반 폴더 알림 배너 */}
        {alarmText && !srsStatus?.shouldShowAlarm && (
          <View style={styles.generalAlert}>
            <Text style={styles.generalAlertText}>🔔 {alarmText}</Text>
            <TouchableOpacity style={styles.generalAlertButton} onPress={startSrsLearning}>
              <Text style={styles.generalAlertButtonText}>SRS로 이동</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 핵심 지표 */}
        <View style={styles.statsSection}>
          <View style={styles.statsRow}>
            <StatCard
              title="오늘 학습할 카드"
              value={stats.srsQueue}
              loading={loading}
              icon={<Ionicons name="layers" size={24} color="#007AFF" />}
              onPress={startSrsLearning}
            />
            <StatCard
              title="오답 노트 단어"
              value={stats.odatNote}
              loading={loading}
              icon={<Ionicons name="journal" size={24} color="#dc3545" />}
              onPress={() => navigation.navigate('WrongAnswers')}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              title="마스터 한 단어"
              value={stats.masteredWords}
              loading={loading}
              icon={<Ionicons name="trophy" size={24} color="#ffc107" />}
              showDetails={stats.masteredWords > 0}
              onDetailsPress={() => setShowMasteredDetails(true)}
            />
            {/* 연속학습 카드 */}
            <View style={styles.statCard}>
              {loading ? (
                <ActivityIndicator size="large" color="#007AFF" />
              ) : streakInfo ? (
                <>
                  <View style={styles.streakHeader}>
                    <Text style={styles.streakTitle}>
                      {streakInfo?.status?.icon || '🔥'} 연속 학습
                    </Text>
                    {streakInfo?.bonus?.current && (
                      <View style={styles.bonusBadge}>
                        <Text style={styles.bonusBadgeText}>
                          {streakInfo.bonus.current.emoji} {streakInfo.bonus.current.title}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.streakValue, {
                    color: streakInfo?.status?.color === 'gray' ? '#6c757d' :
                           streakInfo?.status?.color === 'blue' ? '#0d6efd' :
                           streakInfo?.status?.color === 'green' ? '#198754' :
                           streakInfo?.status?.color === 'orange' ? '#fd7e14' :
                           streakInfo?.status?.color === 'purple' ? '#6f42c1' : '#0d6efd'
                  }]}>
                    {streakInfo.streak}일
                  </Text>
                  <Text style={styles.streakMessage}>
                    {streakInfo?.status?.message || ''}
                  </Text>
                  
                  <View style={styles.progressSection}>
                    <View style={styles.progressBar}>
                      <View 
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(100, (totalAttempts / streakInfo.requiredDaily) * 100)}%`,
                            backgroundColor: totalAttempts >= streakInfo.requiredDaily ? '#34C759' : '#007AFF'
                          }
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {totalAttempts}/{streakInfo.requiredDaily}
                    </Text>
                  </View>
                  
                  <Text style={styles.statusMessage}>
                    {totalAttempts >= streakInfo.requiredDaily ? 
                      '오늘 목표 달성! 🎉' : 
                      `오늘 ${streakInfo.requiredDaily - totalAttempts}개 더 필요`}
                  </Text>

                  <TouchableOpacity
                    style={styles.studyDetailsButton}
                    onPress={() => setShowStudyDetails(true)}
                  >
                    <Text style={styles.studyDetailsButtonText}>
                      📊 오늘 학습: {totalAttempts}회 | 오답율: {errorRate}%
                      {isEstimated && ' (추정)'}
                    </Text>
                    <Ionicons name="chevron-down" size={12} color="#666" />
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.noStreakText}>연속학습 정보를 불러올 수 없습니다.</Text>
              )}
            </View>
          </View>
        </View>

        {/* 빠른 시작 */}
        <View style={styles.quickStartSection}>
          <Text style={styles.quickStartTitle}>빠른 시작</Text>
          <View style={styles.quickStartGrid}>
            <TouchableOpacity style={styles.quickStartCard} onPress={startSrsLearning}>
              <Text style={styles.quickStartCardTitle}>SRS 학습</Text>
              <Text style={styles.quickStartCardDesc}>오늘 복습할 단어들을 Leitner 시스템으로 학습합니다.</Text>
              <View style={styles.quickStartButton}>
                <Text style={styles.quickStartButtonText}>학습 시작</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickStartCard} 
              onPress={() => navigation.navigate('WrongAnswers')}
            >
              <Text style={styles.quickStartCardTitle}>오답 노트</Text>
              <Text style={styles.quickStartCardDesc}>이전에 틀렸던 단어들을 집중적으로 다시 학습합니다.</Text>
              <View style={[styles.quickStartButton, styles.quickStartButtonDanger]}>
                <Text style={styles.quickStartButtonText}>오답 확인</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickStartCard} 
              onPress={() => navigation.navigate('MyWordbook')}
            >
              <Text style={styles.quickStartCardTitle}>내 단어장</Text>
              <Text style={styles.quickStartCardDesc}>직접 추가한 단어들을 관리하고, 폴더별로 학습합니다.</Text>
              <View style={[styles.quickStartButton, styles.quickStartButtonSecondary]}>
                <Text style={[styles.quickStartButtonText, styles.quickStartButtonTextSecondary]}>단어장 가기</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* 마스터된 단어 모달 */}
      <Modal
        visible={showMasteredDetails}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMasteredDetails(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🏆 마스터한 단어들</Text>
            <TouchableOpacity onPress={() => setShowMasteredDetails(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            {masteredCards.length > 0 ? (
              <>
                <Text style={styles.modalSubtitle}>
                  총 {masteredCards.length}개의 단어를 마스터했습니다! 🎉
                </Text>
                <FlatList
                  data={masteredCards.sort((a, b) => new Date(b.masteredAt).getTime() - new Date(a.masteredAt).getTime())}
                  renderItem={renderMasteredCard}
                  keyExtractor={(item, index) => item.id?.toString() || index.toString()}
                  showsVerticalScrollIndicator={false}
                />
              </>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateTitle}>🌟 아직 마스터한 단어가 없습니다.</Text>
                <Text style={styles.emptyStateDesc}>꾸준히 학습해서 첫 마스터를 달성해보세요!</Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* 오늘 학습 단어 모달 */}
      <Modal
        visible={showStudyDetails}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowStudyDetails(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📊 오늘 학습한 단어들</Text>
            <TouchableOpacity onPress={() => setShowStudyDetails(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            {Object.keys(wordFirstAttempts || {}).length > 0 ? (
              <>
                <Text style={styles.modalSubtitle}>
                  총 {Object.keys(wordFirstAttempts || {}).length}개 단어 | 
                  정답: {Object.values(wordFirstAttempts || {}).filter((a: any) => a.isCorrect).length}개 | 
                  오답: {Object.values(wordFirstAttempts || {}).filter((a: any) => !a.isCorrect).length}개
                </Text>
                <FlatList
                  data={Object.values(wordFirstAttempts).sort((a: any, b: any) => new Date(b.time).getTime() - new Date(a.time).getTime())}
                  renderItem={renderStudyWord}
                  keyExtractor={(item: any, index) => `${item.word}_${index}`}
                  showsVerticalScrollIndicator={false}
                />
              </>
            ) : totalAttempts > 0 && isEstimated ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateTitle}>📚 {totalAttempts}회 학습 완료!</Text>
                <Text style={styles.emptyStateDesc}>상세 학습 기록을 불러올 수 없습니다.</Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateTitle}>🦜 아직 학습한 단어가 없습니다.</Text>
                <Text style={styles.emptyStateDesc}>SRS 학습을 시작해보세요!</Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  welcomeSection: {
    backgroundColor: '#e9ecef',
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  welcomeDesc: {
    fontSize: 16,
    color: '#666',
  },
  levelText: {
    fontWeight: 'bold',
    color: '#007AFF',
  },
  overdueAlert: {
    backgroundColor: '#f8d7da',
    borderWidth: 1,
    borderColor: '#f5c6cb',
    borderRadius: 8,
    margin: 16,
    padding: 16,
  },
  overdueAlertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  overdueAlertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#721c24',
  },
  overdueCount: {
    backgroundColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  overdueCountText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  overdueAlertDesc: {
    fontSize: 14,
    color: '#721c24',
    marginBottom: 4,
  },
  overdueCountInline: {
    fontWeight: 'bold',
    color: '#dc3545',
  },
  overdueAlertNext: {
    fontSize: 12,
    color: '#721c24',
    marginBottom: 12,
  },
  overdueButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  overdueButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  generalAlert: {
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: '#ffeaa7',
    borderRadius: 8,
    margin: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  generalAlertText: {
    flex: 1,
    fontSize: 14,
    color: '#856404',
  },
  generalAlertButton: {
    backgroundColor: '#ffc107',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginLeft: 12,
  },
  generalAlertButtonText: {
    color: '#333',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statsSection: {
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  statCardValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  statCardFooter: {
    alignItems: 'center',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#8E8E93',
    borderRadius: 4,
    gap: 4,
  },
  detailsButtonText: {
    fontSize: 12,
    color: '#666',
  },
  streakHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  streakTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  bonusBadge: {
    backgroundColor: '#ffc107',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bonusBadgeText: {
    fontSize: 10,
    color: '#333',
    fontWeight: 'bold',
  },
  streakValue: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  streakMessage: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  progressSection: {
    marginBottom: 12,
  },
  progressBar: {
    height: 20,
    backgroundColor: '#e9ecef',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 10,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  statusMessage: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  studyDetailsButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  studyDetailsButtonText: {
    fontSize: 10,
    color: '#666',
    flex: 1,
  },
  noStreakText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  quickStartSection: {
    padding: 16,
  },
  quickStartTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  quickStartGrid: {
    gap: 16,
  },
  quickStartCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  quickStartCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  quickStartCardDesc: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  quickStartButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickStartButtonDanger: {
    backgroundColor: '#dc3545',
  },
  quickStartButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#8E8E93',
  },
  quickStartButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  quickStartButtonTextSecondary: {
    color: '#8E8E93',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    backgroundColor: 'white',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    flex: 1,
    padding: 16,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  masteredCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ffc107',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  masteredCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  masteredCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  masteredCycles: {
    backgroundColor: '#34C759',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  masteredCyclesText: {
    fontSize: 12,
    color: 'white',
    fontWeight: 'bold',
  },
  masteredCardPos: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  masteredCardGloss: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  masteredCardDate: {
    fontSize: 12,
    color: '#ffc107',
    fontWeight: 'bold',
  },
  studyWordBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  correctBadge: {
    backgroundColor: '#d1f2eb',
  },
  wrongBadge: {
    backgroundColor: '#fadbd8',
  },
  studyWordText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});