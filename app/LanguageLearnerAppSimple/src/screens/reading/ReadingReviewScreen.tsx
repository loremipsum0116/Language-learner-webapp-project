/*
  ReadingReviewScreen.tsx — React Native 버전
  ------------------------------------------------------------
  웹 ReadingReview.jsx를 모바일 앱에 맞게 리팩토링
*/

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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../../services/apiClient';
import { AppHeader } from '../../components/common/AppHeader';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ReadingReview'>;

interface ReviewQuestion {
  wrongAnswerId?: number;
  level: string;
  questionIndex: number;
  passage: string;
  question: string;
  options: { [key: string]: string };
  answer: string;
  explanation_ko: string;
}

const { width } = Dimensions.get('window');

export default function ReadingReviewScreen({ navigation }: Props) {
  const [reviewData, setReviewData] = useState<ReviewQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [completedQuestions, setCompletedQuestions] = useState(new Set<number>());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReviewData();
  }, []);

  const loadReviewData = async () => {
    try {
      const data = await AsyncStorage.getItem('readingReviewData');
      if (data) {
        const parsedData = JSON.parse(data);
        setReviewData(parsedData);
        setLoading(false);
      } else {
        // 복습 데이터가 없으면 오답노트로 돌아가기
        Alert.alert(
          '복습 데이터 없음',
          '복습할 데이터가 없습니다. 오답노트에서 복습할 문제를 선택해주세요.',
          [
            {
              text: '확인',
              onPress: () => navigation.navigate('WrongAnswers')
            }
          ]
        );
      }
    } catch (error) {
      console.error('Failed to load review data:', error);
      Alert.alert(
        '오류 발생',
        '복습 데이터를 불러오지 못했습니다.',
        [
          {
            text: '확인',
            onPress: () => navigation.navigate('WrongAnswers')
          }
        ]
      );
    }
  };

  const markAsResolved = useCallback(async (wrongAnswerId: number) => {
    try {
      // 오답을 완료 처리
      await apiClient.post(`/api/odat-note/${wrongAnswerId}/resolve`);
    } catch (error) {
      console.error('Failed to mark wrong answer as resolved:', error);
    }
  }, []);

  const handleAnswerSelect = (option: string) => {
    if (showExplanation) return;
    setSelectedAnswer(option);
  };

  const handleSubmit = async () => {
    if (!selectedAnswer) return;
    
    const current = reviewData[currentQuestion];
    const isCorrect = selectedAnswer === current.answer;
    
    if (isCorrect && !completedQuestions.has(currentQuestion)) {
      setScore(score + 1);
      setCompletedQuestions(prev => new Set([...prev, currentQuestion]));
      
      // 정답이면 오답노트에서 해결 처리
      if (current.wrongAnswerId) {
        try {
          await markAsResolved(current.wrongAnswerId);
        } catch (error) {
          console.error('Failed to mark as resolved:', error);
        }
      }
    }
    
    setShowExplanation(true);
  };

  const handleNext = () => {
    if (currentQuestion < reviewData.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    }
  };

  const handleFinishReview = async () => {
    // 세션 스토리지 정리
    try {
      await AsyncStorage.removeItem('readingReviewData');
    } catch (error) {
      console.error('Failed to clear review data:', error);
    }
    
    const percentage = Math.round((score / reviewData.length) * 100);
    let message = '';
    
    if (score === reviewData.length) {
      message = '완벽합니다! 모든 문제가 해결되었습니다! 🌟';
    } else if (score >= reviewData.length * 0.8) {
      message = '훌륭해요! 대부분의 문제를 해결했습니다! 👏';
    } else if (score >= reviewData.length * 0.6) {
      message = '잘했어요! 몇 문제가 더 연습이 필요합니다! 👍';
    } else {
      message = '더 연습해보세요! 아직 해결되지 않은 문제들이 있습니다! 💪';
    }

    Alert.alert(
      '🎉 복습 완료!',
      `복습 점수: ${score} / ${reviewData.length} (${percentage}%)\n\n${message}`,
      [
        {
          text: '오답노트로 돌아가기',
          onPress: () => navigation.navigate('WrongAnswers')
        }
      ]
    );
  };

  const renderOptionButton = (key: string, value: string) => {
    let buttonStyle = [styles.optionButton];
    let textStyle = [styles.optionText];
    
    if (selectedAnswer === key) {
      buttonStyle.push(styles.optionSelected);
      textStyle.push(styles.optionSelectedText);
    }
    
    if (showExplanation) {
      if (key === reviewData[currentQuestion].answer) {
        buttonStyle.push(styles.optionCorrect);
        textStyle.push(styles.optionCorrectText);
      } else if (selectedAnswer === key) {
        buttonStyle.push(styles.optionIncorrect);
        textStyle.push(styles.optionIncorrectText);
      }
    }

    return (
      <TouchableOpacity
        key={key}
        style={buttonStyle}
        onPress={() => handleAnswerSelect(key)}
        disabled={showExplanation}
        activeOpacity={0.7}
      >
        <View style={styles.optionContent}>
          <Text style={[styles.optionLetter, textStyle]}>{key}</Text>
          <Text style={[styles.optionValue, textStyle]}>{value}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader 
          title="📖 리딩 오답 복습"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>복습 데이터를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (reviewData.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader 
          title="📖 리딩 오답 복습"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📚</Text>
          <Text style={styles.emptyTitle}>리딩 복습</Text>
          <Text style={styles.emptyMessage}>복습할 문제가 없습니다.</Text>
          <TouchableOpacity 
            style={styles.emptyButton}
            onPress={() => navigation.navigate('WrongAnswers')}
          >
            <Text style={styles.emptyButtonText}>오답노트로 돌아가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const current = reviewData[currentQuestion];
  const progress = ((currentQuestion + 1) / reviewData.length) * 100;
  const isCorrect = selectedAnswer === current.answer;

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader 
        title="📖 리딩 오답 복습"
        onBack={() => navigation.goBack()}
      />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Progress Header */}
        <View style={styles.progressContainer}>
          <View style={styles.progressInfo}>
            <Text style={styles.questionCounter}>
              {currentQuestion + 1} / {reviewData.length}
            </Text>
            <Text style={styles.scoreDisplay}>
              정답: {score} / {reviewData.length}
            </Text>
          </View>
          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBarFill,
                { width: `${progress}%` }
              ]}
            />
          </View>
        </View>

        {/* Question Info */}
        <View style={styles.questionInfo}>
          <Text style={styles.questionInfoText}>
            <Text style={styles.questionInfoLabel}>📝 원래 틀린 문제: </Text>
            {current.level} 레벨 #{current.questionIndex + 1}번
          </Text>
        </View>

        {/* Reading Card */}
        <View style={styles.readingCard}>
          {/* Passage Section */}
          <View style={styles.passageSection}>
            <Text style={styles.sectionTitle}>📖 지문</Text>
            <ScrollView 
              style={styles.passageScrollView}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.passageText}>{current.passage}</Text>
            </ScrollView>
          </View>

          {/* Question Section */}
          <View style={styles.questionSection}>
            <Text style={styles.sectionTitle}>❓ 문제</Text>
            <Text style={styles.questionText}>{current.question}</Text>

            {/* Options */}
            <View style={styles.optionsContainer}>
              {Object.entries(current.options).map(([key, value]) => 
                renderOptionButton(key, value)
              )}
            </View>

            {/* Explanation */}
            {showExplanation && (
              <View style={[
                styles.explanationContainer,
                isCorrect ? styles.explanationCorrect : styles.explanationIncorrect
              ]}>
                <View style={styles.explanationHeader}>
                  <Text style={[
                    styles.resultIcon,
                    isCorrect ? styles.resultCorrect : styles.resultIncorrect
                  ]}>
                    {isCorrect ? '✅ 정답! 오답노트에서 해결됨' : '❌ 다시 틀렸습니다'}
                  </Text>
                  <Text style={styles.correctAnswer}>정답: {current.answer}</Text>
                </View>
                <Text style={styles.explanationText}>{current.explanation_ko}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Final Results */}
        {currentQuestion === reviewData.length - 1 && showExplanation && (
          <View style={styles.finalResults}>
            <Text style={styles.finalTitle}>🎉 복습 완료!</Text>
            <Text style={styles.finalScore}>
              복습 점수: {score} / {reviewData.length} 
              ({Math.round((score / reviewData.length) * 100)}%)
            </Text>
            <Text style={styles.performanceMessage}>
              {score === reviewData.length 
                ? "완벽합니다! 모든 문제가 해결되었습니다! 🌟" 
                : score >= reviewData.length * 0.8 
                  ? "훌륭해요! 대부분의 문제를 해결했습니다! 👏" 
                  : score >= reviewData.length * 0.6 
                    ? "잘했어요! 몇 문제가 더 연습이 필요합니다! 👍" 
                    : "더 연습해보세요! 아직 해결되지 않은 문제들이 있습니다! 💪"
              }
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Control Buttons */}
      <View style={styles.controlsContainer}>
        {/* Navigation Buttons */}
        <View style={styles.navButtons}>
          <TouchableOpacity 
            style={[
              styles.navButton,
              currentQuestion === 0 && styles.navButtonDisabled
            ]}
            onPress={handlePrevious}
            disabled={currentQuestion === 0}
          >
            <Text style={[
              styles.navButtonText,
              currentQuestion === 0 && styles.navButtonTextDisabled
            ]}>
              ← 이전
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.navButton,
              currentQuestion === reviewData.length - 1 && styles.navButtonDisabled
            ]}
            onPress={handleNext}
            disabled={currentQuestion === reviewData.length - 1}
          >
            <Text style={[
              styles.navButtonText,
              currentQuestion === reviewData.length - 1 && styles.navButtonTextDisabled
            ]}>
              다음 →
            </Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {!showExplanation ? (
            <TouchableOpacity 
              style={[
                styles.primaryButton,
                !selectedAnswer && styles.primaryButtonDisabled
              ]}
              onPress={handleSubmit}
              disabled={!selectedAnswer}
            >
              <Text style={styles.primaryButtonText}>정답 확인</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.successButton}
              onPress={currentQuestion === reviewData.length - 1 ? handleFinishReview : handleNext}
            >
              <Text style={styles.successButtonText}>
                {currentQuestion === reviewData.length - 1 ? '복습 완료' : '다음 문제'}
              </Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={handleFinishReview}
          >
            <Text style={styles.secondaryButtonText}>🏠 오답노트로 돌아가기</Text>
          </TouchableOpacity>
        </View>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  progressContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  questionCounter: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  scoreDisplay: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  questionInfo: {
    backgroundColor: '#dbeafe',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  questionInfoText: {
    fontSize: 14,
    color: '#1e40af',
  },
  questionInfoLabel: {
    fontWeight: '600',
  },
  readingCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  passageSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  passageScrollView: {
    maxHeight: 200,
  },
  passageText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
  },
  questionSection: {
    padding: 20,
  },
  questionText: {
    fontSize: 16,
    color: '#1f2937',
    marginBottom: 20,
    fontWeight: '500',
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 16,
    backgroundColor: 'white',
  },
  optionSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  optionCorrect: {
    borderColor: '#059669',
    backgroundColor: '#ecfdf5',
  },
  optionIncorrect: {
    borderColor: '#dc2626',
    backgroundColor: '#fef2f2',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionLetter: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6b7280',
    marginRight: 12,
    minWidth: 20,
  },
  optionValue: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  optionText: {
    color: '#374151',
  },
  optionSelectedText: {
    color: '#1d4ed8',
  },
  optionCorrectText: {
    color: '#047857',
  },
  optionIncorrectText: {
    color: '#dc2626',
  },
  explanationContainer: {
    marginTop: 20,
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  explanationCorrect: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  explanationIncorrect: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  explanationHeader: {
    marginBottom: 12,
  },
  resultIcon: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  resultCorrect: {
    color: '#047857',
  },
  resultIncorrect: {
    color: '#dc2626',
  },
  correctAnswer: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
  finalResults: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  finalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  finalScore: {
    fontSize: 18,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 16,
  },
  performanceMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  controlsContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  navButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: 'white',
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  navButtonTextDisabled: {
    color: '#9ca3af',
  },
  actionButtons: {
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  successButton: {
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  successButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
});