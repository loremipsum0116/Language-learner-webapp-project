/*
  VocabListScreen.tsx — React Native 버전 (Part 1/3)
  ------------------------------------------------------------
  웹 VocabList.jsx를 모바일 앱에 맞게 리팩토링
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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { Audio } from 'expo-av';

import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../services/apiClient';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'VocabList'>;

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// TypeScript 인터페이스
// ═══════════════════════════════════════════════════════════════════════════════════════════════

interface VocabItem {
  id: number;
  lemma: string;
  pos?: string;
  ipa?: string;
  ipaKo?: string;
  ko_gloss?: string;
  levelCEFR?: string;
  source?: string;
  audio?: string;
  audio_local?: string | object;
  example?: string;
  koExample?: string;
  en_example?: string;
  ko_example?: string;
}

interface IdiomItem {
  id: number;
  idiom: string;
  korean_meaning?: string;
  category?: string;
  audio?: string;
}

interface MasteredCard {
  id: number;
  itemType: string;
  itemId: number;
  masterCycles: number;
  masteredAt: string;
  srsfolderitem?: any[];
}

interface ExamCategory {
  name: string;
  displayName?: string;
}

interface PlayingAudio {
  type: 'vocab' | 'idiom' | 'example';
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
    default: return '#6c757d';
  }
};

// useDebounce 훅
function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
}

// CEFR to folder mapping for audio paths
const cefrToFolder: { [key: string]: string } = {
  'A1': 'starter',
  'A2': 'elementary', 
  'B1': 'intermediate',
  'B2': 'upper',
  'C1': 'advanced',
  'C2': 'advanced'
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

// 숙어 카드 컴포넌트
interface IdiomCardProps {
  idiom: IdiomItem;
  onOpenDetail: (id: number) => void;
  onAddWordbook: (id: number) => void;
  onAddSRS: (ids: number[]) => void;
  inWordbook: boolean;
  inSRS: boolean;
  onPlayAudio: (item: IdiomItem) => void;
  enrichingId: number | null;
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
  playingAudio: PlayingAudio | null;
}

const IdiomCard: React.FC<IdiomCardProps> = ({
  idiom,
  onOpenDetail,
  onAddWordbook,
  onAddSRS,
  inWordbook,
  inSRS,
  onPlayAudio,
  enrichingId,
  isSelected,
  onToggleSelect,
  playingAudio
}) => {
  const koGloss = idiom.korean_meaning || '뜻 정보 없음';
  const isEnriching = enrichingId === idiom.id;
  const isPlaying = playingAudio?.type === 'idiom' && playingAudio?.id === idiom.id;
  
  // 레벨 정보 추출
  const level = idiom.category?.split(',')[0]?.trim() || '';
  
  // CEFR 레벨로 변환
  const cefrLevel = (() => {
    switch(level) {
      case '입문': return 'A1';
      case '기초': return 'A2';
      case '중급': return 'B1';
      case '중상급': return 'B2';
      case '고급': case '상급': return 'C1';
      case '최고급': return 'C2';
      default: return level;
    }
  })();

  return (
    <View style={[styles.vocabCard, isSelected && styles.vocabCardSelected]}>
      {/* 선택 체크박스 */}
      <TouchableOpacity 
        style={styles.checkboxContainer}
        onPress={() => onToggleSelect(idiom.id)}
      >
        <Icon 
          name={isSelected ? 'checkbox' : 'square-outline'} 
          size={24} 
          color={isSelected ? '#007AFF' : '#8E8E93'} 
        />
      </TouchableOpacity>

      {/* 카드 내용 */}
      <TouchableOpacity 
        style={styles.vocabCardContent}
        onPress={() => onOpenDetail(idiom.id)}
        activeOpacity={0.7}
      >
        <View style={styles.vocabCardHeader}>
          <Text style={styles.vocabLemma}>{idiom.idiom}</Text>
          <View style={styles.badgeContainer}>
            {cefrLevel && (
              <View style={[styles.badge, { backgroundColor: getCefrBadgeColor(cefrLevel) }]}>
                <Text style={styles.badgeText}>{cefrLevel}</Text>
              </View>
            )}
            <View style={[styles.badge, { 
              backgroundColor: idiom.category?.includes('숙어') ? '#198754' : '#0dcaf0'
            }]}>
              <Text style={styles.badgeText}>
                {idiom.category?.includes('숙어') ? '숙어' : '구동사'}
              </Text>
            </View>
          </View>
        </View>
        
        <Text style={styles.vocabMeaning}>{koGloss}</Text>
      </TouchableOpacity>

      {/* 액션 버튼들 */}
      <View style={styles.vocabCardFooter}>
        <View style={styles.actionButtonsLeft}>
          <TouchableOpacity
            style={[styles.actionButton, inWordbook ? styles.actionButtonActive : styles.actionButtonOutline]}
            onPress={() => onAddWordbook(idiom.id)}
            disabled={inWordbook || isEnriching}
          >
            <Text style={[styles.actionButtonText, inWordbook && styles.actionButtonTextActive]}>
              {inWordbook ? '단어장에 있음' : '내 단어장'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, inSRS ? styles.actionButtonSRS : styles.actionButtonOutlineSRS]}
            onPress={() => onAddSRS([idiom.id])}
            disabled={inSRS || isEnriching}
          >
            <Text style={[styles.actionButtonText, inSRS && styles.actionButtonTextActive]}>
              {inSRS ? 'SRS에 있음' : '+SRS'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 오디오 재생 버튼 */}
        {idiom.audio && (
          <TouchableOpacity
            style={styles.audioButton}
            onPress={() => onPlayAudio(idiom)}
            disabled={isEnriching}
          >
            {isEnriching ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Icon 
                name={isPlaying ? 'pause' : 'play'} 
                size={16} 
                color="#007AFF" 
              />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// 일반 단어 카드 컴포넌트 
interface VocabCardProps {
  vocab: VocabItem;
  onOpenDetail: (id: number) => void;
  onAddWordbook: (id: number) => void;
  onAddSRS: (ids: number[]) => void;
  inWordbook: boolean;
  inSRS: boolean;
  onPlayAudio: (item: VocabItem) => void;
  enrichingId: number | null;
  onDeleteVocab?: (id: number, lemma: string) => void;
  isAdmin: boolean;
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
  playingAudio: PlayingAudio | null;
  masteredCards: MasteredCard[];
}

const VocabCard: React.FC<VocabCardProps> = ({
  vocab,
  onOpenDetail,
  onAddWordbook,
  onAddSRS,
  inWordbook,
  inSRS,
  onPlayAudio,
  enrichingId,
  onDeleteVocab,
  isAdmin,
  isSelected,
  onToggleSelect,
  playingAudio,
  masteredCards
}) => {
  const koGloss = vocab.ko_gloss || '뜻 정보 없음';
  const isEnriching = enrichingId === vocab.id;
  const isPlaying = playingAudio?.type === 'vocab' && playingAudio?.id === vocab.id;
  const uniquePosList = [...new Set(vocab.pos ? vocab.pos.split(',').map(p => p.trim()) : [])];
  
  // 마스터된 카드 정보 찾기
  const masteredCard = masteredCards?.find(card => card.itemType === 'vocab' && card.itemId === vocab.id);
  const isMastered = !!masteredCard;
  const masterCycles = masteredCard?.masterCycles || 0;

  return (
    <View style={[
      styles.vocabCard, 
      isSelected && styles.vocabCardSelected,
      isMastered && styles.vocabCardMastered
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
        onPress={() => onToggleSelect(vocab.id)}
      >
        <Icon 
          name={isSelected ? 'checkbox' : 'square-outline'} 
          size={24} 
          color={isSelected ? '#007AFF' : '#8E8E93'} 
        />
      </TouchableOpacity>

      {/* 카드 내용 */}
      <TouchableOpacity 
        style={styles.vocabCardContent}
        onPress={() => onOpenDetail(vocab.id)}
        activeOpacity={0.7}
      >
        <View style={styles.vocabCardHeader}>
          <Text style={styles.vocabLemma}>{vocab.lemma}</Text>
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
          </View>
        </View>
        
        <PronComponent ipa={vocab.ipa} ipaKo={vocab.ipa ? vocab.ipaKo : undefined} />
        <Text style={styles.vocabMeaning}>{koGloss}</Text>
      </TouchableOpacity>

      {/* 액션 버튼들 */}
      <View style={styles.vocabCardFooter}>
        <View style={styles.actionButtonsLeft}>
          <TouchableOpacity
            style={[styles.actionButton, inWordbook ? styles.actionButtonActive : styles.actionButtonOutline]}
            onPress={() => onAddWordbook(vocab.id)}
            disabled={inWordbook}
          >
            <Text style={[styles.actionButtonText, inWordbook && styles.actionButtonTextActive]}>
              {inWordbook ? '단어장에 있음' : '내 단어장'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonOutlineSuccess]}
            onPress={() => onAddSRS([vocab.id])}
          >
            <Text style={styles.actionButtonText}>+ SRS</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionButtonsRight}>
          {/* 오디오 재생 버튼 */}
          {((vocab.source === 'idiom_migration') || (!vocab.source || vocab.source !== 'idiom_migration')) && (
            <TouchableOpacity
              style={styles.audioButton}
              onPress={() => onPlayAudio(vocab)}
              disabled={isEnriching}
            >
              {isEnriching ? (
                <ActivityIndicator size="small" color="#0dcaf0" />
              ) : (
                <Icon 
                  name={isPlaying ? 'pause' : 'play'} 
                  size={16} 
                  color="#0dcaf0" 
                />
              )}
            </TouchableOpacity>
          )}

          {/* 관리자 삭제 버튼 */}
          {isAdmin && onDeleteVocab && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => onDeleteVocab(vocab.id, vocab.lemma)}
            >
              <Icon name="trash" size={16} color="#dc3545" />
            </TouchableOpacity>
          )}
        </View>
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
  
  // 발음 표기
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

  // 단어 카드 스타일
  vocabCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
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
  vocabCardSelected: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  vocabCardMastered: {
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
  vocabCardContent: {
    paddingRight: 40, // 체크박스 공간 확보
  },
  vocabCardHeader: {
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
  vocabMeaning: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },

  // 카드 푸터
  vocabCardFooter: {
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
  actionButtonsRight: {
    flexDirection: 'row',
    gap: 8,
  },

  // 액션 버튼들
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  actionButtonOutline: {
    borderColor: '#007AFF',
    backgroundColor: 'transparent',
  },
  actionButtonActive: {
    borderColor: '#6c757d',
    backgroundColor: '#6c757d',
  },
  actionButtonOutlineSRS: {
    borderColor: '#ffc107',
    backgroundColor: 'transparent',
  },
  actionButtonSRS: {
    borderColor: '#ffc107',
    backgroundColor: '#ffc107',
  },
  actionButtonOutlineSuccess: {
    borderColor: '#198754',
    backgroundColor: 'transparent',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  actionButtonTextActive: {
    color: 'white',
  },

  // 오디오 버튼
  audioButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },

  // 삭제 버튼
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dc3545',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
});

export type {
  VocabItem,
  IdiomItem,
  MasteredCard,
  ExamCategory,
  PlayingAudio,
  Props,
};

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 메인 컴포넌트 로직 (Part 2/3)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

export default function VocabListScreen({ navigation }: Props) {
  const { user, srsIds, loading: authLoading, refreshSrsIds } = useAuth();
  const [activeLevel, setActiveLevel] = useState('A1');
  const [activeTab, setActiveTab] = useState<'cefr' | 'exam' | 'idiom'>('cefr');
  const [activeExam, setActiveExam] = useState('');
  const [activeIdiomCategory, setActiveIdiomCategory] = useState<'숙어' | '구동사'>('숙어');
  const [examCategories, setExamCategories] = useState<ExamCategory[]>([]);
  const [words, setWords] = useState<(VocabItem | IdiomItem)[]>([]);
  const [allWords, setAllWords] = useState<(VocabItem | IdiomItem)[]>([]);
  const [displayCount, setDisplayCount] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [myWordbookIds, setMyWordbookIds] = useState<Set<number>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingVocabIds, setPendingVocabIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailType, setDetailType] = useState<'vocab' | 'idiom'>('vocab');
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [playingAudio, setPlayingAudio] = useState<PlayingAudio | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [audioFilesCache, setAudioFilesCache] = useState<Map<string, string[]>>(new Map());
  const [enrichingId, setEnrichingId] = useState<number | null>(null);
  const [masteredCards, setMasteredCards] = useState<MasteredCard[]>([]);
  const [autoFolderModalOpen, setAutoFolderModalOpen] = useState(false);
  const [pickerIds, setPickerIds] = useState<number[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  
  // Audio 관련 상태
  const [sound, setSound] = useState<Audio.Sound>();

  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  const isAdmin = user?.role === 'admin';

  // ──────────────────────────────────────────────────────────────────────────────────────────────
  // 데이터 로딩 로직 (Part 2/3)
  // ──────────────────────────────────────────────────────────────────────────────────────────────

  // 시험 카테고리 로드
  useEffect(() => {
    if (authLoading) return;
    const loadExamCategories = async () => {
      try {
        const response = await fetch('http://localhost:4000/simple-exam-categories');
        const result = await response.json();
        const categories = Array.isArray(result.data) ? result.data : [];
        setExamCategories(categories);
        if (categories.length > 0 && !activeExam) {
          setActiveExam(categories[0].name);
        }
      } catch (e) {
        console.error('Failed to load exam categories:', e);
        setExamCategories([]);
      }
    };
    loadExamCategories();
  }, [authLoading]);

  // 메인 데이터 로딩 - 실제 cefr_vocabs.json 데이터 사용
  const loadVocabData = async () => {
    try {
      setLoading(true);
      setErr(null);
      
      let data: any[] = [];
      
      if (activeTab === 'cefr') {
        // CEFR 레벨별 조회 - 실제 API 호출
        console.log('[VOCAB] Fetching real CEFR data for level:', activeLevel);
        
        try {
          // Use the new simple-vocab endpoint that bypasses middleware
          console.log(`[VOCAB] Making API call to: http://localhost:4000/simple-vocab?levelCEFR=${activeLevel}&limit=500`);
          const response = await fetch(`http://localhost:4000/simple-vocab?levelCEFR=${activeLevel}&limit=500`);
          console.log('[VOCAB] API response status:', response.status, response.statusText);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const result = await response.json();
          console.log('[VOCAB] API result:', result);
          
          if (result.success && result.data) {
            data = result.data;
            console.log('[VOCAB] Real CEFR data loaded:', data.length, 'items for level', activeLevel);
            console.log('[VOCAB] First few items:', data.slice(0, 3));
            setTotalCount(data.length);
            
            // Apply search filter if there's a search term
            if (debouncedSearchTerm) {
              data = data.filter(item => 
                item.lemma.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                (item.ko_gloss && item.ko_gloss.includes(debouncedSearchTerm))
              );
              console.log('[VOCAB] Search filtered results:', data.length, 'items for term:', debouncedSearchTerm);
            }
          } else {
            throw new Error(`API returned: ${JSON.stringify(result)}`);
          }
        } catch (apiError) {
          console.error('[VOCAB] API error, falling back to sample data:', apiError);
          // Fallback to sample data if API fails
          const sampleData = {
            A1: [
              { id: 1, lemma: 'hello', pos: 'interjection', levelCEFR: 'A1', ko_gloss: '안녕하세요' },
              { id: 2, lemma: 'good', pos: 'adjective', levelCEFR: 'A1', ko_gloss: '좋은' },
              { id: 3, lemma: 'book', pos: 'noun', levelCEFR: 'A1', ko_gloss: '책' }
            ],
            A2: [
              { id: 101, lemma: 'weather', pos: 'noun', levelCEFR: 'A2', ko_gloss: '날씨' },
              { id: 102, lemma: 'travel', pos: 'verb', levelCEFR: 'A2', ko_gloss: '여행하다' }
            ],
            B1: [
              { id: 201, lemma: 'experience', pos: 'noun', levelCEFR: 'B1', ko_gloss: '경험' }
            ],
            B2: [
              { id: 301, lemma: 'consequence', pos: 'noun', levelCEFR: 'B2', ko_gloss: '결과' }
            ],
            C1: [
              { id: 401, lemma: 'sophisticated', pos: 'adjective', levelCEFR: 'C1', ko_gloss: '정교한' }
            ]
          };
          data = sampleData[activeLevel as keyof typeof sampleData] || [];
          setTotalCount(data.length);
        }
      } else if (activeTab === 'idiom') {
        // 숙어·구동사 조회 - 임시로 빈 배열
        console.log('[VOCAB] Idiom tab - showing empty for now');
        data = [];
        setWords([]);
        setAllWords([]);
        setTotalCount(0);
        setDisplayCount(100);
        return;
      } else {
        // 시험별 조회 - 임시로 빈 배열
        console.log('[VOCAB] Exam tab - showing empty for now');
        data = [];
        setTotalCount(0);
        setHasNextPage(false);
      }
      
      console.log('[VOCAB] Final words array:', data.length, 'items');
      setAllWords(data);
      setWords(data.slice(0, displayCount));
      setDisplayCount(100);
    } catch (e) {
      console.error("Failed to load vocab data:", e);
      setErr(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      loadVocabData();
    }
  }, [activeLevel, activeTab, activeExam, activeIdiomCategory, debouncedSearchTerm, authLoading]);

  // displayCount 변경 시 words 업데이트
  useEffect(() => {
    setWords(allWords.slice(0, displayCount));
  }, [allWords, displayCount]);

  // 내 단어장 ID 로드
  useEffect(() => {
    if (!user) return;
    const loadWordbook = async () => {
      try {
        const response = await apiClient.get('/my-wordbook');
        const data = response.data?.data || response.data;
        if (Array.isArray(data)) {
          setMyWordbookIds(new Set(data.map((item: any) => item.vocabId)));
        }
      } catch (e) {
        console.error("Failed to fetch my wordbook IDs", e);
      }
    };
    loadWordbook();
  }, [user]);

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

  // ──────────────────────────────────────────────────────────────────────────────────────────────
  // 핸들러 함수들 (Part 2/3)
  // ──────────────────────────────────────────────────────────────────────────────────────────────

  const handleAddWordbook = async (vocabId: number) => {
    if (!user) {
      Alert.alert('알림', '로그인이 필요합니다.');
      return;
    }

    try {
      const response = await apiClient.post('/my-wordbook/add', {
        vocabId
      });

      const meta = response.data?.meta;
      if (meta?.created) {
        Alert.alert('성공', '단어가 내 단어장에 새로 추가되었습니다.');
        setMyWordbookIds(prev => new Set(prev).add(vocabId));
      } else if (meta?.already) {
        Alert.alert('알림', '이미 내 단어장에 있는 단어입니다.');
        if (!myWordbookIds.has(vocabId)) {
          setMyWordbookIds(prev => new Set(prev).add(vocabId));
        }
      } else {
        Alert.alert('알림', '요청은 성공했지만 서버 응답 형식이 예상과 다릅니다.');
      }
    } catch (e: any) {
      console.error('handleAddWordbook 함수에서 에러 발생:', e);
      Alert.alert('오류', `단어장 추가에 실패했습니다: ${e.message}`);
    }
  };

  const handleToggleSelect = (vocabId: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(vocabId)) {
        next.delete(vocabId);
      } else {
        next.add(vocabId);
      }
      return next;
    });
  };

  const isAllSelected = useMemo(() => {
    if (activeTab === 'exam') {
      const actualMaxCount = Math.min(totalCount, allWords.length || totalCount);
      return selectedIds.size > 0 && selectedIds.size >= actualMaxCount - 1;
    } else if (activeTab === 'idiom') {
      if (words.length === 0) return false;
      return words.every(word => selectedIds.has(word.id));
    } else {
      if (words.length === 0) return false;
      return words.every(word => selectedIds.has(word.id));
    }
  }, [words, selectedIds, activeTab, totalCount, allWords.length]);

  const handleToggleSelectAll = async () => {
    if (activeTab === 'exam' && !isAllSelected) {
      try {
        setLoading(true);
        const response = await apiClient.get(`/exam-vocab/${activeExam}?limit=${totalCount}`);
        const allVocabIds = response.data?.data?.vocabs?.map((v: any) => v.id) || 
                           response.data?.vocabs?.map((v: any) => v.id) || [];
        setSelectedIds(new Set(allVocabIds));
      } catch (error) {
        console.error('Failed to select all words:', error);
        const newSelected = new Set(selectedIds);
        words.forEach(word => newSelected.add(word.id));
        setSelectedIds(newSelected);
      } finally {
        setLoading(false);
      }
    } else if (activeTab === 'cefr' && !isAllSelected) {
      try {
        setLoading(true);
        const response = await apiClient.get(`/vocab/list?level=${encodeURIComponent(activeLevel)}`);
        const allVocabData = response.data?.data || response.data || [];
        const allVocabIds = allVocabData.map((v: any) => v.id) || [];
        setSelectedIds(new Set(allVocabIds));
      } catch (error) {
        console.error('Failed to select all words:', error);
        const newSelected = new Set(selectedIds);
        words.forEach(word => newSelected.add(word.id));
        setSelectedIds(newSelected);
      } finally {
        setLoading(false);
      }
    } else if (activeTab === 'idiom' && !isAllSelected) {
      try {
        setLoading(true);
        const posType = activeIdiomCategory === '숙어' ? 'idiom' : 'phrasal verb';
        const response = await apiClient.get(`/vocab/idioms-phrasal?pos=${encodeURIComponent(posType)}&search=`);
        const allIdiomIds = response.data?.data?.map((item: any) => item.id) || 
                           response.data?.map((item: any) => item.id) || [];
        setSelectedIds(new Set(allIdiomIds));
      } catch (error) {
        console.error('Failed to select all idioms:', error);
        const allWordIds = words.map(word => word.id);
        setSelectedIds(new Set(allWordIds));
      } finally {
        setLoading(false);
      }
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleAddSelectedToWordbook = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      Alert.alert('알림', '단어를 먼저 선택해주세요.');
      return;
    }

    try {
      const response = await apiClient.post('/my-wordbook/add-many', {
        vocabIds: ids
      });
      const count = response.data?.data?.count || response.data?.count || 0;
      Alert.alert('성공', `${ids.length}개 중 ${count}개의 새로운 단어를 내 단어장에 추가했습니다.`);
      setSelectedIds(new Set());
      setMyWordbookIds(prev => new Set([...prev, ...ids]));
    } catch (e: any) {
      console.error("내 단어장 추가 실패:", e);
      Alert.alert('오류', `추가 실패: ${e.message || '서버 오류'}`);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────────────────────────
  // 오디오 관련 함수들 (Part 2/3)
  // ──────────────────────────────────────────────────────────────────────────────────────────────

  const stopAudio = async () => {
    try {
      if (sound && sound.unloadAsync) {
        await sound.unloadAsync();
      }
      setSound(undefined);
      setPlayingAudio(null);
    } catch (error) {
      console.log('🔊 [stopAudio] Error (safe to ignore):', error);
      setSound(undefined);
      setPlayingAudio(null);
    }
  };

  const playUrl = async (url: string, type: 'vocab' | 'idiom' | 'example', id: number) => {
    console.log('🔊 [playUrl] Called with:', { url, type, id });
    
    if (!url) {
      console.log('🔊 [playUrl] No URL provided');
      return;
    }
    
    if (playingAudio && playingAudio.id === id && playingAudio.type === type) {
      console.log('🔊 [playUrl] Stopping current audio');
      await stopAudio();
      return;
    }
    
    await stopAudio();

    // Construct full URL - use localhost for development
    const baseUrl = 'http://localhost:4000'; // Use localhost for React Native web
    
    let fullUrl;
    if (url.startsWith('/')) {
      fullUrl = `${baseUrl}${url}`;
    } else {
      fullUrl = `${baseUrl}/${url}`;
    }
    
    console.log('🔊 [playUrl] Attempting to play:', fullUrl);
    
    // Set playing state immediately for UI feedback
    setPlayingAudio({ type: type as 'vocab' | 'idiom' | 'example', id });
    
    try {
      console.log('🔊 [playUrl] Trying expo-av...');
      
      // Set audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        playThroughEarpieceAndroid: false,
      });
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: fullUrl },
        { 
          shouldPlay: true,
          isLooping: false,
          isMuted: false,
          volume: 1.0
        }
      );
      
      newSound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          console.log('🔊 [playUrl] Audio finished playing');
          setPlayingAudio(null);
        }
        if (!status.isLoaded && status.error) {
          console.error('🔊 [playUrl] Audio playback error:', status.error);
          setPlayingAudio(null);
        }
      });
      
      setSound(newSound);
      console.log('🔊 [playUrl] Audio started successfully with expo-av');
      
    } catch (e: any) {
      console.error('🔊 [playUrl] expo-av failed:', e);
      console.error('🔊 [playUrl] Error details:', e.message, e.stack);
      
      // Clear the playing state if audio failed
      setPlayingAudio(null);
      
      // Show user-friendly error
      console.log('🔊 [playUrl] Audio playback failed - check network connection');
    }
  };

  const safeFileName = (str: string): string => {
    if (!str) return '';
    return encodeURIComponent(str.toLowerCase().replace(/\s+/g, '_'));
  };

  // 오디오 파일 목록을 서버에서 가져오는 함수
  const fetchAudioFiles = async (level: string): Promise<string[]> => {
    if (audioFilesCache.has(level)) {
      return audioFilesCache.get(level) || [];
    }
    
    try {
      const response = await fetch(`http://localhost:4000/simple-audio-files/${level}`);
      const result = await response.json();
      const files = result.success ? (result.files || []) : [];
      
      setAudioFilesCache(prev => new Map(prev).set(level, files));
      return files;
    } catch (error) {
      console.error(`Error fetching audio files for ${level}:`, error);
      return [];
    }
  };

  // Smart file name matching
  const getSmartAudioFileName = async (lemma: string, pos?: string, level?: string): Promise<string> => {
    if (lemma && (lemma.includes(' ') || lemma.includes('-') || lemma.includes("'"))) {
      const cleanLemma = lemma.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_').replace(/'/g, '');
      return cleanLemma;
    }
    
    let availableFiles = level ? await fetchAudioFiles(level) : [];
    
    if (availableFiles.length === 0) {
      availableFiles = [
        'light (from the sun).mp3',
        'light (not heavy)(adj).mp3',
        'rest (remaining part).mp3',
        'rest (sleeprelax)(unkown).mp3',
        'mine (belongs to me).mp3',
        'rock (music).mp3',
        'rock (stone)(n).mp3',
        'last (final).mp3',
        'last (taking time)(v).mp3',
        'bear (animal).mp3',
        'race (competition).mp3',
        'second (next after the first).mp3',
        'bank (money).mp3',
        'used to.mp3',
        'have.mp3',
        'may.mp3',
        'might.mp3',
        'either.mp3',
        'neither.mp3',
      ];
    }
    
    return getBestMatchingFileName(lemma, pos, availableFiles);
  };

  // String similarity function
  const stringSimilarity = (str1: string, str2: string): number => {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    if (s1 === s2) return 1;
    
    const len1 = s1.length;
    const len2 = s2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;
    
    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
    
    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,
          matrix[j][i - 1] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }
    
    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len2][len1]) / maxLen;
  };

  // Get best matching audio file name
  const getBestMatchingFileName = (lemma: string, pos?: string, availableFiles?: string[]): string => {
    if (!lemma) return '';
    
    const lemmaLower = lemma.toLowerCase();
    
    if (!lemma.includes('(')) {
      return safeFileName(lemma);
    }
    
    const knownMappings: { [key: string]: string } = {
      'rock (music)': 'rock (music)',
      'rock (stone)': 'rock (stone)(n)',
      'light (not heavy)': 'light (not heavy)(adj)',
      'light (from the sun/a lamp)': 'light (from the sun)',
      'last (taking time)': 'last (taking time)(v)',
      'last (final)': 'last (final)',
      'mine (belongs to me)': 'mine (belongs to me)',
      'bear (animal)': 'bear (animal)',
      'bank (money)': 'bank (money)',
      'race (competition)': 'race (competition)',
      'rest (remaining part)': 'rest (remaining part)',
      'rest (sleep/relax)': 'rest (sleeprelax)(unkown)',
      'second (next after the first)': 'second (next after the first)',
      'used to': 'used to',
      'have': 'have',
      'may': 'may',
      'might': 'might',
      'either': 'either',
      'neither': 'neither'
    };
    
    if (knownMappings[lemmaLower]) {
      return knownMappings[lemmaLower];
    }
    
    if (lemmaLower.includes('/')) {
      const withoutSlash = lemmaLower.replace(/\//g, '');
      if (knownMappings[withoutSlash]) {
        return knownMappings[withoutSlash];
      }
    }
    
    if (availableFiles && availableFiles.length > 0) {
      let bestMatch = '';
      let bestScore = 0;
      
      const fileNames = availableFiles.map(file => 
        file.replace('.mp3', '').toLowerCase()
      );
      
      for (const fileName of fileNames) {
        if (fileName === lemmaLower) {
          return fileName;
        }
        
        const baseWord = lemmaLower.split(' ')[0];
        
        if (fileName.startsWith(baseWord)) {
          const score = stringSimilarity(lemmaLower, fileName);
          
          if (score > bestScore) {
            bestScore = score;
            bestMatch = fileName;
          }
        }
        else if (fileName.includes(baseWord)) {
          const score = stringSimilarity(lemmaLower, fileName) * 0.8;
          
          if (score > bestScore) {
            bestScore = score;
            bestMatch = fileName;
          }
        }
      }
      
      if (bestMatch && bestScore > 0.4) {
        return bestMatch;
      }
    }
    
    const posAbbrev: { [key: string]: string } = {
      'noun': 'n',
      'verb': 'v', 
      'adjective': 'adj',
      'adverb': 'adv',
      'preposition': 'prep'
    };
    
    const shortPos = posAbbrev[pos?.toLowerCase() || ''] || pos?.toLowerCase() || 'unknown';
    return `${lemmaLower}(${shortPos})`;
  };

  // Enhanced audio functions for different audio types
  const playVocabAudio = async (vocab: VocabItem) => {
    console.log('🔊 [playVocabAudio] Called with vocab:', vocab.lemma, vocab.id);
    
    try {
      // Check if we have audio_local data from API
      if (vocab.audio_local) {
        console.log('🔊 [playVocabAudio] Found audio_local:', vocab.audio_local);
        let audioData;
        
        try {
          audioData = typeof vocab.audio_local === 'string' 
            ? JSON.parse(vocab.audio_local) 
            : vocab.audio_local;
        } catch (e) {
          console.error('🔊 [playVocabAudio] Failed to parse audio_local:', e);
          audioData = null;
        }
        
        if (audioData && audioData.word) {
          console.log('🔊 [playVocabAudio] Using word audio path:', audioData.word);
          const audioPath = audioData.word.startsWith('/') ? audioData.word : `/${audioData.word}`;
          await playUrl(audioPath, 'vocab', vocab.id);
          return;
        }
      }
      
      // Fallback for idioms and phrasal verbs
      if ('source' in vocab && (vocab.source === 'idiom_migration' || vocab.source === 'phrasal_verb_migration' || 
          (vocab.lemma && (vocab.lemma.includes(' ') || vocab.lemma.includes('-') || vocab.lemma.includes("'"))))) {
        const cleanLemma = vocab.lemma.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_').replace(/'/g, '');
        
        const knownPhrasalVerbs = [
          'ask around', 'ask around for', 'ask out', 'ask for', 'ask in', 'ask over', 'ask after',
          'work through', 'work out', 'work up', 'work on', 'work off', 'break down', 'break up', 
          'break out', 'break in', 'break away', 'break through', 'come up', 'come down', 'come out',
          'go through', 'go out', 'go up', 'go down', 'put up', 'put down', 'put off', 'put on',
          'get up', 'get down', 'get out', 'get through', 'turn on', 'turn off', 'turn up', 'turn down'
        ];
        
        const isPhrasalVerb = vocab.source === 'phrasal_verb_migration' || 
                             knownPhrasalVerbs.includes(vocab.lemma.toLowerCase());
        
        const folderName = isPhrasalVerb ? 'phrasal_verb' : 'idiom';
        const audioPath = `/${folderName}/${cleanLemma}.mp3`;
        await playUrl(audioPath, 'vocab', vocab.id);
        return;
      }
      
      // Fallback for regular words
      const folderName = cefrToFolder[vocab.levelCEFR || 'A1'] || 'starter';
      const audioFileName = await getSmartAudioFileName(vocab.lemma, vocab.pos, vocab.levelCEFR);
      const localAudioPath = `/${folderName}/${audioFileName}/word.mp3`;
      await playUrl(localAudioPath, 'vocab', vocab.id);
    } catch (error) {
      console.error('🔊 [playVocabAudio] Error:', error);
    }
  };

  // Play gloss audio (Korean meaning)
  const playVocabAudioGloss = async (vocab: VocabItem) => {
    console.log('🔊 [playVocabAudioGloss] Called with vocab:', vocab.lemma);
    
    try {
      // Check if we have audio_local data from API
      if (vocab.audio_local) {
        let audioData;
        try {
          audioData = typeof vocab.audio_local === 'string' 
            ? JSON.parse(vocab.audio_local) 
            : vocab.audio_local;
        } catch (e) {
          console.error('🔊 [playVocabAudioGloss] Failed to parse audio_local:', e);
          audioData = null;
        }
        
        if (audioData && audioData.gloss) {
          console.log('🔊 [playVocabAudioGloss] Using gloss audio path:', audioData.gloss);
          const audioPath = audioData.gloss.startsWith('/') ? audioData.gloss : `/${audioData.gloss}`;
          await playUrl(audioPath, 'vocab', vocab.id);
          return;
        }
      }
      
      // Fallback
      const folderName = cefrToFolder[vocab.levelCEFR || 'A1'] || 'starter';
      const audioFileName = await getSmartAudioFileName(vocab.lemma, vocab.pos, vocab.levelCEFR);
      const glossAudioPath = `/${folderName}/${audioFileName}/gloss.mp3`;
      await playUrl(glossAudioPath, 'vocab', vocab.id);
    } catch (error) {
      console.error('🔊 [playVocabAudioGloss] Error:', error);
    }
  };

  // Play example audio
  const playVocabAudioExample = async (vocab: VocabItem) => {
    console.log('🔊 [playVocabAudioExample] Called with vocab:', vocab.lemma);
    
    try {
      // Check if we have audio_local data from API
      if (vocab.audio_local) {
        let audioData;
        try {
          audioData = typeof vocab.audio_local === 'string' 
            ? JSON.parse(vocab.audio_local) 
            : vocab.audio_local;
        } catch (e) {
          console.error('🔊 [playVocabAudioExample] Failed to parse audio_local:', e);
          audioData = null;
        }
        
        if (audioData && audioData.example) {
          console.log('🔊 [playVocabAudioExample] Using example audio path:', audioData.example);
          const audioPath = audioData.example.startsWith('/') ? audioData.example : `/${audioData.example}`;
          await playUrl(audioPath, 'example', vocab.id);
          return;
        }
      }
      
      // Fallback
      const folderName = cefrToFolder[vocab.levelCEFR || 'A1'] || 'starter';
      const audioFileName = await getSmartAudioFileName(vocab.lemma, vocab.pos, vocab.levelCEFR);
      const exampleAudioPath = `/${folderName}/${audioFileName}/example.mp3`;
      await playUrl(exampleAudioPath, 'example', vocab.id);
    } catch (error) {
      console.error('🔊 [playVocabAudioExample] Error:', error);
    }
  };

  const playIdiomAudio = async (idiom: IdiomItem) => {
    const cleanLemma = idiom.idiom.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_').replace(/'/g, '');
    const folderName = idiom.category?.includes('구동사') ? 'phrasal_verb' : 'idiom';
    const audioPath = `/${folderName}/${cleanLemma}.mp3`;
    await playUrl(audioPath, 'idiom', idiom.id);
  };

  const handleDeleteVocab = async (vocabId: number, lemma: string) => {
    Alert.alert(
      '단어 삭제',
      `'${lemma}' 단어를 데이터베이스에서 영구적으로 삭제하시겠습니까?`,
      '',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/vocab/${vocabId}`);
              setWords(prevWords => prevWords.filter(word => word.id !== vocabId));
              Alert.alert('성공', `'${lemma}' 단어가 삭제되었습니다.`);
            } catch (e: any) {
              console.error("단어 삭제 실패:", e);
              Alert.alert('오류', `삭제 실패: ${e.message || '서버 오류'}`);
            }
          }
        }
      ]
    );
  };

  const handleOpenDetail = async (vocabId: number) => {
    try {
      setDetailLoading(true);
      setDetail(null);
      setDetailType('vocab');
      setShowDebug(false);
      
      const response = await fetch(`http://localhost:4000/simple-vocab-detail/${vocabId}`);
      const result = await response.json();
      if (result.success) {
        // Parse additional data structures for enhanced display
        const enhancedDetail = {
          ...result.data,
          // Normalize field names for consistency
          example: result.data.example || result.data.en_example,
          koExample: result.data.koExample || result.data.ko_example,
          // Parse examples if they're in JSON string format
          examples: result.data.dictentry?.examples ? (
            typeof result.data.dictentry.examples === 'string' 
              ? JSON.parse(result.data.dictentry.examples) 
              : result.data.dictentry.examples
          ) : [],
        };
        setDetail(enhancedDetail);
      } else {
        throw new Error(result.error || 'Failed to fetch vocab details');
      }
    } catch (e: any) {
      if (e.status === 401) {
        Alert.alert('알림', '로그인이 필요합니다.');
      } else {
        Alert.alert('오류', '상세 정보를 불러오지 못했습니다.');
      }
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenIdiomDetail = async (idiomId: number) => {
    try {
      setDetailLoading(true);
      setDetail(null);
      setDetailType('idiom');
      const response = await apiClient.get(`/api/idiom/${idiomId}`);
      setDetail(response.data?.data || response.data);
    } catch (e: any) {
      Alert.alert('오류', '숙어 상세 정보를 불러오지 못했습니다.');
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAddSRS = async (ids: number[]) => {
    if (!user) {
      Alert.alert('알림', '로그인이 필요합니다.');
      return;
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      Alert.alert('알림', '먼저 단어를 선택하세요.');
      return;
    }

    setPickerIds(ids);
    setPickerOpen(true);
  };

  const handleLoadMore = async () => {
    if (!hasNextPage || loading || activeTab !== 'exam' || !activeExam) return;
    
    try {
      setLoading(true);
      const nextPage = currentPage + 1;
      const response = await apiClient.get(`/exam-vocab/${activeExam}?page=${nextPage}&limit=100`);
      const newVocabs = response.data?.data?.vocabs || response.data?.vocabs || [];
      
      setAllWords(prev => [...prev, ...newVocabs]);
      setWords(prev => [...prev, ...newVocabs]);
      
      setCurrentPage(nextPage);
      setHasNextPage(response.data?.data?.pagination?.hasNext || response.data?.pagination?.hasNext || false);
      
    } catch (error) {
      console.error('Failed to load more words:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadVocabData();
  };

  // Audio cleanup
  useEffect(() => {
    return () => {
      if (sound && sound.unloadAsync) {
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [sound]);

  // ──────────────────────────────────────────────────────────────────────────────────────────────
  // UI 렌더링 (Part 3/3)
  // ──────────────────────────────────────────────────────────────────────────────────────────────

  const renderVocabCard = ({ item, index }: { item: VocabItem | IdiomItem; index: number }) => {
    const isIdiom = 'idiom' in item;
    
    if (isIdiom) {
      return (
        <IdiomCard
          key={item.id}
          idiom={item as IdiomItem}
          onOpenDetail={handleOpenIdiomDetail}
          onAddWordbook={handleAddWordbook}
          onAddSRS={handleAddSRS}
          inWordbook={myWordbookIds.has(item.id)}
          inSRS={srsIds.has(item.id)}
          onPlayAudio={playIdiomAudio}
          enrichingId={enrichingId}
          isSelected={selectedIds.has(item.id)}
          onToggleSelect={handleToggleSelect}
          playingAudio={playingAudio}
        />
      );
    } else {
      return (
        <VocabCard
          key={item.id}
          vocab={item as VocabItem}
          onOpenDetail={handleOpenDetail}
          onAddWordbook={handleAddWordbook}
          onAddSRS={handleAddSRS}
          inWordbook={myWordbookIds.has(item.id)}
          inSRS={srsIds.has(item.id)}
          onPlayAudio={playVocabAudio}
          enrichingId={enrichingId}
          onDeleteVocab={handleDeleteVocab}
          isAdmin={isAdmin}
          isSelected={selectedIds.has(item.id)}
          onToggleSelect={handleToggleSelect}
          playingAudio={playingAudio}
          masteredCards={masteredCards}
        />
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>단어 학습</Text>
        </View>
        
        <TouchableOpacity
          style={[
            styles.autoFolderButton,
            selectedIds.size > 0 ? styles.autoFolderButtonActive : styles.autoFolderButtonInactive
          ]}
          onPress={() => setAutoFolderModalOpen(true)}
          disabled={selectedIds.size === 0}
        >
          <Icon name="folder" size={16} color={selectedIds.size > 0 ? "white" : "#666"} />
          <Text style={[
            styles.autoFolderButtonText,
            selectedIds.size > 0 && styles.autoFolderButtonTextActive
          ]}>
            자동 폴더 {selectedIds.size > 0 && `(${selectedIds.size})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 탭 네비게이션 */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.tabRow}>
            {[
              { key: 'cefr', label: '수준별 단어' },
              { key: 'exam', label: '시험별 단어' },
              { key: 'idiom', label: '숙어·구동사' }
            ].map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tab,
                  activeTab === tab.key && styles.activeTab
                ]}
                onPress={() => {
                  setActiveTab(tab.key as 'cefr' | 'exam' | 'idiom');
                  setSearchTerm('');
                  setSelectedIds(new Set());
                  setDisplayCount(100);
                  setCurrentPage(1);
                  setHasNextPage(false);
                }}
              >
                <Text style={[
                  styles.tabText,
                  activeTab === tab.key && styles.activeTabText
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* CEFR 레벨 선택 */}
      {activeTab === 'cefr' && (
        <View style={styles.subTabContainer}>
          <Text style={styles.subTabTitle}>수준별 단어</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.subTabRow}>
              {['A1', 'A2', 'B1', 'B2', 'C1'].map(level => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.subTab,
                    activeLevel === level && styles.activeSubTab
                  ]}
                  onPress={() => {
                    setSearchTerm('');
                    setActiveLevel(level);
                    setSelectedIds(new Set());
                    setDisplayCount(100);
                    setCurrentPage(1);
                    setHasNextPage(false);
                  }}
                >
                  <Text style={[
                    styles.subTabText,
                    activeLevel === level && styles.activeSubTabText
                  ]}>
                    {level}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* 시험별 선택 */}
      {activeTab === 'exam' && (
        <View style={styles.subTabContainer}>
          <Text style={styles.subTabTitle}>시험별 필수 단어</Text>
          {examCategories.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.subTabRow}>
                {examCategories.map(exam => (
                  <TouchableOpacity
                    key={exam.name}
                    style={[
                      styles.subTab,
                      styles.examSubTab,
                      activeExam === exam.name && styles.activeExamSubTab
                    ]}
                    onPress={() => {
                      setSearchTerm('');
                      setActiveExam(exam.name);
                      setSelectedIds(new Set());
                      setDisplayCount(100);
                      setCurrentPage(1);
                      setHasNextPage(false);
                    }}
                  >
                    <Text style={[
                      styles.subTabText,
                      activeExam === exam.name && styles.activeExamSubTabText
                    ]}>
                      {exam.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          ) : (
            <View style={styles.noExamAlert}>
              <Icon name="information-circle" size={16} color="#0dcaf0" />
              <Text style={styles.noExamText}>
                시험 카테고리가 설정되지 않았습니다. CEFR 레벨별 단어를 이용해주세요.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* 숙어·구동사 선택 */}
      {activeTab === 'idiom' && (
        <View style={styles.subTabContainer}>
          <Text style={styles.subTabTitle}>숙어·구동사</Text>
          <View style={styles.subTabRow}>
            {['숙어', '구동사'].map(category => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.subTab,
                  styles.idiomSubTab,
                  activeIdiomCategory === category && styles.activeIdiomSubTab
                ]}
                onPress={() => {
                  setSearchTerm('');
                  setActiveIdiomCategory(category as '숙어' | '구동사');
                  setSelectedIds(new Set());
                  setDisplayCount(100);
                  setCurrentPage(1);
                  setHasNextPage(false);
                }}
              >
                <Text style={[
                  styles.subTabText,
                  activeIdiomCategory === category && styles.activeIdiomSubTabText
                ]}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* 선택 및 액션 바 */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.selectAllContainer}
          onPress={handleToggleSelectAll}
          disabled={words.length === 0}
        >
          <Icon
            name={isAllSelected ? 'checkbox' : 'square-outline'}
            size={20}
            color={words.length === 0 ? '#8E8E93' : '#007AFF'}
          />
          <Text style={styles.selectAllText}>
            {isAllSelected ? '전체 해제' : '전체 선택'} ({selectedIds.size}개)
            {totalCount > 0 && ` / ${totalCount}개`}
          </Text>
        </TouchableOpacity>
        
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[
              styles.actionBarButton,
              selectedIds.size === 0 && styles.actionBarButtonDisabled
            ]}
            disabled={selectedIds.size === 0}
            onPress={handleAddSelectedToWordbook}
          >
            <Text style={[
              styles.actionBarButtonText,
              selectedIds.size === 0 && styles.actionBarButtonTextDisabled
            ]}>
              선택 {selectedIds.size}개 단어장 추가
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.wordbookButton}
            onPress={() => navigation.navigate('MyWordbook')}
          >
            <Text style={styles.wordbookButtonText}>내 단어장</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 검색 입력 */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="전체 레벨에서 단어 검색..."
          value={searchTerm}
          onChangeText={(text) => {
            setSearchTerm(text);
            setDisplayCount(100);
            setCurrentPage(1);
            setHasNextPage(false);
          }}
          returnKeyType="search"
        />
      </View>

      {/* 단어 목록 */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>목록 로딩 중...</Text>
        </View>
      ) : err ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>해당 레벨 목록을 불러오지 못했습니다.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadVocabData}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : words.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searchTerm ? '검색 결과가 없습니다.' : 
             activeTab === 'idiom' ? '이 카테고리에 표시할 숙어가 없습니다.' : 
             '이 레벨에 표시할 단어가 없습니다.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={words}
          renderItem={renderVocabCard}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            // 더 보기 버튼
            !loading && !err && hasNextPage && activeTab === 'exam' ? (
              <TouchableOpacity style={styles.loadMoreButton} onPress={handleLoadMore}>
                <Text style={styles.loadMoreButtonText}>
                  더 보기 ({totalCount - allWords.length}개 더)
                </Text>
              </TouchableOpacity>
            ) : !loading && !err && (activeTab === 'cefr' || activeTab === 'idiom') && allWords.length > displayCount ? (
              <TouchableOpacity 
                style={styles.loadMoreButton} 
                onPress={() => setDisplayCount(prev => prev + 100)}
              >
                <Text style={styles.loadMoreButtonText}>
                  더 보기 ({allWords.length - displayCount}개 더)
                </Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {/* 상세 보기 모달 - Enhanced to match web version */}
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
              {/* Enhanced Modal Header with badges and audio button */}
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <Text style={styles.modalTitle}>
                    {detailType === 'vocab' ? detail.lemma : detail.idiom}
                  </Text>
                  
                  {/* CEFR and POS Badges */}
                  <View style={styles.modalBadgeContainer}>
                    {detail.levelCEFR && (
                      <View style={[styles.modalBadge, { backgroundColor: getCefrBadgeColor(detail.levelCEFR) }]}>
                        <Text style={styles.modalBadgeText}>{detail.levelCEFR}</Text>
                      </View>
                    )}
                    {detail.pos && (
                      <View style={[styles.modalBadge, { backgroundColor: getPosBadgeColor(detail.pos) }]}>
                        <Text style={styles.modalBadgeText}>{detail.pos}</Text>
                      </View>
                    )}
                  </View>
                </View>
                
                <View style={styles.modalHeaderRight}>
                  {/* Main audio button for gloss */}
                  <TouchableOpacity 
                    style={styles.modalHeaderAudioButton}
                    onPress={() => {
                      if (detailType === 'vocab') {
                        playVocabAudio(detail);
                      } else {
                        playIdiomAudio(detail);
                      }
                    }}
                  >
                    <Icon 
                      name={playingAudio?.type === 'vocab' && playingAudio?.id === detail.id ? 'pause' : 'play'} 
                      size={16} 
                      color="#007AFF" 
                    />
                  </TouchableOpacity>
                  
                  <TouchableOpacity onPress={() => {
                    setDetail(null);
                    stopAudio();
                  }}>
                    <Icon name="close" size={24} color="#333" />
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Modal Body with enhanced content */}
              <View style={styles.modalBody}>
                {/* IPA Pronunciation */}
                {detail.ipa && (
                  <PronComponent ipa={detail.ipa} ipaKo={detail.ipaKo} />
                )}
                
                {/* Korean Gloss */}
                <View style={styles.modalGlossSection}>
                  <Text style={styles.modalGlossText}>
                    {detailType === 'vocab' ? detail.ko_gloss : detail.korean_meaning}
                  </Text>
                </View>
                
                {/* Examples Section */}
                {((detail.example || detail.en_example) || (detail.koExample || detail.ko_example)) && (
                  <View style={styles.modalExampleSection}>
                    <View style={styles.modalSectionHeader}>
                      <Text style={styles.modalSectionTitle}>예문</Text>
                      
                      {/* Example audio button */}
                      <TouchableOpacity 
                        style={styles.modalSectionAudioButton}
                        onPress={() => {
                          if (detailType === 'vocab') {
                            playVocabAudio(detail);
                          }
                        }}
                      >
                        <Icon 
                          name={playingAudio?.type === 'example' && playingAudio?.id === detail.id ? 'pause' : 'play'} 
                          size={16} 
                          color="#007AFF" 
                        />
                      </TouchableOpacity>
                    </View>
                    
                    <View style={styles.modalExampleBox}>
                      {(detail.example || detail.en_example) && (
                        <Text style={styles.modalExampleEnglish}>{detail.example || detail.en_example}</Text>
                      )}
                      {(detail.koExample || detail.ko_example) && (
                        <Text style={styles.modalExampleKorean}>— {detail.koExample || detail.ko_example}</Text>
                      )}
                    </View>
                  </View>
                )}
                
                {/* Usage Section for idioms/phrasal verbs */}
                {detail.category && detail.category.includes('숙어') && (detail.koExample || detail.ko_example) && (
                  <View style={styles.modalUsageSection}>
                    <View style={styles.modalSectionHeader}>
                      <Text style={styles.modalSectionTitle}>사용법</Text>
                      
                      {/* Usage audio button */}
                      <TouchableOpacity 
                        style={styles.modalSectionAudioButton}
                        onPress={() => {
                          playIdiomAudio(detail);
                        }}
                      >
                        <Icon 
                          name={playingAudio?.type === 'idiom' && playingAudio?.id === detail.id ? 'pause' : 'play'} 
                          size={16} 
                          color="#007AFF" 
                        />
                      </TouchableOpacity>
                    </View>
                    
                    <View style={styles.modalUsageBox}>
                      <Text style={styles.modalUsageText}>{detail.koExample || detail.ko_example}</Text>
                    </View>
                  </View>
                )}
                
                {/* Debug Section - collapsible */}
                <TouchableOpacity 
                  style={styles.modalDebugToggle}
                  onPress={() => setShowDebug(prev => !prev)}
                >
                  <Text style={styles.modalDebugToggleText}>debug</Text>
                </TouchableOpacity>
                
                {showDebug && (
                  <View style={styles.modalDebugSection}>
                    <Text style={styles.modalDebugText}>
                      {JSON.stringify(detail, null, 2)}
                    </Text>
                  </View>
                )}
              </View>
              
              {/* Modal Footer with SRS button */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalSrsButton}
                  onPress={() => {
                    handleAddSRS([detail.id]);
                    setDetail(null);
                  }}
                >
                  <Text style={styles.modalSrsButtonText}>SRS에 추가</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => {
                    setDetail(null);
                    stopAudio();
                  }}
                >
                  <Text style={styles.modalCloseButtonText}>닫기</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : null}
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

      {/* 자동 폴더 생성 모달 - 필요시 구현 */}
      <Modal
        visible={autoFolderModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAutoFolderModalOpen(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>자동 폴더 생성</Text>
            <TouchableOpacity onPress={() => setAutoFolderModalOpen(false)}>
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.tempText}>자동 폴더 생성 기능이 구현될 예정입니다.</Text>
            <Text style={styles.tempText}>선택된 단어: {selectedIds.size}개</Text>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// 추가 스타일을 기존 styles에 병합
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

  // 자동 폴더 버튼
  autoFolderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  autoFolderButtonActive: {
    backgroundColor: '#007AFF',
  },
  autoFolderButtonInactive: {
    backgroundColor: '#f0f0f0',
  },
  autoFolderButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  autoFolderButtonTextActive: {
    color: 'white',
  },

  // 탭 네비게이션
  tabContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: 'white',
  },

  // 서브 탭
  subTabContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  subTabTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subTabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  subTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f8f9fa',
  },
  activeSubTab: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  subTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  activeSubTabText: {
    color: 'white',
  },

  // 시험별 서브 탭
  examSubTab: {
    borderColor: '#198754',
    backgroundColor: '#f8f9fa',
  },
  activeExamSubTab: {
    backgroundColor: '#198754',
    borderColor: '#198754',
  },
  activeExamSubTabText: {
    color: 'white',
  },

  // 숙어 서브 탭
  idiomSubTab: {
    borderColor: '#ffc107',
    backgroundColor: '#f8f9fa',
  },
  activeIdiomSubTab: {
    backgroundColor: '#ffc107',
    borderColor: '#ffc107',
  },
  activeIdiomSubTabText: {
    color: '#333',
  },

  // 시험 알림
  noExamAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#e7f3ff',
    borderRadius: 8,
    marginTop: 8,
  },
  noExamText: {
    fontSize: 14,
    color: '#0dcaf0',
    flex: 1,
  },

  // 액션 바
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  selectAllContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectAllText: {
    fontSize: 14,
    color: '#333',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBarButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  actionBarButtonDisabled: {
    backgroundColor: '#e9ecef',
  },
  actionBarButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  actionBarButtonTextDisabled: {
    color: '#999',
  },
  wordbookButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#198754',
    borderRadius: 6,
  },
  wordbookButtonText: {
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
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
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

  // 에러
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
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
    marginHorizontal: 16,
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

  // Enhanced Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modalBadgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  modalBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modalBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  modalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalHeaderAudioButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  modalContent: {
    flex: 1,
  },
  modalBody: {
    padding: 16,
  },
  modalGlossSection: {
    marginVertical: 12,
  },
  modalGlossText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    lineHeight: 24,
  },
  modalExampleSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  modalUsageSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  modalSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  modalSectionAudioButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  modalExampleBox: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  modalExampleEnglish: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    lineHeight: 20,
  },
  modalExampleKorean: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  modalUsageBox: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  modalUsageText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  modalDebugToggle: {
    marginTop: 16,
    paddingVertical: 8,
  },
  modalDebugToggleText: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'underline',
  },
  modalDebugSection: {
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  modalDebugText: {
    fontSize: 10,
    color: '#666',
    fontFamily: 'monospace',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    gap: 12,
  },
  modalSrsButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSrsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  modalCloseButton: {
    flex: 1,
    backgroundColor: '#6c757d',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
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

  // 임시 텍스트
  tempText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginVertical: 20,
  },
});