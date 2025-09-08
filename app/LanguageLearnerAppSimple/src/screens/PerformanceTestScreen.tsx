// PerformanceTestScreen.tsx - 성능 최적화 테스트 화면
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Text,
  TouchableOpacity,
  Switch,
  Alert
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import VirtualizedList from '../components/common/VirtualizedList';
import OptimizedImage from '../components/common/OptimizedImage';
import { usePerformanceMonitor, performanceMonitor } from '../utils/performanceMonitor';
import { useSafeState, useDebounce } from '../utils/performance';
import { StudyStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<StudyStackParamList, any>;

interface TestItem {
  id: number;
  title: string;
  subtitle: string;
  imageUrl?: string;
  badge: string;
  badgeColor: string;
}

export default function PerformanceTestScreen({ navigation }: Props) {
  const { generateReport, measureInteractionDelay } = usePerformanceMonitor('PerformanceTestScreen');
  
  const [itemCount, setItemCount] = useSafeState(100);
  const [useVirtualization, setUseVirtualization] = useSafeState(true);
  const [showImages, setShowImages] = useSafeState(true);
  const [refreshing, setRefreshing] = useSafeState(false);

  // 디바운스된 아이템 카운트
  const debouncedItemCount = useDebounce(itemCount, 500);

  // 테스트 데이터 생성 (메모이제이션)
  const testData = useMemo<TestItem[]>(() => {
    const data: TestItem[] = [];
    const colors = ['#4A90E2', '#50C878', '#FFB347', '#DDA0DD', '#F0E68C'];
    const badges = ['NEW', 'HOT', 'SALE', 'BEST', 'PICK'];
    
    for (let i = 0; i < debouncedItemCount; i++) {
      data.push({
        id: i,
        title: `테스트 아이템 ${i + 1}`,
        subtitle: `이것은 ${i + 1}번째 테스트 아이템입니다.`,
        imageUrl: showImages 
          ? `https://picsum.photos/100/100?random=${i}` 
          : undefined,
        badge: badges[i % badges.length],
        badgeColor: colors[i % colors.length]
      });
    }
    
    return data;
  }, [debouncedItemCount, showImages]);

  // 아이템 클릭 핸들러
  const handleItemPress = useCallback((item: TestItem) => {
    measureInteractionDelay('ItemPress', () => {
      Alert.alert('아이템 선택', `${item.title}을 선택했습니다.`);
    });
  }, [measureInteractionDelay]);

  // 새로고침 핸들러
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    
    // 의도적 지연으로 새로고침 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setRefreshing(false);
  }, [setRefreshing]);

  // 성능 리포트 보기
  const showPerformanceReport = useCallback(() => {
    const report = generateReport();
    
    Alert.alert(
      '성능 리포트',
      `평균 렌더링 시간: ${report.averageRenderTime.toFixed(2)}ms\n` +
      `평균 네비게이션 시간: ${report.averageNavigationTime.toFixed(2)}ms\n` +
      `느린 컴포넌트: ${report.slowComponents.join(', ') || '없음'}`,
      [{ text: '확인' }]
    );
  }, [generateReport]);

  // 메모리 정리
  const clearCache = useCallback(() => {
    performanceMonitor.clearMetrics();
    Alert.alert('완료', '성능 메트릭이 초기화되었습니다.');
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.title}>성능 테스트</Text>
        <TouchableOpacity onPress={showPerformanceReport}>
          <Text style={styles.reportButton}>리포트</Text>
        </TouchableOpacity>
      </View>

      {/* 설정 패널 */}
      <View style={styles.settingsPanel}>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>아이템 수: {itemCount}</Text>
          <View style={styles.countButtons}>
            <TouchableOpacity 
              style={styles.countButton}
              onPress={() => setItemCount(Math.max(10, itemCount - 50))}
            >
              <Text style={styles.countButtonText}>-50</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.countButton}
              onPress={() => setItemCount(itemCount + 50)}
            >
              <Text style={styles.countButtonText}>+50</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>가상화 사용</Text>
          <Switch
            value={useVirtualization}
            onValueChange={setUseVirtualization}
            trackColor={{ false: '#ccc', true: '#4A90E2' }}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>이미지 표시</Text>
          <Switch
            value={showImages}
            onValueChange={setShowImages}
            trackColor={{ false: '#ccc', true: '#4A90E2' }}
          />
        </View>

        <TouchableOpacity style={styles.clearButton} onPress={clearCache}>
          <Text style={styles.clearButtonText}>메트릭 초기화</Text>
        </TouchableOpacity>
      </View>

      {/* 리스트 */}
      <View style={styles.listContainer}>
        {useVirtualization ? (
          <VirtualizedList
            data={testData}
            onItemPress={handleItemPress}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            estimatedItemSize={80}
            showsVerticalScrollIndicator
          />
        ) : (
          <Text style={styles.disabledText}>
            가상화를 비활성화했습니다. 성능을 비교해보세요.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  backButton: {
    fontSize: 16,
    color: '#4A90E2'
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333'
  },
  reportButton: {
    fontSize: 16,
    color: '#4A90E2'
  },
  settingsPanel: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  settingLabel: {
    fontSize: 16,
    color: '#333'
  },
  countButtons: {
    flexDirection: 'row',
    gap: 8
  },
  countButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  countButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600'
  },
  clearButton: {
    backgroundColor: '#FF5252',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8
  },
  clearButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  listContainer: {
    flex: 1
  },
  disabledText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#666'
  }
});