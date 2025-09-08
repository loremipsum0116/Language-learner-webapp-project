// src/components/offline/AudioCacheManager.tsx
// 오디오 캐시 관리 컴포넌트

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { useThemedStyles, useColors } from '../../context/ThemeContext';
import { Theme } from '../../theme';
import { audioCacheService, AudioCacheStats, AudioCacheConfig } from '../../services/AudioCacheService';
import { audioFileModel } from '../../database/models/AudioFileModel';

interface AudioCacheManagerProps {
  visible: boolean;
  onClose: () => void;
  onCacheUpdated?: () => void;
}

const AudioCacheManager: React.FC<AudioCacheManagerProps> = ({
  visible,
  onClose,
  onCacheUpdated,
}) => {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  
  const [stats, setStats] = useState<AudioCacheStats | null>(null);
  const [config, setConfig] = useState<AudioCacheConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{
    isDownloading: boolean;
    completed: number;
    total: number;
    currentFile: string;
  }>({
    isDownloading: false,
    completed: 0,
    total: 0,
    currentFile: '',
  });

  useEffect(() => {
    if (visible) {
      loadCacheData();
    }
  }, [visible]);

  const loadCacheData = async () => {
    try {
      setIsLoading(true);
      const [cacheStats, cacheConfig] = await Promise.all([
        audioCacheService.getCacheStats(),
        Promise.resolve(audioCacheService.getConfig()),
      ]);
      
      setStats(cacheStats);
      setConfig(cacheConfig);
    } catch (error) {
      console.error('Error loading cache data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getCacheUsagePercentage = (): number => {
    if (!stats || !config) return 0;
    return (stats.totalSize / config.maxCacheSize) * 100;
  };

  const getCacheUsageColor = (): string => {
    const percentage = getCacheUsagePercentage();
    if (percentage > 90) return colors.error;
    if (percentage > 70) return colors.warning;
    return colors.success;
  };

  const handleDownloadAudio = async (quality: 'low' | 'medium' | 'high' = 'medium') => {
    try {
      setDownloadProgress({
        isDownloading: true,
        completed: 0,
        total: 0,
        currentFile: '준비 중...',
      });

      // Get audio files that need caching
      const audioFiles = await audioFileModel.getAudioFilesNeedingDownload(quality, 50);
      
      if (audioFiles.length === 0) {
        Alert.alert('알림', '다운로드할 오디오 파일이 없습니다.');
        setDownloadProgress(prev => ({ ...prev, isDownloading: false }));
        return;
      }

      setDownloadProgress(prev => ({ 
        ...prev, 
        total: audioFiles.length,
        currentFile: '다운로드 시작...',
      }));

      const result = await audioCacheService.batchCacheFiles(
        audioFiles.map(f => f.id),
        {
          quality,
          onProgress: (completed, total) => {
            setDownloadProgress(prev => ({
              ...prev,
              completed,
              total,
              currentFile: completed < total 
                ? `${audioFiles[completed]?.file_name || '파일'} 다운로드 중...`
                : '완료!'
            }));
          },
        }
      );

      setDownloadProgress(prev => ({ ...prev, isDownloading: false }));
      
      Alert.alert(
        '다운로드 완료',
        `성공: ${result.successful}개, 실패: ${result.failed}개, 건너뜀: ${result.skipped}개`
      );

      await loadCacheData();
      if (onCacheUpdated) onCacheUpdated();

    } catch (error) {
      console.error('Error downloading audio:', error);
      Alert.alert('오류', '오디오 다운로드 중 오류가 발생했습니다.');
      setDownloadProgress(prev => ({ ...prev, isDownloading: false }));
    }
  };

  const handleCleanupCache = () => {
    Alert.alert(
      '캐시 정리',
      '오래된 오디오 파일을 삭제하여 저장 공간을 확보하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '정리',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              const freedBytes = await audioCacheService.cleanupCache({ aggressive: false });
              
              Alert.alert(
                '정리 완료',
                `${formatBytes(freedBytes)}의 저장 공간을 확보했습니다.`
              );
              
              await loadCacheData();
              if (onCacheUpdated) onCacheUpdated();
            } catch (error) {
              console.error('Error cleaning cache:', error);
              Alert.alert('오류', '캐시 정리 중 오류가 발생했습니다.');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleUpdateConfig = (newConfig: Partial<AudioCacheConfig>) => {
    if (!config) return;
    
    const updatedConfig = { ...config, ...newConfig };
    audioCacheService.updateConfig(updatedConfig);
    setConfig(updatedConfig);
  };

  const renderStorageOverview = () => {
    if (!stats || !config) return null;

    const usagePercentage = getCacheUsagePercentage();
    const usageColor = getCacheUsageColor();

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>저장 공간 사용량</Text>
        
        <View style={styles.storageCard}>
          <View style={styles.storageHeader}>
            <Text style={styles.storageTitle}>캐시된 오디오</Text>
            <Text style={[styles.storagePercentage, { color: usageColor }]}>
              {usagePercentage.toFixed(1)}%
            </Text>
          </View>
          
          <View style={styles.storageBar}>
            <View 
              style={[
                styles.storageUsed,
                { 
                  width: `${Math.min(usagePercentage, 100)}%`,
                  backgroundColor: usageColor
                }
              ]}
            />
          </View>
          
          <View style={styles.storageDetails}>
            <Text style={styles.storageDetailText}>
              사용됨: {formatBytes(stats.totalSize)}
            </Text>
            <Text style={styles.storageDetailText}>
              한도: {formatBytes(config.maxCacheSize)}
            </Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalFiles}</Text>
            <Text style={styles.statLabel}>파일 개수</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {formatBytes(stats.availableSpace)}
            </Text>
            <Text style={styles.statLabel}>사용 가능</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {(stats.cacheHitRate * 100).toFixed(1)}%
            </Text>
            <Text style={styles.statLabel}>적중률</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderQualityDistribution = () => {
    if (!stats) return null;

    const { qualityDistribution } = stats;
    const total = qualityDistribution.low + qualityDistribution.medium + qualityDistribution.high;

    if (total === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>품질별 분포</Text>
        
        <View style={styles.qualityGrid}>
          <View style={styles.qualityCard}>
            <View style={[styles.qualityIndicator, { backgroundColor: colors.success }]} />
            <Text style={styles.qualityLabel}>저화질</Text>
            <Text style={styles.qualityValue}>{qualityDistribution.low}</Text>
            <Text style={styles.qualityPercentage}>
              {total > 0 ? ((qualityDistribution.low / total) * 100).toFixed(0) : 0}%
            </Text>
          </View>
          
          <View style={styles.qualityCard}>
            <View style={[styles.qualityIndicator, { backgroundColor: colors.primary }]} />
            <Text style={styles.qualityLabel}>중화질</Text>
            <Text style={styles.qualityValue}>{qualityDistribution.medium}</Text>
            <Text style={styles.qualityPercentage}>
              {total > 0 ? ((qualityDistribution.medium / total) * 100).toFixed(0) : 0}%
            </Text>
          </View>
          
          <View style={styles.qualityCard}>
            <View style={[styles.qualityIndicator, { backgroundColor: colors.warning }]} />
            <Text style={styles.qualityLabel}>고화질</Text>
            <Text style={styles.qualityValue}>{qualityDistribution.high}</Text>
            <Text style={styles.qualityPercentage}>
              {total > 0 ? ((qualityDistribution.high / total) * 100).toFixed(0) : 0}%
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderDownloadSection = () => {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>오디오 다운로드</Text>
        
        <View style={styles.downloadCard}>
          <Text style={styles.downloadDescription}>
            오프라인에서 사용할 오디오 파일을 미리 다운로드합니다.
          </Text>
          
          <View style={styles.qualitySelector}>
            <Text style={styles.qualityTitle}>품질 선택:</Text>
            <View style={styles.qualityButtons}>
              <TouchableOpacity
                style={[styles.qualityButton, styles.lowQualityButton]}
                onPress={() => handleDownloadAudio('low')}
                disabled={downloadProgress.isDownloading}
              >
                <Text style={styles.qualityButtonText}>저화질</Text>
                <Text style={styles.qualityButtonSubtext}>빠른 다운로드</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.qualityButton, styles.mediumQualityButton]}
                onPress={() => handleDownloadAudio('medium')}
                disabled={downloadProgress.isDownloading}
              >
                <Text style={styles.qualityButtonText}>중화질</Text>
                <Text style={styles.qualityButtonSubtext}>권장</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.qualityButton, styles.highQualityButton]}
                onPress={() => handleDownloadAudio('high')}
                disabled={downloadProgress.isDownloading}
              >
                <Text style={styles.qualityButtonText}>고화질</Text>
                <Text style={styles.qualityButtonSubtext}>최고 품질</Text>
              </TouchableOpacity>
            </View>
          </View>

          {downloadProgress.isDownloading && (
            <View style={styles.downloadProgress}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressText}>
                  {downloadProgress.completed}/{downloadProgress.total}
                </Text>
                <Text style={styles.progressPercentage}>
                  {downloadProgress.total > 0 
                    ? Math.round((downloadProgress.completed / downloadProgress.total) * 100)
                    : 0}%
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill,
                    { 
                      width: downloadProgress.total > 0 
                        ? `${(downloadProgress.completed / downloadProgress.total) * 100}%`
                        : '0%'
                    }
                  ]}
                />
              </View>
              <Text style={styles.progressFile}>{downloadProgress.currentFile}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderManagementSection = () => {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>캐시 관리</Text>
        
        <View style={styles.managementGrid}>
          <TouchableOpacity
            style={[styles.managementButton, styles.cleanupButton]}
            onPress={handleCleanupCache}
            disabled={isLoading}
          >
            <Text style={styles.managementIcon}>🧹</Text>
            <Text style={styles.managementButtonText}>캐시 정리</Text>
            <Text style={styles.managementButtonSubtext}>
              오래된 파일 삭제
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.managementButton, styles.settingsButton]}
            onPress={() => {
              // Open settings modal or navigate to settings
              console.log('Open cache settings');
            }}
            disabled={isLoading}
          >
            <Text style={styles.managementIcon}>⚙️</Text>
            <Text style={styles.managementButtonText}>설정</Text>
            <Text style={styles.managementButtonSubtext}>
              캐시 설정 변경
            </Text>
          </TouchableOpacity>
        </View>

        {stats && stats.lastCleanup && (
          <Text style={styles.lastCleanupText}>
            마지막 정리: {new Date(stats.lastCleanup).toLocaleString('ko-KR')}
          </Text>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>오디오 캐시 관리</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>완료</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {renderStorageOverview()}
          {renderQualityDistribution()}
          {renderDownloadSection()}
          {renderManagementSection()}
        </ScrollView>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
  },
  closeButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  closeButtonText: {
    ...theme.typography.button,
    color: theme.colors.primary,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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
    marginBottom: theme.spacing.md,
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
  storageDetailText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.backgroundSecondary,
    padding: theme.spacing.md,
    borderRadius: theme.spacing.sm,
    alignItems: 'center' as const,
  },
  statValue: {
    ...theme.typography.h4,
    color: theme.colors.text,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center' as const,
  },
  qualityGrid: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
  },
  qualityCard: {
    flex: 1,
    backgroundColor: theme.colors.backgroundSecondary,
    padding: theme.spacing.md,
    borderRadius: theme.spacing.sm,
    alignItems: 'center' as const,
  },
  qualityIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: theme.spacing.sm,
  },
  qualityLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  qualityValue: {
    ...theme.typography.h4,
    color: theme.colors.text,
    fontWeight: theme.typography.fontWeight.bold,
  },
  qualityPercentage: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  downloadCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    padding: theme.spacing.md,
    borderRadius: theme.spacing.sm,
  },
  downloadDescription: {
    ...theme.typography.body2,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  qualitySelector: {
    marginBottom: theme.spacing.md,
  },
  qualityTitle: {
    ...theme.typography.subtitle2,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  qualityButtons: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
  },
  qualityButton: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.spacing.sm,
    alignItems: 'center' as const,
  },
  lowQualityButton: {
    backgroundColor: theme.colors.successLight,
  },
  mediumQualityButton: {
    backgroundColor: theme.colors.primaryLight,
  },
  highQualityButton: {
    backgroundColor: theme.colors.warningLight,
  },
  qualityButtonText: {
    ...theme.typography.button,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  qualityButtonSubtext: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  downloadProgress: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  progressHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: theme.spacing.sm,
  },
  progressText: {
    ...theme.typography.subtitle2,
    color: theme.colors.text,
  },
  progressPercentage: {
    ...theme.typography.subtitle2,
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeight.bold,
  },
  progressBar: {
    height: 6,
    backgroundColor: theme.colors.border,
    borderRadius: 3,
    marginBottom: theme.spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  progressFile: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  managementGrid: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  managementButton: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.spacing.sm,
    alignItems: 'center' as const,
  },
  cleanupButton: {
    backgroundColor: theme.colors.warningLight,
  },
  settingsButton: {
    backgroundColor: theme.colors.infoLight,
  },
  managementIcon: {
    fontSize: 24,
    marginBottom: theme.spacing.sm,
  },
  managementButtonText: {
    ...theme.typography.button,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  managementButtonSubtext: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center' as const,
  },
  lastCleanupText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center' as const,
  },
});

export default AudioCacheManager;