/*
  MasteredWordsScreen.tsx — React Native 버전
  ------------------------------------------------------------
  웹 MasteredWords.jsx를 모바일 앱에 맞게 리팩토링
*/

import React, { useState, useEffect, useCallback } from 'react';
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
  RefreshControl,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { apiClient } from '../services/apiClient';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MasteredWords'>;

const { width } = Dimensions.get('window');

interface VocabData {
  lemma?: string;
  pos?: string;
  levelCEFR?: string;
  dictMeta?: {
    ipa?: string;
  };
}

interface MasteredCard {
  id: string;
  vocab?: VocabData;
  masteredAt: string;
  masterCycles: number;
  correctTotal: number;
  wrongTotal: number;
}

interface MasteredData {
  masteredCards: MasteredCard[];
  totalMastered: number;
  pagination: {
    hasMore: boolean;
  };
}

interface MasteryStats {
  masteryRate: number;
  masteredCount: number;
  totalCards: number;
  recentMastery?: Array<{
    lemma: string;
    masteredAt: string;
  }>;
}

interface RainbowStarProps {
  size?: 'small' | 'medium' | 'large';
  cycles?: number;
  animated?: boolean;
}

// Rainbow Star Component
const RainbowStar: React.FC<RainbowStarProps> = ({ 
  size = 'medium', 
  cycles = 1, 
  animated = false 
}) => {
  const sizes = {
    small: 20,
    medium: 30,
    large: 40,
  };
  
  const starSize = sizes[size];
  
  return (
    <View style={[
      styles.rainbowStar,
      { width: starSize, height: starSize },
      animated && styles.rainbowStarAnimated
    ]}>
      <Ionicons name="star" size={starSize} color="#FFD700" />
      {cycles > 1 && (
        <View style={styles.cyclesBadge}>
          <Text style={styles.cyclesText}>{cycles}</Text>
        </View>
      )}
    </View>
  );
};

interface StatCardProps {
  gradient: string[];
  title: string;
  value: string | number;
  subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({ gradient, title, value, subtitle }) => (
  <LinearGradient
    colors={gradient}
    style={styles.statCard}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 0 }}
  >
    <Text style={styles.statCardTitle}>{title}</Text>
    <Text style={styles.statCardValue}>{value}</Text>
    {subtitle && <Text style={styles.statCardSubtitle}>{subtitle}</Text>}
  </LinearGradient>
);

interface WordCardProps {
  card: MasteredCard;
  onPress: () => void;
}

const WordCard: React.FC<WordCardProps> = ({ card, onPress }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const correctRate = card.correctTotal > 0 && card.wrongTotal >= 0
    ? ((card.correctTotal / (card.correctTotal + card.wrongTotal)) * 100).toFixed(1)
    : '100';

  return (
    <TouchableOpacity style={styles.wordCard} onPress={onPress} activeOpacity={0.9}>
      {/* Rainbow Star */}
      <View style={styles.wordCardStar}>
        <RainbowStar size="medium" cycles={card.masterCycles} animated={true} />
      </View>
      
      {/* Word Info */}
      <View style={styles.wordCardContent}>
        <Text style={styles.wordCardTitle}>
          {card.vocab?.lemma || 'Unknown Word'}
        </Text>
        <Text style={styles.wordCardSubtitle}>
          {card.vocab?.pos} • {card.vocab?.levelCEFR}
        </Text>
        
        {card.vocab?.dictMeta?.ipa && (
          <Text style={styles.wordCardIpa}>/{card.vocab.dictMeta.ipa}/</Text>
        )}
      </View>
      
      {/* Stats */}
      <View style={styles.wordCardStats}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>마스터 완료:</Text>
          <Text style={styles.statValue}>{formatDate(card.masteredAt)}</Text>
        </View>
        
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>완료 횟수:</Text>
          <Text style={[styles.statValue, styles.statValueHighlight]}>
            {card.masterCycles}회
          </Text>
        </View>
        
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>정답률:</Text>
          <Text style={styles.statValue}>{correctRate}%</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function MasteredWordsScreen({ navigation }: Props) {
  const [masteredData, setMasteredData] = useState<MasteredData | null>(null);
  const [masteryStats, setMasteryStats] = useState<MasteryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState('masteredAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const itemsPerPage = 20;

  const loadMasteredWords = useCallback(async () => {
    try {
      let url = `/srs/mastered?limit=${itemsPerPage}&offset=${currentPage * itemsPerPage}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      
      if (searchTerm.trim()) {
        url += `&search=${encodeURIComponent(searchTerm.trim())}`;
      }
      
      const response = await apiClient.get(url);
      
      if (response.data) {
        setMasteredData(response.data);
      }
    } catch (error) {
      console.error('Failed to load mastered words:', error);
    }
  }, [currentPage, sortBy, sortOrder, searchTerm]);

  const loadMasteryStats = useCallback(async () => {
    try {
      const response = await apiClient.get('/srs/mastery-stats');
      
      if (response.data) {
        setMasteryStats(response.data);
      }
    } catch (error) {
      console.error('Error loading mastery stats:', error);
    }
  }, []);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) {
      setLoading(true);
    }
    
    await Promise.all([
      loadMasteredWords(),
      currentPage === 0 ? loadMasteryStats() : Promise.resolve()
    ]);
    
    setLoading(false);
    if (isRefresh) {
      setRefreshing(false);
    }
  }, [loadMasteredWords, loadMasteryStats, currentPage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setCurrentPage(0);
    loadData(true);
  }, [loadData]);

  const handleSearch = (text: string) => {
    setSearchTerm(text);
    setCurrentPage(0);
  };

  const handleSort = (value: string) => {
    setSortBy(value);
    setCurrentPage(0);
  };

  const handleSortOrder = (value: string) => {
    setSortOrder(value);
    setCurrentPage(0);
  };

  const handleNextPage = () => {
    if (masteredData?.pagination.hasMore) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const renderWordItem = ({ item }: { item: MasteredCard }) => (
    <WordCard
      card={item}
      onPress={() => {
        // Navigate to word detail or do nothing
      }}
    />
  );

  const renderHeader = () => (
    <View>
      {/* Stats Dashboard */}
      {masteryStats && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsContainer}
        >
          <StatCard
            gradient={['#a855f7', '#ec4899']}
            title="마스터율"
            value={`${masteryStats.masteryRate}%`}
            subtitle={`${masteryStats.masteredCount} / ${masteryStats.totalCards}`}
          />
          
          <StatCard
            gradient={['#3b82f6', '#06b6d4']}
            title="총 단어"
            value={masteryStats.totalCards}
          />
          
          <StatCard
            gradient={['#10b981', '#14b8a6']}
            title="마스터 완료"
            value={masteryStats.masteredCount}
          />
          
          <StatCard
            gradient={['#f97316', '#ef4444']}
            title="최근 마스터"
            value={masteryStats.recentMastery?.[0]?.lemma || '없음'}
          />
        </ScrollView>
      )}

      {/* Search and Sort */}
      <View style={styles.controlsContainer}>
        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="마스터한 단어 검색..."
            value={searchTerm}
            onChangeText={handleSearch}
            placeholderTextColor="#999"
          />
          {searchTerm !== '' && (
            <TouchableOpacity
              onPress={() => handleSearch('')}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        {/* Sort Options */}
        <View style={styles.sortContainer}>
          <Text style={styles.sortLabel}>정렬:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.sortButtons}>
              {[
                { value: 'masteredAt', label: '완료일' },
                { value: 'masterCycles', label: '완료횟수' },
                { value: 'correctTotal', label: '정답수' },
                { value: 'lemma', label: '단어명' },
                { value: 'levelCEFR', label: '레벨' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.sortButton,
                    sortBy === option.value && styles.sortButtonActive
                  ]}
                  onPress={() => handleSort(option.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.sortButtonText,
                    sortBy === option.value && styles.sortButtonTextActive
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          
          <TouchableOpacity
            style={styles.orderButton}
            onPress={() => handleSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={sortOrder === 'desc' ? 'arrow-down' : 'arrow-up'} 
              size={16} 
              color="#007AFF" 
            />
          </TouchableOpacity>
        </View>

        {/* Page Info */}
        <Text style={styles.pageInfo}>
          {currentPage * itemsPerPage + 1} - {Math.min((currentPage + 1) * itemsPerPage, masteredData?.totalMastered || 0)} / {masteredData?.totalMastered || 0}
        </Text>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>🌟</Text>
      <Text style={styles.emptyTitle}>
        아직 마스터 완료한 단어가 없습니다
      </Text>
      <Text style={styles.emptySubtitle}>
        120일 사이클을 완주하여 첫 무지개 별을 획득해보세요!
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!masteredData || masteredData.masteredCards.length === 0) return null;

    return (
      <View style={styles.paginationContainer}>
        <TouchableOpacity
          style={[styles.paginationButton, currentPage === 0 && styles.paginationButtonDisabled]}
          onPress={handlePreviousPage}
          disabled={currentPage === 0}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color={currentPage === 0 ? '#ccc' : '#007AFF'} />
          <Text style={[
            styles.paginationButtonText,
            currentPage === 0 && styles.paginationButtonTextDisabled
          ]}>
            이전
          </Text>
        </TouchableOpacity>
        
        <View style={styles.pageIndicator}>
          <Text style={styles.pageIndicatorText}>
            페이지 {currentPage + 1}
          </Text>
        </View>
        
        <TouchableOpacity
          style={[
            styles.paginationButton,
            !masteredData.pagination.hasMore && styles.paginationButtonDisabled
          ]}
          onPress={handleNextPage}
          disabled={!masteredData.pagination.hasMore}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.paginationButtonText,
            !masteredData.pagination.hasMore && styles.paginationButtonTextDisabled
          ]}>
            다음
          </Text>
          <Ionicons 
            name="chevron-forward" 
            size={20} 
            color={!masteredData.pagination.hasMore ? '#ccc' : '#007AFF'} 
          />
        </TouchableOpacity>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>마스터 단어를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>마스터 단어 갤러리</Text>
            <RainbowStar size="large" animated={true} />
          </View>
          <Text style={styles.headerSubtitle}>
            총 마스터 단어: {masteredData?.totalMastered || 0}개
          </Text>
        </View>
      </View>

      {/* Word List */}
      <FlatList
        data={masteredData?.masteredCards || []}
        renderItem={renderWordItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#007AFF']}
            tintColor="#007AFF"
          />
        }
      />
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
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  rainbowStar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  rainbowStarAnimated: {
    // Add animation if needed
  },
  cyclesBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#a855f7',
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  cyclesText: {
    fontSize: 10,
    color: 'white',
    fontWeight: 'bold',
  },
  listContent: {
    flexGrow: 1,
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  statCard: {
    width: width * 0.4,
    padding: 16,
    borderRadius: 12,
  },
  statCardTitle: {
    color: 'white',
    fontSize: 14,
    marginBottom: 8,
  },
  statCardValue: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statCardSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 4,
  },
  controlsContainer: {
    padding: 16,
    backgroundColor: '#f3f4f6',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 4,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sortLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginRight: 8,
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  sortButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  sortButtonText: {
    fontSize: 12,
    color: '#666',
  },
  sortButtonTextActive: {
    color: 'white',
  },
  orderButton: {
    marginLeft: 8,
    padding: 6,
  },
  pageInfo: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
  },
  wordCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  wordCardStar: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  wordCardContent: {
    marginBottom: 12,
  },
  wordCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  wordCardSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  wordCardIpa: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
  },
  wordCardStats: {
    gap: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  statValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  statValueHighlight: {
    color: '#a855f7',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 16,
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  paginationButtonDisabled: {
    borderColor: '#ccc',
  },
  paginationButtonText: {
    fontSize: 14,
    color: '#007AFF',
    marginHorizontal: 4,
  },
  paginationButtonTextDisabled: {
    color: '#ccc',
  },
  pageIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pageIndicatorText: {
    fontSize: 14,
    color: '#666',
  },
});