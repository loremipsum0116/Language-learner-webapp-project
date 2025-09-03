// src/screens/admin/AdminScreen.tsx
// 관리자 대시보드 화면 (React Native 버전) - 차트 및 테이블뷰 최적화

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
// TODO: Install react-native-chart-kit
// import {
//   LineChart,
//   BarChart,
//   PieChart,
//   ProgressChart,
//   ContributionGraph,
// } from 'react-native-chart-kit';

import { useAuth } from '../../hooks/useAuth';
import { AlertBanner, LoadingSpinner, Button } from '../../components/common';
import { FadeInView, SlideInView } from '../../components/animations';
import { haptics } from '../../utils/haptics';
import { AdminStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminDashboard'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const chartConfig = {
  backgroundColor: '#ffffff',
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
  style: {
    borderRadius: 16,
  },
  propsForDots: {
    r: '6',
    strokeWidth: '2',
    stroke: '#3b82f6',
  },
};

interface DashboardStats {
  userCount: number;
  srsCardCount: number;
  totalSrsCardCount: number;
  wrongAnswerCount: number;
  totalWrongAnswerCount: number;
  overdueCardCount: number;
}

interface TimeMachine {
  dayOffset: number;
  originalTime: string;
  offsetTime: string;
}

interface RecentUser {
  id: number;
  email: string;
  createdAt: string;
}

interface DashboardData {
  stats: DashboardStats;
  timeMachine: TimeMachine;
  recentUsers: RecentUser[];
  chartData?: {
    dailyStats: { date: string; users: number; cards: number }[];
    userGrowth: number[];
    cardDistribution: { name: string; value: number; color: string }[];
  };
}

interface StatCardProps {
  title: string;
  value: number;
  subtitle?: string;
  icon: string;
  color: string;
  onPress?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  subtitle, 
  icon, 
  color, 
  onPress 
}) => (
  <TouchableOpacity
    style={[styles.statCard, { borderLeftColor: color }]}
    onPress={onPress}
    activeOpacity={onPress ? 0.7 : 1}
    disabled={!onPress}
  >
    <View style={styles.statCardContent}>
      <View style={[styles.statIcon, { backgroundColor: `${color}20` }]}>
        <Text style={styles.statIconText}>{icon}</Text>
      </View>
      <View style={styles.statInfo}>
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={[styles.statValue, { color }]}>{value.toLocaleString()}</Text>
        {subtitle && (
          <Text style={styles.statSubtitle}>{subtitle}</Text>
        )}
      </View>
    </View>
  </TouchableOpacity>
);

const AdminScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [timeOffset, setTimeOffset] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Admin permission check
  const isAdmin = user?.email === 'super@root.com';

  const loadDashboard = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) {
        setLoading(true);
      }
      setError(null);

      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock data with chart information
      const mockData: DashboardData = {
        stats: {
          userCount: 1247,
          srsCardCount: 15832,
          totalSrsCardCount: 18950,
          wrongAnswerCount: 3421,
          totalWrongAnswerCount: 5678,
          overdueCardCount: 892,
        },
        timeMachine: {
          dayOffset: 0,
          originalTime: new Date().toISOString(),
          offsetTime: new Date().toISOString(),
        },
        recentUsers: [
          { id: 1, email: 'user1@example.com', createdAt: '2024-01-15T10:30:00Z' },
          { id: 2, email: 'user2@example.com', createdAt: '2024-01-14T15:45:00Z' },
          { id: 3, email: 'user3@example.com', createdAt: '2024-01-13T09:20:00Z' },
          { id: 4, email: 'user4@example.com', createdAt: '2024-01-12T14:10:00Z' },
          { id: 5, email: 'user5@example.com', createdAt: '2024-01-11T11:55:00Z' },
        ],
        chartData: {
          dailyStats: [
            { date: '01/10', users: 120, cards: 1500 },
            { date: '01/11', users: 135, cards: 1620 },
            { date: '01/12', users: 128, cards: 1580 },
            { date: '01/13', users: 145, cards: 1720 },
            { date: '01/14', users: 160, cards: 1850 },
            { date: '01/15', users: 175, cards: 1920 },
          ],
          userGrowth: [120, 135, 128, 145, 160, 175],
          cardDistribution: [
            { name: 'Active Cards', value: 15832, color: '#10b981' },
            { name: 'Overdue Cards', value: 892, color: '#ef4444' },
            { name: 'Wrong Answers', value: 3421, color: '#f59e0b' },
          ],
        },
      };

      setDashboardData(mockData);
      setTimeOffset(mockData.timeMachine.dayOffset);

    } catch (err: any) {
      console.error('Dashboard load error:', err);
      setError(err.message || '관리자 대시보드 로드에 실패했습니다.');
    } finally {
      setLoading(false);
      if (isRefresh) {
        setRefreshing(false);
      }
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboard(true);
  }, [loadDashboard]);

  useEffect(() => {
    if (isAdmin) {
      loadDashboard();
    }
  }, [isAdmin, loadDashboard]);

  const handleTimeOffsetChange = async () => {
    try {
      setIsSubmitting(true);
      await haptics.buttonPress();

      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 500));

      Alert.alert('성공', `시간 오프셋이 ${timeOffset}일로 설정되었습니다.`);
      await loadDashboard();
    } catch (error: any) {
      await haptics.error();
      Alert.alert('오류', `시간 오프셋 설정 실패: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTimeReset = async () => {
    Alert.alert(
      '시간 리셋',
      '시간 오프셋을 리셋하시겠습니까? 모든 SRS 카드 타이머가 재계산됩니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '리셋',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSubmitting(true);
              await haptics.warning();

              // TODO: Replace with actual API call
              await new Promise(resolve => setTimeout(resolve, 500));

              Alert.alert('성공', '시간 오프셋이 리셋되었습니다.');
              setTimeOffset(0);
              await loadDashboard();
            } catch (error: any) {
              await haptics.error();
              Alert.alert('오류', `시간 리셋 실패: ${error.message}`);
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleEmergencyFix = async () => {
    Alert.alert(
      '긴급 수정',
      '모든 overdue 카드를 24시간으로 리셋하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '수정',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSubmitting(true);
              await haptics.warning();

              // TODO: Replace with actual API call
              await new Promise(resolve => setTimeout(resolve, 1000));

              await haptics.success();
              Alert.alert('완료', '모든 overdue 카드가 24시간으로 리셋되었습니다.');
              await loadDashboard();
            } catch (error: any) {
              await haptics.error();
              Alert.alert('오류', `긴급 수정 실패: ${error.message}`);
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleCleanupData = async (type: string, label: string) => {
    Alert.alert(
      '데이터 정리',
      `${label} 데이터를 정리하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '정리',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSubmitting(true);
              await haptics.buttonPress();

              // TODO: Replace with actual API call
              await new Promise(resolve => setTimeout(resolve, 800));

              await haptics.success();
              Alert.alert('완료', `${label} 데이터가 정리되었습니다.`);
              await loadDashboard();
            } catch (error: any) {
              await haptics.error();
              Alert.alert('오류', `데이터 정리 실패: ${error.message}`);
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  // Render user item for FlatList
  const renderUserItem = ({ item }: { item: RecentUser }) => (
    <View style={styles.userItem}>
      <View style={styles.userInfo}>
        <Text style={styles.userId}>#{item.id}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
      </View>
      <Text style={styles.userDate}>
        {new Date(item.createdAt).toLocaleDateString('ko-KR')}
      </Text>
    </View>
  );

  // Mock Chart Component (replace with actual charts when react-native-chart-kit is installed)
  const MockChart = ({ title, data }: { title: string; data: any }) => (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>{title}</Text>
      <View style={styles.chartPlaceholder}>
        <Text style={styles.chartPlaceholderText}>
          📊 {title} 차트{'\n'}(react-native-chart-kit 설치 후 활성화)
        </Text>
        {/* TODO: Replace with actual chart when library is installed */}
        {/* <LineChart
          data={{
            labels: data?.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            datasets: [{ data: data?.values || [20, 45, 28, 80, 99, 43] }],
          }}
          width={SCREEN_WIDTH - 32}
          height={200}
          chartConfig={chartConfig}
          style={styles.chart}
        /> */}
      </View>
    </View>
  );

  // Permission check
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <FadeInView style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedTitle}>🔒 접근 권한 없음</Text>
          <Text style={styles.accessDeniedText}>
            이 페이지는 운영자(super@root.com)만 접근할 수 있습니다.
          </Text>
          <Button
            title="돌아가기"
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          />
        </FadeInView>
      </SafeAreaView>
    );
  }

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" />
          <Text style={styles.loadingText}>대시보드를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
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
          <Button
            title="다시 시도"
            onPress={() => loadDashboard()}
            style={styles.retryButton}
          />
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
        <FadeInView style={styles.content}>
          {/* Header */}
          <SlideInView direction="down" style={styles.header}>
            <Text style={styles.headerTitle}>🛠️ 관리자 대시보드</Text>
          </SlideInView>

          {/* Statistics Cards */}
          <SlideInView direction="up" delay={100} style={styles.statsSection}>
            <Text style={styles.sectionTitle}>시스템 통계</Text>
            <View style={styles.statsGrid}>
              <StatCard
                title="사용자"
                value={dashboardData?.stats.userCount || 0}
                icon="👥"
                color="#3b82f6"
              />
              <StatCard
                title="SRS 카드"
                value={dashboardData?.stats.srsCardCount || 0}
                subtitle={`전체: ${dashboardData?.stats.totalSrsCardCount || 0}`}
                icon="📚"
                color="#10b981"
              />
              <StatCard
                title="오답노트"
                value={dashboardData?.stats.wrongAnswerCount || 0}
                subtitle={`전체: ${dashboardData?.stats.totalWrongAnswerCount || 0}`}
                icon="❌"
                color="#f59e0b"
              />
              <StatCard
                title="Overdue"
                value={dashboardData?.stats.overdueCardCount || 0}
                icon="⚠️"
                color="#ef4444"
              />
            </View>
          </SlideInView>

          {/* Charts Section */}
          <SlideInView direction="up" delay={200} style={styles.chartSection}>
            <Text style={styles.sectionTitle}>통계 차트</Text>
            <MockChart
              title="일일 사용자 활동"
              data={{
                labels: dashboardData?.chartData?.dailyStats.map(d => d.date),
                values: dashboardData?.chartData?.userGrowth,
              }}
            />
          </SlideInView>

          {/* Time Machine Controller */}
          <SlideInView direction="up" delay={300} style={styles.timeMachineSection}>
            <Text style={styles.sectionTitle}>⏰ 시간 가속 컨트롤러</Text>
            <View style={styles.timeMachineCard}>
              <View style={styles.timeMachineInput}>
                <Text style={styles.inputLabel}>시간 오프셋 (일)</Text>
                <TextInput
                  style={styles.textInput}
                  value={timeOffset.toString()}
                  onChangeText={(text) => setTimeOffset(parseInt(text) || 0)}
                  keyboardType="numeric"
                  editable={!isSubmitting}
                />
                <Text style={styles.timeInfo}>
                  현재: {new Date(dashboardData?.timeMachine.originalTime || '').toLocaleString()}
                  {'\n'}
                  오프셋: {new Date(dashboardData?.timeMachine.offsetTime || '').toLocaleString()}
                </Text>
              </View>
              <View style={styles.timeMachineButtons}>
                <Button
                  title="시간 설정"
                  onPress={handleTimeOffsetChange}
                  disabled={isSubmitting}
                  variant="primary"
                  style={styles.timeMachineButton}
                />
                <Button
                  title="리셋"
                  onPress={handleTimeReset}
                  disabled={isSubmitting}
                  variant="secondary"
                  style={styles.timeMachineButton}
                />
                <Button
                  title="긴급 수정"
                  onPress={handleEmergencyFix}
                  disabled={isSubmitting}
                  variant="warning"
                  style={styles.timeMachineButton}
                />
              </View>
            </View>
          </SlideInView>

          {/* Data Management */}
          <SlideInView direction="up" delay={400} style={styles.dataManagementSection}>
            <Text style={styles.sectionTitle}>🗂️ 데이터 관리</Text>
            <View style={styles.managementButtons}>
              <Button
                title="고아 오답노트 정리"
                onPress={() => handleCleanupData('orphaned_wrong_answers', '고아 오답노트')}
                disabled={isSubmitting}
                variant="danger"
                style={styles.managementButton}
              />
              <Button
                title="오래된 세션 정리"
                onPress={() => handleCleanupData('old_sessions', '오래된 세션')}
                disabled={isSubmitting}
                variant="secondary"
                style={styles.managementButton}
              />
            </View>
          </SlideInView>

          {/* Recent Users */}
          <SlideInView direction="up" delay={500} style={styles.recentUsersSection}>
            <Text style={styles.sectionTitle}>👥 최근 등록 사용자</Text>
            <View style={styles.recentUsersCard}>
              {dashboardData?.recentUsers?.length ? (
                <FlatList
                  data={dashboardData.recentUsers}
                  renderItem={renderUserItem}
                  keyExtractor={(item) => item.id.toString()}
                  scrollEnabled={false}
                  showsVerticalScrollIndicator={false}
                />
              ) : (
                <Text style={styles.noDataText}>최근 등록된 사용자가 없습니다.</Text>
              )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  retryButton: {
    marginTop: 16,
    alignSelf: 'center',
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  accessDeniedText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  backButton: {
    minWidth: 120,
  },
  header: {
    padding: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
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
    fontSize: 24,
    fontWeight: 'bold',
  },
  statSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  chartSection: {
    marginBottom: 24,
  },
  chartContainer: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  chartPlaceholder: {
    height: 200,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartPlaceholderText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  chart: {
    borderRadius: 8,
  },
  timeMachineSection: {
    marginBottom: 24,
  },
  timeMachineCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timeMachineInput: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: 'white',
    marginBottom: 8,
  },
  timeInfo: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  timeMachineButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  timeMachineButton: {
    flex: 1,
    minWidth: 100,
  },
  dataManagementSection: {
    marginBottom: 24,
  },
  managementButtons: {
    paddingHorizontal: 16,
    gap: 12,
  },
  managementButton: {
    marginBottom: 8,
  },
  recentUsersSection: {
    marginBottom: 24,
  },
  recentUsersCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  userInfo: {
    flex: 1,
  },
  userId: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  userDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  noDataText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 14,
    paddingVertical: 20,
  },
});

export default AdminScreen;