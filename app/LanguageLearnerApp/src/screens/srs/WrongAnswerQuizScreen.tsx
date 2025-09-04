/*
  WrongAnswerQuizScreen.tsx — React Native 버전
  ------------------------------------------------------------
  웹 WrongAnswerQuiz.jsx를 모바일 앱에 맞게 리팩토링
*/

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import { apiClient } from '../../services/apiClient';
import { AppHeader } from '../../components/common/AppHeader';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'WrongAnswerQuiz'>;

interface QuizQuestion {
  vocabId: number;
  lemma: string;
  pos?: string;
  koGloss: string;
  example?: string;
  attempts: number;
  wrongAt: string;
  reviewWindowEnd: string;
}

export default function WrongAnswerQuizScreen({ navigation }: Props) {
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  const loadQuiz = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/srs/wrong-answers/quiz');
      
      if (response.success) {
        if (!response.data || response.data.length === 0) {
          Alert.alert(
            '복습 완료',
            '복습할 오답노트가 없습니다.',
            [
              {
                text: '확인',
                onPress: () => navigation.navigate('WrongAnswers')
              }
            ]
          );
          return;
        }
        setQuiz(response.data);
      }
    } catch (error: any) {
      console.error('Failed to load quiz:', error);
      Alert.alert(
        '오류',
        '퀴즈 로드에 실패했습니다.',
        [
          {
            text: '확인',
            onPress: () => navigation.navigate('WrongAnswers')
          }
        ]
      );
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  const currentQuestion = quiz[currentIndex];

  const handleSubmit = async () => {
    if (!userAnswer.trim() || submitting) return;

    const correct = userAnswer.trim().toLowerCase() === currentQuestion.lemma.toLowerCase();
    setIsCorrect(correct);
    setShowResult(true);

    if (correct) {
      setSubmitting(true);
      try {
        // 오답노트에서 제거
        await apiClient.post(`/srs/wrong-answers/${currentQuestion.vocabId}/complete`);
        setCompletedCount(prev => prev + 1);
      } catch (error) {
        console.error('Failed to complete wrong answer:', error);
        Alert.alert('오류', '오답노트 업데이트에 실패했습니다.');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleNext = () => {
    if (currentIndex < quiz.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setUserAnswer('');
      setShowResult(false);
    } else {
      // 퀴즈 완료
      const completionMessage = `오답노트 복습 완료!\n정답: ${completedCount}개\n틀림: ${quiz.length - completedCount}개`;
      
      Alert.alert(
        '복습 완료! 🎉',
        completionMessage,
        [
          {
            text: '확인',
            onPress: () => navigation.navigate('WrongAnswers')
          }
        ]
      );
    }
  };

  const handleSkip = () => {
    handleNext();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader 
          title="📝 오답노트 복습"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>퀴즈를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (quiz.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader 
          title="📝 오답노트 복습"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📝</Text>
          <Text style={styles.emptyTitle}>복습할 오답노트가 없습니다</Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate('WrongAnswers')}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyButtonText}>오답노트로 돌아가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const progress = ((currentIndex + 1) / quiz.length) * 100;

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader 
        title="📝 오답노트 복습"
        onBack={() => navigation.goBack()}
        subtitle={`${currentIndex + 1} / ${quiz.length}`}
      />
      
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 진행률 */}
          <View style={styles.progressSection}>
            <View style={styles.progressInfo}>
              <Text style={styles.progressStats}>정답: {completedCount}개</Text>
              <Text style={styles.progressDeadline}>
                마감: {dayjs(currentQuestion.reviewWindowEnd).format('MM/DD HH:mm')}
              </Text>
            </View>
            
            <View style={styles.progressBarContainer}>
              <View 
                style={[
                  styles.progressBar,
                  { width: `${progress}%` }
                ]}
              />
            </View>
          </View>

          {/* 문제 카드 */}
          <View style={styles.questionCard}>
            {/* 문제 헤더 */}
            <View style={styles.questionHeader}>
              <Text style={styles.attemptsText}>
                ⚠️ {currentQuestion.attempts}회 틀림
              </Text>
              <Text style={styles.wrongAtText}>
                {dayjs(currentQuestion.wrongAt).format('MM/DD HH:mm')}에 틀림
              </Text>
            </View>

            {/* 한국어 뜻 */}
            <View style={styles.meaningSection}>
              <Text style={styles.meaningText}>
                {currentQuestion.koGloss || '번역 정보 없음'}
              </Text>
              
              {currentQuestion.example && (
                <Text style={styles.exampleText}>
                  "{currentQuestion.example}"
                </Text>
              )}
            </View>

            {/* 답안 입력 */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>영어 단어를 입력하세요:</Text>
              
              <TextInput
                style={[
                  styles.answerInput,
                  showResult && styles.answerInputDisabled
                ]}
                value={userAnswer}
                onChangeText={setUserAnswer}
                placeholder="답안을 입력하세요..."
                placeholderTextColor="#9ca3af"
                editable={!showResult}
                autoComplete="off"
                autoFocus={true}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />

              {!showResult ? (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      (!userAnswer.trim() || submitting) && styles.submitButtonDisabled
                    ]}
                    onPress={handleSubmit}
                    disabled={!userAnswer.trim() || submitting}
                    activeOpacity={0.8}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={styles.submitButtonText}>제출</Text>
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.skipButton}
                    onPress={handleSkip}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.skipButtonText}>건너뛰기</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.resultSection}>
                  {/* 결과 표시 */}
                  <View style={[
                    styles.resultCard,
                    isCorrect ? styles.resultCardCorrect : styles.resultCardIncorrect
                  ]}>
                    <Text style={styles.resultTitle}>
                      {isCorrect ? '🎉 정답!' : '❌ 틀렸습니다'}
                    </Text>
                    
                    <Text style={styles.correctAnswerText}>
                      <Text style={styles.correctAnswerLabel}>정답: </Text>
                      {currentQuestion.lemma}
                      {currentQuestion.pos && (
                        <Text style={styles.posText}> ({currentQuestion.pos})</Text>
                      )}
                    </Text>
                    
                    {isCorrect && (
                      <Text style={styles.removedFromListText}>
                        오답노트에서 제거되었습니다
                      </Text>
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.nextButton}
                    onPress={handleNext}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.nextButtonText}>
                      {currentIndex < quiz.length - 1 ? '다음 문제' : '완료'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* 하단 버튼 */}
          <View style={styles.bottomSection}>
            <TouchableOpacity
              style={styles.backToListButton}
              onPress={() => navigation.navigate('WrongAnswers')}
              activeOpacity={0.8}
            >
              <Text style={styles.backToListButtonText}>오답노트로 돌아가기</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
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
  progressSection: {
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
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressStats: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
  },
  progressDeadline: {
    fontSize: 12,
    color: '#6b7280',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 3,
  },
  questionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 20,
  },
  attemptsText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '600',
  },
  wrongAtText: {
    color: '#6b7280',
    fontSize: 12,
  },
  meaningSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  meaningText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3b82f6',
    textAlign: 'center',
    marginBottom: 12,
  },
  exampleText: {
    fontSize: 16,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  inputSection: {
    gap: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  answerInput: {
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
    textAlign: 'center',
    color: '#1f2937',
    backgroundColor: 'white',
  },
  answerInputDisabled: {
    backgroundColor: '#f9fafb',
    color: '#9ca3af',
    borderColor: '#e5e7eb',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    backgroundColor: '#6b7280',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  skipButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resultSection: {
    gap: 16,
  },
  resultCard: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  resultCardCorrect: {
    backgroundColor: '#ecfdf5',
    borderWidth: 2,
    borderColor: '#10b981',
  },
  resultCardIncorrect: {
    backgroundColor: '#fef2f2',
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  correctAnswerText: {
    fontSize: 16,
    color: '#1f2937',
    marginBottom: 8,
  },
  correctAnswerLabel: {
    fontWeight: 'bold',
  },
  posText: {
    color: '#6b7280',
  },
  removedFromListText: {
    fontSize: 12,
    color: '#059669',
    fontStyle: 'italic',
  },
  nextButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  backToListButton: {
    backgroundColor: '#6b7280',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backToListButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
});