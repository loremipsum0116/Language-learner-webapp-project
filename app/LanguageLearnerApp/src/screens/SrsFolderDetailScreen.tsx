/*
  SrsFolderDetailScreen.tsx — React Native 버전 (Part 1/3)
  ------------------------------------------------------------
  웹 SrsFolderDetail.jsx를 모바일 앱에 맞게 리팩토링
  Part 1/3: 헬퍼 함수, 인터페이스, 기본 구조
*/

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../services/apiClient';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SrsFolderDetail'>;

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// TypeScript 인터페이스 (Part 1/3)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

interface SrsCard {
  id: number;
  userId: number;
  itemType: string;
  itemId: number;
  stage: number;
  nextReviewAt: string;
  waitingUntil?: string;
  createdAt: string;
  updatedAt: string;
  isOverdue: boolean;
  overdueDeadline?: string;
  isFromWrongAnswer: boolean;
  frozenUntil?: string;
  isFrozen: boolean;
  isMastered: boolean;
  masterCycles: number;
  masteredAt?: string;
  correctTotal: number;
  wrongTotal: number;
  vocab?: {
    id: number;
    lemma: string;
    pos: string;
    ko_gloss?: string;
    levelCEFR?: string;
    ipa?: string;
    ipaKo?: string;
    dictMeta?: {
      ipa?: string;
      ipaKo?: string;
    };
    dictentry?: {
      audioUrl?: string;
      audioLocal?: string;
      examples?: any[];
    };
    audio?: string;
  };
}

interface FolderInfo {
  id: number;
  name: string;
  parentId?: number;
  parentName?: string;
  isWrongAnswerFolder: boolean;
  totalCards: number;
  overdueCards: number;
  availableCards: number;
  frozenCards: number;
  masteredCards: number;
  waitingCards: number;
}

interface PlayingAudio {
  type: 'vocab';
  id: number;
}

type ViewMode = 'all' | 'overdue' | 'available' | 'waiting' | 'frozen' | 'mastered';
type SortBy = 'nextReviewAt' | 'stage' | 'createdAt' | 'lemma' | 'wrongTotal';

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 헬퍼 함수들 (Part 1/3)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const getSrsStatusBadge = (card: SrsCard) => {
  const now = new Date();

  // 마스터 완료 확인
  if (card.isMastered) {
    return { text: '마스터 완료', color: '#ffc107', textColor: '#333' };
  }

  // 동결 상태 확인 (최우선)
  if (card.frozenUntil && new Date(card.frozenUntil) > now) {
    const hoursLeft = Math.ceil((new Date(card.frozenUntil).getTime() - now.getTime()) / (1000 * 60 * 60));
    return { text: `동결 중 (${hoursLeft}h)`, color: '#0dcaf0', textColor: 'white' };
  }

  // overdue 상태 확인 (동결 다음 우선순위)
  if (card.isOverdue) {
    return { text: '복습 필요', color: '#dc3545', textColor: 'white' };
  }

  // 대기 시간 확인 (waitingUntil 기준)
  if (card.waitingUntil) {
    const waitingUntil = new Date(card.waitingUntil);
    if (now < waitingUntil) {
      // 아직 대기 중
      const hoursLeft = Math.ceil((waitingUntil.getTime() - now.getTime()) / (1000 * 60 * 60));
      if (card.isFromWrongAnswer) {
        return { text: `오답 대기 중 (${hoursLeft}h)`, color: '#ffc107', textColor: '#333' };
      } else {
        return { text: `Stage ${card.stage} 대기 중 (${hoursLeft}h)`, color: '#0d6efd', textColor: 'white' };
      }
    } else {
      // 대기 시간 완료 - 즉시 복습 가능
      return { text: '복습 가능', color: '#198754', textColor: 'white' };
    }
  }

  // nextReviewAt 기준 확인 (하위 호환성)
  if (card.nextReviewAt) {
    const nextReviewAt = new Date(card.nextReviewAt);
    const hoursLeft = Math.ceil((nextReviewAt.getTime() - now.getTime()) / (1000 * 60 * 60));
    if (now < nextReviewAt) {
      return { text: `Stage ${card.stage} (${hoursLeft}h)`, color: '#0d6efd', textColor: 'white' };
    } else {
      return { text: '복습 가능', color: '#198754', textColor: 'white' };
    }
  }

  // 기본값 (stage 0 또는 정보 부족)
  return { text: '학습 대기 중', color: '#6c757d', textColor: 'white' };
};

const formatTimeRemaining = (hours: number): string => {
  if (hours <= 0) return '지금';
  if (hours < 24) return `${Math.ceil(hours)}시간 후`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours === 0) return `${days}일 후`;
  return `${days}일 ${Math.ceil(remainingHours)}시간 후`;
};

const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

const formatDateTimeShort = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

const safeFileName = (str: string): string => {
  if (!str) return '';
  return encodeURIComponent(str.toLowerCase().replace(/\s+/g, '_'));
};

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 컴포넌트들 (Part 1/3)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

// 발음 표기 컴포넌트
interface PronProps {
  ipa?: string;
  ipaKo?: string;
}

const PronComponent: React.FC<PronProps> = ({ ipa, ipaKo }) => {
  if (!ipa) return null;
  
  return (
    <View style={styles.pronContainer}>
      <Text style={styles.pronText}>/{ipa}/</Text>
      {ipaKo && <Text style={styles.pronKoText}> {ipaKo}</Text>}
    </View>
  );
};

// SRS 카드 컴포넌트
interface SrsCardItemProps {
  card: SrsCard;
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
  onPlayAudio: (card: SrsCard) => void;
  playingAudio: PlayingAudio | null;
}

const SrsCardItem: React.FC<SrsCardItemProps> = ({
  card,
  isSelected,
  onToggleSelect,
  onPlayAudio,
  playingAudio
}) => {
  const { vocab } = card;
  if (!vocab) return null;

  const statusBadge = getSrsStatusBadge(card);
  const isPlaying = playingAudio?.type === 'vocab' && playingAudio?.id === vocab.id;

  return (
    <View style={[
      styles.cardItem,
      isSelected && styles.cardItemSelected,
      card.isMastered && styles.cardItemMastered
    ]}>
      {/* 마스터 표시 */}
      {card.isMastered && (
        <View style={styles.masterBadge}>
          <Text style={styles.masterBadgeText}>⭐ {card.masterCycles}</Text>
        </View>
      )}

      {/* 선택 체크박스 */}
      <TouchableOpacity 
        style={styles.checkboxContainer}
        onPress={() => onToggleSelect(card.id)}
      >
        <Ionicons 
          name={isSelected ? 'checkbox' : 'square-outline'} 
          size={24} 
          color={isSelected ? '#007AFF' : '#8E8E93'} 
        />
      </TouchableOpacity>

      {/* 카드 내용 */}
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.vocabLemma}>{vocab.lemma}</Text>
          <View style={styles.cardBadges}>
            {vocab.levelCEFR && (
              <View style={[styles.cefrBadge, { backgroundColor: getCefrColor(vocab.levelCEFR) }]}>
                <Text style={styles.cefrBadgeText}>{vocab.levelCEFR}</Text>
              </View>
            )}
            <View style={[styles.statusBadge, { backgroundColor: statusBadge.color }]}>
              <Text style={[styles.statusBadgeText, { color: statusBadge.textColor }]}>
                {statusBadge.text}
              </Text>
            </View>
          </View>
        </View>

        <PronComponent ipa={vocab.dictMeta?.ipa || vocab.ipa} ipaKo={vocab.dictMeta?.ipaKo || vocab.ipaKo} />
        <Text style={styles.vocabMeaning}>{vocab.ko_gloss || '뜻 정보 없음'}</Text>

        <View style={styles.cardStats}>
          <Text style={styles.statText}>Stage {card.stage}</Text>
          <Text style={styles.statText}>정답 {card.correctTotal}</Text>
          <Text style={styles.statText}>오답 {card.wrongTotal}</Text>
          {card.nextReviewAt && (
            <Text style={styles.reviewTimeText}>
              {formatDateTimeShort(card.nextReviewAt)}
            </Text>
          )}
        </View>
      </View>

      {/* 오디오 재생 버튼 */}
      <TouchableOpacity
        style={styles.audioButton}
        onPress={() => onPlayAudio(card)}
      >
        <Ionicons 
          name={isPlaying ? 'pause' : 'play'} 
          size={16} 
          color="#0dcaf0" 
        />
      </TouchableOpacity>
    </View>
  );
};

const getCefrColor = (level: string): string => {
  switch (level) {
    case 'A1': return '#dc3545';
    case 'A2': return '#ffc107';
    case 'B1': return '#198754';
    case 'B2': return '#0dcaf0';
    case 'C1': return '#0d6efd';
    case 'C2': return '#212529';
    default: return '#6c757d';
  }
};

// Part 1/3 스타일 정의
const styles = StyleSheet.create({
  // 기본 컨테이너
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },

  // 헤더
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },

  // 발음
  pronContainer: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  pronText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  pronKoText: {
    fontSize: 12,
    color: '#999',
  },

  // 카드 아이템
  cardItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#e9ecef',
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardItemSelected: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  cardItemMastered: {
    borderColor: '#ffc107',
    backgroundColor: '#fffbf0',
  },

  // 마스터 뱃지
  masterBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ffc107',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 10,
  },
  masterBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333',
  },

  // 체크박스
  checkboxContainer: {
    paddingTop: 4,
  },

  // 카드 내용
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  vocabLemma: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  cardBadges: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  cefrBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cefrBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  vocabMeaning: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },

  // 카드 통계
  cardStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  statText: {
    fontSize: 12,
    color: '#666',
  },
  reviewTimeText: {
    fontSize: 12,
    color: '#0dcaf0',
  },

  // 오디오 버튼
  audioButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#0dcaf0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginTop: 4,
  },
});

export type {
  SrsCard,
  FolderInfo,
  PlayingAudio,
  ViewMode,
  SortBy,
  Props,
};

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 메인 컴포넌트 로직 (Part 2/3)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

export default function SrsFolderDetailScreen({ route, navigation }: Props) {
  const { folderId } = route.params;
  const { user } = useAuth();
  
  // 상태 관리
  const [folderInfo, setFolderInfo] = useState<FolderInfo | null>(null);
  const [cards, setCards] = useState<SrsCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [sortBy, setSortBy] = useState<SortBy>('nextReviewAt');
  const [playingAudio, setPlayingAudio] = useState<PlayingAudio | null>(null);
  const [displayCount, setDisplayCount] = useState(50);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [bulkActionsModalOpen, setBulkActionsModalOpen] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);

  // Audio 관련 상태
  const [sound, setSound] = useState<Audio.Sound>();

  // ──────────────────────────────────────────────────────────────────────────────────────────────
  // 데이터 로딩 로직 (Part 2/3)
  // ──────────────────────────────────────────────────────────────────────────────────────────────

  const loadFolderInfo = useCallback(async () => {
    try {
      const response = await apiClient.get(`/srs/folders/${folderId}`);
      const data = response.data?.data || response.data;
      setFolderInfo(data);
    } catch (error) {
      console.error('Failed to load folder info:', error);
      Alert.alert('오류', '폴더 정보를 불러오는데 실패했습니다.');
    }
  }, [folderId]);

  const loadCards = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/srs/folders/${folderId}/cards?sort=${sortBy}&view=${viewMode}`);
      const data = response.data?.data || response.data;
      setCards(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load cards:', error);
      setCards([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [folderId, sortBy, viewMode]);

  useEffect(() => {
    if (user && folderId) {
      Promise.all([loadFolderInfo(), loadCards()]);
    }
  }, [user, folderId, loadFolderInfo, loadCards]);

  // ──────────────────────────────────────────────────────────────────────────────────────────────
  // 필터링 및 정렬 로직 (Part 2/3)
  // ──────────────────────────────────────────────────────────────────────────────────────────────

  const filteredAndSortedCards = useMemo(() => {
    let filtered = cards;

    // 검색 필터
    if (searchTerm.trim()) {
      const needle = searchTerm.trim().toLowerCase();
      filtered = filtered.filter(card =>
        card.vocab?.lemma.toLowerCase().includes(needle) ||
        (card.vocab?.ko_gloss && card.vocab.ko_gloss.toLowerCase().includes(needle))
      );
    }

    // 뷰 모드 필터
    const now = new Date();
    switch (viewMode) {
      case 'overdue':
        filtered = filtered.filter(card => card.isOverdue);
        break;
      case 'available':
        filtered = filtered.filter(card => {
          if (card.isMastered || card.isOverdue) return false;
          if (card.frozenUntil && new Date(card.frozenUntil) > now) return false;
          
          const waitingTime = card.waitingUntil ? new Date(card.waitingUntil) : 
                              card.nextReviewAt ? new Date(card.nextReviewAt) : null;
          return waitingTime ? waitingTime <= now : true;
        });
        break;
      case 'waiting':
        filtered = filtered.filter(card => {
          if (card.isMastered || card.isOverdue) return false;
          if (card.frozenUntil && new Date(card.frozenUntil) > now) return false;
          
          const waitingTime = card.waitingUntil ? new Date(card.waitingUntil) : 
                              card.nextReviewAt ? new Date(card.nextReviewAt) : null;
          return waitingTime ? waitingTime > now : false;
        });
        break;
      case 'frozen':
        filtered = filtered.filter(card => 
          card.frozenUntil && new Date(card.frozenUntil) > now
        );
        break;
      case 'mastered':
        filtered = filtered.filter(card => card.isMastered);
        break;
      case 'all':
      default:
        // 모든 카드 표시
        break;
    }

    // 정렬
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'nextReviewAt':
          const aTime = a.waitingUntil || a.nextReviewAt || a.createdAt;
          const bTime = b.waitingUntil || b.nextReviewAt || b.createdAt;
          return new Date(aTime).getTime() - new Date(bTime).getTime();
        case 'stage':
          return a.stage - b.stage;
        case 'createdAt':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'lemma':
          return (a.vocab?.lemma || '').localeCompare(b.vocab?.lemma || '');
        case 'wrongTotal':
          return b.wrongTotal - a.wrongTotal;
        default:
          return 0;
      }
    });

    return filtered.slice(0, displayCount);
  }, [cards, searchTerm, viewMode, sortBy, displayCount]);

  // ──────────────────────────────────────────────────────────────────────────────────────────────
  // 오디오 관련 함수들 (Part 2/3)
  // ──────────────────────────────────────────────────────────────────────────────────────────────

  const stopAudio = async () => {
    if (sound) {
      await sound.unloadAsync();
      setSound(undefined);
    }
    setPlayingAudio(null);
  };

  const playUrl = async (url: string, type: 'vocab', id: number) => {
    if (!url) return;
    if (playingAudio && playingAudio.id === id) {
      await stopAudio();
      return;
    }
    await stopAudio();

    const fullUrl = url.startsWith('/') ? `${apiClient.defaults.baseURL}${url}` : url;
    
    try {
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: fullUrl },
        { shouldPlay: true }
      );
      
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingAudio(null);
        }
      });
      
      setSound(newSound);
      setPlayingAudio({ type, id });
    } catch (e) {
      console.error("오디오 재생 실패:", e, fullUrl);
      setPlayingAudio(null);
    }
  };

  const playVocabAudio = async (card: SrsCard) => {
    const vocab = card.vocab;
    if (!vocab) return;
    
    // CEFR 레벨을 실제 폴더명으로 매핑
    const cefrToFolder: { [key: string]: string } = {
      'A1': 'starter',
      'A2': 'elementary', 
      'B1': 'intermediate',
      'B2': 'upper',
      'C1': 'advanced',
      'C2': 'advanced'
    };
    
    // 1. cefr_vocabs.json의 audio 경로 사용 (최우선)
    const audioData = vocab.dictentry?.audioLocal ? JSON.parse(vocab.dictentry.audioLocal) : null;
    const wordAudioPath = audioData?.example || audioData?.word;
    
    if (wordAudioPath) {
      const absolutePath = wordAudioPath.startsWith('/') ? wordAudioPath : `/${wordAudioPath}`;
      await playUrl(absolutePath, 'vocab', vocab.id);
      return;
    }
    
    // 2. 기존 방식 (폴백)
    const targetUrl = vocab.audio || vocab.dictentry?.audioUrl;
    if (targetUrl) {
      await playUrl(targetUrl, 'vocab', vocab.id);
      return;
    }
    
    // 3. 레거시 로컬 오디오 패스 생성 (최종 폴백)
    const folderName = cefrToFolder[vocab.levelCEFR || 'A1'] || 'starter';
    const localAudioPath = `/${folderName}/${safeFileName(vocab.lemma)}/example.mp3`;
    await playUrl(localAudioPath, 'vocab', vocab.id);
  };

  // Audio cleanup
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  // ──────────────────────────────────────────────────────────────────────────────────────────────
  // 핸들러 함수들 (Part 2/3)  
  // ──────────────────────────────────────────────────────────────────────────────────────────────

  const handleToggleSelect = (cardId: number) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredAndSortedCards.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedCards.map(card => card.id)));
    }
  };

  const handleStartLearning = (mode: 'srs_folder' | 'flash') => {
    if (selectedIds.size === 0) {
      Alert.alert('알림', '학습할 카드를 선택해주세요.');
      return;
    }

    if (selectedIds.size > 100) {
      Alert.alert('알림', '한 번에 100개를 초과하여 학습할 수 없습니다. 100개 이하로 선택해주세요.');
      return;
    }

    const selectedCards = filteredAndSortedCards.filter(card => selectedIds.has(card.id));
    const vocabIds = selectedCards.map(card => card.vocab?.id).filter(Boolean);

    const params: any = {
      mode,
      folderId: folderId.toString(),
      selectedItems: vocabIds.join(','),
    };

    if (mode === 'flash') {
      params.auto = '1';
    }

    navigation.navigate('LearnVocab', params);
  };

  const handleBulkAction = async (action: string) => {
    const selectedCards = filteredAndSortedCards.filter(card => selectedIds.has(card.id));
    
    if (selectedCards.length === 0) {
      Alert.alert('알림', '작업할 카드를 선택해주세요.');
      return;
    }

    try {
      switch (action) {
        case 'freeze':
          await apiClient.post('/srs/cards/bulk-freeze', {
            cardIds: Array.from(selectedIds),
            hours: 24
          });
          Alert.alert('성공', `${selectedCards.length}개 카드가 24시간 동결되었습니다.`);
          break;
        
        case 'unfreeze':
          await apiClient.post('/srs/cards/bulk-unfreeze', {
            cardIds: Array.from(selectedIds)
          });
          Alert.alert('성공', `${selectedCards.length}개 카드의 동결이 해제되었습니다.`);
          break;
        
        case 'reset':
          Alert.alert(
            '확인',
            `선택한 ${selectedCards.length}개 카드를 Stage 0으로 초기화하시겠습니까?`,
            [
              { text: '취소', style: 'cancel' },
              {
                text: '초기화',
                style: 'destructive',
                onPress: async () => {
                  await apiClient.post('/srs/cards/bulk-reset', {
                    cardIds: Array.from(selectedIds)
                  });
                  Alert.alert('성공', `${selectedCards.length}개 카드가 초기화되었습니다.`);
                  await loadCards();
                }
              }
            ]
          );
          return;
        
        case 'delete':
          Alert.alert(
            '삭제 확인',
            `선택한 ${selectedCards.length}개 카드를 삭제하시겠습니까?`,
            [
              { text: '취소', style: 'cancel' },
              {
                text: '삭제',
                style: 'destructive',
                onPress: async () => {
                  await apiClient.post('/srs/cards/bulk-delete', {
                    cardIds: Array.from(selectedIds)
                  });
                  Alert.alert('성공', `${selectedCards.length}개 카드가 삭제되었습니다.`);
                  await Promise.all([loadFolderInfo(), loadCards()]);
                  setSelectedIds(new Set());
                }
              }
            ]
          );
          return;
      }
      
      await loadCards();
      setBulkActionsModalOpen(false);
    } catch (error: any) {
      Alert.alert('오류', `작업 실패: ${error.message}`);
    }
  };

  const handleLoadMore = () => {
    setDisplayCount(prev => prev + 50);
  };

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([loadFolderInfo(), loadCards()]);
  };

  // ──────────────────────────────────────────────────────────────────────────────────────────────
  // 계산된 값들 (Part 2/3)
  // ──────────────────────────────────────────────────────────────────────────────────────────────

  const isAllSelected = useMemo(() => {
    if (filteredAndSortedCards.length === 0) return false;
    return filteredAndSortedCards.every(card => selectedIds.has(card.id));
  }, [filteredAndSortedCards, selectedIds]);

  const getViewModeCount = (mode: ViewMode): number => {
    if (!folderInfo) return 0;
    switch (mode) {
      case 'overdue': return folderInfo.overdueCards;
      case 'available': return folderInfo.availableCards;
      case 'waiting': return folderInfo.waitingCards;
      case 'frozen': return folderInfo.frozenCards;
      case 'mastered': return folderInfo.masteredCards;
      case 'all': return folderInfo.totalCards;
      default: return 0;
    }
  };

  // ──────────────────────────────────────────────────────────────────────────────────────────────
  // UI 렌더링 (Part 3/3)
  // ──────────────────────────────────────────────────────────────────────────────────────────────

  const renderCard = ({ item }: { item: SrsCard }) => (
    <SrsCardItem
      key={item.id}
      card={item}
      isSelected={selectedIds.has(item.id)}
      onToggleSelect={handleToggleSelect}
      onPlayAudio={playVocabAudio}
      playingAudio={playingAudio}
    />
  );

  if (!folderInfo && !loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>폴더를 찾을 수 없습니다.</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>뒤로 가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>
              {folderInfo?.parentName ? `${folderInfo.parentName} > ` : ''}
              {folderInfo?.name || '폴더'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {folderInfo?.isWrongAnswerFolder ? '⚠️ 오답 폴더' : 'SRS 학습 폴더'}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setSettingsModalOpen(true)}
          >
            <Ionicons name="settings-outline" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 폴더 통계 */}
      {folderInfo && (
        <View style={styles.statsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.statsRow}>
              <TouchableOpacity
                style={[styles.statItem, viewMode === 'all' && styles.activeStatItem]}
                onPress={() => setViewMode('all')}
              >
                <Text style={styles.statNumber}>{folderInfo.totalCards}</Text>
                <Text style={styles.statLabel}>전체</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statItem, viewMode === 'overdue' && styles.activeStatItem]}
                onPress={() => setViewMode('overdue')}
              >
                <Text style={[styles.statNumber, styles.overdueNumber]}>
                  {folderInfo.overdueCards}
                </Text>
                <Text style={styles.statLabel}>복습 필요</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statItem, viewMode === 'available' && styles.activeStatItem]}
                onPress={() => setViewMode('available')}
              >
                <Text style={[styles.statNumber, styles.availableNumber]}>
                  {folderInfo.availableCards}
                </Text>
                <Text style={styles.statLabel}>복습 가능</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statItem, viewMode === 'waiting' && styles.activeStatItem]}
                onPress={() => setViewMode('waiting')}
              >
                <Text style={[styles.statNumber, styles.waitingNumber]}>
                  {folderInfo.waitingCards}
                </Text>
                <Text style={styles.statLabel}>대기 중</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statItem, viewMode === 'frozen' && styles.activeStatItem]}
                onPress={() => setViewMode('frozen')}
              >
                <Text style={[styles.statNumber, styles.frozenNumber]}>
                  {folderInfo.frozenCards}
                </Text>
                <Text style={styles.statLabel}>동결</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statItem, viewMode === 'mastered' && styles.activeStatItem]}
                onPress={() => setViewMode('mastered')}
              >
                <Text style={[styles.statNumber, styles.masteredNumber]}>
                  {folderInfo.masteredCards}
                </Text>
                <Text style={styles.statLabel}>마스터</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}

      {/* 액션 버튼들 */}
      <View style={styles.actionContainer}>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.learningButton,
              selectedIds.size === 0 && styles.learningButtonDisabled
            ]}
            onPress={() => handleStartLearning('srs_folder')}
            disabled={selectedIds.size === 0}
          >
            <Text style={styles.learningButtonText}>
              SRS 학습 {selectedIds.size > 0 && `(${selectedIds.size}개)`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.flashButton,
              selectedIds.size === 0 && styles.flashButtonDisabled
            ]}
            onPress={() => handleStartLearning('flash')}
            disabled={selectedIds.size === 0}
          >
            <Text style={styles.flashButtonText}>
              자동학습 {selectedIds.size > 0 && `(${selectedIds.size}개)`}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.selectAllButton}
            onPress={handleSelectAll}
          >
            <Text style={styles.selectAllButtonText}>
              {isAllSelected ? '전체 해제' : '전체 선택'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.bulkActionButton,
              selectedIds.size === 0 && styles.bulkActionButtonDisabled
            ]}
            onPress={() => setBulkActionsModalOpen(true)}
            disabled={selectedIds.size === 0}
          >
            <Text style={styles.bulkActionButtonText}>
              일괄 작업 {selectedIds.size > 0 && `(${selectedIds.size}개)`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 검색 및 정렬 */}
      <View style={styles.filterContainer}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="단어 또는 뜻으로 검색"
            value={searchTerm}
            onChangeText={setSearchTerm}
            returnKeyType="search"
          />
        </View>

        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setSettingsModalOpen(true)}
        >
          <Text style={styles.sortButtonText}>정렬</Text>
          <Ionicons name="chevron-down" size={16} color="#666" />
        </TouchableOpacity>
      </View>

      {/* 카드 목록 */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>카드 로딩 중...</Text>
        </View>
      ) : filteredAndSortedCards.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>
            {searchTerm ? '검색 결과가 없습니다' : '카드가 없습니다'}
          </Text>
          <Text style={styles.emptyText}>
            {searchTerm 
              ? '다른 검색어를 시도해보세요' 
              : '이 폴더에 학습할 카드가 없습니다'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredAndSortedCards}
          renderItem={renderCard}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            !loading && cards.length > displayCount ? (
              <TouchableOpacity style={styles.loadMoreButton} onPress={handleLoadMore}>
                <Text style={styles.loadMoreButtonText}>
                  더 보기 ({cards.length - displayCount}개 더)
                </Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {/* 설정 모달 */}
      <Modal
        visible={settingsModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSettingsModalOpen(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>설정</Text>
            <TouchableOpacity onPress={() => setSettingsModalOpen(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.modalBody}>
              <Text style={styles.sectionTitle}>정렬 기준</Text>
              {[
                { key: 'nextReviewAt' as SortBy, label: '복습 시간' },
                { key: 'stage' as SortBy, label: 'Stage' },
                { key: 'createdAt' as SortBy, label: '생성 날짜' },
                { key: 'lemma' as SortBy, label: '단어 (가나다순)' },
                { key: 'wrongTotal' as SortBy, label: '오답 횟수' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.optionItem,
                    sortBy === option.key && styles.activeOptionItem
                  ]}
                  onPress={() => {
                    setSortBy(option.key);
                    setSettingsModalOpen(false);
                  }}
                >
                  <Text style={[
                    styles.optionText,
                    sortBy === option.key && styles.activeOptionText
                  ]}>
                    {option.label}
                  </Text>
                  {sortBy === option.key && (
                    <Ionicons name="checkmark" size={20} color="#007AFF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* 일괄 작업 모달 */}
      <Modal
        visible={bulkActionsModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setBulkActionsModalOpen(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>일괄 작업</Text>
            <TouchableOpacity onPress={() => setBulkActionsModalOpen(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.modalBody}>
              <Text style={styles.modalDescription}>
                선택한 {selectedIds.size}개 카드에 적용할 작업을 선택하세요.
              </Text>

              <TouchableOpacity
                style={styles.bulkActionOption}
                onPress={() => handleBulkAction('freeze')}
              >
                <View style={styles.bulkActionIcon}>
                  <Text style={styles.bulkActionEmoji}>❄️</Text>
                </View>
                <View style={styles.bulkActionContent}>
                  <Text style={styles.bulkActionTitle}>24시간 동결</Text>
                  <Text style={styles.bulkActionDesc}>
                    선택한 카드들을 24시간 동안 학습에서 제외합니다.
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.bulkActionOption}
                onPress={() => handleBulkAction('unfreeze')}
              >
                <View style={styles.bulkActionIcon}>
                  <Text style={styles.bulkActionEmoji}>🔥</Text>
                </View>
                <View style={styles.bulkActionContent}>
                  <Text style={styles.bulkActionTitle}>동결 해제</Text>
                  <Text style={styles.bulkActionDesc}>
                    동결된 카드들의 동결 상태를 해제합니다.
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.bulkActionOption}
                onPress={() => handleBulkAction('reset')}
              >
                <View style={styles.bulkActionIcon}>
                  <Text style={styles.bulkActionEmoji}>🔄</Text>
                </View>
                <View style={styles.bulkActionContent}>
                  <Text style={styles.bulkActionTitle}>Stage 초기화</Text>
                  <Text style={styles.bulkActionDesc}>
                    선택한 카드들을 Stage 0으로 초기화합니다.
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.bulkActionOption, styles.dangerOption]}
                onPress={() => handleBulkAction('delete')}
              >
                <View style={styles.bulkActionIcon}>
                  <Text style={styles.bulkActionEmoji}>🗑️</Text>
                </View>
                <View style={styles.bulkActionContent}>
                  <Text style={[styles.bulkActionTitle, styles.dangerText]}>삭제</Text>
                  <Text style={styles.bulkActionDesc}>
                    선택한 카드들을 완전히 삭제합니다. (복구 불가)
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}