// src/screens/main/HomeScreen.tsx
// 홈 대시보드 화면 (React Native 버전)

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../hooks/useAuth';
import { AlertBanner, LoadingSpinner } from '../../components/common';
import { FadeInView, SlideInView } from '../../components/animations';
import RainbowStar from '../../components/RainbowStar';
import { MainTabsParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<MainTabsParamList, 'Home'>;

interface DashboardStats {
  srsQueue: number;
  odatNote: number;
  masteredWords: number;
}

interface AlarmInfo {
  totalDue: number;
  nextAlarmAtKst: string | null;
}

interface SrsStatus {
  shouldShowAlarm: boolean;
  overdueCount: number;
  alarmInfo?: {
    currentPeriod: string;
    nextAlarmAtKst: string;
    minutesToNextAlarm: number;
    periodProgress: number;
  };
}

interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  dailyQuizCount: number;
  todayStudied: boolean;
}

interface StatCardProps {
  title: string;
  value: number;
  icon: string;
  loading: boolean;
  onPress?: () => void;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon, 
  loading, 
  onPress,
  color = '#3b82f6'
}) => (
  <TouchableOpacity
    style={[styles.statCard, { borderLeftColor: color }]}
    onPress={onPress}
    activeOpacity={0.7}
    disabled={!onPress}
  >
    <View style={styles.statCardContent}>
      <View style={styles.statIcon}>
        <Text style={styles.statIconText}>{icon}</Text>
      </View>
      <View style={styles.statInfo}>
        <Text style={styles.statTitle}>{title}</Text>
        {loading ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <Text style={[styles.statValue, { color }]}>{value}</Text>
        )}
      </View>
    </View>
  </TouchableOpacity>
);

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  
  const [stats, setStats] = useState<DashboardStats>({
    srsQueue: 0,
    odatNote: 0,
    masteredWords: 0
  });
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alarm, setAlarm] = useState<AlarmInfo>({ totalDue: 0, nextAlarmAtKst: null });
  const [srsStatus, setSrsStatus] = useState<SrsStatus | null>(null);
  const [streakInfo, setStreakInfo] = useState<StreakInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) {
        setLoading(true);
      }
      setError(null);

      // TODO: Replace with actual API calls using React Native networking
      // Simulating API calls for now
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock data - replace with actual API calls
      const mockStats = {
        srsQueue: 15,
        odatNote: 3,
        masteredWords: 127
      };

      const mockAlarm = {
        totalDue: 8,
        nextAlarmAtKst: '2024-01-15 14:30'
      };

      const mockSrsStatus = {
        shouldShowAlarm: true,
        overdueCount: 5,
        alarmInfo: {
          currentPeriod: '4시간',
          nextAlarmAtKst: '2024-01-15 15:00',
          minutesToNextAlarm: 23,
          periodProgress: 75
        }
      };

      const mockStreakInfo = {
        currentStreak: 7,
        longestStreak: 21,
        dailyQuizCount: 12,
        todayStudied: true
      };

      setStats(mockStats);
      setAlarm(mockAlarm);
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