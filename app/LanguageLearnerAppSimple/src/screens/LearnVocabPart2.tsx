// LearnVocabPart2.tsx - Component hooks and handlers
import { useState, useEffect, useRef, useReducer, useMemo } from 'react';
import { BackHandler, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { apiClient } from '../services/apiClient';
import { useAuth } from '../hooks/useAuth';
import { 
  VocabCard, 
  StudySession, 
  SurpriseQuiz,
  playSound,
  generateQuizOptions,
  calculateProgress,
  getNextReviewDate,
  BATCH_SIZE,
  QUIZ_TYPES,
  STUDY_MODES
} from './LearnVocabPart1';

// ===== REDUCER =====
interface SessionState {
  mode: string;
  cards: VocabCard[];
  currentIndex: number;
  completed: number[];
  incorrect: number[];
  isFlipped: boolean;
  showDetail: boolean;
  quizAnswer: string;
  showQuizResult: boolean;
}

type SessionAction = 
  | { type: 'INIT_SESSION'; payload: Partial<SessionState> }
  | { type: 'NEXT_CARD' }
  | { type: 'PREV_CARD' }
  | { type: 'FLIP_CARD' }
  | { type: 'TOGGLE_DETAIL' }
  | { type: 'MARK_CORRECT'; cardId: number }
  | { type: 'MARK_INCORRECT'; cardId: number }
  | { type: 'SET_QUIZ_ANSWER'; answer: string }
  | { type: 'SHOW_QUIZ_RESULT'; show: boolean }
  | { type: 'RESET_SESSION' };

const sessionReducer = (state: SessionState, action: SessionAction): SessionState => {
  switch (action.type) {
    case 'INIT_SESSION':
      return { ...state, ...action.payload };
      
    case 'NEXT_CARD':
      if (state.currentIndex < state.cards.length - 1) {
        return {
          ...state,
          currentIndex: state.currentIndex + 1,
          isFlipped: false,
          showDetail: false,
          quizAnswer: '',
          showQuizResult: false
        };
      }
      return state;
      
    case 'PREV_CARD':
      if (state.currentIndex > 0) {
        return {
          ...state,
          currentIndex: state.currentIndex - 1,
          isFlipped: false,
          showDetail: false
        };
      }
      return state;
      
    case 'FLIP_CARD':
      return { ...state, isFlipped: !state.isFlipped };
      
    case 'TOGGLE_DETAIL':
      return { ...state, showDetail: !state.showDetail };
      
    case 'MARK_CORRECT':
      return {
        ...state,
        completed: [...state.completed, action.cardId],
        incorrect: state.incorrect.filter(id => id !== action.cardId)
      };
      
    case 'MARK_INCORRECT':
      if (!state.incorrect.includes(action.cardId)) {
        return {
          ...state,
          incorrect: [...state.incorrect, action.cardId]
        };
      }
      return state;
      
    case 'SET_QUIZ_ANSWER':
      return { ...state, quizAnswer: action.answer };
      
    case 'SHOW_QUIZ_RESULT':
      return { ...state, showQuizResult: action.show };
      
    case 'RESET_SESSION':
      return {
        mode: STUDY_MODES.LEARN,
        cards: [],
        currentIndex: 0,
        completed: [],
        incorrect: [],
        isFlipped: false,
        showDetail: false,
        quizAnswer: '',
        showQuizResult: false
      };
      
    default:
      return state;
  }
};

// ===== CUSTOM HOOKS =====
export const useLearnVocab = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { user } = useAuth();
  
  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [surpriseQuiz, setSurpriseQuiz] = useState<SurpriseQuiz>({
    show: false,
    questions: [],
    currentQ: 0,
    selectedAnswer: null,
    showFeedback: false,
    answers: []
  });
  
  // Session state using reducer
  const [session, dispatch] = useReducer(sessionReducer, {
    mode: route.params?.mode || STUDY_MODES.LEARN,
    cards: [],
    currentIndex: 0,
    completed: [],
    incorrect: [],
    isFlipped: false,
    showDetail: false,
    quizAnswer: '',
    showQuizResult: false
  });
  
  // Refs
  const audioRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const playCountRef = useRef<Record<number, number>>({});
  
  // Load cards
  useEffect(() => {
    loadCards();
    
    // Handle back button
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    
    return () => {
      backHandler.remove();
      if (timerRef.current) clearTimeout(timerRef.current);
      if (audioRef.current) audioRef.current.unloadAsync();
    };
  }, [route.params]);
  
  const loadCards = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let cards: VocabCard[] = [];
      
      if (route.params?.initialQueue) {
        cards = route.params.initialQueue;
      } else if (route.params?.folderId) {
        const response = await apiClient.get(`/vocab/folder/${route.params.folderId}`);
        cards = response.data.cards || [];
      } else {
        const response = await apiClient.get('/vocab/review');
        cards = response.data.cards || [];
      }
      
      dispatch({
        type: 'INIT_SESSION',
        payload: {
          cards,
          mode: route.params?.mode || STUDY_MODES.LEARN
        }
      });
      
    } catch (err: any) {
      setError(err.message || '카드를 불러오는데 실패했습니다');
      Alert.alert('오류', '카드를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };
  
  const handleBack = () => {
    Alert.alert(
      '학습 종료',
      '학습을 종료하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        { 
          text: '종료', 
          onPress: () => navigation.goBack(),
          style: 'destructive'
        }
      ]
    );
  };
  
  const handleCardAction = (action: 'correct' | 'incorrect' | 'next' | 'prev') => {
    const currentCard = session.cards[session.currentIndex];
    if (!currentCard) return;
    
    switch (action) {
      case 'correct':
        dispatch({ type: 'MARK_CORRECT', cardId: currentCard.id });
        updateCardStatus(currentCard.id, true);
        break;
        
      case 'incorrect':
        dispatch({ type: 'MARK_INCORRECT', cardId: currentCard.id });
        updateCardStatus(currentCard.id, false);
        break;
        
      case 'next':
        dispatch({ type: 'NEXT_CARD' });
        break;
        
      case 'prev':
        dispatch({ type: 'PREV_CARD' });
        break;
    }
    
    // Check for surprise quiz
    if (session.completed.length > 0 && session.completed.length % 5 === 0) {
      triggerSurpriseQuiz();
    }
  };
  
  const updateCardStatus = async (cardId: number, isCorrect: boolean) => {
    try {
      await apiClient.post(`/vocab/card/${cardId}/review`, {
        isCorrect,
        reviewDate: new Date()
      });
    } catch (err) {
      console.error('Failed to update card status:', err);
    }
  };
  
  const triggerSurpriseQuiz = () => {
    const recentCards = session.cards.slice(
      Math.max(0, session.currentIndex - 5),
      session.currentIndex + 1
    );
    
    const questions = recentCards.map(card => ({
      question: card.word,
      correctAnswer: card.meaning,
      options: generateQuizOptions(
        card.meaning,
        session.cards.map(c => c.meaning),
        4
      )
    }));
    
    setSurpriseQuiz({
      show: true,
      questions,
      currentQ: 0,
      selectedAnswer: null,
      showFeedback: false,
      answers: []
    });
  };
  
  const handleQuizAnswer = (answer: string) => {
    const currentQuestion = surpriseQuiz.questions[surpriseQuiz.currentQ];
    const isCorrect = answer === currentQuestion.correctAnswer;
    
    setSurpriseQuiz(prev => ({
      ...prev,
      selectedAnswer: answer,
      showFeedback: true,
      answers: [...prev.answers, {
        question: currentQuestion.question,
        selected: answer,
        correct: currentQuestion.correctAnswer,
        isCorrect
      }]
    }));
    
    setTimeout(() => {
      if (surpriseQuiz.currentQ < surpriseQuiz.questions.length - 1) {
        setSurpriseQuiz(prev => ({
          ...prev,
          currentQ: prev.currentQ + 1,
          selectedAnswer: null,
          showFeedback: false
        }));
      } else {
        // Quiz complete
        setSurpriseQuiz(prev => ({ ...prev, show: false }));
        showQuizResults();
      }
    }, 1500);
  };
  
  const showQuizResults = () => {
    const correct = surpriseQuiz.answers.filter(a => a.isCorrect).length;
    const total = surpriseQuiz.answers.length;
    
    Alert.alert(
      '퀴즈 완료!',
      `${total}문제 중 ${correct}개 정답\n정답률: ${Math.round((correct/total) * 100)}%`,
      [{ text: '확인' }]
    );
  };
  
  const handlePlayAudio = async (audioUrl?: string, cardId?: number) => {
    if (!audioUrl || !cardId) return;
    
    const playCount = playCountRef.current[cardId] || 0;
    if (playCount >= 3) {
      Alert.alert('알림', '음성은 카드당 3번까지만 재생할 수 있습니다');
      return;
    }
    
    await playSound(audioUrl);
    playCountRef.current[cardId] = playCount + 1;
  };
  
  return {
    // State
    session,
    loading,
    error,
    surpriseQuiz,
    
    // Actions
    dispatch,
    handleCardAction,
    handleQuizAnswer,
    handlePlayAudio,
    handleBack,
    setSurpriseQuiz,
    
    // Computed
    progress: calculateProgress(session.completed.length, session.cards.length),
    currentCard: session.cards[session.currentIndex] || null
  };
};