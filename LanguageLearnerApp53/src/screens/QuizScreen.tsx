// src/screens/QuizScreen.tsx
// 통합 퀴즈 화면 (React Native 버전) - GrammarQuiz.jsx, MiniQuiz.jsx 기능 구현

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

type Props = NativeStackScreenProps<MainStackParamList, 'Quiz'>;

interface QuizQuestion {
  id?: string;
  stem?: string; // Grammar quiz question
  question?: string; // Mini quiz question
  options: string[];
  answer: string;
  explanation?: string;
  pron?: {
    ipa?: string;
    ipaKo?: string;
  };
}

interface QuizTopic {
  id: string;
  title: string;
  level?: string;
  description?: string;
  questions: QuizQuestion[];
  detailedExplanation?: any[][];
}

interface QuizParams {
  type?: 'grammar' | 'mini' | 'general';
  topicId?: string;
  folderId?: string;
}

const QuizScreen: React.FC<Props> = ({ navigation, route }) => {
  const { user } = useAuth();
  const params = route.params as QuizParams || {};
  const quizType = params.type || 'general';
  const topicId = params.topicId;
  const folderId = params.folderId;

  const [topics, setTopics] = useState<QuizTopic[]>([]);
  const [currentTopic, setCurrentTopic] = useState<QuizTopic | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<any>(null);
  const [incorrectAnswers, setIncorrectAnswers] = useState<QuizQuestion[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'explanation' | 'quiz'>('list');
  const [explanationPage, setExplanationPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (topicId) {
      loadTopicById(topicId);
    } else {
      loadTopics();
    }
  }, [topicId]);

  const loadTopics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Load different types of quizzes based on type
      let endpoint = '/quiz/topics';
      if (quizType === 'grammar') {
        endpoint = '/grammar/topics';
      } else if (quizType === 'mini') {
        endpoint = '/quiz/mini';
      }

      const response = await apiClient.request(endpoint);
      const topicsData = response?.data || response || [];
      setTopics(Array.isArray(topicsData) ? topicsData : []);
      
      // For demo, create sample topics
      if (!topicsData || topicsData.length === 0) {
        const sampleTopics: QuizTopic[] = [
          {
            id: 'grammar-present-tense',
            title: '현재시제 (Present Tense)',
            level: 'A1',
            description: '영어의 현재시제에 대해 학습합니다.',
            questions: [
              {
                stem: 'I ___ to school every day.',
                options: ['go', 'goes', 'going', 'went'],
                answer: 'go',
                explanation: '주어가 I일 때는 동사원형을 사용합니다.'
              },
              {
                stem: 'She ___ English very well.',
                options: ['speak', 'speaks', 'speaking', 'spoke'],
                answer: 'speaks',
                explanation: '주어가 3인칭 단수일 때는 동사에 -s를 붙입니다.'
              }
            ],
            detailedExplanation: [[
              { type: 'text', content: '현재시제는 현재의 상태나 반복되는 행동을 표현합니다.' },
              { type: 'heading', content: '기본 형태' },
              { type: 'list', items: ['I/You/We/They + 동사원형', 'He/She/It + 동사+s'] },
              { type: 'example', items: [
                { de: 'I study English.', ko: '나는 영어를 공부한다.' },
                { de: 'She studies English.', ko: '그녀는 영어를 공부한다.' }
              ]}
            ]]
          },
          {
            id: 'mini-vocabulary',
            title: '기본 어휘 퀴즈',
            level: 'A1',
            description: '기본적인 영어 어휘를 테스트합니다.',
            questions: [
              {
                question: 'book',
                options: ['책', '펜', '종이', '연필'],
                answer: '책',
                pron: { ipa: '/bʊk/', ipaKo: '북' }
              },
              {
                question: 'water',
                options: ['물', '우유', '주스', '차'],
                answer: '물',
                pron: { ipa: '/ˈwɔːtər/', ipaKo: '워터' }
              }
            ]
          }
        ];
        setTopics(sampleTopics);
      }
    } catch (err: any) {
      console.error('Failed to load quiz topics:', err);
      setError(`퀴즈 주제를 불러오는데 실패했습니다: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [quizType]);

  const loadTopicById = useCallback(async (id: string) => {
    const topic = topics.find(t => t.id === id);
    if (topic) {
      setCurrentTopic(topic);
      setQuestions(topic.questions);
      setViewMode(topic.detailedExplanation ? 'explanation' : 'quiz');
      setExplanationPage(0);
    }
  }, [topics]);

  const handleTopicSelect = (topic: QuizTopic) => {
    setCurrentTopic(topic);
    setQuestions(topic.questions);
    setViewMode(topic.detailedExplanation ? 'explanation' : 'quiz');
    setExplanationPage(0);
    setCurrentIndex(0);
    setUserAnswer(null);
    setFeedback(null);
    setIncorrectAnswers([]);
    setIsCompleted(false);
  };

  const handleOptionSelect = (option: string) => {
    if (feedback) return;
    setUserAnswer(option);
  };

  const handleSubmit = async () => {
    if (!userAnswer || !currentTopic) return;

    const currentQuestion = questions[currentIndex];
    const isCorrect = userAnswer === currentQuestion.answer;
    
    setIsSubmitting(true);
    
    try {
      if (quizType === 'mini' && folderId) {
        // Mini quiz API call
        await apiClient.request('/quiz/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folderId: folderId,
            cardId: currentQuestion.id,
            correct: isCorrect
          })
        });
      }

      setFeedback({
        isCorrect,
        explanation: currentQuestion.explanation,
        correctAnswer: currentQuestion.answer
      });

      if (!isCorrect) {
        setIncorrectAnswers(prev => [...prev, currentQuestion]);

        // Record wrong answer for logged in users
        if (user) {
          try {
            const wrongData = quizType === 'grammar' ? {
              type: 'grammar',
              wrongData: {
                topicId: currentTopic.id,
                topicTitle: currentTopic.title,
                questionIndex: currentIndex,
                question: currentQuestion.stem || currentQuestion.question,
                userAnswer: userAnswer,
                correctAnswer: currentQuestion.answer,
                options: currentQuestion.options,
                explanation: currentQuestion.explanation,
                level: currentTopic.level
              }
            } : {
              type: 'vocabulary',
              wrongData: {
                question: currentQuestion.question,
                userAnswer: userAnswer,
                correctAnswer: currentQuestion.answer,
                options: currentQuestion.options
              }
            };

            await apiClient.request('/odat-note', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(wrongData)
            });
            
            console.log(`✅ [퀴즈 오답 기록 완료] ${currentTopic.title} - 문제 ${currentIndex + 1}`);
          } catch (error) {
            console.error('❌ 퀴즈 오답 기록 실패:', error);
          }
        }
      }
    } catch (error: any) {
      console.error('Quiz answer submission failed:', error);
      Alert.alert('오류', `답변 제출 실패: ${error.message || 'Internal Server Error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setUserAnswer(null);
      setFeedback(null);
    } else {
      setIsCompleted(true);
    }
  };

  const handleRestartIncorrect = () => {
    setQuestions(incorrectAnswers);
    setCurrentIndex(0);
    setUserAnswer(null);
    setFeedback(null);
    setIncorrectAnswers([]);
    setIsCompleted(false);
    setViewMode('quiz');
  };

  const handleGoBack = () => {
    if (viewMode === 'quiz' || viewMode === 'explanation') {
      setViewMode('list');
      setCurrentTopic(null);
    } else {
      navigation.goBack();
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>퀴즈를 로드하는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>오류가 발생했습니다</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadTopics}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Topic List View
  if (viewMode === 'list') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
              <Text style={styles.backButtonText}>← 뒤로가기</Text>
            </TouchableOpacity>
            <Text style={styles.title}>
              {quizType === 'grammar' ? '📚 문법 퀴즈' : 
               quizType === 'mini' ? '🎯 미니 퀴즈' : '🧠 퀴즈'}
            </Text>
            <Text style={styles.subtitle}>
              {quizType === 'grammar' ? '문법 지식을 테스트해보세요' :
               quizType === 'mini' ? '빠른 어휘 퀴즈로 실력을 체크해보세요' :
               '다양한 퀴즈로 영어 실력을 향상시켜보세요'}
            </Text>
          </View>

          <View style={styles.topicGrid}>
            {topics.map((topic) => (
              <TouchableOpacity
                key={topic.id}
                style={styles.topicCard}
                onPress={() => handleTopicSelect(topic)}
              >
                <Text style={styles.topicTitle}>{topic.title}</Text>
                {topic.level && (
                  <Text style={styles.topicLevel}>{topic.level}</Text>
                )}
                {topic.description && (
                  <Text style={styles.topicDescription}>{topic.description}</Text>
                )}
                <Text style={styles.topicQuestionCount}>
                  {topic.questions.length}문제
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!currentTopic) return null;

  // Explanation View (for grammar topics)
  if (viewMode === 'explanation') {
    const explanationContent = currentTopic.detailedExplanation || [];
    const currentPageItems = explanationContent[explanationPage] || [];
    const isLastPage = explanationPage === explanationContent.length - 1;

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
              <Text style={styles.backButtonText}>← 목록으로</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{currentTopic.title}</Text>
          </View>

          <View style={styles.explanationCard}>
            {currentPageItems.map((item: any, index: number) => (
              <View key={index} style={styles.explanationItem}>
                {item.type === 'heading' && (
                  <Text style={styles.explanationHeading}>{item.content}</Text>
                )}
                {item.type === 'text' && (
                  <Text style={styles.explanationText}>{item.content}</Text>
                )}
                {item.type === 'list' && (
                  <View style={styles.explanationList}>
                    {item.items.map((listItem: string, idx: number) => (
                      <Text key={idx} style={styles.explanationListItem}>
                        • {listItem}
                      </Text>
                    ))}
                  </View>
                )}
                {item.type === 'example' && (
                  <View style={styles.explanationExamples}>
                    {item.items.map((example: any, idx: number) => (
                      <View key={idx} style={styles.explanationExample}>
                        <Text style={styles.explanationExampleEn}>{example.de}</Text>
                        <Text style={styles.explanationExampleKo}>— {example.ko}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>

          <View style={styles.explanationFooter}>
            <TouchableOpacity
              style={[styles.explanationButton, explanationPage === 0 && styles.explanationButtonDisabled]}
              onPress={() => setExplanationPage(p => p - 1)}
              disabled={explanationPage === 0}
            >
              <Text style={[styles.explanationButtonText, explanationPage === 0 && styles.explanationButtonTextDisabled]}>
                이전
              </Text>
            </TouchableOpacity>

            <Text style={styles.explanationProgress}>
              {explanationPage + 1} / {explanationContent.length}
            </Text>

            {isLastPage ? (
              <TouchableOpacity
                style={styles.explanationButtonPrimary}
                onPress={() => setViewMode('quiz')}
              >
                <Text style={styles.explanationButtonPrimaryText}>문제 풀러가기</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.explanationButton}
                onPress={() => setExplanationPage(p => p + 1)}
              >
                <Text style={styles.explanationButtonText}>다음</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Completion View
  if (isCompleted) {
    const correctCount = questions.length - incorrectAnswers.length;
    const totalCount = questions.length;
    const percentage = Math.round((correctCount / totalCount) * 100);

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView}>
          <View style={styles.completionContainer}>
            <Text style={styles.completionTitle}>🎉 학습 완료!</Text>
            <Text style={styles.completionScore}>
              총 {totalCount}문제 중 {correctCount}개를 맞혔습니다.
            </Text>
            <Text style={styles.completionPercentage}>{percentage}%</Text>

            {incorrectAnswers.length > 0 && (
              <View style={styles.completionWarning}>
                <Text style={styles.completionWarningTitle}>부족한 부분</Text>
                <Text style={styles.completionWarningText}>
                  {incorrectAnswers.length}개의 틀린 문제가 있습니다.
                </Text>
                <TouchableOpacity
                  style={styles.completionWarningButton}
                  onPress={() => {/* Navigate to wrong answers */}}
                >
                  <Text style={styles.completionWarningButtonText}>
                    📝 {quizType === 'grammar' ? '문법' : '어휘'} 오답노트에서 복습하기
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.completionActions}>
              {incorrectAnswers.length > 0 && (
                <TouchableOpacity
                  style={styles.completionActionButton}
                  onPress={handleRestartIncorrect}
                >
                  <Text style={styles.completionActionButtonText}>틀린 문제 다시 풀기</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.completionSecondaryButton}
                onPress={handleGoBack}
              >
                <Text style={styles.completionSecondaryButtonText}>목록으로 돌아가기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Quiz View
  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.quizHeader}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Text style={styles.backButtonText}>← 뒤로가기</Text>
          </TouchableOpacity>
          <View style={styles.quizHeaderInfo}>
            <Text style={styles.quizTitle}>{currentTopic.title}</Text>
            <Text style={styles.quizProgress}>{currentIndex + 1} / {questions.length}</Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>

        <View style={styles.questionCard}>
          {quizType === 'mini' && currentQuestion.question ? (
            <>
              <Text style={styles.questionTextLarge}>{currentQuestion.question}</Text>
              {currentQuestion.pron && (
                <View style={styles.pronunciationContainer}>
                  <Text style={styles.pronunciationText}>
                    {currentQuestion.pron.ipa} {currentQuestion.pron.ipaKo && `(${currentQuestion.pron.ipaKo})`}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.questionText}>
              {currentQuestion.stem?.split('___')[0]}
              <Text style={styles.questionBlank}>___</Text>
              {currentQuestion.stem?.split('___')[1]}
            </Text>
          )}

          <View style={styles.optionsContainer}>
            {currentQuestion.options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionButton,
                  userAnswer === option && styles.optionButtonSelected,
                  feedback && userAnswer === option && (
                    option === currentQuestion.answer ? 
                      styles.optionButtonCorrect : 
                      styles.optionButtonIncorrect
                  ),
                  feedback && option === currentQuestion.answer && styles.optionButtonCorrect,
                ]}
                onPress={() => handleOptionSelect(option)}
                disabled={!!feedback}
              >
                <Text style={[
                  styles.optionButtonText,
                  userAnswer === option && styles.optionButtonTextSelected,
                  feedback && option === currentQuestion.answer && styles.optionButtonTextCorrect,
                ]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {feedback && (
            <View style={[
              styles.feedbackContainer,
              feedback.isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect
            ]}>
              <Text style={styles.feedbackTitle}>
                {feedback.isCorrect ? '정답입니다!' : `오답입니다. (정답: ${feedback.correctAnswer})`}
              </Text>
              {feedback.explanation && (
                <Text style={styles.feedbackExplanation}>{feedback.explanation}</Text>
              )}
            </View>
          )}

          <View style={styles.actionButtonContainer}>
            {feedback ? (
              <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                <Text style={styles.nextButtonText}>
                  {currentIndex < questions.length - 1 ? '다음 문제' : '결과 보기'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!userAnswer || isSubmitting) && styles.submitButtonDisabled
                ]}
                onPress={handleSubmit}
                disabled={!userAnswer || isSubmitting}
              >
                <Text style={[
                  styles.submitButtonText,
                  (!userAnswer || isSubmitting) && styles.submitButtonTextDisabled
                ]}>
                  {isSubmitting ? '처리 중…' : '제출하기'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
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
    color: '#dc2626',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
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
  header: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 14,
    color: '#6b7280',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 22,
  },
  topicGrid: {
    padding: 20,
    gap: 16,
  },
  topicCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  topicTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  topicLevel: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  topicDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  topicQuestionCount: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  explanationCard: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  explanationItem: {
    marginBottom: 16,
  },
  explanationHeading: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 8,
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 16,
    color: '#4b5563',
    lineHeight: 24,
    marginBottom: 8,
  },
  explanationList: {
    paddingLeft: 12,
  },
  explanationListItem: {
    fontSize: 16,
    color: '#4b5563',
    lineHeight: 24,
    marginBottom: 4,
  },
  explanationExamples: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
  },
  explanationExample: {
    marginBottom: 8,
  },
  explanationExampleEn: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  explanationExampleKo: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  explanationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  explanationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: 'white',
  },
  explanationButtonDisabled: {
    opacity: 0.5,
  },
  explanationButtonText: {
    fontSize: 16,
    color: '#4b5563',
    fontWeight: '500',
  },
  explanationButtonTextDisabled: {
    color: '#9ca3af',
  },
  explanationButtonPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
  },
  explanationButtonPrimaryText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  explanationProgress: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  completionContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  completionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  completionScore: {
    fontSize: 18,
    color: '#4b5563',
    marginBottom: 8,
    textAlign: 'center',
  },
  completionPercentage: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 24,
  },
  completionWarning: {
    backgroundColor: '#fef3cd',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f59e0b',
    width: '100%',
  },
  completionWarningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 8,
  },
  completionWarningText: {
    fontSize: 14,
    color: '#92400e',
    marginBottom: 12,
  },
  completionWarningButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3b82f6',
    alignSelf: 'flex-start',
  },
  completionWarningButtonText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  completionActions: {
    gap: 12,
    alignItems: 'center',
  },
  completionActionButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  completionActionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  completionSecondaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6b7280',
  },
  completionSecondaryButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '500',
  },
  quizHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  quizHeaderInfo: {
    flex: 1,
    alignItems: 'center',
    marginRight: 60,
  },
  quizTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  quizProgress: {
    fontSize: 14,
    color: '#6b7280',
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  progressContainer: {
    padding: 20,
    backgroundColor: 'white',
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
  },
  questionCard: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  questionText: {
    fontSize: 20,
    color: '#1f2937',
    lineHeight: 28,
    marginBottom: 24,
    textAlign: 'center',
  },
  questionTextLarge: {
    fontSize: 32,
    color: '#1f2937',
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  questionBlank: {
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  pronunciationContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  pronunciationText: {
    fontSize: 16,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  optionButton: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: 'white',
    alignItems: 'center',
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
  optionButtonText: {
    fontSize: 18,
    color: '#1f2937',
    fontWeight: '500',
  },
  optionButtonTextSelected: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  optionButtonTextCorrect: {
    color: '#059669',
    fontWeight: '600',
  },
  feedbackContainer: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  feedbackCorrect: {
    backgroundColor: '#d1fae5',
    borderWidth: 1,
    borderColor: '#059669',
  },
  feedbackIncorrect: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  feedbackExplanation: {
    fontSize: 16,
    color: '#4b5563',
    lineHeight: 22,
  },
  actionButtonContainer: {
    alignItems: 'center',
  },
  submitButton: {
    backgroundColor: '#6b7280',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    minWidth: 120,
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
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default QuizScreen;