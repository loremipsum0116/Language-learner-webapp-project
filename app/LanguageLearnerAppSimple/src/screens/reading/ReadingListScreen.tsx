/*
  ReadingListScreen.tsx — React Native 버전
  ------------------------------------------------------------
  웹 ReadingList.jsx를 모바일 앱에 맞게 리팩토링
*/

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiClient } from '../../services/apiClient';
import { AppHeader } from '../../components/common/AppHeader';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ReadingList'>;

interface ReadingLevel {
  level: string;
  description: string;
  color: string;
  totalQuestions: number;
  availableQuestions: number;
  completedQuestions: number;
}

const LEVEL_COLORS: Record<string, string> = {
  beginner: '#10b981',
  intermediate: '#f59e0b',
  advanced: '#ef4444',
};

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  beginner: '기초 수준 - 쉬운 어휘와 문법',
  intermediate: '중급 수준 - 일상적인 주제',
  advanced: '고급 수준 - 복잡한 주제와 어휘',
};

export default function ReadingListScreen({ navigation }: Props) {
  const [levels, setLevels] = useState<ReadingLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReadingLevels = useCallback(async () => {
    try {
      setError(null);
      
      // API에서 리딩 레벨 정보를 가져옴
      const response = await apiClient.get('/api/reading/levels');
      
      if (response.success && response.data) {
        const levelsData = response.data.map((level: any) => ({
          level: level.level,
          description: LEVEL_DESCRIPTIONS[level.level] || level.description,
          color: LEVEL_COLORS[level.level] || '#6b7280',
          totalQuestions: level.totalQuestions || 0,
          availableQuestions: level.availableQuestions || 0,
          completedQuestions: level.completedQuestions || 0,
        }));
        
        setLevels(levelsData);
      } else {
        // 기본 레벨 데이터 사용
        setLevels([
          {
            level: 'beginner',
            description: LEVEL_DESCRIPTIONS.beginner,
            color: LEVEL_COLORS.beginner,
            totalQuestions: 20,
            availableQuestions: 20,
            completedQuestions: 0,
          },
          {
            level: 'intermediate',
            description: LEVEL_DESCRIPTIONS.intermediate,
            color: LEVEL_COLORS.intermediate,
            totalQuestions: 25,
            availableQuestions: 25,
            completedQuestions: 0,
          },
          {
            level: 'advanced',
            description: LEVEL_DESCRIPTIONS.advanced,
            color: LEVEL_COLORS.advanced,
            totalQuestions: 15,
            availableQuestions: 15,
            completedQuestions: 0,
          },
        ]);
      }
    } catch (error: any) {
      console.error('Failed to load reading levels:', error);
      setError('리딩 레벨을 불러오지 못했습니다.');
      
      // 오류 발생시에도 기본 데이터 제공
      setLevels([
        {
          level: 'beginner',
          description: LEVEL_DESCRIPTIONS.beginner,
          color: LEVEL_COLORS.beginner,
          totalQuestions: 20,
          availableQuestions: 20,
          completedQuestions: 0,
        },
        {
          level: 'intermediate',
          description: LEVEL_DESCRIPTIONS.intermediate,
          color: LEVEL_COLORS.intermediate,
          totalQuestions: 25,
          availableQuestions: 25,
          completedQuestions: 0,
        },
        {
          level: 'advanced',
          description: LEVEL_DESCRIPTIONS.advanced,
          color: LEVEL_COLORS.advanced,
          totalQuestions: 15,
          availableQuestions: 15,
          completedQuestions: 0,
        },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadReadingLevels();
  }, [loadReadingLevels]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadReadingLevels();
  }, [loadReadingLevels]);

  const handleLevelPress = (level: ReadingLevel) => {
    if (level.availableQuestions === 0) {
      Alert.alert(
        '문제 없음',
        '이 레벨에는 현재 사용 가능한 문제가 없습니다.',
        [{ text: '확인' }]
      );
      return;
    }

    navigation.navigate('Reading', { 
      level: level.level,
      levelName: level.level.charAt(0).toUpperCase() + level.level.slice(1)
    });
  };

  const renderLevelCard = ({ item: level }: { item: ReadingLevel }) => {
    const progressPercentage = level.totalQuestions > 0 
      ? (level.completedQuestions / level.totalQuestions) * 100 
      : 0;
    
    const isDisabled = level.availableQuestions === 0;

    return (
      <TouchableOpacity
        style={[
          styles.levelCard,
          { borderLeftColor: level.color },
          isDisabled && styles.levelCardDisabled
        ]}
        onPress={() => handleLevelPress(level)}
        activeOpacity={isDisabled ? 1 : 0.7}
      >
        <View style={styles.levelHeader}>
          <View style={styles.levelTitleContainer}>
            <Text style={[
              styles.levelTitle,
              { color: level.color },
              isDisabled && styles.textDisabled
            ]}>
              {level.level.charAt(0).toUpperCase() + level.level.slice(1)}
            </Text>
            <Text style={[
              styles.levelDescription,
              isDisabled && styles.textDisabled
            ]}>
              {level.description}
            </Text>
          </View>
          
          <View style={[
            styles.levelBadge,
            { backgroundColor: level.color },
            isDisabled && styles.levelBadgeDisabled
          ]}>
            <Text style={styles.levelBadgeText}>
              {level.availableQuestions}문제
            </Text>
          </View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressInfo}>
            <Text style={[
              styles.progressText,
              isDisabled && styles.textDisabled
            ]}>
              진행률: {level.completedQuestions} / {level.totalQuestions}
            </Text>
            <Text style={[
              styles.progressPercentage,
              isDisabled && styles.textDisabled
            ]}>
              {progressPercentage.toFixed(0)}%
            </Text>
          </View>
          
          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBar,
                { 
                  width: `${progressPercentage}%`,
                  backgroundColor: level.color 
                },
                isDisabled && styles.progressBarDisabled
              ]} 
            />
          </View>
        </View>

        <View style={styles.levelFooter}>
          <Text style={[
            styles.statusText,
            isDisabled && styles.textDisabled
          ]}>
            {isDisabled 
              ? '문제 준비 중...' 
              : level.completedQuestions === level.totalQuestions 
              ? '🎉 완료!' 
              : `📖 ${level.availableQuestions}개 문제 사용 가능`
            }
          </Text>
          
          {!isDisabled && (
            <Text style={styles.actionText}>
              시작하기 →
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader 
          title="📖 리딩 연습"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>리딩 레벨을 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader 
        title="📖 리딩 연습"
        onBack={() => navigation.goBack()}
      />
      
      <View style={styles.content}>
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                setError(null);
                setLoading(true);
                loadReadingLevels();
              }}
            >
              <Text style={styles.retryButtonText}>다시 시도</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.introSection}>
          <Text style={styles.introTitle}>읽기 실력을 향상시켜보세요! 📚</Text>
          <Text style={styles.introDescription}>
            수준별 지문을 읽고 이해도를 테스트해보세요. 
            각 레벨마다 다양한 주제의 지문이 준비되어 있습니다.
          </Text>
        </View>

        <FlatList
          data={levels}
          renderItem={renderLevelCard}
          keyExtractor={(item) => item.level}
          contentContainerStyle={styles.levelsList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#3b82f6']}
              tintColor="#3b82f6"
            />
          }
          showsVerticalScrollIndicator={false}
        />

        <View style={styles.tipSection}>
          <Text style={styles.tipTitle}>💡 학습 팁</Text>
          <Text style={styles.tipText}>
            • 먼저 지문을 천천히 읽어보세요{'\n'}
            • 모르는 단어가 있어도 전체 맥락을 파악해보세요{'\n'}
            • 문제를 풀고 해설을 꼼꼼히 읽어보세요
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    flex: 1,
  },
  retryButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  introSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  introDescription: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 24,
    textAlign: 'center',
  },
  levelsList: {
    paddingBottom: 16,
  },
  levelCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  levelCardDisabled: {
    backgroundColor: '#f9fafb',
    opacity: 0.6,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  levelTitleContainer: {
    flex: 1,
  },
  levelTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  levelDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  levelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 16,
  },
  levelBadgeDisabled: {
    backgroundColor: '#9ca3af',
  },
  levelBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  progressSection: {
    marginBottom: 16,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    color: '#374151',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  progressBarDisabled: {
    backgroundColor: '#d1d5db',
  },
  levelFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  actionText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
  textDisabled: {
    color: '#9ca3af',
  },
  tipSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginTop: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
});