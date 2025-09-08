// src/components/common/OptimizedTable.tsx
// 모바일 최적화 테이블 컴포넌트

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  VirtualizedList,
  ScrollView,
  Dimensions,
} from 'react-native';
import { FadeInView } from '../animations';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface TableColumn<T = any> {
  key: string;
  title: string;
  width?: number | string;
  flex?: number;
  render?: (value: any, item: T, index: number) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
}

export interface TableData {
  [key: string]: any;
}

export interface OptimizedTableProps<T = TableData> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  onRowPress?: (item: T, index: number) => void;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  keyExtractor?: (item: T, index: number) => string;
  renderEmpty?: () => React.ReactNode;
  renderLoading?: () => React.ReactNode;
  style?: any;
  headerStyle?: any;
  rowStyle?: any;
  cellStyle?: any;
  virtualized?: boolean;
  stickyHeader?: boolean;
  maxHeight?: number;
  showIndex?: boolean;
  striped?: boolean;
  bordered?: boolean;
}

const OptimizedTable = <T extends TableData>({
  data,
  columns,
  loading = false,
  onRowPress,
  onSort,
  sortColumn,
  sortDirection,
  keyExtractor = (item, index) => `row-${index}`,
  renderEmpty,
  renderLoading,
  style,
  headerStyle,
  rowStyle,
  cellStyle,
  virtualized = false,
  stickyHeader = true,
  maxHeight,
  showIndex = false,
  striped = true,
  bordered = false,
}: OptimizedTableProps<T>) => {
  
  // Calculate column widths
  const calculatedColumns = useMemo(() => {
    const totalFlex = columns.reduce((sum, col) => sum + (col.flex || 0), 0);
    const fixedWidth = columns.reduce((sum, col) => {
      if (typeof col.width === 'number') return sum + col.width;
      return sum;
    }, 0);
    
    const availableWidth = SCREEN_WIDTH - fixedWidth - (showIndex ? 50 : 0) - 32; // margins
    
    return columns.map(col => ({
      ...col,
      calculatedWidth: col.width 
        ? (typeof col.width === 'string' ? col.width : col.width)
        : col.flex 
        ? (availableWidth * (col.flex / totalFlex))
        : availableWidth / columns.length,
    }));
  }, [columns, showIndex]);

  // Handle sort
  const handleSort = useCallback((columnKey: string) => {
    if (!onSort) return;
    
    const newDirection = sortColumn === columnKey && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(columnKey, newDirection);
  }, [onSort, sortColumn, sortDirection]);

  // Render header cell
  const renderHeaderCell = useCallback((column: TableColumn & { calculatedWidth: any }, index: number) => (
    <TouchableOpacity
      key={`header-${column.key}`}
      style={[
        styles.headerCell,
        {
          width: column.calculatedWidth,
          justifyContent: column.align === 'center' ? 'center' : column.align === 'right' ? 'flex-end' : 'flex-start',
        },
        headerStyle,
        bordered && styles.borderedCell,
      ]}
      onPress={column.sortable ? () => handleSort(column.key) : undefined}
      activeOpacity={column.sortable ? 0.7 : 1}
    >
      <Text style={[
        styles.headerText,
        column.sortable && styles.sortableHeaderText,
      ]}>
        {column.title}
        {column.sortable && sortColumn === column.key && (
          <Text style={styles.sortIndicator}>
            {sortDirection === 'asc' ? ' ↑' : ' ↓'}
          </Text>
        )}
      </Text>
    </TouchableOpacity>
  ), [headerStyle, bordered, handleSort, sortColumn, sortDirection]);

  // Render header
  const renderHeader = () => (
    <View style={[styles.headerRow, bordered && styles.borderedRow]}>
      {showIndex && (
        <View style={[styles.headerCell, styles.indexCell, headerStyle, bordered && styles.borderedCell]}>
          <Text style={styles.headerText}>#</Text>
        </View>
      )}
      {calculatedColumns.map(renderHeaderCell)}
    </View>
  );

  // Render cell
  const renderCell = useCallback((column: TableColumn & { calculatedWidth: any }, item: T, index: number) => {
    const value = item[column.key];
    const content = column.render ? column.render(value, item, index) : String(value || '');
    
    return (
      <View
        key={`cell-${column.key}-${index}`}
        style={[
          styles.cell,
          {
            width: column.calculatedWidth,
            justifyContent: column.align === 'center' ? 'center' : column.align === 'right' ? 'flex-end' : 'flex-start',
          },
          cellStyle,
          bordered && styles.borderedCell,
        ]}
      >
        {typeof content === 'string' ? (
          <Text 
            style={[
              styles.cellText,
              { textAlign: column.align || 'left' }
            ]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {content}
          </Text>
        ) : (
          content
        )}
      </View>
    );
  }, [cellStyle, bordered]);

  // Render row
  const renderRow = useCallback(({ item, index }: { item: T; index: number }) => (
    <TouchableOpacity
      style={[
        styles.row,
        striped && index % 2 === 1 && styles.stripedRow,
        bordered && styles.borderedRow,
        rowStyle,
      ]}
      onPress={onRowPress ? () => onRowPress(item, index) : undefined}
      activeOpacity={onRowPress ? 0.7 : 1}
    >
      {showIndex && (
        <View style={[styles.cell, styles.indexCell, cellStyle, bordered && styles.borderedCell]}>
          <Text style={styles.indexText}>{index + 1}</Text>
        </View>
      )}
      {calculatedColumns.map(column => renderCell(column, item, index))}
    </TouchableOpacity>
  ), [calculatedColumns, renderCell, onRowPress, rowStyle, striped, bordered, showIndex, cellStyle]);

  // Render empty state
  const renderEmptyState = () => (
    <FadeInView style={styles.emptyContainer}>
      {renderEmpty ? renderEmpty() : (
        <Text style={styles.emptyText}>데이터가 없습니다</Text>
      )}
    </FadeInView>
  );

  // Render loading state
  const renderLoadingState = () => (
    <FadeInView style={styles.loadingContainer}>
      {renderLoading ? renderLoading() : (
        <Text style={styles.loadingText}>로딩 중...</Text>
      )}
    </FadeInView>
  );

  const containerStyle = [
    styles.container,
    style,
    maxHeight && { maxHeight },
    bordered && styles.borderedContainer,
  ];

  if (loading) {
    return (
      <View style={containerStyle}>
        {stickyHeader && renderHeader()}
        {renderLoadingState()}
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={containerStyle}>
        {stickyHeader && renderHeader()}
        {renderEmptyState()}
      </View>
    );
  }

  // Render virtualized list for large datasets
  if (virtualized && data.length > 50) {
    return (
      <View style={containerStyle}>
        {stickyHeader && renderHeader()}
        <VirtualizedList
          data={data}
          initialNumToRender={20}
          renderItem={renderRow}
          keyExtractor={keyExtractor}
          getItemCount={(data) => data.length}
          getItem={(data, index) => data[index]}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={100}
          windowSize={10}
          removeClippedSubviews={true}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  }

  // Render regular FlatList or ScrollView
  return (
    <View style={containerStyle}>
      {stickyHeader && renderHeader()}
      {data.length <= 20 ? (
        // Use ScrollView for small datasets
        <ScrollView 
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
        >
          {data.map((item, index) => (
            <View key={keyExtractor(item, index)}>
              {renderRow({ item, index })}
            </View>
          ))}
        </ScrollView>
      ) : (
        // Use FlatList for medium datasets
        <FlatList
          data={data}
          renderItem={renderRow}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={100}
          windowSize={10}
          removeClippedSubviews={true}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 8,
    overflow: 'hidden',
  },
  borderedContainer: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  borderedRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerCell: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'flex-start',
  },
  borderedCell: {
    borderRightWidth: 1,
    borderRightColor: '#f3f4f6',
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  sortableHeaderText: {
    color: '#3b82f6',
  },
  sortIndicator: {
    fontSize: 12,
    color: '#3b82f6',
  },
  row: {
    flexDirection: 'row',
    backgroundColor: 'white',
    minHeight: 48,
  },
  stripedRow: {
    backgroundColor: '#fafafa',
  },
  cell: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  cellText: {
    fontSize: 14,
    color: '#1f2937',
    lineHeight: 20,
  },
  indexCell: {
    width: 50,
    alignItems: 'center',
  },
  indexText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
});

export default OptimizedTable;