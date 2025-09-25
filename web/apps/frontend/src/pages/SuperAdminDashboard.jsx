import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import UserLearningAnalytics from '../components/UserLearningAnalytics';

const SuperAdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [contentQuality, setContentQuality] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [dashboardRes, reportsRes, usersRes, qualityRes] = await Promise.all([
        fetch('/api/admin/dashboard/overview', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
        }),
        fetch('/api/card-reports/admin/all?limit=10&status=PENDING', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
        }),
        fetch('/api/admin/users/analytics', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
        }),
        fetch('/api/admin/content/quality-metrics', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
        })
      ]);

      const dashboard = await dashboardRes.json();
      const reportsData = await reportsRes.json();
      const usersData = await usersRes.json();
      const qualityData = await qualityRes.json();

      setDashboardData(dashboard);
      // cardReports API 응답 구조에 맞춰 수정
      setReports(reportsData.data?.reports || []);
      setUsers(usersData);
      setContentQuality(qualityData);
    } catch (error) {
      console.error('Dashboard load error:', error);
      toast.error('대시보드 데이터 로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleReportAction = async (reportId, action, resolution = '') => {
    try {
      const response = await fetch(`/api/card-reports/admin/${reportId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          status: action,
          resolution: resolution
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message || `신고가 ${action === 'RESOLVED' ? '해결' : '거부'}되었습니다.`);
        loadDashboardData(); // 데이터 새로고침
      } else {
        let errorMessage = '처리 중 오류가 발생했습니다.';
        try {
          const error = await response.json();
          errorMessage = error.message || error.error || errorMessage;
        } catch (parseError) {
          console.error('Error parsing response:', parseError);
          errorMessage = `HTTP ${response.status} ${response.statusText}`;
        }
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Report action error:', error);
      toast.error('네트워크 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="container-fluid py-4">
        <div className="d-flex justify-content-center">
          <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">로딩 중...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      {/* 헤더 */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-0">👑 Super Admin Dashboard</h1>
          <p className="text-muted mb-0">super@root.com 전용 관리자 대시보드</p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-primary" onClick={loadDashboardData}>
            <i className="bi bi-arrow-clockwise me-1"></i> 새로고침
          </button>
          <button className="btn btn-primary">
            <i className="bi bi-download me-1"></i> 리포트 내보내기
          </button>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <ul className="nav nav-pills mb-4" role="tablist">
        {[
          { id: 'overview', label: '📊 개요', icon: 'bi-bar-chart' },
          { id: 'reports', label: '🚨 신고 관리', icon: 'bi-flag' },
          { id: 'content', label: '🎯 컨텐츠 품질', icon: 'bi-clipboard-check' },
          { id: 'users', label: '👥 사용자 분석', icon: 'bi-people' },
          { id: 'learning', label: '📚 학습 현황', icon: 'bi-book' },
          { id: 'system', label: '⚙️ 시스템', icon: 'bi-gear' }
        ].map(tab => (
          <li key={tab.id} className="nav-item">
            <button
              className={`nav-link ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <i className={`${tab.icon} me-1`}></i>
              {tab.label}
            </button>
          </li>
        ))}
      </ul>

      {/* 탭 컨텐츠 */}
      <div className="tab-content">
        
        {/* 개요 탭 */}
        {activeTab === 'overview' && (
          <div className="tab-pane fade show active">
            <div className="row g-4 mb-4">
              <div className="col-xl-3 col-md-6">
                <div className="card bg-primary text-white h-100">
                  <div className="card-body">
                    <div className="d-flex justify-content-between">
                      <div>
                        <div className="h4 mb-0">{dashboardData?.totalUsers?.toLocaleString() || '0'}</div>
                        <div className="small">전체 사용자</div>
                      </div>
                      <div className="h2 mb-0">👥</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="col-xl-3 col-md-6">
                <div className="card bg-success text-white h-100">
                  <div className="card-body">
                    <div className="d-flex justify-content-between">
                      <div>
                        <div className="h4 mb-0">{dashboardData?.activeUsers || '0'}</div>
                        <div className="small">활성 사용자 (7일)</div>
                      </div>
                      <div className="h2 mb-0">✅</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-xl-3 col-md-6">
                <div className="card bg-warning text-white h-100">
                  <div className="card-body">
                    <div className="d-flex justify-content-between">
                      <div>
                        <div className="h4 mb-0">{dashboardData?.pendingReports || '0'}</div>
                        <div className="small">처리 대기 신고</div>
                      </div>
                      <div className="h2 mb-0">🚨</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-xl-3 col-md-6">
                <div className="card bg-info text-white h-100">
                  <div className="card-body">
                    <div className="d-flex justify-content-between">
                      <div>
                        <div className="h4 mb-0">{dashboardData?.totalCards?.toLocaleString() || '0'}</div>
                        <div className="small">전체 학습 카드</div>
                      </div>
                      <div className="h2 mb-0">🗃️</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 차트 섹션 */}
            <div className="row g-4">
              <div className="col-xl-8">
                <div className="card">
                  <div className="card-header">
                    <h5 className="card-title mb-0">📈 사용자 증가 추이</h5>
                  </div>
                  <div className="card-body">
                    <div className="text-center py-5 text-muted">
                      <i className="bi bi-graph-up fs-1"></i>
                      <p className="mt-2">차트 컴포넌트 구현 예정</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-xl-4">
                <div className="card h-100">
                  <div className="card-header">
                    <h5 className="card-title mb-0">🎯 학습 완료율</h5>
                  </div>
                  <div className="card-body">
                    <div className="text-center">
                      <div className="display-4 text-success mb-2">
                        {dashboardData?.completionRate || '0'}%
                      </div>
                      <p className="text-muted">평균 학습 완료율</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 신고 관리 탭 */}
        {activeTab === 'reports' && (
          <div className="tab-pane fade show active">
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">🚨 최근 신고 내역</h5>
                <div className="d-flex gap-2">
                  <select className="form-select form-select-sm">
                    <option value="">전체 유형</option>
                    <option value="AUDIO_QUALITY">음성 품질</option>
                    <option value="WRONG_TRANSLATION">번역 오류</option>
                    <option value="INAPPROPRIATE">부적절한 내용</option>
                  </select>
                  <select className="form-select form-select-sm">
                    <option value="">전체 심각도</option>
                    <option value="CRITICAL">긴급</option>
                    <option value="HIGH">높음</option>
                    <option value="MEDIUM">보통</option>
                    <option value="LOW">낮음</option>
                  </select>
                </div>
              </div>
              
              <div className="card-body p-0">
                {reports.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <i className="bi bi-check-circle fs-1"></i>
                    <p className="mt-2">처리 대기 중인 신고가 없습니다!</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>카드</th>
                          <th>유형</th>
                          <th>심각도</th>
                          <th>빈도</th>
                          <th>신고일</th>
                          <th>상태</th>
                          <th>액션</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reports.map(report => (
                          <tr key={report.id}>
                            <td>
                              <div>
                                <strong>{report.vocab.lemma}</strong>
                                <div className="small text-muted">{report.vocab.pos}</div>
                              </div>
                            </td>
                            <td>
                              <span className={`badge ${getReportTypeBadgeClass(report.reportType)}`}>
                                {getReportTypeLabel(report.reportType)}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${getSeverityBadgeClass(report.severity)}`}>
                                {report.severity}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${report.frequency > 5 ? 'bg-danger' : report.frequency > 2 ? 'bg-warning' : 'bg-secondary'}`}>
                                {report.frequency}회
                              </span>
                            </td>
                            <td className="small">
                              {new Date(report.createdAt).toLocaleDateString('ko-KR')}
                            </td>
                            <td>
                              <span className={`badge ${getStatusBadgeClass(report.status)}`}>
                                {report.status}
                              </span>
                            </td>
                            <td>
                              <div className="d-flex gap-1">
                                <button 
                                  className="btn btn-success btn-sm"
                                  onClick={() => handleReportAction(report.id, 'RESOLVED', '관리자에 의해 해결됨')}
                                  title="해결됨으로 표시"
                                >
                                  <i className="bi bi-check"></i>
                                </button>
                                <button 
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleReportAction(report.id, 'REJECTED', '유효하지 않은 신고')}
                                  title="거부"
                                >
                                  <i className="bi bi-x"></i>
                                </button>
                                <button 
                                  className="btn btn-outline-secondary btn-sm"
                                  title="상세보기"
                                >
                                  <i className="bi bi-eye"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 컨텐츠 품질 탭 */}
        {activeTab === 'content' && (
          <div className="tab-pane fade show active">
            <div className="row g-4">
              <div className="col-md-6">
                <div className="card">
                  <div className="card-header">
                    <h5 className="card-title mb-0">🎵 음성 품질 현황</h5>
                  </div>
                  <div className="card-body">
                    <div className="row text-center">
                      <div className="col-4">
                        <div className="h4 text-success">{contentQuality?.audioQuality?.good || '0'}</div>
                        <div className="small text-muted">양호</div>
                      </div>
                      <div className="col-4">
                        <div className="h4 text-warning">{contentQuality?.audioQuality?.issues || '0'}</div>
                        <div className="small text-muted">문제</div>
                      </div>
                      <div className="col-4">
                        <div className="h4 text-danger">{contentQuality?.audioQuality?.missing || '0'}</div>
                        <div className="small text-muted">누락</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div className="card">
                  <div className="card-header">
                    <h5 className="card-title mb-0">📝 번역 품질 현황</h5>
                  </div>
                  <div className="card-body">
                    <div className="row text-center">
                      <div className="col-4">
                        <div className="h4 text-success">{contentQuality?.translations?.verified || '0'}</div>
                        <div className="small text-muted">검증됨</div>
                      </div>
                      <div className="col-4">
                        <div className="h4 text-info">{contentQuality?.translations?.pending || '0'}</div>
                        <div className="small text-muted">검토중</div>
                      </div>
                      <div className="col-4">
                        <div className="h4 text-warning">{contentQuality?.translations?.reported || '0'}</div>
                        <div className="small text-muted">신고됨</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card mt-4">
              <div className="card-header">
                <h5 className="card-title mb-0">🤖 AI 컨텐츠 생성 큐</h5>
              </div>
              <div className="card-body">
                <div className="text-center py-4 text-muted">
                  <i className="bi bi-robot fs-1"></i>
                  <p className="mt-2">AI 컨텐츠 생성 시스템 구현 예정</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 사용자 분석 탭 */}
        {activeTab === 'users' && (
          <div className="tab-pane fade show active">
            <div className="row g-4">
              <div className="col-xl-8">
                <div className="card">
                  <div className="card-header">
                    <h5 className="card-title mb-0">📊 사용자 통계</h5>
                  </div>
                  <div className="card-body">
                    <div className="row g-3">
                      <div className="col-md-3 text-center">
                        <div className="h3 text-primary">{users?.retention?.daily || '0'}%</div>
                        <div className="small text-muted">일일 리텐션</div>
                      </div>
                      <div className="col-md-3 text-center">
                        <div className="h3 text-success">{users?.retention?.weekly || '0'}%</div>
                        <div className="small text-muted">주간 리텐션</div>
                      </div>
                      <div className="col-md-3 text-center">
                        <div className="h3 text-info">{users?.retention?.monthly || '0'}%</div>
                        <div className="small text-muted">월간 리텐션</div>
                      </div>
                      <div className="col-md-3 text-center">
                        <div className="h3 text-warning">{users?.averageSessionTime || '0'}분</div>
                        <div className="small text-muted">평균 세션</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-xl-4">
                <div className="card h-100">
                  <div className="card-header">
                    <h5 className="card-title mb-0">🌍 언어별 학습자</h5>
                  </div>
                  <div className="card-body">
                    <div className="text-center py-4 text-muted">
                      <i className="bi bi-translate fs-1"></i>
                      <p className="mt-2">언어별 통계 구현 예정</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 학습 현황 탭 */}
        {activeTab === 'learning' && (
          <div className="tab-pane fade show active">
            <div style={{ border: '1px solid red', padding: '10px', margin: '10px' }}>
              <h5>학습 현황 탭 렌더링됨 (activeTab: {activeTab})</h5>
              <UserLearningAnalytics />
            </div>
          </div>
        )}

        {/* 시스템 탭 */}
        {activeTab === 'system' && (
          <div className="tab-pane fade show active">
            <div className="row g-4">
              <div className="col-md-6">
                <div className="card">
                  <div className="card-header">
                    <h5 className="card-title mb-0">⚡ 시스템 성능</h5>
                  </div>
                  <div className="card-body">
                    <div className="text-center py-4 text-muted">
                      <i className="bi bi-speedometer2 fs-1"></i>
                      <p className="mt-2">시스템 모니터링 구현 예정</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div className="card">
                  <div className="card-header">
                    <h5 className="card-title mb-0">🔒 보안 로그</h5>
                  </div>
                  <div className="card-body">
                    <div className="text-center py-4 text-muted">
                      <i className="bi bi-shield-check fs-1"></i>
                      <p className="mt-2">보안 모니터링 구현 예정</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 유틸리티 함수들
const getReportTypeBadgeClass = (type) => {
  const classes = {
    'AUDIO_QUALITY': 'bg-warning',
    'WRONG_TRANSLATION': 'bg-danger',
    'INAPPROPRIATE': 'bg-dark',
    'MISSING_INFO': 'bg-info',
    'TECHNICAL_ISSUE': 'bg-secondary',
    'OTHER': 'bg-light text-dark'
  };
  return classes[type] || 'bg-secondary';
};

const getReportTypeLabel = (type) => {
  const labels = {
    'AUDIO_QUALITY': '🔊 음성',
    'WRONG_TRANSLATION': '📝 번역',
    'INAPPROPRIATE': '⚠️ 부적절',
    'MISSING_INFO': '❓ 정보부족',
    'TECHNICAL_ISSUE': '🔧 기술',
    'OTHER': '💬 기타'
  };
  return labels[type] || type;
};

const getSeverityBadgeClass = (severity) => {
  const classes = {
    'LOW': 'bg-success',
    'MEDIUM': 'bg-warning',
    'HIGH': 'bg-danger',
    'CRITICAL': 'bg-dark'
  };
  return classes[severity] || 'bg-secondary';
};

const getStatusBadgeClass = (status) => {
  const classes = {
    'PENDING': 'bg-warning',
    'INVESTIGATING': 'bg-info',
    'RESOLVED': 'bg-success',
    'REJECTED': 'bg-secondary'
  };
  return classes[status] || 'bg-secondary';
};

export default SuperAdminDashboard;