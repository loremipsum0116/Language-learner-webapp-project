import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Alert,
  Dimensions,
  BackHandler,
} from 'react-native';
import {useTheme} from '../context/ThemeContext';
import SwipeableVocabCard from './SwipeableVocabCard';
import VolumeControl from './VolumeControl';
import {useFocusEffect} from '@react-navigation/native';
import { useHapticFeedback } from '../services/HapticFeedbackService';

const {width: screenWidth} = Dimensions.get('window');

export interface StudyCard {
  id: string;
  vocab: any;
  card?: any;
  isStudied?: boolean;
  studyResult?: 'known' | 'unknown' | 'skipped';
  studiedAt?: Date;
}

export interface LearningSessionConfig {
  autoMode?: boolean;
  autoInterval?: number; // milliseconds
  shuffleCards?: boolean;
  showProgress?: boolean;
  enableAudio?: boolean;
  maxAudioPlays?: number;
  flipInterval?: number;
  enableSurpriseQuiz?: boolean;
  batchSize?: number;
}

interface SwipeLearningSessionProps {
  cards: StudyCard[];
  config: LearningSessionConfig;
  onComplete?: (results: StudyCard[]) => void;
  onCardStudied?: (card: StudyCard, result: 'known' | 'unknown' | 'skipped') => void;
  onProgress?: (currentIndex: number, totalCount: number, studiedCount: number) => void;
  onExit?: () => void;
}

export const SwipeLearningSession: React.FC<SwipeLearningSessionProps> = ({
  cards,
  config,
  onComplete,
  onCardStudied,
  onProgress,
  onExit,
}) => {
  const {colors} = useTheme();
  const { achievement, levelUp, correctStreak: hapticCorrectStreak, masterComplete, importantAction } = useHapticFeedback();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [studiedCards, setStudiedCards] = useState<StudyCard[]>([]);
  const [isFlipped, setIsFlipped] = useState(false);
  const [audioPlayCount, setAudioPlayCount] = useState(0);
  const [surpriseQuiz, setSurpriseQuiz] = useState({
    show: false,
    questions: [],
    currentQuestion: 0,
    answers: [],
  });

  // 자동 학습 모드 관련
  const [isAutoMode, setIsAutoMode] = useState(config.autoMode || false);
  const [isPaused, setIsPaused] = useState(false);
  const [correctStreak, setCorrectStreak] = useState(0);
  const autoTimer = useRef<NodeJS.Timeout>();
  const flipTimer = useRef<NodeJS.Timeout>();
  const audioRef = useRef<any>();

  // 카드 데크 애니메이션
  const nextCardScale = useRef(new Animated.Value(0.95)).current;
  const nextCardOpacity = useRef(new Animated.Value(0.5)).current;
  const progressAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 진행률 애니메이션
    Animated.timing(progressAnimation, {
      toValue: studiedCards.length / cards.length,
      duration: 300,
      useNativeDriver: false,
    }).start();

    // 진행상황 콜백 호출
    onProgress?.(currentIndex, cards.length, studiedCards.length);
  }, [currentIndex, studiedCards.length, cards.length]);

  useEffect(() => {
    // 자동 모드 타이머 설정
    if (isAutoMode && !isPaused && currentIndex < cards.length) {
      startAutoTimer();
    }
    return () => clearAutoTimer();
  }, [isAutoMode, isPaused, currentIndex, isFlipped]);

  useEffect(() => {
    // 카드 변경 시 뒤집기 초기화
    setIsFlipped(false);
    setAudioPlayCount(0);
    
    // 자동 뒤집기 타이머
    if (config.flipInterval) {
      flipTimer.current = setTimeout(() => {
        setIsFlipped(true);
      }, config.flipInterval);
    }

    return () => {
      if (flipTimer.current) {
        clearTimeout(flipTimer.current);
      }
    };
  }, [currentIndex]);

  // 뒤로가기 처리
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        handleExit();
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription?.remove();
    }, [])
  );

  const startAutoTimer = () => {
    clearAutoTimer();
    autoTimer.current = setTimeout(() => {
      if (!isFlipped) {
        // 먼저 카드 뒤집기
        setIsFlipped(true);
        // 뒤집은 후 다시 타이머 설정
        setTimeout(() => {
          if (isAutoMode && !isPaused) {
            goToNextCard('skipped');
          }
        }, config.autoInterval || 3000);
      } else {
        // 이미 뒤집혔으면 다음 카드로
        goToNextCard('skipped');
      }
    }, config.autoInterval || 3000);
  };

  const clearAutoTimer = () => {
    if (autoTimer.current) {
      clearTimeout(autoTimer.current);
      autoTimer.current = undefined;
    }
  };

  const getCurrentCard = (): StudyCard | null => {
    return cards[currentIndex] || null;
  };

  const getNextCard = (): StudyCard | null => {
    return cards[currentIndex + 1] || null;
  };

  const goToNextCard = (result: 'known' | 'unknown' | 'skipped' = 'skipped') => {
    const currentCard = getCurrentCard();
    if (!currentCard) return;

    // 현재 카드를 학습 완료로 표시
    const studiedCard: StudyCard = {
      ...currentCard,
      isStudied: true,
      studyResult: result,
      studiedAt: new Date(),
    };

    setStudiedCards(prev => [...prev, studiedCard]);
    onCardStudied?.(studiedCard, result);

    // 깜짝 퀴즈 체크 (10장마다)
    if (config.enableSurpriseQuiz && (studiedCards.length + 1) % 10 === 0) {
      triggerSurpriseQuiz();
      return;
    }

    // 다음 카드로 이동
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      
      // 다음 카드 애니메이션
      Animated.parallel([
        Animated.spring(nextCardScale, {
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(nextCardOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // 애니메이션 완료 후 초기화
        nextCardScale.setValue(0.95);
        nextCardOpacity.setValue(0.5);
      });
    } else {
      // 모든 카드 완료 - 성취 햅틱 피드백
      achievement();
      handleSessionComplete();
    }
  };

  const goToPreviousCard = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      
      // 이전 카드를 학습 목록에서 제거
      setStudiedCards(prev => prev.slice(0, -1));
    }
  };

  const triggerSurpriseQuiz = () => {
    // 깜짝 퀴즈 시작 - 중요한 액션 햅틱
    importantAction();
    
    // 최근 학습한 10장에서 3장 랜덤 선택
    const recentCards = studiedCards.slice(-10);
    const quizCards = recentCards
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);

    const questions = quizCards.map(card => ({
      vocab: card.vocab,
      options: generateQuizOptions(card.vocab),
      correctAnswer: card.vocab.dictMeta?.gloss || card.vocab.gloss,
    }));

    setSurpriseQuiz({
      show: true,
      questions,
      currentQuestion: 0,
      answers: [],
    });
  };

  const generateQuizOptions = (correctVocab: any) => {
    const correctAnswer = correctVocab.dictMeta?.gloss || correctVocab.gloss;
    const otherAnswers = cards
      .filter(card => card.vocab.id !== correctVocab.id)
      .map(card => card.vocab.dictMeta?.gloss || card.vocab.gloss)
      .filter(Boolean)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);

    return [correctAnswer, ...otherAnswers].sort(() => 0.5 - Math.random());
  };

  const handleQuizAnswer = (selectedAnswer: string, isCorrect: boolean) => {
    const newAnswers = [...surpriseQuiz.answers, {answer: selectedAnswer, correct: isCorrect}];
    
    if (surpriseQuiz.currentQuestion < surpriseQuiz.questions.length - 1) {
      setSurpriseQuiz(prev => ({
        ...prev,
        currentQuestion: prev.currentQuestion + 1,
        answers: newAnswers,
      }));
    } else {
      // 퀴즈 완료
      setSurpriseQuiz({show: false, questions: [], currentQuestion: 0, answers: []});
      
      const correctCount = newAnswers.filter(a => a.correct).length;
      Alert.alert(
        '깜짝 퀴즈 완료! 🎉',
        `${correctCount}/${newAnswers.length}개 정답입니다!`,
        [
          {
            text: '계속 학습',
            onPress: () => goToNextCard('skipped'),
          }
        ]
      );
    }
  };

  const handleSessionComplete = () => {
    clearAutoTimer();
    
    const results = [...studiedCards];
    const knownCount = results.filter(card => card.studyResult === 'known').length;
    const unknownCount = results.filter(card => card.studyResult === 'unknown').length;
    
    Alert.alert(
      '학습 완료! 🎊',
      `총 ${results.length}장 학습\n알고 있음: ${knownCount}장\n모르겠음: ${unknownCount}장`,
      [
        {
          text: '완료',
          onPress: () => onComplete?.(results),
        }
      ]
    );
  };

  const handleExit = () => {
    Alert.alert(
      '학습 종료',
      '정말로 학습을 종료하시겠습니까?\n현재까지의 진행상황이 저장됩니다.',
      [
        {
          text: '계속 학습',
          style: 'cancel',
        },
        {
          text: '종료',
          onPress: () => {
            clearAutoTimer();
            onExit?.();
          },
        }
      ]
    );
  };

  const toggleAutoMode = () => {
    setIsAutoMode(!isAutoMode);
    if (isAutoMode) {
      clearAutoTimer();
    }
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  const handleCardFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleSwipe = (direction: 'left' | 'right' | 'up' | 'down', vocab: any) => {
    switch (direction) {
      case 'left':
        goToPreviousCard();
        break;
      case 'right':
        setCorrectStreak(0); // 스킵 시 연속 정답 초기화
        goToNextCard('skipped');
        break;
      case 'up':
        // 연속 정답 증가 및 햅틱 피드백
        const newStreak = correctStreak + 1;
        setCorrectStreak(newStreak);
        hapticCorrectStreak(newStreak); // 햅틱 피드백 실행
        goToNextCard('known');
        break;
      case 'down':
        setCorrectStreak(0); // 오답 시 연속 정답 초기화
        goToNextCard('unknown');
        break;
    }
  };

  const currentCard = getCurrentCard();
  const nextCard = getNextCard();
  const progressPercent = (studiedCards.length / cards.length) * 100;

  if (!currentCard) {
    return (
      <View style={styles.container}>
        <Text style={styles.noCardsText}>학습할 카드가 없습니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                  backgroundColor: colors.primary,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {studiedCards.length} / {cards.length}
          </Text>
        </View>

        <View style={styles.headerControls}>
          <Text style={styles.autoModeText}>
            {isAutoMode ? (isPaused ? '⏸️ 일시정지' : '▶️ 자동모드') : '⏹️ 수동모드'}
          </Text>
        </View>
      </View>

      {/* 카드 덱 */}
      <View style={styles.cardDeck}>
        {/* 다음 카드 (뒤에) */}
        {nextCard && (
          <Animated.View
            style={[
              styles.nextCardContainer,
              {
                transform: [{scale: nextCardScale}],
                opacity: nextCardOpacity,
              },
            ]}
          >
            <SwipeableVocabCard
              vocab={nextCard.vocab}
              card={nextCard.card}
              showSwipeHints={false}
              style={styles.nextCard}
            />
          </Animated.View>
        )}

        {/* 현재 카드 (앞에) */}
        <View style={styles.currentCardContainer}>
          <SwipeableVocabCard
            vocab={currentCard.vocab}
            card={currentCard.card}
            isFlipped={isFlipped}
            onFlip={handleCardFlip}
            onSwipe={handleSwipe}
            showSwipeHints={currentIndex === 0} // 첫 카드에만 힌트 표시
          />
        </View>
      </View>

      {/* 하단 컨트롤 */}
      <View style={styles.bottomControls}>
        {config.enableAudio && (
          <View style={styles.audioControls}>
            <VolumeControl
              size="small"
              showHeadphoneStatus={false}
              showQuickActions={true}
            />
          </View>
        )}

        <View style={styles.sessionControls}>
          <Text style={styles.controlHint}>
            ← 이전  |  → 다음  |  ↑ 알고있음  |  ↓ 모르겠음
          </Text>
        </View>
      </View>

      {/* 깜짝 퀴즈 모달 */}
      {surpriseQuiz.show && (
        <View style={styles.quizModal}>
          <View style={styles.quizContainer}>
            <Text style={styles.quizTitle}>
              🎯 깜짝 퀴즈! ({surpriseQuiz.currentQuestion + 1}/{surpriseQuiz.questions.length})
            </Text>
            
            <Text style={styles.quizQuestion}>
              {surpriseQuiz.questions[surpriseQuiz.currentQuestion]?.vocab.lemma}
            </Text>
            
            <Text style={styles.quizPrompt}>이 단어의 뜻은?</Text>
            
            <View style={styles.quizOptions}>
              {surpriseQuiz.questions[surpriseQuiz.currentQuestion]?.options.map((option, index) => (
                <Text
                  key={index}
                  style={styles.quizOption}
                  onPress={() => {
                    const isCorrect = option === surpriseQuiz.questions[surpriseQuiz.currentQuestion].correctAnswer;
                    handleQuizAnswer(option, isCorrect);
                  }}
                >
                  {option}
                </Text>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginRight: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    minWidth: 50,
  },
  headerControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  autoModeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  cardDeck: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  nextCardContainer: {
    position: 'absolute',
    width: screenWidth - 40,
    zIndex: 1,
  },
  nextCard: {
    opacity: 0.6,
  },
  currentCardContainer: {
    zIndex: 2,
  },
  bottomControls: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    backgroundColor: '#fff',
  },
  audioControls: {
    marginBottom: 16,
  },
  sessionControls: {
    alignItems: 'center',
  },
  controlHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  noCardsText: {
    fontSize: 18,
    textAlign: 'center',
    color: '#666',
    marginTop: 100,
  },
  // 퀴즈 모달 스타일
  quizModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  quizContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    width: screenWidth - 40,
  },
  quizTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#333',
  },
  quizQuestion: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#000',
  },
  quizPrompt: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  quizOptions: {
    gap: 12,
  },
  quizOption: {
    fontSize: 16,
    padding: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    textAlign: 'center',
    color: '#333',
  },
});

export default SwipeLearningSession;