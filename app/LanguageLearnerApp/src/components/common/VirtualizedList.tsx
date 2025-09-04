// VirtualizedList.tsx - FlashList를 사용한 고성능 리스트
import React, { memo, useCallback, useMemo } from 'react';
import { View, StyleSheet, RefreshControl, ViewStyle } from 'react-native';
import { FlashList, ListRenderItem } from '@shopify/flash-list';
import MemoizedCard from './MemoizedCard';
import { useThrottle, useRenderPerformance } from '../../utils/performance';

interface ListItem {
  id: number;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  badge?: string;
  badgeColor?: string;
  [key: string]: any;
}

interface VirtualizedListProps<T extends ListItem> {
  data: T[];
  onItemPress?: (item: T) => void;
  onItemLongPress?: (item: T) => void;
  onRefresh?: () => Promise<void>;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  estimatedItemSize?: number;
  numColumns?: number;
  horizontal?: boolean;
  showsVerticalScrollIndicator?: boolean;
  showsHorizontalScrollIndicator?: boolean;
  contentContainerStyle?: ViewStyle;
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement;
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement;
  ListEmptyComponent?: React.ComponentType<any> | React.ReactElement;
  renderItem?: ListRenderItem<T>;
  keyExtractor?: (item: T, index: number) => string;
  refreshing?: boolean;
}

const VirtualizedList = <T extends ListItem>({
  data,
  onItemPress,
  onItemLongPress,
  onRefresh,
  onEndReached,
  onEndReachedThreshold = 0.5,
  estimatedItemSize = 80,
  numColumns = 1,
  horizontal = false,
  showsVerticalScrollIndicator = false,
  showsHorizontalScrollIndicator = false,
  contentContainerStyle,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
  renderItem,
  keyExtractor,
  refreshing = false
}: VirtualizedListProps<T>) => {
  useRenderPerformance('VirtualizedList');

  // 스로틀된 끝에 도달 이벤트
  const throttledEndReached = useThrottle(() => {
    onEndReached?.();
  }, 500);

  // 기본 렌더 아이템
  const defaultRenderItem = useCallback<ListRenderItem<T>>(
    ({ item, index }) => (
      <MemoizedCard
        data={item}
        onPress={() => onItemPress?.(item)}
        onLongPress={() => onItemLongPress?.(item)}
        style={numColumns > 1 ? styles.gridItem : undefined}
      />
    ),
    [onItemPress, onItemLongPress, numColumns]
  );

  // 기본 키 추출기
  const defaultKeyExtractor = useCallback(
    (item: T, index: number) => `${item.id || index}`,
    []
  );

  // 새로고침 컨트롤
  const refreshControl = useMemo(() => {
    if (!onRefresh) return undefined;
    
    return (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        colors={['#4A90E2']}
        tintColor="#4A90E2"
      />
    );
  }, [onRefresh, refreshing]);

  // 최적화된 설정
  const optimizedProps = useMemo(() => ({
    estimatedItemSize,
    drawDistance: estimatedItemSize * 4,
    keyExtractor: keyExtractor || defaultKeyExtractor,
    renderItem: renderItem || defaultRenderItem,
    numColumns: numColumns > 1 ? numColumns : undefined,
    horizontal,
    showsVerticalScrollIndicator,
    showsHorizontalScrollIndicator,
    onEndReachedThreshold,
    onEndReached: throttledEndReached,
    contentContainerStyle: [
      numColumns > 1 ? styles.gridContainer : styles.listContainer,
      contentContainerStyle
    ],
    refreshControl,
    removeClippedSubviews: true,
    maxToRenderPerBatch: 10,
    windowSize: 10,
    initialNumToRender: 10,
    updateCellsBatchingPeriod: 100,
    ListHeaderComponent,
    ListFooterComponent,
    ListEmptyComponent,
    // 성능 최적화를 위한 추가 props
    disableHorizontalListHeightMeasurement: true,
    overrideItemLayout: numColumns > 1 
      ? (layout, item, index) => {
          layout.size = estimatedItemSize;
        }
      : undefined
  }), [
    estimatedItemSize,
    keyExtractor,
    defaultKeyExtractor,
    renderItem,
    defaultRenderItem,
    numColumns,
    horizontal,
    showsVerticalScrollIndicator,
    showsHorizontalScrollIndicator,
    onEndReachedThreshold,
    throttledEndReached,
    contentContainerStyle,
    refreshControl,
    ListHeaderComponent,
    ListFooterComponent,
    ListEmptyComponent
  ]);

  return (
    <View style={styles.container}>
      <FlashList
        data={data}
        {...optimizedProps}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  listContainer: {
    paddingVertical: 8
  },
  gridContainer: {
    paddingVertical: 8,
    paddingHorizontal: 8
  },
  gridItem: {
    flex: 1,
    marginHorizontal: 4
  }
});

// 메모이제이션 적용
export default memo(VirtualizedList) as <T extends ListItem>(
  props: VirtualizedListProps<T>
) => React.ReactElement;