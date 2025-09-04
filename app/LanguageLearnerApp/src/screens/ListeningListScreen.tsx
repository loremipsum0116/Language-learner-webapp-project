/*
  ListeningListScreen.tsx — React Native 버전
  ------------------------------------------------------------
  웹 ListeningList.jsx를 모바일 앱에 맞게 리팩토링
*/

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { apiClient } from '../services/apiClient';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ListeningList'>;

interface ListeningQuestion {
  id: string;
  question: string;
  topic?: string;
  script?: string;
  options?: string[];
  correctAnswer?: string;
  audioFile?: string;
}

interface QuestionHistory {
  questionId: string;
  isCorrect: boolean;
  solvedAt: string;
  wrongData?: {
    correctCount?: number;
    incorrectCount?: number;
    totalAttempts?: number;
    lastResult?: string;
  };
}

interface LevelButtonProps {
  level: string;
  currentLevel: string;
  onPress: (level: string) => void;
}

const LevelButton: React.FC<LevelButtonProps> = ({ level, currentLevel, onPress }) => (
  <TouchableOpacity
    style={[
      styles.levelButton,
      currentLevel === level && styles.levelButtonActive
    ]}
    onPress={() => onPress(level)}
    activeOpacity={0.7}
  >
    <Text style={[
      styles.levelButtonText,
      currentLevel === level && styles.levelButtonTextActive
    ]}>
      {level}
    </Text>
  </TouchableOpacity>
);

interface QuestionCardProps {
  question: ListeningQuestion;
  index: number;
  isSelected: boolean;
  status: 'unsolved' | 'correct' | 'incorrect';
  solvedDate?: string | null;
  stats?: {
    correctCount: number;
    incorrectCount: number;
    totalAttempts: number;
  } | null;
  onSelect: (index: number, selected: boolean) => void;
  onStartSingle: (index: number) => void;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  index,
  isSelected,
  status,
  solvedDate,
  stats,
  onSelect,
  onStartSingle,
}) => (
  <View style={[
    styles.questionCard,
    status === 'correct' && styles.questionCardCorrect,
    status === 'incorrect' && styles.questionCardIncorrect,
  ]}>
    <View style={styles.questionHeader}>
      <TouchableOpacity
        style={styles.checkbox}
        onPress={() => onSelect(index, !isSelected)}
        activeOpacity={0.7}
      >
        <View style={[
          styles.checkboxInner,
          isSelected && styles.checkboxSelected
        ]}>
          {isSelected && <Icon name="checkmark" size={16} color="white" />}
        </View>
      </TouchableOpacity>
      
      <View style={styles.questionInfo}>
        <Text style={styles.questionNumber}>문제 {index + 1}</Text>
        <Text style={styles.questionTopic}>
          {question.topic || '리스닝'}
        </Text>
      </View>
      
      <TouchableOpacity
        style={styles.startButton}
        onPress={() => onStartSingle(index)}
        activeOpacity={0.7}
      >
        <Icon name="play" size={20} color="#007AFF" />
      </TouchableOpacity>
    </View>
    
    {status !== 'unsolved' && (
      <View style={styles.studyStatus}>
        <View style={[
          styles.statusBadge,
          status === 'correct' ? styles.statusBadgeCorrect : styles.statusBadgeIncorrect
        ]}>
          <Text style={styles.statusBadgeText}>
            {status === 'correct' ? '✅ 정답' : '❌ 오답'}
          </Text>
        </View>
        
        {solvedDate && (
          <Text style={styles.lastStudyDate}>
            📅 마지막 학습: {solvedDate}
          </Text>
        )}
        
        {stats && (
          <Text style={styles.studyStats}>
            📊 정답: {stats.correctCount}회, 오답: {stats.incorrectCount}회 (총 {stats.totalAttempts}회)
          </Text>
        )}
      </View>
    )}
    
    <View style={styles.questionContent}>
      <Text style={styles.questionText} numberOfLines={2}>
        {question.question}
      </Text>
      
      <View style={styles.questionPreview}>
        <Text style={styles.audioInfo}>
          🎵 오디오: {question.id}.mp3
        </Text>
        <Text style={styles.scriptPreview} numberOfLines={2}>
          "{question.script?.slice(0, 80) || '스크립트 미리보기'}..."
        </Text>
      </View>
    </View>
  </View>
);

export default function ListeningListScreen({ route, navigation }: Props) {
  const { level: initialLevel = 'A1' } = route.params || {};
  
  const [level, setLevel] = useState(initialLevel);
  const [listeningData, setListeningData] = useState<ListeningQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuestions, setSelectedQuestions] = useState(new Set<number>());
  const [history, setHistory] = useState(new Map<string, QuestionHistory>());

  const loadListeningData = useCallback(async () => {
    try {
      setError(null);
      
      // 모바일에서는 번들된 JSON 파일을 사용하거나 API에서 로드
      const response = await fetch(`/${level}/${level}_Listening/${level}_Listening.json`);
      
      if (!response.ok) {
        throw new Error(`Failed to load ${level} listening data`);
      }
      
      const result = await response.json();
      
      if (result && Array.isArray(result) && result.length > 0) {
        setListeningData(result);
      } else {
        setListeningData([]);
        setError(`${level} 레벨 리스닝 데이터가 없습니다.`);
      }
    } catch (err: any) {
      console.error('Failed to load listening data:', err);
      setError('리스닝 데이터를 불러오는데 실패했습니다.');
      setListeningData([]);
    }
  }, [level]);

  const loadHistory = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await apiClient.get(`/listening/history/${level}`, {
        signal
      });
      
      const historyMap = new Map<string, QuestionHistory>();
      
      if (response.data) {
        Object.entries(response.data).forEach(([questionId, record]: [string, any]) => {
          let wrongData = record.wrongData;
          
          if (typeof wrongData === 'string') {
            try {
              wrongData = JSON.parse(wrongData);
            } catch (e) {
              console.error('JSON parsing failed:', e);
              wrongData = {};
            }
          } else if (!wrongData) {
            wrongData = {};
          }
          
          let isCorrect = wrongData?.isCorrect;
          let lastResult = wrongData?.lastResult;
          
          if (isCorrect === undefined && wrongData?.userAnswer && wrongData?.correctAnswer) {
            isCorrect = wrongData.userAnswer === wrongData.correctAnswer;
            lastResult = isCorrect ? 'correct' : 'incorrect';
          }
          
          const correctCount = wrongData?.correctCount || (isCorrect ? 1 : 0);
          const incorrectCount = wrongData?.incorrectCount || (isCorrect ? 0 : 1);
          const totalAttempts = wrongData?.totalAttempts || record.attempts || 1;
          
          const enhancedWrongData = {
            ...wrongData,
            isCorrect,
            lastResult,
            correctCount,
            incorrectCount,
            totalAttempts
          };
          
          historyMap.set(questionId, {
            ...record,
            questionId,
            isCorrect,
            solvedAt: record.solvedAt || record.wrongAt,
            wrongData: enhancedWrongData
          });
        });
      }
      
      setHistory(historyMap);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Failed to load history:', error);
      }
      setHistory(new Map());
    }
  }, [level]);

  const loadData = useCallback(async (isRefresh = false) => {
    const abortController = new AbortController();
    
    try {
      if (!isRefresh) {
        setLoading(true);
      }
      
      await Promise.all([
        loadListeningData(),
        loadHistory(abortController.signal)
      ]);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
      if (isRefresh) {
        setRefreshing(false);
      }
    }
    
    return () => abortController.abort();
  }, [loadListeningData, loadHistory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

  const handleLevelChange = (newLevel: string) => {
    setLevel(newLevel);
    setSelectedQuestions(new Set());
    navigation.setParams({ level: newLevel });
  };

  const handleQuestionSelect = (questionIndex: number, isSelected: boolean) => {
    const newSelected = new Set(selectedQuestions);
    if (isSelected) {
      newSelected.add(questionIndex);
    } else {
      newSelected.delete(questionIndex);
    }
    setSelectedQuestions(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedQuestions.size === listeningData.length) {
      setSelectedQuestions(new Set());
    } else {
      setSelectedQuestions(new Set(listeningData.map((_, index) => index)));
    }
  };

  const handleSelectWrongAnswers = () => {
    const wrongAnswerIndexes = listeningData
      .map((question, index) => {
        const status = getQuestionStatus(question.id);
        return status === 'incorrect' ? index : null;
      })
      .filter(index => index !== null) as number[];
    
    setSelectedQuestions(new Set(wrongAnswerIndexes));
  };

  const handleStartSelectedQuestions = () => {
    if (selectedQuestions.size === 0) {
      Alert.alert('알림', '학습할 문제를 선택해주세요.');
      return;
    }
    
    const selectedIndexes = Array.from(selectedQuestions).sort((a, b) => a - b);
    navigation.navigate('ListeningPractice', {
      level,
      questions: selectedIndexes.join(',')
    });
  };

  const handleSingleQuestion = (questionIndex: number) => {
    navigation.navigate('ListeningPractice', {
      level,
      start: questionIndex.toString()
    });
  };

  const getQuestionStatus = (questionId: string): 'unsolved' | 'correct' | 'incorrect' => {
    const record = history.get(questionId);
    if (!record) return 'unsolved';
    
    const lastResult = record.wrongData?.lastResult;
    if (lastResult) {
      return lastResult === 'correct' ? 'correct' : 'incorrect';
    }
    
    return record.isCorrect ? 'correct' : 'incorrect';
  };

  const getQuestionDate = (questionId: string): string | null => {
    const record = history.get(questionId);
    
    if (!record || !record.solvedAt) {
      return null;
    }
    
    try {
      const date = new Date(record.solvedAt);
      
      if (isNaN(date.getTime())) {
        return null;
      }
      
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      console.warn('Date conversion error:', error);
      return null;
    }
  };

  const getQuestionStats = (questionId: string) => {
    const record = history.get(questionId);
    if (!record || !record.wrongData) return null;
    
    const { correctCount = 0, incorrectCount = 0, totalAttempts = 0 } = record.wrongData;
    return { correctCount, incorrectCount, totalAttempts };
  };

  const correctCount = Array.from(history.values()).filter(record => record.isCorrect).length;
  const totalSolved = history.size;

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>리스닝 데이터를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="headset" size={64} color="#666" />
          <Text style={styles.errorTitle}>리스닝 연습</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <Text style={styles.errorSubMessage}>현재 A1 레벨만 이용 가능합니다.</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => loadData()}
            activeOpacity={0.7}
          >
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderQuestionItem = ({ item, index }: { item: ListeningQuestion; index: number }) => (
    <QuestionCard
      question={item}
      index={index}
      isSelected={selectedQuestions.has(index)}
      status={getQuestionStatus(item.id)}
      solvedDate={getQuestionDate(item.id)}
      stats={getQuestionStats(item.id)}
      onSelect={handleQuestionSelect}
      onStartSingle={handleSingleQuestion}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>🎧 {level} 리스닝 문제</Text>
          <Text style={styles.headerSubtitle}>
            총 {listeningData.length}개 문제 | 해결: {correctCount}개 | 시도: {totalSolved}개
          </Text>
        </View>
      </View>

      {/* Level Selector */}
      <View style={styles.levelSelector}>
        <Text style={styles.levelLabel}>레벨:</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.levelButtons}
        >
          {['A1', 'A2', 'B1', 'B2', 'C1'].map((lv) => (
            <LevelButton
              key={lv}
              level={lv}
              currentLevel={level}
              onPress={handleLevelChange}
            />
          ))}
        </ScrollView>
      </View>

      {/* Selection Controls */}
      <View style={styles.selectionControls}>
        <View style={styles.selectionInfo}>
          <TouchableOpacity 
            style={styles.selectAllButton}
            onPress={handleSelectAll}
            activeOpacity={0.7}
          >
            <View style={[
              styles.selectAllCheckbox,
              selectedQuestions.size === listeningData.length && listeningData.length > 0 && styles.selectAllCheckboxActive
            ]}>
              {selectedQuestions.size === listeningData.length && listeningData.length > 0 && (
                <Icon name="checkmark" size={16} color="white" />
              )}
            </View>
            <Text style={styles.selectAllText}>
              전체 선택 ({selectedQuestions.size}/{listeningData.length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.wrongAnswersButton}
            onPress={handleSelectWrongAnswers}
            activeOpacity={0.7}
          >
            <Icon name="close-circle" size={16} color="#dc3545" />
            <Text style={styles.wrongAnswersButtonText}>오답만 선택</Text>
          </TouchableOpacity>
        </View>
        
        {selectedQuestions.size > 0 && (
          <TouchableOpacity
            style={styles.startSelectedButton}
            onPress={handleStartSelectedQuestions}
            activeOpacity={0.8}
          >
            <Text style={styles.startSelectedButtonText}>
              선택한 {selectedQuestions.size}개 문제 학습하기
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Questions List */}
      <FlatList
        data={listeningData}
        renderItem={renderQuestionItem}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={styles.questionsList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#007AFF']}
            tintColor="#007AFF"
          />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Icon name="musical-notes" size={64} color="#ccc" />
            <Text style={styles.emptyText}>리스닝 문제가 없습니다.</Text>
          </View>
        )}
      />

      {/* Bottom Action Bar */}
      {selectedQuestions.size > 0 && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.bottomStartButton}
            onPress={handleStartSelectedQuestions}
            activeOpacity={0.8}
          >
            <Icon name="rocket" size={20} color="white" />
            <Text style={styles.bottomStartButtonText}>
              선택한 문제들 학습 시작
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  errorSubMessage: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  levelSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
  },
  levelLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 12,
  },
  levelButtons: {
    gap: 8,
  },
  levelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  levelButtonActive: {
    backgroundColor: '#007AFF',
  },
  levelButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  levelButtonTextActive: {
    color: 'white',
  },
  selectionControls: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
  },
  selectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectAllCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#007AFF',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectAllCheckboxActive: {
    backgroundColor: '#007AFF',
  },
  selectAllText: {
    fontSize: 14,
    color: '#333',
  },
  wrongAnswersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  wrongAnswersButtonText: {
    fontSize: 12,
    color: '#dc3545',
    marginLeft: 4,
  },
  startSelectedButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  startSelectedButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  questionsList: {
    padding: 16,
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  questionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  questionCardCorrect: {
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  questionCardIncorrect: {
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkbox: {
    marginRight: 12,
  },
  checkboxInner: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
  },
  questionInfo: {
    flex: 1,
  },
  questionNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  questionTopic: {
    fontSize: 12,
    color: '#666',
  },
  startButton: {
    padding: 8,
  },
  studyStatus: {
    marginBottom: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  statusBadgeCorrect: {
    backgroundColor: '#dcfce7',
  },
  statusBadgeIncorrect: {
    backgroundColor: '#fee2e2',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  lastStudyDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  studyStats: {
    fontSize: 12,
    color: '#666',
  },
  questionContent: {
    flex: 1,
  },
  questionText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    lineHeight: 24,
  },
  questionPreview: {
    gap: 4,
  },
  audioInfo: {
    fontSize: 12,
    color: '#007AFF',
  },
  scriptPreview: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  bottomBar: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f3f5',
  },
  bottomStartButton: {
    backgroundColor: '#28a745',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
  },
  bottomStartButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});