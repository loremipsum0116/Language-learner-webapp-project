// src/screens/WordbookScreen.tsx
// 내 단어장 화면 (React Native 버전) - MyWordbook.jsx 기능 구현

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import Sound from 'react-native-sound';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../services/apiClient';
import { RootStackParamList } from '../types/navigation';
import { Vocab, SrsFolder } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Wordbook'>;

interface WordbookItem {
  id: number;
  vocabId: number;
  categoryId?: number;
  vocab: Vocab;
  createdAt?: string;
}

interface Category {
  id: number;
  name: string;
  count: number;
}

interface MasteredCard {
  itemType: string;
  itemId: number;
  masterCycles: number;
  masteredAt?: string;
}

// CEFR 레벨 색상 매핑
const getCefrBadgeColor = (level?: string) => {
  switch (level) {
    case 'A1': return '#ef4444';
    case 'A2': return '#f59e0b';
    case 'B1': return '#10b981';
    case 'B2': return '#06b6d4';
    case 'C1': return '#3b82f6';
    case 'C2': return '#1f2937';
    default: return '#6b7280';
  }
};

// POS 태그 색상 매핑
const getPosBadgeColor = (pos?: string) => {
  if (!pos) return '#6b7280';
  switch (pos.toLowerCase().trim()) {
    case 'noun': return '#3b82f6';
    case 'verb': return '#10b981';
    case 'adjective': return '#f59e0b';
    case 'adverb': return '#06b6d4';
    case 'preposition': return '#ef4444';
    default: return '#6b7280';
  }
};

// Rainbow Star Component (간단한 구현)
const RainbowStar: React.FC<{ cycles: number }> = ({ cycles }) => {
  const colors = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'];
  const color = colors[cycles % colors.length];
  
  return (
    <Text style={[styles.rainbowStar, { color }]}>
      {'⭐'.repeat(Math.min(cycles, 3))}
    </Text>
  );
};

const WordbookScreen: React.FC<Props> = ({ navigation }) => {
  const { user, srsIds, refreshSrsIds } = useAuth();
  
  // State
  const [categories, setCategories] = useState<Category[]>([]);
  const [uncategorized, setUncategorized] = useState(0);
  const [words, setWords] = useState<WordbookItem[]>([]);
  const [allWords, setAllWords] = useState<WordbookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<'all' | 'none' | number>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [masteredCards, setMasteredCards] = useState<MasteredCard[]>([]);
  const [displayCount, setDisplayCount] = useState(50);
  
  // Modals
  const [folderModalVisible, setFolderModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [learningModeModalOpen, setLearningModeModalOpen] = useState(false);
  const [selectedVocabIds, setSelectedVocabIds] = useState<number[]>([]);
  
  // Audio
  const soundRef = useRef<Sound | null>(null);

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      const response = await apiClient.request('/categories');
      const data = (response as any)?.data || response;
      setCategories(data?.categories || []);
      setUncategorized(data?.uncategorized || 0);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }, []);

  // Load wordbook
  const loadWordbook = useCallback(async (categoryFilter: 'all' | 'none' | number) => {
    setLoading(true);
    try {
      let url = '/my-wordbook';
      if (categoryFilter === 'none') {
        url += '?categoryId=none';
      } else if (typeof categoryFilter === 'number') {
        url += `?categoryId=${categoryFilter}`;
      }
      
      const response = await apiClient.request(url);
      const data = (response as any)?.data || response;
      const wordsArray = Array.isArray(data) ? data : [];
      
      setAllWords(wordsArray);
      setWords(wordsArray.slice(0, displayCount));
    } catch (error) {
      console.error('Failed to load wordbook:', error);
      Alert.alert('오류', '단어장을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [displayCount]);

  // Load mastered cards
  const loadMasteredCards = useCallback(async () => {
    if (!user) return;
    try {
      const response = await apiClient.request('/srs/mastered-cards');
      const data = (response as any)?.data || response;
      if (Array.isArray(data)) {
        setMasteredCards(data);
      }
    } catch (error) {
      console.error('Failed to fetch mastered cards:', error);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    Promise.all([
      loadCategories(),
      loadWordbook(filter),
      loadMasteredCards(),
    ]);
  }, []);

  // Filter words by search term
  const filteredWords = words.filter(item => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.vocab.lemma?.toLowerCase().includes(term) ||
      item.vocab.gloss?.toLowerCase().includes(term) ||
      item.vocab.ko_gloss?.toLowerCase().includes(term)
    );
  });

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadCategories(),
      loadWordbook(filter),
      loadMasteredCards(),
      refreshSrsIds(),
    ]);
    setRefreshing(false);
  }, [filter, loadCategories, loadWordbook, loadMasteredCards, refreshSrsIds]);

  // Toggle selection
  const toggleSelect = (vocabId: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(vocabId)) {
      newSelected.delete(vocabId);
    } else {
      newSelected.add(vocabId);
    }
    setSelectedIds(newSelected);
  };

  // Select all visible
  const selectAllVisible = () => {
    const visibleIds = new Set(filteredWords.map(w => w.vocabId));
    setSelectedIds(visibleIds);
  };

  // Unselect all
  const unselectAll = () => {
    setSelectedIds(new Set());
  };

  // Create new category
  const createCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    try {
      await apiClient.request('/categories', {
        method: 'POST',
        body: { name: newCategoryName.trim() },
      });
      
      setNewCategoryName('');
      setFolderModalVisible(false);
      await loadCategories();
      Alert.alert('성공', '새 폴더가 생성되었습니다.');
    } catch (error) {
      Alert.alert('오류', '폴더 생성에 실패했습니다.');
    }
  };

  // Move selected words
  const moveSelected = async (targetCategory: 'none' | number) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      Alert.alert('알림', '이동할 단어를 선택하세요.');
      return;
    }
    
    try {
      await apiClient.request('/my-wordbook/move-many', {
        method: 'POST',
        body: {
          vocabIds: ids,
          categoryId: targetCategory,
        },
      });
      
      Alert.alert('성공', `${ids.length}개의 단어를 이동했습니다.`);
      await Promise.all([loadWordbook(filter), loadCategories()]);
      unselectAll();
    } catch (error) {
      Alert.alert('오류', '단어 이동에 실패했습니다.');
    }
  };

  // Delete selected words
  const deleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      Alert.alert('알림', '삭제할 단어를 선택하세요.');
      return;
    }
    
    Alert.alert(
      '확인',
      `${ids.length}개의 단어를 내 단어장에서 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.request('/my-wordbook/remove-many', {
                method: 'POST',
                body: {
                  vocabIds: ids,
                  categoryId: filter,
                },
              });
              
              Alert.alert('성공', `${ids.length}개의 단어를 삭제했습니다.`);
              await Promise.all([loadWordbook(filter), loadCategories()]);
              unselectAll();
            } catch (error) {
              Alert.alert('오류', '단어 삭제에 실패했습니다.');
            }
          },
        },
      ],
    );
  };

  // Add to SRS
  const addToSRS = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      Alert.alert('알림', 'SRS에 추가할 단어를 선택하세요.');
      return;
    }
    
    // TODO: Implement SRS folder picker modal
    Alert.alert('SRS 추가', `${ids.length}개의 단어를 SRS에 추가하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '추가',
        onPress: async () => {
          try {
            // Add to default SRS folder
            for (const vocabId of ids) {
              await apiClient.srs.cards.create(vocabId);
            }
            Alert.alert('성공', 'SRS에 추가되었습니다.');
            await refreshSrsIds();
            unselectAll();
          } catch (error) {
            Alert.alert('오류', 'SRS 추가에 실패했습니다.');
          }
        },
      },
    ]);
  };

  // Start learning
  const startLearning = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      Alert.alert('알림', '학습할 단어를 선택하세요.');
      return;
    }
    
    if (ids.length > 100) {
      Alert.alert('알림', '한 번에 100개 이상의 단어를 자동학습할 수 없습니다.');
      return;
    }
    
    setSelectedVocabIds(ids);
    setLearningModeModalOpen(true);
  };

  // Render word item
  const renderWordItem = ({ item }: { item: WordbookItem }) => {
    const { vocab } = item;
    const gloss = vocab.ko_gloss || vocab.gloss;
    const checked = selectedIds.has(item.vocabId);
    const uniquePosList = [...new Set(vocab.pos ? vocab.pos.split(',').map(p => p.trim()) : [])];
    
    // Check if mastered
    const masteredCard = masteredCards.find(
      card => card.itemType === 'vocab' && card.itemId === item.vocabId
    );
    const isMastered = !!masteredCard;
    const masterCycles = masteredCard?.masterCycles || 0;
    
    // Check if in SRS
    const inSRS = srsIds.has(item.vocabId);
    
    return (
      <TouchableOpacity
        style={[
          styles.wordCard,
          isMastered && styles.wordCardMastered,
          checked && styles.wordCardSelected,
        ]}
        onPress={() => toggleSelect(item.vocabId)}
        activeOpacity={0.7}
      >
        <View style={styles.wordCardContent}>
          <View style={styles.wordCardLeft}>
            <View style={styles.wordCardHeader}>
              <Text style={[styles.wordLemma, isMastered && styles.wordLemmaMastered]}>
                {vocab.lemma}
              </Text>
              {isMastered && <RainbowStar cycles={masterCycles} />}
              {inSRS && <Text style={styles.srsIndicator}>📚</Text>}
            </View>
            
            <Text style={styles.wordGloss}>{gloss}</Text>
            
            <View style={styles.badgeContainer}>
              {vocab.levelCEFR && (
                <View style={[styles.badge, { backgroundColor: getCefrBadgeColor(vocab.levelCEFR) }]}>
                  <Text style={styles.badgeText}>{vocab.levelCEFR}</Text>
                </View>
              )}
              {uniquePosList.map((pos, idx) => (
                <View key={idx} style={[styles.badge, { backgroundColor: getPosBadgeColor(pos) }]}>
                  <Text style={styles.badgeText}>{pos}</Text>
                </View>
              ))}
            </View>
          </View>
          
          <View style={styles.checkboxContainer}>
            <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
              {checked && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Render category button
  const renderCategoryButton = (name: string, count: number, value: 'all' | 'none' | number) => (
    <TouchableOpacity
      style={[styles.categoryButton, filter === value && styles.categoryButtonActive]}
      onPress={() => {
        setFilter(value);
        loadWordbook(value);
      }}
    >
      <Text style={[styles.categoryName, filter === value && styles.categoryNameActive]}>
        {name}
      </Text>
      <Text style={[styles.categoryCount, filter === value && styles.categoryCountActive]}>
        {count}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>내 단어장</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.headerButton} onPress={startLearning}>
            <Text style={styles.headerButtonText}>자동학습</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.navigate('VocabList' as any)}
          >
            <Text style={styles.headerButtonText}>단어 추가</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {/* Categories sidebar */}
        <ScrollView style={styles.sidebar} showsVerticalScrollIndicator={false}>
          {renderCategoryButton('전체', allWords.length, 'all')}
          {renderCategoryButton('미분류', uncategorized, 'none')}
          {categories.map(cat => renderCategoryButton(cat.name, cat.count, cat.id))}
          
          <TouchableOpacity
            style={styles.newCategoryButton}
            onPress={() => setFolderModalVisible(true)}
          >
            <Text style={styles.newCategoryButtonText}>+ 새 폴더</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Main content */}
        <View style={styles.mainContent}>
          {/* Search bar */}
          <TextInput
            style={styles.searchInput}
            placeholder="내 단어장에서 검색 (단어 또는 뜻)"
            placeholderTextColor="#9ca3af"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />

          {/* Selection controls */}
          {filteredWords.length > 0 && (
            <View style={styles.selectionControls}>
              <Text style={styles.selectionInfo}>
                총 {allWords.length}개 • 표시 {filteredWords.length}개
                {selectedIds.size > 0 && ` • 선택 ${selectedIds.size}개`}
              </Text>
              <View style={styles.selectionButtons}>
                <TouchableOpacity
                  style={styles.selectionButton}
                  onPress={selectAllVisible}
                >
                  <Text style={styles.selectionButtonText}>전체 선택</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.selectionButton}
                  onPress={unselectAll}
                >
                  <Text style={styles.selectionButtonText}>선택 해제</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Action buttons */}
          {selectedIds.size > 0 && (
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionButton} onPress={addToSRS}>
                <Text style={styles.actionButtonText}>SRS 추가</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, styles.actionButtonDanger]}
                onPress={deleteSelected}
              >
                <Text style={styles.actionButtonText}>삭제</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Word list */}
          <FlatList
            data={filteredWords}
            renderItem={renderWordItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.wordList}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
            onEndReached={() => {
              if (words.length < allWords.length) {
                setDisplayCount(prev => prev + 50);
                setWords(allWords.slice(0, displayCount + 50));
              }
            }}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={
              loading ? (
                <ActivityIndicator size="large" color="#3b82f6" style={styles.loader} />
              ) : (
                <Text style={styles.emptyText}>단어장이 비어있습니다.</Text>
              )
            }
          />
        </View>
      </View>

      {/* New Category Modal */}
      <Modal
        visible={folderModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFolderModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>새 폴더 만들기</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="폴더 이름"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setFolderModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={createCategory}
              >
                <Text style={styles.modalButtonText}>생성</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Learning Mode Modal */}
      <Modal
        visible={learningModeModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setLearningModeModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>학습 모드 선택</Text>
            <TouchableOpacity
              style={styles.learningModeOption}
              onPress={() => {
                // Navigate to learning screen with word mode
                navigation.navigate('Learning' as any, {
                  vocabIds: selectedVocabIds,
                  mode: 'word',
                });
                setLearningModeModalOpen(false);
              }}
            >
              <Text style={styles.learningModeText}>단어 학습</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.learningModeOption}
              onPress={() => {
                // Navigate to learning screen with gloss mode
                navigation.navigate('Learning' as any, {
                  vocabIds: selectedVocabIds,
                  mode: 'gloss',
                });
                setLearningModeModalOpen(false);
              }}
            >
              <Text style={styles.learningModeText}>뜻 학습</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonCancel]}
              onPress={() => setLearningModeModalOpen(false)}
            >
              <Text style={styles.modalButtonText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#3b82f6',
    borderRadius: 6,
  },
  headerButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 150,
    backgroundColor: 'white',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    paddingVertical: 16,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryButtonActive: {
    backgroundColor: '#eff6ff',
  },
  categoryName: {
    fontSize: 14,
    color: '#4b5563',
    flex: 1,
  },
  categoryNameActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  categoryCount: {
    fontSize: 12,
    color: '#9ca3af',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  categoryCountActive: {
    backgroundColor: '#3b82f6',
    color: 'white',
  },
  newCategoryButton: {
    marginTop: 12,
    marginHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
  },
  newCategoryButtonText: {
    color: '#6b7280',
    fontSize: 14,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: 'white',
    marginBottom: 12,
  },
  selectionControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectionInfo: {
    fontSize: 12,
    color: '#6b7280',
  },
  selectionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  selectionButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
  },
  selectionButtonText: {
    fontSize: 12,
    color: '#4b5563',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#10b981',
    borderRadius: 6,
  },
  actionButtonDanger: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  wordList: {
    paddingBottom: 20,
  },
  wordCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  wordCardMastered: {
    backgroundColor: '#fef3c7',
    borderColor: '#fbbf24',
  },
  wordCardSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  wordCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordCardLeft: {
    flex: 1,
  },
  wordCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  wordLemma: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  wordLemmaMastered: {
    color: '#d97706',
  },
  rainbowStar: {
    fontSize: 14,
  },
  srsIndicator: {
    fontSize: 14,
  },
  wordGloss: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 8,
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '500',
  },
  checkboxContainer: {
    padding: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  checkmark: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loader: {
    marginTop: 50,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 16,
    marginTop: 50,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#e5e7eb',
  },
  modalButtonConfirm: {
    backgroundColor: '#3b82f6',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
  },
  learningModeOption: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  learningModeText: {
    fontSize: 16,
    color: '#1f2937',
    textAlign: 'center',
  },
});

export default WordbookScreen;