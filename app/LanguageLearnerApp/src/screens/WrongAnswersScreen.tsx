/*
  WrongAnswersScreen.tsx — React Native 버전 (Part 1/3)
  ------------------------------------------------------------
  웹 WrongAnswers.jsx를 모바일 앱에 맞게 리팩토링
  Part 1/3: 헬퍼 함수, 인터페이스, 기본 구조
*/

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';

import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../services/apiClient';
import { RootStackParamList } from '../navigation/types';
import { getVocabMeaning } from '../utils/vocabUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'WrongAnswers'>;

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// TypeScript 인터페이스 (Part 1/3)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

interface WrongAnswerItem {
  id: number;
  wrongAt: string;
  reviewWindowStart: string;
  reviewWindowEnd: string;
  canReview: boolean;
  totalWrongAttempts: number;
  attempts: number;
  vocab?: {
    id: number;
    lemma: string;
    pos: string;
    ko_gloss?: string;
    levelCEFR?: string;
    dictentry?: {
      examples?: string | any[];
    };
  };
  wrongData?: {
    level?: string;
    questionId?: string;
    question?: string;
    passage?: string;
    options?: { [key: string]: string } | string[];
    userAnswer?: string;
    correctAnswer?: string;
    explanation?: string;
    topicId?: string;
    topicTitle?: string;
    script?: string;
    topic?: string;
    audioFile?: string;
    incorrectCount?: number;
  };
  srsCard?: {
    id: number;
    stage: number;
    nextReviewAt?: string;
    waitingUntil?: string;
    isOverdue: boolean;
    overdueDeadline?: string;
    isFromWrongAnswer: boolean;
    frozenUntil?: string;
    isFrozen: boolean;
    isMastered: boolean;
    masterCycles: number;
    masteredAt?: string;
    correctTotal: number;
    wrongTotal: number;
    folders?: Array<{
      id: number;
      name: string;
      parentId?: number;
      parentName?: string;
      isWrongAnswerFolder: boolean;
    }>;
  };
  wrongAnswerHistory?: Array<{
    id: number;
    wrongAt: string;
    stageAtTime?: number;
  }>;
}

interface CategoryStats {
  vocab: { total: number; active: number };
  grammar: { total: number; active: number };
  reading: { total: number; active: number };
  listening: { total: number; active: number };
}

type TabType = 'vocab' | 'grammar' | 'reading' | 'listening';

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 헬퍼 함수들 (Part 1/3)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const formatTimeRemaining = (hours: number): string => {
  if (hours <= 0) return '지금';
  if (hours < 24) return `${Math.ceil(hours)}시간 후`;
  const days = Math.floor(hours / 24);
  return `${days}일 후`;
};

const getSrsStatusBadge = (srsCard: WrongAnswerItem['srsCard']) => {
  if (!srsCard) {
    return { text: 'SRS 정보 없음', color: '#6c757d' };
  }

  const now = new Date();

  // 마스터 완료 확인
  if (srsCard.isMastered) {
    return { text: '마스터 완료', color: '#ffc107' };
  }

  // 동결 상태 확인 (최우선)
  if (srsCard.frozenUntil && new Date(srsCard.frozenUntil) > now) {
    return { text: '동결 상태', color: '#0dcaf0' };
  }

  // overdue 상태 확인 (동결 다음 우선순위)
  if (srsCard.isOverdue) {
    return { text: '복습 가능', color: '#dc3545' };
  }

  // 대기 시간 확인 (waitingUntil 기준)
  if (srsCard.waitingUntil) {
    const waitingUntil = new Date(srsCard.waitingUntil);
    if (now < waitingUntil) {
      // 아직 대기 중
      if (srsCard.isFromWrongAnswer) {
        return { text: '오답 대기 중', color: '#ffc107' };
      } else {
        return { text: `Stage ${srsCard.stage} 대기 중`, color: '#0d6efd' };
      }
    } else {
      // 대기 시간 완료 - 즉시 복습 가능
      return { text: '복습 가능', color: '#198754' };
    }
  }

  // nextReviewAt 기준 확인 (하위 호환성)
  if (srsCard.nextReviewAt) {
    const nextReviewAt = new Date(srsCard.nextReviewAt);
    if (now < nextReviewAt) {
      return { text: `Stage ${srsCard.stage} 대기 중`, color: '#0d6efd' };
    } else {
      return { text: '복습 가능', color: '#198754' };
    }
  }

  // 기본값 (stage 0 또는 정보 부족)
  return { text: '학습 대기 중', color: '#6c757d' };
};

const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

const formatDateTimeShort = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

// Part 1/3 스타일 정의
const styles = StyleSheet.create({
  // 기본 컨테이너
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },

  // 헤더
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  srsButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#6c757d',
    borderRadius: 6,
  },
  srsButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },

  // 탭 네비게이션
  tabContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: 'white',
  },
  tabBadge: {
    backgroundColor: '#0d6efd',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },

  // 요약 카드 (어휘 탭용)
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    gap: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  summaryNumberSuccess: {
    color: '#198754',
  },
  summaryNumberWarning: {
    color: '#ffc107',
  },
  summaryNumberInfo: {
    color: '#0dcaf0',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },

  // 상태 뱃지
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
});

export type {
  WrongAnswerItem,
  CategoryStats,
  TabType,
  Props,
};

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 메인 컴포넌트 로직 (Part 2/3)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

export default function WrongAnswersScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<TabType>('vocab');
  const [categories, setCategories] = useState<CategoryStats>({
    vocab: { total: 0, active: 0 },
    grammar: { total: 0, active: 0 },
    reading: { total: 0, active: 0 },
    listening: { total: 0, active: 0 },
  });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [expandedDetails, setExpandedDetails] = useState<Set<number>>(new Set());

  // ──────────────────────────────────────────────────────────────────────────────────────────────
  // 데이터 로딩 로직 (Part 2/3)
  // ──────────────────────────────────────────────────────────────────────────────────────────────

  const loadCategories = async () => {
    try {
      const response = await apiClient.get('/api/odat-note/categories');
      const data = response.data?.data || response.data;
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const reload = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/api/odat-note/list?type=${selectedTab}`);
      const data = response.data?.data || response.data || [];
      setWrongAnswers(data);
    } catch (error) {
      console.error('Failed to load wrong answers:', error);
      setWrongAnswers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    reload();
  }, [selectedTab]);

  // ──────────────────────────────────────────────────────────────────────────────────────────────
  // 핸들러 함수들 (Part 2/3)
  // ──────────────────────────────────────────────────────────────────────────────────────────────

  const handleSelectItem = (id: number) => {
    // 유효하지 않은 ID는 무시 (temp ID 등)
    if (!id || (typeof id === 'string' && id.startsWith('temp-'))) {
      console.log('handleSelectItem: Ignoring invalid ID:', id);
      return;
    }
    
    setSelectedIds(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return newSelected;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === wrongAnswers.length) {
      setSelectedIds(new Set());
    } else {
      // 유효한 ID만 선택 (temp ID 제외)
      const realIds = wrongAnswers
        .map(wa => wa.id)
        .filter(id => id && !String(id).startsWith('temp-'));
      setSelectedIds(new Set(realIds));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    // temp ID 필터링하고 실제 데이터베이스 ID만 유지
    const realIds = Array.from(selectedIds).filter(id => id && !String(id).startsWith('temp-'));
    
    if (realIds.length === 0) {
      Alert.alert('알림', '선택된 항목 중 삭제 가능한 항목이 없습니다.');
      return;
    }

    Alert.alert(
      '삭제 확인',
      `선택한 ${realIds.length}개 항목을 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.post('/srs/wrong-answers/delete-multiple', {
                wrongAnswerIds: realIds
              });
              
              setSelectedIds(new Set());
              await reload();
              Alert.alert('성공', '선택한 항목들이 삭제되었습니다.');
            } catch (error: any) {
              Alert.alert('오류', `삭제 실패: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  const toggleDetails = (id: number) => {
    setExpandedDetails(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(id)) {
        newExpanded.delete(id);
      } else {
        newExpanded.add(id);
      }
      return newExpanded;
    });
  };

  const handleStartLearning = (mode: 'srs_folder' | 'flash') => {
    if (selectedIds.size === 0) {
      Alert.alert('알림', '학습할 단어를 선택해주세요.');
      return;
    }

    // 선택된 오답노트 항목들 가져오기
    const selectedWrongAnswers = wrongAnswers.filter((wa) => selectedIds.has(wa.id));

    // 폴더별로 그룹화
    const folderGroups = new Map();
    selectedWrongAnswers.forEach((wa) => {
      // SRS 카드에서 폴더 정보 추출
      if (wa.srsCard?.folders && wa.srsCard.folders.length > 0) {
        // 첫 번째 폴더를 기본으로 사용
        const folder = wa.srsCard.folders[0];
        const folderId = folder.id;

        if (!folderGroups.has(folderId)) {
          folderGroups.set(folderId, {
            folder: folder,
            vocabIds: [],
          });
        }

        folderGroups.get(folderId).vocabIds.push(wa.vocab?.id);
      }
    });

    if (folderGroups.size === 0) {
      Alert.alert('알림', '선택된 단어의 폴더 정보를 찾을 수 없습니다.');
      return;
    }

    // 첫 번째 폴더로 학습 시작
    const [folderId, groupData] = folderGroups.entries().next().value;
    const { folder, vocabIds } = groupData;

    // 여러 폴더의 단어가 섞여 있으면 경고
    if (folderGroups.size > 1) {
      const folderNames = Array.from(folderGroups.values())
        .map((g: any) => g.folder.name)
        .join(', ');
      
      Alert.alert(
        '여러 폴더',
        `선택된 단어들이 여러 폴더(${folderNames})에 속해 있습니다. '${folder.name}' 폴더로 학습을 시작하시겠습니까?`,
        [
          { text: '취소', style: 'cancel' },
          { text: '확인', onPress: () => startLearningWithParams(mode, folderId, vocabIds) }
        ]
      );
    } else {
      startLearningWithParams(mode, folderId, vocabIds);
    }
  };

  const startLearningWithParams = (mode: string, folderId: number, vocabIds: number[]) => {
    const params: any = {
      mode: mode === 'flash' ? 'flash' : 'srs_folder',
      folderId: folderId.toString(),
      selectedItems: vocabIds.join(','),
    };

    if (mode === 'flash') {
      params.auto = '1';
    }

    navigation.navigate('LearnVocab', params);
  };

  const handleStartReadingReview = () => {
    if (selectedIds.size === 0) {
      Alert.alert('알림', '복습할 문제를 선택해주세요.');
      return;
    }

    // 선택된 오답 항목들에서 데이터 추출
    const selectedWrongAnswers = wrongAnswers.filter((wa) => selectedIds.has(wa.id));

    if (selectedTab === 'reading') {
      // 리딩 오답들을 세션 스토리지에 저장하고 복습 페이지로 이동
      const reviewData = selectedWrongAnswers.map((wa) => {
        // questionId에서 숫자 부분 추출
        let questionIndex = 0;
        const questionId = wa.wrongData?.questionId;
        if (typeof questionId === 'string' && questionId.includes('_')) {
          const match = questionId.match(/_(\d+)$/);
          questionIndex = match ? parseInt(match[1]) - 1 : 0; // 0-based index
        } else if (questionId) {
          questionIndex = parseInt(String(questionId)) - 1 || 0;
        }
        
        return {
          id: wa.id,
          level: wa.wrongData?.level || 'A1',
          questionIndex: questionIndex,
          passage: wa.wrongData?.passage || '',
          question: wa.wrongData?.question || '',
          options: wa.wrongData?.options || {},
          answer: wa.wrongData?.correctAnswer || 'A',
          explanation_ko: wa.wrongData?.explanation || '',
          isReview: true,
          wrongAnswerId: wa.id,
        };
      });

      // React Native에서는 sessionStorage 대신 AsyncStorage 사용할 수 있지만
      // 여기서는 navigation params로 전달
      navigation.navigate('Reading', { reviewData });
    } else if (selectedTab === 'grammar') {
      // 문법 오답 복습
      const grammarTopics = [...new Set(selectedWrongAnswers.map(wa => wa.wrongData?.topicId).filter(Boolean))];
      if (grammarTopics.length > 0) {
        navigation.navigate('Grammar', { topicId: grammarTopics[0] });
      } else {
        Alert.alert('알림', '문법 주제 정보를 찾을 수 없습니다.');
      }
    } else if (selectedTab === 'listening') {
      // 리스닝 오답 복습
      const listeningLevels = [...new Set(selectedWrongAnswers.map(wa => wa.wrongData?.level).filter(Boolean))];
      if (listeningLevels.length > 0) {
        navigation.navigate('Listening', { level: listeningLevels[0] });
      } else {
        Alert.alert('알림', '리스닝 레벨 정보를 찾을 수 없습니다.');
      }
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    reload();
  };

  // ──────────────────────────────────────────────────────────────────────────────────────────────
  // 계산된 값들 (Part 2/3)
  // ──────────────────────────────────────────────────────────────────────────────────────────────

  const availableCount = useMemo(() => {
    return wrongAnswers.filter((wa) => wa.canReview).length;
  }, [wrongAnswers]);

  const totalCount = wrongAnswers.length;

  const isAllSelected = useMemo(() => {
    if (wrongAnswers.length === 0) return false;
    const validIds = wrongAnswers
      .map(wa => wa.id)
      .filter(id => id && !String(id).startsWith('temp-'));
    return validIds.length > 0 && validIds.every(id => selectedIds.has(id));
  }, [wrongAnswers, selectedIds]);

  // ──────────────────────────────────────────────────────────────────────────────────────────────
  // UI 렌더링 (Part 3/3)
  // ──────────────────────────────────────────────────────────────────────────────────────────────

  const renderWrongAnswerItem = ({ item, index }: { item: WrongAnswerItem; index: number }) => {
    const actualId = item.id;
    const safeId = actualId || `temp-${index}`;
    const hasRealId = actualId && !String(actualId).startsWith('temp-');
    const isSelected = hasRealId && selectedIds.has(actualId);
    const isExpanded = expandedDetails.has(actualId || safeId);
    const statusBadge = getSrsStatusBadge(item.srsCard);

    return (
      <View style={[
        styles.wrongAnswerCard,
        item.srsCard?.isMastered && styles.wrongAnswerCardMastered,
        isSelected && styles.wrongAnswerCardSelected
      ]}>
        {/* 체크박스 및 기본 정보 */}
        <View style={styles.wrongAnswerHeader}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => hasRealId && handleSelectItem(actualId)}
            disabled={!hasRealId}
          >
            <Icon
              name={isSelected ? 'checkbox' : 'square-outline'}
              size={24}
              color={hasRealId ? (isSelected ? '#007AFF' : '#8E8E93') : '#CCC'}
            />
          </TouchableOpacity>

          <View style={styles.wrongAnswerContent}>
            {/* 어휘 오답의 경우 */}
            {selectedTab === 'vocab' && item.vocab && (
              <View>
                <View style={styles.vocabHeader}>
                  <Text style={styles.vocabLemma}>{item.vocab.lemma}</Text>
                  <Text style={styles.vocabPos}>({item.vocab.pos})</Text>
                  {item.srsCard?.isMastered && (
                    <View style={styles.masterStar}>
                      <Text style={styles.masterStarText}>⭐</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.vocabMeaning}>{getVocabMeaning(item.vocab)}</Text>
              </View>
            )}

            {/* 리딩 오답의 경우 */}
            {selectedTab === 'reading' && item.wrongData && (
              <View>
                <View style={styles.readingHeader}>
                  <Text style={styles.readingTitle}>
                    📖 {item.wrongData.level} 레벨 리딩 문제 #{getQuestionNumber(item.wrongData.questionId)}
                  </Text>
                </View>
                <Text style={styles.questionText}>
                  <Text style={styles.questionLabel}>문제: </Text>
                  {item.wrongData.question}
                </Text>
                <View style={styles.answerBadges}>
                  <View style={[styles.answerBadge, styles.userAnswerBadge]}>
                    <Text style={styles.answerBadgeText}>내 답: {item.wrongData.userAnswer}</Text>
                  </View>
                  <View style={[styles.answerBadge, styles.correctAnswerBadge]}>
                    <Text style={styles.answerBadgeText}>정답: {item.wrongData.correctAnswer}</Text>
                  </View>
                </View>
                {item.wrongData.passage && (
                  <Text style={styles.passagePreview} numberOfLines={2}>
                    <Text style={styles.passageLabel}>지문: </Text>
                    {item.wrongData.passage}
                  </Text>
                )}
              </View>
            )}

            {/* 문법 오답의 경우 */}
            {selectedTab === 'grammar' && item.wrongData && (
              <View>
                <View style={styles.grammarHeader}>
                  <Text style={styles.grammarTitle}>📝 {item.wrongData.topicTitle || '문법 문제'}</Text>
                  <View style={[styles.levelBadge, { backgroundColor: '#6c757d' }]}>
                    <Text style={styles.levelBadgeText}>{item.wrongData.level} 레벨</Text>
                  </View>
                </View>
                <Text style={styles.questionText}>
                  <Text style={styles.questionLabel}>문제: </Text>
                  {item.wrongData.question}
                </Text>
                <View style={styles.answerBadges}>
                  <View style={[styles.answerBadge, styles.userAnswerBadge]}>
                    <Text style={styles.answerBadgeText}>내 답: {item.wrongData.userAnswer}</Text>
                  </View>
                  <View style={[styles.answerBadge, styles.correctAnswerBadge]}>
                    <Text style={styles.answerBadgeText}>정답: {item.wrongData.correctAnswer}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* 리스닝 오답의 경우 */}
            {selectedTab === 'listening' && item.wrongData && (
              <View>
                <View style={styles.listeningHeader}>
                  <Text style={styles.listeningTitle}>🎧 {item.wrongData.topic || '리스닝 문제'}</Text>
                  <View style={[styles.levelBadge, { backgroundColor: '#6c757d' }]}>
                    <Text style={styles.levelBadgeText}>{item.wrongData.level} 레벨</Text>
                  </View>
                </View>
                <Text style={styles.questionText}>
                  <Text style={styles.questionLabel}>질문: </Text>
                  {item.wrongData.question || '질문 정보 없음'}
                </Text>
                <Text style={styles.scriptText}>
                  <Text style={styles.scriptLabel}>스크립트: </Text>
                  <Text style={styles.scriptContent}>"{item.wrongData.script || '스크립트 정보 없음'}"</Text>
                </Text>
                <View style={styles.answerBadges}>
                  <View style={[styles.answerBadge, styles.userAnswerBadge]}>
                    <Text style={styles.answerBadgeText}>내 답: {item.wrongData.userAnswer}</Text>
                  </View>
                  <View style={[styles.answerBadge, styles.correctAnswerBadge]}>
                    <Text style={styles.answerBadgeText}>정답: {item.wrongData.correctAnswer}</Text>
                  </View>
                </View>
                {item.wrongData.audioFile && (
                  <Text style={styles.audioFileText}>
                    <Text style={styles.audioFileLabel}>음성 파일: </Text>
                    {item.wrongData.audioFile}
                  </Text>
                )}
              </View>
            )}

            {/* 상태 정보 */}
            <View style={styles.statusInfo}>
              {selectedTab === 'vocab' && (
                <View style={[styles.statusBadge, { backgroundColor: statusBadge.color }]}>
                  <Text style={styles.statusBadgeText}>{statusBadge.text}</Text>
                </View>
              )}
              
              <Text style={styles.attemptsText}>
                총 오답 {item.totalWrongAttempts || item.attempts}회
              </Text>
              <Text style={styles.dateText}>
                최근 오답: {formatDateTimeShort(item.wrongAt)}
              </Text>
              
              {selectedTab !== 'vocab' && (
                <View style={[styles.statusBadge, { backgroundColor: '#0dcaf0' }]}>
                  <Text style={styles.statusBadgeText}>복습 가능</Text>
                </View>
              )}
            </View>

            {/* 폴더 정보 (어휘 오답만) */}
            {item.srsCard?.folders && item.srsCard.folders.length > 0 && (
              <View style={styles.folderInfo}>
                <Text style={styles.folderLabel}>폴더: </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.folderBadges}>
                    {item.srsCard.folders.map((folder, idx) => (
                      <View key={folder.id} style={styles.folderBadgeContainer}>
                        {idx > 0 && <Text style={styles.folderSeparator}>, </Text>}
                        <TouchableOpacity
                          style={[
                            styles.folderBadge,
                            folder.isWrongAnswerFolder ? styles.wrongAnswerFolderBadge : styles.normalFolderBadge
                          ]}
                          onPress={() => {
                            const route = folder.parentId ? `SrsFolder/${folder.id}` : `SrsParent/${folder.id}`;
                            // navigation.navigate(route); // 필요시 구현
                          }}
                        >
                          {folder.isWrongAnswerFolder && (
                            <Text style={styles.warningIcon}>⚠️ </Text>
                          )}
                          {folder.parentName && (
                            <Text style={styles.parentFolderText}>{folder.parentName} &gt; </Text>
                          )}
                          <Text style={styles.folderBadgeText}>{folder.name}</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
        </View>

        {/* 세부정보 토글 버튼 */}
        <TouchableOpacity
          style={styles.detailToggleButton}
          onPress={() => toggleDetails(actualId || safeId)}
        >
          <Text style={styles.detailToggleButtonText}>
            {isExpanded ? '▼ 세부정보 접기' : '▶ 세부정보 보기'}
          </Text>
        </TouchableOpacity>

        {/* 확장된 세부 정보 */}
        {isExpanded && (
          <View style={styles.detailsContainer}>
            <Text style={styles.detailsTitle}>📊 오답 세부 정보</Text>
            
            {selectedTab === 'vocab' && renderVocabDetails(item)}
            {selectedTab === 'reading' && item.wrongData && renderReadingDetails(item)}
            {selectedTab === 'grammar' && item.wrongData && renderGrammarDetails(item)}
            {selectedTab === 'listening' && item.wrongData && renderListeningDetails(item)}
          </View>
        )}
      </View>
    );
  };

  // 헬퍼 함수들

  const getQuestionNumber = (questionId?: string): string => {
    if (!questionId) return 'NaN';
    if (typeof questionId === 'string' && questionId.includes('_')) {
      const match = questionId.match(/_(\d+)$/);
      return match ? parseInt(match[1]).toString() : 'NaN';
    }
    return questionId.toString();
  };

  const renderVocabDetails = (item: WrongAnswerItem) => (
    <View style={styles.vocabDetails}>
      <View style={styles.detailRow}>
        <View style={styles.detailColumn}>
          <Text style={styles.detailLabel}>복습 기간:</Text>
          <Text style={styles.detailValue}>
            {formatDateTime(item.reviewWindowStart)} ~{'\n'}
            {formatDateTime(item.reviewWindowEnd)}
          </Text>
        </View>
        <View style={styles.detailColumn}>
          <Text style={styles.detailLabel}>총 오답 횟수:</Text>
          <View style={[styles.statusBadge, { backgroundColor: '#ffc107' }]}>
            <Text style={[styles.statusBadgeText, { color: '#333' }]}>
              {item.totalWrongAttempts || item.attempts}회
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.detailRow}>
        <View style={styles.detailColumn}>
          <Text style={styles.detailLabel}>첫 오답 시각:</Text>
          <Text style={styles.detailValue}>
            {item.wrongAnswerHistory && item.wrongAnswerHistory.length > 0
              ? formatDateTime(item.wrongAnswerHistory[0].wrongAt)
              : formatDateTime(item.wrongAt)}
          </Text>
        </View>
        <View style={styles.detailColumn}>
          <Text style={styles.detailLabel}>SRS 상태:</Text>
          <View style={[styles.statusBadge, { backgroundColor: getSrsStatusBadge(item.srsCard).color }]}>
            <Text style={styles.statusBadgeText}>{getSrsStatusBadge(item.srsCard).text}</Text>
          </View>
        </View>
      </View>

      {/* 오답 히스토리 */}
      {item.wrongAnswerHistory && item.wrongAnswerHistory.length > 0 && (
        <View style={styles.historyContainer}>
          <Text style={styles.historyTitle}>📚 오답 기록 히스토리</Text>
          {item.wrongAnswerHistory.map((history, idx) => (
            <View key={history.id} style={styles.historyItem}>
              <Text style={styles.historyText}>
                <Text style={styles.historyIndex}>#{idx + 1}회차: </Text>
                {formatDateTime(history.wrongAt)}
              </Text>
              <View style={styles.historyBadges}>
                <View style={[styles.statusBadge, { backgroundColor: '#dc3545' }]}>
                  <Text style={styles.statusBadgeText}>오답</Text>
                </View>
                {history.stageAtTime !== undefined && (
                  <View style={[styles.statusBadge, { backgroundColor: '#0dcaf0' }]}>
                    <Text style={styles.statusBadgeText}>Stage {history.stageAtTime}</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderReadingDetails = (item: WrongAnswerItem) => (
    <View style={styles.readingDetails}>
      <View style={styles.fullPassageContainer}>
        <Text style={styles.detailLabel}>📖 지문 전체:</Text>
        <View style={styles.fullPassageBox}>
          <Text style={styles.fullPassageText}>{item.wrongData?.passage}</Text>
        </View>
      </View>

      <View style={styles.fullQuestionContainer}>
        <Text style={styles.detailLabel}>❓ 문제:</Text>
        <View style={styles.fullQuestionBox}>
          <Text style={styles.fullQuestionText}>{item.wrongData?.question}</Text>
        </View>
      </View>

      <View style={styles.optionsContainer}>
        <Text style={styles.detailLabel}>📝 선택지:</Text>
        {Object.entries(item.wrongData?.options || {}).map(([key, value]) => (
          <View
            key={key}
            style={[
              styles.optionItem,
              key === item.wrongData?.correctAnswer && styles.correctOption,
              key === item.wrongData?.userAnswer && key !== item.wrongData?.correctAnswer && styles.wrongOption,
            ]}
          >
            <Text style={[
              styles.optionText,
              key === item.wrongData?.correctAnswer && styles.correctOptionText,
              key === item.wrongData?.userAnswer && key !== item.wrongData?.correctAnswer && styles.wrongOptionText,
            ]}>
              <Text style={styles.optionKey}>{key}.</Text> {value}
              {key === item.wrongData?.correctAnswer && (
                <Text style={styles.optionResult}> ✅ 정답</Text>
              )}
              {key === item.wrongData?.userAnswer && key !== item.wrongData?.correctAnswer && (
                <Text style={styles.optionResult}> ❌ 내 답</Text>
              )}
            </Text>
          </View>
        ))}
      </View>

      {item.wrongData?.explanation && (
        <View style={styles.explanationContainer}>
          <Text style={styles.detailLabel}>💡 해설:</Text>
          <View style={styles.explanationBox}>
            <Text style={styles.explanationText}>{item.wrongData.explanation}</Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderGrammarDetails = (item: WrongAnswerItem) => (
    <View style={styles.grammarDetails}>
      <View style={styles.fullQuestionContainer}>
        <Text style={styles.detailLabel}>📝 문제 전체:</Text>
        <View style={styles.fullQuestionBox}>
          <Text style={styles.fullQuestionText}>{item.wrongData?.question}</Text>
        </View>
      </View>

      <View style={styles.optionsContainer}>
        <Text style={styles.detailLabel}>📝 선택지:</Text>
        {item.wrongData?.options && Array.isArray(item.wrongData.options) && 
          item.wrongData.options.map((option, idx) => (
            <View
              key={idx}
              style={[
                styles.optionItem,
                option === item.wrongData?.correctAnswer && styles.correctOption,
                option === item.wrongData?.userAnswer && option !== item.wrongData?.correctAnswer && styles.wrongOption,
              ]}
            >
              <Text style={[
                styles.optionText,
                option === item.wrongData?.correctAnswer && styles.correctOptionText,
                option === item.wrongData?.userAnswer && option !== item.wrongData?.correctAnswer && styles.wrongOptionText,
              ]}>
                {option}
                {option === item.wrongData?.correctAnswer && (
                  <Text style={styles.optionResult}> ✅ 정답</Text>
                )}
                {option === item.wrongData?.userAnswer && option !== item.wrongData?.correctAnswer && (
                  <Text style={styles.optionResult}> ❌ 내 답</Text>
                )}
              </Text>
            </View>
          ))
        }
      </View>

      {item.wrongData?.explanation && (
        <View style={styles.explanationContainer}>
          <Text style={styles.detailLabel}>💡 해설:</Text>
          <View style={styles.explanationBox}>
            <Text style={styles.explanationText}>{item.wrongData.explanation}</Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderListeningDetails = (item: WrongAnswerItem) => (
    <View style={styles.listeningDetails}>
      <View style={styles.fullQuestionContainer}>
        <Text style={styles.detailLabel}>🎧 질문:</Text>
        <View style={styles.fullQuestionBox}>
          <Text style={styles.fullQuestionText}>{item.wrongData?.question}</Text>
        </View>
      </View>

      <View style={styles.scriptContainer}>
        <Text style={styles.detailLabel}>📝 스크립트:</Text>
        <View style={styles.scriptBox}>
          <Text style={styles.scriptDetailText}>"{item.wrongData?.script}"</Text>
        </View>
      </View>

      <View style={styles.optionsContainer}>
        <Text style={styles.detailLabel}>📝 선택지:</Text>
        {Object.entries(item.wrongData?.options || {}).map(([key, value]) => (
          <View
            key={key}
            style={[
              styles.optionItem,
              key === item.wrongData?.correctAnswer && styles.correctOption,
              key === item.wrongData?.userAnswer && key !== item.wrongData?.correctAnswer && styles.wrongOption,
            ]}
          >
            <Text style={[
              styles.optionText,
              key === item.wrongData?.correctAnswer && styles.correctOptionText,
              key === item.wrongData?.userAnswer && key !== item.wrongData?.correctAnswer && styles.wrongOptionText,
            ]}>
              <Text style={styles.optionKey}>{key}.</Text> {value}
              {key === item.wrongData?.correctAnswer && (
                <Text style={styles.optionResult}> ✅ 정답</Text>
              )}
              {key === item.wrongData?.userAnswer && key !== item.wrongData?.correctAnswer && (
                <Text style={styles.optionResult}> ❌ 내 답</Text>
              )}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>📝 오답노트</Text>
            <Text style={styles.headerSubtitle}>카테고리별로 틀린 문제들을 복습할 수 있습니다.</Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={styles.srsButton}
          onPress={() => navigation.navigate('SrsDashboard')}
        >
          <Text style={styles.srsButtonText}>← SRS 대시보드</Text>
        </TouchableOpacity>
      </View>

      {/* 탭 네비게이션 */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow}>
          {[
            { key: 'vocab' as TabType, label: '어휘', icon: '📚' },
            { key: 'grammar' as TabType, label: '문법', icon: '📝' },
            { key: 'reading' as TabType, label: '리딩', icon: '📖' },
            { key: 'listening' as TabType, label: '리스닝', icon: '🎧' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, selectedTab === tab.key && styles.activeTab]}
              onPress={() => setSelectedTab(tab.key)}
            >
              <Text style={styles.tabText}>{tab.icon}</Text>
              <Text style={[styles.tabText, selectedTab === tab.key && styles.activeTabText]}>
                {tab.label}
              </Text>
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{categories[tab.key]?.active || 0}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 요약 정보 - 어휘 탭일 때만 표시 */}
      {selectedTab === 'vocab' && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryNumber, styles.summaryNumberSuccess]}>
              {availableCount}
            </Text>
            <Text style={styles.summaryLabel}>복습 가능</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryNumber, styles.summaryNumberWarning]}>
              {totalCount - availableCount}
            </Text>
            <Text style={styles.summaryLabel}>복습 대기 중</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryNumber, styles.summaryNumberInfo]}>
              {categories[selectedTab]?.total || 0}
            </Text>
            <Text style={styles.summaryLabel}>전체 어휘 오답</Text>
          </View>
        </View>
      )}

      {/* 학습/복습 버튼들 */}
      <View style={styles.actionButtonsContainer}>
        {selectedTab === 'vocab' ? (
          <View style={styles.vocabActions}>
            <TouchableOpacity
              style={[
                styles.learningButton,
                selectedIds.size === 0 ? styles.learningButtonDisabled : 
                selectedIds.size > 100 ? styles.learningButtonWarning : styles.learningButtonEnabled
              ]}
              onPress={() => selectedIds.size > 100 ? 
                Alert.alert('알림', '100개를 초과하여 선택하신 단어는 학습할 수 없습니다. 100개 이하로 선택해주세요.') :
                handleStartLearning('srs_folder')
              }
              disabled={selectedIds.size === 0}
            >
              <Text style={styles.learningButtonText}>
                학습 시작 {selectedIds.size > 0 && `(${selectedIds.size}개 선택)`}
                {selectedIds.size > 100 && ' - 100개 초과'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.autoLearningButton,
                selectedIds.size === 0 ? styles.autoLearningButtonDisabled : 
                selectedIds.size > 100 ? styles.autoLearningButtonWarning : styles.autoLearningButtonEnabled
              ]}
              onPress={() => selectedIds.size > 100 ? 
                Alert.alert('알림', '100개를 초과하여 선택하신 단어는 학습할 수 없습니다. 100개 이하로 선택해주세요.') :
                handleStartLearning('flash')
              }
              disabled={selectedIds.size === 0}
            >
              <Text style={styles.autoLearningButtonText}>
                선택 자동학습 {selectedIds.size > 0 && `(${selectedIds.size}개)`}
                {selectedIds.size > 100 && ' - 100개 초과'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : wrongAnswers.length > 0 && (
          <TouchableOpacity
            style={[
              styles.reviewButton,
              selectedIds.size === 0 && styles.reviewButtonDisabled
            ]}
            onPress={handleStartReadingReview}
            disabled={selectedIds.size === 0}
          >
            <Text style={styles.reviewButtonText}>
              📖 선택한 문제 복습하기 ({selectedIds.size}개)
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 공통 버튼들 */}
      <View style={styles.commonButtonsContainer}>
        {wrongAnswers.length > 0 && (
          <>
            <TouchableOpacity
              style={styles.selectAllButton}
              onPress={handleSelectAll}
            >
              <Text style={styles.selectAllButtonText}>
                {isAllSelected ? '전체 해제' : '전체 선택'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.deleteButton,
                selectedIds.size === 0 && styles.deleteButtonDisabled
              ]}
              onPress={handleDeleteSelected}
              disabled={selectedIds.size === 0}
            >
              <Text style={styles.deleteButtonText}>
                🗑️ 선택 삭제 {selectedIds.size > 0 && `(${selectedIds.size}개)`}
              </Text>
            </TouchableOpacity>
          </>
        )}
        
        <Text style={styles.noteText}>현재는 미완료 오답만 표시됩니다.</Text>
      </View>

      {/* 오답 목록 */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>로딩 중...</Text>
        </View>
      ) : wrongAnswers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>🎉 오답노트가 비어있습니다!</Text>
          <Text style={styles.emptyText}>모든 문제를 정확히 풀고 있군요.</Text>
        </View>
      ) : (
        <FlatList
          data={wrongAnswers}
          renderItem={renderWrongAnswerItem}
          keyExtractor={(item, index) => (item.id ? item.id.toString() : `temp-${index}`)}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// Part 3/3 추가 스타일들을 기존 styles에 병합
Object.assign(styles, {
  // 오답 카드
  wrongAnswerCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  wrongAnswerCardMastered: {
    borderColor: '#ffc107',
    backgroundColor: '#fffbf0',
  },
  wrongAnswerCardSelected: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },

  // 오답 카드 헤더
  wrongAnswerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkboxContainer: {
    paddingTop: 4,
  },
  wrongAnswerContent: {
    flex: 1,
  },

  // 어휘 오답
  vocabHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  vocabLemma: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  vocabPos: {
    fontSize: 14,
    color: '#666',
  },
  masterStar: {
    marginLeft: 4,
  },
  masterStarText: {
    fontSize: 16,
  },
  vocabMeaning: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },

  // 리딩/문법/리스닝 오답
  readingHeader: {
    marginBottom: 8,
  },
  readingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  grammarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  grammarTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  listeningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  listeningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },

  // 레벨 뱃지
  levelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  levelBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },

  // 질문/스크립트
  questionText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  questionLabel: {
    fontWeight: 'bold',
  },
  scriptText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  scriptLabel: {
    fontWeight: 'bold',
  },
  scriptContent: {
    fontStyle: 'italic',
  },
  audioFileText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  audioFileLabel: {
    fontWeight: 'bold',
  },

  // 답변 뱃지
  answerBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  answerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  userAnswerBadge: {
    backgroundColor: '#dc3545',
  },
  correctAnswerBadge: {
    backgroundColor: '#198754',
  },
  answerBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },

  // 지문 미리보기
  passagePreview: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  passageLabel: {
    fontWeight: 'bold',
  },

  // 상태 정보
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  attemptsText: {
    fontSize: 12,
    color: '#666',
  },
  dateText: {
    fontSize: 12,
    color: '#666',
  },

  // 폴더 정보
  folderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  folderLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
    marginRight: 4,
  },
  folderBadges: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  folderBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  folderSeparator: {
    fontSize: 12,
    color: '#666',
  },
  folderBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  wrongAnswerFolderBadge: {
    backgroundColor: '#dc3545',
  },
  normalFolderBadge: {
    backgroundColor: '#007AFF',
  },
  folderBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  warningIcon: {
    fontSize: 10,
    color: '#ffc107',
  },
  parentFolderText: {
    fontSize: 10,
    color: '#ccc',
  },

  // 세부정보 토글 버튼
  detailToggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    marginTop: 8,
  },
  detailToggleButtonText: {
    fontSize: 12,
    color: '#0dcaf0',
    textAlign: 'center',
  },

  // 세부정보 컨테이너
  detailsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0dcaf0',
    marginBottom: 12,
  },

  // 어휘 상세 정보
  vocabDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 16,
  },
  detailColumn: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 12,
    color: '#666',
  },

  // 오답 히스토리
  historyContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
  },
  historyTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#dc3545',
    marginBottom: 8,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 4,
    backgroundColor: 'white',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  historyText: {
    fontSize: 11,
    color: '#333',
    flex: 1,
  },
  historyIndex: {
    fontWeight: 'bold',
  },
  historyBadges: {
    flexDirection: 'row',
    gap: 4,
  },

  // 리딩/문법/리스닝 상세 정보
  readingDetails: {
    gap: 12,
  },
  grammarDetails: {
    gap: 12,
  },
  listeningDetails: {
    gap: 12,
  },

  // 전체 지문/질문
  fullPassageContainer: {
    marginBottom: 12,
  },
  fullPassageBox: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  fullPassageText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  fullQuestionContainer: {
    marginBottom: 12,
  },
  fullQuestionBox: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  fullQuestionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },

  // 스크립트
  scriptContainer: {
    marginBottom: 12,
  },
  scriptBox: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  scriptDetailText: {
    fontSize: 14,
    color: '#333',
    fontStyle: 'italic',
  },

  // 선택지
  optionsContainer: {
    marginBottom: 12,
  },
  optionItem: {
    padding: 8,
    marginBottom: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dee2e6',
    backgroundColor: 'white',
  },
  correctOption: {
    backgroundColor: '#198754',
  },
  wrongOption: {
    backgroundColor: '#dc3545',
  },
  optionText: {
    fontSize: 14,
    color: '#333',
  },
  correctOptionText: {
    color: 'white',
  },
  wrongOptionText: {
    color: 'white',
  },
  optionKey: {
    fontWeight: 'bold',
  },
  optionResult: {
    fontWeight: 'bold',
  },

  // 해설
  explanationContainer: {
    marginBottom: 12,
  },
  explanationBox: {
    backgroundColor: '#e7f3ff',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#0dcaf0',
  },
  explanationText: {
    fontSize: 14,
    color: '#333',
  },

  // 액션 버튼 컨테이너
  actionButtonsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },

  // 어휘 액션
  vocabActions: {
    flexDirection: 'row',
    gap: 8,
  },
  learningButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  learningButtonEnabled: {
    backgroundColor: '#0d6efd',
  },
  learningButtonDisabled: {
    backgroundColor: '#e9ecef',
  },
  learningButtonWarning: {
    backgroundColor: '#ffc107',
  },
  learningButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  autoLearningButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  autoLearningButtonEnabled: {
    backgroundColor: '#198754',
  },
  autoLearningButtonDisabled: {
    backgroundColor: '#e9ecef',
  },
  autoLearningButtonWarning: {
    backgroundColor: '#ffc107',
  },
  autoLearningButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },

  // 복습 버튼
  reviewButton: {
    paddingVertical: 12,
    backgroundColor: '#0d6efd',
    borderRadius: 8,
    alignItems: 'center',
  },
  reviewButtonDisabled: {
    backgroundColor: '#e9ecef',
  },
  reviewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },

  // 공통 버튼들
  commonButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    gap: 8,
    flexWrap: 'wrap',
  },
  selectAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#6c757d',
    borderRadius: 6,
    backgroundColor: 'white',
  },
  selectAllButtonText: {
    fontSize: 12,
    color: '#6c757d',
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#dc3545',
    borderRadius: 6,
  },
  deleteButtonDisabled: {
    backgroundColor: '#e9ecef',
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  noteText: {
    fontSize: 10,
    color: '#666',
    flex: 1,
    textAlign: 'center',
  },

  // 로딩/빈 상태
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },

  // 목록
  listContainer: {
    paddingBottom: 20,
  },
});