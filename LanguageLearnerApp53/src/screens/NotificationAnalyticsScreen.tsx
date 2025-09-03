import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {LineChart, BarChart, PieChart} from 'react-native-chart-kit';
import {useTheme} from '../context/ThemeContext';
import NotificationAnalyticsService, {
  AnalyticsSummary,
  NotificationEngagementData,
  NotificationTiming,
  NotificationFrequency,
} from '../services/NotificationAnalytics';
import {NotificationType} from '../types/notifications';

const screenWidth = Dimensions.get('window').width;

export const NotificationAnalyticsScreen: React.FC = () => {
  const {colors} = useTheme();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [engagement, setEngagement] = useState<NotificationEngagementData | null>(null);
  const [timingData, setTimingData] = useState<NotificationTiming[]>([]);
  const [frequencyData, setFrequencyData] = useState<NotificationFrequency[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'7' | '30' | '90'>('30');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [selectedPeriod]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      await NotificationAnalyticsService.initialize();
      
      const days = parseInt(selectedPeriod);
      const [summaryData, engagementData, timing, frequency] = await Promise.all([
        NotificationAnalyticsService.getAnalyticsSummary(),
        NotificationAnalyticsService.getEngagementData(undefined, days),
        NotificationAnalyticsService.getTimingAnalysis(days),
        NotificationAnalyticsService.getFrequencyAnalysis(),
      ]);

      setSummary(summaryData);
      setEngagement(engagementData);
      setTimingData(timing);
      setFrequencyData(frequency);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEngagementChartData = () => {
    if (!engagement) return null;

    return {
      labels: ['Sent', 'Opened', 'Action Taken'],
      datasets: [
        {
          data: [engagement.sent, engagement.opened, engagement.actionTaken],
          colors: [
            () => colors.primary,
            () => colors.success,
            () => colors.warning,
          ],
        },
      ],
    };
  };

  const getTimingChartData = () => {
    const sortedTiming = timingData.sort((a, b) => a.hour - b.hour);
    
    return {
      labels: sortedTiming.map(t => `${t.hour}h`),
      datasets: [
        {
          data: sortedTiming.map(t => t.engagementRate),
          color: () => colors.primary,
          strokeWidth: 2,
        },
      ],
    };
  };

  const getFrequencyPieData = () => {
    return frequencyData
      .filter(f => f.weekly > 0)
      .slice(0, 5)
      .map((f, index) => ({
        name: getTypeShortName(f.type),
        count: f.weekly,
        color: getTypeColor(f.type, index),
        legendFontColor: colors.text,
        legendFontSize: 12,
      }));
  };

  const getTypeShortName = (type: NotificationType): string => {
    const shortNames = {
      [NotificationType.LEARNING_REMINDER]: 'Learning',
      [NotificationType.STREAK_REMINDER]: 'Streak',
      [NotificationType.SRS_REVIEW]: 'Reviews',
      [NotificationType.GOAL_ACHIEVED]: 'Goals',
      [NotificationType.MILESTONE_REACHED]: 'Milestones',
      [NotificationType.NEW_CONTENT]: 'Content',
      [NotificationType.WEEKLY_PROGRESS]: 'Progress',
      [NotificationType.OPTIMAL_TIME]: 'Optimal',
      [NotificationType.ENCOURAGEMENT]: 'Encourage',
    };
    return shortNames[type] || type.substring(0, 8);
  };

  const getTypeColor = (type: NotificationType, index: number): string => {
    const typeColors = [
      colors.primary,
      colors.secondary,
      colors.success,
      colors.warning,
      colors.info,
      colors.error,
      '#9C27B0',
      '#607D8B',
      '#795548',
    ];
    return typeColors[index % typeColors.length];
  };

  const getTrendIcon = (trend: string): string => {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      default: return '📊';
    }
  };

  const getEngagementIcon = (rate: number): string => {
    if (rate >= 70) return '🔥';
    if (rate >= 50) return '👍';
    if (rate >= 30) return '👌';
    return '😐';
  };

  const chartConfig = {
    backgroundColor: colors.surface,
    backgroundGradientFrom: colors.surface,
    backgroundGradientTo: colors.surface,
    color: (opacity = 1) => `${colors.primary}${Math.round(opacity * 255).toString(16)}`,
    labelColor: () => colors.text,
    style: {
      borderRadius: 16,
    },
    propsForLabels: {
      fontSize: 10,
    },
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    headerSubtitle: {
      fontSize: 14,
      color: colors.secondaryText,
    },
    periodSelector: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 4,
      marginHorizontal: 20,
      marginVertical: 16,
    },
    periodButton: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: 6,
    },
    periodButtonActive: {
      backgroundColor: colors.primary,
    },
    periodButtonText: {
      fontSize: 14,
      color: colors.text,
    },
    periodButtonTextActive: {
      color: colors.onPrimary,
      fontWeight: '600',
    },
    section: {
      marginVertical: 16,
      paddingHorizontal: 20,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
    },
    sectionIcon: {
      fontSize: 20,
      marginRight: 8,
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -8,
    },
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      margin: 8,
      flex: 1,
      minWidth: '42%',
      borderWidth: 1,
      borderColor: colors.border,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    summaryValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 4,
    },
    summaryLabel: {
      fontSize: 12,
      color: colors.secondaryText,
    },
    summaryTrend: {
      fontSize: 16,
      marginTop: 4,
    },
    chartContainer: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      marginVertical: 8,
      padding: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chartTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    recommendationCard: {
      backgroundColor: colors.info + '10',
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.info + '30',
    },
    recommendationTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    recommendationItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    recommendationBullet: {
      fontSize: 16,
      marginRight: 8,
      marginTop: 2,
    },
    recommendationText: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
      lineHeight: 20,
    },
    engagementRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    engagementLabel: {
      fontSize: 14,
      color: colors.secondaryText,
    },
    engagementValue: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    segmentBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      alignSelf: 'flex-start',
      marginTop: 8,
    },
    segmentText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#fff',
    },
    emptyState: {
      textAlign: 'center',
      fontSize: 16,
      color: colors.secondaryText,
      marginVertical: 40,
    },
    loadingText: {
      textAlign: 'center',
      fontSize: 16,
      color: colors.secondaryText,
      marginVertical: 40,
    },
  });

  const getSegmentColor = (segment: string): string => {
    switch (segment) {
      case 'highly_engaged': return colors.success;
      case 'moderately_engaged': return colors.warning;
      case 'low_engaged': return colors.error;
      default: return colors.primary;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Analytics</Text>
          <Text style={styles.headerSubtitle}>Notification performance insights</Text>
        </View>
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </SafeAreaView>
    );
  }

  if (!summary || !engagement) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Analytics</Text>
          <Text style={styles.headerSubtitle}>Notification performance insights</Text>
        </View>
        <Text style={styles.emptyState}>No analytics data available yet</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Analytics</Text>
          <Text style={styles.headerSubtitle}>
            Notification performance insights
          </Text>
        </View>

        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {['7', '30', '90'].map(period => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodButton,
                selectedPeriod === period && styles.periodButtonActive,
              ]}
              onPress={() => setSelectedPeriod(period as '7' | '30' | '90')}>
              <Text
                style={[
                  styles.periodButtonText,
                  selectedPeriod === period && styles.periodButtonTextActive,
                ]}>
                {period} days
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Text style={styles.sectionIcon}>📊</Text>
            Overview
          </Text>
          
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>
                {summary.totalNotifications}
              </Text>
              <Text style={styles.summaryLabel}>Total Notifications</Text>
            </View>
            
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>
                {getEngagementIcon(summary.overallEngagementRate)}{' '}
                {summary.overallEngagementRate.toFixed(1)}%
              </Text>
              <Text style={styles.summaryLabel}>Engagement Rate</Text>
            </View>
            
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{summary.optimalDeliveryTime}</Text>
              <Text style={styles.summaryLabel}>Optimal Time</Text>
            </View>
            
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>
                {getTrendIcon(summary.weeklyTrend)}
              </Text>
              <Text style={styles.summaryLabel}>Weekly Trend</Text>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Top Category</Text>
            <Text style={styles.summaryValue}>{summary.topPerformingCategory}</Text>
            <View
              style={[
                styles.segmentBadge,
                {backgroundColor: getSegmentColor(summary.userSegment)},
              ]}>
              <Text style={styles.segmentText}>
                {summary.userSegment.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Engagement Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Text style={styles.sectionIcon}>👆</Text>
            Engagement Details
          </Text>
          
          <View style={styles.summaryCard}>
            <View style={styles.engagementRow}>
              <Text style={styles.engagementLabel}>Sent</Text>
              <Text style={styles.engagementValue}>{engagement.sent}</Text>
            </View>
            <View style={styles.engagementRow}>
              <Text style={styles.engagementLabel}>Opened</Text>
              <Text style={styles.engagementValue}>{engagement.opened}</Text>
            </View>
            <View style={styles.engagementRow}>
              <Text style={styles.engagementLabel}>Actions Taken</Text>
              <Text style={styles.engagementValue}>{engagement.actionTaken}</Text>
            </View>
            <View style={styles.engagementRow}>
              <Text style={styles.engagementLabel}>Avg Response Time</Text>
              <Text style={styles.engagementValue}>
                {Math.round(engagement.averageResponseTime / 60)}min
              </Text>
            </View>
          </View>
        </View>

        {/* Charts */}
        {timingData.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Text style={styles.sectionIcon}>⏰</Text>
              Engagement by Hour
            </Text>
            
            <View style={styles.chartContainer}>
              <LineChart
                data={getTimingChartData()}
                width={screenWidth - 56}
                height={200}
                chartConfig={chartConfig}
                bezier
                style={{borderRadius: 16}}
              />
            </View>
          </View>
        )}

        {getFrequencyPieData().length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Text style={styles.sectionIcon}>📈</Text>
              Notification Types
            </Text>
            
            <View style={styles.chartContainer}>
              <PieChart
                data={getFrequencyPieData()}
                width={screenWidth - 56}
                height={200}
                chartConfig={chartConfig}
                accessor="count"
                backgroundColor="transparent"
                paddingLeft="15"
                style={{borderRadius: 16}}
              />
            </View>
          </View>
        )}

        {/* Recommendations */}
        {summary.recommendations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Text style={styles.sectionIcon}>💡</Text>
              Recommendations
            </Text>
            
            <View style={styles.recommendationCard}>
              <Text style={styles.recommendationTitle}>Suggestions</Text>
              {summary.recommendations.map((recommendation, index) => (
                <View key={index} style={styles.recommendationItem}>
                  <Text style={styles.recommendationBullet}>•</Text>
                  <Text style={styles.recommendationText}>{recommendation}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};