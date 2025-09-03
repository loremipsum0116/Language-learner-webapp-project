// src/components/offline/OfflineStatsDisplay.tsx
// 오프라인 학습 통계 표시 컴포넌트

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { useThemedStyles, useColors } from '../../context/ThemeContext';
import { Theme } from '../../theme';
import { offlineStatsService, OfflineStatsSnapshot, LearningPattern, OfflineAchievement } from '../../services/OfflineStatsService';

interface OfflineStatsDisplayProps {
  period?: 'daily' | 'weekly' | 'monthly';
  showAchievements?: boolean;
  showPatterns?: boolean;
  compact?: boolean;
}

const OfflineStatsDisplay: React.FC<OfflineStatsDisplayProps> = ({
  period = 'weekly',
  showAchievements = true,
  showPatterns = true,
  compact = false,
}) => {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const [statsSnapshot, setStatsSnapshot] = useState<OfflineStatsSnapshot | null>(null);
  const [patterns, setPatterns] = useState<LearningPattern[]>([]);
  const [achievements, setAchievements] = useState<OfflineAchievement[]>([]);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'performance' | 'progress'>('overview');
  const [isLoading, setIsLoading] = useState(true);

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 40;

  useEffect(() => {
    loadStats();
  }, [period]);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      
      const endDate = new Date().toISOString();
      const startDate = new Date();
      
      switch (period) {
        case 'daily':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case 'weekly':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'monthly':
          startDate.setDate(startDate.getDate() - 30);
          break;
      }

      const [snapshot, detectedPatterns, userAchievements] = await Promise.all([
        offlineStatsService.generateSnapshot({
          startDate: startDate.toISOString(),
          endDate,
        }, period),
        showPatterns ? offlineStatsService.detectLearningPatterns() : Promise.resolve([]),
        showAchievements ? offlineStatsService.getUnlockedAchievements() : Promise.resolve([]),
      ]);

      setStatsSnapshot(snapshot);
      setPatterns(detectedPatterns);
      setAchievements(userAchievements);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}초`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}분`;
    return `${Math.floor(seconds / 3600)}시간 ${Math.floor((seconds % 3600) / 60)}분`;
  };

  const formatPercentage = (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const renderOverviewTab = () => {
    if (!statsSnapshot) return null;

    const { learningStats, offlineSpecificStats } = statsSnapshot;

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Key Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, styles.primaryMetric]}>
            <Text style={styles.metricIcon}>📚</Text>
            <Text style={styles.metricValue}>{learningStats.totalSessions}</Text>
            <Text style={styles.metricLabel}>학습 세션</Text>
          </View>

          <View style={[styles.metricCard, styles.secondaryMetric]}>
            <Text style={styles.metricIcon}>⏱️</Text>
            <Text style={styles.metricValue}>{formatTime(learningStats.totalStudyTime)}</Text>
            <Text style={styles.metricLabel}>학습 시간</Text>
          </View>

          <View style={[styles.metricCard, styles.tertiaryMetric]}>
            <Text style={styles.metricIcon}>🎯</Text>
            <Text style={styles.metricValue}>{formatPercentage(learningStats.overallAccuracy)}</Text>
            <Text style={styles.metricLabel}>정확도</Text>
          </View>

          <View style={[styles.metricCard, styles.quaternaryMetric]}>
            <Text style={styles.metricIcon}>🔥</Text>
            <Text style={styles.metricValue}>{learningStats.streakDays}</Text>
            <Text style={styles.metricLabel}>연속 일수</Text>
          </View>
        </View>

        {/* Offline-Specific Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>오프라인 활용</Text>
          <View style={styles.offlineStatsCard}>
            <View style={styles.offlineStatRow}>
              <Text style={styles.offlineStatLabel}>오프라인 시간:</Text>
              <Text style={styles.offlineStatValue}>
                {formatTime(offlineSpecificStats.totalOfflineTime)}
              </Text>
            </View>
            <View style={styles.offlineStatRow}>
              <Text style={styles.offlineStatLabel}>캐시 적중률:</Text>
              <Text style={styles.offlineStatValue}>
                {formatPercentage(offlineSpecificStats.cacheHitRate)}
              </Text>
            </View>
            <View style={styles.offlineStatRow}>
              <Text style={styles.offlineStatLabel}>절약된 데이터:</Text>
              <Text style={styles.offlineStatValue}>
                {(offlineSpecificStats.dataUsageSaved / (1024 * 1024)).toFixed(1)}MB
              </Text>
            </View>
            <View style={styles.offlineStatRow}>
              <Text style={styles.offlineStatLabel}>동기화 대기:</Text>
              <Text style={styles.offlineStatValue}>
                {offlineSpecificStats.syncPendingItems}개 항목
              </Text>
            </View>
          </View>
        </View>

        {/* Study Pattern Visualization */}
        {learningStats.totalSessions > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>학습 패턴</Text>
            <BarChart
              data={{
                labels: ['월', '화', '수', '목', '금', '토', '일'],
                datasets: [{
                  data: [
                    statsSnapshot.performanceStats.weekdayStats.Monday || 0,
                    statsSnapshot.performanceStats.weekdayStats.Tuesday || 0,
                    statsSnapshot.performanceStats.weekdayStats.Wednesday || 0,
                    statsSnapshot.performanceStats.weekdayStats.Thursday || 0,
                    statsSnapshot.performanceStats.weekdayStats.Friday || 0,
                    statsSnapshot.performanceStats.weekdayStats.Saturday || 0,
                    statsSnapshot.performanceStats.weekdayStats.Sunday || 0,
                  ]
                }]
              }}
              width={chartWidth}
              height={180}
              yAxisLabel=""
              yAxisSuffix=""
              chartConfig={{
                backgroundColor: colors.backgroundSecondary,
                backgroundGradientFrom: colors.backgroundSecondary,
                backgroundGradientTo: colors.backgroundSecondary,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(${colors.primary.replace('#', '').match(/.{2}/g)?.map(x => parseInt(x, 16)).join(',')}, ${opacity})`,
                labelColor: (opacity = 1) => colors.text,
                style: { borderRadius: 8 },
                barPercentage: 0.7,
              }}
              style={styles.chart}
            />
          </View>
        )}
      </ScrollView>
    );
  };

  const renderPerformanceTab = () => {
    if (!statsSnapshot) return null;

    const { performanceStats } = statsSnapshot;

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Time of Day Distribution */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>시간대별 학습</Text>
          <PieChart
            data={[
              {
                name: '아침\n(6-12시)',
                count: performanceStats.timeOfDayStats.morning,
                color: colors.success,
                legendFontColor: colors.text,
                legendFontSize: 12,
              },
              {
                name: '오후\n(12-18시)',
                count: performanceStats.timeOfDayStats.afternoon,
                color: colors.primary,
                legendFontColor: colors.text,
                legendFontSize: 12,
              },
              {
                name: '저녁\n(18-24시)',
                count: performanceStats.timeOfDayStats.evening,
                color: colors.warning,
                legendFontColor: colors.text,
                legendFontSize: 12,
              },
              {
                name: '밤\n(0-6시)',
                count: performanceStats.timeOfDayStats.night,
                color: colors.info,
                legendFontColor: colors.text,
                legendFontSize: 12,
              },
            ]}
            width={chartWidth}
            height={200}
            chartConfig={{
              color: (opacity = 1) => colors.text,
            }}
            accessor="count"
            backgroundColor="transparent"
            paddingLeft="15"
            center={[10, 0]}
            style={styles.chart}
          />
        </View>

        {/* Session Type Distribution */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>학습 유형별 분포</Text>
          <View style={styles.sessionTypeGrid}>
            <View style={styles.sessionTypeCard}>
              <Text style={styles.sessionTypeIcon}>🎯</Text>
              <Text style={styles.sessionTypeLabel}>SRS</Text>
              <Text style={styles.sessionTypeValue}>
                {performanceStats.sessionTypeDistribution.srs || 0}
              </Text>
            </View>
            <View style={styles.sessionTypeCard}>
              <Text style={styles.sessionTypeIcon}>🔄</Text>
              <Text style={styles.sessionTypeLabel}>복습</Text>
              <Text style={styles.sessionTypeValue}>
                {performanceStats.sessionTypeDistribution.review || 0}
              </Text>
            </View>
            <View style={styles.sessionTypeCard}>
              <Text style={styles.sessionTypeIcon}>💪</Text>
              <Text style={styles.sessionTypeLabel}>연습</Text>
              <Text style={styles.sessionTypeValue}>
                {performanceStats.sessionTypeDistribution.practice || 0}
              </Text>
            </View>
            <View style={styles.sessionTypeCard}>
              <Text style={styles.sessionTypeIcon}>📖</Text>
              <Text style={styles.sessionTypeLabel}>단어장</Text>
              <Text style={styles.sessionTypeValue}>
                {performanceStats.sessionTypeDistribution.vocabulary_browse || 0}
              </Text>
            </View>
          </View>
        </View>

        {/* Response Time Analysis */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>응답 시간 분석</Text>
          <View style={styles.responseTimeCard}>
            <Text style={styles.responseTimeLabel}>평균 응답 시간</Text>
            <Text style={styles.responseTimeValue}>
              {(performanceStats.averageResponseTime / 1000).toFixed(1)}초
            </Text>
            <Text style={styles.responseTimeDescription}>
              빠른 응답은 좋은 암기 상태를 의미합니다
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderProgressTab = () => {
    if (!statsSnapshot) return null;

    const { progressStats } = statsSnapshot;

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Level Progression */}
        {progressStats.levelProgression.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>레벨 진행</Text>
            <LineChart
              data={{
                labels: progressStats.levelProgression.slice(-7).map(p => 
                  new Date(p.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
                ),
                datasets: [{
                  data: progressStats.levelProgression.slice(-7).map(p => p.level),
                  color: (opacity = 1) => colors.primary,
                  strokeWidth: 3,
                }]
              }}
              width={chartWidth}
              height={180}
              yAxisLabel=""
              yAxisSuffix=""
              chartConfig={{
                backgroundColor: colors.backgroundSecondary,
                backgroundGradientFrom: colors.backgroundSecondary,
                backgroundGradientTo: colors.backgroundSecondary,
                decimalPlaces: 0,
                color: (opacity = 1) => colors.primary,
                labelColor: (opacity = 1) => colors.text,
                style: { borderRadius: 8 },
                propsForDots: {
                  r: '4',
                  strokeWidth: '2',
                  stroke: colors.primary,
                },
              }}
              bezier
              style={styles.chart}
            />
          </View>
        )}

        {/* Skills Progression */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>기술별 진행도</Text>
          <View style={styles.skillsGrid}>
            {Object.entries(progressStats.skillProgression).map(([skill, value]) => (
              <View key={skill} style={styles.skillCard}>
                <Text style={styles.skillName}>
                  {skill === 'vocabulary' ? '어휘' :
                   skill === 'listening' ? '듣기' :
                   skill === 'pronunciation' ? '발음' : '읽기'}
                </Text>
                <View style={styles.skillProgressBar}>
                  <View 
                    style={[
                      styles.skillProgressFill,
                      { 
                        width: `${value}%`,
                        backgroundColor: colors.primary,
                      }
                    ]}
                  />
                </View>
                <Text style={styles.skillValue}>{value}%</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Goals Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>목표 달성</Text>
          <View style={styles.goalsCard}>
            {Object.entries(progressStats.goalsProgress).map(([period, goal]) => (
              <View key={period} style={styles.goalRow}>
                <Text style={styles.goalLabel}>
                  {period === 'daily' ? '일일' :
                   period === 'weekly' ? '주간' : '월간'} 목표
                </Text>
                <View style={styles.goalProgress}>
                  <View style={styles.goalProgressBar}>
                    <View 
                      style={[
                        styles.goalProgressFill,
                        { 
                          width: `${Math.min(goal.percentage, 100)}%`,
                          backgroundColor: goal.percentage >= 100 
                            ? colors.success 
                            : goal.percentage >= 70 
                            ? colors.primary 
                            : colors.warning
                        }
                      ]}
                    />
                  </View>
                  <Text style={styles.goalText}>
                    {goal.achieved}/{goal.target} ({goal.percentage.toFixed(0)}%)
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>통계를 로딩 중...</Text>
      </View>
    );
  }

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        {statsSnapshot && (
          <View style={styles.compactMetrics}>
            <View style={styles.compactMetric}>
              <Text style={styles.compactValue}>{statsSnapshot.learningStats.totalSessions}</Text>
              <Text style={styles.compactLabel}>세션</Text>
            </View>
            <View style={styles.compactMetric}>
              <Text style={styles.compactValue}>
                {formatPercentage(statsSnapshot.learningStats.overallAccuracy)}
              </Text>
              <Text style={styles.compactLabel}>정확도</Text>
            </View>
            <View style={styles.compactMetric}>
              <Text style={styles.compactValue}>{statsSnapshot.learningStats.streakDays}</Text>
              <Text style={styles.compactLabel}>연속</Text>
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'overview' && styles.activeTab]}
          onPress={() => setSelectedTab('overview')}
        >
          <Text style={[styles.tabText, selectedTab === 'overview' && styles.activeTabText]}>
            개요
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'performance' && styles.activeTab]}
          onPress={() => setSelectedTab('performance')}
        >
          <Text style={[styles.tabText, selectedTab === 'performance' && styles.activeTabText]}>
            성과
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'progress' && styles.activeTab]}
          onPress={() => setSelectedTab('progress')}
        >
          <Text style={[styles.tabText, selectedTab === 'progress' && styles.activeTabText]}>
            진행
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={styles.tabContent}>
        {selectedTab === 'overview' && renderOverviewTab()}
        {selectedTab === 'performance' && renderPerformanceTab()}
        {selectedTab === 'progress' && renderProgressTab()}
      </View>

      {/* Achievements Section */}
      {showAchievements && achievements.length > 0 && (
        <View style={styles.achievementsSection}>
          <Text style={styles.sectionTitle}>최근 달성</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {achievements.slice(-3).map((achievement) => (
              <View key={achievement.id} style={styles.achievementCard}>
                <Text style={styles.achievementIcon}>{achievement.icon}</Text>
                <Text style={styles.achievementTitle}>{achievement.title}</Text>
                <Text style={styles.achievementDescription}>
                  {achievement.description}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    ...theme.typography.body1,
    color: theme.colors.textSecondary,
  },
  compactContainer: {
    padding: theme.spacing.md,
  },
  compactMetrics: {
    flexDirection: 'row' as const,
    justifyContent: 'space-around' as const,
  },
  compactMetric: {
    alignItems: 'center' as const,
  },
  compactValue: {
    ...theme.typography.h3,
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeight.bold,
  },
  compactLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  tabContainer: {
    flexDirection: 'row' as const,
    backgroundColor: theme.colors.backgroundSecondary,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    borderRadius: theme.spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center' as const,
    borderRadius: theme.spacing.sm,
  },
  activeTab: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    ...theme.typography.button,
    color: theme.colors.text,
  },
  activeTabText: {
    color: theme.colors.textInverse,
  },
  tabContent: {
    flex: 1,
    padding: theme.spacing.md,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  metricsGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  metricCard: {
    width: '48%',
    padding: theme.spacing.md,
    borderRadius: theme.spacing.sm,
    alignItems: 'center' as const,
    elevation: 2,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  primaryMetric: {
    backgroundColor: theme.colors.primaryLight,
  },
  secondaryMetric: {
    backgroundColor: theme.colors.successLight,
  },
  tertiaryMetric: {
    backgroundColor: theme.colors.infoLight,
  },
  quaternaryMetric: {
    backgroundColor: theme.colors.warningLight,
  },
  metricIcon: {
    fontSize: 24,
    marginBottom: theme.spacing.sm,
  },
  metricValue: {
    ...theme.typography.h2,
    color: theme.colors.text,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.xs,
  },
  metricLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center' as const,
  },
  offlineStatsCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    padding: theme.spacing.md,
    borderRadius: theme.spacing.sm,
  },
  offlineStatRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  offlineStatLabel: {
    ...theme.typography.body2,
    color: theme.colors.textSecondary,
  },
  offlineStatValue: {
    ...theme.typography.body2,
    color: theme.colors.text,
    fontWeight: theme.typography.fontWeight.medium,
  },
  chart: {
    marginVertical: theme.spacing.sm,
    borderRadius: theme.spacing.sm,
  },
  sessionTypeGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
  },
  sessionTypeCard: {
    width: '48%',
    backgroundColor: theme.colors.backgroundSecondary,
    padding: theme.spacing.md,
    borderRadius: theme.spacing.sm,
    alignItems: 'center' as const,
  },
  sessionTypeIcon: {
    fontSize: 20,
    marginBottom: theme.spacing.sm,
  },
  sessionTypeLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  sessionTypeValue: {
    ...theme.typography.h4,
    color: theme.colors.text,
    fontWeight: theme.typography.fontWeight.bold,
  },
  responseTimeCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    padding: theme.spacing.md,
    borderRadius: theme.spacing.sm,
    alignItems: 'center' as const,
  },
  responseTimeLabel: {
    ...theme.typography.subtitle2,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  responseTimeValue: {
    ...theme.typography.h2,
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.sm,
  },
  responseTimeDescription: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center' as const,
  },
  skillsGrid: {
    gap: theme.spacing.sm,
  },
  skillCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    padding: theme.spacing.md,
    borderRadius: theme.spacing.sm,
  },
  skillName: {
    ...theme.typography.subtitle2,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  skillProgressBar: {
    height: 8,
    backgroundColor: theme.colors.border,
    borderRadius: 4,
    marginBottom: theme.spacing.xs,
  },
  skillProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  skillValue: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'right' as const,
  },
  goalsCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    padding: theme.spacing.md,
    borderRadius: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  goalRow: {
    gap: theme.spacing.sm,
  },
  goalLabel: {
    ...theme.typography.subtitle2,
    color: theme.colors.text,
  },
  goalProgress: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  goalProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: theme.colors.border,
    borderRadius: 3,
  },
  goalProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  goalText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    minWidth: 80,
    textAlign: 'right' as const,
  },
  achievementsSection: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  achievementCard: {
    width: 120,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.spacing.sm,
    alignItems: 'center' as const,
    marginRight: theme.spacing.sm,
    elevation: 1,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  achievementIcon: {
    fontSize: 24,
    marginBottom: theme.spacing.sm,
  },
  achievementTitle: {
    ...theme.typography.subtitle2,
    color: theme.colors.text,
    textAlign: 'center' as const,
    marginBottom: theme.spacing.xs,
  },
  achievementDescription: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center' as const,
  },
});

export default OfflineStatsDisplay;