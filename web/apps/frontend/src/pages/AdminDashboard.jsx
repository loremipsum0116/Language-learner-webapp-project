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

    // 운영자 권한 체크
    const isAdmin = user?.email === 'super@root.com';

    useEffect(() => {
        if (!isAdmin) return;
        loadDashboard();
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
            <h1 className="mb-4">🛠️ 관리자 대시보드</h1>
            
            {/* 시스템 통계 */}
            <div className="row mb-4">
                <div className="col-md-6 col-lg-3 mb-3">
                    <div className="card">
                        <div className="card-body text-center">
                            <h5 className="card-title">👥 사용자</h5>
                            <h2 className="text-primary">{dashboardData?.stats.userCount || 0}</h2>
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