/*
  HomeScreen.tsx — React Native 버전
  ------------------------------------------------------------
  웹 Home.jsx를 모바일 앱에 맞게 리팩토링
*/

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../services/apiClient';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const { width } = Dimensions.get('window');

interface DictEntry {
  lemma: string;
  pos: string;
  ipa?: string;
  audio?: string;
  examples?: Array<{
    de: string;
    ko?: string;
    cefr?: string;
  }>;
  license?: string;
  attribution?: string;
}

interface SRSStats {
  srsQueue: number;
  masteredWords: number;
  streakDays: number;
  studiedToday: number;
}

// 영어 특수문자 가상 키패드
function EnglishKeypad({ onInsert }: { onInsert: (char: string) => void }) {
  const keys = ["'", '"', "!", "?", ";", ":", "&", "-"];
  
  return (
    <View style={styles.keypadContainer}>
      {keys.map((key) => (
        <TouchableOpacity
          key={key}
          style={styles.keypadButton}
          onPress={() => onInsert(key)}
          activeOpacity={0.7}
        >
          <Text style={styles.keypadButtonText}>{key}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// 오디오 플레이어 컴포넌트
function AudioPlayer({ src, license, attribution }: { 
  src?: string; 
  license?: string; 
  attribution?: string; 
}) {
  const [sound, setSound] = useState<Audio.Sound>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  const playSound = async () => {
    if (!src) return;

    try {
      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: src },
        { 
          shouldPlay: true,
          rate: playbackRate,
        }
      );
      
      setSound(newSound);
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
    } catch (error) {
      console.error('Audio playback failed:', error);
      Alert.alert('오류', '음성 재생에 실패했습니다.');
    }
  };

  const changePlaybackRate = async (rate: number) => {
    setPlaybackRate(rate);
    if (sound) {
      await sound.setRateAsync(rate, true);
    }
  };

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  if (!src) return null;

  return (
    <View style={styles.audioPlayer}>
      <TouchableOpacity
        style={styles.audioButton}
        onPress={playSound}
        disabled={isPlaying}
        activeOpacity={0.7}
      >
        <Text style={styles.audioButtonText}>
          {isPlaying ? '🔊 재생 중...' : '🔊 재생'}
        </Text>
      </TouchableOpacity>
      
      <View style={styles.speedControls}>
        <Text style={styles.speedLabel}>Speed:</Text>
        {[0.75, 1.0, 1.25].map((rate) => (
          <TouchableOpacity
            key={rate}
            style={[
              styles.speedButton,
              playbackRate === rate && styles.speedButtonActive
            ]}
            onPress={() => changePlaybackRate(rate)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.speedButtonText,
              playbackRate === rate && styles.speedButtonTextActive
            ]}>
              {rate.toFixed(2)}×
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {(license || attribution) && (
        <Text style={styles.audioCredit}>
          {license ? `License: ${license}` : ''} {attribution ? ` | © ${attribution}` : ''}
        </Text>
      )}
    </View>
  );
}

export default function HomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  
  // SRS 위젯 상태
  const [srsCount, setSrsCount] = useState<number | null>(null);
  const [srsLoading, setSrsLoading] = useState(true);
  
  // 사전 검색 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [dictEntries, setDictEntries] = useState<DictEntry[]>([]);
  const [searchLatency, setSearchLatency] = useState<number | null>(null);
  
  // 대시보드 통계 상태
  const [dashStats, setDashStats] = useState<SRSStats>({
    srsQueue: 0,
    masteredWords: 0,
    streakDays: 0,
    studiedToday: 0
  });
  const [dashStatsLoading, setDashStatsLoading] = useState(true);
  
  // 인증 에러 상태
  const [authError, setAuthError] = useState<any>(null);
  
  // 운영자 체크
  const isAdmin = user?.email === 'super@root.com';
  
  const searchInputRef = useRef<TextInput>(null);

  // SRS 데이터 로드
  const loadSrsData = useCallback(async () => {
    try {
      const response = await apiClient.get('/srs/available');
      if (response.success && Array.isArray(response.data)) {
        setSrsCount(response.data.length);
      }
    } catch (error) {
      console.error('Failed to load SRS data:', error);
      setSrsCount(0);
    } finally {
      setSrsLoading(false);
    }
  }, []);

  // 대시보드 통계 로드
  const loadDashboardStats = useCallback(async () => {
    try {
      const [srsQueueRes, masteredCardsRes, streakRes] = await Promise.all([
        apiClient.get('/srs/available'),
        apiClient.get('/srs/mastered-cards'),
        apiClient.get('/srs/streak')
      ]);

      const masteredData = Array.isArray(masteredCardsRes.data) ? masteredCardsRes.data : [];
      const streakData = streakRes.data || {};
      
      setDashStats({
        srsQueue: Array.isArray(srsQueueRes.data) ? srsQueueRes.data.length : 0,
        masteredWords: masteredData.length,
        streakDays: streakData.streak || 0,
        studiedToday: streakData.dailyQuizCount || 0
      });
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    } finally {
      setDashStatsLoading(false);
    }
  }, []);

  // 사전 검색
  const handleDictSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    
    setSearchLoading(true);
    const startTime = Date.now();
    
    try {
      const response = await apiClient.get(`/dict/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const endTime = Date.now();
      
      setSearchLatency(endTime - startTime);
      
      if (response.success) {
        const entries = response.data?.entries || response.data || [];
        setDictEntries(Array.isArray(entries) ? entries : []);
      }
    } catch (error: any) {
      console.error('Dictionary search failed:', error);
      setDictEntries([]);
      
      if (error.status === 401) {
        Alert.alert('세션 만료', '다시 로그인해주세요.', [
          { text: '확인', onPress: () => navigation.navigate('Login') }
        ]);
      }
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery, navigation]);

  // 인증 상태 체크
  const checkAuth = useCallback(async () => {
    try {
      await apiClient.get('/me');
    } catch (error: any) {
      setAuthError(error);
    }
  }, []);

  // SRS 학습 시작
  const startSrsReview = useCallback(async () => {
    try {
      const response = await apiClient.get('/srs/available');
      
      if (response.success && Array.isArray(response.data) && response.data.length > 0) {
        const vocabIds = response.data
          .map(card => card.srsfolderitem?.[0]?.vocabId || card.srsfolderitem?.[0]?.vocab?.id)
          .filter(Boolean);
        
        if (vocabIds.length > 0) {
          navigation.navigate('LearnVocab', { 
            mode: 'all_overdue',
            selectedItems: vocabIds.join(',')
          });
        } else {
          Alert.alert('알림', '복습할 단어가 없습니다.');
        }
      } else {
        Alert.alert('알림', '복습할 카드가 없습니다.');
      }
    } catch (error) {
      console.error('Failed to start SRS review:', error);
      Alert.alert('오류', '복습을 시작할 수 없습니다.');
    }
  }, [navigation]);

  // 전체 데이터 로드
  const loadAllData = useCallback(async () => {
    await Promise.all([
      loadSrsData(),
      loadDashboardStats(),
      checkAuth()
    ]);
  }, [loadSrsData, loadDashboardStats, checkAuth]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  }, [loadAllData]);

  const insertCharacter = useCallback((char: string) => {
    setSearchQuery(prev => prev + char);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#3b82f6']}
            tintColor="#3b82f6"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>
            🐥 단무새와 함께하는 영어 학습
          </Text>
          <Text style={styles.heroSubtitle}>
            SRS 단어 학습, 문법 연습, 리딩 이해력을 한 곳에서! 귀여운 단무새와 함께 
            🔊 음성 사전을 경험해보세요.
          </Text>
          
          <View style={styles.heroActions}>
            <TouchableOpacity
              style={[styles.heroButton, styles.heroButtonPrimary]}
              onPress={() => navigation.navigate('SrsDashboard')}
              activeOpacity={0.8}
            >
              <Text style={styles.heroButtonText}>🎆 오늘 학습 시작</Text>
            </TouchableOpacity>
            
            <View style={styles.heroButtonRow}>
              <TouchableOpacity
                style={[styles.heroButton, styles.heroButtonOutline]}
                onPress={() => navigation.navigate('Dictionary')}
                activeOpacity={0.8}
              >
                <Text style={styles.heroButtonOutlineText}>📚 사전</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.heroButton, styles.heroButtonOutline]}
                onPress={() => navigation.navigate('VocabList')}
                activeOpacity={0.8}
              >
                <Text style={styles.heroButtonOutlineText}>📖 단어장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 인증 에러 알림 */}
        {authError && authError.status === 401 && (
          <View style={styles.authErrorBanner}>
            <Text style={styles.authErrorText}>
              세션이 만료되었습니다(401). 15분 유휴 정책에 따라 재로그인이 필요할 수 있습니다.
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.authErrorLink}>로그인</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 운영자 패널 */}
        {isAdmin && (
          <View style={styles.adminPanel}>
            <Text style={styles.adminTitle}>🛠️ 운영자 패널</Text>
            <Text style={styles.adminDescription}>
              시간 가속 컨트롤러와 고급 관리 기능에 접근할 수 있습니다.
            </Text>
            <View style={styles.adminActions}>
              <TouchableOpacity
                style={styles.adminButton}
                onPress={() => navigation.navigate('Admin')}
                activeOpacity={0.8}
              >
                <Text style={styles.adminButtonText}>관리자 콘솔</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.adminButton, styles.adminButtonSolid]}
                onPress={() => navigation.navigate('AdminDashboard')}
                activeOpacity={0.8}
              >
                <Text style={[styles.adminButtonText, styles.adminButtonSolidText]}>
                  운영자 대시보드
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 위젯 섹션 */}
        <View style={styles.widgetSection}>
          {/* SRS 위젯 */}
          <View style={styles.widgetCard}>
            <Text style={styles.widgetTitle}>🐥 오늘의 SRS</Text>
            {srsLoading ? (
              <ActivityIndicator size="small" color="#3b82f6" />
            ) : (
              <View style={styles.srsWidget}>
                <Text style={styles.srsCount}>복습 대기: {srsCount}개</Text>
                <TouchableOpacity
                  style={styles.srsButton}
                  onPress={startSrsReview}
                  activeOpacity={0.8}
                >
                  <Text style={styles.srsButtonText}>복습 시작</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* 사전 검색 위젯 */}
          <View style={styles.widgetCard}>
            <Text style={styles.widgetTitle}>📚 사전 검색</Text>
            
            <View style={styles.searchContainer}>
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="영어 또는 한국어 뜻 검색"
                placeholderTextColor="#9ca3af"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleDictSearch}
                returnKeyType="search"
              />
              <TouchableOpacity
                style={styles.searchButton}
                onPress={handleDictSearch}
                disabled={searchLoading}
                activeOpacity={0.8}
              >
                <Text style={styles.searchButtonText}>
                  {searchLoading ? '검색 중...' : '🔍'}
                </Text>
              </TouchableOpacity>
            </View>

            <EnglishKeypad onInsert={insertCharacter} />

            {searchLatency !== null && (
              <Text style={styles.latencyText}>
                API {searchLatency}ms {searchLatency <= 300 ? '✅' : '⚠️'}
              </Text>
            )}

            <View style={styles.dictResults}>
              {dictEntries.slice(0, 2).map((entry, index) => (
                <View key={index} style={styles.dictEntry}>
                  <View style={styles.dictEntryHeader}>
                    <Text style={styles.dictEntryWord}>{entry.lemma}</Text>
                    <Text style={styles.dictEntryPos}>{entry.pos}</Text>
                  </View>
                  
                  {entry.ipa && (
                    <Text style={styles.dictEntryIpa}>/{entry.ipa}/</Text>
                  )}
                  
                  <AudioPlayer 
                    src={entry.audio} 
                    license={entry.license} 
                    attribution={entry.attribution} 
                  />
                  
                  {entry.examples && entry.examples.length > 0 && (
                    <View style={styles.dictExamples}>
                      {entry.examples.slice(0, 1).map((example, idx) => (
                        <View key={idx} style={styles.dictExample}>
                          <Text style={styles.dictExampleEn}>{example.de}</Text>
                          {example.ko && (
                            <Text style={styles.dictExampleKo}> — {example.ko}</Text>
                          )}
                          {example.cefr && (
                            <Text style={styles.dictExampleCefr}> ({example.cefr})</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.dictDetailButton}
              onPress={() => navigation.navigate('Dictionary')}
              activeOpacity={0.8}
            >
              <Text style={styles.dictDetailButtonText}>상세 검색 →</Text>
            </TouchableOpacity>
          </View>

          {/* 대시보드 위젯 */}
          <View style={styles.widgetCard}>
            <Text style={styles.widgetTitle}>📊 학습 통계</Text>
            
            {dashStatsLoading ? (
              <ActivityIndicator size="small" color="#3b82f6" />
            ) : (
              <View style={styles.dashboardStats}>
                <View style={styles.statsGrid}>
                  <View style={styles.statItem}>
                    <Text style={styles.statIcon}>📚</Text>
                    <Text style={styles.statNumber}>{dashStats.srsQueue}</Text>
                    <Text style={styles.statLabel}>복습 대기</Text>
                  </View>
                  
                  <View style={styles.statItem}>
                    <Text style={styles.statIcon}>🏆</Text>
                    <Text style={styles.statNumber}>{dashStats.masteredWords}</Text>
                    <Text style={styles.statLabel}>마스터</Text>
                  </View>
                  
                  <View style={styles.statItem}>
                    <Text style={styles.statIcon}>🔥</Text>
                    <Text style={styles.statNumber}>{dashStats.streakDays}</Text>
                    <Text style={styles.statLabel}>연속일</Text>
                  </View>
                  
                  <View style={styles.statItem}>
                    <Text style={styles.statIcon}>✨</Text>
                    <Text style={styles.statNumber}>{dashStats.studiedToday}</Text>
                    <Text style={styles.statLabel}>오늘</Text>
                  </View>
                </View>
                
                <TouchableOpacity
                  style={styles.dashboardButton}
                  onPress={() => navigation.navigate('Dashboard')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dashboardButtonText}>📊 상세 대시보드</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* 학습 영역 섹션 */}
        <View style={styles.learningSection}>
          <Text style={styles.learningSectionTitle}>📚 학습 영역</Text>
          
          <View style={styles.learningGrid}>
            {/* 문법 카드 */}
            <View style={styles.learningCard}>
              <View style={styles.learningCardHeader}>
                <Text style={styles.learningCardTitle}>📝 문법 연습</Text>
                <View style={styles.learningBadge}>
                  <Text style={styles.learningBadgeText}>Grammar</Text>
                </View>
              </View>
              
              <Text style={styles.learningCardDescription}>
                체계적인 영어 문법 학습으로 정확한 영어 구사력을 키워보세요.
              </Text>
              
              <View style={styles.levelButtons}>
                {['A1', 'A2', 'B1', 'B2', 'C1'].map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={styles.levelButton}
                    onPress={() => navigation.navigate('GrammarHub', { level })}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.levelButtonText}>{level}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <TouchableOpacity
                style={styles.learningMainButton}
                onPress={() => navigation.navigate('GrammarHub')}
                activeOpacity={0.8}
              >
                <Text style={styles.learningMainButtonText}>전체 문법 목록 보기 →</Text>
              </TouchableOpacity>
            </View>

            {/* 리딩 카드 */}
            <View style={styles.learningCard}>
              <View style={styles.learningCardHeader}>
                <Text style={styles.learningCardTitle}>📖 리딩 연습</Text>
                <View style={[styles.learningBadge, styles.learningBadgeReading]}>
                  <Text style={styles.learningBadgeText}>Reading</Text>
                </View>
              </View>
              
              <Text style={styles.learningCardDescription}>
                다양한 주제의 텍스트를 읽고 독해력을 향상시켜보세요.
              </Text>
              
              <View style={styles.levelButtons}>
                {['A1', 'A2', 'B1', 'B2', 'C1'].map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[styles.levelButton, styles.levelButtonReading]}
                    onPress={() => navigation.navigate('Reading', { level })}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.levelButtonText}>{level}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <TouchableOpacity
                style={[styles.learningMainButton, styles.learningMainButtonReading]}
                onPress={() => navigation.navigate('ReadingList')}
                activeOpacity={0.8}
              >
                <Text style={styles.learningMainButtonText}>전체 리딩 목록 보기 →</Text>
              </TouchableOpacity>
            </View>

            {/* 리스닝 카드 */}
            <View style={styles.learningCard}>
              <View style={styles.learningCardHeader}>
                <Text style={styles.learningCardTitle}>🎧 리스닝 연습</Text>
                <View style={[styles.learningBadge, styles.learningBadgeListening]}>
                  <Text style={styles.learningBadgeText}>Listening</Text>
                </View>
              </View>
              
              <Text style={styles.learningCardDescription}>
                원어민 음성을 듣고 청취력을 기르며 발음을 익혀보세요.
              </Text>
              
              <View style={styles.levelButtons}>
                {['A1', 'A2', 'B1', 'B2', 'C1'].map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[styles.levelButton, styles.levelButtonListening]}
                    onPress={() => navigation.navigate('ListeningList', { level })}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.levelButtonText}>{level}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <TouchableOpacity
                style={[styles.learningMainButton, styles.learningMainButtonListening]}
                onPress={() => navigation.navigate('Listening')}
                activeOpacity={0.8}
              >
                <Text style={styles.learningMainButtonText}>전체 리스닝 목록 보기 →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  heroSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  heroActions: {
    gap: 12,
  },
  heroButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  heroButtonPrimary: {
    backgroundColor: '#3b82f6',
  },
  heroButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    flex: 1,
  },
  heroButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  heroButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  heroButtonOutlineText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  authErrorBanner: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    margin: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authErrorText: {
    color: '#92400e',
    fontSize: 14,
    flex: 1,
  },
  authErrorLink: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  adminPanel: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  adminTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0c4a6e',
    marginBottom: 8,
  },
  adminDescription: {
    fontSize: 14,
    color: '#0369a1',
    marginBottom: 16,
  },
  adminActions: {
    flexDirection: 'row',
    gap: 12,
  },
  adminButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0ea5e9',
    backgroundColor: 'transparent',
  },
  adminButtonSolid: {
    backgroundColor: '#0ea5e9',
  },
  adminButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0ea5e9',
  },
  adminButtonSolidText: {
    color: 'white',
  },
  widgetSection: {
    gap: 16,
    marginBottom: 24,
  },
  widgetCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  widgetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  srsWidget: {
    alignItems: 'center',
    gap: 12,
  },
  srsCount: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  srsButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  srsButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  searchButton: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  searchButtonText: {
    fontSize: 16,
    color: '#374151',
  },
  keypadContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  keypadButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  keypadButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  latencyText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  dictResults: {
    gap: 12,
    marginBottom: 16,
  },
  dictEntry: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
  },
  dictEntryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  dictEntryWord: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  dictEntryPos: {
    fontSize: 12,
    color: '#6b7280',
  },
  dictEntryIpa: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  audioPlayer: {
    marginBottom: 8,
  },
  audioButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  audioButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  speedControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  speedLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  speedButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  speedButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  speedButtonText: {
    fontSize: 10,
    color: '#374151',
  },
  speedButtonTextActive: {
    color: 'white',
  },
  audioCredit: {
    fontSize: 10,
    color: '#9ca3af',
  },
  dictExamples: {
    marginTop: 8,
  },
  dictExample: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dictExampleEn: {
    fontSize: 14,
    color: '#374151',
  },
  dictExampleKo: {
    fontSize: 14,
    color: '#6b7280',
  },
  dictExampleCefr: {
    fontSize: 12,
    color: '#9ca3af',
  },
  dictDetailButton: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dictDetailButtonText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '500',
  },
  dashboardStats: {
    gap: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statItem: {
    alignItems: 'center',
    width: '22%',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  dashboardButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  dashboardButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  learningSection: {
    marginBottom: 24,
  },
  learningSectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 20,
  },
  learningGrid: {
    gap: 16,
  },
  learningCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  learningCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  learningCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  learningBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  learningBadgeReading: {
    backgroundColor: '#059669',
  },
  learningBadgeListening: {
    backgroundColor: '#dc2626',
  },
  learningBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  learningCardDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  levelButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  levelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  levelButtonReading: {
    borderColor: '#059669',
  },
  levelButtonListening: {
    borderColor: '#dc2626',
  },
  levelButtonText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '600',
  },
  learningMainButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  learningMainButtonReading: {
    backgroundColor: '#059669',
  },
  learningMainButtonListening: {
    backgroundColor: '#dc2626',
  },
  learningMainButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});