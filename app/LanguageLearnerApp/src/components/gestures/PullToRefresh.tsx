// src/components/gestures/PullToRefresh.tsx
// 당겨서 새로고침 기능 컴포넌트

import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Animated,
  PanResponder,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useThemedStyles, useColors } from '../../context/ThemeContext';
import { Theme } from '../../theme';
import { useHapticFeedback } from '../../services/HapticFeedbackService';

const { height: screenHeight } = Dimensions.get('window');
const PULL_THRESHOLD = 80;
const MAX_PULL_DISTANCE = 120;

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void> | void;
  refreshing?: boolean;
  pullThreshold?: number;
  maxPullDistance?: number;
  enabled?: boolean;
  customIndicator?: React.ReactNode;
  refreshText?: {
    pull: string;
    release: string;
    refreshing: string;
  };
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  refreshing = false,
  pullThreshold = PULL_THRESHOLD,
  maxPullDistance = MAX_PULL_DISTANCE,
  enabled = true,
  customIndicator,
  refreshText = {
    pull: '당겨서 새로고침',
    release: '놓아서 새로고침',
    refreshing: '새로고침 중...',
  },
}) => {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const { pullToRefresh } = useHapticFeedback();
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [canRefresh, setCanRefresh] = useState(false);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const pullAnimValue = useRef(new Animated.Value(0)).current;
  const rotateAnimValue = useRef(new Animated.Value(0)).current;
  const scaleAnimValue = useRef(new Animated.Value(1)).current;

  // 새로고침 실행
  const handleRefresh = useCallback(async () => {
    if (isRefreshing || !enabled) return;
    
    // 햅틱 피드백
    pullToRefresh();
    
    setIsRefreshing(true);
    
    // 새로고침 애니메이션
    Animated.parallel([
      Animated.timing(pullAnimValue, {
        toValue: pullThreshold,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.loop(
        Animated.timing(rotateAnimValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ),
    ]).start();

    try {
      await onRefresh();
    } finally {
      // 새로고침 완료 후 애니메이션
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(pullAnimValue, {
            toValue: 0,
            duration: 300,
            useNativeDriver: false,
          }),
          Animated.timing(rotateAnimValue, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnimValue, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setIsRefreshing(false);
          setPullDistance(0);
          setCanRefresh(false);
        });
      }, 500);
    }
  }, [isRefreshing, enabled, onRefresh, pullThreshold]);

  // PanResponder 설정
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      if (!enabled || isRefreshing) return false;
      
      // 세로 스크롤이고 아래로 당기는 제스처일 때만
      return Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && gestureState.dy > 0;
    },

    onPanResponderGrant: () => {
      // 스크롤이 최상단에 있을 때만 활성화
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    },

    onPanResponderMove: (evt, gestureState) => {
      if (!enabled || isRefreshing) return;
      
      const { dy } = gestureState;
      if (dy <= 0) return;

      const distance = Math.min(dy * 0.6, maxPullDistance);
      setPullDistance(distance);
      
      const progress = Math.min(distance / pullThreshold, 1);
      setCanRefresh(distance >= pullThreshold);

      pullAnimValue.setValue(distance);
      scaleAnimValue.setValue(0.8 + (0.2 * progress));
      rotateAnimValue.setValue(progress * 0.5);
    },

    onPanResponderRelease: (evt, gestureState) => {
      if (!enabled || isRefreshing) return;

      if (canRefresh && pullDistance >= pullThreshold) {
        handleRefresh();
      } else {
        // 취소 애니메이션
        Animated.parallel([
          Animated.spring(pullAnimValue, {
            toValue: 0,
            useNativeDriver: false,
          }),
          Animated.spring(scaleAnimValue, {
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.spring(rotateAnimValue, {
            toValue: 0,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setPullDistance(0);
          setCanRefresh(false);
        });
      }
    },
  });

  // 회전 애니메이션
  const rotateInterpolate = rotateAnimValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // 상태에 따른 텍스트 결정
  const getStatusText = () => {
    if (isRefreshing || refreshing) return refreshText.refreshing;
    if (canRefresh) return refreshText.release;
    return refreshText.pull;
  };

  // 상태에 따른 아이콘 결정
  const getStatusIcon = () => {
    if (isRefreshing || refreshing) {
      return customIndicator || (
        <ActivityIndicator size="small" color={colors.primary} />
      );
    }
    
    return (
      <Animated.View
        style={[
          styles.refreshIcon,
          {
            transform: [
              { rotate: rotateInterpolate },
              { scale: scaleAnimValue },
            ],
          },
        ]}
      >
        <Text style={styles.refreshIconText}>
          {canRefresh ? '↻' : '↓'}
        </Text>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* 새로고침 인디케이터 */}
      <Animated.View
        style={[
          styles.refreshContainer,
          {
            height: pullAnimValue,
            opacity: pullAnimValue.interpolate({
              inputRange: [0, pullThreshold],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            }),
          },
        ]}
      >
        <View style={styles.refreshContent}>
          {getStatusIcon()}
          <Text style={styles.refreshText}>
            {getStatusText()}
          </Text>
        </View>
      </Animated.View>

      {/* 스크롤 컨텐츠 */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={true}
        bounces={false}
        scrollEventThrottle={16}
      >
        {children}
      </ScrollView>
    </View>
  );
};

// 리스트용 당겨서 새로고침 컴포넌트
export const PullToRefreshFlatList: React.FC<{
  data: any[];
  renderItem: ({ item, index }: { item: any; index: number }) => React.ReactElement;
  onRefresh: () => Promise<void> | void;
  refreshing?: boolean;
  enabled?: boolean;
  keyExtractor?: (item: any, index: number) => string;
  ListEmptyComponent?: React.ComponentType<any> | React.ReactElement | null;
  ItemSeparatorComponent?: React.ComponentType<any> | null;
  pullThreshold?: number;
  refreshText?: {
    pull: string;
    release: string;
    refreshing: string;
  };
}> = ({
  data,
  renderItem,
  onRefresh,
  refreshing = false,
  enabled = true,
  keyExtractor,
  ListEmptyComponent,
  ItemSeparatorComponent,
  pullThreshold = PULL_THRESHOLD,
  refreshText,
}) => {
  return (
    <PullToRefresh
      onRefresh={onRefresh}
      refreshing={refreshing}
      enabled={enabled}
      pullThreshold={pullThreshold}
      refreshText={refreshText}
    >
      <View style={{ paddingBottom: 100 }}>
        {data.length === 0 && ListEmptyComponent && (
          typeof ListEmptyComponent === 'function' ? (
            <ListEmptyComponent />
          ) : (
            ListEmptyComponent
          )
        )}
        
        {data.map((item, index) => (
          <View key={keyExtractor?.(item, index) || index.toString()}>
            {renderItem({ item, index })}
            {ItemSeparatorComponent && index < data.length - 1 && (
              <ItemSeparatorComponent />
            )}
          </View>
        ))}
      </View>
    </PullToRefresh>
  );
};

const createStyles = (theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  refreshContainer: {
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  refreshContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: theme.spacing.sm,
  },
  refreshIcon: {
    width: 24,
    height: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: theme.spacing.sm,
  },
  refreshIconText: {
    fontSize: 18,
    color: theme.colors.primary,
    fontWeight: 'bold' as const,
  },
  refreshText: {
    ...theme.typography.body2,
    color: theme.colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
});

export default PullToRefresh;