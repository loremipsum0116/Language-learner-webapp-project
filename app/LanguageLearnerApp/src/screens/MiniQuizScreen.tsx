/*
  MiniQuizScreen.tsx — React Native 버전
  ------------------------------------------------------------
  웹 MiniQuiz.jsx를 모바일 앱에 맞게 리팩토링
*/

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../services/apiClient';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MiniQuiz'>;

interface QuizItem {
  cardId: string;
  folderId?: string;
  question: string;
  options?: string[];
  answer: string;
  pron?: {
    ipa?: string;
    ipaKo?: string;
  };
}

interface PronProps {
  ipa?: string;
  ipaKo?: string;
}

const Pron: React.FC<PronProps> = ({ ipa, ipaKo }) => {
  if (!ipa && !ipaKo) return null;
  
  return (
    <View style={styles.pronContainer}>
      {ipa && <Text style={styles.pronText}>/{ipa}/</Text>}
      {ipaKo && <Text style={styles.pronKoText}>[{ipaKo}]</Text>}
    </View>
  );
};

export default function MiniQuizScreen({ route, navigation }: Props) {
  const { batch, folderId } = route.params || { batch: [], folderId: null };
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ status: 'pass' | 'fail'; answer: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const current = batch[currentIndex];

  const handleSubmit = async () => {
    if (!current || isSubmitting) return;
    
    setIsSubmitting(true);
    const correct = userAnswer === current.answer;

    try {
      // 정답/오답 결과를 서버에 전송
      await apiClient.post('/quiz/answer', {
        folderId: current.folderId || folderId,
        cardId: current.cardId,
        correct
      });
    } catch (e: any) {
      console.error("퀴즈 답변 제출 실패:", e);
      Alert.alert('오류', `답변 제출 실패: ${e.message || 'Internal Server Error'}`);
    } finally {
      setFeedback({ status: correct ? 'pass' : 'fail', answer: current.answer });
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < batch.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setUserAnswer(null);
      setFeedback(null);
    } else {
      // 배치의 모든 퀴즈가 끝나면 화면을 닫음
      navigation.goBack();
    }
  };

  if (!current) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>퀴즈 로딩 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>미니 퀴즈</Text>
        </View>
        
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {currentIndex + 1} / {batch.length}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${((currentIndex + 1) / batch.length) * 100}%` }
            ]}
          />
        </View>
      </View>

      {/* Question Section */}
      <View style={styles.questionSection}>
        <Text style={styles.questionText}>{current.question}</Text>
        <Pron ipa={current.pron?.ipa} ipaKo={current.pron?.ipaKo} />
      </View>

      {/* Options Section */}
      {!feedback && (
        <View style={styles.optionsSection}>
          {current.options?.map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.optionButton,
                userAnswer === option && styles.optionButtonSelected
              ]}
              onPress={() => setUserAnswer(option)}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.optionText,
                userAnswer === option && styles.optionTextSelected
              ]}>
                {option}
              </Text>
            </TouchableOpacity>
          ))}
          
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!userAnswer || isSubmitting) && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={!userAnswer || isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <View style={styles.submitButtonContent}>
                <ActivityIndicator size="small" color="white" />
                <Text style={styles.submitButtonText}>처리 중...</Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>제출하기</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Feedback Section */}
      {feedback && (
        <View style={styles.feedbackSection}>
          <View style={[
            styles.feedbackCard,
            feedback.status === 'pass' ? styles.feedbackCardCorrect : styles.feedbackCardIncorrect
          ]}>
            <View style={styles.feedbackHeader}>
              <Ionicons
                name={feedback.status === 'pass' ? 'checkmark-circle' : 'close-circle'}
                size={32}
                color={feedback.status === 'pass' ? '#10b981' : '#ef4444'}
              />
              <Text style={[
                styles.feedbackTitle,
                feedback.status === 'pass' ? styles.feedbackTitleCorrect : styles.feedbackTitleIncorrect
              ]}>
                {feedback.status === 'pass' ? '정답입니다!' : '오답입니다'}
              </Text>
            </View>
            
            <View style={styles.feedbackBody}>
              <Text style={styles.feedbackAnswerLabel}>정답:</Text>
              <Text style={styles.feedbackAnswerText}>{feedback.answer}</Text>
            </View>
          </View>
          
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <Text style={styles.nextButtonText}>
              {currentIndex < batch.length - 1 ? '다음 문제' : '퀴즈 완료'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color="white" />
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
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  progressContainer: {
    alignItems: 'flex-end',
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  progressBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e9ecef',
    borderRadius: 3,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 3,
  },
  questionSection: {
    backgroundColor: 'white',
    padding: 32,
    margin: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  questionText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  pronContainer: {
    alignItems: 'center',
  },
  pronText: {
    fontSize: 18,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  pronKoText: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
  },
  optionsSection: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  optionButton: {
    backgroundColor: 'white',
    paddingVertical: 18,
    paddingHorizontal: 24,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  optionButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  optionText: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    fontWeight: '500',
  },
  optionTextSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#28a745',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginLeft: 8,
  },
  feedbackSection: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  feedbackCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  feedbackCardCorrect: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
    borderWidth: 2,
  },
  feedbackCardIncorrect: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
    borderWidth: 2,
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  feedbackTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  feedbackTitleCorrect: {
    color: '#059669',
  },
  feedbackTitleIncorrect: {
    color: '#dc2626',
  },
  feedbackBody: {
    alignItems: 'center',
  },
  feedbackAnswerLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  feedbackAnswerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  nextButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
});