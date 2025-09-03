// src/screens/ReadingScreen.tsx
// 리딩 연습 화면 (React Native 버전) - Reading.jsx 기능 구현

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../services/apiClient';
import { MainStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'Reading'>;

interface ReadingQuestion {
  id: number;
  level: string;
  passage: string;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: string;
  explanation?: string;
}

interface ReadingParams {
  level?: string;
  start?: number;
  questions?: number[];
}

const ReadingScreen: React.FC<Props> = ({ navigation, route }) => {
  const { user } = useAuth();
  const params = route.params as ReadingParams || {};
  const level = params.level || 'A1';
  const startIndex = params.start || 0;
  const selectedQuestions = params.questions || null;

  const [readingData, setReadingData] = useState<ReadingQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(startIndex);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [completedQuestions, setCompletedQuestions] = useState(new Set<number>());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReadingData();
  }, [level, startIndex]);

  const loadReadingData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // API를 통해 모든 레벨 데이터 로드
      const response = await apiClient.request(`/reading/practice/${level}`);
      
      if (response?.data && response.data.length > 0) {
        // 선택된 문제들만 필터링
        if (selectedQuestions && selectedQuestions.length > 0) {
          const filteredData = selectedQuestions.map(index => response.data[index]).filter(Boolean);
          setReadingData(filteredData);
          setCurrentQuestion(0);
        } else if (!selectedQuestions && startIndex >= 0) {
          // 단일 문제 모드 또는 전체 데이터
          if (startIndex > 0 && startIndex < response.data.length) {
            const singleQuestion = response.data[startIndex];
            if (singleQuestion) {
              setReadingData([singleQuestion]);
              setCurrentQuestion(0);
            } else {
              setReadingData([]);
              setError('해당 문제를 찾을 수 없습니다.');
            }
          } else {
            // 전체 데이터 로드
            setReadingData(response.data);
            setCurrentQuestion(startIndex);
          }
        } else {
          setReadingData(response.data);
          setCurrentQuestion(0);
        }
      } else {
        setReadingData([]);
        setError(`${level} 레벨 리딩 데이터가 없습니다.`);
      }

      // 상태 초기화
      setSelectedAnswer(null);
      setShowExplanation(false);
      setIsCorrect(false);
      setScore(0);
      setCompletedQuestions(new Set());
    } catch (err: any) {
      console.error('Failed to load reading data:', err);
      setError('리딩 데이터를 불러오는데 실패했습니다.');
      setReadingData([]);
    } finally {
      setLoading(false);
    }
  }, [level, startIndex, selectedQuestions]);

  const handleAnswerSelect = (option: string) => {
    if (showExplanation) return;
    setSelectedAnswer(option);
  };

  const handleSubmit = async () => {
    if (!selectedAnswer) return;

    const current = readingData[currentQuestion];
    const correct = selectedAnswer.trim() === current.correctAnswer.trim();
    setIsCorrect(correct);

    // 정답/오답 모두 기록 저장 (로그인된 사용자만)
    try {
      if (user) {
        await apiClient.request('/reading/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId: current.id,
            level: level,
            isCorrect: correct,
            userAnswer: selectedAnswer,
            correctAnswer: current.correctAnswer,
            timeTaken: null,
            question: current.question,
            passage: current.passage,
            options: current.options,
            explanation: current.explanation
          })
        });
        console.log(`✅ [리딩 기록 저장 완료] ${level} - Question ${current.id} - ${correct ? '정답' : '오답'}`);
      }
    } catch (error) {
      console.error('❌ 리딩 기록 저장 실패:', error);
    }

    if (correct && !completedQuestions.has(currentQuestion)) {
      setScore(score + 1);
      setCompletedQuestions(prev => new Set([...prev, currentQuestion]));
    }

    setShowExplanation(true);
  };

  const handleNext = () => {
    if (currentQuestion < readingData.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setIsCorrect(false);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setIsCorrect(false);
    }
  };

  const handleRestart = () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setIsCorrect(false);
    setScore(0);
    setCompletedQuestions(new Set());
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>리딩 데이터를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>📚 리딩 연습</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorSubtext}>현재 A1 레벨만 이용 가능합니다.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadReadingData}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (readingData.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>📚 {level} 리딩 연습</Text>
          <Text style={styles.emptyText}>리딩 문제가 없습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const current = readingData[currentQuestion];
  const progress = ((currentQuestion + 1) / readingData.length) * 100;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
              <Text style={styles.backButtonText}>← 뒤로가기</Text>
            </TouchableOpacity>
            <Text style={styles.title}>📚 {level} 리딩 연습</Text>
          </View>

          <View style={styles.stats}>
            <View style={styles.progressInfo}>
              <Text style={styles.questionCounter}>
                {currentQuestion + 1} / {readingData.length}
              </Text>
              <Text style={styles.scoreDisplay}>
                점수: {score} / {readingData.length}
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${progress}%` }]}
              />
            </View>
          </View>
        </View>

        {/* Reading Question Card */}
        <View style={styles.questionCard}>
          {/* Passage Section */}
          <View style={styles.passageSection}>
            <Text style={styles.passageTitle}>📖 지문</Text>
            <Text style={styles.passageText}>{current.passage}</Text>
          </View>

          {/* Question Section */}
          <View style={styles.questionSection}>
            <Text style={styles.questionTitle}>❓ 문제</Text>
            <Text style={styles.questionText}>{current.question}</Text>

            {/* Options Grid */}
            <View style={styles.optionsGrid}>
              {Object.entries(current.options).map(([key, value]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.optionButton,
                    selectedAnswer === key && styles.optionButtonSelected,
                    showExplanation && key === current.correctAnswer && styles.optionButtonCorrect,
                    showExplanation && selectedAnswer === key && key !== current.correctAnswer && styles.optionButtonIncorrect,
                  ]}
                  onPress={() => handleAnswerSelect(key)}
                  disabled={showExplanation}
                >
                  <Text style={styles.optionLetter}>{key}</Text>
                  <Text style={styles.optionText}>{value}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Explanation */}
            {showExplanation && (
              <View style={[styles.explanationBox, isCorrect ? styles.explanationCorrect : styles.explanationIncorrect]}>
                <View style={styles.explanationHeader}>
                  <Text style={[styles.resultIcon, isCorrect ? styles.resultCorrect : styles.resultIncorrect]}>
                    {isCorrect ? '✅ 정답!' : '❌ 틀렸습니다'}
                  </Text>
                  <Text style={styles.correctAnswer}>정답: {current.correctAnswer}</Text>
                </View>
                {current.explanation && (
                  <Text style={styles.explanationText}>{current.explanation}</Text>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Control Buttons */}
        <View style={styles.controls}>
          <View style={styles.navButtons}>
            <TouchableOpacity
              style={[styles.navButton, currentQuestion === 0 && styles.navButtonDisabled]}
              onPress={handlePrevious}
              disabled={currentQuestion === 0}
            >
              <Text style={[styles.navButtonText, currentQuestion === 0 && styles.navButtonTextDisabled]}>
                ← 이전
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navButton, currentQuestion === readingData.length - 1 && styles.navButtonDisabled]}
              onPress={handleNext}
              disabled={currentQuestion === readingData.length - 1}
            >
              <Text style={[styles.navButtonText, currentQuestion === readingData.length - 1 && styles.navButtonTextDisabled]}>
                다음 →
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actionButtons}>
            {!showExplanation ? (
              <TouchableOpacity
                style={[styles.submitButton, !selectedAnswer && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={!selectedAnswer}
              >
                <Text style={[styles.submitButtonText, !selectedAnswer && styles.submitButtonTextDisabled]}>
                  정답 확인
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.nextButton}
                onPress={currentQuestion === readingData.length - 1 ? handleRestart : handleNext}
              >
                <Text style={styles.nextButtonText}>
                  {currentQuestion === readingData.length - 1 ? '다시 시작' : '다음 문제'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.utilityButtons}>
            <TouchableOpacity style={styles.restartButton} onPress={handleRestart}>
              <Text style={styles.restartButtonText}>🔄 처음부터</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Final Results */}
        {currentQuestion === readingData.length - 1 && showExplanation && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>🎉 완료!</Text>
            <Text style={styles.resultsScore}>
              총 점수: {score} / {readingData.length} ({Math.round((score / readingData.length) * 100)}%)
            </Text>
            <Text style={styles.performanceMessage}>
              {score === readingData.length
                ? "완벽합니다! 🌟"
                : score >= readingData.length * 0.8
                  ? "훌륭해요! 👏"
                  : score >= readingData.length * 0.6
                    ? "잘했어요! 👍"
                    : "더 연습해보세요! 💪"
              }
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  backButtonText: {
    fontSize: 14,
    color: '#6b7280',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
    textAlign: 'center',
    marginRight: 60,
  },
  stats: {
    gap: 12,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  questionCounter: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4b5563',
  },
  scoreDisplay: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  questionCard: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  passageSection: {
    marginBottom: 24,
  },
  passageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  passageText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  questionSection: {
    gap: 16,
  },
  questionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  questionText: {
    fontSize: 16,
    color: '#1f2937',
    lineHeight: 22,
  },
  optionsGrid: {
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: 'white',
  },
  optionButtonSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  optionButtonCorrect: {
    borderColor: '#059669',
    backgroundColor: '#d1fae5',
  },
  optionButtonIncorrect: {
    borderColor: '#dc2626',
    backgroundColor: '#fee2e2',
  },
  optionLetter: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginRight: 12,
    width: 20,
  },
  optionText: {
    fontSize: 16,
    color: '#1f2937',
    flex: 1,
    lineHeight: 22,
  },
  explanationBox: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
  },
  explanationCorrect: {
    borderColor: '#059669',
    backgroundColor: '#d1fae5',
  },
  explanationIncorrect: {
    borderColor: '#dc2626',
    backgroundColor: '#fee2e2',
  },
  explanationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultIcon: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultCorrect: {
    color: '#059669',
  },
  resultIncorrect: {
    color: '#dc2626',
  },
  correctAnswer: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
  },
  explanationText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  controls: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  navButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  navButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: 'white',
    alignItems: 'center',
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 16,
    color: '#4b5563',
    fontWeight: '500',
  },
  navButtonTextDisabled: {
    color: '#9ca3af',
  },
  actionButtons: {
    alignItems: 'center',
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    minWidth: 140,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.6,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonTextDisabled: {
    color: '#e5e7eb',
  },
  nextButton: {
    backgroundColor: '#059669',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    minWidth: 140,
    alignItems: 'center',
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  utilityButtons: {
    alignItems: 'center',
  },
  restartButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
    backgroundColor: 'white',
  },
  restartButtonText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '500',
  },
  resultsContainer: {
    margin: 20,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  resultsScore: {
    fontSize: 18,
    color: '#4b5563',
    marginBottom: 8,
  },
  performanceMessage: {
    fontSize: 16,
    color: '#059669',
    fontWeight: '500',
  },
});

export default ReadingScreen;