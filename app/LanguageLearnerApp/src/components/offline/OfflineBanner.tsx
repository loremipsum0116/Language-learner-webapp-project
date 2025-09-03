// src/components/offline/OfflineBanner.tsx
// 오프라인 모드 배너 컴포넌트

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { useOfflineStatus, useOfflineCapabilities } from '../../hooks/useOfflineStatus';
import { useThemedStyles } from '../../context/ThemeContext';
import { Theme } from '../../theme';
import { syncService } from '../../services/SyncService';

interface OfflineBannerProps {
  onDismiss?: () => void;
  showActions?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number;
}

const OfflineBanner: React.FC<OfflineBannerProps> = ({
  onDismiss,
  showActions = true,
  autoHide = false,
  autoHideDelay = 5000,
}) => {
  const styles = useThemedStyles(createStyles);
  const offlineStatus = useOfflineStatus();
  const { isFeatureAvailable, getUnavailableMessage } = useOfflineCapabilities();
  const [isVisible, setIsVisible] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (offlineStatus.isOffline || offlineStatus.isConnecting) {
      setIsVisible(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      if (autoHide && autoHideDelay > 0 && !offlineStatus.isOffline) {
        const timer = setTimeout(() => {
          handleDismiss();
        }, autoHideDelay);

        return () => clearTimeout(timer);
      }
    } else {
      handleDismiss();
    }
  }, [offlineStatus.isOffline, offlineStatus.isConnecting, autoHide, autoHideDelay]);

  const handleDismiss = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
      if (onDismiss) onDismiss();
    });
  };

  const handleRetry = async () => {
    try {
      if (syncService.isOnlineMode()) {
        await syncService.syncNow();
      }
    } catch (error) {
      console.error('Retry sync failed:', error);
    }
  };

  const getBannerContent = () => {
    if (offlineStatus.isConnecting) {
      return {
        icon: '🔄',
        title: '인터넷에 연결 중...',
        message: '잠시만 기다려주세요.',
        type: 'connecting' as const,
      };
    } else if (offlineStatus.isOffline) {
      return {
        icon: '📱',
        title: '오프라인 모드',
        message: '인터넷 연결 없이도 학습을 계속할 수 있습니다.',
        type: 'offline' as const,
      };
    } else if (!offlineStatus.hasStableConnection) {
      return {
        icon: '📶',
        title: '연결이 불안정합니다',
        message: '일부 기능이 제한될 수 있습니다.',
        type: 'unstable' as const,
      };
    }

    return null;
  };

  const getAvailableFeatures = (): string[] => {
    if (offlineStatus.isOffline) {
      return [
        '단어장 학습',
        'SRS 퀴즈',
        '복습 퀴즈',
        '학습 기록 조회',
        '오프라인 진도 추적',
      ];
    }
    return [];
  };

  if (!isVisible) return null;

  const content = getBannerContent();
  if (!content) return null;

  const availableFeatures = getAvailableFeatures();

  return (
    <Animated.View 
      style={[
        styles.container,
        styles[`${content.type}Container`],
        { opacity: fadeAnim }
      ]}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.icon}>{content.icon}</Text>
          <View style={styles.textContainer}>
            <Text style={styles.title}>{content.title}</Text>
            <Text style={styles.message}>{content.message}</Text>
          </View>
          {onDismiss && (
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleDismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {content.type === 'offline' && availableFeatures.length > 0 && (
          <View style={styles.featuresContainer}>
            <Text style={styles.featuresTitle}>오프라인에서 사용 가능한 기능:</Text>
            <View style={styles.featuresList}>
              {availableFeatures.map((feature, index) => (
                <Text key={index} style={styles.featureItem}>
                  • {feature}
                </Text>
              ))}
            </View>
          </View>
        )}

        {showActions && (
          <View style={styles.actionsContainer}>
            {content.type === 'offline' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={() => {
                  // Navigate to offline settings or download screen
                  console.log('Navigate to offline settings');
                }}
              >
                <Text style={styles.primaryButtonText}>
                  오프라인 설정
                </Text>
              </TouchableOpacity>
            )}

            {(content.type === 'connecting' || content.type === 'unstable') && (
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={handleRetry}
              >
                <Text style={styles.secondaryButtonText}>
                  다시 시도
                </Text>
              </TouchableOpacity>
            )}

            {content.type !== 'connecting' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.tertiaryButton]}
                onPress={handleDismiss}
              >
                <Text style={styles.tertiaryButtonText}>
                  알겠습니다
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const createStyles = (theme: Theme) => ({
  container: {
    margin: theme.spacing.md,
    borderRadius: theme.spacing.sm,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    padding: theme.spacing.md,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    marginBottom: theme.spacing.sm,
  },
  icon: {
    fontSize: 24,
    marginRight: theme.spacing.sm,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    ...theme.typography.h4,
    marginBottom: theme.spacing.xs,
  },
  message: {
    ...theme.typography.body2,
    opacity: 0.8,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginLeft: theme.spacing.sm,
  },
  closeIcon: {
    fontSize: 18,
    opacity: 0.6,
  },
  featuresContainer: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  featuresTitle: {
    ...theme.typography.subtitle2,
    marginBottom: theme.spacing.sm,
  },
  featuresList: {
    gap: theme.spacing.xs,
  },
  featureItem: {
    ...theme.typography.body2,
    paddingLeft: theme.spacing.sm,
  },
  actionsContainer: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    flexWrap: 'wrap' as const,
  },
  actionButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.spacing.xs,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minWidth: 80,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
  },
  primaryButtonText: {
    ...theme.typography.button,
    color: theme.colors.textInverse,
  },
  secondaryButton: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  secondaryButtonText: {
    ...theme.typography.button,
    color: theme.colors.text,
  },
  tertiaryButton: {
    backgroundColor: 'transparent',
  },
  tertiaryButtonText: {
    ...theme.typography.button,
    color: theme.colors.textSecondary,
  },
  offlineContainer: {
    backgroundColor: theme.colors.errorLight,
    borderColor: theme.colors.error,
    borderWidth: 1,
  },
  connectingContainer: {
    backgroundColor: theme.colors.warningLight,
    borderColor: theme.colors.warning,
    borderWidth: 1,
  },
  unstableContainer: {
    backgroundColor: theme.colors.infoLight,
    borderColor: theme.colors.info,
    borderWidth: 1,
  },
});

export default OfflineBanner;