// src/components/offline/OfflineModeDashboard.tsx
// 오프라인 모드 전용 대시보드

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import { useOfflineData } from '../../hooks/useOfflineData';
import useSyncManager from '../../hooks/useSyncManager';
import { useThemedStyles, useColors } from '../../context/ThemeContext';
import { Theme } from '../../theme';
import { offlineService } from '../../services/OfflineService';

interface OfflineModeDashboardProps {
  onNavigateToSettings?: () => void;
  onNavigateToDownload?: () => void;
}

const OfflineModeDashboard: React.FC<OfflineModeDashboardProps> = ({
  onNavigateToSettings,
  onNavigateToDownload,
}) => {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const offlineStatus = useOfflineStatus();
  const { summary, storageConfig, cleanupOfflineData } = useOfflineData();
  const [syncState, syncActions] = useSyncManager();

  const [storageStats, setStorageStats] = useState({
    totalUsed: 0,
    available: 0,
    percentage: 0,
  });

  useEffect(() => {
    loadStorageStats();
  }, [summary]);

  const loadStorageStats = async () => {
    try {
      if (summary) {
        const totalUsed = summary.storageUsed;
        const maxStorage = (storageConfig?.maxAudioFiles || 1000) * 1024 * 1024; // Rough estimate
        const available = Math.max(0, maxStorage - totalUsed);
        const percentage = maxStorage > 0 ? (totalUsed / maxStorage) * 100 : 0;

        setStorageStats({
          totalUsed,
          available,
          percentage,
        });
      }
    } catch (error) {
      console.error('Error loading storage stats:', error);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTimeAgo = (dateString: string): string => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes}분 전`;
    } else if (diffHours < 24) {
      return `${diffHours}시간 전`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}일 전`;
    }
  };

  const handleCleanupStorage = () => {
    Alert.alert(
      '저장소 정리',
      '오래된 데이터를 삭제하여 저장 공간을 확보하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '정리',
          style: 'destructive',
          onPress: async () => {
            try {
              await cleanupOfflineData();
              Alert.alert('완료', '저장소 정리가 완료되었습니다.');
            } catch (error) {
              Alert.alert('오류', '저장소 정리 중 오류가 발생했습니다.');
            }
          }
        }
      ]
    );
  };

  const handleTrySync = () => {
    if (offlineStatus.isOnline) {
      syncActions.performQuickSync();
    } else {
      Alert.alert(
        '인터넷 연결 필요',
        '동기화를 위해서는 인터넷 연결이 필요합니다.'
      );
    }
  };

  if (!offlineStatus.isOffline) {
    return null;
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>📱</Text>
        <View style={styles.headerText}>
          <Text style={styles.title}>오프라인 모드</Text>
          <Text style={styles.subtitle}>
            인터넷 없이도 학습을 계속하세요
          </Text>
        </View>
      </View>

      {/* Status Cards */}
      <View style={styles.statusGrid}>
        {/* Available Content */}
        <View style={[styles.statusCard, styles.contentCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>📚</Text>
            <Text style={styles.cardTitle}>이용 가능한 콘텐츠</Text>
          </View>
          <View style={styles.cardStats}>
            <Text style={styles.statNumber}>
              {summary?.vocabularies.total || 0}
            </Text>
            <Text style={styles.statLabel}>단어</Text>
          </View>
          <View style={styles.cardStats}>
            <Text style={styles.statNumber}>
              {summary?.audioFiles.availableOffline || 0}
            </Text>
            <Text style={styles.statLabel}>음성 파일</Text>
          </View>
        </View>

        {/* Recent Progress */}
        <View style={[styles.statusCard, styles.progressCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>📊</Text>
            <Text style={styles.cardTitle}>오늘의 학습</Text>
          </View>
          <View style={styles.cardStats}>
            <Text style={styles.statNumber}>
              {summary?.studySessions.thisWeek || 0}
            </Text>
            <Text style={styles.statLabel}>세션</Text>
          </View>
          <View style={styles.cardStats}>
            <Text style={styles.statNumber}>
              {Math.round((summary?.studySessions.averageAccuracy || 0) * 100)}%
            </Text>
            <Text style={styles.statLabel}>정확도</Text>
          </View>
        </View>
      </View>

      {/* Storage Management */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>저장소 관리</Text>
        
        <View style={styles.storageCard}>
          <View style={styles.storageHeader}>
            <Text style={styles.storageTitle}>사용 중인 저장 공간</Text>
            <Text style={styles.storagePercentage}>
              {storageStats.percentage.toFixed(1)}%
            </Text>
          </View>
          
          <View style={styles.storageBar}>
            <View 
              style={[
                styles.storageUsed,
                { 
                  width: `${Math.min(storageStats.percentage, 100)}%`,
                  backgroundColor: storageStats.percentage > 90 
                    ? colors.error 
                    : storageStats.percentage > 70 
                    ? colors.warning 
                    : colors.success
                }
              ]}
            />
          </View>
          
          <View style={styles.storageDetails}>
            <Text style={styles.storageText}>
              사용됨: {formatBytes(storageStats.totalUsed)}
            </Text>
            <Text style={styles.storageText}>
              사용 가능: {formatBytes(storageStats.available)}
            </Text>
          </View>

          {storageStats.percentage > 80 && (
            <TouchableOpacity 
              style={styles.cleanupButton}
              onPress={handleCleanupStorage}
            >
              <Text style={styles.cleanupButtonText}>저장소 정리</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Offline Features */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>오프라인 기능</Text>
        
        <View style={styles.featuresGrid}>
          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>🎯</Text>
            <Text style={styles.featureTitle}>SRS 학습</Text>
            <Text style={styles.featureDescription}>
              간격 반복 학습으로 효율적인 암기
            </Text>
          </View>

          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>🔄</Text>
            <Text style={styles.featureTitle}>복습 퀴즈</Text>
            <Text style={styles.featureDescription}>
              학습한 단어들을 다시 확인
            </Text>
          </View>

          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>📈</Text>
            <Text style={styles.featureTitle}>진도 추적</Text>
            <Text style={styles.featureDescription}>
              학습 통계 및 진행률 확인
            </Text>
          </View>

          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>🎵</Text>
            <Text style={styles.featureTitle}>음성 학습</Text>
            <Text style={styles.featureDescription}>
              캐시된 음성으로 발음 연습
            </Text>
          </View>
        </View>
      </View>

      {/* Sync Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>동기화 상태</Text>
        
        <View style={styles.syncCard}>
          <View style={styles.syncHeader}>
            <Text style={styles.syncIcon}>
              {syncState.healthMetrics.lastSuccessfulSync ? '✓' : '⏳'}
            </Text>
            <View style={styles.syncInfo}>
              <Text style={styles.syncTitle}>
                {syncState.healthMetrics.lastSuccessfulSync 
                  ? '마지막 동기화' 
                  : '동기화 대기 중'}
              </Text>
              <Text style={styles.syncSubtitle}>
                {syncState.healthMetrics.lastSuccessfulSync 
                  ? formatTimeAgo(syncState.healthMetrics.lastSuccessfulSync)
                  : '인터넷 연결 시 자동 동기화'}
              </Text>
            </View>
          </View>

          {syncState.healthMetrics.queueSize > 0 && (
            <View style={styles.pendingChanges}>
              <Text style={styles.pendingText}>
                {syncState.healthMetrics.queueSize}개 항목이 동기화를 기다리고 있습니다
              </Text>
            </View>
          )}

          <TouchableOpacity 
            style={[
              styles.syncButton,
              !offlineStatus.isOnline && styles.syncButtonDisabled
            ]}
            onPress={handleTrySync}
            disabled={!offlineStatus.isOnline}
          >
            <Text style={[
              styles.syncButtonText,
              !offlineStatus.isOnline && styles.syncButtonTextDisabled
            ]}>
              {offlineStatus.isOnline ? '지금 동기화' : '인터넷 연결 필요'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>빠른 작업</Text>
        
        <View style={styles.actionsGrid}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={onNavigateToDownload}
          >
            <Text style={styles.actionIcon}>⬇️</Text>
            <Text style={styles.actionText}>콘텐츠 다운로드</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={onNavigateToSettings}
          >
            <Text style={styles.actionIcon}>⚙️</Text>
            <Text style={styles.actionText}>오프라인 설정</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const createStyles = (theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    borderBottomLeftRadius: theme.spacing.lg,
    borderBottomRightRadius: theme.spacing.lg,
  },
  headerIcon: {
    fontSize: 32,
    marginRight: theme.spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...theme.typography.h2,
    color: theme.colors.textInverse,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    ...theme.typography.body1,
    color: theme.colors.textInverse,
    opacity: 0.9,
  },
  statusGrid: {
    flexDirection: 'row' as const,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  statusCard: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.spacing.sm,
    elevation: 2,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  contentCard: {
    backgroundColor: theme.colors.successLight,
  },
  progressCard: {
    backgroundColor: theme.colors.infoLight,
  },
  cardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: theme.spacing.sm,
  },
  cardIcon: {
    fontSize: 16,
    marginRight: theme.spacing.xs,
  },
  cardTitle: {
    ...theme.typography.subtitle2,
    color: theme.colors.text,
  },
  cardStats: {
    marginVertical: theme.spacing.xs,
  },
  statNumber: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontWeight: theme.typography.fontWeight.bold,
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  section: {
    padding: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  storageCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    padding: theme.spacing.md,
    borderRadius: theme.spacing.sm,
  },
  storageHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: theme.spacing.sm,
  },
  storageTitle: {
    ...theme.typography.subtitle1,
    color: theme.colors.text,
  },
  storagePercentage: {
    ...theme.typography.h4,
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeight.bold,
  },
  storageBar: {
    height: 8,
    backgroundColor: theme.colors.border,
    borderRadius: 4,
    marginVertical: theme.spacing.sm,
  },
  storageUsed: {
    height: '100%',
    borderRadius: 4,
  },
  storageDetails: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
  },
  storageText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  cleanupButton: {
    backgroundColor: theme.colors.warning,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.spacing.xs,
    marginTop: theme.spacing.sm,
    alignItems: 'center' as const,
  },
  cleanupButtonText: {
    ...theme.typography.button,
    color: theme.colors.textInverse,
  },
  featuresGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
  },
  featureCard: {
    width: '48%',
    backgroundColor: theme.colors.backgroundSecondary,
    padding: theme.spacing.md,
    borderRadius: theme.spacing.sm,
    alignItems: 'center' as const,
  },
  featureIcon: {
    fontSize: 24,
    marginBottom: theme.spacing.sm,
  },
  featureTitle: {
    ...theme.typography.subtitle2,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    textAlign: 'center' as const,
  },
  featureDescription: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center' as const,
  },
  syncCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    padding: theme.spacing.md,
    borderRadius: theme.spacing.sm,
  },
  syncHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  syncIcon: {
    fontSize: 20,
    marginRight: theme.spacing.sm,
  },
  syncInfo: {
    flex: 1,
  },
  syncTitle: {
    ...theme.typography.subtitle1,
    color: theme.colors.text,
  },
  syncSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  pendingChanges: {
    backgroundColor: theme.colors.warningLight,
    padding: theme.spacing.sm,
    borderRadius: theme.spacing.xs,
    marginVertical: theme.spacing.sm,
  },
  pendingText: {
    ...theme.typography.caption,
    color: theme.colors.text,
    textAlign: 'center' as const,
  },
  syncButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.spacing.xs,
    alignItems: 'center' as const,
    marginTop: theme.spacing.sm,
  },
  syncButtonDisabled: {
    backgroundColor: theme.colors.border,
  },
  syncButtonText: {
    ...theme.typography.button,
    color: theme.colors.textInverse,
  },
  syncButtonTextDisabled: {
    color: theme.colors.textSecondary,
  },
  actionsGrid: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
  },
  actionButton: {
    flex: 1,
    backgroundColor: theme.colors.backgroundSecondary,
    padding: theme.spacing.md,
    borderRadius: theme.spacing.sm,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: theme.spacing.sm,
  },
  actionText: {
    ...theme.typography.subtitle2,
    color: theme.colors.text,
    textAlign: 'center' as const,
  },
});

export default OfflineModeDashboard;