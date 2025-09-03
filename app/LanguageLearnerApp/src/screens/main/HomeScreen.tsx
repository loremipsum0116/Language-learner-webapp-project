// src/screens/main/HomeScreen.tsx
// 홈 대시보드 화면 (React Native 버전) - Web Home.jsx 기반 리팩토링

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import { MainTabsParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<MainTabsParamList, 'Home'>;

const { width } = Dimensions.get('window');

interface AudioPlayerProps {
  src?: string;
  license?: string;
  attribution?: string;
}

interface DictEntry {
  lemma: string;
  pos: string;
  ipa?: string;
  audio?: string;
  license?: string;
  attribution?: string;
  examples: Array<{
    de: string;
    ko?: string;
    cefr?: string;
  }>;
}

interface SrsStats {
  srsQueue: number;
  masteredWords: number;
  streakDays: number;
  studiedToday: number;
}

interface ReadingItem {
  id: string;
  title: string;
  levelCEFR: string;
}

// Audio Player Component
const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, license, attribution }) => {
  const [sound, setSound] = useState<Audio.Sound>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  const playSound = async () => {
    try {
      if (!src) return;
      
      if (sound) {
        await sound.unloadAsync();
      }
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: src },
        { shouldPlay: true, rate: playbackRate }
      );
      
      setSound(newSound);
      setIsPlaying(true);
      
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
    } catch (error) {
      console.error('Error playing sound:', error);
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
      <TouchableOpacity style={styles.playButton} onPress={playSound}>
        <Ionicons 
          name={isPlaying ? "pause" : "play"} 
          size={20} 
          color="#007AFF" 
        />
      </TouchableOpacity>
      
      <View style={styles.speedControls}>
        <Text style={styles.speedLabel}>속도:</Text>
        {[0.75, 1.0, 1.25].map((rate) => (
          <TouchableOpacity
            key={rate}
            style={[
              styles.speedButton,
              playbackRate === rate && styles.speedButtonActive
            ]}
            onPress={() => changePlaybackRate(rate)}
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
        <Text style={styles.attribution}>
          {license ? `License: ${license}` : ''} {attribution ? ` | © ${attribution}` : ''}
        </Text>
      )}
    </View>
  );
};

// SRS Widget Component
const SrsWidget: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSrsData = async () => {
      try {
        const response = await apiClient.get('/srs/available');
        const data = Array.isArray(response.data) ? response.data : [];
        setCount(data.length);
      } catch (err) {
        console.error('Failed to fetch SRS data:', err);
        setError('SRS 데이터를 불러올 수 없습니다');
      } finally {
        setLoading(false);
      }
    };

    fetchSrsData();
  }, []);

  const handleStartReview = async () => {
    try {
      const response = await apiClient.get('/srs/available');
      const data = Array.isArray(response.data) ? response.data : [];
      
      if (data.length > 0) {
        const vocabIds = data
          .map(card => card.srsfolderitem?.[0]?.vocabId || card.srsfolderitem?.[0]?.vocab?.id)
          .filter(Boolean);
        
        if (vocabIds.length > 0) {
          navigation.navigate('Quiz', { 
            mode: 'srs',
            vocabIds: vocabIds.join(',')
          });
        } else {
          Alert.alert('알림', '복습할 단어가 없습니다.');
        }
      } else {
        Alert.alert('알림', '복습할 카드가 없습니다.');
      }
    } catch (error) {
      console.error('Failed to start review:', error);
      Alert.alert('오류', '복습을 시작할 수 없습니다.');
    }
  };

  if (loading) {
    return (
      <View style={styles.widgetCard}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.widgetCard}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.widgetCard}>
      <View style={styles.widgetHeader}>
        <Image source={require('../../../assets/danmoosae.png')} style={styles.widgetIcon} />
        <Text style={styles.widgetTitle}>오늘의 SRS</Text>
      </View>
      <Text style={styles.reviewCount}>복습 대기: {count}개</Text>
      <TouchableOpacity style={styles.startButton} onPress={handleStartReview}>
        <Text style={styles.startButtonText}>복습 시작</Text>
      </TouchableOpacity>
    </View>
  );
};

// Dictionary Quick Panel Component
const DictQuickPanel: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<DictEntry[]>([]);

  const onSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const response = await apiClient.get(`/dict/search?q=${encodeURIComponent(query.trim())}`);
      const data = response.data?.entries || response.entries || [];
      setEntries(data);
    } catch (error) {
      console.error('Dictionary search failed:', error);
      Alert.alert('오류', '사전 검색에 실패했습니다.');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.widgetCard}>
      <Text style={styles.widgetTitle}>📚 사전 검색</Text>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="영어 또는 한국어 뜻 검색"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={onSearch}
        />
        <TouchableOpacity 
          style={styles.searchButton} 
          onPress={onSearch}
          disabled={loading}
        >
          <Ionicons 
            name="search" 
            size={20} 
            color={loading ? "#666" : "#007AFF"} 
          />
        </TouchableOpacity>
      </View>
      
      {entries.slice(0, 2).map((entry, idx) => (
        <View key={idx} style={styles.dictEntry}>
          <View style={styles.dictHeader}>
            <Text style={styles.dictLemma}>{entry.lemma}</Text>
            <Text style={styles.dictPos}>{entry.pos}</Text>
          </View>
          {entry.ipa && (
            <Text style={styles.dictIpa}>/{entry.ipa}/</Text>
          )}
          <AudioPlayer 
            src={entry.audio} 
            license={entry.license} 
            attribution={entry.attribution} 
          />
          {entry.examples && entry.examples.length > 0 && (
            <View style={styles.examples}>
              {entry.examples.slice(0, 1).map((example, i) => (
                <View key={i} style={styles.example}>
                  <Text style={styles.exampleEn}>{example.de}</Text>
                  {example.ko && (
                    <Text style={styles.exampleKo}>— {example.ko}</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
      
      <TouchableOpacity 
        style={styles.detailButton}
        onPress={() => navigation.navigate('Dictionary')}
      >
        <Text style={styles.detailButtonText}>상세 보기 →</Text>
      </TouchableOpacity>
    </View>
  );
};

// Dashboard Widget Component
const DashboardWidget: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [stats, setStats] = useState<SrsStats>({
    srsQueue: 0,
    masteredWords: 0,
    streakDays: 0,
    studiedToday: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [srsQueueRes, masteredCardsRes, streakRes] = await Promise.all([
          apiClient.get('/srs/available'),
          apiClient.get('/srs/mastered-cards'),
          apiClient.get('/srs/streak')
        ]);

        const masteredData = Array.isArray(masteredCardsRes.data) ? masteredCardsRes.data : [];
        const streakData = streakRes.data || {};
        
        setStats({
          srsQueue: Array.isArray(srsQueueRes.data) ? srsQueueRes.data.length : 0,
          masteredWords: masteredData.length,
          streakDays: streakData.streak || 0,
          studiedToday: streakData.dailyQuizCount || 0
        });
      } catch (err) {
        console.error('Dashboard widget data loading failed:', err);
        setError('통계를 불러올 수 없습니다');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <View style={styles.widgetCard}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.widgetCard}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.widgetCard}>
      <Text style={styles.widgetTitle}>📊 학습 통계</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.srsQueue}</Text>
          <Text style={styles.statLabel}>복습 대기</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.masteredWords}</Text>
          <Text style={styles.statLabel}>마스터</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.streakDays}</Text>
          <Text style={styles.statLabel}>연속일</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.studiedToday}</Text>
          <Text style={styles.statLabel}>오늘</Text>
        </View>
      </View>
    </View>
  );
};

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const isAdmin = user?.email === 'super@root.com';

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) {
        setLoading(true);
      }
      setError(null);

      // Fetch real data from server using the API client
      const [dashboardData, srsStatusData, userProfile] = await Promise.all([
        apiClient.srs.getDashboard(),
        apiClient.srs.getStatus(),
        apiClient.user.profile()
      ]);

      // Process dashboard stats
      const srsQueue = (dashboardData as any)?.totalDue || 0;
      const odatNote = (dashboardData as any)?.odatNotes || 0;
      const masteredWords = (dashboardData as any)?.masteredCount || 0;

      setStats({
        srsQueue,
        odatNote,
        masteredWords
      });

      // Process alarm info
      const alarmData = {
        totalDue: srsQueue,
        nextAlarmAtKst: (srsStatusData as any)?.nextReview || null
      };
      setAlarm(alarmData);

      // Process SRS status
      const statusData: SrsStatus = {
        shouldShowAlarm: srsQueue > 0,
        overdueCount: (srsStatusData as any)?.overdueCount || 0,
        alarmInfo: (srsStatusData as any)?.alarmInfo
      };
      setSrsStatus(statusData);

      // Process streak info from user profile
      const streakData: StreakInfo = {
        currentStreak: (userProfile as any)?.stats?.currentStreak || 0,
        longestStreak: (userProfile as any)?.stats?.longestStreak || 0,
        dailyQuizCount: (userProfile as any)?.stats?.todayCount || 0,
        todayStudied: (userProfile as any)?.stats?.todayStudied || false
      };
      setStreakInfo(streakData);
      setSrsStatus(mockSrsStatus);
      setStreakInfo(mockStreakInfo);

    } catch (err: any) {
      console.error('Dashboard data fetch failed:', err);
      setError(err.message || '데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
      if (isRefresh) {
        setRefreshing(false);
      }
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData(true);
  }, [fetchDashboardData]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const cefrLevel = user?.profile?.level || 'A1';

  // Overdue Alert Component
  const OverdueAlert = () => {
    if (!srsStatus?.shouldShowAlarm || !srsStatus?.alarmInfo) return null;
    
    const { overdueCount, alarmInfo } = srsStatus;
    
    return (
      <AlertBanner
        type="error"
        title="⚠️ 긴급 복습 알림"
        message={`복습 기한이 임박한 단어가 ${overdueCount}개 있습니다.\n다음 알림: ${alarmInfo.nextAlarmAtKst} (${alarmInfo.minutesToNextAlarm}분 후)`}
        style={styles.alertBanner}
      />
    );
  };

  // Regular Alarm Component
  const RegularAlarm = () => {
    if (!alarm.totalDue || srsStatus?.shouldShowAlarm) return null;
    
    const alarmText = `오늘 미학습 ${alarm.totalDue}개가 남았습니다.${
      alarm.nextAlarmAtKst ? ` (다음 알림: ${alarm.nextAlarmAtKst})` : ''
    }`;
    
    return (
      <AlertBanner
        type="warning"
        title="🔔 학습 알림"
        message={alarmText}
        style={styles.alertBanner}
      />
    );
  };

  // Streak Card Component
  const StreakCard = () => (
    <View style={styles.streakCard}>
      <Text style={styles.streakTitle}>연속 학습일</Text>
      <View style={styles.streakContent}>
        <View style={styles.streakItem}>
          <Text style={styles.streakValue}>{streakInfo?.currentStreak || 0}</Text>
          <Text style={styles.streakLabel}>현재</Text>
        </View>
        <View style={styles.streakDivider} />
        <View style={styles.streakItem}>
          <Text style={styles.streakValue}>{streakInfo?.longestStreak || 0}</Text>
          <Text style={styles.streakLabel}>최장</Text>
        </View>
      </View>
      <View style={styles.streakFooter}>
        <Text style={styles.streakFooterText}>
          오늘 {streakInfo?.dailyQuizCount || 0}회 학습 완료
        </Text>
        {streakInfo?.todayStudied && (
          <Text style={styles.streakBadge}>✅</Text>
        )}
      </View>
    </View>
  );

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <AlertBanner
            type="error"
            title="오류 발생"
            message={error}
            onClose={() => setError(null)}
          />
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchDashboardData()}
            activeOpacity={0.7}
          >
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3b82f6']}
            tintColor="#3b82f6"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <FadeInView duration={600} style={styles.content}>
          {/* Welcome Section */}
          <SlideInView direction="down" delay={100} style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>Welcome, {user?.email}!</Text>
            <Text style={styles.welcomeSubtitle}>
              현재 설정된 학습 레벨은 <Text style={styles.cefrLevel}>{cefrLevel}</Text> 입니다.{'\n'}
              오늘도 꾸준히 학습해 보세요!
            </Text>
          </SlideInView>

          {/* Alert Banners */}
          <OverdueAlert />
          <RegularAlarm />

          {/* Stats Cards */}
          <SlideInView direction="up" delay={200} style={styles.statsSection}>
            <Text style={styles.sectionTitle}>학습 현황</Text>
            <View style={styles.statsGrid}>
              <StatCard
                title="오늘 학습할 카드"
                value={stats.srsQueue}
                icon="📚"
                loading={loading}
                color="#3b82f6"
                onPress={() => navigation.navigate('Study')}
              />
              <StatCard
                title="오답 노트 단어"
                value={stats.odatNote}
                icon="❌"
                loading={loading}
                color="#ef4444"
                onPress={() => navigation.navigate('WrongAnswers')}
              />
              <StatCard
                title="마스터 한 단어"
                value={stats.masteredWords}
                icon="🏆"
                loading={loading}
                color="#10b981"
                onPress={() => navigation.navigate('MasteredWords')}
              />
            </View>
          </SlideInView>

          {/* Streak Card */}
          <SlideInView direction="up" delay={400} style={styles.streakSection}>
            <Text style={styles.sectionTitle}>학습 기록</Text>
            <StreakCard />
          </SlideInView>

          {/* Quick Actions */}
          <SlideInView direction="up" delay={600} style={styles.actionsSection}>
            <Text style={styles.sectionTitle}>빠른 학습</Text>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryAction]}
                onPress={() => navigation.navigate('Study')}
                activeOpacity={0.7}
              >
                <Text style={styles.actionButtonIcon}>🚀</Text>
                <Text style={styles.actionButtonText}>SRS 학습 시작</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryAction]}
                onPress={() => navigation.navigate('Vocabulary')}
                activeOpacity={0.7}
              >
                <Text style={styles.actionButtonIcon}>📖</Text>
                <Text style={styles.actionButtonText}>단어장 보기</Text>
              </TouchableOpacity>
            </View>
          </SlideInView>
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  content: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 16,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  welcomeSection: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 24,
  },
  cefrLevel: {
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  alertBanner: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  statsSection: {
    marginBottom: 24,
  },
  statsGrid: {
    paddingHorizontal: 16,
    gap: 12,
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#f3f4f6',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  statIconText: {
    fontSize: 24,
  },
  statInfo: {
    flex: 1,
  },
  statTitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  streakSection: {
    marginBottom: 24,
  },
  streakCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  streakTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  streakContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 16,
  },
  streakItem: {
    alignItems: 'center',
  },
  streakValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 4,
  },
  streakLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  streakDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e5e7eb',
  },
  streakFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  streakFooterText: {
    fontSize: 14,
    color: '#6b7280',
  },
  streakBadge: {
    fontSize: 16,
  },
  actionsSection: {
    marginBottom: 24,
  },
  actionButtons: {
    paddingHorizontal: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryAction: {
    backgroundColor: '#3b82f6',
  },
  secondaryAction: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionButtonIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

// Override text color for secondary action
StyleSheet.create({
  secondaryAction: {
    ...styles.secondaryAction,
  },
});

export default HomeScreen;