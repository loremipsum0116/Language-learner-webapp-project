/*
  LearnVocabScreen.tsx — React Native 버전
  ------------------------------------------------------------
  웹 LearnVocab.jsx를 모바일 앱에 맞게 리팩토링
  Part 1/3: 헬퍼 함수들과 메인 컴포넌트 초기 설정
*/

import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  BackHandler,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import _ from 'lodash';

import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../services/apiClient';
import { StudyStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<StudyStackParamList, 'LearnVocab'>;

const { width, height } = Dimensions.get('window');

// ───────────────────── 헬퍼 함수들 ─────────────────────
const safeFileName = (s: string | undefined | null): string => 
  encodeURIComponent(String(s ?? ''));

// CEFR 레벨을 실제 폴더명으로 매핑
const cefrToFolder: { [key: string]: string } = {
  'A1': 'starter',
  'A2': 'elementary',
  'B1': 'intermediate',
  'B2': 'upper',
  'C1': 'advanced',
  'C2': 'advanced'
};

// 현재 cefr_vocabs.json 오디오 경로 생성
const getCurrentAudioPath = (vocab: any, isGlossMode = false): string => {
  console.log('[AUDIO DEBUG] getCurrentAudioPath called with vocab.pos:', vocab.pos, 'vocab.source:', vocab.source, 'vocab.levelCEFR:', vocab.levelCEFR, 'isGlossMode:', isGlossMode);

  // 1. vocab.vocab.dictentry.audioLocal 데이터 우선 사용
  const audioData = vocab.vocab?.dictentry?.audioLocal ? JSON.parse(vocab.vocab.dictentry.audioLocal) : null;
  const audioPath = isGlossMode ? audioData?.gloss : audioData?.example;

  if (audioPath) {
    console.log('[AUDIO DEBUG] Using audioLocal path:', audioPath);
    // 절대 경로로 변환
    return audioPath.startsWith('/') ? audioPath : `/${audioPath}`;
  }

  // 2. 숙어/구동사인 경우 idiom/phrasal_verb 폴더 사용
  if (vocab.source === 'idiom_migration' || vocab.pos === 'idiom') {
    console.log('[AUDIO DEBUG] Detected idiom, processing...');
    const lemma = vocab.lemma || vocab.question;
    if (lemma) {
      const cleanLemma = lemma.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_').replace(/'/g, '');
      
      // category 또는 알려진 phrasal verb로 폴더 결정
      const knownPhrasalVerbs = [
        'ask around', 'ask around for', 'ask out', 'ask for', 'ask in', 'ask over', 'ask after',
        'work through', 'work out', 'work up', 'work on', 'work off', 'break down', 'break up', 
        'break out', 'break in', 'break away', 'break through', 'come up', 'come down', 'come out',
        'go through', 'go out', 'go up', 'go down', 'put up', 'put down', 'put off', 'put on',
        'get up', 'get down', 'get out', 'get through', 'turn on', 'turn off', 'turn up', 'turn down'
      ];
      
      const isPhrasalVerb = vocab.source === 'phrasal_verb_migration' || 
                           (vocab.category && vocab.category.includes('구동사')) ||
                           knownPhrasalVerbs.includes(lemma.toLowerCase());
      
      const folderName = isPhrasalVerb ? 'phrasal_verb' : 'idiom';
      
      if (isGlossMode) {
        const path = `/${folderName}/${cleanLemma}_gloss.mp3`;
        console.log('[AUDIO DEBUG] Using idiom/phrasal gloss path:', path);
        return path;
      } else {
        const path = `/${folderName}/${cleanLemma}_example.mp3`;
        console.log('[AUDIO DEBUG] Using idiom/phrasal example path:', path);
        return path;
      }
    }
  }

  // 3. 폴백: 레거시 방식
  console.log('[AUDIO DEBUG] Using legacy path');
  const folderName = cefrToFolder[vocab.levelCEFR] || 'starter';
  const audioType = isGlossMode ? 'gloss' : 'example';
  return `/${folderName}/${safeFileName(vocab.question)}/${audioType}.mp3`;
};

const getPosBadgeColor = (pos: string | undefined): string => {
  switch ((pos || '').toLowerCase()) {
    case 'noun': return '#007AFF';
    case 'verb': return '#34C759';
    case 'adjective': return '#FF9500';
    case 'adverb': return '#5AC8FA';
    default: return '#8E8E93';
  }
};

const shuffleArray = <T,>(arr: T[]): T[] => {
  let i = arr.length;
  while (i) {
    const j = Math.floor(Math.random() * i--);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// URL 쿼리 파라미터 파싱 함수 (React Native용)
const useQuery = (route: any) => {
  return useMemo(() => {
    const params = route.params || {};
    return {
      get: (key: string) => params[key] || null
    };
  }, [route.params]);
};

// 인터페이스 정의
interface VocabCard {
  vocabId: number;
  cardId?: number;
  question: string;
  answer: string;
  lemma?: string;
  pos?: string;
  levelCEFR?: string;
  source?: string;
  category?: string;
  folderId?: string | number;
  vocab?: {
    dictentry?: any;
    dictMeta?: any;
    lemma?: string;
  };
  contextSentence?: string;
  contextTranslation?: string;
  wordOptions?: string[];
  options?: string[];
}

interface SurpriseQuiz {
  show: boolean;
  questions: Array<{
    question: string;
    correctAnswer: string;
    options: string[];
  }>;
  currentQ: number;
  answers: Array<{
    question: string;
    selected: string;
    correct: string;
    isCorrect: boolean;
  }>;
  showFeedback: boolean;
  selectedAnswer: string | null;
}

export default function LearnVocabScreen({ navigation, route }: Props) {
  const { user, refreshSrsIds } = useAuth();
  const query = useQuery(route);

  // URL 파라미터 (React Native에서는 route.params로 전달됨)
  const mode = query.get('mode');
  const idsParam = query.get('ids');
  const autoParam = query.get('auto');
  const folderIdParam = query.get('folderId');
  const selectedItemsParam = query.get('selectedItems');
  const quizTypeParam = query.get('quizType');
  const glossModeParam = query.get('gloss');

  // 공통 상태
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<any>(null);
  const audioRef = useRef<Audio.Sound | null>(null);

  // 배치 상태
  const [allBatches, setAllBatches] = useState<VocabCard[][]>([]);
  const [batchIndex, setBatchIndex] = useState(0);
  const [modeForBatch, setModeForBatch] = useState('flash');

  // 기존 모드 상태
  const [queue, setQueue] = useState<VocabCard[]>(() => (route.params as any)?.initialQueue ?? []);
  const [idx, setIdx] = useState(0);
  const [userAnswer, setAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<any>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [reloadKey, forceReload] = useReducer((k: number) => k + 1, 0);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [learnedVocabIds, setLearnedVocabIds] = useState<number[]>([]);

  // 플래시 공통
  const [flipped, setFlipped] = useState(false);
  const [auto, setAuto] = useState(autoParam === '1');
  const [currentDetail, setDetail] = useState<any>(null);
  const [currentPron, setPron] = useState<any>(null);
  const [reviewQuiz, setReviewQuiz] = useState({ show: false, batch: [] });
  const [audioPlayCount, setAudioPlayCount] = useState(0);
  const audioPlayCountRef = useRef(0);
  const isManualPlayRef = useRef(false);

  // 깜짝 퀴즈 상태
  const [surpriseQuiz, setSurpriseQuiz] = useState<SurpriseQuiz>({ 
    show: false, 
    questions: [], 
    currentQ: 0, 
    answers: [], 
    showFeedback: false, 
    selectedAnswer: null 
  });
  const [studiedCards, setStudiedCards] = useState<VocabCard[]>([]);

  // 스펠링 입력 상태
  const [spellingInput, setSpellingInput] = useState('');
  const [attemptCount, setAttemptCount] = useState(0);
  const [maxAttempts] = useState(3);
  const [showSpellingWarning, setShowSpellingWarning] = useState(false);

  // 공통 현재 카드 포인터
  const current = useMemo(
    () => (mode === 'batch' ? allBatches[batchIndex]?.[idx] : queue[idx]),
    [mode, allBatches, batchIndex, idx, queue]
  );

  // 스펠링 예문 데이터 계산
  const spellingExampleData = useMemo(() => {
    if (!current) return null;

    let exampleSentence = '';
    let exampleTranslation = '';

    // 단어 변형을 고려한 빈칸 대체 함수
    const replaceWithBlank = (sentence: string, targetWord: string): string => {
      let result = sentence;

      // 1. 정확한 매칭 시도
      result = result.replace(new RegExp(`\\b${targetWord}\\b`, 'gi'), '____');

      // 2. 매칭이 안 된 경우, 다양한 변형 고려
      if (result === sentence) {
        const lowerTarget = targetWord.toLowerCase();

        // 불규칙 변화 우선 처리
        const irregularForms: { [key: string]: string[] } = {
          'call': ['calls', 'called', 'calling'],
          'receive': ['receives', 'received', 'receiving'],
          'go': ['goes', 'went', 'going', 'gone'],
          'get': ['gets', 'got', 'getting', 'gotten'],
          'make': ['makes', 'made', 'making'],
          'take': ['takes', 'took', 'taking', 'taken']
        };

        if (irregularForms[lowerTarget]) {
          for (const form of irregularForms[lowerTarget]) {
            result = result.replace(new RegExp(`\\b${form}\\b`, 'gi'), '____');
            if (result !== sentence) break;
          }
        }

        // 여전히 매칭 안 된 경우, 규칙 변화 시도
        if (result === sentence) {
          // 복수형 (s, es)
          result = result.replace(new RegExp(`\\b${targetWord}s\\b`, 'gi'), '____');
          if (result === sentence) {
            result = result.replace(new RegExp(`\\b${targetWord}es\\b`, 'gi'), '____');
          }

          // 과거형 (ed)
          if (result === sentence) {
            result = result.replace(new RegExp(`\\b${targetWord}ed\\b`, 'gi'), '____');
          }

          // ing형
          if (result === sentence) {
            result = result.replace(new RegExp(`\\b${targetWord}ing\\b`, 'gi'), '____');
          }
        }
      }

      return result;
    };

    // 1. current.contextSentence가 있는 경우 (서버에서 직접 제공)
    if (current.contextSentence) {
      exampleSentence = current.contextSentence;
      exampleTranslation = current.contextTranslation || '';
    }
    // 2. vocab.dictentry.examples에서 찾기
    else if (current.vocab?.dictentry?.examples) {
      const examples = current.vocab.dictentry.examples;

      let parsedExamples = examples;
      if (typeof examples === 'string') {
        try {
          parsedExamples = JSON.parse(examples);
        } catch (e) {
          console.warn('[SPELLING DEBUG] Failed to parse examples:', e);
        }
      }

      // 먼저 kind === "example" 형태의 예문 찾기
      for (const exampleEntry of parsedExamples) {
        if (exampleEntry.kind === "example") {
          let englishText = exampleEntry.en;
          let koreanText = exampleEntry.ko;

          // 영어 예문이 없지만 chirpScript가 있는 경우 추출 시도
          if (!englishText && exampleEntry.chirpScript && koreanText) {
            console.log(`[SPELLING DEBUG] Trying to extract from chirpScript:`, exampleEntry.chirpScript);
            // chirpScript에서 영어 예문 추출 - 여러 패턴 시도
            const patterns = [
              /([A-Z][^?]*\?)/,  // What is the book about?
              /([A-Z][^.]*\.)/,  // 대문자로 시작하고 .로 끝나는 문장
              /\b([A-Z][a-z\s]+[?.])/,  // 단어 경계에서 시작하는 문장
              /([A-Z][^가-힣]*[?.])/, // 한글이 나오기 전까지의 문장
            ];

            for (const pattern of patterns) {
              const match = exampleEntry.chirpScript.match(pattern);
              if (match) {
                englishText = match[1].trim();
                console.log(`[SPELLING DEBUG] Extracted English from chirpScript:`, englishText);
                break;
              }
            }
          }

          // 영어와 한국어 둘 다 있으면 사용
          if (englishText && koreanText) {
            exampleSentence = englishText;
            exampleTranslation = koreanText;
            break;
          }
        }
      }
    }

    // 빈칸 처리
    if (exampleSentence) {
      const lemma = current.question || current.vocab?.lemma;
      if (lemma) {
        exampleSentence = replaceWithBlank(exampleSentence, lemma);
      }
    }

    return exampleSentence ? { exampleSentence, exampleTranslation } : null;
  }, [current]);

  // 첫 글자 힌트를 가져오는 헬퍼 함수
  const getFirstLetterHint = (card: VocabCard | undefined): string => {
    if (!card) return '';
    const answer = card.question || card.vocab?.lemma || '';
    // 답이 한 글자인 경우 힌트를 제공하지 않음
    if (answer.length <= 1) return '';
    return answer.charAt(0).toUpperCase();
  };

  // 오답 추적 상태
  const [wrongAnswerCards, setWrongAnswerCards] = useState<VocabCard[]>([]);

  // 현재 카드가 변경될 때마다 스펠링 입력 초기화
  useEffect(() => {
    const currentCard = queue[idx];
    if (currentCard && (quizTypeParam === 'spelling' || quizTypeParam === 'mixed')) {
      setSpellingInput('');
      setAttemptCount(0);
      setShowSpellingWarning(false);
    }
  }, [idx, queue, quizTypeParam]);

  // 설정 상태
  const [maxPlayCount, setMaxPlayCount] = useState(3);
  const [flipInterval, setFlipInterval] = useState(5000); // 5초 기본값
  const [showSettings, setShowSettings] = useState(false);
  const [showSettingsToast, setShowSettingsToast] = useState(false);

  const [lastCardId, setLastCardId] = useState<number | null>(null);
  const flipIntervalRef = useRef(flipInterval);
  const maxPlayCountRef = useRef(maxPlayCount);

  // 뒤로가기 버튼 처리 (Android)
  useEffect(() => {
    const backAction = () => {
      // 오디오 정지
      if (audioRef.current) {
        audioRef.current.unloadAsync();
      }
      navigation.goBack();
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [navigation]);

  // ───────────────────── 오디오 제어 ─────────────────────
  const stopAudio = async () => {
    if (audioRef.current) {
      try {
        await audioRef.current.unloadAsync();
        audioRef.current = null;
      } catch (error) {
        console.error('Error stopping audio:', error);
      }
    }
  };

  const playUrl = async (url: string, options: { loop?: boolean } = {}) => {
    if (!url) return;

    try {
      // 기존 오디오 정지
      await stopAudio();

      // 새 오디오 생성
      const { sound } = await Audio.Sound.createAsync(
        { uri: url.startsWith('/') ? `${apiClient.defaults.baseURL}${url}` : url },
        { 
          shouldPlay: true, 
          isLooping: options.loop || false,
          volume: 1.0
        }
      );

      audioRef.current = sound;

      // 오디오 종료 시 처리
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish && !status.isLooping) {
          // 자동 재생 로직은 여기서 처리
          console.log('[AUDIO DEBUG] Audio finished playing');
        }
      });

    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  // ───────────────────── 데이터 로딩 (Part 2/3 시작) ─────────────────────
  useEffect(() => {
    loadData();
  }, [reloadKey, route.params]);

  const loadData = async () => {
    console.log('[LOAD DEBUG] Starting loadData...');
    setLoading(true);
    setErr(null);
    
    try {
      let fetchedQueue: VocabCard[] = [];
      
      if ((route.params as any)?.initialQueue) {
        // 다른 화면에서 전달받은 데이터 사용
        console.log('[LOAD DEBUG] Using initialQueue from navigation');
        fetchedQueue = (route.params as any).initialQueue;
      } else if (mode === 'batch') {
        // 배치 모드 데이터 로드
        const response = await apiClient.get('/learn/batch');
        const data = response.data || response;
        if (data.batches && Array.isArray(data.batches)) {
          setAllBatches(data.batches);
          fetchedQueue = data.batches[0] || [];
        }
      } else if (mode === 'srs_folder' && folderIdParam) {
        // SRS 폴더 모드 데이터 로드
        const response = await apiClient.get(`/srs/folder/${folderIdParam}/cards`);
        fetchedQueue = response.data?.cards || response.cards || [];
      } else if (mode === 'all_overdue') {
        // 전체 밀린 카드 로드
        const response = await apiClient.get('/srs/overdue');
        fetchedQueue = response.data?.cards || response.cards || [];
      } else if (idsParam) {
        // ID 기반 로드
        const response = await apiClient.post('/vocab/ids', {
          ids: idsParam.split(',').map(Number)
        });
        fetchedQueue = response.data?.items || response.items || [];
      } else {
        // 기본 로드
        const response = await apiClient.get('/learn/queue');
        fetchedQueue = response.data?.queue || response.queue || [];
      }

      console.log('[LOAD DEBUG] Fetched queue length:', fetchedQueue.length);
      setQueue(fetchedQueue);
      
      // 자동학습 설정
      if (autoParam === '1') {
        setAuto(true);
      }
    } catch (error) {
      console.error('[LOAD ERROR]', error);
      setErr(error);
    } finally {
      setLoading(false);
    }
  };

  // ───────────────────── 자동 재생 로직 ─────────────────────
  const handleAutoPlay = (currentCard: VocabCard) => {
    if (!currentCard || !auto || isManualPlayRef.current) return;

    const cardId = currentCard.cardId || currentCard.vocabId;
    console.log('[AUTO PLAY DEBUG] Card ID:', cardId, 'Last Card ID:', lastCardId, 'Play Count:', audioPlayCountRef.current);

    // 새 카드인 경우 재생 횟수 초기화
    if (cardId !== lastCardId) {
      console.log('[AUTO PLAY DEBUG] New card detected, resetting play count');
      audioPlayCountRef.current = 0;
      setAudioPlayCount(0);
      setLastCardId(cardId);
    }

    // 자동 재생 횟수 체크
    if (audioPlayCountRef.current >= maxPlayCountRef.current) {
      console.log('[AUTO PLAY DEBUG] Max play count reached, stopping auto play');
      return;
    }

    console.log('[AUTO PLAY DEBUG] Starting auto play for card:', currentCard.question);
    const audioUrl = getCurrentAudioPath(currentCard, glossModeParam === '1');
    
    if (audioUrl) {
      playUrl(audioUrl);
      audioPlayCountRef.current += 1;
      setAudioPlayCount(audioPlayCountRef.current);
      console.log('[AUTO PLAY DEBUG] Auto play count updated to:', audioPlayCountRef.current);
    }
  };

  // 카드 변경 시 자동 재생 처리
  useEffect(() => {
    if (!auto || !current) return;

    // 수동 재생 플래그가 설정된 경우 한 번만 스킵하고 리셋
    if (isManualPlayRef.current) {
      isManualPlayRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      handleAutoPlay(current);
    }, 500); // 카드 전환 후 0.5초 뒤 재생

    return () => clearTimeout(timer);
  }, [current, auto]);

  // 자동 카드 넘김 처리 (플래시 모드)
  useEffect(() => {
    if (!auto || !current || flipped || (mode === 'batch' && modeForBatch !== 'flash')) return;

    const timer = setTimeout(() => {
      setFlipped(true);
    }, flipIntervalRef.current);

    return () => clearTimeout(timer);
  }, [current, auto, flipped, mode, modeForBatch]);

  // 자동으로 다음 카드로 넘어가기 (플래시 모드)
  useEffect(() => {
    if (!auto || !flipped || !current || (mode === 'batch' && modeForBatch !== 'flash')) return;

    const timer = setTimeout(() => {
      if (mode === 'batch') {
        handleNextFlash();
      } else {
        handleNext();
      }
    }, flipIntervalRef.current);

    return () => clearTimeout(timer);
  }, [flipped, auto, current, mode, modeForBatch]);

  // ───────────────────── 깜짝 퀴즈/복습 퀴즈 핸들러 (Part 2/3) ─────────────────────
  const handleNext = () => {
    stopAudio();
    const nextIdx = idx + 1;
    const currentBatch = queue;

    // 현재 카드를 학습완료 목록에 추가 (중복 체크)
    if (current && !studiedCards.some(card => card.vocabId === current.vocabId)) {
      setStudiedCards(prev => [...prev, current]);
    }

    // 깜짝퀴즈 트리거 조건 확인 (일반 모드용)
    const shouldTriggerSurpriseQuiz = currentBatch.length >= 11 && 
                                     nextIdx % 10 === 0 && 
                                     nextIdx < currentBatch.length && 
                                     !auto; // 자동학습에서는 깜짝퀴즈 비활성화

    console.log('[SURPRISE QUIZ DEBUG]', {
      mode: mode || 'normal',
      batchLength: currentBatch.length,
      nextIdx,
      nextIdxMod10: nextIdx % 10,
      shouldTriggerSurpriseQuiz,
      studiedCardsLength: studiedCards.length
    });

    if (shouldTriggerSurpriseQuiz) {
      // 방금 학습한 10개 카드에서 랜덤으로 3개 선택
      const allStudiedCards = [...studiedCards, current].filter(Boolean);
      const lastTenCards = allStudiedCards.slice(-10);
      const selectedCards = _.sampleSize(lastTenCards, Math.min(3, lastTenCards.length));

      // 깜짝 퀴즈 문제 생성
      const quizQuestions = selectedCards.filter(card => card).map(card => {
        const otherAnswers = queue
          .filter(q => q.vocabId !== card!.vocabId)
          .map(q => q.answer);

        const wrongOptions = _.sampleSize(otherAnswers, 3);
        const uniqueOptions = _.uniq([card!.answer, ...wrongOptions]);
        while (uniqueOptions.length < 4) {
          uniqueOptions.push(`기타 선택지 ${uniqueOptions.length}`);
        }

        const allOptions = _.shuffle(uniqueOptions.slice(0, 4));

        return {
          question: card!.question,
          correctAnswer: card!.answer,
          options: allOptions,
          vocabId: card.vocabId
        };
      });

      setSurpriseQuiz({
        show: true,
        questions: quizQuestions,
        currentQ: 0,
        answers: [],
        showFeedback: false,
        selectedAnswer: null
      });
    } else {
      setFlipped(false);
      if (nextIdx < queue.length) {
        setIdx(nextIdx);
      } else {
        setIdx(queue.length);
      }
    }
  };

  const handleReviewQuizDone = () => {
    setReviewQuiz({ show: false, batch: [] });
    setFlipped(false);
    setAudioPlayCount(0);
    setIdx((i) => i + 1);
  };

  // 깜짝 퀴즈 핸들러
  const handleSurpriseQuizAnswer = (selectedAnswer: string) => {
    const currentQuestion = surpriseQuiz.questions[surpriseQuiz.currentQ];
    if (!currentQuestion) return;
    
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

    // 피드백 표시
    setSurpriseQuiz(prev => ({
      ...prev,
      showFeedback: true,
      selectedAnswer: selectedAnswer
    }));

    const newAnswers: Array<{
      question: string;
      selected: string;
      correct: string;
      isCorrect: boolean;
    }> = [...surpriseQuiz.answers, {
      question: currentQuestion.question,
      selected: selectedAnswer,
      correct: currentQuestion.correctAnswer,
      isCorrect: isCorrect
    }];

    // 1.5초 후 다음 문제로 이동 또는 퀴즈 완료
    setTimeout(() => {
      if (surpriseQuiz.currentQ < surpriseQuiz.questions.length - 1) {
        // 다음 문제로
        setSurpriseQuiz(prev => ({
          ...prev,
          currentQ: prev.currentQ + 1,
          answers: newAnswers,
          showFeedback: false,
          selectedAnswer: null
        }));
      } else {
        // 퀴즈 완료
        setSurpriseQuiz({ 
          show: false, 
          questions: [], 
          currentQ: 0, 
          answers: [], 
          showFeedback: false, 
          selectedAnswer: null 
        });
        setFlipped(false);
        const nextIdx = idx + 1;
        if (nextIdx < queue.length) {
          setIdx(nextIdx);
        } else {
          setIdx(queue.length);
        }
      }
    }, 1500);
  };

  // ───────────────────── 배치 모드 핸들러 ─────────────────────
  const handleNextFlash = () => {
    stopAudio();
    const currentBatch = allBatches[batchIndex] || [];
    console.log('[NEXT FLASH DEBUG] idx:', idx, 'currentBatch.length:', currentBatch.length);

    // 현재 카드를 학습완료 목록에 추가
    const current = currentBatch[idx];
    if (current && !studiedCards.some(card => card.vocabId === current.vocabId)) {
      setStudiedCards(prev => [...prev, current]);
    }

    if (idx < currentBatch.length - 1) {
      const nextIdx = idx + 1;
      setAudioPlayCount(0);

      // 깜짝퀴즈 트리거 조건 확인 (flash 모드용)
      const shouldTriggerSurpriseQuiz = currentBatch.length >= 11 && 
                                       nextIdx % 10 === 0 && 
                                       nextIdx < currentBatch.length &&
                                       !auto; // 자동학습에서는 깜짝퀴즈 비활성화

      if (shouldTriggerSurpriseQuiz) {
        const allStudiedCards = [...studiedCards, current];
        const lastTenCards = allStudiedCards.slice(-10);
        const selectedCards = _.sampleSize(lastTenCards, Math.min(3, lastTenCards.length));

        const quizQuestions = selectedCards.filter(card => card).map(card => {
          const otherAnswers = currentBatch
            .filter(q => q.vocabId !== card!.vocabId)
            .map(q => q.answer);

          const wrongAnswers = _.sampleSize(otherAnswers, 3);
          const allOptions = [card!.answer, ...wrongAnswers];

          return {
            question: card!.question,
            correctAnswer: card!.answer,
            options: _.shuffle(allOptions)
          };
        });

        setSurpriseQuiz({
          show: true,
          questions: quizQuestions,
          currentQ: 0,
          answers: [],
          showFeedback: false,
          selectedAnswer: null
        });
        return;
      }

      setIdx(nextIdx);
      setFlipped(false);
    } else {
      console.log('[NEXT FLASH DEBUG] Batch completed, auto:', auto);
      if (auto) {
        console.log('[NEXT FLASH DEBUG] Auto mode - calling handleQuizDone');
        handleQuizDone();
      } else {
        setModeForBatch('quiz');
      }
    }
  };

  const handleQuizDone = async () => {
    stopAudio();

    if (batchIndex < allBatches.length - 1) {
      setAudioPlayCount(0);
      setBatchIndex((i) => i + 1);
      setIdx(0);
      setFlipped(false);
      setModeForBatch('flash');
      return;
    }

    setModeForBatch('finished');
    try {
      const currentBatch = allBatches[batchIndex] || [];
      const queueData = queue || [];

      let vocabIds: number[] = [];
      let cardIds: number[] = [];

      if (mode === 'batch' && currentBatch.length > 0) {
        vocabIds = currentBatch.map(it => it.vocabId).filter((id): id is number => Boolean(id));
        cardIds = currentBatch.map(it => it.cardId).filter((id): id is number => Boolean(id));
      } else {
        vocabIds = queueData.map(it => it.vocabId).filter((id): id is number => Boolean(id));
        cardIds = queueData.map(it => it.cardId).filter((id): id is number => Boolean(id));
      }

      if (vocabIds.length || cardIds.length) {
        await apiClient.post('/learn/flash/finish', {
          vocabIds: vocabIds,
          cardIds: cardIds,
          createFolder: true
        });
      }
    } catch (e: any) {
      if (!auto) {
        Alert.alert('오류', '오늘 폴더 생성 중 오류: ' + e.message);
      }
    }
    
    try {
      const { data } = await apiClient.post('/learn/session/finish');
      if (!auto) {
        if (data?.highMistake > 0) {
          Alert.alert('알림', `오답률 높은 단어 ${data.highMistake}개로 복습 폴더가 생성되었습니다!`);
        } else {
          Alert.alert('완료', '완벽히 학습하셨네요! 다음날 복습 폴더는 생성되지 않았습니다.');
        }
      }
    } catch (e: any) {
      if (!auto) {
        Alert.alert('오류', '세션 종료 중 오류 발생: ' + e.message);
      }
    }

    setTimeout(() => {
      setModeForBatch('finished');
      setFlipped(false);
    }, 100);
  };

  // ───────────────────── 스펙링 입력 헬퍼 함수들 (Part 3/3) ─────────────────────
  const isSpellingMixedType = () => {
    if (quizTypeParam === 'mixed') {
      const cardId = current?.cardId || current?.vocabId || 0;
      return (cardId % 3) === 0;
    }
    return false;
  };

  const handleSpellingSubmit = async () => {
    if (!current || !spellingInput.trim()) return;

    setSubmitting(true);
    stopAudio();

    const correctAnswer = current.question || current.vocab?.lemma || '';

    const findOriginalFormInSentence = (sentence: string, baseWord: string) => {
      if (!sentence) return null;

      const words = sentence.toLowerCase().match(/\b\w+\b/g) || [];
      const base = baseWord.toLowerCase();

      // 불규칙 동사 매핑
      const irregularForms: {[key: string]: string[]} = {
        'call': ['calls', 'called', 'calling'],
        'receive': ['receives', 'received', 'receiving'],
        'go': ['goes', 'went', 'going', 'gone'],
        'get': ['gets', 'got', 'getting', 'gotten'],
        'make': ['makes', 'made', 'making'],
        'take': ['takes', 'took', 'taking', 'taken'],
        'have': ['has', 'had', 'having'],
        'be': ['is', 'are', 'was', 'were', 'being', 'been'],
        'do': ['does', 'did', 'doing', 'done'],
        'say': ['says', 'said', 'saying']
      };

      if (irregularForms[base]) {
        for (const form of irregularForms[base]) {
          if (words.includes(form)) {
            return form;
          }
        }
      }

      for (const word of words) {
        if (word === base + 's' || word === base + 'es') return word;
        if (word === base + 'ed') return word;
        if (word === base + 'ing') return word;
        if (base.endsWith('y') && word === base.slice(0, -1) + 'ies') return word;
        if (base.endsWith('e')) {
          const baseWithoutE = base.slice(0, -1);
          if (word === baseWithoutE + 'ed' || word === baseWithoutE + 'ing') return word;
        }
      }

      return null;
    };

    const checkSpellingAnswer = (userInput: string, targetWord: string) => {
      const input = userInput.trim().toLowerCase();
      const target = targetWord.toLowerCase();

      if (input === target) return true;

      let exampleSentence = '';
      if (current.contextSentence) {
        exampleSentence = current.contextSentence;
      } else if (current.vocab?.dictentry?.examples) {
        const examples = current.vocab.dictentry.examples;
        let parsedExamples = examples;
        if (typeof examples === 'string') {
          try {
            parsedExamples = JSON.parse(examples);
          } catch (e) {
            console.warn('Failed to parse examples:', e);
          }
        }

        for (const exampleBlock of parsedExamples) {
          if (exampleBlock.definitions) {
            for (const def of exampleBlock.definitions) {
              if (def.examples && def.examples.length > 0) {
                const firstExample = def.examples[0];
                if (firstExample.en || firstExample.de) {
                  exampleSentence = firstExample.en || firstExample.de;
                  break;
                }
              }
            }
            if (exampleSentence) break;
          }
          else if (exampleBlock.examples && exampleBlock.examples.length > 0) {
            const firstExample = exampleBlock.examples[0];
            if (firstExample.en || firstExample.de) {
              exampleSentence = firstExample.en || firstExample.de;
              break;
            }
          }
          else if (exampleBlock.en || exampleBlock.de) {
            exampleSentence = exampleBlock.en || exampleBlock.de;
            break;
          }
        }
      }

      const originalForm = findOriginalFormInSentence(exampleSentence, target);
      if (originalForm && input === originalForm) return true;

      return false;
    };

    const isCorrect = checkSpellingAnswer(spellingInput, correctAnswer);

    if (isCorrect) {
      try {
        if (mode === 'odat') {
          setFeedback({ status: 'pass', answer: correctAnswer });
          return;
        }
        const folderId = current.folderId || folderIdParam;
        if (!folderId) {
          Alert.alert('오류', 'folderId가 없어 SRS 채점을 진행할 수 없습니다.');
          return;
        }
        const { data } = await apiClient.post('/quiz/answer', {
          folderId, 
          cardId: current.cardId, 
          correct: true
        });

        if (data?.isMasteryAchieved) {
          Alert.alert('코획래이션', '🎉🎆 마스터 완료! 축하합니다! 🎆🎉');
        }

        setFeedback({ status: data?.status ?? 'pass', answer: correctAnswer });
      } catch (e: any) {
        console.error('답변 제출 실패:', e);
        Alert.alert('오류', `답변 제출 실패: ${e.message || 'Internal Server Error'}`);
      } finally {
        setSubmitting(false);
      }
    } else {
      const newAttemptCount = attemptCount + 1;
      setAttemptCount(newAttemptCount);

      if (newAttemptCount >= maxAttempts) {
        try {
          if (mode === 'odat') {
            setFeedback({ status: 'fail', answer: correctAnswer });
            return;
          }
          const folderId = current.folderId || folderIdParam;
          if (!folderId) {
            Alert.alert('오류', 'folderId가 없어 SRS 채점을 진행할 수 없습니다.');
            return;
          }
          const { data } = await apiClient.post('/quiz/answer', {
            folderId, 
            cardId: current.cardId, 
            correct: false
          });

          setFeedback({ status: data?.status ?? 'fail', answer: correctAnswer });

          setWrongAnswerCards(prev => {
            const cardExists = prev.some(card => card.cardId === current.cardId || card.vocabId === current.vocabId);
            if (!cardExists) {
              return [...prev, current];
            }
            return prev;
          });
        } catch (e: any) {
          console.error('답변 제출 실패:', e);
          Alert.alert('오류', `답변 제출 실패: ${e.message || 'Internal Server Error'}`);
        } finally {
          setSubmitting(false);
        }
      } else {
        if (newAttemptCount === 2) {
          setShowSpellingWarning(true);
        }
        setSubmitting(false);
        setSpellingInput('');
      }
    }
  };

  // ───────────────────── 기존 SRS/odat/ids 핸들러 ─────────────────────
  const submit = async () => {
    const isSpellingMode = quizTypeParam === 'spelling' || (quizTypeParam === 'mixed' && isSpellingMixedType());

    if (isSpellingMode) {
      return await handleSpellingSubmit();
    }

    if (!current || !userAnswer) return;
    setSubmitting(true);
    stopAudio();

    let isCorrect = false;
    if (quizTypeParam === 'context' || (quizTypeParam === 'mixed' && (() => {
      if (quizTypeParam === 'mixed') {
        const cardId = current.cardId || current.vocabId || 0;
        const remainder = cardId % 3;
        return remainder === 1;
      }
      return false;
    })())) {
      const correctAnswer = current.question || current.vocab?.lemma || '';
      isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();
    } else {
      isCorrect = userAnswer === current.answer;
    }

    try {
      if (mode === 'odat') {
        setFeedback({ status: isCorrect ? 'pass' : 'fail', answer: current.answer });
        return;
      }
      const folderId = current.folderId || folderIdParam;
      if (!folderId) {
        Alert.alert('오류', 'folderId가 없어 SRS 채점을 진행할 수 없습니다.');
        return;
      }
      const { data } = await apiClient.post('/quiz/answer', {
        folderId, 
        cardId: current.cardId, 
        correct: isCorrect
      });

      if (data?.isMasteryAchieved) {
        Alert.alert('콨그래칠레이션', '🎉🎆 마스터 완료! 축하합니다! 🎆🎉');
      }

      setFeedback({ status: data?.status ?? (isCorrect ? 'pass' : 'fail'), answer: current.answer });

      if (!isCorrect) {
        setWrongAnswerCards(prev => {
          const cardExists = prev.some(card => card.cardId === current.cardId || card.vocabId === current.vocabId);
          if (!cardExists) {
            return [...prev, current];
          }
          return prev;
        });
      }
    } catch (e: any) {
      console.error('답변 제출 실패:', e);
      Alert.alert('오류', `답변 제출 실패: ${e.message || 'Internal Server Error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    stopAudio();
    if (idx < queue.length - 1) {
      setIdx((i) => i + 1);
      setAnswer(null);
      setFeedback(null);
      setSpellingInput('');
      setAttemptCount(0);
      setShowSpellingWarning(false);
    } else {
      setIdx(queue.length);
    }
  };

  const handleRestart = () => {
    setIdx(0);
    setAnswer(null);
    setFeedback(null);
    setSpellingInput('');
    setAttemptCount(0);
    setShowSpellingWarning(false);
    setAudioPlayCount(0);
    audioPlayCountRef.current = 0;
    setLastCardId(null);
    isManualPlayRef.current = false;
    stopAudio();
    forceReload();
  };

  const goToNextCard = () => {
    if (mode === 'batch') {
      handleNextFlash();
    } else {
      handleNext();
    }
  };

  // ───────────────────── 메인 렌더링 로직 (Part 3/3) ─────────────────────
  const renderMainContent = () => {
    // SRS 모드에서 퀴즈 유형이 선택되지 않은 경우 유형 선택 화면 표시
    if ((mode === 'srs_folder' || mode === 'all_overdue' || (!mode && !idsParam)) && !quizTypeParam) {
      return (
        <ScrollView style={styles.quizTypeContainer}>
          <View style={styles.quizTypeCard}>
            <Text style={styles.quizTypeTitle}>📚 학습 유형 선택</Text>
            <Text style={styles.quizTypeDescription}>원하는 학습 유형을 선택해주세요.</Text>

            <TouchableOpacity 
              style={[styles.quizTypeButton, styles.quizTypeMeaning]}
              onPress={() => handleQuizTypeSelect('meaning')}
            >
              <View style={styles.quizTypeIcon}>
                <Text style={styles.quizTypeIconText}>📖</Text>
              </View>
              <View style={styles.quizTypeInfo}>
                <Text style={styles.quizTypeButtonTitle}>4지선다 (영단어 뜻 맞추기)</Text>
                <Text style={styles.quizTypeButtonDesc}>영어 단어를 보고 한국어 뜻을 선택합니다</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.quizTypeButton, styles.quizTypeContext]}
              onPress={() => handleQuizTypeSelect('context')}
            >
              <View style={styles.quizTypeIcon}>
                <Text style={styles.quizTypeIconText}>🔤</Text>
              </View>
              <View style={styles.quizTypeInfo}>
                <Text style={styles.quizTypeButtonTitle}>4지선다 (한국어 뜻 매칭)</Text>
                <Text style={styles.quizTypeButtonDesc}>한국어 뜻을 보고 알맞은 영어 단어를 선택합니다</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.quizTypeButton, styles.quizTypeSpelling]}
              onPress={() => handleQuizTypeSelect('spelling')}
            >
              <View style={styles.quizTypeIcon}>
                <Text style={styles.quizTypeIconText}>✏️</Text>
              </View>
              <View style={styles.quizTypeInfo}>
                <Text style={styles.quizTypeButtonTitle}>스펙링 입력 (예문 직접 타이핑)</Text>
                <Text style={styles.quizTypeButtonDesc}>예문의 빈칸에 영어 단어를 직접 입력합니다 (3번 기회)</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.quizTypeButton, styles.quizTypeMixed]}
              onPress={() => handleQuizTypeSelect('mixed')}
            >
              <View style={styles.quizTypeIcon}>
                <Text style={styles.quizTypeIconText}>🎯</Text>
              </View>
              <View style={styles.quizTypeInfo}>
                <Text style={styles.quizTypeButtonTitle}>혼합형</Text>
                <Text style={styles.quizTypeButtonDesc}>영단어→한국어, 한국어→영단어, 스펙링 입력이 랜덤하게 출제됩니다</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.backToFolderButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backToFolderButtonText}>← 돌아가기</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }

    // 깜짝 퀴즈 렌더링
    if (surpriseQuiz.show) {
      const currentQ = surpriseQuiz.questions[surpriseQuiz.currentQ];
      const isCorrect = surpriseQuiz.selectedAnswer === currentQ.correctAnswer;

      return (
        <View style={styles.surpriseQuizContainer}>
          <View style={styles.surpriseQuizCard}>
            <View style={styles.surpriseQuizHeader}>
              <Text style={styles.surpriseQuizTitle}>🎯 깜짝 퀴즈! ({surpriseQuiz.currentQ + 1}/{surpriseQuiz.questions.length})</Text>
            </View>
            <View style={styles.surpriseQuizBody}>
              <Text style={styles.surpriseQuizQuestion}>{currentQ.question}</Text>

              {surpriseQuiz.showFeedback && (
                <View style={[styles.feedbackContainer, isCorrect ? styles.successFeedback : styles.errorFeedback]}>
                  <Text style={styles.feedbackText}>
                    {isCorrect ? '✅ 정답!' : '❌ 오답!'}
                  </Text>
                  {!isCorrect && (
                    <Text style={styles.correctAnswerText}>
                      정답: {currentQ.correctAnswer}
                    </Text>
                  )}
                </View>
              )}

              <View style={styles.optionsContainer}>
                {currentQ.options.map((option, index) => {
                  let buttonStyle = [styles.optionButton];

                  if (surpriseQuiz.showFeedback) {
                    if (option === currentQ.correctAnswer) {
                      buttonStyle.push(styles.correctOption);
                    } else if (option === surpriseQuiz.selectedAnswer && !isCorrect) {
                      buttonStyle.push(styles.wrongOption);
                    } else {
                      buttonStyle.push(styles.disabledOption);
                    }
                  }

                  return (
                    <TouchableOpacity
                      key={index}
                      style={buttonStyle}
                      onPress={() => !surpriseQuiz.showFeedback && handleSurpriseQuizAnswer(option)}
                      disabled={surpriseQuiz.showFeedback}
                    >
                      <Text style={[styles.optionButtonText, surpriseQuiz.showFeedback && styles.disabledOptionText]}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {!surpriseQuiz.showFeedback && (
                <Text style={styles.surpriseQuizHint}>
                  방금 학습한 단어들 중에서 출제됩니다
                </Text>
              )}
            </View>
          </View>
        </View>
      );
    }

    if (reviewQuiz.show) {
      return (
        <View style={styles.reviewQuizContainer}>
          <View style={styles.reviewQuizAlert}>
            <Text style={styles.reviewQuizTitle}>📝 중간 복습 퀴즈</Text>
            <Text style={styles.reviewQuizDesc}>방금 학습한 10개 단어 중 3개를 복습합니다. (점수 미반영)</Text>
          </View>
          <Text style={styles.tempText}>MiniQuiz 컴포넌트 대체 구현 필요</Text>
        </View>
      );
    }

    // 학습 완료 상태 체크
    if (modeForBatch === 'finished') {
      return (
        <View style={styles.finishedContainer}>
          <Text style={styles.finishedTitle}>🎉 모든 학습 완료!</Text>
          <Text style={styles.finishedDesc}>오답률이 높은 단어들은 내일 복습 폴더에 자동으로 추가됩니다.</Text>
          <View style={styles.finishedButtons}>
            <TouchableOpacity style={styles.finishedButtonSecondary} onPress={() => navigation.navigate('Home')}>
              <Text style={styles.finishedButtonSecondaryText}>다시 학습하기</Text>
            </TouchableOpacity>
            
            {folderIdParam ? (
              <TouchableOpacity style={styles.finishedButtonPrimary} onPress={() => navigation.goBack()}>
                <Text style={styles.finishedButtonPrimaryText}>폴더로 돌아가기</Text>
              </TouchableOpacity>
            ) : mode === 'all_overdue' ? (
              <TouchableOpacity style={styles.finishedButtonPrimary} onPress={() => navigation.navigate('Home')}>
                <Text style={styles.finishedButtonPrimaryText}>홈으로 돌아가기</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.finishedButtonPrimary} onPress={() => navigation.navigate('Home')}>
                <Text style={styles.finishedButtonPrimaryText}>SRS 학습하기</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.finishedButtonSecondary} onPress={() => navigation.navigate('Home')}>
              <Text style={styles.finishedButtonSecondaryText}>홈으로</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // 배치 모드
    if (mode === 'batch') {
      const currentBatch = allBatches[batchIndex];

      if (!currentBatch) {
        return (
          <View style={styles.noBatchContainer}>
            <Text style={styles.noBatchTitle}>🎉 오늘 학습할 단어가 없습니다.</Text>
            <TouchableOpacity style={styles.noBatchButton} onPress={() => navigation.navigate('Dictionary')}>
              <Text style={styles.noBatchButtonText}>단어 추가하러 가기</Text>
            </TouchableOpacity>
          </View>
        );
      }

      return (
        <View style={styles.batchContainer}>
          <View style={styles.batchHeader}>
            <Text style={styles.batchTitle}>Batch {batchIndex + 1} / {allBatches.length}</Text>
          </View>

          {modeForBatch === 'flash' && current && (
            <View style={styles.flashCard}>
              <View style={styles.flashCardHeader}>
                <Text style={styles.flashCardTitle}>플래시카드 ({idx + 1} / {currentBatch.length})</Text>
              </View>
              <TouchableOpacity 
                style={styles.flashCardBody}
                onPress={() => setFlipped(f => !f)}
                activeOpacity={0.8}
              >
                {!flipped ? (
                  <View style={styles.flashCardFront}>
                    <View style={styles.posBadges}>
                      {(current.pos || '').split(',').map((t) => t.trim()).filter((t) => t && t !== 'unk')
                        .map((t) => (
                          <View key={t} style={[styles.posBadge, { backgroundColor: getPosBadgeColor(t) }]}>
                            <Text style={styles.posBadgeText}>{t}</Text>
                          </View>
                        ))}
                    </View>
                    <Text style={styles.flashCardQuestion}>{current.question}</Text>
                  </View>
                ) : (
                  <View style={styles.flashCardBack}>
                    <Text style={styles.flashCardAnswer}>{current.answer}</Text>
                    {/* 예문 표시 로직 */}
                    {(() => {
                      const examples = current.vocab?.dictentry?.examples || [];
                      let displayExamples: any[] = [];

                      for (const ex of examples) {
                        if (ex.definitions) {
                          for (const def of ex.definitions) {
                            if (def.examples && Array.isArray(def.examples)) {
                              displayExamples.push(...def.examples.slice(0, 2));
                              break;
                            }
                          }
                        }
                        if (displayExamples.length > 0) break;
                      }

                      if (displayExamples.length === 0) return null;

                      return (
                        <View style={styles.examplesContainer}>
                          <Text style={styles.examplesTitle}>예문</Text>
                          {displayExamples.map((example, index) => (
                            <View key={index} style={styles.exampleItem}>
                              <Text style={styles.exampleEn}>{example.en}</Text>
                              <Text style={styles.exampleKo}>— {example.ko}</Text>
                            </View>
                          ))}
                        </View>
                      );
                    })()}
                  </View>
                )}
              </TouchableOpacity>
              <View style={styles.flashCardFooter}>
                <TouchableOpacity style={styles.flashCardButton} onPress={handleNextFlash}>
                  <Text style={styles.flashCardButtonText}>
                    {idx < currentBatch.length - 1 ? '다음 단어' : '퀴즈 풀기'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {modeForBatch === 'quiz' && (
            <Text style={styles.tempText}>MiniQuiz 컴포넌트 대체 구현 필요</Text>
          )}
        </View>
      );
    }

    // 완료 화면 분기
    if (!current) {
      return (
        <View style={styles.completionContainer}>
          <Text style={styles.completionTitle}>🎉 학습 완료!</Text>
          <Text style={styles.completionDesc}>다음 작업을 선택하세요.</Text>
          <View style={styles.completionButtons}>
            <TouchableOpacity style={styles.completionButtonSecondary} onPress={handleRestart}>
              <Text style={styles.completionButtonSecondaryText}>다시 학습하기</Text>
            </TouchableOpacity>

            {wrongAnswerCards.length > 0 && (
              <TouchableOpacity 
                style={styles.completionButtonWarning} 
                onPress={() => {
                  setQueue(wrongAnswerCards);
                  setWrongAnswerCards([]);
                  setIdx(0);
                  setAnswer(null);
                  setFeedback(null);
                  setSpellingInput('');
                  setAttemptCount(0);
                  setShowSpellingWarning(false);
                }}
              >
                <Text style={styles.completionButtonWarningText}>
                  오답문제 다시 학습 ({wrongAnswerCards.length}개)
                </Text>
              </TouchableOpacity>
            )}

            {folderIdParam && (
              <TouchableOpacity style={styles.completionButtonPrimary} onPress={() => navigation.goBack()}>
                <Text style={styles.completionButtonPrimaryText}>폴더로 돌아가기</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.completionButtonSecondary} onPress={() => navigation.navigate('Home')}>
              <Text style={styles.completionButtonSecondaryText}>홈으로</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // 플래시 모드
    if (mode === 'flash') {
      return (
        <View style={styles.flashModeContainer}>
          <View style={styles.flashModeHeader}>
            <Text style={styles.flashModeTitle}>플래시카드 ({queue.length}개)</Text>
            <TouchableOpacity
              style={styles.autoPlayButton}
              onPress={() => {
                if (auto) {
                  stopAudio();
                } else {
                  isManualPlayRef.current = true;
                  const currentCardId = current?.vocabId || current?.cardId;
                  if (currentCardId) {
                    setLastCardId(currentCardId);
                  }
                }
                setAuto((a) => !a);
              }}
            >
              <Ionicons 
                name={auto ? "pause" : "play"} 
                size={18} 
                color="#007AFF" 
              />
            </TouchableOpacity>
            <Text style={styles.flashModeProgress}>{idx + 1} / {queue.length}</Text>
          </View>

          <View style={styles.flashCard}>
            {auto && (
              <View style={styles.autoPlayInfo}>
                <Text style={styles.autoPlayCount}>재생횟수: {audioPlayCount}회</Text>
                <TouchableOpacity
                  style={styles.settingsButtonSmall}
                  onPress={() => setShowSettings(true)}
                >
                  <Ionicons name="settings-outline" size={12} color="#666" />
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity 
              style={styles.flashCardBody}
              onPress={() => setFlipped((f) => !f)}
              activeOpacity={0.8}
            >
              {!flipped ? (
                <View style={styles.flashCardFront}>
                  <View style={styles.posBadges}>
                    {(current.pos || '').split(',').map((t) => t.trim()).filter((t) => t && t !== 'unk')
                      .map((t) => (
                        <View key={t} style={[styles.posBadge, { backgroundColor: getPosBadgeColor(t) }]}>
                          <Text style={styles.posBadgeText}>{t}</Text>
                        </View>
                      ))}
                  </View>
                  <Text style={styles.flashCardQuestion}>{current.question}</Text>
                  <Text style={styles.flashCardHint}>카드를 클릭하면 뜻이 표시됩니다.</Text>
                </View>
              ) : (
                <View style={styles.flashCardBack}>
                  <Text style={styles.flashCardAnswerLabel}>뜻:</Text>
                  <Text style={styles.flashCardAnswer}>{current.answer}</Text>
                  
                  {(() => {
                    const dictentry = current.vocab?.dictentry || {};
                    const rawMeanings = Array.isArray(dictentry.examples) ? dictentry.examples : [];
                    
                    let englishExample = '';
                    let koreanExample = '';
                    
                    const exampleExample = rawMeanings.find(ex => ex.kind === 'example');
                    if (exampleExample) {
                      englishExample = exampleExample.en || '';
                      koreanExample = exampleExample.ko || '';
                      
                      if (!englishExample && exampleExample.chirpScript) {
                        const patterns = [
                          /예문은 (.+?)\./,
                          /([A-Z][^.!?]*[.!?])/,
                          /([A-Z][^가-힣]*?)\s*([가-힣][^.]*[.])/
                        ];
                        
                        for (const pattern of patterns) {
                          const match = exampleExample.chirpScript.match(pattern);
                          if (match) {
                            englishExample = match[1].trim();
                            break;
                          }
                        }
                      }
                    }
                    
                    if (!koreanExample && !englishExample) {
                      for (const entry of rawMeanings) {
                        if (entry.ko || entry.en || entry.chirpScript) {
                          koreanExample = entry.ko || '';
                          englishExample = entry.en || '';
                          break;
                        }
                      }
                    }

                    if (koreanExample) {
                      return (
                        <View style={styles.examplesContainer}>
                          <Text style={styles.examplesTitle}>예문</Text>
                          <View style={styles.exampleContainer}>
                            {englishExample && (
                              <Text style={styles.exampleEn}>{englishExample}</Text>
                            )}
                            <Text style={styles.exampleKo}>— {koreanExample}</Text>
                          </View>
                        </View>
                      );
                    }

                    return null;
                  })()}
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.flashCardFooter}>
              <TouchableOpacity 
                style={styles.flashCardPrevButton} 
                onPress={() => {
                  stopAudio();
                  setFlipped(false);
                  setIdx((i) => Math.max(0, i - 1));
                }}
              >
                <Text style={styles.flashCardPrevButtonText}>← 이전</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.flashCardNextButton} onPress={goToNextCard}>
                <Text style={styles.flashCardNextButtonText}>다음 →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    // SRS/오답노트 퀴즈
    return (
      <View style={styles.quizContainer}>
        <View style={styles.quizHeader}>
          <Text style={styles.quizTitle}>{mode === 'odat' ? '오답노트 퀴즈' : 'SRS 퀴즈'}</Text>
          <Text style={styles.quizProgress}>{idx + 1} / {queue.length}</Text>
        </View>

        <View style={styles.quizCard}>
          <View style={styles.quizBody}>
            {(() => {
              const isSpellingMode = quizTypeParam === 'spelling' || (quizTypeParam === 'mixed' && isSpellingMixedType());

              if (isSpellingMode) {
                return (
                  <View style={[styles.spellingContainer, showSpellingWarning && styles.spellingWarning]}>
                    <Text style={styles.spellingTitle}>다음 빈칸에 들어갈 영어 단어를 입력하세요</Text>

                    <View style={styles.spellingMeaning}>
                      <Text style={styles.spellingMeaningIcon}>💡</Text>
                      <Text style={styles.spellingMeaningText}>{current.answer || '뜻 정보 없음'}</Text>
                    </View>

                    {showSpellingWarning && (
                      <View style={styles.spellingWarningAlert}>
                        <Text style={styles.spellingWarningTitle}>⚠️ 다시 생각해보세요!</Text>
                        <Text style={styles.spellingWarningDesc}>남은 기회: {maxAttempts - attemptCount}번</Text>
                      </View>
                    )}

                    {spellingExampleData ? (
                      <View style={styles.spellingExample}>
                        <Text style={styles.spellingExampleText}>
                          {spellingExampleData.exampleSentence.split('____').map((part, index, array) => (
                            <Text key={index}>
                              {part}
                              {index < array.length - 1 && (
                                <Text style={styles.blankSpace}>[____]</Text>
                              )}
                            </Text>
                          ))}
                        </Text>
                        <TextInput
                          style={[styles.spellingInput, showSpellingWarning && styles.spellingInputWarning]}
                          value={spellingInput}
                          onChangeText={setSpellingInput}
                          onSubmitEditing={() => spellingInput.trim() && submit()}
                          placeholder={getFirstLetterHint(current)}
                          editable={!feedback && !isSubmitting}
                          autoFocus
                        />
                        {spellingExampleData.exampleTranslation && (
                          <Text style={styles.spellingTranslation}>
                            {spellingExampleData.exampleTranslation}
                          </Text>
                        )}
                      </View>
                    ) : (
                      <View style={styles.noExampleAlert}>
                        <Text style={styles.noExampleText}>이 단어의 예문을 찾을 수 없습니다.</Text>
                      </View>
                    )}

                    {!feedback && (
                      <View style={styles.spellingSubmitContainer}>
                        <Text style={styles.spellingAttemptText}>
                          시도 {attemptCount + 1}/{maxAttempts}
                          {attemptCount > 0 && ` (${maxAttempts - attemptCount}번 기회 남음)`}
                        </Text>
                        {(() => {
                          const answer = current.question || current.vocab?.lemma || '';
                          return answer.length > 0 && (
                            <Text style={styles.spellingHintText}>
                              힙트: {answer.length}글자
                            </Text>
                          );
                        })()}
                        <TouchableOpacity
                          style={[styles.spellingSubmitButton, (!spellingInput.trim() || isSubmitting) && styles.spellingSubmitButtonDisabled]}
                          onPress={submit}
                          disabled={!spellingInput.trim() || isSubmitting}
                        >
                          <Text style={styles.spellingSubmitButtonText}>
                            {isSubmitting ? '처리 중…' : '제출하기'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              }

              // 혼합형에서 context 유형 판별
              const isContextMode = quizTypeParam === 'context' ||
                (quizTypeParam === 'mixed' && (() => {
                  const cardId = current.cardId || current.vocabId || 0;
                  const remainder = cardId % 3;
                  return remainder === 1;
                })());

              if (isContextMode) {
                return (
                  <View style={styles.contextContainer}>
                    <Text style={styles.contextTitle}>다음 한국어 뜻에 해당하는 영어 단어를 선택하세요</Text>
                    
                    {(() => {
                      let koreanMeaning = '';
                      if (current.answer) {
                        koreanMeaning = current.answer.trim();
                      } else if (current.vocab?.ko_gloss) {
                        koreanMeaning = current.vocab.ko_gloss;
                      } else {
                        koreanMeaning = '한국어 뜻 정보 없음';
                      }

                      return koreanMeaning ? (
                        <View style={styles.contextMeaning}>
                          <Text style={styles.contextMeaningText}>{koreanMeaning}</Text>
                        </View>
                      ) : (
                        <View style={styles.noMeaningAlert}>
                          <Text style={styles.noMeaningText}>이 단어의 한국어 뜻을 찾을 수 없습니다.</Text>
                        </View>
                      );
                    })()}

                    {!feedback && (
                      <View style={styles.contextOptions}>
                        {(() => {
                          if (current.wordOptions && current.wordOptions.length > 0) {
                            return current.wordOptions.map((opt: string) => (
                              <TouchableOpacity 
                                key={opt}
                                style={[styles.contextOptionButton, userAnswer === opt && styles.contextOptionButtonSelected]}
                                onPress={() => setAnswer(opt)}
                                disabled={isSubmitting}
                              >
                                <Text style={[styles.contextOptionButtonText, userAnswer === opt && styles.contextOptionButtonTextSelected]}>
                                  {opt}
                                </Text>
                              </TouchableOpacity>
                            ));
                          }

                          const correctAnswer = current.question || current.vocab?.lemma || 'unknown';
                          const commonWords = [
                            'apple', 'book', 'chair', 'door', 'egg', 'face', 'good', 'hand',
                            'ice', 'job', 'key', 'love', 'make', 'name', 'open', 'page'
                          ];
                          const wrongOptions = commonWords
                            .filter(word => word.toLowerCase() !== correctAnswer.toLowerCase())
                            .slice(0, 3);
                          const allOptions = [correctAnswer, ...wrongOptions];
                          const cardId = current.cardId || current.vocabId || 0;
                          const shuffledOptions = [...allOptions].sort((a, b) => {
                            const hashA = (cardId + a.charCodeAt(0)) % 1000;
                            const hashB = (cardId + b.charCodeAt(0)) % 1000;
                            return hashA - hashB;
                          });

                          return shuffledOptions.map((opt) => (
                            <TouchableOpacity 
                              key={opt}
                              style={[styles.contextOptionButton, userAnswer === opt && styles.contextOptionButtonSelected]}
                              onPress={() => setAnswer(opt)}
                              disabled={isSubmitting}
                            >
                              <Text style={[styles.contextOptionButtonText, userAnswer === opt && styles.contextOptionButtonTextSelected]}>
                                {opt}
                              </Text>
                            </TouchableOpacity>
                          ));
                        })()}
                        <TouchableOpacity 
                          style={[styles.contextSubmitButton, (!userAnswer || isSubmitting) && styles.contextSubmitButtonDisabled]}
                          onPress={submit}
                          disabled={!userAnswer || isSubmitting}
                        >
                          <Text style={styles.contextSubmitButtonText}>
                            {isSubmitting ? '처리 중…' : '제출하기'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              }

              // 기본값: 영단어 뜻 맞추기
              return (
                <View style={styles.meaningContainer}>
                  <Text style={styles.meaningTitle}>다음 영어 단어의 뜻을 선택하세요</Text>
                  <View style={styles.meaningQuestion}>
                    <Text style={styles.meaningQuestionText}>{current.question}</Text>
                  </View>
                  
                  {!feedback && (
                    <View style={styles.meaningOptions}>
                      {current.options?.map((opt: string) => (
                        <TouchableOpacity 
                          key={opt}
                          style={[styles.meaningOptionButton, userAnswer === opt && styles.meaningOptionButtonSelected]}
                          onPress={() => setAnswer(opt)}
                          disabled={isSubmitting}
                        >
                          <Text style={[styles.meaningOptionButtonText, userAnswer === opt && styles.meaningOptionButtonTextSelected]}>
                            {opt}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity 
                        style={[styles.meaningSubmitButton, (!userAnswer || isSubmitting) && styles.meaningSubmitButtonDisabled]}
                        onPress={submit}
                        disabled={!userAnswer || isSubmitting}
                      >
                        <Text style={styles.meaningSubmitButtonText}>
                          {isSubmitting ? '처리 중…' : '제출하기'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })()}

            {feedback && (
              <View style={[styles.feedbackContainer, feedback.status === 'pass' ? styles.passFeedback : styles.failFeedback]}>
                <Text style={styles.feedbackTitle}>{feedback.status === 'pass' ? '정답입니다!' : '오답입니다'}</Text>
                <Text style={styles.feedbackAnswer}>정답: {feedback.answer}</Text>
              </View>
            )}
          </View>

          <View style={styles.quizFooter}>
            {feedback && (
              <TouchableOpacity style={styles.nextButton} onPress={next}>
                <Text style={styles.nextButtonText}>다음 →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const handleQuizTypeSelect = (type: string) => {
    // React Navigation에서는 params를 새로 전달하여 리로드
    navigation.setParams({ quizType: type });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            stopAudio();
            navigation.goBack();
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>단어 학습</Text>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => setShowSettings(true)}
        >
          <Ionicons name="settings-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>학습 데이터 로딩 중...</Text>
        </View>
      ) : err ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>퀴즈 로드 실패: {err.message}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => forceReload()}
          >
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.contentContainer}>
          {/* Part 3/3: 메인 UI 렌더링 로직 */}
          {renderMainContent()}
        </View>
      )}

      {/* 설정 모달 */}
      {showSettings && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>자동학습 설정</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>재생 횟수 (1-10회)</Text>
                <View style={styles.sliderContainer}>
                  <Text style={styles.sliderValue}>{maxPlayCount}회</Text>
                </View>
                <Text style={styles.settingDesc}>각 단어당 오디오 재생 횟수</Text>
              </View>
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>카드 뒤집기 간격</Text>
                <View style={styles.sliderContainer}>
                  <Text style={styles.sliderValue}>{flipInterval / 1000}초</Text>
                </View>
                <Text style={styles.settingDesc}>앞면에서 뒤면으로 넘어가는 시간</Text>
              </View>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.modalCloseButton} 
                onPress={() => setShowSettings(false)}
              >
                <Text style={styles.modalCloseButtonText}>닫기</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    backgroundColor: 'white',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  settingsButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#dc3545',
    textAlign: 'center',
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
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
  },
  // 퀴즈 유형 선택 스타일
  quizTypeContainer: {
    flex: 1,
    padding: 20,
  },
  quizTypeCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  quizTypeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  quizTypeDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  quizTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
  },
  quizTypeMeaning: {
    backgroundColor: '#f8f9ff',
    borderColor: '#007AFF',
  },
  quizTypeContext: {
    backgroundColor: '#f0fff4',
    borderColor: '#34C759',
  },
  quizTypeSpelling: {
    backgroundColor: '#fff8f0',
    borderColor: '#FF9500',
  },
  quizTypeMixed: {
    backgroundColor: '#fffbf0',
    borderColor: '#FFCC00',
  },
  quizTypeIcon: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  quizTypeIconText: {
    fontSize: 24,
  },
  quizTypeInfo: {
    flex: 1,
  },
  quizTypeButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  quizTypeButtonDesc: {
    fontSize: 12,
    color: '#666',
  },
  backToFolderButton: {
    alignItems: 'center',
    marginTop: 24,
    padding: 12,
  },
  backToFolderButtonText: {
    color: '#007AFF',
    fontSize: 14,
  },
  // 깜짝 퀴즈 스타일
  surpriseQuizContainer: {
    flex: 1,
    padding: 20,
  },
  surpriseQuizCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  surpriseQuizHeader: {
    backgroundColor: '#FFCC00',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  surpriseQuizTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  surpriseQuizBody: {
    padding: 24,
    alignItems: 'center',
  },
  surpriseQuizQuestion: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 24,
    textAlign: 'center',
  },
  feedbackContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  successFeedback: {
    backgroundColor: '#d1f2eb',
  },
  errorFeedback: {
    backgroundColor: '#fadbd8',
  },
  feedbackText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  correctAnswerText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  optionsContainer: {
    width: '100%',
    gap: 8,
  },
  optionButton: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: 'white',
  },
  correctOption: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  wrongOption: {
    backgroundColor: '#dc3545',
    borderColor: '#dc3545',
  },
  disabledOption: {
    backgroundColor: '#8E8E93',
    borderColor: '#8E8E93',
  },
  optionButtonText: {
    fontSize: 16,
    color: '#007AFF',
    textAlign: 'center',
  },
  disabledOptionText: {
    color: 'white',
  },
  surpriseQuizHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
  // 복습 퀴즈 스타일
  reviewQuizContainer: {
    flex: 1,
    padding: 20,
  },
  reviewQuizAlert: {
    backgroundColor: '#d1ecf1',
    borderColor: '#bee5eb',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  reviewQuizTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0c5460',
    marginBottom: 8,
  },
  reviewQuizDesc: {
    fontSize: 14,
    color: '#0c5460',
  },
  // 완료 상태 스타일
  finishedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#f8f9fa',
  },
  finishedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  finishedDesc: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  finishedButtons: {
    gap: 12,
  },
  finishedButtonPrimary: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  finishedButtonPrimaryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  finishedButtonSecondary: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#8E8E93',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  finishedButtonSecondaryText: {
    color: '#8E8E93',
    fontSize: 16,
    textAlign: 'center',
  },
  // 배치 모드 스타일
  noBatchContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noBatchTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  noBatchButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  noBatchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  batchContainer: {
    flex: 1,
    padding: 20,
  },
  batchHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  batchTitle: {
    backgroundColor: '#333',
    color: 'white',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
  },
  // 플래시 카드 공통 스타일
  flashCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  flashCardHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  flashCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  flashCardBody: {
    minHeight: 300,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  flashCardFront: {
    alignItems: 'center',
  },
  flashCardBack: {
    alignItems: 'center',
    width: '100%',
  },
  posBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 4,
  },
  posBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  posBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  flashCardQuestion: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  flashCardHint: {
    fontSize: 14,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  flashCardAnswerLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  flashCardAnswer: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  examplesContainer: {
    width: '100%',
    marginTop: 16,
  },
  examplesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  exampleContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  exampleItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  exampleEn: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  exampleKo: {
    fontSize: 14,
    color: '#666',
  },
  flashCardFooter: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  flashCardButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  flashCardButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  flashCardPrevButton: {
    flex: 1,
    backgroundColor: '#8E8E93',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  flashCardPrevButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  flashCardNextButton: {
    flex: 3,
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  flashCardNextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // 완료 화면 스타일
  completionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#f8f9fa',
  },
  completionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  completionDesc: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  completionButtons: {
    gap: 12,
  },
  completionButtonPrimary: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  completionButtonPrimaryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  completionButtonSecondary: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#8E8E93',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  completionButtonSecondaryText: {
    color: '#8E8E93',
    fontSize: 16,
    textAlign: 'center',
  },
  completionButtonWarning: {
    backgroundColor: '#FFCC00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  completionButtonWarningText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // 플래시 모드 스타일
  flashModeContainer: {
    flex: 1,
    padding: 20,
  },
  flashModeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  flashModeTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  autoPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#dee2e6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  flashModeProgress: {
    fontSize: 14,
    color: '#666',
  },
  autoPlayInfo: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  autoPlayCount: {
    backgroundColor: '#5AC8FA',
    color: 'white',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
  },
  settingsButtonSmall: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: '#8E8E93',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // 퀴즈 스타일
  quizContainer: {
    flex: 1,
    padding: 20,
  },
  quizHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  quizTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  quizProgress: {
    fontSize: 14,
    color: '#666',
  },
  quizCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  quizBody: {
    padding: 16,
  },
  // 스펙링 입력 스타일
  spellingContainer: {
    alignItems: 'center',
  },
  spellingWarning: {
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: '#ffeaa7',
    borderRadius: 8,
    padding: 16,
  },
  spellingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  spellingMeaning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
  },
  spellingMeaningIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  spellingMeaningText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  spellingWarningAlert: {
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: '#FFCC00',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  spellingWarningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 4,
  },
  spellingWarningDesc: {
    fontSize: 12,
    color: '#856404',
  },
  spellingExample: {
    width: '100%',
    marginBottom: 16,
  },
  spellingExampleText: {
    fontSize: 18,
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  blankSpace: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  spellingInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 8,
    width: 120,
    alignSelf: 'center',
  },
  spellingInputWarning: {
    borderColor: '#FFCC00',
  },
  spellingTranslation: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  noExampleAlert: {
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: '#ffeaa7',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  noExampleText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
  },
  spellingSubmitContainer: {
    alignItems: 'center',
    width: '100%',
  },
  spellingAttemptText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  spellingHintText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 16,
  },
  spellingSubmitButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  spellingSubmitButtonDisabled: {
    backgroundColor: '#8E8E93',
  },
  spellingSubmitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // 컨텍스트 모드 스타일
  contextContainer: {
    alignItems: 'center',
  },
  contextTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  contextMeaning: {
    backgroundColor: '#f8f9fa',
    padding: 24,
    borderRadius: 8,
    marginBottom: 24,
    width: '100%',
  },
  contextMeaningText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    textAlign: 'center',
  },
  noMeaningAlert: {
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: '#ffeaa7',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  noMeaningText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
  },
  contextOptions: {
    width: '100%',
    gap: 8,
  },
  contextOptionButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  contextOptionButtonSelected: {
    backgroundColor: '#007AFF',
  },
  contextOptionButtonText: {
    fontSize: 16,
    color: '#007AFF',
    textAlign: 'center',
  },
  contextOptionButtonTextSelected: {
    color: 'white',
  },
  contextSubmitButton: {
    backgroundColor: '#34C759',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  contextSubmitButtonDisabled: {
    backgroundColor: '#8E8E93',
  },
  contextSubmitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  // 의미 매칭 스타일
  meaningContainer: {
    alignItems: 'center',
  },
  meaningTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  meaningQuestion: {
    backgroundColor: '#f8f9fa',
    padding: 24,
    borderRadius: 8,
    marginBottom: 24,
    width: '100%',
  },
  meaningQuestionText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    textAlign: 'center',
  },
  meaningOptions: {
    width: '100%',
    gap: 8,
  },
  meaningOptionButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  meaningOptionButtonSelected: {
    backgroundColor: '#007AFF',
  },
  meaningOptionButtonText: {
    fontSize: 16,
    color: '#007AFF',
    textAlign: 'center',
  },
  meaningOptionButtonTextSelected: {
    color: 'white',
  },
  meaningSubmitButton: {
    backgroundColor: '#34C759',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  meaningSubmitButtonDisabled: {
    backgroundColor: '#8E8E93',
  },
  meaningSubmitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  // 피드백 스타일
  passFeedback: {
    backgroundColor: '#d1f2eb',
  },
  failFeedback: {
    backgroundColor: '#fadbd8',
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  feedbackAnswer: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
  },
  quizFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  nextButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // 모달 스타일
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    margin: 20,
    maxWidth: 400,
    width: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 16,
  },
  settingItem: {
    marginBottom: 24,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sliderContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  settingDesc: {
    fontSize: 12,
    color: '#666',
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  modalCloseButton: {
    backgroundColor: '#8E8E93',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tempText: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 16,
    color: '#666',
  },
});