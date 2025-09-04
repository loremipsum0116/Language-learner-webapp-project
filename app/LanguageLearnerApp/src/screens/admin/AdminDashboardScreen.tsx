/*
  AdminDashboardScreen.tsx — React Native 버전
  ------------------------------------------------------------
  웹 AdminDashboard.jsx를 모바일 앱에 맞게 리팩토링
*/

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import { AppHeader } from '../../components/common/AppHeader';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminDashboard'>;

interface DashboardData {
  stats: {
    userCount: number;
    srsCardCount: number;
    totalSrsCardCount: number;
    wrongAnswerCount: number;
    totalWrongAnswerCount: number;
    overdueCardCount: number;
  };
  timeMachine: {
    dayOffset: number;
    originalTime: string;
    offsetTime: string;
  };
  recentUsers: Array<{
    id: number;
    email: string;
    createdAt: string;
  }>;
}

export default function AdminDashboardScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [timeOffset, setTimeOffset] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 운영자 권한 체크
  const isAdmin = user?.email === 'super@root.com';

  const loadDashboard = useCallback(async () => {
    try {
      const response = await apiClient.get('/admin/dashboard');
      
      if (response.success && response.data) {
        setDashboardData(response.data);
        setTimeOffset(response.data.timeMachine?.dayOffset || 0);
      }
    } catch (error: any) {
      console.error('Dashboard load error:', error);
      Alert.alert('오류', `관리자 대시보드 로드 실패: ${error.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadDashboard();
  }, [isAdmin, loadDashboard]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboard();
  }, [loadDashboard]);

  const handleTimeOffsetChange = async () => {
    try {
      setIsSubmitting(true);
      
      await apiClient.post('/time-machine/set', {
        dayOffset: timeOffset
      });
      
      Alert.alert('성공', `시간 오프셋이 ${timeOffset}일로 설정되었습니다.`);
      await loadDashboard();
    } catch (error: any) {
      Alert.alert('오류', `시간 오프셋 설정 실패: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTimeReset = async () => {
    Alert.alert(
      '시간 리셋 확인',
      '시간 오프셋을 리셋하시겠습니까? 모든 SRS 카드 타이머가 재계산됩니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '확인',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSubmitting(true);
              
              await apiClient.post('/time-machine/reset');
              
              Alert.alert('성공', '시간 오프셋이 리셋되었습니다.');
              setTimeOffset(0);
              await loadDashboard();
            } catch (error: any) {
              Alert.alert('오류', `시간 리셋 실패: ${error.message}`);
            } finally {
              setIsSubmitting(false);
            }
          }
        }
      ]
    );
  };

  const handleEmergencyFix = async () => {
    Alert.alert(
      '긴급 수정 확인',
      '모든 overdue 카드를 24시간으로 리셋하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '확인',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSubmitting(true);
              
              await apiClient.post('/time-machine/emergency-fix');
              
              Alert.alert('성공', '모든 overdue 카드가 24시간으로 리셋되었습니다.');
              await loadDashboard();
            } catch (error: any) {
              Alert.alert('오류', `긴급 수정 실패: ${error.message}`);
            } finally {
              setIsSubmitting(false);
            }
          }
        }
      ]
    );
  };

  const handleCleanupData = async (type: string, label: string) => {
    Alert.alert(
      '데이터 정리 확인',
      `${label} 데이터를 정리하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '확인',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSubmitting(true);
              
              const response = await apiClient.post('/admin/cleanup-data', {
                type
              });
              
              if (response.success) {
                Alert.alert('성공', response.data.message);
                await loadDashboard();
              }
            } catch (error: any) {
              Alert.alert('오류', `데이터 정리 실패: ${error.message}`);
            } finally {
              setIsSubmitting(false);
            }
          }
        }
      ]
    );
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader 
          title="🛠️ 관리자 대시보드"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.accessDenied}>
          <Text style={styles.accessDeniedIcon}>🚫</Text>
          <Text style={styles.accessDeniedTitle}>접근 권한 없음</Text>
          <Text style={styles.accessDeniedText}>
            이 페이지는 운영자(super@root.com)만 접근할 수 있습니다.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader 
          title="🛠️ 관리자 대시보드"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>관리자 대시보드를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader 
        title="🛠️ 관리자 대시보드"
        onBack={() => navigation.goBack()}
      />
      
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#3b82f6']}
            tintColor="#3b82f6"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 시스템 통계 */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>시스템 통계</Text>
          
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, styles.statCardPrimary]}>
              <Text style={styles.statIcon}>👥</Text>
              <Text style={styles.statValue}>{dashboardData?.stats.userCount || 0}</Text>
              <Text style={styles.statLabel}>사용자</Text>
            </View>
            
            <View style={[styles.statCard, styles.statCardSuccess]}>
              <Text style={styles.statIcon}>📚</Text>
              <Text style={styles.statValue}>{dashboardData?.stats.srsCardCount || 0}</Text>
              <Text style={styles.statLabel}>SRS 카드</Text>
              <Text style={styles.statSubLabel}>
                활성 / 전체: {dashboardData?.stats.totalSrsCardCount || 0}
              </Text>
            </View>
            
            <View style={[styles.statCard, styles.statCardWarning]}>
              <Text style={styles.statIcon}>❌</Text>
              <Text style={styles.statValue}>{dashboardData?.stats.wrongAnswerCount || 0}</Text>
              <Text style={styles.statLabel}>오답노트</Text>
              <Text style={styles.statSubLabel}>
                복습가능 / 전체: {dashboardData?.stats.totalWrongAnswerCount || 0}
              </Text>
            </View>
            
            <View style={[styles.statCard, styles.statCardDanger]}>
              <Text style={styles.statIcon}>⚠️</Text>
              <Text style={styles.statValue}>{dashboardData?.stats.overdueCardCount || 0}</Text>
              <Text style={styles.statLabel}>Overdue</Text>
            </View>
          </View>
        </View>

        {/* 시간 가속 컨트롤러 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⏰ 시간 가속 컨트롤러</Text>
          
          {dashboardData?.timeMachine && (
            <View style={styles.timeControlCard}>
              <View style={styles.timeInputContainer}>
                <Text style={styles.inputLabel}>현재 시간 오프셋 (일)</Text>
                <TextInput
                  style={[
                    styles.timeInput,
                    isSubmitting && styles.timeInputDisabled
                  ]}
                  value={timeOffset.toString()}
                  onChangeText={(text) => setTimeOffset(parseInt(text) || 0)}
                  keyboardType="numeric"
                  editable={!isSubmitting}
                  placeholder="오프셋 값"
                />
                <View style={styles.timeInfo}>
                  <Text style={styles.timeInfoText}>
                    현재 시간: {new Date(dashboardData.timeMachine.originalTime).toLocaleString()}
                  </Text>
                  <Text style={styles.timeInfoText}>
                    오프셋 시간: {new Date(dashboardData.timeMachine.offsetTime).toLocaleString()}
                  </Text>
                </View>
              </View>
              
              <View style={styles.timeButtons}>
                <TouchableOpacity
                  style={[
                    styles.timeButton,
                    styles.timeButtonPrimary,
                    isSubmitting && styles.buttonDisabled
                  ]}
                  onPress={handleTimeOffsetChange}
                  disabled={isSubmitting}
                >
                  <Text style={styles.timeButtonText}>시간 설정</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.timeButton,
                    styles.timeButtonSecondary,
                    isSubmitting && styles.buttonDisabled
                  ]}
                  onPress={handleTimeReset}
                  disabled={isSubmitting}
                >
                  <Text style={[styles.timeButtonText, styles.timeButtonSecondaryText]}>리셋</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.timeButton,
                    styles.timeButtonWarning,
                    isSubmitting && styles.buttonDisabled
                  ]}
                  onPress={handleEmergencyFix}
                  disabled={isSubmitting}
                >
                  <Text style={styles.timeButtonText}>긴급 수정</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* 데이터 관리 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🗂️ 데이터 관리</Text>
          
          <View style={styles.dataManagementCard}>
            <View style={styles.dataButtons}>
              <TouchableOpacity
                style={[
                  styles.dataButton,
                  styles.dataButtonDanger,
                  isSubmitting && styles.buttonDisabled
                ]}
                onPress={() => handleCleanupData('orphaned_wrong_answers', '고아 오답노트')}
                disabled={isSubmitting}
              >
                <Text style={styles.dataButtonText}>고아 오답노트 정리</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.dataButton,
                  styles.dataButtonSecondary,
                  isSubmitting && styles.buttonDisabled
                ]}
                onPress={() => handleCleanupData('old_sessions', '오래된 세션')}
                disabled={isSubmitting}
              >
                <Text style={[styles.dataButtonText, styles.dataButtonSecondaryText]}>
                  오래된 세션 정리
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 최근 사용자 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👥 최근 등록 사용자</Text>
          
          <View style={styles.usersCard}>
            {dashboardData?.recentUsers?.length ? (
              <>
                <View style={styles.usersHeader}>
                  <Text style={[styles.usersHeaderText, styles.usersHeaderID]}>ID</Text>
                  <Text style={[styles.usersHeaderText, styles.usersHeaderEmail]}>이메일</Text>
                  <Text style={[styles.usersHeaderText, styles.usersHeaderDate]}>등록일</Text>
                </View>
                
                {dashboardData.recentUsers.map((user, index) => (
                  <View key={user.id} style={styles.userRow}>
                    <Text style={[styles.userRowText, styles.userRowID]}>{user.id}</Text>
                    <Text style={[styles.userRowText, styles.userRowEmail]}>{user.email}</Text>
                    <Text style={[styles.userRowText, styles.userRowDate]}>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                ))}
              </>
            ) : (
              <View style={styles.noUsers}>
                <Text style={styles.noUsersIcon}>👤</Text>
                <Text style={styles.noUsersText}>최근 등록된 사용자가 없습니다.</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
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
  scrollContent: {
    paddingBottom: 24,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  accessDeniedIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 12,
    textAlign: 'center',
  },
  accessDeniedText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
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
  statsContainer: {
    marginTop: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: '48%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statCardPrimary: {
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  statCardSuccess: {
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  statCardWarning: {
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  statCardDanger: {
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  statSubLabel: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  timeControlCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timeInputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  timeInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'white',
    color: '#1f2937',
  },
  timeInputDisabled: {
    backgroundColor: '#f9fafb',
    color: '#9ca3af',
  },
  timeInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  timeInfoText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  timeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  timeButtonPrimary: {
    backgroundColor: '#3b82f6',
  },
  timeButtonSecondary: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  timeButtonWarning: {
    backgroundColor: '#f59e0b',
  },
  timeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  timeButtonSecondaryText: {
    color: '#374151',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  dataManagementCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dataButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dataButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    minWidth: 120,
  },
  dataButtonDanger: {
    backgroundColor: '#dc2626',
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  dataButtonSecondary: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  dataButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'white',
  },
  dataButtonSecondaryText: {
    color: '#6b7280',
  },
  usersCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  usersHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 8,
  },
  usersHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  usersHeaderID: {
    width: 40,
  },
  usersHeaderEmail: {
    flex: 1,
    marginLeft: 12,
  },
  usersHeaderDate: {
    width: 80,
    textAlign: 'right',
  },
  userRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  userRowText: {
    fontSize: 14,
    color: '#6b7280',
  },
  userRowID: {
    width: 40,
    fontWeight: '500',
  },
  userRowEmail: {
    flex: 1,
    marginLeft: 12,
  },
  userRowDate: {
    width: 80,
    textAlign: 'right',
    fontSize: 12,
  },
  noUsers: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noUsersIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  noUsersText: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
  },
});