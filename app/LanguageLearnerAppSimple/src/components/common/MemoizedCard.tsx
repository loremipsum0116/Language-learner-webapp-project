// MemoizedCard.tsx - 메모이제이션된 카드 컴포넌트
import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import OptimizedImage from './OptimizedImage';
import { useRenderPerformance } from '../../utils/performance';

interface CardData {
  id: number;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  badge?: string;
  badgeColor?: string;
}

interface MemoizedCardProps {
  data: CardData;
  onPress?: (id: number) => void;
  onLongPress?: (id: number) => void;
  style?: ViewStyle;
  showImage?: boolean;
  showBadge?: boolean;
}

const MemoizedCard = memo<MemoizedCardProps>(({
  data,
  onPress,
  onLongPress,
  style,
  showImage = true,
  showBadge = true
}) => {
  useRenderPerformance('MemoizedCard');

  const handlePress = () => onPress?.(data.id);
  const handleLongPress = () => onLongPress?.(data.id);

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.8}
    >
      {/* 이미지 영역 */}
      {showImage && data.imageUrl && (
        <OptimizedImage
          source={data.imageUrl}
          width={60}
          height={60}
          resizeMode="cover"
          containerStyle={styles.imageContainer}
          lazy
        />
      )}

      {/* 컨텐츠 영역 */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {data.title}
        </Text>
        {data.subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {data.subtitle}
          </Text>
        )}
      </View>

      {/* 배지 및 아이콘 */}
      <View style={styles.rightSection}>
        {showBadge && data.badge && (
          <View 
            style={[
              styles.badge, 
              { backgroundColor: data.badgeColor || '#4A90E2' }
            ]}
          >
            <Text style={styles.badgeText}>{data.badge}</Text>
          </View>
        )}
        <Icon name="chevron-forward" size={20} color="#ccc" />
      </View>
    </TouchableOpacity>
  );
});

// Props 비교 함수로 불필요한 리렌더링 방지
MemoizedCard.displayName = 'MemoizedCard';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2
  },
  imageContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12
  },
  content: {
    flex: 1,
    marginRight: 8
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    color: '#666'
  },
  rightSection: {
    alignItems: 'flex-end',
    justifyContent: 'space-between'
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600'
  }
});

export default MemoizedCard;