// src/components/MiniQuiz.tsx
// 미니 퀴즈 컴포넌트 (React Native 버전)

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { MiniQuizProps } from '../types';
import Pron from './Pron';

const MiniQuiz: React.FC<MiniQuizProps> = ({ batch, onDone, folderId, isReviewQuiz = false }) => {
  const [idx, setIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ status: 'pass' | 'fail'; answer: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const current = batch[idx];

  const submit = async () => {
    if (!current || isSubmitting) return;
    
    setIsSubmitting(true);
    const correct = userAnswer === current.answer;

    try {
      // Review quiz일 경우 서버에 전송하지 않음 (점수 미반영)
      if (!isReviewQuiz) {
        // 정답/오답 결과를 서버에 전송합니다.
        // TODO: API 호출 구현 필요 (fetchJSON 대신 React Native용 API 사용)
        const response = await fetch('/quiz/answer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            folderId: current.folderId || folderId,
            cardId: current.cardId, 
            correct 
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
      }
    } catch (e: any) {
      console.error("퀴즈 답변 제출 실패:", e);
      Alert.alert('오류', `답변 제출 실패: ${e.message || 'Internal Server Error'}`);
    } finally {
      setFeedback({ status: correct ? 'pass' : 'fail', answer: current.answer });
      setIsSubmitting(false);
    }
  };

  const next = () => {
    if (idx < batch.length - 1) {
      setIdx(i => i + 1);
      setUserAnswer(null);
      setFeedback(null);
    } else {
      // 배치의 모든 퀴즈가 끝나면 onDone 콜백을 호출합니다.
      onDone();
    }
  };

  if (!current) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>퀴즈 로딩 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {isReviewQuiz ? '복습 퀴즈' : '미니 퀴즈'}
        </Text>
        <Text style={styles.progress}>
          {idx + 1} / {batch.length}
        </Text>
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.question}>{current.question}</Text>
        
        {current.pron && (
          <View style={styles.pronContainer}>
            <Pron ipa={current.pron?.ipa} ipaKo={current.pron?.ipaKo} />
          </View>
        )}

        {!feedback && (
          <View style={styles.optionsContainer}>
            {current.options?.map((opt: string) => (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.optionButton,
                  userAnswer === opt ? styles.selectedOption : styles.unselectedOption
                ]}
                onPress={() => setUserAnswer(opt)}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.optionText,
                  userAnswer === opt ? styles.selectedOptionText : styles.unselectedOptionText
                ]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity
              style={[styles.submitButton, (!userAnswer || isSubmitting) && styles.disabledButton]}
              disabled={!userAnswer || isSubmitting}
              onPress={submit}
              activeOpacity={0.7}
            >
              {isSubmitting ? (
                <View style={styles.loadingSubmit}>
                  <ActivityIndicator size="small" color="white" />
                  <Text style={styles.submitButtonText}>처리 중...</Text>
                </View>
              ) : (
                <Text style={styles.submitButtonText}>제출하기</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {feedback && (
          <View style={[
            styles.feedbackContainer,
            feedback.status === 'pass' ? styles.successFeedback : styles.errorFeedback
          ]}>
            <Text style={styles.feedbackTitle}>
              {feedback.status === 'pass' ? '정답입니다!' : '오답입니다'}
            </Text>
            <Text style={styles.feedbackAnswer}>정답: {feedback.answer}</Text>
          </View>
        )}
      </View>

      {/* Footer */}
      {feedback && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.nextButton}
            onPress={next}
            activeOpacity={0.7}
          >
            <Text style={styles.nextButtonText}>
              {idx < batch.length - 1 ? '다음 →' : '다음 학습으로'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    margin: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  progress: {
    fontSize: 14,
    color: '#6b7280',
  },
  body: {
    padding: 16,
    alignItems: 'center',
  },
  question: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1f2937',
    marginBottom: 8,
  },
  pronContainer: {
    marginBottom: 16,
  },
  optionsContainer: {
    width: '100%',
    maxWidth: 300,
    marginTop: 16,
  },
  optionButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 2,
  },
  selectedOption: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  unselectedOption: {
    backgroundColor: 'white',
    borderColor: '#3b82f6',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  selectedOptionText: {
    color: 'white',
  },
  unselectedOptionText: {
    color: '#3b82f6',
  },
  submitButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 8,
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  loadingSubmit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  feedbackContainer: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    width: '100%',
    maxWidth: 300,
  },
  successFeedback: {
    backgroundColor: '#dcfce7', // green-100
  },
  errorFeedback: {
    backgroundColor: '#fecaca', // red-100
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#1f2937',
  },
  feedbackAnswer: {
    fontSize: 16,
    textAlign: 'center',
    color: '#374151',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  nextButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 8,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default MiniQuiz;