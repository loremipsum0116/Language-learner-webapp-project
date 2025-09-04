/*
  GrammarQuizScreen.tsx — React Native 버전
  ------------------------------------------------------------
  웹 GrammarQuiz.jsx를 모바일 앱에 맞게 리팩토링
*/

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../services/apiClient';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'GrammarQuiz'>;

// Mock grammar topics data
const grammarTopics = [
  {
    id: '1',
    title: 'Present Simple',
    level: 'A1',
    description: '현재 시제의 기본 형태와 사용법을 배웁니다.',
    detailedExplanation: [
      [
        { type: 'heading', content: 'Present Simple이란?' },
        { type: 'text', content: '현재 시제는 일반적인 사실이나 습관적인 행동을 나타냅니다.' },
        { type: 'example', items: [
          { de: 'I work every day.', ko: '나는 매일 일한다.' },
          { de: 'She speaks English well.', ko: '그녀는 영어를 잘 한다.' }
        ]},
      ],
      [
        { type: 'heading', content: '동사 변화 규칙' },
        { type: 'list', items: [
          '3인칭 단수(he, she, it)에는 -s/-es를 붙입니다',
          '일반 동사에는 -s를 붙입니다 (work → works)',
          '-s, -sh, -ch, -x, -o로 끝나는 동사에는 -es를 붙입니다'
        ]},
      ]
    ],
    questions: [
      {
        stem: 'She ___ to school every morning.',
        options: ['go', 'goes', 'going', 'gone'],
        answer: 'goes',
        explanation: '3인칭 단수 주어에는 동사에 -s/-es를 붙여야 합니다.'
      },
      {
        stem: 'They ___ English at home.',
        options: ['speaks', 'speak', 'speaking', 'spoke'],
        answer: 'speak',
        explanation: '복수 주어에는 동사 원형을 사용합니다.'
      }
    ]
  }
];

interface Question {
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
}

interface Topic {
  id: string;
  title: string;
  level: string;
  description: string;
  detailedExplanation: any[];
  questions: Question[];
}

interface ExplanationContentProps {
  item: {
    type: string;
    content?: string;
    items?: any[];
  };
}

// 설명 콘텐츠를 렌더링하는 헬퍼 컴포넌트
function ExplanationContent({ item }: ExplanationContentProps) {
  switch (item.type) {
    case 'heading':
      return <Text style={styles.explanationHeading}>{item.content}</Text>;
    case 'list':
      return (
        <View style={styles.explanationList}>
          {item.items?.map((listItem, i) => (
            <Text key={i} style={styles.explanationListItem}>• {listItem}</Text>
          ))}
        </View>
      );
    case 'example':
      return (
        <View style={styles.explanationExample}>
          {item.items?.map((ex, i) => (
            <View key={i} style={styles.exampleItem}>
              <Text style={styles.exampleEn}>{ex.de}</Text>
              <Text style={styles.exampleKo}>— {ex.ko}</Text>
            </View>
          ))}
        </View>
      );
    default:
      return <Text style={styles.explanationText}>{item.content}</Text>;
  }
}

export default function GrammarQuizScreen({ route, navigation }: Props) {
  const { topicId } = route.params || { topicId: '1' };
  const [topic, setTopic] = useState<Topic | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{isCorrect: boolean; explanation: string} | null>(null);
  const [incorrectAnswers, setIncorrectAnswers] = useState<Question[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [viewMode, setViewMode] = useState<'explanation' | 'quiz'>('explanation');
  const [explanationPage, setExplanationPage] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const currentTopic = grammarTopics.find(t => t.id === topicId);
    if (currentTopic) {
      setTopic(currentTopic);
      setQuestions(currentTopic.questions);
      setExplanationPage(0);
    }
  }, [topicId]);

  const currentQuestion = questions[currentIndex];

  const handleOptionSelect = (option: string) => {
    if (feedback) return;
    setUserAnswer(option);
  };

  const handleSubmit = async () => {
    if (!currentQuestion || !userAnswer) return;

    const isCorrect = userAnswer === currentQuestion.answer;
    setFeedback({
      isCorrect,
      explanation: currentQuestion.explanation,
    });

    if (!isCorrect) {
      setIncorrectAnswers(prev => [...prev, currentQuestion]);

      // 오답노트에 문법 문제 기록
      try {
        await apiClient.post('/api/odat-note', {
          type: 'grammar',
          wrongData: {
            topicId: topicId,
            topicTitle: topic?.title,
            questionIndex: currentIndex,
            question: currentQuestion.stem,
            userAnswer: userAnswer,
            correctAnswer: currentQuestion.answer,
            options: currentQuestion.options,
            explanation: currentQuestion.explanation,
            level: topic?.level
          }
        });
        console.log(`✅ [문법 오답 기록 완료] ${topic?.title} - 문제 ${currentIndex + 1}`);
      } catch (error: any) {
        console.error('❌ 문법 오답 기록 실패:', error);
        if (error.message?.includes('Unauthorized')) {
          console.warn('⚠️ 로그인이 필요합니다. 오답노트 기록을 위해 로그인해주세요.');
        } else {
          console.warn('⚠️ 오답노트 저장에 실패했습니다. 네트워크 연결을 확인해주세요.');
        }
      }
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
  };

  if (!topic) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>주제를 찾을 수 없습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 설명 모드
  if (viewMode === 'explanation') {
    const explanationContent = topic.detailedExplanation || [];
    const currentPageItems = explanationContent[explanationPage] || [];
    const isLastPage = explanationPage === explanationContent.length - 1;

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{topic.title}</Text>
          <View style={styles.headerRight} />
        </View>
        
        <ScrollView style={styles.scrollView}>
          <View style={styles.explanationCard}>
            <Text style={styles.explanationTitle}>{topic.title}</Text>
            {currentPageItems.map((item, index) => (
              <ExplanationContent key={index} item={item} />
            ))}
          </View>
        </ScrollView>
        
        <View style={styles.explanationFooter}>
          <TouchableOpacity
            style={[styles.navButton, styles.navButtonSecondary]}
            onPress={() => setExplanationPage(p => p - 1)}
            disabled={explanationPage === 0}
          >
            <Text style={[
              styles.navButtonText,
              styles.navButtonTextSecondary,
              explanationPage === 0 && styles.navButtonTextDisabled
            ]}>
              이전
            </Text>
          </TouchableOpacity>
          
          <Text style={styles.pageIndicator}>
            {explanationPage + 1} / {explanationContent.length}
          </Text>
          
          {isLastPage ? (
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonPrimary]}
              onPress={() => setViewMode('quiz')}
            >
              <Text style={[styles.navButtonText, styles.navButtonTextPrimary]}>
                문제 풀러가기
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonSecondary]}
              onPress={() => setExplanationPage(p => p + 1)}
            >
              <Text style={[styles.navButtonText, styles.navButtonTextSecondary]}>
                다음
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // 완료 모드
  if (isCompleted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <View style={styles.completionCard}>
            <Text style={styles.completionEmoji}>🎉</Text>
            <Text style={styles.completionTitle}>학습 완료!</Text>
            <Text style={styles.completionText}>
              총 {questions.length}문제 중 {' '}
              <Text style={styles.completionScore}>
                {questions.length - incorrectAnswers.length}개
              </Text>
              를 맞혔습니다.
            </Text>
            
            {incorrectAnswers.length > 0 && (
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>
                  부족한 부분: {incorrectAnswers.length}개의 틀린 문제가 있습니다.
                </Text>
                <TouchableOpacity
                  style={styles.wrongAnswerButton}
                  onPress={() => navigation.navigate('WrongAnswers', { tab: 'grammar' })}
                >
                  <Text style={styles.wrongAnswerButtonText}>
                    📝 문법 오답노트에서 복습하기
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            
            <View style={styles.completionButtons}>
              {incorrectAnswers.length > 0 && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonPrimary]}
                  onPress={handleRestartIncorrect}
                >
                  <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                    틀린 문제 다시 풀기
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonSecondary]}
                onPress={() => navigation.navigate('GrammarHub')}
              >
                <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                  목록으로 돌아가기
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // 퀴즈 모드
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{topic.title}</Text>
        <View style={styles.questionCounter}>
          <Text style={styles.questionCounterText}>
            {currentIndex + 1}/{questions.length}
          </Text>
        </View>
      </View>
      
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${((currentIndex + 1) / questions.length) * 100}%` }
            ]}
          />
        </View>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.questionCard}>
          <Text style={styles.questionText}>
            {currentQuestion?.stem.split('___')[0]}
            <Text style={styles.questionBlank}>___</Text>
            {currentQuestion?.stem.split('___')[1]}
          </Text>
        </View>
        
        <View style={styles.optionsContainer}>
          {currentQuestion?.options.map(option => (
            <TouchableOpacity
              key={option}
              style={[
                styles.optionButton,
                userAnswer === option && styles.optionButtonSelected,
                feedback && userAnswer === option && 
                  (feedback.isCorrect ? styles.optionButtonCorrect : styles.optionButtonIncorrect)
              ]}
              onPress={() => handleOptionSelect(option)}
              disabled={!!feedback}
            >
              <Text style={[
                styles.optionText,
                userAnswer === option && styles.optionTextSelected
              ]}>
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {feedback && (
          <View style={[
            styles.feedbackCard,
            feedback.isCorrect ? styles.feedbackCardCorrect : styles.feedbackCardIncorrect
          ]}>
            <Text style={styles.feedbackTitle}>
              {feedback.isCorrect ? '정답입니다!' : `오답입니다. (정답: ${currentQuestion.answer})`}
            </Text>
            <Text style={styles.feedbackText}>{feedback.explanation}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.actionContainer}>
        {feedback ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonPrimary]}
            onPress={handleNext}
          >
            <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
              {currentIndex < questions.length - 1 ? '다음 문제' : '결과 보기'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.actionButton,
              userAnswer ? styles.actionButtonPrimary : styles.actionButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={!userAnswer}
          >
            <Text style={[
              styles.actionButtonText,
              userAnswer ? styles.actionButtonTextPrimary : styles.actionButtonTextDisabled
            ]}>
              제출하기
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 32,
  },
  questionCounter: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  questionCounterText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  scrollView: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
  },
  explanationCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  explanationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  explanationHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    lineHeight: 24,
  },
  explanationList: {
    paddingLeft: 12,
    marginBottom: 12,
  },
  explanationListItem: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
    lineHeight: 24,
  },
  explanationExample: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginVertical: 8,
  },
  exampleItem: {
    marginBottom: 8,
  },
  exampleEn: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  exampleKo: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  explanationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  navButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  navButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6c757d',
  },
  navButtonPrimary: {
    backgroundColor: '#007AFF',
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  navButtonTextSecondary: {
    color: '#6c757d',
  },
  navButtonTextPrimary: {
    color: 'white',
  },
  navButtonTextDisabled: {
    color: '#adb5bd',
  },
  pageIndicator: {
    fontSize: 14,
    color: '#666',
  },
  completionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  completionEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  completionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  completionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  completionScore: {
    fontWeight: 'bold',
    color: '#007AFF',
  },
  warningCard: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  warningTitle: {
    fontSize: 14,
    color: '#856404',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
  },
  wrongAnswerButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  wrongAnswerButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  completionButtons: {
    gap: 12,
    width: '100%',
  },
  questionCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  questionText: {
    fontSize: 18,
    color: '#333',
    lineHeight: 26,
  },
  questionBlank: {
    fontWeight: 'bold',
    color: '#007AFF',
  },
  optionsContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  optionButton: {
    backgroundColor: 'white',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  optionButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  optionButtonCorrect: {
    backgroundColor: '#198754',
    borderColor: '#198754',
  },
  optionButtonIncorrect: {
    backgroundColor: '#dc3545',
    borderColor: '#dc3545',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  optionTextSelected: {
    color: 'white',
    fontWeight: '500',
  },
  feedbackCard: {
    margin: 16,
    padding: 16,
    borderRadius: 8,
  },
  feedbackCardCorrect: {
    backgroundColor: '#d1e7dd',
  },
  feedbackCardIncorrect: {
    backgroundColor: '#f8d7da',
  },
  feedbackTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  feedbackText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  actionContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  actionButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  actionButtonPrimary: {
    backgroundColor: '#007AFF',
  },
  actionButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6c757d',
  },
  actionButtonDisabled: {
    backgroundColor: '#e9ecef',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  actionButtonTextPrimary: {
    color: 'white',
  },
  actionButtonTextSecondary: {
    color: '#6c757d',
  },
  actionButtonTextDisabled: {
    color: '#adb5bd',
  },
});