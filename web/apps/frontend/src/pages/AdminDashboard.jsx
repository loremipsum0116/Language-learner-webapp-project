// src/pages/AdminDashboard.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchJSON, withCreds } from '../api/client';
import { toast } from 'react-toastify';

export default function AdminDashboard() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [dashboardData, setDashboardData] = useState(null);
    const [timeOffset, setTimeOffset] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pendingUsers, setPendingUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [reports, setReports] = useState([]);
    const [loadingReports, setLoadingReports] = useState(false);
    const [reportStats, setReportStats] = useState(null);

    // 운영자 권한 체크
    const isAdmin = user?.email === 'super@root.com';

    useEffect(() => {
        if (!isAdmin) return;
        loadDashboard();
        loadPendingUsers();
        loadReports();
    }, [isAdmin]);

    const loadDashboard = async () => {
        try {
            setLoading(true);
            const { data } = await fetchJSON('/admin/dashboard', withCreds());
            setDashboardData(data);
            setTimeOffset(data.timeMachine.dayOffset);
        } catch (error) {
            toast.error(`관리자 대시보드 로드 실패: ${error.message}`);
            console.error('Dashboard load error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTimeOffsetChange = async () => {
        try {
            setIsSubmitting(true);
            await fetchJSON('/time-machine/set', withCreds({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dayOffset: timeOffset })
            }));
            toast.success(`시간 오프셋이 ${timeOffset}일로 설정되었습니다.`);
            await loadDashboard();
        } catch (error) {
            toast.error(`시간 오프셋 설정 실패: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleTimeReset = async () => {
        if (!window.confirm('시간 오프셋을 리셋하시겠습니까? 모든 SRS 카드 타이머가 재계산됩니다.')) return;
        
        try {
            setIsSubmitting(true);
            await fetchJSON('/time-machine/reset', withCreds({
                method: 'POST'
            }));
            toast.success('시간 오프셋이 리셋되었습니다.');
            setTimeOffset(0);
            await loadDashboard();
        } catch (error) {
            toast.error(`시간 리셋 실패: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEmergencyFix = async () => {
        if (!window.confirm('모든 overdue 카드를 24시간으로 리셋하시겠습니까?')) return;
        
        try {
            setIsSubmitting(true);
            await fetchJSON('/time-machine/emergency-fix', withCreds({
                method: 'POST'
            }));
            toast.success('모든 overdue 카드가 24시간으로 리셋되었습니다.');
            await loadDashboard();
        } catch (error) {
            toast.error(`긴급 수정 실패: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCleanupData = async (type) => {
        if (!window.confirm(`${type} 데이터를 정리하시겠습니까?`)) return;
        
        try {
            setIsSubmitting(true);
            const { data } = await fetchJSON('/admin/cleanup-data', withCreds({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type })
            }));
            toast.success(data.message);
            await loadDashboard();
        } catch (error) {
            toast.error(`데이터 정리 실패: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const loadPendingUsers = async () => {
        try {
            setLoadingUsers(true);
            const { data } = await fetchJSON('/auth/admin/pending-users', withCreds());
            setPendingUsers(data.users);
        } catch (error) {
            toast.error(`승인 대기 사용자 로드 실패: ${error.message}`);
            console.error('Pending users load error:', error);
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleApproveUser = async (userId, email) => {
        if (!window.confirm(`${email} 사용자를 승인하시겠습니까?`)) return;

        try {
            setIsSubmitting(true);
            const { data } = await fetchJSON(`/auth/admin/approve-user/${userId}`, withCreds({
                method: 'POST'
            }));
            toast.success(data.message);
            await loadPendingUsers();
            await loadDashboard(); // 통계 업데이트
        } catch (error) {
            toast.error(`사용자 승인 실패: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRejectUser = async (userId, email) => {
        if (!window.confirm(`${email} 사용자를 거부하시겠습니까? 해당 계정은 삭제됩니다.`)) return;

        try {
            setIsSubmitting(true);
            const { data } = await fetchJSON(`/auth/admin/reject-user/${userId}`, withCreds({
                method: 'POST'
            }));
            toast.success(data.message);
            await loadPendingUsers();
            await loadDashboard(); // 통계 업데이트
        } catch (error) {
            toast.error(`사용자 거부 실패: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const loadReports = async () => {
        try {
            setLoadingReports(true);
            const response = await fetchJSON('/api/card-reports/admin/all?limit=10&status=PENDING', withCreds());
            console.log('Reports API response:', response); // 디버깅용

            // response가 data 필드를 가지고 있는지 확인
            const data = response.data || response;
            setReports(data.reports || []);
            setReportStats(data.statistics || null);
        } catch (error) {
            toast.error(`신고 목록 로드 실패: ${error.message}`);
            console.error('Reports load error:', error);
            // 오류 시 빈 배열로 초기화
            setReports([]);
            setReportStats(null);
        } finally {
            setLoadingReports(false);
        }
    };

    const handleUpdateReportStatus = async (reportId, newStatus, resolution = null) => {
        try {
            setIsSubmitting(true);
            const { data } = await fetchJSON(`/api/card-reports/admin/${reportId}/status`, withCreds({
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, resolution })
            }));
            toast.success(data.message);
            await loadReports();
        } catch (error) {
            toast.error(`신고 상태 업데이트 실패: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isAdmin) {
        return (
            <main className="container py-4">
                <div className="alert alert-danger">
                    <h4>접근 권한 없음</h4>
                    <p>이 페이지는 운영자(super@root.com)만 접근할 수 있습니다.</p>
                </div>
            </main>
        );
    }

    if (loading) {
        return (
            <main className="container py-4">
                <div className="text-center">
                    <div className="spinner-border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="container py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h1 className="mb-0">🛠️ 관리자 대시보드</h1>
                <a
                    href="/admin/super-dashboard"
                    className="btn btn-outline-primary"
                    title="고급 분석 및 유저별 학습 현황"
                >
                    <i className="bi bi-graph-up me-1"></i>Super Admin 대시보드
                </a>
            </div>
            
            {/* 시스템 통계 */}
            <div className="row mb-4">
                <div className="col-md-6 col-lg-3 mb-3">
                    <div className="card">
                        <div className="card-body text-center">
                            <h5 className="card-title">👥 사용자</h5>
                            <h2 className="text-primary">{dashboardData?.stats.userCount || 0}</h2>
                            {pendingUsers.length > 0 && (
                                <small className="text-warning">
                                    <strong>승인 대기: {pendingUsers.length}명</strong>
                                </small>
                            )}
                        </div>
                    </div>
                </div>
                <div className="col-md-6 col-lg-3 mb-3">
                    <div className="card">
                        <div className="card-body text-center">
                            <h5 className="card-title">📚 SRS 카드</h5>
                            <h2 className="text-success">{dashboardData?.stats.srsCardCount || 0}</h2>
                            <small className="text-muted">
                                활성 / 전체: {dashboardData?.stats.totalSrsCardCount || 0}
                            </small>
                        </div>
                    </div>
                </div>
                <div className="col-md-6 col-lg-3 mb-3">
                    <div className="card">
                        <div className="card-body text-center">
                            <h5 className="card-title">❌ 오답노트</h5>
                            <h2 className="text-warning">{dashboardData?.stats.wrongAnswerCount || 0}</h2>
                            <small className="text-muted">
                                복습가능 / 전체: {dashboardData?.stats.totalWrongAnswerCount || 0}
                            </small>
                        </div>
                    </div>
                </div>
                <div className="col-md-6 col-lg-3 mb-3">
                    <div className="card">
                        <div className="card-body text-center">
                            <h5 className="card-title">⚠️ Overdue</h5>
                            <h2 className="text-danger">{dashboardData?.stats.overdueCardCount || 0}</h2>
                        </div>
                    </div>
                </div>
            </div>

            {/* 신고 통계 */}
            {reportStats && (
                <div className="row mb-4">
                    <div className="col-md-6 col-lg-3 mb-3">
                        <div className="card">
                            <div className="card-body text-center">
                                <h5 className="card-title">🚨 총 신고</h5>
                                <h2 className="text-info">{reportStats.overview.total || 0}</h2>
                                <small className="text-muted">
                                    해결률: {reportStats.overview.resolutionRate || 0}%
                                </small>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-6 col-lg-3 mb-3">
                        <div className="card">
                            <div className="card-body text-center">
                                <h5 className="card-title">⏳ 대기중</h5>
                                <h2 className="text-warning">{reportStats.overview.pending || 0}</h2>
                                <small className="text-muted">처리 필요</small>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-6 col-lg-3 mb-3">
                        <div className="card">
                            <div className="card-body text-center">
                                <h5 className="card-title">✅ 해결됨</h5>
                                <h2 className="text-success">{reportStats.overview.resolved || 0}</h2>
                                <small className="text-muted">완료된 신고</small>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-6 col-lg-3 mb-3">
                        <div className="card">
                            <div className="card-body text-center">
                                <h5 className="card-title">📅 최근 7일</h5>
                                <h2 className="text-primary">{reportStats.trends.last7Days || 0}</h2>
                                <small className="text-muted">신규 신고</small>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 시간 가속 컨트롤러 */}
            <div className="card mb-4">
                <div className="card-header">
                    <h5 className="card-title mb-0">⏰ 시간 가속 컨트롤러</h5>
                </div>
                <div className="card-body">
                    {dashboardData?.timeMachine && (
                        <div className="row align-items-center">
                            <div className="col-md-6">
                                <div className="mb-3">
                                    <label className="form-label">현재 시간 오프셋 (일)</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        value={timeOffset}
                                        onChange={(e) => setTimeOffset(parseInt(e.target.value) || 0)}
                                        disabled={isSubmitting}
                                    />
                                    <div className="form-text">
                                        현재 시간: {new Date(dashboardData.timeMachine.originalTime).toLocaleString()}<br/>
                                        오프셋 시간: {new Date(dashboardData.timeMachine.offsetTime).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <div className="d-flex gap-2 flex-wrap">
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleTimeOffsetChange}
                                        disabled={isSubmitting}
                                    >
                                        시간 설정
                                    </button>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={handleTimeReset}
                                        disabled={isSubmitting}
                                    >
                                        리셋
                                    </button>
                                    <button
                                        className="btn btn-warning"
                                        onClick={handleEmergencyFix}
                                        disabled={isSubmitting}
                                    >
                                        긴급 수정
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 데이터 관리 */}
            <div className="card mb-4">
                <div className="card-header">
                    <h5 className="card-title mb-0">🗂️ 데이터 관리</h5>
                </div>
                <div className="card-body">
                    <div className="d-flex gap-2 flex-wrap">
                        <button
                            className="btn btn-outline-danger"
                            onClick={() => handleCleanupData('orphaned_wrong_answers')}
                            disabled={isSubmitting}
                        >
                            고아 오답노트 정리
                        </button>
                        <button
                            className="btn btn-outline-secondary"
                            onClick={() => handleCleanupData('old_sessions')}
                            disabled={isSubmitting}
                        >
                            오래된 세션 정리
                        </button>
                    </div>
                </div>
            </div>

            {/* 회원가입 승인 관리 */}
            <div className="card mb-4">
                <div className="card-header d-flex justify-content-between align-items-center">
                    <h5 className="card-title mb-0">👤 회원가입 승인 관리</h5>
                    <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={loadPendingUsers}
                        disabled={loadingUsers}
                    >
                        {loadingUsers ? '새로고침...' : '새로고침'}
                    </button>
                </div>
                <div className="card-body">
                    {loadingUsers ? (
                        <div className="text-center">
                            <div className="spinner-border spinner-border-sm" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    ) : pendingUsers.length > 0 ? (
                        <div className="table-responsive">
                            <table className="table table-hover">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>이메일</th>
                                        <th>신청일</th>
                                        <th>작업</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingUsers.map(pendingUser => (
                                        <tr key={pendingUser.id}>
                                            <td>{pendingUser.id}</td>
                                            <td>
                                                <strong>{pendingUser.email}</strong>
                                                <br/>
                                                <small className="text-muted">권한: {pendingUser.role}</small>
                                            </td>
                                            <td>
                                                {new Date(pendingUser.createdAt).toLocaleString('ko-KR')}
                                            </td>
                                            <td>
                                                <div className="btn-group" role="group">
                                                    <button
                                                        className="btn btn-sm btn-success"
                                                        onClick={() => handleApproveUser(pendingUser.id, pendingUser.email)}
                                                        disabled={isSubmitting}
                                                    >
                                                        ✓ 승인
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-danger"
                                                        onClick={() => handleRejectUser(pendingUser.id, pendingUser.email)}
                                                        disabled={isSubmitting}
                                                    >
                                                        ✗ 거부
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <div className="text-muted">
                                <i className="fa fa-check-circle fa-2x mb-3"></i>
                                <h6>승인 대기 중인 사용자가 없습니다</h6>
                                <p className="mb-0">모든 회원가입 신청이 처리되었습니다.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 신고 관리 */}
            <div className="card mb-4">
                <div className="card-header d-flex justify-content-between align-items-center">
                    <h5 className="card-title mb-0">🚨 신고 관리</h5>
                    <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={loadReports}
                        disabled={loadingReports}
                    >
                        {loadingReports ? '새로고침...' : '새로고침'}
                    </button>
                </div>
                <div className="card-body">
                    {loadingReports ? (
                        <div className="text-center">
                            <div className="spinner-border spinner-border-sm" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    ) : reports.length > 0 ? (
                        <div className="table-responsive">
                            <table className="table table-hover">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>단어</th>
                                        <th>신고 유형</th>
                                        <th>심각도</th>
                                        <th>빈도</th>
                                        <th>신고일</th>
                                        <th>작업</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reports.map(report => (
                                        <tr key={report.id}>
                                            <td>{report.id}</td>
                                            <td>
                                                <strong>{report.vocab?.lemma || report.metadata?.word || '알 수 없음'}</strong>
                                                <br />
                                                <small className="text-muted">
                                                    ID: {report.vocabId} |
                                                    {report.user?.email && ` 신고자: ${report.user.email}`}
                                                    {report.metadata?.meaning && <><br />뜻: {report.metadata.meaning}</>}
                                                    {report.metadata?.audioPath && <><br />음성: {report.metadata.audioPath}</>}
                                                </small>
                                            </td>
                                            <td>
                                                <span className={`badge ${
                                                    report.reportType === 'AUDIO_QUALITY' ? 'bg-danger' :
                                                    report.reportType === 'WRONG_TRANSLATION' ? 'bg-warning' :
                                                    'bg-secondary'
                                                }`}>
                                                    {report.reportType === 'AUDIO_QUALITY' ? '음성 문제' :
                                                     report.reportType === 'WRONG_TRANSLATION' ? '뜻 오류' :
                                                     report.reportType === 'OTHER' ? '기타' : report.reportType}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`badge ${
                                                    report.severity === 'HIGH' ? 'bg-danger' :
                                                    report.severity === 'MEDIUM' ? 'bg-warning' :
                                                    'bg-secondary'
                                                }`}>
                                                    {report.severity}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="badge bg-info">{report.frequency}회</span>
                                            </td>
                                            <td>
                                                {new Date(report.createdAt).toLocaleDateString('ko-KR')}
                                                <br />
                                                <small className="text-muted">
                                                    {new Date(report.createdAt).toLocaleTimeString('ko-KR')}
                                                </small>
                                            </td>
                                            <td>
                                                <div className="btn-group-vertical btn-group-sm" role="group">
                                                    <button
                                                        className="btn btn-sm btn-success mb-1"
                                                        onClick={() => handleUpdateReportStatus(report.id, 'RESOLVED', '관리자에 의해 해결됨')}
                                                        disabled={isSubmitting}
                                                    >
                                                        ✓ 해결
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-warning mb-1"
                                                        onClick={() => handleUpdateReportStatus(report.id, 'INVESTIGATING')}
                                                        disabled={isSubmitting}
                                                    >
                                                        🔍 조사중
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-secondary"
                                                        onClick={() => handleUpdateReportStatus(report.id, 'REJECTED', '유효하지 않은 신고')}
                                                        disabled={isSubmitting}
                                                    >
                                                        ✗ 거부
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <div className="text-muted">
                                <i className="fa fa-shield-alt fa-2x mb-3"></i>
                                <h6>처리할 신고가 없습니다</h6>
                                <p className="mb-0">모든 신고가 처리되었거나 신고가 없습니다.</p>
                            </div>
                        </div>
                    )}
                    {reports.length > 0 && (
                        <div className="mt-3 text-center">
                            <a href="/admin/reports" className="btn btn-outline-primary">
                                전체 신고 목록 보기 →
                            </a>
                        </div>
                    )}
                </div>
            </div>

            {/* 최근 사용자 */}
            <div className="card">
                <div className="card-header">
                    <h5 className="card-title mb-0">👥 최근 등록 사용자</h5>
                </div>
                <div className="card-body">
                    {dashboardData?.recentUsers?.length > 0 ? (
                        <div className="table-responsive">
                            <table className="table table-sm">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>이메일</th>
                                        <th>등록일</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dashboardData.recentUsers.map(user => (
                                        <tr key={user.id}>
                                            <td>{user.id}</td>
                                            <td>{user.email}</td>
                                            <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-muted">최근 등록된 사용자가 없습니다.</p>
                    )}
                </div>
            </div>
        </main>
    );
}