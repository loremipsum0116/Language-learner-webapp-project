/*
  SuperAdminDashboardScreen.tsx — React Native 버전
  ------------------------------------------------------------
  웹 SuperAdminDashboard.jsx를 모바일 앱에 맞게 리팩토링
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
  FlatList,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiClient } from '../../services/apiClient';
import { AppHeader } from '../../components/common/AppHeader';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SuperAdminDashboard'>;

interface DashboardData {
  totalUsers: number;
  activeUsers: number;
  pendingReports: number;
  totalCards: number;
  completionRate: number;
}

interface Report {
  id: number;
  vocab: {
    lemma: string;
    pos: string;
  };
  reportType: string;
  severity: string;
  frequency: number;
  status: string;
  createdAt: string;
}

interface UsersData {
  retention: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  averageSessionTime: number;
}

interface ContentQuality {
  audioQuality: {
    good: number;
    issues: number;
    missing: number;
  };
  translations: {
    verified: number;
    pending: number;
    reported: number;
  };
}

export default function SuperAdminDashboardScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<UsersData | null>(null);
  const [contentQuality, setContentQuality] = useState<ContentQuality | null>(null);

  const loadDashboardData = useCallback(async () => {
    try {
      const [dashboardRes, reportsRes, usersRes, qualityRes] = await Promise.all([
        apiClient.get('/admin/dashboard/overview'),
        apiClient.get('/cards/admin/all?limit=10&status=PENDING'),
        apiClient.get('/admin/users/analytics'),
        apiClient.get('/admin/content/quality-metrics')
      ]);

      if (dashboardRes.success) {
        setDashboardData(dashboardRes.data);
      }

      if (reportsRes.success) {
        setReports(reportsRes.data?.reports || []);
      }

      if (usersRes.success) {
        setUsers(usersRes.data);
      }

      if (qualityRes.success) {
        setContentQuality(qualityRes.data);
      }
    } catch (error: any) {
      console.error('Dashboard load error:', error);
      Alert.alert('오류', '대시보드 데이터 로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboardData();
  }, [loadDashboardData]);

  const handleReportAction = useCallback(async (reportId: number, action: string, resolution: string = '') => {
    const actionText = action === 'RESOLVED' ? '해결' : '거부';
    
    Alert.alert(
      `신고 ${actionText} 확인`,
      `이 신고를 ${actionText}하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '확인',
          onPress: async () => {
            try {
              const response = await apiClient.patch(`/cards/admin/${reportId}/status`, {
                status: action,
                resolution: resolution || `관리자에 의해 ${actionText}됨`
              });

              if (response.success) {
                Alert.alert('성공', `신고가 ${actionText}되었습니다.`);
                loadDashboardData(); // 데이터 새로고침
              }
            } catch (error: any) {
              console.error('Report action error:', error);
              Alert.alert('오류', error.message || '처리 중 오류가 발생했습니다.');
            }
          }
        }
      ]
    );
  }, [loadDashboardData]);

  const getReportTypeBadgeStyle = (type: string) => {
    const styles = {
      'AUDIO_QUALITY': { backgroundColor: '#f59e0b' },
      'WRONG_TRANSLATION': { backgroundColor: '#ef4444' },
      'INAPPROPRIATE': { backgroundColor: '#1f2937' },
      'MISSING_INFO': { backgroundColor: '#3b82f6' },
      'TECHNICAL_ISSUE': { backgroundColor: '#6b7280' },
      'OTHER': { backgroundColor: '#e5e7eb', color: '#1f2937' }
    };
    return styles[type as keyof typeof styles] || styles.OTHER;
  };

  const getReportTypeLabel = (type: string) => {
    const labels = {
      'AUDIO_QUALITY': '🔊 음성',
      'WRONG_TRANSLATION': '📝 번역',
      'INAPPROPRIATE': '⚠️ 부적절',
      'MISSING_INFO': '❓ 정보부족',
      'TECHNICAL_ISSUE': '🔧 기술',
      'OTHER': '💬 기타'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getSeverityBadgeStyle = (severity: string) => {
    const styles = {
      'LOW': { backgroundColor: '#10b981' },
      'MEDIUM': { backgroundColor: '#f59e0b' },
      'HIGH': { backgroundColor: '#ef4444' },
      'CRITICAL': { backgroundColor: '#1f2937' }
    };
    return styles[severity as keyof typeof styles] || { backgroundColor: '#6b7280' };
  };

  const renderReportItem = ({ item: report }: { item: Report }) => (
    <View style={styles.reportItem}>
      <View style={styles.reportHeader}>
        <View style={styles.reportVocab}>
          <Text style={styles.reportVocabWord}>{report.vocab.lemma}</Text>
          <Text style={styles.reportVocabPos}>{report.vocab.pos}</Text>
        </View>
        
        <View style={styles.reportBadges}>
          <View style={[styles.reportBadge, getReportTypeBadgeStyle(report.reportType)]}>
            <Text style={styles.reportBadgeText}>
              {getReportTypeLabel(report.reportType)}
            </Text>
          </View>
          
          <View style={[styles.reportBadge, getSeverityBadgeStyle(report.severity)]}>
            <Text style={styles.reportBadgeText}>{report.severity}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.reportDetails}>
        <Text style={styles.reportFrequency}>신고 빈도: {report.frequency}회</Text>
        <Text style={styles.reportDate}>
          {new Date(report.createdAt).toLocaleDateString('ko-KR')}
        </Text>
      </View>
      
      <View style={styles.reportActions}>
        <TouchableOpacity
          style={[styles.reportActionButton, styles.reportResolveButton]}
          onPress={() => handleReportAction(report.id, 'RESOLVED')}
          activeOpacity={0.8}
        >
          <Text style={styles.reportActionButtonText}>✅ 해결</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.reportActionButton, styles.reportRejectButton]}
          onPress={() => handleReportAction(report.id, 'REJECTED')}
          activeOpacity={0.8}
        >
          <Text style={styles.reportActionButtonText}>❌ 거부</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader 
          title="👑 Super Admin"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>대시보드를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader 
        title="👑 Super Admin Dashboard"
        onBack={() => navigation.goBack()}
        subtitle="super@root.com 전용 관리자 대시보드"
      />
      
      <View style={styles.content}>
        {/* 탭 네비게이션 */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.tabScrollView}
          contentContainerStyle={styles.tabContainer}
        >
          {[
            { id: 'overview', label: '📊 개요' },
            { id: 'reports', label: '🚨 신고 관리' },
            { id: 'content', label: '🎯 컨텐츠 품질' },
            { id: 'users', label: '👥 사용자 분석' },
            { id: 'system', label: '⚙️ 시스템' }
          ].map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabButton,
                activeTab === tab.id && styles.tabButtonActive
              ]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.tabButtonText,
                activeTab === tab.id && styles.tabButtonTextActive
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          style={styles.tabContent}
          contentContainerStyle={styles.tabScrollContent}
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
          {/* 개요 탭 */}
          {activeTab === 'overview' && (
            <View>
              <View style={styles.statsGrid}>
                <View style={[styles.statCard, styles.statCardPrimary]}>
                  <Text style={styles.statIcon}>👥</Text>
                  <Text style={styles.statValue}>{dashboardData?.totalUsers?.toLocaleString() || '0'}</Text>
                  <Text style={styles.statLabel}>전체 사용자</Text>
                </View>
                
                <View style={[styles.statCard, styles.statCardSuccess]}>
                  <Text style={styles.statIcon}>✅</Text>
                  <Text style={styles.statValue}>{dashboardData?.activeUsers || '0'}</Text>
                  <Text style={styles.statLabel}>활성 사용자 (7일)</Text>
                </View>
                
                <View style={[styles.statCard, styles.statCardWarning]}>
                  <Text style={styles.statIcon}>🚨</Text>
                  <Text style={styles.statValue}>{dashboardData?.pendingReports || '0'}</Text>
                  <Text style={styles.statLabel}>처리 대기 신고</Text>
                </View>
                
                <View style={[styles.statCard, styles.statCardInfo]}>
                  <Text style={styles.statIcon}>🗃️</Text>
                  <Text style={styles.statValue}>{dashboardData?.totalCards?.toLocaleString() || '0'}</Text>
                  <Text style={styles.statLabel}>전체 학습 카드</Text>
                </View>
              </View>

              <View style={styles.completionRateCard}>
                <Text style={styles.completionRateTitle}>🎯 학습 완료율</Text>
                <Text style={styles.completionRateValue}>
                  {dashboardData?.completionRate || 0}%
                </Text>
                <Text style={styles.completionRateLabel}>평균 학습 완료율</Text>
              </View>
            </View>
          )}

          {/* 신고 관리 탭 */}
          {activeTab === 'reports' && (
            <View>
              <Text style={styles.sectionTitle}>🚨 최근 신고 내역</Text>
              
              {reports.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>✅</Text>
                  <Text style={styles.emptyTitle}>처리 대기 중인 신고가 없습니다!</Text>
                </View>
              ) : (
                <FlatList
                  data={reports}
                  renderItem={renderReportItem}
                  keyExtractor={(item) => item.id.toString()}
                  contentContainerStyle={styles.reportsList}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>
          )}

          {/* 컨텐츠 품질 탭 */}
          {activeTab === 'content' && (
            <View>
              <View style={styles.qualityGrid}>
                <View style={styles.qualityCard}>
                  <Text style={styles.qualityCardTitle}>🎵 음성 품질 현황</Text>
                  <View style={styles.qualityStats}>
                    <View style={styles.qualityStat}>
                      <Text style={[styles.qualityStatValue, { color: '#10b981' }]}>
                        {contentQuality?.audioQuality?.good || '0'}
                      </Text>
                      <Text style={styles.qualityStatLabel}>양호</Text>
                    </View>
                    
                    <View style={styles.qualityStat}>
                      <Text style={[styles.qualityStatValue, { color: '#f59e0b' }]}>
                        {contentQuality?.audioQuality?.issues || '0'}
                      </Text>
                      <Text style={styles.qualityStatLabel}>문제</Text>
                    </View>
                    
                    <View style={styles.qualityStat}>
                      <Text style={[styles.qualityStatValue, { color: '#ef4444' }]}>
                        {contentQuality?.audioQuality?.missing || '0'}
                      </Text>
                      <Text style={styles.qualityStatLabel}>누락</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.qualityCard}>
                  <Text style={styles.qualityCardTitle}>📝 번역 품질 현황</Text>
                  <View style={styles.qualityStats}>
                    <View style={styles.qualityStat}>
                      <Text style={[styles.qualityStatValue, { color: '#10b981' }]}>
                        {contentQuality?.translations?.verified || '0'}
                      </Text>
                      <Text style={styles.qualityStatLabel}>검증됨</Text>
                    </View>
                    
                    <View style={styles.qualityStat}>
                      <Text style={[styles.qualityStatValue, { color: '#3b82f6' }]}>
                        {contentQuality?.translations?.pending || '0'}
                      </Text>
                      <Text style={styles.qualityStatLabel}>검토중</Text>
                    </View>
                    
                    <View style={styles.qualityStat}>
                      <Text style={[styles.qualityStatValue, { color: '#f59e0b' }]}>
                        {contentQuality?.translations?.reported || '0'}
                      </Text>
                      <Text style={styles.qualityStatLabel}>신고됨</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.aiQueueCard}>
                <Text style={styles.aiQueueTitle}>🤖 AI 컨텐츠 생성 큐</Text>
                <View style={styles.aiQueuePlaceholder}>
                  <Text style={styles.aiQueueIcon}>🤖</Text>
                  <Text style={styles.aiQueueText}>AI 컨텐츠 생성 시스템 구현 예정</Text>
                </View>
              </View>
            </View>
          )}

          {/* 사용자 분석 탭 */}
          {activeTab === 'users' && (
            <View>
              <Text style={styles.sectionTitle}>📊 사용자 통계</Text>
              
              <View style={styles.userStatsCard}>
                <View style={styles.userStatsGrid}>
                  <View style={styles.userStat}>
                    <Text style={[styles.userStatValue, { color: '#3b82f6' }]}>
                      {users?.retention?.daily || '0'}%
                    </Text>
                    <Text style={styles.userStatLabel}>일일 리텐션</Text>
                  </View>
                  
                  <View style={styles.userStat}>
                    <Text style={[styles.userStatValue, { color: '#10b981' }]}>
                      {users?.retention?.weekly || '0'}%
                    </Text>
                    <Text style={styles.userStatLabel}>주간 리텐션</Text>
                  </View>
                  
                  <View style={styles.userStat}>
                    <Text style={[styles.userStatValue, { color: '#3b82f6' }]}>
                      {users?.retention?.monthly || '0'}%
                    </Text>
                    <Text style={styles.userStatLabel}>월간 리텐션</Text>
                  </View>
                  
                  <View style={styles.userStat}>
                    <Text style={[styles.userStatValue, { color: '#f59e0b' }]}>
                      {users?.averageSessionTime || '0'}분
                    </Text>
                    <Text style={styles.userStatLabel}>평균 세션</Text>
                  </View>
                </View>
              </View>

              <View style={styles.languageCard}>
                <Text style={styles.languageCardTitle}>🌍 언어별 학습자</Text>
                <View style={styles.languagePlaceholder}>
                  <Text style={styles.languageIcon}>🌐</Text>
                  <Text style={styles.languageText}>언어별 통계 구현 예정</Text>
                </View>
              </View>
            </View>
          )}

          {/* 시스템 탭 */}
          {activeTab === 'system' && (
            <View>
              <View style={styles.systemGrid}>
                <View style={styles.systemCard}>
                  <Text style={styles.systemCardTitle}>⚡ 시스템 성능</Text>
                  <View style={styles.systemPlaceholder}>
                    <Text style={styles.systemIcon}>⚡</Text>
                    <Text style={styles.systemText}>시스템 모니터링 구현 예정</Text>
                  </View>
                </View>

                <View style={styles.systemCard}>
                  <Text style={styles.systemCardTitle}>🔒 보안 로그</Text>
                  <View style={styles.systemPlaceholder}>
                    <Text style={styles.systemIcon}>🔒</Text>
                    <Text style={styles.systemText}>보안 모니터링 구현 예정</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
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
  tabScrollView: {
    maxHeight: 60,
  },
  tabContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tabButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  tabButtonTextActive: {
    color: 'white',
  },
  tabContent: {
    flex: 1,
  },
  tabScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
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
    marginBottom: 20,
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
    borderTopWidth: 4,
    borderTopColor: '#3b82f6',
  },
  statCardSuccess: {
    borderTopWidth: 4,
    borderTopColor: '#10b981',
  },
  statCardWarning: {
    borderTopWidth: 4,
    borderTopColor: '#f59e0b',
  },
  statCardInfo: {
    borderTopWidth: 4,
    borderTopColor: '#06b6d4',
  },
  statIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  completionRateCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  completionRateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  completionRateValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: 8,
  },
  completionRateLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  emptyContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 48,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  reportsList: {
    gap: 12,
  },
  reportItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reportVocab: {
    flex: 1,
  },
  reportVocabWord: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  reportVocabPos: {
    fontSize: 12,
    color: '#6b7280',
  },
  reportBadges: {
    gap: 4,
  },
  reportBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignItems: 'center',
  },
  reportBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  reportDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  reportFrequency: {
    fontSize: 12,
    color: '#374151',
  },
  reportDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  reportActions: {
    flexDirection: 'row',
    gap: 8,
  },
  reportActionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  reportResolveButton: {
    backgroundColor: '#10b981',
  },
  reportRejectButton: {
    backgroundColor: '#ef4444',
  },
  reportActionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  qualityGrid: {
    gap: 16,
    marginBottom: 20,
  },
  qualityCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  qualityCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  qualityStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  qualityStat: {
    alignItems: 'center',
  },
  qualityStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  qualityStatLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  aiQueueCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  aiQueueTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  aiQueuePlaceholder: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  aiQueueIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  aiQueueText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  userStatsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  userStat: {
    alignItems: 'center',
    width: '45%',
  },
  userStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userStatLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  languageCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  languageCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  languagePlaceholder: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  languageIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  languageText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  systemGrid: {
    gap: 16,
  },
  systemCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  systemCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  systemPlaceholder: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  systemIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  systemText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});