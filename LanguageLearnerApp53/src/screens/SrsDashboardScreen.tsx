// src/screens/SrsDashboardScreen.tsx
// SRS 대시보드 화면 (React Native 버전) - SrsDashboard.jsx 기능 구현

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../services/apiClient';
import { RootStackParamList } from '../types/navigation';
import { SrsDashboard, SrsFolder, SrsCard } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'SrsDashboard'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FolderCardProps {
  folder: SrsFolder;
  onPress: () => void;
  onStudyPress: () => void;
}

// Folder Card Component
const FolderCard: React.FC<FolderCardProps> = ({ folder, onPress, onStudyPress }) => {
  const dueCount = folder.dueCount || 0;
  const totalCount = folder.cardCount || 0;
  const hasCards = totalCount > 0;
  const hasDue = dueCount > 0;

  return (
    <TouchableOpacity style={styles.folderCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.folderHeader}>
        <View style={[styles.folderColorBar, { backgroundColor: folder.color || '#3b82f6' }]} />
        <View style={styles.folderInfo}>
          <Text style={styles.folderName}>{folder.name}</Text>
          {folder.description && (
            <Text style={styles.folderDescription}>{folder.description}</Text>
          )}
        </View>
      </View>
      
      <View style={styles.folderStats}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{totalCount}</Text>
          <Text style={styles.statLabel}>총 카드</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, hasDue && styles.statNumberDue]}>
            {dueCount}
          </Text>
          <Text style={styles.statLabel}>복습할 카드</Text>
        </View>
      </View>
      
      {hasCards && (
        <View style={styles.folderActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={onPress}
          >
            <Text style={styles.actionButtonSecondaryText}>관리</Text>
          </TouchableOpacity>
          {hasDue && (
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPrimary]}
              onPress={onStudyPress}
            >
              <Text style={styles.actionButtonText}>복습하기</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

// Stats Card Component
const StatsCard: React.FC<{ title: string; value: number; color?: string }> = ({
  title,
  value,
  color = '#3b82f6',
}) => (
  <View style={[styles.statsCard, { borderLeftColor: color }]}>
    <Text style={styles.statsTitle}>{title}</Text>
    <Text style={[styles.statsValue, { color }]}>{value}</Text>
  </View>
);

const SrsDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { user, srsIds, refreshSrsIds } = useAuth();
  
  // State
  const [dashboard, setDashboard] = useState<SrsDashboard | null>(null);
  const [folders, setFolders] = useState<SrsFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availableCards, setAvailableCards] = useState<SrsCard[]>([]);

  // Load dashboard data
  const loadDashboard = useCallback(async () => {
    try {
      const response = await apiClient.srs.getDashboard();
      const data = (response as any)?.data || response;
      setDashboard(data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    }
  }, []);

  // Load folders
  const loadFolders = useCallback(async () => {
    try {
      const response = await apiClient.srs.folders.getAll();
      const data = (response as any)?.data || response || [];
      setFolders(data);
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  }, []);

  // Load available cards
  const loadAvailableCards = useCallback(async () => {
    try {
      const response = await apiClient.srs.getAvailable();
      const data = (response as any)?.data || response || [];
      setAvailableCards(data);
    } catch (error) {
      console.error('Failed to load available cards:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadDashboard(),
      loadFolders(),
      loadAvailableCards(),
      refreshSrsIds(),
    ]);
    setLoading(false);
  };

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  // Handle folder press
  const handleFolderPress = (folder: SrsFolder) => {
    navigation.navigate('SrsFolder' as any, { folderId: folder.id });
  };

  // Handle study press
  const handleStudyPress = (folder: SrsFolder) => {
    navigation.navigate('Study', { folderId: folder.id });
  };

  // Handle start all overdue
  const handleStartAllOverdue = () => {
    if (availableCards.length === 0) {
      Alert.alert('알림', '복습할 카드가 없습니다.');
      return;
    }
    navigation.navigate('Study', { allOverdue: true });
  };

  // Render folder item
  const renderFolderItem = ({ item }: { item: SrsFolder }) => (
    <FolderCard
      folder={item}
      onPress={() => handleFolderPress(item)}
      onStudyPress={() => handleStudyPress(item)}
    />
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#3b82f6" style={styles.loader} />
      </SafeAreaView>
    );
  }

  const totalDue = dashboard?.totalDue || 0;
  const totalMastered = dashboard?.masteredCount || 0;
  const streakInfo = dashboard?.streakInfo;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>SRS 학습</Text>
          <Text style={styles.subtitle}>간격 반복 학습으로 완벽하게 외워보세요</Text>
        </View>

        {/* Stats Overview */}
        <View style={styles.statsContainer}>
          <StatsCard
            title="복습할 카드"
            value={totalDue}
            color={totalDue > 0 ? '#ef4444' : '#6b7280'}
          />
          <StatsCard
            title="마스터한 단어"
            value={totalMastered}
            color="#10b981"
          />
          {streakInfo && (
            <StatsCard
              title="연속 학습"
              value={streakInfo.currentStreak}
              color="#f59e0b"
            />
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>빠른 학습</Text>
          <TouchableOpacity
            style={[
              styles.quickActionButton,
              totalDue === 0 && styles.quickActionButtonDisabled,
            ]}
            onPress={handleStartAllOverdue}
            disabled={totalDue === 0}
          >
            <View style={styles.quickActionContent}>
              <Text style={styles.quickActionIcon}>🚀</Text>
              <View style={styles.quickActionText}>
                <Text style={styles.quickActionTitle}>모든 카드 복습하기</Text>
                <Text style={styles.quickActionSubtitle}>
                  {totalDue > 0 ? `${totalDue}개의 카드가 기다리고 있어요` : '복습할 카드가 없어요'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Streak Information */}
        {streakInfo && (
          <View style={styles.streakContainer}>
            <View style={styles.streakHeader}>
              <Text style={styles.sectionTitle}>학습 현황</Text>
              <Text style={styles.streakIcon}>🔥</Text>
            </View>
            <View style={styles.streakStats}>
              <View style={styles.streakStat}>
                <Text style={styles.streakStatNumber}>{streakInfo.currentStreak}</Text>
                <Text style={styles.streakStatLabel}>연속 학습일</Text>
              </View>
              <View style={styles.streakStat}>
                <Text style={styles.streakStatNumber}>{streakInfo.todayCount}</Text>
                <Text style={styles.streakStatLabel}>오늘 학습량</Text>
              </View>
              <View style={styles.streakStat}>
                <Text style={styles.streakStatNumber}>{streakInfo.dailyGoal}</Text>
                <Text style={styles.streakStatLabel}>목표량</Text>
              </View>
            </View>
            {streakInfo.dailyGoal > 0 && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(
                          (streakInfo.todayCount / streakInfo.dailyGoal) * 100,
                          100
                        )}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {Math.round((streakInfo.todayCount / streakInfo.dailyGoal) * 100)}% 달성
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Folders */}
        <View style={styles.foldersContainer}>
          <View style={styles.foldersHeader}>
            <Text style={styles.sectionTitle}>내 학습 폴더</Text>
            <TouchableOpacity
              style={styles.addFolderButton}
              onPress={() => navigation.navigate('CreateFolder' as any)}
            >
              <Text style={styles.addFolderButtonText}>+ 폴더 추가</Text>
            </TouchableOpacity>
          </View>
          
          {folders.length === 0 ? (
            <View style={styles.emptyFolders}>
              <Text style={styles.emptyFoldersIcon}>📁</Text>
              <Text style={styles.emptyFoldersText}>아직 학습 폴더가 없어요</Text>
              <Text style={styles.emptyFoldersSubtext}>
                첫 번째 폴더를 만들어 학습을 시작해보세요
              </Text>
              <TouchableOpacity
                style={styles.createFirstFolderButton}
                onPress={() => navigation.navigate('CreateFolder' as any)}
              >
                <Text style={styles.createFirstFolderButtonText}>첫 폴더 만들기</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={folders}
              renderItem={renderFolderItem}
              keyExtractor={item => item.id.toString()}
              scrollEnabled={false}
              contentContainerStyle={styles.foldersList}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  statsCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  statsTitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  statsValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  quickActions: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  quickActionButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  quickActionButtonDisabled: {
    opacity: 0.6,
  },
  quickActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  quickActionIcon: {
    fontSize: 32,
  },
  quickActionText: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  quickActionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  streakContainer: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  streakHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  streakIcon: {
    fontSize: 24,
  },
  streakStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  streakStat: {
    alignItems: 'center',
  },
  streakStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  streakStatLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#6b7280',
  },
  foldersContainer: {
    paddingHorizontal: 20,
  },
  foldersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addFolderButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
  },
  addFolderButtonText: {
    fontSize: 14,
    color: '#6b7280',
  },
  foldersList: {
    gap: 12,
  },
  folderCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  folderColorBar: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  folderDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  folderStats: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  statNumberDue: {
    color: '#ef4444',
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  folderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: '#3b82f6',
  },
  actionButtonSecondary: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  actionButtonSecondaryText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyFolders: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyFoldersIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyFoldersText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  emptyFoldersSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  createFirstFolderButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  createFirstFolderButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default SrsDashboardScreen;