// LearnVocabPart1.tsx - Helper functions and types
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  BackHandler
} from 'react-native';
import { Audio } from 'expo-av';
import _ from 'lodash';

const { width, height } = Dimensions.get('window');

// ===== TYPES =====
export interface VocabCard {
  id: number;
  word: string;
  meaning: string;
  pos?: string;
  pronunciation?: string;
  example?: string;
  translation?: string;
  difficulty?: string;
  mastered?: boolean;
  reviewCount?: number;
  lastReviewed?: Date;
  nextReview?: Date;
  folder_id?: string;
}

export interface SurpriseQuiz {
  show: boolean;
  questions: Array<{
    question: string;
    correctAnswer: string;
    options: string[];
  }>;
  currentQ: number;
  selectedAnswer: string | null;
  showFeedback: boolean;
  answers: Array<{
    question: string;
    selected: string;
    correct: string;
    isCorrect: boolean;
  }>;
}

export interface StudySession {
  mode: 'learn' | 'review' | 'quiz' | 'spelling';
  cards: VocabCard[];
  currentIndex: number;
  completed: number[];
  incorrect: number[];
  isFlipped: boolean;
  showDetail: boolean;
}

// ===== HELPER FUNCTIONS =====
export const safeFileName = (s: string | undefined | null): string => 
  encodeURIComponent(String(s ?? ''));

export const CEFR_LEVELS = {
  A1: { label: 'A1 초급', color: '#4CAF50' },
  A2: { label: 'A2 초중급', color: '#8BC34A' },
  B1: { label: 'B1 중급', color: '#FFC107' },
  B2: { label: 'B2 중상급', color: '#FF9800' },
  C1: { label: 'C1 상급', color: '#FF5722' },
  C2: { label: 'C2 최상급', color: '#F44336' }
};

export const getPosBadgeColor = (pos: string): string => {
  const colors: Record<string, string> = {
    noun: '#4A90E2',
    verb: '#50C878',
    adjective: '#FFB347',
    adverb: '#DDA0DD',
    preposition: '#F0E68C',
    conjunction: '#87CEEB',
    pronoun: '#FFB6C1',
    interjection: '#98FB98'
  };
  return colors[pos?.toLowerCase()] || '#999999';
};

export const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export const playSound = async (audioUrl: string | undefined) => {
  if (!audioUrl) return;
  
  try {
    const { sound } = await Audio.Sound.createAsync(
      { uri: audioUrl },
      { shouldPlay: true }
    );
    
    await sound.playAsync();
    
    setTimeout(() => {
      sound.unloadAsync();
    }, 3000);
  } catch (error) {
    console.error('Error playing sound:', error);
  }
};

export const generateQuizOptions = (
  correct: string,
  allOptions: string[],
  count: number = 4
): string[] => {
  const filtered = allOptions.filter(opt => opt !== correct);
  const selected = _.sampleSize(filtered, count - 1);
  const options = [...selected, correct];
  return shuffleArray(options);
};

export const calculateProgress = (
  completed: number,
  total: number
): number => {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
};

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const getNextReviewDate = (
  reviewCount: number,
  isCorrect: boolean
): Date => {
  const now = new Date();
  let daysToAdd = 1;
  
  if (isCorrect) {
    switch (reviewCount) {
      case 0: daysToAdd = 1; break;
      case 1: daysToAdd = 3; break;
      case 2: daysToAdd = 7; break;
      case 3: daysToAdd = 14; break;
      case 4: daysToAdd = 30; break;
      default: daysToAdd = 60; break;
    }
  } else {
    daysToAdd = 1;
  }
  
  now.setDate(now.getDate() + daysToAdd);
  return now;
};

// ===== CONSTANTS =====
export const QUIZ_TYPES = {
  MEANING: 'meaning',
  WORD: 'word',
  MIXED: 'mixed',
  SPELLING: 'spelling'
};

export const STUDY_MODES = {
  LEARN: 'learn',
  REVIEW: 'review',
  QUIZ: 'quiz',
  PRACTICE: 'practice'
};

export const BATCH_SIZE = 10;
export const FLIP_INTERVAL = 3000;
export const AUDIO_MAX_PLAYS = 3;

// ===== SHARED STYLES =====
export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  
  button: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  
  progressBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden'
  },
  
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 3
  },
  
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start'
  },
  
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600'
  }
});