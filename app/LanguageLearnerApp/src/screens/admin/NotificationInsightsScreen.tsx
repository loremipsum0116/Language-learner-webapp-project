import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Dimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {LineChart, BarChart, PieChart} from 'react-native-chart-kit';
import AdminNotificationAnalytics, {
  UserEngagementInsight,
  NotificationCampaignStats,
  PlatformPerformance,
} from '../../services/AdminNotificationAnalytics';
import {NotificationType} from '../../types/notifications';

const screenWidth = Dimensions.get('window').width;

export const NotificationInsightsScreen: React.FC = () => {
  const [insights, setInsights] = useState<UserEngagementInsight[]>([]);
  const [campaigns, setCampaigns] = useState<NotificationCampaignStats[]>([]);
  const [platformData, setPlatformData] = useState<PlatformPerformance[]>([]);
  const [topPerforming, setTopPerforming] = useState<any[]>([]);
  const [actionableInsights, setActionableInsights] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [quietHoursImpact, setQuietHoursImpact] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    try {
      await AdminNotificationAnalytics.initialize();
      
      const [
        userInsights,
        campaignStats,
        platforms,
        topNotifications,
        insights,
        trendData,
        quietImpact,
      ] = await Promise.all([
        AdminNotificationAnalytics.getUserEngagementInsights(),
        AdminNotificationAnalytics.getCampaignStats(),
        AdminNotificationAnalytics.getPlatformPerformance(),
        AdminNotificationAnalytics.getTopPerformingNotifications(),
        AdminNotificationAnalytics.getActionableInsights(),
        AdminNotificationAnalytics.getNotificationTrends(30),
        AdminNotificationAnalytics.getQuietHoursImpact(),
      ]);

      setInsights(userInsights);
      setCampaigns(campaignStats);
      setPlatformData(platforms);
      setTopPerforming(topNotifications);
      setActionableInsights(insights);
      setTrends(trendData);
      setQuietHoursImpact(quietImpact);
    } catch (error) {
      console.error('Failed to load insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEngagementColor = (segment: string): string => {
    switch (segment) {
      case 'highly_engaged': return '#10b981';
      case 'moderately_engaged': return '#3b82f6';
      case 'low_engaged': return '#f59e0b';
      case 'inactive': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getInsightIcon = (type: string): string => {
    switch (type) {
      case 'opportunity': return '💡';
      case 'warning': return '⚠️';
      case 'critical': return '🚨';
      default: return 'ℹ️';
    }
  };

  const getImpactColor = (impact: string): string => {
    switch (impact) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getCampaignStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return '#10b981';
      case 'completed': return '#3b82f6';
      case 'paused': return '#f59e0b';
      case 'failed': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
    labelColor: () => '#374151',
    style: {
      borderRadius: 16,
    },
    propsForLabels: {
      fontSize: 10,
    },
  };

  const getPlatformChartData = () => {
    return {
      labels: platformData.map(p => p.platform.toUpperCase()),
      datasets: [
        {
          data: platformData.map(p => p.engagementRate),
          color: () => '#3b82f6',
          strokeWidth: 2,
        },
      ],
    };
  };

  const getTrendChartData = () => {
    const last7Days = trends.slice(-7);
    return {
      labels: last7Days.map(t => new Date(t.date).toLocaleDateString('ko-KR', {
        month: 'numeric',
        day: 'numeric'
      })),
      datasets: [
        {
          data: last7Days.map(t => t.engaged),
          color: () => '#10b981',
          strokeWidth: 2,
        },
        {
          data: last7Days.map(t => t.opened),
          color: () => '#3b82f6',
          strokeWidth: 2,
        },
      ],
      legend: ['참여', '열람'],
    };
  };

  const renderInsightCard = ({item}: {item: UserEngagementInsight}) => (
    <View style={[styles.insightCard, {borderLeftColor: getEngagementColor(item.segment)}]}>
      <View style={styles.insightHeader}>
        <Text style={styles.insightTitle}>
          {item.segment === 'highly_engaged' ? '🔥 고참여 사용자' :
           item.segment === 'moderately_engaged' ? '👍 보통 참여 사용자' :
           item.segment === 'low_engaged' ? '😐 저참여 사용자' : '💤 비활성 사용자'}
        </Text>
        <Text style={styles.insightPercentage}>{item.percentage.toFixed(1)}%</Text>
      </View>
      <View style={styles.insightStats}>
        <Text style={styles.insightCount}>{item.count.toLocaleString()}명</Text>
        <Text style={styles.insightEngagement}>
          평균 참여율: {item.averageEngagement.toFixed(1)}%
        </Text>
        <Text style={styles.insightTime}>선호 시간: {item.preferredTime}</Text>
      </View>
      <View style={styles.insightCharacteristics}>
        {item.characteristics.slice(0, 2).map((char, index) => (
          <View key={index} style={styles.characteristicTag}>
            <Text style={styles.characteristicText}>{char}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderCampaignCard = ({item}: {item: NotificationCampaignStats}) => (
    <View style={styles.campaignCard}>
      <View style={styles.campaignHeader}>
        <Text style={styles.campaignName}>{item.name}</Text>
        <View style={[styles.campaignStatus, {backgroundColor: getCampaignStatusColor(item.status)}]}>
          <Text style={styles.campaignStatusText}>
            {item.status === 'active' ? '활성' :
             item.status === 'completed' ? '완료' :
             item.status === 'paused' ? '일시정지' : '실패'}
          </Text>
        </View>
      </View>
      <View style={styles.campaignStats}>
        <View style={styles.campaignStat}>
          <Text style={styles.campaignStatValue}>{item.sentCount.toLocaleString()}</Text>
          <Text style={styles.campaignStatLabel}>발송</Text>
        </View>
        <View style={styles.campaignStat}>
          <Text style={styles.campaignStatValue}>{item.openedCount.toLocaleString()}</Text>
          <Text style={styles.campaignStatLabel}>열람</Text>
        </View>
        <View style={styles.campaignStat}>
          <Text style={styles.campaignStatValue}>{item.engagementRate.toFixed(1)}%</Text>
          <Text style={styles.campaignStatLabel}>참여율</Text>
        </View>
      </View>
    </View>
  );

  const renderActionableInsight = ({item}: {item: any}) => (
    <View style={styles.actionCard}>
      <View style={styles.actionHeader}>
        <Text style={styles.actionIcon}>{getInsightIcon(item.type)}</Text>
        <View style={styles.actionInfo}>
          <Text style={styles.actionTitle}>{item.title}</Text>
          <View style={[styles.actionImpact, {backgroundColor: getImpactColor(item.impact)}]}>
            <Text style={styles.actionImpactText}>
              {item.impact === 'high' ? '높음' :
               item.impact === 'medium' ? '보통' : '낮음'}
            </Text>
          </View>
        </View>
      </View>
      <Text style={styles.actionDescription}>{item.description}</Text>
      <Text style={styles.actionRecommendation}>💡 {item.action}</Text>
      <Text style={styles.actionImprovement}>📈 {item.expectedImprovement}</Text>
    </View>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#f8fafc',
    },
    header: {
      padding: 20,
      backgroundColor: 'white',
      borderBottomWidth: 1,
      borderBottomColor: '#e5e7eb',
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#1f2937',
    },
    headerSubtitle: {
      fontSize: 14,
      color: '#6b7280',
      marginTop: 4,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#1f2937',
      marginBottom: 16,
      paddingHorizontal: 16,
    },
    chartContainer: {
      backgroundColor: 'white',
      marginHorizontal: 16,
      borderRadius: 12,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
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
    insightCard: {
      backgroundColor: 'white',
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 12,
      padding: 16,
      borderLeftWidth: 4,
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    insightHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    insightTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#1f2937',
      flex: 1,
    },
    insightPercentage: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#3b82f6',
    },
    insightStats: {
      marginBottom: 12,
    },
    insightCount: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#1f2937',
    },
    insightEngagement: {
      fontSize: 12,
      color: '#6b7280',
      marginTop: 2,
    },
    insightTime: {
      fontSize: 12,
      color: '#6b7280',
      marginTop: 1,
    },
    insightCharacteristics: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    characteristicTag: {
      backgroundColor: '#f3f4f6',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    characteristicText: {
      fontSize: 10,
      color: '#374151',
    },
    campaignCard: {
      backgroundColor: 'white',
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 12,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    campaignHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    campaignName: {
      fontSize: 16,
      fontWeight: '600',
      color: '#1f2937',
      flex: 1,
    },
    campaignStatus: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    campaignStatusText: {
      fontSize: 10,
      fontWeight: '600',
      color: 'white',
    },
    campaignStats: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    campaignStat: {
      alignItems: 'center',
    },
    campaignStatValue: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#1f2937',
    },
    campaignStatLabel: {
      fontSize: 10,
      color: '#6b7280',
      marginTop: 2,
    },
    platformCard: {
      backgroundColor: 'white',
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 12,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    platformRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    platformName: {
      fontSize: 16,
      fontWeight: '600',
      color: '#1f2937',
    },
    platformMetric: {
      fontSize: 14,
      color: '#6b7280',
    },
    actionCard: {
      backgroundColor: 'white',
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 12,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    actionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    actionIcon: {
      fontSize: 24,
      marginRight: 12,
    },
    actionInfo: {
      flex: 1,
    },
    actionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#1f2937',
      marginBottom: 4,
    },
    actionImpact: {
      alignSelf: 'flex-start',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
    },
    actionImpactText: {
      fontSize: 10,
      fontWeight: '600',
      color: 'white',
    },
    actionDescription: {
      fontSize: 14,
      color: '#6b7280',
      marginBottom: 8,
      lineHeight: 20,
    },
    actionRecommendation: {
      fontSize: 14,
      color: '#059669',
      marginBottom: 4,
      lineHeight: 18,
    },
    actionImprovement: {
      fontSize: 12,
      color: '#3b82f6',
      fontWeight: '500',
    },
    loadingText: {
      textAlign: 'center',
      fontSize: 16,
      color: '#6b7280',
      marginVertical: 40,
    },
    quietHoursCard: {
      backgroundColor: 'white',
      marginHorizontal: 16,
      borderRadius: 12,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    quietHoursStats: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
    },
    quietHoursStat: {
      alignItems: 'center',
      minWidth: '23%',
      marginBottom: 8,
    },
    quietHoursStatValue: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#1f2937',
    },
    quietHoursStatLabel: {
      fontSize: 10,
      color: '#6b7280',
      textAlign: 'center',
      marginTop: 2,
    },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>알림 인사이트</Text>
          <Text style={styles.headerSubtitle}>심층 분석 및 최적화 권장사항</Text>
        </View>
        <Text style={styles.loadingText}>인사이트를 불러오는 중...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🧠 알림 인사이트</Text>
          <Text style={styles.headerSubtitle}>심층 분석 및 최적화 권장사항</Text>
        </View>

        {/* Trends Chart */}
        {trends.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📈 30일 참여 트렌드</Text>
            <View style={styles.chartContainer}>
              <LineChart
                data={getTrendChartData()}
                width={screenWidth - 64}
                height={200}
                chartConfig={chartConfig}
                bezier
                style={{borderRadius: 16}}
              />
            </View>
          </View>
        )}

        {/* Platform Performance */}
        {platformData.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📱 플랫폼별 성과</Text>
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>플랫폼별 참여율</Text>
              <BarChart
                data={getPlatformChartData()}
                width={screenWidth - 64}
                height={200}
                chartConfig={chartConfig}
                style={{borderRadius: 16}}
                showBarTops={false}
                fromZero
              />
            </View>
            {platformData.map(platform => (
              <View key={platform.platform} style={styles.platformCard}>
                <View style={styles.platformRow}>
                  <Text style={styles.platformName}>
                    {platform.platform === 'ios' ? '📱 iOS' : '🤖 Android'}
                  </Text>
                  <Text style={styles.platformMetric}>
                    {platform.totalUsers.toLocaleString()}명
                  </Text>
                </View>
                <View style={styles.platformRow}>
                  <Text style={styles.platformMetric}>전송률</Text>
                  <Text style={styles.platformMetric}>{platform.deliveryRate.toFixed(1)}%</Text>
                </View>
                <View style={styles.platformRow}>
                  <Text style={styles.platformMetric}>참여율</Text>
                  <Text style={styles.platformMetric}>{platform.engagementRate.toFixed(1)}%</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* User Segments */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👥 사용자 세그먼트 분석</Text>
          <FlatList
            data={insights}
            renderItem={renderInsightCard}
            keyExtractor={item => item.segment}
            scrollEnabled={false}
          />
        </View>

        {/* Campaign Performance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 캠페인 성과</Text>
          <FlatList
            data={campaigns}
            renderItem={renderCampaignCard}
            keyExtractor={item => item.id}
            scrollEnabled={false}
          />
        </View>

        {/* Quiet Hours Impact */}
        {quietHoursImpact && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔕 조용한 시간 영향</Text>
            <View style={styles.quietHoursCard}>
              <View style={styles.quietHoursStats}>
                <View style={styles.quietHoursStat}>
                  <Text style={styles.quietHoursStatValue}>
                    {quietHoursImpact.usersWithQuietHours.toLocaleString()}
                  </Text>
                  <Text style={styles.quietHoursStatLabel}>조용한 시간 사용자</Text>
                </View>
                <View style={styles.quietHoursStat}>
                  <Text style={styles.quietHoursStatValue}>
                    {quietHoursImpact.averageQuietDuration.toFixed(1)}h
                  </Text>
                  <Text style={styles.quietHoursStatLabel}>평균 조용한 시간</Text>
                </View>
                <View style={styles.quietHoursStat}>
                  <Text style={styles.quietHoursStatValue}>
                    {quietHoursImpact.blockedNotifications.toLocaleString()}
                  </Text>
                  <Text style={styles.quietHoursStatLabel}>차단된 알림</Text>
                </View>
                <View style={styles.quietHoursStat}>
                  <Text style={styles.quietHoursStatValue}>
                    {quietHoursImpact.delayedNotifications.toLocaleString()}
                  </Text>
                  <Text style={styles.quietHoursStatLabel}>지연된 알림</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Actionable Insights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 실행 가능한 인사이트</Text>
          <FlatList
            data={actionableInsights}
            renderItem={renderActionableInsight}
            keyExtractor={item => item.title}
            scrollEnabled={false}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default NotificationInsightsScreen;