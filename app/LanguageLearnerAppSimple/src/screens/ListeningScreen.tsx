// src/screens/ListeningScreen.tsx
// 리스닝 연습 화면 (React Native 버전) - Listening.jsx 기능 구현

import React, { useState, useEffect, useRef, useCallback } from 'react';
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

type Props = NativeStackScreenProps<MainStackParamList, 'Listening'>;

interface ListeningQuestion {
  id: string;
  topic: string;
  script: string;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
  };
  answer: string;
}

interface ListeningParams {
  level?: string;
}

interface QuizSettings {
  questionCount: number;
  randomOrder: boolean;
}

interface QuizResult {
  questionId: string;
  question: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  topic: string;
  script: string;
}

const ListeningScreen: React.FC<Props> = ({ navigation, route }) => {
  const { user } = useAuth();
  const params = route.params as ListeningParams || {};
  const level = params.level || 'A1';

  const [questions, setQuestions] = useState<ListeningQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuestions, setSelectedQuestions] = useState<ListeningQuestion[]>([]);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizSettings, setQuizSettings] = useState<QuizSettings>({
    questionCount: 10,
    randomOrder: true
  });

  // Quiz state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showScript, setShowScript] = useState(false);

  const soundRef = useRef<Sound | null>(null);

  useEffect(() => {
    loadQuestions();
    
    // Cleanup sound on unmount
    return () => {
      if (soundRef.current) {
        soundRef.current.stop();
        soundRef.current.release();
      }
    };
  }, [level]);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Simulate loading from local JSON files like the web version
      // In a real app, this would load from the server or local assets
      const response = await fetch(`https://api.example.com/${level}/${level}_Listening/${level}_Listening.json`);
      
      if (!response.ok) {
        throw new Error(`Failed to load ${level} listening questions`);
      }

      const data = await response.json();
      setQuestions(Array.isArray(data) ? data : []);
      
      Alert.alert('성공', `${level} 리스닝 문제 ${data.length}개가 로드되었습니다.`);
    } catch (err: any) {
      console.error('Error loading listening questions:', err);
      setError(`${level} 리스닝 문제를 불러오는 중 오류가 발생했습니다: ${err.message}`);
      
      // For demo purposes, load sample questions
      setQuestions([
        {
          id: 'A1_L_001',
          topic: '인사',
          script: 'Hello, how are you today?',
          question: '대화에서 무엇에 대해 묻고 있나요?',
          options: {
            A: '이름',
            B: '안부',
            C: '시간'
          },
          answer: 'B'
        },
        {
          id: 'A1_L_002',
          topic: '시간',
          script: 'What time is it now?',
          question: '대화에서 무엇을 묻고 있나요?',
          options: {
            A: '시간',
            B: '날씨',
            C: '장소'
          },
          answer: 'A'
        }
      ]);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [level]);

  const startQuiz = () => {
    if (questions.length === 0) {
      Alert.alert('오류', '문제가 없습니다.');
      return;
    }

    let selected = [...questions];

    // Random order
    if (quizSettings.randomOrder) {
      selected = selected.sort(() => Math.random() - 0.5);
    }

    // Limit questions
    if (quizSettings.questionCount > 0 && quizSettings.questionCount < selected.length) {
      selected = selected.slice(0, quizSettings.questionCount);
    }

    setSelectedQuestions(selected);
    setQuizStarted(true);
    setCurrentIndex(0);
    setSelectedAnswer('');
    setIsAnswered(false);
    setScore(0);
    setShowResult(false);
    setResults([]);
    setShowScript(false);
  };

  const resetQuiz = () => {
    setQuizStarted(false);
    setSelectedQuestions([]);
    setCurrentIndex(0);
    setSelectedAnswer('');
    setIsAnswered(false);
    setScore(0);
    setShowResult(false);
    setResults([]);
    setShowScript(false);
    stopAudio();
  };

  const playScript = async () => {
    const currentQuestion = selectedQuestions[currentIndex];
    if (!currentQuestion?.id) return;

    if (soundRef.current) {
      soundRef.current.stop();
      soundRef.current.release();
    }

    setIsPlaying(true);

    // Audio file path (simulate web version path)
    const audioSrc = `/${level}/${level}_Listening/${level}_Listening_mix/${currentQuestion.id}.mp3`;
    
    // For demo, use text-to-speech or pre-recorded audio
    // In a real app, you would load actual audio files
    try {
      // Simulate audio playback
      setTimeout(() => {
        setIsPlaying(false);
        Alert.alert('오디오', `스크립트 재생: "${currentQuestion.script}"`);
      }, 2000);
    } catch (error) {
      console.error('Audio playback failed:', error);
      setIsPlaying(false);
      Alert.alert('오류', '음성 재생에 실패했습니다.');
    }
  };

  const stopAudio = () => {
    if (soundRef.current) {
      soundRef.current.stop();
    }
    setIsPlaying(false);
  };

  const handleAnswerSelect = async (answer: string) => {
    if (isAnswered) return;

    setSelectedAnswer(answer);
    setIsAnswered(true);

    const currentQuestion = selectedQuestions[currentIndex];
    const isCorrect = answer === currentQuestion.answer;
    
    const result: QuizResult = {
      questionId: currentQuestion.id,
      question: currentQuestion.question,
      selectedAnswer: answer,
      correctAnswer: currentQuestion.answer,
      isCorrect,
      topic: currentQuestion.topic,
      script: currentQuestion.script
    };

    setResults(prev => [...prev, result]);

    if (isCorrect) {
      setScore(prev => prev + 1);
      Alert.alert('정답', '정답입니다! 🎉');
    } else {
      Alert.alert('오답', `틀렸습니다. 정답은 "${currentQuestion.answer}" 입니다.`);
      
      // Record wrong answer for logged in users
      if (user) {
        try {
          await apiClient.request('/odat-note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'listening',
              wrongData: {
                questionId: currentQuestion.id,
                level: level,
                topic: currentQuestion.topic,
                question: currentQuestion.question,
                script: currentQuestion.script,
                userAnswer: answer,
                correctAnswer: currentQuestion.answer,
                options: currentQuestion.options,
                audioFile: `${level}_Listening_mix/${currentQuestion.id}.mp3`
              }
            })
          });
          console.log(`✅ [리스닝 오답 기록 완료] ${level} - ${currentQuestion.topic}`);
        } catch (error) {
          console.error('❌ 리스닝 오답 기록 실패:', error);
        }
      }
    }
  };

  const handleNext = () => {
    if (currentIndex < selectedQuestions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer('');
      setIsAnswered(false);
      setShowScript(false);
      stopAudio();
    } else {
      // Quiz complete
      setShowResult(true);
      stopAudio();
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedAnswer('');
    setIsAnswered(false);
    setScore(0);
    setShowResult(false);
    setResults([]);
    setShowScript(false);
    stopAudio();
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>리스닝 문제를 로드하는 중...</Text>
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
          <TouchableOpacity style={styles.retryButton} onPress={loadQuestions}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (quizStarted) {
    if (showResult) {
      const percentage = Math.round((score / selectedQuestions.length) * 100);

      return (
        <SafeAreaView style={styles.container}>
          <ScrollView style={styles.scrollView}>
            <View style={styles.resultContainer}>
              <View style={styles.resultHeader}>
                <TouchableOpacity style={styles.backButton} onPress={resetQuiz}>
                  <Text style={styles.backButtonText}>← 설정으로 돌아가기</Text>
                </TouchableOpacity>
                <Text style={styles.resultTitle}>🎧 리스닝 퀴즈 완료!</Text>
              </View>

              <View style={styles.scoreDisplay}>
                <View style={styles.scoreCircle}>
                  <Text style={styles.scoreNumber}>{score}</Text>
                  <Text style={styles.scoreTotal}>/{selectedQuestions.length}</Text>
                </View>
                <Text style={styles.scorePercentage}>{percentage}%</Text>
              </View>

              <View style={styles.resultStats}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: '#059669' }]}>{score}</Text>
                  <Text style={styles.statLabel}>정답</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: '#dc2626' }]}>{selectedQuestions.length - score}</Text>
                  <Text style={styles.statLabel}>오답</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: '#3b82f6' }]}>{selectedQuestions.length}</Text>
                  <Text style={styles.statLabel}>총 문제</Text>
                </View>
              </View>

              <View style={styles.resultActions}>
                <TouchableOpacity style={styles.primaryButton} onPress={handleRestart}>
                  <Text style={styles.primaryButtonText}>다시 풀기</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={resetQuiz}>
                  <Text style={styles.secondaryButtonText}>완료</Text>
                </TouchableOpacity>
              </View>

              {/* Detailed results */}
              <View style={styles.detailedResults}>
                <Text style={styles.detailedResultsTitle}>📋 상세 결과</Text>
                {results.map((result, index) => (
                  <View key={result.questionId} style={[
                    styles.resultItem,
                    result.isCorrect ? styles.resultItemCorrect : styles.resultItemIncorrect
                  ]}>
                    <Text style={styles.resultIndex}>{index + 1}</Text>
                    <View style={styles.resultContent}>
                      <Text style={styles.resultTopic}>주제: {result.topic}</Text>
                      <Text style={styles.resultQuestion}>질문: {result.question}</Text>
                      <Text style={styles.resultScript}>스크립트: "{result.script}"</Text>
                      <Text style={[
                        styles.resultAnswer,
                        { color: result.isCorrect ? '#059669' : '#dc2626' }
                      ]}>
                        선택한 답: {result.selectedAnswer}
                        {!result.isCorrect && (
                          <Text style={{ color: '#059669' }}> (정답: {result.correctAnswer})</Text>
                        )}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    const currentQuestion = selectedQuestions[currentIndex];
    const progress = ((currentIndex + 1) / selectedQuestions.length) * 100;

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView}>
          {/* Header */}
          <View style={styles.quizHeader}>
            <TouchableOpacity style={styles.backButton} onPress={resetQuiz}>
              <Text style={styles.backButtonText}>← 설정으로 돌아가기</Text>
            </TouchableOpacity>
            <Text style={styles.quizTitle}>🎧 {level} 리스닝 퀴즈</Text>
          </View>

          {/* Progress */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>{currentIndex + 1} / {selectedQuestions.length}</Text>
          </View>

          <View style={styles.questionCard}>
            {/* Topic badge */}
            <View style={styles.topicBadge}>
              <Text style={styles.topicText}>{currentQuestion.topic}</Text>
            </View>

            {/* Audio section */}
            <View style={styles.audioSection}>
              <View style={styles.audioControls}>
                <TouchableOpacity
                  style={[styles.playButton, isPlaying && styles.playButtonActive]}
                  onPress={isPlaying ? stopAudio : playScript}
                  disabled={!currentQuestion.id}
                >
                  <Text style={styles.playButtonText}>
                    {isPlaying ? '🔊 재생 중...' : '🔊 음성 듣기'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.playbackControls}>
                  <Text style={styles.playbackLabel}>재생 속도:</Text>
                  {[0.75, 1.0, 1.25].map(rate => (
                    <TouchableOpacity
                      key={rate}
                      style={[
                        styles.playbackButton,
                        playbackRate === rate && styles.playbackButtonActive
                      ]}
                      onPress={() => setPlaybackRate(rate)}
                    >
                      <Text style={[
                        styles.playbackButtonText,
                        playbackRate === rate && styles.playbackButtonTextActive
                      ]}>
                        {rate}×
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Text style={styles.audioHint}>
                💡 음성을 듣고 A, B, C 중에서 정답을 선택하세요. 여러 번 들을 수 있습니다.
              </Text>

              {/* Script controls */}
              <View style={styles.scriptControls}>
                <TouchableOpacity
                  style={styles.scriptButton}
                  onPress={() => setShowScript(!showScript)}
                >
                  <Text style={styles.scriptButtonText}>
                    {showScript ? '📝 스크립트 숨기기' : '📝 스크립트 보기 (힌트)'}
                  </Text>
                </TouchableOpacity>

                {showScript && (
                  <View style={styles.scriptDisplay}>
                    <Text style={styles.scriptText}>스크립트: "{currentQuestion.script}"</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Question */}
            <View style={styles.questionSection}>
              <Text style={styles.questionText}>{currentQuestion.question}</Text>
            </View>

            {/* Options */}
            <View style={styles.optionsSection}>
              {Object.entries(currentQuestion.options).map(([key, value]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.optionButton,
                    selectedAnswer === key && (
                      key === currentQuestion.answer ? styles.optionButtonCorrect : styles.optionButtonIncorrect
                    ),
                    isAnswered && key === currentQuestion.answer && styles.optionButtonCorrect,
                  ]}
                  onPress={() => handleAnswerSelect(key)}
                  disabled={isAnswered}
                >
                  <Text style={styles.optionKey}>{key}</Text>
                  <Text style={styles.optionValue}>{value}</Text>
                  {isAnswered && key === currentQuestion.answer && (
                    <Text style={styles.correctBadge}>✓ 정답</Text>
                  )}
                  {isAnswered && selectedAnswer === key && key !== currentQuestion.answer && (
                    <Text style={styles.incorrectBadge}>✗ 오답</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Next button */}
            {isAnswered && (
              <View style={styles.nextButtonContainer}>
                <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                  <Text style={styles.nextButtonText}>
                    {currentIndex < selectedQuestions.length - 1 ? '다음 문제 →' : '결과 보기 →'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Score info */}
          <View style={styles.scoreInfo}>
            <Text style={styles.currentScore}>
              현재 점수: {score}/{currentIndex + (isAnswered ? 1 : 0)}
            </Text>
            <Text style={styles.progressPercentage}>
              진행률: {Math.round(((currentIndex + (isAnswered ? 1 : 0)) / selectedQuestions.length) * 100)}%
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Text style={styles.backButtonText}>← 뒤로가기</Text>
          </TouchableOpacity>
          <Text style={styles.title}>🎧 리스닝 연습</Text>
          <Text style={styles.subtitle}>원어민 음성을 듣고 청취력을 기르며 발음을 익혀보세요.</Text>
        </View>

        {/* Level selection */}
        <View style={styles.levelSelection}>
          <Text style={styles.levelTitle}>📊 레벨 선택</Text>
          <View style={styles.levelButtons}>
            {['A1', 'A2', 'B1', 'B2', 'C1'].map((lv) => (
              <TouchableOpacity
                key={lv}
                style={[
                  styles.levelButton,
                  level === lv && styles.levelButtonActive
                ]}
                onPress={() => {/* Navigate with level */}}
              >
                <Text style={[
                  styles.levelButtonText,
                  level === lv && styles.levelButtonTextActive
                ]}>
                  {lv}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.levelInfo}>
            현재 선택된 레벨: {level} ({questions.length}개 문제)
          </Text>
        </View>

        {/* Level cards */}
        <View style={styles.levelCards}>
          {['A1', 'A2', 'B1', 'B2', 'C1'].map((lv) => (
            <View key={lv} style={[
              styles.levelCard,
              level === lv && styles.levelCardActive
            ]}>
              <Text style={styles.levelCardTitle}>🎧 {lv} 리스닝</Text>
              <Text style={styles.levelCardCount}>
                {lv === level ? questions.length : '200'}개 문제
              </Text>
              <Text style={styles.levelCardDescription}>
                {lv === 'A1' && '기초 일상 대화'}
                {lv === 'A2' && '간단한 상황 대화'}
                {lv === 'B1' && '일반적인 주제 대화'}
                {lv === 'B2' && '복잡한 내용 이해'}
                {lv === 'C1' && '전문적인 내용 이해'}
              </Text>
              <TouchableOpacity style={styles.levelCardButton}>
                <Text style={styles.levelCardButtonText}>📋 목록 보기</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Quiz settings */}
        <View style={styles.quizSettingsContainer}>
          <Text style={styles.settingsTitle}>퀴즈 설정</Text>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>문제 수: {quizSettings.questionCount}</Text>
          </View>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>랜덤 순서</Text>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                quizSettings.randomOrder && styles.toggleButtonActive
              ]}
              onPress={() => setQuizSettings(prev => ({
                ...prev,
                randomOrder: !prev.randomOrder
              }))}
            >
              <Text style={styles.toggleButtonText}>
                {quizSettings.randomOrder ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.startButton} onPress={startQuiz}>
            <Text style={styles.startButtonText}>퀴즈 시작</Text>
          </TouchableOpacity>
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
  levelSelection: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  levelTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  levelButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  levelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3b82f6',
    backgroundColor: 'white',
  },
  levelButtonActive: {
    backgroundColor: '#3b82f6',
  },
  levelButtonText: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '500',
  },
  levelButtonTextActive: {
    color: 'white',
  },
  levelInfo: {
    fontSize: 14,
    color: '#6b7280',
  },
  levelCards: {
    paddingHorizontal: 20,
    gap: 12,
  },
  levelCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  levelCardActive: {
    borderColor: '#3b82f6',
  },
  levelCardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  levelCardCount: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 4,
  },
  levelCardDescription: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 16,
  },
  levelCardButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3b82f6',
    backgroundColor: 'white',
  },
  levelCardButtonText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '500',
  },
  quizSettingsContainer: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 16,
    color: '#4b5563',
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: 'white',
  },
  toggleButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  toggleButtonText: {
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '500',
  },
  startButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
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
  quizTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
    textAlign: 'center',
    marginRight: 80,
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
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
  },
  progressText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  questionCard: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  topicBadge: {
    alignSelf: 'flex-end',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 16,
  },
  topicText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  audioSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  audioControls: {
    marginBottom: 16,
  },
  playButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  playButtonActive: {
    backgroundColor: '#dc2626',
  },
  playButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  playbackControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playbackLabel: {
    fontSize: 14,
    color: '#4b5563',
    marginRight: 8,
  },
  playbackButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#3b82f6',
    backgroundColor: 'white',
  },
  playbackButtonActive: {
    backgroundColor: '#3b82f6',
  },
  playbackButtonText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '500',
  },
  playbackButtonTextActive: {
    color: 'white',
  },
  audioHint: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  scriptControls: {
    gap: 8,
  },
  scriptButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#06b6d4',
    backgroundColor: 'white',
    alignSelf: 'flex-start',
  },
  scriptButtonText: {
    color: '#06b6d4',
    fontSize: 14,
    fontWeight: '500',
  },
  scriptDisplay: {
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    padding: 12,
  },
  scriptText: {
    fontSize: 14,
    color: '#1f2937',
    fontStyle: 'italic',
  },
  questionSection: {
    marginBottom: 20,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: 24,
  },
  optionsSection: {
    gap: 12,
    marginBottom: 20,
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
  optionButtonCorrect: {
    borderColor: '#059669',
    backgroundColor: '#d1fae5',
  },
  optionButtonIncorrect: {
    borderColor: '#dc2626',
    backgroundColor: '#fee2e2',
  },
  optionKey: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginRight: 16,
    minWidth: 24,
  },
  optionValue: {
    fontSize: 16,
    color: '#1f2937',
    flex: 1,
  },
  correctBadge: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
  incorrectBadge: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600',
  },
  nextButtonContainer: {
    alignItems: 'center',
  },
  nextButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    minWidth: 160,
    alignItems: 'center',
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  scoreInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
  },
  currentScore: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  progressPercentage: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  resultContainer: {
    padding: 20,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
    textAlign: 'center',
    marginRight: 120,
  },
  scoreDisplay: {
    alignItems: 'center',
    marginBottom: 24,
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    borderColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    marginBottom: 12,
  },
  scoreNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  scoreTotal: {
    fontSize: 16,
    color: '#6b7280',
  },
  scorePercentage: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  resultStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  resultActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#6b7280',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  secondaryButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '500',
  },
  detailedResults: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  detailedResultsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  resultItem: {
    flexDirection: 'row',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  resultItemCorrect: {
    borderLeftColor: '#059669',
    backgroundColor: 'rgba(5, 150, 105, 0.05)',
  },
  resultItemIncorrect: {
    borderLeftColor: '#dc2626',
    backgroundColor: 'rgba(220, 38, 38, 0.05)',
  },
  resultIndex: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: '#3b82f6',
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
    marginRight: 12,
  },
  resultContent: {
    flex: 1,
    gap: 4,
  },
  resultTopic: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  resultQuestion: {
    fontSize: 14,
    color: '#4b5563',
  },
  resultScript: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  resultAnswer: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default ListeningScreen;