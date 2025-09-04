/*
  ListeningPracticeScreen.tsx — React Native 버전
  ------------------------------------------------------------
  웹 ListeningPractice.jsx를 모바일 앱에 맞게 리팩토링
*/

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { apiClient } from '../services/apiClient';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ListeningPractice'>;

const { width } = Dimensions.get('window');

interface ListeningQuestion {
  id: string;
  question: string;
  topic?: string;
  script?: string;
  options: Record<string, string>;
  correctAnswer?: string;
  answer?: string;
  explanation?: string;
}

interface QuestionHistory {
  questionId: string;
  isCorrect: boolean;
  solvedAt: string;
  isCompleted: boolean;
  attempts: number;
  wrongData?: {
    isCorrect?: boolean;
    recordedAt?: string;
  };
}

interface AudioPlayerProps {
  audioUri: string;
  isPlaying: boolean;
  playbackRate: number;
  onPlayPress: () => void;
  onRateChange: (rate: number) => void;
  disabled?: boolean;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUri,
  isPlaying,
  playbackRate,
  onPlayPress,
  onRateChange,
  disabled = false,
}) => (
  <View style={styles.audioPlayer}>
    <TouchableOpacity
      style={[
        styles.playButton,
        isPlaying && styles.playButtonActive,
        disabled && styles.playButtonDisabled,
      ]}
      onPress={onPlayPress}
      disabled={disabled || isPlaying}
      activeOpacity={0.7}
    >
      <Ionicons 
        name={isPlaying ? "volume-high" : "play"} 
        size={24} 
        color={isPlaying ? "#666" : "#007AFF"} 
      />
      <Text style={[
        styles.playButtonText,
        isPlaying && styles.playButtonTextActive,
        disabled && styles.playButtonTextDisabled,
      ]}>
        {isPlaying ? '재생중...' : '오디오 재생'}
      </Text>
    </TouchableOpacity>
    
    <View style={styles.speedControls}>
      <Text style={styles.speedLabel}>속도:</Text>
      <View style={styles.speedButtons}>
        {[0.75, 1.0, 1.25].map((rate) => (
          <TouchableOpacity
            key={rate}
            style={[
              styles.speedButton,
              playbackRate === rate && styles.speedButtonActive
            ]}
            onPress={() => onRateChange(rate)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.speedButtonText,
              playbackRate === rate && styles.speedButtonTextActive
            ]}>
              {rate}×
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  </View>
);

interface OptionButtonProps {
  optionKey: string;
  optionValue: string;
  isSelected: boolean;
  isCorrect?: boolean;
  isIncorrect?: boolean;
  showExplanation: boolean;
  onPress: (key: string) => void;
}

const OptionButton: React.FC<OptionButtonProps> = ({
  optionKey,
  optionValue,
  isSelected,
  isCorrect,
  isIncorrect,
  showExplanation,
  onPress,
}) => (
  <TouchableOpacity
    style={[
      styles.optionButton,
      isSelected && !showExplanation && styles.optionButtonSelected,
      showExplanation && isCorrect && styles.optionButtonCorrect,
      showExplanation && isIncorrect && styles.optionButtonIncorrect,
    ]}
    onPress={() => onPress(optionKey)}
    disabled={showExplanation}
    activeOpacity={0.7}
  >
    <View style={styles.optionContent}>
      <View style={[
        styles.optionKey,
        isSelected && !showExplanation && styles.optionKeySelected,
        showExplanation && isCorrect && styles.optionKeyCorrect,
        showExplanation && isIncorrect && styles.optionKeyIncorrect,
      ]}>
        <Text style={[
          styles.optionKeyText,
          isSelected && !showExplanation && styles.optionKeyTextSelected,
          showExplanation && (isCorrect || isIncorrect) && styles.optionKeyTextWhite,
        ]}>
          {optionKey}
        </Text>
      </View>
      <Text style={[
        styles.optionText,
        showExplanation && isCorrect && styles.optionTextCorrect,
        showExplanation && isIncorrect && styles.optionTextIncorrect,
      ]}>
        {optionValue}
      </Text>
    </View>
  </TouchableOpacity>
);

export default function ListeningPracticeScreen({ route, navigation }: Props) {
  const { 
    level = 'A1', 
    start, 
    questions 
  } = route.params || {};
  
  const startIndex = start ? parseInt(start) : 0;
  const selectedQuestions = questions ? questions.split(',').map(Number) : null;
  
  const [listeningData, setListeningData] = useState<ListeningQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(startIndex);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [completedQuestions, setCompletedQuestions] = useState(new Set<number>());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Audio related states
  const [sound, setSound] = useState<Audio.Sound>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showScript, setShowScript] = useState(false);
  
  // History state
  const [history, setHistory] = useState(new Map<string, QuestionHistory>());

  const loadListeningData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 번들된 JSON 파일에서 로드하거나 API에서 가져오기
      const response = await fetch(`/${level}/${level}_Listening/${level}_Listening.json`);
      
      if (!response.ok) {
        throw new Error(`Failed to load ${level} listening data`);
      }
      
      const result = await response.json();
      
      console.log('🔍 [DATA LOAD DEBUG] First question from JSON:', result[0]);
      console.log('🔍 [DATA LOAD DEBUG] Keys in first question:', result[0] ? Object.keys(result[0]) : 'No first question');
      
      if (result && Array.isArray(result) && result.length > 0) {
        // 선택된 문제들만 필터링
        if (selectedQuestions && selectedQuestions.length > 0) {
          const filteredData = selectedQuestions.map(index => result[index]).filter(Boolean);
          setListeningData(filteredData);
          setCurrentQuestion(0);
        } else if (!selectedQuestions && startIndex >= 0 && start) {
          // 단일 문제 모드
          const singleQuestion = result[startIndex];
          if (singleQuestion) {
            setListeningData([singleQuestion]);
            setCurrentQuestion(0);
          } else {
            setListeningData([]);
            setError('해당 문제를 찾을 수 없습니다.');
          }
        } else {
          // 전체 데이터 로드
          setListeningData(result);
          setCurrentQuestion(startIndex);
        }
      } else {
        setListeningData([]);
        setError(`${level} 레벨 리스닝 데이터가 없습니다.`);
      }
      
      // 상태 초기화
      setSelectedAnswer(null);
      setShowExplanation(false);
      setIsCorrect(false);
      setScore(0);
      setCompletedQuestions(new Set());
    } catch (err: any) {
      console.error('Failed to load listening data:', err);
      setError('리스닝 데이터를 불러오는데 실패했습니다.');
      setListeningData([]);
    } finally {
      setLoading(false);
    }
  }, [level, startIndex, selectedQuestions, start]);

  const loadHistory = useCallback(async () => {
    try {
      const response = await apiClient.get(`/listening/history/${level}`);
      
      const historyMap = new Map<string, QuestionHistory>();
      
      if (response.data) {
        Object.entries(response.data).forEach(([questionId, record]: [string, any]) => {
          const isCorrect = record.wrongData?.isCorrect || record.isCompleted;
          
          historyMap.set(String(questionId), {
            questionId,
            isCorrect,
            solvedAt: record.wrongData?.recordedAt || '',
            isCompleted: record.isCompleted || false,
            attempts: record.attempts || 1,
            wrongData: record.wrongData
          });
        });
      }
      
      setHistory(historyMap);
    } catch (error: any) {
      if (error.response?.status !== 401) {
        console.error('Failed to load history:', error);
      }
      setHistory(new Map());
    }
  }, [level]);

  useEffect(() => {
    loadListeningData();
    loadHistory();
  }, [loadListeningData, loadHistory]);

  // Audio cleanup on unmount
  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  const playAudio = async () => {
    try {
      const current = listeningData[currentQuestion];
      if (!current || !current.id) return;

      // 기존 사운드 정리
      if (sound) {
        await sound.unloadAsync();
      }

      const audioPath = `/${level}/${level}_Listening/${level}_Listening_mix/${current.id}.mp3`;
      
      console.log('🎵 Attempting to play audio:', audioPath);
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioPath },
        { 
          shouldPlay: true, 
          rate: playbackRate,
          pitchCorrectionQuality: Audio.PitchCorrectionQuality.High,
        }
      );

      setSound(newSound);
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (status.isLoaded) {
          if (status.didJustFinish) {
            setIsPlaying(false);
          }
        } else if (status.error) {
          console.error('Audio playback error:', status.error);
          setIsPlaying(false);
          Alert.alert('오류', `오디오 재생에 실패했습니다: ${status.error}`);
        }
      });

      console.log('🎵 Audio started playing successfully');
    } catch (error: any) {
      console.error('❌ Audio play failed:', error);
      setIsPlaying(false);
      Alert.alert('오류', `오디오 재생에 실패했습니다: ${error.message}`);
    }
  };

  const changePlaybackRate = async (rate: number) => {
    setPlaybackRate(rate);
    if (sound) {
      await sound.setRateAsync(rate, true);
    }
  };

  const toggleScript = () => {
    setShowScript(!showScript);
  };

  const handleAnswerSelect = (option: string) => {
    if (showExplanation) return;
    setSelectedAnswer(option);
  };

  const handleSubmit = async () => {
    if (!selectedAnswer || isSubmitting) return;
    
    setIsSubmitting(true);
    const current = listeningData[currentQuestion];
    
    console.log('🔍 [SUBMIT DEBUG] Current Question Data:', current);
    
    const correctAnswer = current.correctAnswer || current.answer;
    const correct = String(selectedAnswer).trim() === String(correctAnswer).trim();
    setIsCorrect(correct);
    
    console.log('Debug - Selected Answer:', selectedAnswer, 'Correct Answer:', correctAnswer, 'Result:', correct);
    
    // 정답/오답 기록 저장
    const requestData = {
      questionId: current.id,
      level: level,
      isCorrect: correct,
      userAnswer: selectedAnswer,
      correctAnswer: correctAnswer,
      question: current.question,
      script: current.script,
      topic: current.topic,
      options: current.options,
      explanation: current.explanation
    };
    
    try {
      const response = await apiClient.post('/listening/record', requestData);
      
      console.log(`✅ [리스닝 기록 저장 완료] ${level} - Question ${current.id} - ${correct ? '정답' : '오답'}`);
      
      // UI 상태 즉시 업데이트
      setHistory(prev => {
        const newHistory = new Map(prev);
        newHistory.set(String(current.id), {
          questionId: current.id,
          isCorrect: correct,
          solvedAt: new Date().toISOString(),
          isCompleted: correct,
          attempts: 1
        });
        return newHistory;
      });
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log('📝 [비로그인 사용자] 리스닝 기록은 로그인 후 저장됩니다.');
      } else {
        console.error('❌ 리스닝 기록 저장 실패:', error);
      }
    }

    if (correct && !completedQuestions.has(currentQuestion)) {
      setScore(score + 1);
      setCompletedQuestions(prev => new Set([...prev, currentQuestion]));
      console.log(`✅ [리스닝 정답] ${level} - 문제 ${currentQuestion + 1} - 정답: ${correctAnswer}`);
    }
    
    setIsSubmitting(false);
    setShowExplanation(true);
  };

  const handleNext = async () => {
    if (currentQuestion < listeningData.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setIsCorrect(false);
      setShowScript(false);
      setIsSubmitting(false);
      
      // 오디오 정리
      if (sound) {
        await sound.unloadAsync();
        setIsPlaying(false);
        setSound(undefined);
      }
    }
  };

  const handlePrevious = async () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setIsCorrect(false);
      setShowScript(false);
      setIsSubmitting(false);
      
      // 오디오 정리
      if (sound) {
        await sound.unloadAsync();
        setIsPlaying(false);
        setSound(undefined);
      }
    }
  };

  const handleRestart = async () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setIsCorrect(false);
    setScore(0);
    setCompletedQuestions(new Set());
    setShowScript(false);
    
    // 오디오 정리
    if (sound) {
      await sound.unloadAsync();
      setIsPlaying(false);
      setSound(undefined);
    }
  };

  const getQuestionStatus = (questionId: string): 'unsolved' | 'correct' | 'incorrect' => {
    const record = history.get(String(questionId));
    if (!record) return 'unsolved';
    
    const isCorrect = record.isCorrect || record.wrongData?.isCorrect || record.isCompleted;
    return isCorrect ? 'correct' : 'incorrect';
  };

  if (loading) {
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
          <Ionicons name="headset" size={64} color="#666" />
          <Text style={styles.errorTitle}>리스닝 연습</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <Text style={styles.errorSubMessage}>현재 A1 레벨만 이용 가능합니다.</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.retryButtonText}>뒤로 가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (listeningData.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="musical-notes" size={64} color="#666" />
          <Text style={styles.errorTitle}>🎧 {level} 리스닝 연습</Text>
          <Text style={styles.errorMessage}>리스닝 문제가 없습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const current = listeningData[currentQuestion];
  const progress = ((currentQuestion + 1) / listeningData.length) * 100;
  const correctAnswer = current.correctAnswer || current.answer;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>🎧 {level} 리스닝 연습</Text>
          {/* Question Status */}
          {getQuestionStatus(current.id) !== 'unsolved' && (
            <View style={[
              styles.statusBadge,
              getQuestionStatus(current.id) === 'correct' ? styles.statusBadgeCorrect : styles.statusBadgeIncorrect
            ]}>
              <Text style={styles.statusBadgeText}>
                {getQuestionStatus(current.id) === 'correct' ? '✅ 해결됨' : '❌ 오답'}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.headerRight}>
          <Text style={styles.questionCounter}>
            {currentQuestion + 1}/{listeningData.length}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.scoreText}>
          점수: {score} / {listeningData.length}
        </Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Audio Section */}
        <View style={styles.audioSection}>
          <Text style={styles.sectionTitle}>🎵 오디오</Text>
          
          <AudioPlayer
            audioUri={`/${level}/${level}_Listening/${level}_Listening_mix/${current.id}.mp3`}
            isPlaying={isPlaying}
            playbackRate={playbackRate}
            onPlayPress={playAudio}
            onRateChange={changePlaybackRate}
            disabled={isSubmitting}
          />
          
          {current.topic && (
            <Text style={styles.audioTopic}>주제: {current.topic}</Text>
          )}
          
          {/* Script Toggle */}
          <TouchableOpacity
            style={[styles.scriptToggle, showScript && styles.scriptToggleActive]}
            onPress={toggleScript}
            activeOpacity={0.7}
          >
            <Ionicons name="document-text" size={20} color={showScript ? "white" : "#007AFF"} />
            <Text style={[
              styles.scriptToggleText,
              showScript && styles.scriptToggleTextActive
            ]}>
              📝 스크립트 {showScript ? '숨기기' : '보기'}
            </Text>
          </TouchableOpacity>
          
          {/* Script Content */}
          {showScript && current.script && (
            <View style={styles.scriptContainer}>
              <Text style={styles.scriptTitle}>📝 스크립트:</Text>
              <Text style={styles.scriptText}>{current.script}</Text>
            </View>
          )}
        </View>

        {/* Question Section */}
        <View style={styles.questionSection}>
          <Text style={styles.sectionTitle}>❓ 문제</Text>
          <Text style={styles.questionText}>{current.question}</Text>
          
          {/* Options */}
          <View style={styles.optionsContainer}>
            {Object.entries(current.options).map(([key, value]) => (
              <OptionButton
                key={key}
                optionKey={key}
                optionValue={value}
                isSelected={selectedAnswer === key}
                isCorrect={showExplanation && key === correctAnswer}
                isIncorrect={showExplanation && selectedAnswer === key && key !== correctAnswer}
                showExplanation={showExplanation}
                onPress={handleAnswerSelect}
              />
            ))}
          </View>
          
          {/* Explanation */}
          {showExplanation && (
            <View style={[
              styles.explanationBox,
              isCorrect ? styles.explanationBoxCorrect : styles.explanationBoxIncorrect
            ]}>
              <View style={styles.explanationHeader}>
                <Text style={[
                  styles.resultIcon,
                  isCorrect ? styles.resultIconCorrect : styles.resultIconIncorrect
                ]}>
                  {isCorrect ? '✅ 정답!' : '❌ 틀렸습니다'}
                </Text>
                <Text style={styles.correctAnswerText}>
                  정답: {correctAnswer}
                </Text>
              </View>
              {current.explanation && (
                <Text style={styles.explanationText}>{current.explanation}</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        <View style={styles.navigationButtons}>
          <TouchableOpacity
            style={[styles.navButton, currentQuestion === 0 && styles.navButtonDisabled]}
            onPress={handlePrevious}
            disabled={currentQuestion === 0}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color={currentQuestion === 0 ? "#ccc" : "#666"} />
            <Text style={[
              styles.navButtonText,
              currentQuestion === 0 && styles.navButtonTextDisabled
            ]}>
              이전
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.navButton, currentQuestion === listeningData.length - 1 && styles.navButtonDisabled]}
            onPress={handleNext}
            disabled={currentQuestion === listeningData.length - 1}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.navButtonText,
              currentQuestion === listeningData.length - 1 && styles.navButtonTextDisabled
            ]}>
              다음
            </Text>
            <Ionicons name="chevron-forward" size={20} color={currentQuestion === listeningData.length - 1 ? "#ccc" : "#666"} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.actionButtons}>
          {!showExplanation ? (
            <TouchableOpacity
              style={[
                styles.submitButton,
                !selectedAnswer && styles.submitButtonDisabled
              ]}
              onPress={handleSubmit}
              disabled={!selectedAnswer || isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.submitButtonText}>정답 확인</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.nextButton}
              onPress={currentQuestion === listeningData.length - 1 ? handleRestart : handleNext}
              activeOpacity={0.8}
            >
              <Text style={styles.nextButtonText}>
                {currentQuestion === listeningData.length - 1 ? '다시 시작' : '다음 문제'}
              </Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={styles.restartButton}
            onPress={handleRestart}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={16} color="#f59e0b" />
            <Text style={styles.restartButtonText}>처음부터</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Final Results */}
      {currentQuestion === listeningData.length - 1 && showExplanation && (
        <View style={styles.resultsOverlay}>
          <View style={styles.resultsModal}>
            <Text style={styles.resultsTitle}>🎉 완료!</Text>
            <Text style={styles.resultsScore}>
              총 점수: {score} / {listeningData.length} 
              ({Math.round((score / listeningData.length) * 100)}%)
            </Text>
            <Text style={styles.performanceMessage}>
              {score === listeningData.length 
                ? "완벽합니다! 🌟" 
                : score >= listeningData.length * 0.8 
                  ? "훌륭해요! 👏" 
                  : score >= listeningData.length * 0.6 
                    ? "잘했어요! 👍" 
                    : "더 연습해보세요! 💪"
              }
            </Text>
            <View style={styles.resultsButtons}>
              <TouchableOpacity
                style={styles.resultButton}
                onPress={handleRestart}
                activeOpacity={0.8}
              >
                <Text style={styles.resultButtonText}>다시 시작</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.resultButton, styles.resultButtonSecondary]}
                onPress={() => navigation.goBack()}
                activeOpacity={0.8}
              >
                <Text style={[styles.resultButtonText, styles.resultButtonTextSecondary]}>
                  목록으로
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
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
  headerRight: {
    alignItems: 'flex-end',
  },
  questionCounter: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e9ecef',
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 3,
  },
  scoreText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  audioSection: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  audioPlayer: {
    marginBottom: 16,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderColor: '#007AFF',
    borderWidth: 2,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  playButtonActive: {
    backgroundColor: '#f8f9fa',
    borderColor: '#666',
  },
  playButtonDisabled: {
    borderColor: '#ccc',
  },
  playButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  playButtonTextActive: {
    color: '#666',
  },
  playButtonTextDisabled: {
    color: '#ccc',
  },
  speedControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 12,
  },
  speedButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  speedButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  speedButtonActive: {
    backgroundColor: '#007AFF',
  },
  speedButtonText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  speedButtonTextActive: {
    color: 'white',
  },
  audioTopic: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  scriptToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    marginTop: 12,
  },
  scriptToggleActive: {
    backgroundColor: '#007AFF',
  },
  scriptToggleText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  scriptToggleTextActive: {
    color: 'white',
  },
  scriptContainer: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  scriptTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  scriptText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  questionSection: {
    backgroundColor: 'white',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  questionText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
    lineHeight: 24,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e9ecef',
    backgroundColor: 'white',
  },
  optionButtonSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f9ff',
  },
  optionButtonCorrect: {
    borderColor: '#10b981',
    backgroundColor: '#ecfdf5',
  },
  optionButtonIncorrect: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  optionKey: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionKeySelected: {
    backgroundColor: '#007AFF',
  },
  optionKeyCorrect: {
    backgroundColor: '#10b981',
  },
  optionKeyIncorrect: {
    backgroundColor: '#ef4444',
  },
  optionKeyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  optionKeyTextSelected: {
    color: 'white',
  },
  optionKeyTextWhite: {
    color: 'white',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  optionTextCorrect: {
    color: '#059669',
  },
  optionTextIncorrect: {
    color: '#dc2626',
  },
  explanationBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 8,
  },
  explanationBoxCorrect: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
    borderWidth: 1,
  },
  explanationBoxIncorrect: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
    borderWidth: 1,
  },
  explanationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultIcon: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultIconCorrect: {
    color: '#059669',
  },
  resultIconIncorrect: {
    color: '#dc2626',
  },
  correctAnswerText: {
    fontSize: 14,
    color: '#666',
  },
  explanationText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  bottomControls: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 16,
    color: '#666',
  },
  navButtonTextDisabled: {
    color: '#ccc',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#28a745',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  restartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  restartButtonText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  resultsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 32,
    alignItems: 'center',
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  resultsScore: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  performanceMessage: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
    marginBottom: 24,
    textAlign: 'center',
  },
  resultsButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  resultButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  resultButtonSecondary: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  resultButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resultButtonTextSecondary: {
    color: '#007AFF',
  },
});