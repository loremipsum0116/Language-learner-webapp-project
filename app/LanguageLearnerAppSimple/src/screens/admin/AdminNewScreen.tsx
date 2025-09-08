/*
  AdminNewScreen.tsx — React Native 버전
  ------------------------------------------------------------
  웹 AdminNew.jsx를 모바일 앱에 맞게 리팩토링
*/

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminNew'>;

interface SectionHeaderProps {
  title: string;
  desc?: string;
}

function SectionHeader({ title, desc }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {desc && <Text style={styles.sectionDesc}>{desc}</Text>
    </View>
  );
}

interface ValidationResults {
  summary: {
    criticalIssues: number;
    warnings: number;
    totalIssues: number;
  };
  vocab?: {
    totalItems: number;
    issues: Array<{ type: string; message: string }>;
  };
  grammar?: {
    exerciseCount: number;
    itemCount: number;
    issues: Array<{ type: string; message: string }>;
  };
  reading?: {
    totalItems: number;
    issues: Array<{ type: string; message: string }>;
  };
}

interface Reports {
  performance?: {
    vocab: {
      totalCards: number;
      avgCorrectRate: number;
      passedCards: number;
    };
    grammar: {
      totalCards: number;
      avgCorrectRate: number;
      passedCards: number;
    };
    topWrongVocab: Array<{
      lemma: string;
      pos: string;
      level: string;
      wrongCount: number;
    }>;
  };
  users?: {
    total: number;
    activeThisWeek: number;
    newThisWeek: number;
    avgStreak: number;
    topStreaks: Array<{
      email: string;
      streak: number;
    }>;
  };
}

interface LogEntry {
  timestamp: string;
  type: string;
  level: string;
  message: string;
  user?: string;
}

export default function AdminNewScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<'upload' | 'validate' | 'reports' | 'logs'>('upload');
  
  // super@root.com 계정인지 확인
  const isSuperAdmin = user?.email === 'super@root.com';
  
  // 업로드 탭 상태 (모바일에서는 파일 업로드를 단순화)
  const [uploading, setUploading] = useState<string | null>(null);
  
  // 검증 탭 상태
  const [validating, setValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationResults | null>(null);
  
  // 리포트 탭 상태
  const [loadingReports, setLoadingReports] = useState(false);
  const [reports, setReports] = useState<Reports | null>(null);
  
  // 로그 탭 상태
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // 검증 함수
  const handleValidation = async (type: string = 'all') => {
    setValidating(true);
    try {
      const response = await apiClient.post('/admin/validate', { type });
      
      setValidationResults(response.data.results);
      Alert.alert('완료', response.data.message);
      
    } catch (error: any) {
      console.error('Validation error:', error);
      console.error('Current user email:', user?.email);
      console.error('Is super admin:', isSuperAdmin);
      
      if (error.message?.includes('Unauthorized') || error.message?.includes('Admin access required')) {
        Alert.alert('오류', `관리자 권한 필요: super@root.com 계정으로 로그인하세요. 현재: ${user?.email}`);
      } else {
        Alert.alert('오류', `검증 실패: ${error.message}`);
      }
    } finally {
      setValidating(false);
    }
  };
  
  // 리포트 로드 함수
  const loadReports = async (type: string = 'all') => {
    setLoadingReports(true);
    try {
      const response = await apiClient.get(`/admin/reports?type=${type}`);
      setReports(response.data.reports);
      
    } catch (error: any) {
      console.error('Reports error:', error);
      Alert.alert('오류', `리포트 로드 실패: ${error.message}`);
    } finally {
      setLoadingReports(false);
    }
  };
  
  // 로그 로드 함수
  const loadLogs = async (type: string = '') => {
    setLoadingLogs(true);
    try {
      const response = await apiClient.get(`/admin/logs?type=${type}&limit=50`);
      setLogs(response.data.logs);
      
    } catch (error: any) {
      console.error('Logs error:', error);
      Alert.alert('오류', `로그 로드 실패: ${error.message}`);
    } finally {
      setLoadingLogs(false);
    }
  };
  
  // 탭 변경시 자동 로드
  React.useEffect(() => {
    if (tab === 'reports' && !reports) {
      loadReports();
    }
    if (tab === 'logs' && logs.length === 0) {
      loadLogs();
    }
  }, [tab]);

  const renderTabButton = (tabKey: string, label: string) => (
    <TouchableOpacity
      key={tabKey}
      style={[
        styles.tabButton,
        tab === tabKey && styles.tabButtonActive
      ]}
      onPress={() => setTab(tabKey as any)}
    >
      <Text style={[
        styles.tabButtonText,
        tab === tabKey && styles.tabButtonTextActive
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderLogItem = ({ item, index }: { item: LogEntry; index: number }) => (
    <View style={styles.logItem}>
      <View style={styles.logHeader}>
        <Text style={styles.logTime}>
          {new Date(item.timestamp).toLocaleString()}
        </Text>
        <View style={styles.logBadges}>
          <View style={[
            styles.logBadge,
            item.type === 'error' ? styles.logBadgeError : styles.logBadgeSecondary
          ]}>
            <Text style={styles.logBadgeText}>{item.type}</Text>
          </View>
          <View style={[
            styles.logBadge,
            item.level === 'ERROR' ? styles.logBadgeError :
            item.level === 'WARN' ? styles.logBadgeWarning : styles.logBadgeInfo
          ]}>
            <Text style={styles.logBadgeText}>{item.level}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.logMessage}>{item.message}</Text>
      {item.user && <Text style={styles.logUser}>사용자: {item.user}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* 운영자 전용 대시보드 링크 */}
        {isSuperAdmin && (
          <View style={styles.superAdminAlert}>
            <View style={styles.superAdminHeader}>
              <View>
                <Text style={styles.superAdminTitle}>🛠️ 운영자 권한 활성화</Text>
                <Text style={styles.superAdminDesc}>
                  시간 가속 컨트롤러와 고급 관리 기능에 접근할 수 있습니다.
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.dashboardButton}
                onPress={() => navigation.navigate('AdminDashboard' as any)}
              >
                <Text style={styles.dashboardButtonText}>운영자 대시보드</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>관리 콘솔</Text>
        </View>

        {/* 탭 버튼들 */}
        <View style={styles.tabContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.tabButtons}>
              {renderTabButton('upload', '업로드')}
              {renderTabButton('validate', '검증')}
              {renderTabButton('reports', '리포트')}
              {renderTabButton('logs', '로그')}
            </View>
          </ScrollView>
        </View>

        {/* 업로드 탭 */}
        {tab === 'upload' && (
          <View style={styles.tabContent}>
            <SectionHeader 
              title="콘텐츠 업로드" 
              desc="모바일 앱에서는 파일 업로드가 제한됩니다. 웹 버전을 이용해주세요." 
            />
            <View style={styles.uploadCard}>
              <Icon name="cloud-upload" size={48} color="#6b7280" />
              <Text style={styles.uploadTitle}>파일 업로드</Text>
              <Text style={styles.uploadDesc}>
                CSV(어휘), JSON(문법/리딩) 파일 업로드는 웹 브라우저에서 이용하실 수 있습니다.
              </Text>
            </View>
          </View>
        )}

        {/* 검증 탭 */}
        {tab === 'validate' && (
          <View style={styles.tabContent}>
            <SectionHeader 
              title="데이터 검증" 
              desc="필수 필드 누락, 중복 데이터, 잘못된 형식 등을 검사합니다." 
            />
            
            <View style={styles.validateButtons}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => handleValidation('all')}
                disabled={validating}
              >
                <Text style={styles.primaryButtonText}>
                  {validating ? '검증 중...' : '전체 검증'}
                </Text>
              </TouchableOpacity>
              
              <View style={styles.secondaryButtonRow}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => handleValidation('vocab')}
                  disabled={validating}
                >
                  <Text style={styles.secondaryButtonText}>어휘만 검증</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => handleValidation('grammar')}
                  disabled={validating}
                >
                  <Text style={styles.secondaryButtonText}>문법만 검증</Text>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => handleValidation('reading')}
                disabled={validating}
              >
                <Text style={styles.secondaryButtonText}>리딩만 검증</Text>
              </TouchableOpacity>
            </View>
            
            {validationResults && (
              <View style={styles.validationResults}>
                <View style={styles.validationSummary}>
                  <View style={styles.validationStat}>
                    <Text style={styles.validationStatNumber}>
                      {validationResults.summary.criticalIssues}
                    </Text>
                    <Text style={styles.validationStatLabel}>심각한 문제</Text>
                  </View>
                  <View style={styles.validationStat}>
                    <Text style={styles.validationStatNumber}>
                      {validationResults.summary.warnings}
                    </Text>
                    <Text style={styles.validationStatLabel}>경고</Text>
                  </View>
                  <View style={styles.validationStat}>
                    <Text style={styles.validationStatNumber}>
                      {validationResults.summary.totalIssues}
                    </Text>
                    <Text style={styles.validationStatLabel}>총 이슈</Text>
                  </View>
                </View>
                
                {validationResults.vocab && (
                  <View style={styles.validationSection}>
                    <Text style={styles.validationSectionTitle}>
                      어휘 검증 결과 ({validationResults.vocab.totalItems}개 항목)
                    </Text>
                    {validationResults.vocab.issues.length > 0 ? (
                      <View>
                        {validationResults.vocab.issues.slice(0, 5).map((issue, i) => (
                          <Text
                            key={i}
                            style={[
                              styles.validationIssue,
                              issue.type === 'critical' ? styles.validationIssueCritical : styles.validationIssueWarning
                            ]}
                          >
                            • {issue.message}
                          </Text>
                        ))}
                        {validationResults.vocab.issues.length > 5 && (
                          <Text style={styles.validationMore}>
                            ...그리고 {validationResults.vocab.issues.length - 5}개 더
                          </Text>
                        )}
                      </View>
                    ) : (
                      <Text style={styles.validationSuccess}>✓ 문제 없음</Text>
                    )}
                  </View>
                )}
              </View>
            )}
            
            {validating && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>검증 중...</Text>
              </View>
            )}
          </View>
        )}

        {/* 리포트 탭 */}
        {tab === 'reports' && (
          <View style={styles.tabContent}>
            <SectionHeader 
              title="리포트" 
              desc="시스템 성능 지표, 사용자 활동 통계를 확인합니다." 
            />
            
            <View style={styles.reportButtons}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => loadReports('all')}
                disabled={loadingReports}
              >
                <Text style={styles.primaryButtonText}>
                  {loadingReports ? '로딩 중...' : '전체 리포트'}
                </Text>
              </TouchableOpacity>
              
              <View style={styles.secondaryButtonRow}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => loadReports('performance')}
                  disabled={loadingReports}
                >
                  <Text style={styles.secondaryButtonText}>성능 리포트</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => loadReports('users')}
                  disabled={loadingReports}
                >
                  <Text style={styles.secondaryButtonText}>사용자 리포트</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {reports && (
              <View style={styles.reportsContainer}>
                {reports.performance && (
                  <>
                    <View style={styles.reportCard}>
                      <Text style={styles.reportCardTitle}>어휘 성능</Text>
                      <Text style={styles.reportItem}>총 카드: {reports.performance.vocab.totalCards}개</Text>
                      <Text style={styles.reportItem}>평균 정답률: {reports.performance.vocab.avgCorrectRate.toFixed(1)}%</Text>
                      <Text style={styles.reportItem}>통과 카드: {reports.performance.vocab.passedCards}개</Text>
                    </View>
                    
                    <View style={styles.reportCard}>
                      <Text style={styles.reportCardTitle}>문법 성능</Text>
                      <Text style={styles.reportItem}>총 카드: {reports.performance.grammar.totalCards}개</Text>
                      <Text style={styles.reportItem}>평균 정답률: {reports.performance.grammar.avgCorrectRate.toFixed(1)}%</Text>
                      <Text style={styles.reportItem}>통과 카드: {reports.performance.grammar.passedCards}개</Text>
                    </View>
                  </>
                )}
                
                {reports.users && (
                  <View style={styles.reportCard}>
                    <Text style={styles.reportCardTitle}>사용자 통계</Text>
                    <View style={styles.userStatsRow}>
                      <View style={styles.userStat}>
                        <Text style={styles.userStatNumber}>{reports.users.total}</Text>
                        <Text style={styles.userStatLabel}>총 사용자</Text>
                      </View>
                      <View style={styles.userStat}>
                        <Text style={styles.userStatNumber}>{reports.users.activeThisWeek}</Text>
                        <Text style={styles.userStatLabel}>주간 활성</Text>
                      </View>
                      <View style={styles.userStat}>
                        <Text style={styles.userStatNumber}>{reports.users.newThisWeek}</Text>
                        <Text style={styles.userStatLabel}>주간 신규</Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )}
            
            {loadingReports && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>리포트 로딩 중...</Text>
              </View>
            )}
          </View>
        )}

        {/* 로그 탭 */}
        {tab === 'logs' && (
          <View style={styles.tabContent}>
            <SectionHeader 
              title="로그" 
              desc="시스템 활동, 사용자 활동 로그를 확인합니다." 
            />
            
            <View style={styles.logButtons}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => loadLogs('')}
                disabled={loadingLogs}
              >
                <Text style={styles.primaryButtonText}>
                  {loadingLogs ? '로딩 중...' : '전체 로그'}
                </Text>
              </TouchableOpacity>
              
              <View style={styles.secondaryButtonRow}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => loadLogs('user_activity')}
                  disabled={loadingLogs}
                >
                  <Text style={styles.secondaryButtonText}>사용자 활동</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => loadLogs('errors')}
                  disabled={loadingLogs}
                >
                  <Text style={styles.secondaryButtonText}>에러 로그</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.logsContainer}>
              {logs.length > 0 ? (
                <FlatList
                  data={logs}
                  renderItem={renderLogItem}
                  keyExtractor={(item, index) => index.toString()}
                  style={styles.logsList}
                  showsVerticalScrollIndicator={false}
                />
              ) : (
                <Text style={styles.noDataText}>로그가 여기에 표시됩니다.</Text>
              )}
            </View>
            
            {loadingLogs && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>로그 로딩 중...</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  superAdminAlert: {
    backgroundColor: '#d1ecf1',
    borderColor: '#bee5eb',
    borderWidth: 1,
    borderRadius: 8,
    margin: 16,
    padding: 16,
  },
  superAdminHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  superAdminTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0c5460',
    marginBottom: 4,
  },
  superAdminDesc: {
    fontSize: 14,
    color: '#0c5460',
  },
  dashboardButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  dashboardButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  header: {
    padding: 16,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  tabContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tabButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  tabButtonActive: {
    backgroundColor: '#007AFF',
  },
  tabButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  tabButtonTextActive: {
    color: 'white',
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 14,
    color: '#666',
  },
  tabContent: {
    padding: 16,
  },
  uploadCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  uploadDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  validateButtons: {
    gap: 12,
  },
  reportButtons: {
    gap: 12,
  },
  logButtons: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'white',
    borderColor: '#007AFF',
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  validationResults: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  validationSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  validationStat: {
    alignItems: 'center',
  },
  validationStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc3545',
  },
  validationStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  validationSection: {
    marginBottom: 16,
  },
  validationSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  validationIssue: {
    fontSize: 14,
    marginBottom: 4,
  },
  validationIssueCritical: {
    color: '#dc3545',
  },
  validationIssueWarning: {
    color: '#f59e0b',
  },
  validationMore: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  validationSuccess: {
    fontSize: 14,
    color: '#198754',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  reportsContainer: {
    marginTop: 16,
    gap: 16,
  },
  reportCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reportCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  reportItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  userStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  userStat: {
    alignItems: 'center',
  },
  userStatNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  userStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  logsContainer: {
    marginTop: 16,
  },
  logsList: {
    backgroundColor: 'white',
    borderRadius: 12,
    maxHeight: 400,
  },
  logItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logTime: {
    fontSize: 12,
    color: '#666',
  },
  logBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  logBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  logBadgeError: {
    backgroundColor: '#dc3545',
  },
  logBadgeWarning: {
    backgroundColor: '#f59e0b',
  },
  logBadgeInfo: {
    backgroundColor: '#17a2b8',
  },
  logBadgeSecondary: {
    backgroundColor: '#6c757d',
  },
  logBadgeText: {
    fontSize: 10,
    color: 'white',
    fontWeight: 'bold',
  },
  logMessage: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  logUser: {
    fontSize: 12,
    color: '#666',
  },
  noDataText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    paddingVertical: 32,
  },
});