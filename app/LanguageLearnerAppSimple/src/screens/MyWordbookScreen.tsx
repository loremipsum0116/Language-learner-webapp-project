/*
  MyWordbookScreen.tsx — React Native 버전 (Part 1/3)
  ------------------------------------------------------------
  웹 MyWordbook.jsx를 모바일 앱에 맞게 리팩토링
  Part 1/3: 헬퍼 함수, 인터페이스, 컴포넌트들
*/

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import Icon from 'react-native-vector-icons/Ionicons';
import { Audio } from 'expo-av';

import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../services/apiClient';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MyWordbook'>;

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// TypeScript 인터페이스 (Part 1/3)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

interface WordbookItem {
  id: number;
  vocabId: number;
  vocab: {
    id: number;
    lemma: string;
    pos?: string;
    ipa?: string;
    ipaKo?: string;
    ko_gloss?: string;
    levelCEFR?: string;
    dictMeta?: {
      ipa?: string;
      ipaKo?: string;
    };
    dictentry?: {
      audioUrl?: string;
      audioLocal?: string;
    };
    audio?: string;
  };
}

interface Category {
  id: number;
  name: string;
  count: number;
}

interface MasteredCard {
  id: number;
  itemType: string;
  itemId: number;
  masterCycles: number;
  masteredAt: string;
}

interface PlayingAudio {
  type: 'vocab';
  id: number;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 헬퍼 함수들 (Part 1/3)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const getCefrBadgeColor = (level: string): string => {
  switch (level) {
    case 'A1': return '#dc3545'; // danger
    case 'A2': return '#ffc107'; // warning
    case 'B1': return '#198754'; // success
    case 'B2': return '#0dcaf0'; // info
    case 'C1': return '#0d6efd'; // primary
    case 'C2': return '#212529'; // dark
    default: return '#6c757d'; // secondary
  }
};

const getPosBadgeColor = (pos: string): string => {
  if (!pos) return '#6c757d';
  switch (pos.toLowerCase().trim()) {
    case 'noun': return '#0d6efd';
    case 'verb': return '#198754';
    case 'adjective': return '#ffc107';
    case 'adverb': return '#0dcaf0';
    case 'preposition': return '#dc3545';
    default: return '#6c757d';
  }
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

// 새 폴더 생성 컴포넌트
interface NewCategoryFormProps {
  onCreated: () => Promise<void>;
}

const NewCategoryForm: React.FC<NewCategoryFormProps> = ({ onCreated }) => {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const n = name.trim();
    if (!n) return;
    
    try {
      setBusy(true);
      await apiClient.post('/categories', { name: n });
      setName('');
      await onCreated();
      Alert.alert('성공', '새 폴더가 생성되었습니다.');
    } catch (e: any) {
      Alert.alert('오류', `폴더 생성 실패: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.newCategoryForm}>
      <TextInput
        style={styles.newCategoryInput}
        placeholder="새 폴더 이름"
        value={name}
        onChangeText={setName}
      />
      <TouchableOpacity
        style={[
          styles.newCategoryButton,
          (!name.trim() || busy) && styles.newCategoryButtonDisabled
        ]}
        onPress={submit}
        disabled={busy || !name.trim()}
      >
        {busy ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={styles.newCategoryButtonText}>추가</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

// 단어 카드 컴포넌트
interface WordCardProps {
  item: WordbookItem;
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
  onPlayAudio: (item: WordbookItem) => void;
  onOpenDetail: (id: number) => void;
  onAddToSRS: (id: number) => void;
  playingAudio: PlayingAudio | null;
  masteredCards: MasteredCard[];
}

const WordCard: React.FC<WordCardProps> = ({
  item,
  isSelected,
  onToggleSelect,
  onPlayAudio,
  onOpenDetail,
  onAddToSRS,
  playingAudio,
  masteredCards
}) => {
  const { vocab } = item;
  const gloss = vocab.ko_gloss || '뜻 정보 없음';
  const uniquePosList = [...new Set(vocab.pos ? vocab.pos.split(',').map(p => p.trim()) : [])];
  
  // 마스터된 카드 정보 찾기
  const masteredCard = masteredCards.find(card => card.itemType === 'vocab' && card.itemId === item.vocabId);
  const isMastered = !!masteredCard;
  const masterCycles = masteredCard?.masterCycles || 0;
  const isPlaying = playingAudio?.type === 'vocab' && playingAudio?.id === item.vocabId;

  return (
    <View style={[
      styles.wordCard,
      isSelected && styles.wordCardSelected,
      isMastered && styles.wordCardMastered
    ]}>
      {/* 마스터 표시 */}
      {isMastered && (
        <View style={styles.masterBadge}>
          <Text style={styles.masterBadgeText}>⭐ {masterCycles}</Text>
        </View>
      )}

      {/* 선택 체크박스 */}
      <TouchableOpacity 
        style={styles.checkboxContainer}
        onPress={() => onToggleSelect(item.vocabId)}
      >
        <Icon 
          name={isSelected ? 'checkbox' : 'square-outline'} 
          size={24} 
          color={isSelected ? '#007AFF' : '#8E8E93'} 
        />
      </TouchableOpacity>

      {/* 카드 내용 */}
      <TouchableOpacity 
        style={styles.wordCardContent}
        onPress={() => onOpenDetail(item.vocabId)}
        activeOpacity={0.7}
      >
        <View style={styles.wordCardHeader}>
          <Text style={styles.wordLemma}>{vocab.lemma}</Text>
          <View style={styles.badgeContainer}>
            {vocab.levelCEFR && (
              <View style={[styles.badge, { backgroundColor: getCefrBadgeColor(vocab.levelCEFR) }]}>
                <Text style={styles.badgeText}>{vocab.levelCEFR}</Text>
              </View>
            )}
            {uniquePosList.map(p => (
              p && p.toLowerCase() !== 'unk' && (
                <View key={p} style={[styles.badge, { backgroundColor: getPosBadgeColor(p) }]}>
                  <Text style={styles.badgeText}>{p}</Text>
                </View>
              )
            ))}
            {isMastered && (
              <View style={[styles.badge, { backgroundColor: '#ffc107' }]}>
                <Text style={[styles.badgeText, { color: '#333' }]}>🌟 마스터</Text>
              </View>
            )}
          </View>
        </View>
        
        <PronComponent ipa={vocab.dictMeta?.ipa || vocab.ipa} ipaKo={vocab.dictMeta?.ipaKo || vocab.ipaKo} />
        <Text style={styles.wordMeaning}>{gloss}</Text>
      </TouchableOpacity>

      {/* 액션 버튼들 */}
      <View style={styles.wordCardFooter}>
        <View style={styles.actionButtonsLeft}>
          <TouchableOpacity
            style={styles.detailButton}
            onPress={() => onOpenDetail(item.vocabId)}
          >
            <Text style={styles.detailButtonText}>상세</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.srsButton}
            onPress={() => onAddToSRS(item.vocabId)}
          >
            <Text style={styles.srsButtonText}>+ SRS</Text>
          </TouchableOpacity>
        </View>

        {/* 오디오 재생 버튼 */}
        <TouchableOpacity
          style={styles.audioButton}
          onPress={() => onPlayAudio(item)}
        >
          <Icon 
            name={isPlaying ? 'pause' : 'play'} 
            size={16} 
            color="#0dcaf0" 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Part 1/3 스타일 정의
const styles = StyleSheet.create({
  // 기본 컨테이너
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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

  // 새 카테고리 폼
  newCategoryForm: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 8,
  },
  newCategoryInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    fontSize: 14,
    color: '#333',
  },
  newCategoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newCategoryButtonDisabled: {
    backgroundColor: '#e9ecef',
  },
  newCategoryButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },

  // 단어 카드
  wordCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#e9ecef',
    position: 'relative',
  },
  wordCardSelected: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  wordCardMastered: {
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
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 5,
  },

  // 카드 내용
  wordCardContent: {
    paddingRight: 40,
  },
  wordCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  wordLemma: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },

  // 뱃지 컨테이너
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },

  // 의미
  wordMeaning: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },

  // 카드 푸터
  wordCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButtonsLeft: {
    flexDirection: 'row',
    gap: 8,
  },

  // 버튼들
  detailButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#6c757d',
    backgroundColor: 'transparent',
  },
  detailButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6c757d',
  },
  srsButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#198754',
    backgroundColor: 'transparent',
  },
  srsButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#198754',
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
  },
});

export type {
  WordbookItem,
  Category,
  MasteredCard,
  PlayingAudio,
  Props,
};

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 메인 컴포넌트 로직 (Part 2/3)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

export default function MyWordbookScreen({ navigation }: Props) {
  const { user, srsIds, refreshSrsIds } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [uncategorized, setUncategorized] = useState(0);
  const [words, setWords] = useState<WordbookItem[]>([]);
  const [allWords, setAllWords] = useState<WordbookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [playingAudio, setPlayingAudio] = useState<PlayingAudio | null>(null);
  const [masteredCards, setMasteredCards] = useState<MasteredCard[]>([]);
  const [displayCount, setDisplayCount] = useState(100);
  const [filter, setFilter] = useState<'all' | 'none' | number>('all');
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [learningModeModalOpen, setLearningModeModalOpen] = useState(false);
  const [selectedVocabIds, setSelectedVocabIds] = useState<number[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerIds, setPickerIds] = useState<number[]>([]);

  // Audio 관련 상태
  const [sound, setSound] = useState<Audio.Sound>();

  // ──────────────────────────────────────────────────────────────────────────────────────────────
  // 데이터 로딩 로직 (Part 2/3)
  // ──────────────────────────────────────────────────────────────────────────────────────────────

  const loadCategories = useCallback(async () => {
    try {
      const response = await apiClient.get('/categories');
      const data = response.data?.data || response.data;
      setCategories(data?.categories || []);
      setUncategorized(data?.uncategorized || 0);
    } catch (e) {
      console.error('Failed to load categories:', e);
    }
  }, []);

  const loadWordbook = useCallback(async (f: 'all' | 'none' | number) => {
    try {
      setLoading(true);
      let url = '/my-wordbook';
      if (f === 'none') url += '?categoryId=none';
      else if (typeof f === 'number') url += `?categoryId=${f}`;
      
      const response = await apiClient.get(url);
      const data = response.data?.data || response.data;
      const wordsArray = Array.isArray(data) ? data : [];
      setAllWords(wordsArray);
      setWords(wordsArray.slice(0, displayCount));
      setDisplayCount(100);
    } catch (e) {
      console.error('Failed to load wordbook:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [displayCount]);

  // 마스터된 카드 정보 가져오기
  useEffect(() => {
    if (!user) return;
    const loadMasteredCards = async () => {
      try {
        const response = await apiClient.get('/srs/mastered-cards');
        const data = response.data?.data || response.data;
        if (Array.isArray(data)) {
          setMasteredCards(data);
        }
      } catch (e) {
        console.error("Failed to fetch mastered cards", e);
      }
    };
    loadMasteredCards();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const init = async () => {
      await Promise.all([
        loadCategories(),
        loadWordbook(filter),
      ]);
    };
    init();
  }, [user, filter, loadCategories, loadWordbook]);

  // displayCount 변경 시 words 업데이트
  useEffect(() => {
    setWords(allWords.slice(0, displayCount));
  }, [allWords, displayCount]);

  // ──────────────────────────────────────────────────────────────────────────────────────────────
  // 필터링 로직 (Part 2/3)
  // ──────────────────────────────────────────────────────────────────────────────────────────────

  const filteredWords = useMemo(() => {
    if (!Array.isArray(words)) return [];
    const validWords = words.filter(word => word && word.vocab && word.vocab.lemma);
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return validWords;
    return validWords.filter(word =>
      word.vocab.lemma.toLowerCase().includes(needle) ||
      (word.vocab.ko_gloss && word.vocab.ko_gloss.toLowerCase().includes(needle))
    );
  }, [words, searchTerm]);

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

  const playVocabAudio = async (vocabData: WordbookItem) => {
    const vocab = vocabData.vocab;
    
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

  const onClickFolder = async (f: 'all' | 'none' | number) => {
    setFilter(f);
    setSelectedIds(new Set());
    setDisplayCount(100);
    await loadWordbook(f);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const selectAll = () => setSelectedIds(new Set(allWords.map(w => w.vocabId)));
  const unselectAll = () => setSelectedIds(new Set());
  
  const selectVisible = () => setSelectedIds(new Set(filteredWords.map(w => w.vocabId)));
  
  const isAllSelected = useMemo(() => {
    if (allWords.length === 0) return false;
    return allWords.every(w => selectedIds.has(w.vocabId));
  }, [allWords, selectedIds]);

  const isVisibleSelected = useMemo(() => {
    if (filteredWords.length === 0) return false;
    return filteredWords.every(w => selectedIds.has(w.vocabId));
  }, [filteredWords, selectedIds]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      unselectAll();
    } else {
      selectAll();
    }
  };

  const handleToggleSelectVisible = () => {
    if (isVisibleSelected) {
      const visibleIds = new Set(filteredWords.map(w => w.vocabId));
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        visibleIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    } else {
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        filteredWords.forEach(w => newSet.add(w.vocabId));
        return newSet;
      });
    }
  };

  const handleLoadMore = () => {
    setDisplayCount(prev => prev + 100);
  };

  const handleFlashSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length > 100) {
      Alert.alert('알림', '한 번에 100개 이상의 단어를 자동학습할 수 없습니다.');
      return;
    }

    if (ids.length === 0) {
      Alert.alert('알림', '학습할 단어를 선택하세요.');
      return;
    }
    
    setSelectedVocabIds(ids);
    setLearningModeModalOpen(true);
  };

  const handleStartLearning = (mode: 'example' | 'gloss') => {
    const glossParam = mode === 'gloss' ? '&gloss=1' : '';
    navigation.navigate('LearnVocab', {
      ids: selectedVocabIds.join(','),
      mode: 'flash',
      auto: '1',
      gloss: mode === 'gloss' ? '1' : undefined
    });
    setLearningModeModalOpen(false);
    setSelectedVocabIds([]);
  };

  const handleMoveWords = async (targetFolder: 'none' | number) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      Alert.alert('알림', '이동할 단어를 선택하세요.');
      return;
    }
    
    try {
      if (targetFolder === 'none') {
        await apiClient.post('/my-wordbook/remove-many', {
          vocabIds: ids,
          categoryId: filter
        });
      } else {
        await apiClient.post('/my-wordbook/add-many', {
          vocabIds: ids,
          categoryId: Number(targetFolder)
        });
      }
      
      await Promise.all([loadCategories(), loadWordbook(filter)]);
      unselectAll();
      setMoveModalOpen(false);
      Alert.alert('성공', '이동 완료');
    } catch (e: any) {
      console.error(e);
      Alert.alert('오류', '이동 실패');
    }
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      Alert.alert('알림', '삭제할 단어를 선택하세요.');
      return;
    }
    
    Alert.alert(
      '삭제 확인',
      `${ids.length}개의 단어를 내 단어장에서 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.post('/my-wordbook/remove-many', {
                vocabIds: ids,
                categoryId: filter
              });
              
              Alert.alert('성공', `${ids.length}개의 단어를 삭제했습니다.`);
              await Promise.all([loadWordbook(filter), loadCategories()]);
              unselectAll();
            } catch (e: any) {
              console.error('단어 삭제 실패:', e);
              Alert.alert('오류', '단어 삭제에 실패했습니다.');
            }
          }
        }
      ]
    );
  };

  const handleAddToSRS = async (vocabId: number) => {
    if (!user) {
      Alert.alert('알림', '로그인이 필요합니다.');
      return;
    }
    setPickerIds([vocabId]);
    setPickerOpen(true);
  };

  const handleAddSelectedToSRS = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      Alert.alert('알림', 'SRS에 추가할 단어를 선택하세요.');
      return;
    }
    setPickerIds(ids);
    setPickerOpen(true);
  };

  const openDetail = async (vocabId: number) => {
    try {
      setDetailLoading(true);
      const response = await apiClient.get(`/vocab/${vocabId}`);
      setDetail(response.data?.data || response.data);
    } catch (e: any) {
      console.error(e);
      Alert.alert('오류', '상세 정보를 불러오지 못했습니다.');
    } finally {
      setDetailLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadWordbook(filter);
  };

  // ──────────────────────────────────────────────────────────────────────────────────────────────
  // UI 렌더링 (Part 3/3)
  // ──────────────────────────────────────────────────────────────────────────────────────────────

  const renderWordCard = ({ item }: { item: WordbookItem }) => (
    <WordCard
      key={item.id}
      item={item}
      isSelected={selectedIds.has(item.vocabId)}
      onToggleSelect={toggleSelect}
      onPlayAudio={playVocabAudio}
      onOpenDetail={openDetail}
      onAddToSRS={handleAddToSRS}
      playingAudio={playingAudio}
      masteredCards={masteredCards}
    />
  );

  const isActive = (f: 'all' | 'none' | number) => f === filter;

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>내 단어장</Text>
        </View>
        
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[
              styles.learningButton,
              selectedIds.size === 0 && styles.learningButtonDisabled
            ]}
            onPress={handleFlashSelected}
            disabled={selectedIds.size === 0}
          >
            <Text style={[
              styles.learningButtonText,
              selectedIds.size === 0 && styles.learningButtonTextDisabled
            ]}>
              선택 자동학습
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.addWordsButton}
            onPress={() => navigation.navigate('VocabList')}
          >
            <Text style={styles.addWordsButtonText}>단어 추가</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {/* 사이드바 */}
        <View style={styles.sidebar}>
          <ScrollView style={styles.categoryList} showsVerticalScrollIndicator={false}>
            <TouchableOpacity 
              style={[styles.categoryItem, isActive('all') && styles.categoryItemActive]}
              onPress={() => onClickFolder('all')}
            >
              <Text style={[styles.categoryText, isActive('all') && styles.categoryTextActive]}>
                전체
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.categoryItem, isActive('none') && styles.categoryItemActive]}
              onPress={() => onClickFolder('none')}
            >
              <Text style={[styles.categoryText, isActive('none') && styles.categoryTextActive]}>
                미분류
              </Text>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{uncategorized}</Text>
              </View>
            </TouchableOpacity>
            
            {categories.map((c) => (
              <TouchableOpacity 
                key={c.id}
                style={[styles.categoryItem, isActive(c.id) && styles.categoryItemActive]}
                onPress={() => onClickFolder(c.id)}
              >
                <Text style={[styles.categoryText, isActive(c.id) && styles.categoryTextActive]}>
                  {c.name}
                </Text>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{c.count ?? 0}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          <NewCategoryForm onCreated={loadCategories} />
        </View>

        {/* 메인 콘텐츠 */}
        <View style={styles.mainContent}>
          {/* 상단 정보 및 액션 바 */}
          <View style={styles.actionBar}>
            <View style={styles.infoSection}>
              <Text style={styles.infoText}>
                {loading ? '로딩 중...' : `${filteredWords.length}개 항목`}
                {selectedIds.size > 0 ? ` / 선택됨 ${selectedIds.size}` : ''}
              </Text>
            </View>
            
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.moveButton,
                  selectedIds.size === 0 && styles.actionButtonDisabled
                ]}
                onPress={() => setMoveModalOpen(true)}
                disabled={selectedIds.size === 0}
              >
                <Text style={styles.actionButtonText}>이동</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.srsActionButton,
                  selectedIds.size === 0 && styles.actionButtonDisabled
                ]}
                onPress={handleAddSelectedToSRS}
                disabled={selectedIds.size === 0}
              >
                <Text style={styles.actionButtonText}>SRS 추가</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.deleteButton,
                  selectedIds.size === 0 && styles.actionButtonDisabled
                ]}
                onPress={handleDeleteSelected}
                disabled={selectedIds.size === 0}
              >
                <Text style={styles.actionButtonText}>삭제</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 검색 입력 */}
          <View style={styles.searchContainer}>
            <Icon name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="내 단어장에서 검색 (단어 또는 뜻)"
              value={searchTerm}
              onChangeText={setSearchTerm}
              returnKeyType="search"
            />
          </View>

          {/* 선택 버튼들 */}
          {allWords.length > 0 && (
            <View style={styles.selectBar}>
              <Text style={styles.selectInfoText}>
                총 {allWords.length}개 단어 (현재 {filteredWords.length}개 표시)
                {selectedIds.size > 0 && ` • ${selectedIds.size}개 선택`}
              </Text>
              
              <View style={styles.selectButtons}>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={handleToggleSelectVisible}
                >
                  <Text style={styles.selectButtonText}>
                    {isVisibleSelected ? '현재 보이는 단어 해제' : '현재 보이는 단어 선택'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={handleToggleSelectAll}
                >
                  <Text style={styles.selectButtonText}>
                    {isAllSelected ? '전체 해제' : '전체 선택'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 단어 목록 */}
          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>목록 로딩 중...</Text>
            </View>
          ) : filteredWords.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchTerm ? '해당 단어가 없습니다.' : '이 폴더에 단어가 없습니다.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredWords}
              renderItem={renderWordCard}
              keyExtractor={(item) => item.id.toString()}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              ListFooterComponent={
                !loading && allWords.length > displayCount ? (
                  <TouchableOpacity style={styles.loadMoreButton} onPress={handleLoadMore}>
                    <Text style={styles.loadMoreButtonText}>
                      더 보기 ({allWords.length - displayCount}개 더)
                    </Text>
                  </TouchableOpacity>
                ) : null
              }
            />
          )}
        </View>
      </View>

      {/* 상세 보기 모달 */}
      <Modal
        visible={!!detail || detailLoading}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setDetail(null);
          stopAudio();
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          {detailLoading ? (
            <View style={styles.modalLoadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.modalLoadingText}>로딩 중...</Text>
            </View>
          ) : detail ? (
            <ScrollView style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>단어 상세 정보</Text>
                <TouchableOpacity onPress={() => {
                  setDetail(null);
                  stopAudio();
                }}>
                  <Icon name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalBody}>
                <Text style={styles.modalWordTitle}>{detail.lemma}</Text>
                <Text style={styles.modalWordMeaning}>{detail.ko_gloss}</Text>
                
                <TouchableOpacity 
                  style={styles.modalPlayButton}
                  onPress={() => playVocabAudio({ vocab: detail } as WordbookItem)}
                >
                  <Icon name="play" size={20} color="white" />
                  <Text style={styles.modalPlayButtonText}>음성 듣기</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>

      {/* 이동 모달 */}
      <Modal
        visible={moveModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setMoveModalOpen(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>폴더 이동</Text>
            <TouchableOpacity onPress={() => setMoveModalOpen(false)}>
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <View style={styles.modalBody}>
              <TouchableOpacity
                style={styles.moveOption}
                onPress={() => handleMoveWords('none')}
              >
                <Text style={styles.moveOptionText}>📂 미분류로 이동</Text>
              </TouchableOpacity>
              
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.moveOption}
                  onPress={() => handleMoveWords(c.id)}
                >
                  <Text style={styles.moveOptionText}>📁 {c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* 학습 모드 선택 모달 */}
      <Modal
        visible={learningModeModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setLearningModeModalOpen(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>학습 모드 선택</Text>
            <TouchableOpacity onPress={() => setLearningModeModalOpen(false)}>
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <View style={styles.modalBody}>
              <Text style={styles.modalDescription}>
                선택한 {selectedVocabIds.length}개 단어의 학습 방식을 선택해주세요.
              </Text>
              
              <TouchableOpacity
                style={styles.learningModeOption}
                onPress={() => handleStartLearning('example')}
              >
                <View style={styles.learningModeIcon}>
                  <Text style={styles.learningModeEmoji}>📖</Text>
                </View>
                <View style={styles.learningModeContent}>
                  <Text style={styles.learningModeTitle}>예문 음성 학습</Text>
                  <Text style={styles.learningModeDesc}>
                    영단어, 예문, 예문 해석에 대해 AI가 상세하게 읽어줍니다.
                  </Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.learningModeOption}
                onPress={() => handleStartLearning('gloss')}
              >
                <View style={styles.learningModeIcon}>
                  <Text style={styles.learningModeEmoji}>🔊</Text>
                </View>
                <View style={styles.learningModeContent}>
                  <Text style={styles.learningModeTitle}>단어 뜻 음성 학습</Text>
                  <Text style={styles.learningModeDesc}>
                    영단어, 뜻에 대해 AI가 읽어줍니다.
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* SRS 폴더 선택 모달 - 필요시 구현 */}
      <Modal
        visible={pickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setPickerOpen(false);
          setPickerIds([]);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>SRS 폴더 선택</Text>
            <TouchableOpacity onPress={() => {
              setPickerOpen(false);
              setPickerIds([]);
            }}>
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.tempText}>SRS 폴더 선택 기능이 구현될 예정입니다.</Text>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// 추가 스타일을 기존 styles에 병합 (Part 3/3 완성)
Object.assign(styles, {
  // 헤더 스타일
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
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  learningButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#198754',
    borderRadius: 6,
  },
  learningButtonDisabled: {
    backgroundColor: '#e9ecef',
  },
  learningButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  learningButtonTextDisabled: {
    color: '#999',
  },
  addWordsButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  addWordsButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },

  // 콘텐츠
  content: {
    flex: 1,
    flexDirection: 'row',
  },

  // 사이드바
  sidebar: {
    width: Dimensions.get('window').width * 0.3,
    backgroundColor: 'white',
    borderRightWidth: 1,
    borderRightColor: '#e9ecef',
    paddingVertical: 12,
  },
  categoryList: {
    flex: 1,
    paddingHorizontal: 12,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 2,
  },
  categoryItemActive: {
    backgroundColor: '#007AFF',
  },
  categoryText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  categoryTextActive: {
    color: 'white',
  },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#6c757d',
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontSize: 10,
    color: 'white',
    fontWeight: 'bold',
  },

  // 메인 콘텐츠
  mainContent: {
    flex: 1,
    paddingHorizontal: 16,
  },

  // 액션 바
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoSection: {
    flex: 1,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  moveButton: {
    backgroundColor: '#0d6efd',
  },
  srsActionButton: {
    backgroundColor: '#198754',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },

  // 검색
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0,
  },

  // 선택 바
  selectBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 12,
  },
  selectInfoText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  selectButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  selectButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#6c757d',
    borderRadius: 4,
  },
  selectButtonText: {
    fontSize: 10,
    color: '#6c757d',
  },

  // 목록
  listContainer: {
    paddingBottom: 20,
  },

  // 로딩
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },

  // 빈 상태
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },

  // 더보기 버튼
  loadMoreButton: {
    marginVertical: 16,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
  },
  loadMoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },

  // 모달
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    flex: 1,
  },
  modalBody: {
    padding: 16,
  },
  modalLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  modalWordTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modalWordMeaning: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    lineHeight: 24,
  },
  modalPlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  modalPlayButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  modalDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },

  // 이동 옵션
  moveOption: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  moveOptionText: {
    fontSize: 16,
    color: '#333',
  },

  // 학습 모드 옵션
  learningModeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    marginBottom: 12,
  },
  learningModeIcon: {
    marginRight: 16,
  },
  learningModeEmoji: {
    fontSize: 24,
  },
  learningModeContent: {
    flex: 1,
  },
  learningModeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  learningModeDesc: {
    fontSize: 14,
    color: '#666',
  },

  // 임시 텍스트
  tempText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginVertical: 20,
  },
});