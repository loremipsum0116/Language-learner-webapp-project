import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { API_BASE } from '../api/client';

const UserLearningAnalytics = () => {
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userDetail, setUserDetail] = useState(null);
    const [pagination, setPagination] = useState({});
    const [apiError, setApiError] = useState(false);
    const [filters, setFilters] = useState({
        sortBy: 'recent',
        dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        dateTo: new Date().toISOString().split('T')[0]
    });

    // 사용자 목록 로드
    const loadUsers = async (page = 1) => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
                sortBy: filters.sortBy,
                dateFrom: filters.dateFrom,
                dateTo: filters.dateTo
            });

            const url = `/api/admin/users/learning-analytics?${params}`;
            console.log(`[USER_ANALYTICS] Calling API: ${url}`);

            const response = await fetch(API_BASE + url, {
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });

            console.log(`[USER_ANALYTICS] Response status: ${response.status}`);

            if (response.ok) {
                const responseData = await response.json();
                console.log('[USER_ANALYTICS] Full response:', responseData);

                // API 응답 구조: { data: { users: [], pagination: {} } }
                const data = responseData.data || responseData;
                console.log('[USER_ANALYTICS] Extracted data:', data);

                setUsers(data.users || []);
                setPagination(data.pagination || {});
                setApiError(false);
            } else {
                console.warn(`[USER_ANALYTICS] API failed with status ${response.status}`);
                setApiError(true);

                // HTML 응답인지 확인
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('text/html')) {
                    console.error('[USER_ANALYTICS] Received HTML instead of JSON - API endpoint may not exist');
                    // toast는 한 번만 표시하도록 조건부로 처리
                    if (!apiError) {
                        toast.error('학습 분석 API를 찾을 수 없습니다. 서버 배포를 확인해주세요.');
                    }
                } else {
                    const error = await response.text();
                    console.error('[USER_ANALYTICS] Error response:', error);
                    if (!apiError) {
                        toast.error('사용자 목록 로드에 실패했습니다.');
                    }
                }

                // Fallback data
                setUsers([]);
                setPagination({});
            }
        } catch (error) {
            console.error('Load users error:', error);
            setApiError(true);

            // toast는 한 번만 표시하도록 조건부로 처리
            if (!apiError) {
                if (error.message.includes('Unexpected token')) {
                    toast.error('학습 분석 API가 아직 배포되지 않았습니다.');
                } else {
                    toast.error('네트워크 오류가 발생했습니다.');
                }
            }

            // Fallback data
            setUsers([]);
            setPagination({});
        } finally {
            setLoading(false);
        }
    };

    // 사용자 상세 정보 로드
    const loadUserDetail = async (userId) => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                userId: userId.toString(),
                dateFrom: filters.dateFrom,
                dateTo: filters.dateTo
            });

            const url = `/api/admin/users/learning-analytics?${params}`;
            console.log(`[USER_DETAIL] Calling API: ${url}`);

            const response = await fetch(API_BASE + url, {
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const responseData = await response.json();
                console.log('[USER_DETAIL] Full response:', responseData);

                // API 응답 구조: { data: { user: {...}, vocabLearning: {...}, ... } }
                const data = responseData.data || responseData;
                console.log('[USER_DETAIL] Extracted data:', data);

                setUserDetail(data);
                setSelectedUser(userId);
            } else {
                console.warn(`[USER_DETAIL] API failed with status ${response.status}`);

                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('text/html')) {
                    toast.error('학습 분석 API를 찾을 수 없습니다. 서버 배포를 확인해주세요.');
                } else {
                    toast.error('사용자 상세 정보 로드에 실패했습니다.');
                }
            }
        } catch (error) {
            console.error('Load user detail error:', error);

            if (error.message.includes('Unexpected token')) {
                toast.error('학습 분석 API가 아직 배포되지 않았습니다.');
            } else {
                toast.error('네트워크 오류가 발생했습니다.');
            }
        } finally {
            setLoading(false);
        }
    };

    // 필터 변경 처리
    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    // 필터 적용
    const applyFilters = () => {
        setSelectedUser(null);
        setUserDetail(null);
        loadUsers(1);
    };

    // 초기 로드
    useEffect(() => {
        console.log('[USER_ANALYTICS] Component mounted, loading users...');
        loadUsers();
    }, []);

    // 날짜 포맷팅
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('ko-KR');
    };

    const formatDateOnly = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('ko-KR');
    };

    // 정확도에 따른 색상 클래스
    const getAccuracyClass = (accuracy) => {
        if (accuracy >= 80) return 'text-success';
        if (accuracy >= 60) return 'text-warning';
        return 'text-danger';
    };

    if (loading && !users.length && !userDetail) {
        return (
            <div className="d-flex justify-content-center py-5">
                <div className="spinner-border text-primary">
                    <span className="visually-hidden">로딩 중...</span>
                </div>
            </div>
        );
    }

    // API 에러 상태 표시
    if (apiError && !users.length) {
        return (
            <div className="user-learning-analytics">
                <div className="alert alert-warning" role="alert">
                    <h4 className="alert-heading">⚠️ 학습 분석 데이터 로드 실패</h4>
                    <p>학습 현황 API에 문제가 있거나 아직 배포되지 않았습니다.</p>
                    <hr />
                    <p className="mb-0">
                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                setApiError(false);
                                loadUsers(1);
                            }}
                        >
                            다시 시도
                        </button>
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="user-learning-analytics">
            {/* 필터 영역 */}
            <div className="card mb-4">
                <div className="card-header">
                    <h5 className="card-title mb-0">📊 유저별 학습 현황</h5>
                </div>
                <div className="card-body">
                    <div className="row g-3 mb-3">
                        <div className="col-md-3">
                            <label className="form-label">정렬 기준</label>
                            <select
                                className="form-select"
                                value={filters.sortBy}
                                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                            >
                                <option value="recent">최근 학습순</option>
                                <option value="streak">연속일수순</option>
                                <option value="cards">카드수순</option>
                            </select>
                        </div>
                        <div className="col-md-3">
                            <label className="form-label">시작일</label>
                            <input
                                type="date"
                                className="form-control"
                                value={filters.dateFrom}
                                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                            />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label">종료일</label>
                            <input
                                type="date"
                                className="form-control"
                                value={filters.dateTo}
                                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                            />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label">&nbsp;</label>
                            <div>
                                <button className="btn btn-primary" onClick={applyFilters}>
                                    <i className="bi bi-funnel me-1"></i>필터 적용
                                </button>
                                {selectedUser && (
                                    <button
                                        className="btn btn-outline-secondary ms-2"
                                        onClick={() => {
                                            setSelectedUser(null);
                                            setUserDetail(null);
                                        }}
                                    >
                                        목록으로
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 사용자 상세 정보 */}
            {userDetail && (
                <div className="row g-4 mb-4">
                    {/* 사용자 기본 정보 */}
                    <div className="col-xl-4">
                        <div className="card h-100">
                            <div className="card-header">
                                <h6 className="card-title mb-0">👤 사용자 정보</h6>
                            </div>
                            <div className="card-body">
                                <div className="mb-3">
                                    <strong>이메일:</strong> {userDetail.user.email}
                                </div>
                                <div className="mb-3">
                                    <strong>연속일수:</strong>
                                    <span className="badge bg-success ms-1">{userDetail.user.streak}일</span>
                                </div>
                                <div className="mb-3">
                                    <strong>가입일:</strong> {formatDateOnly(userDetail.user.createdAt)}
                                </div>
                                <div className="mb-3">
                                    <strong>최근 학습:</strong> {formatDate(userDetail.user.lastStudiedAt)}
                                </div>
                                <div className="row text-center">
                                    <div className="col-4">
                                        <div className="h5 text-primary">{userDetail.user.totalCards}</div>
                                        <div className="small text-muted">학습카드</div>
                                    </div>
                                    <div className="col-4">
                                        <div className="h5 text-warning">{userDetail.user.totalWrongAnswers}</div>
                                        <div className="small text-muted">오답</div>
                                    </div>
                                    <div className="col-4">
                                        <div className="h5 text-info">{userDetail.user.totalStudySessions}</div>
                                        <div className="small text-muted">세션</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 단어 학습 통계 */}
                    <div className="col-xl-4">
                        <div className="card h-100">
                            <div className="card-header">
                                <h6 className="card-title mb-0">📚 단어 학습</h6>
                            </div>
                            <div className="card-body">
                                <div className="mb-3">
                                    <div className="d-flex justify-content-between">
                                        <span>정확도</span>
                                        <span className={`fw-bold ${getAccuracyClass(userDetail.vocabLearning.accuracyRate)}`}>
                                            {userDetail.vocabLearning.accuracyRate}%
                                        </span>
                                    </div>
                                    <div className="progress mt-1">
                                        <div
                                            className="progress-bar"
                                            style={{ width: `${userDetail.vocabLearning.accuracyRate}%` }}
                                        ></div>
                                    </div>
                                </div>
                                <div className="row text-center">
                                    <div className="col-4">
                                        <div className="h6 text-success">{userDetail.vocabLearning.totalCorrect}</div>
                                        <div className="small text-muted">정답</div>
                                    </div>
                                    <div className="col-4">
                                        <div className="h6 text-danger">{userDetail.vocabLearning.totalWrong}</div>
                                        <div className="small text-muted">오답</div>
                                    </div>
                                    <div className="col-4">
                                        <div className="h6 text-primary">{userDetail.vocabLearning.totalCards}</div>
                                        <div className="small text-muted">총카드</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 리딩/리스닝 통계 */}
                    <div className="col-xl-4">
                        <div className="card h-100">
                            <div className="card-header">
                                <h6 className="card-title mb-0">🎯 리딩/리스닝</h6>
                            </div>
                            <div className="card-body">
                                <div className="mb-3">
                                    <h6>리딩 레벨별</h6>
                                    {userDetail.readingLearning.byLevel.length > 0 ? (
                                        userDetail.readingLearning.byLevel.map(level => (
                                            <div key={level.level} className="d-flex justify-content-between small">
                                                <span>{level.level}</span>
                                                <span>
                                                    {level.correctCount}/{level.totalSolved}
                                                    <span className={`ms-1 ${getAccuracyClass(level.accuracyRate)}`}>
                                                        ({level.accuracyRate}%)
                                                    </span>
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-muted small">학습 기록 없음</div>
                                    )}
                                </div>
                                <div>
                                    <h6>리스닝 레벨별</h6>
                                    {userDetail.listeningLearning.byLevel.length > 0 ? (
                                        userDetail.listeningLearning.byLevel.map(level => (
                                            <div key={level.level} className="d-flex justify-content-between small">
                                                <span>{level.level}</span>
                                                <span>
                                                    {level.correctCount}/{level.totalSolved}
                                                    <span className={`ms-1 ${getAccuracyClass(level.accuracyRate)}`}>
                                                        ({level.accuracyRate}%)
                                                    </span>
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-muted small">학습 기록 없음</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 최근 학습한 단어들 */}
                    <div className="col-xl-6">
                        <div className="card">
                            <div className="card-header">
                                <h6 className="card-title mb-0">📖 최근 학습 단어 (7일)</h6>
                            </div>
                            <div className="card-body p-0">
                                {userDetail.vocabLearning.recentStudied.length > 0 ? (
                                    <div className="table-responsive">
                                        <table className="table table-sm mb-0">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>단어</th>
                                                    <th>뜻</th>
                                                    <th>레벨</th>
                                                    <th>정답/오답</th>
                                                    <th>단계</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {userDetail.vocabLearning.recentStudied.map((vocab, idx) => (
                                                    <tr key={idx}>
                                                        <td>
                                                            <strong>{vocab.lemma}</strong>
                                                            <small className="text-muted d-block">{vocab.pos}</small>
                                                        </td>
                                                        <td className="small">{vocab.meaning}</td>
                                                        <td>
                                                            <span className="badge bg-secondary">{vocab.level}</span>
                                                        </td>
                                                        <td className="small">
                                                            <span className="text-success">{vocab.correctCount}</span>
                                                            /
                                                            <span className="text-danger">{vocab.wrongCount}</span>
                                                        </td>
                                                        <td>
                                                            <span className="badge bg-info">{vocab.stage}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-muted">
                                        최근 7일간 학습한 단어가 없습니다.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 자주 틀린 단어들 */}
                    <div className="col-xl-6">
                        <div className="card">
                            <div className="card-header">
                                <h6 className="card-title mb-0">❌ 최근 오답 단어</h6>
                            </div>
                            <div className="card-body p-0">
                                {userDetail.topWrongVocabs.length > 0 ? (
                                    <div className="table-responsive">
                                        <table className="table table-sm mb-0">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>단어</th>
                                                    <th>뜻</th>
                                                    <th>레벨</th>
                                                    <th>시도횟수</th>
                                                    <th>오답일시</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {userDetail.topWrongVocabs.map((wrong, idx) => (
                                                    <tr key={idx}>
                                                        <td>
                                                            <strong>{wrong.lemma}</strong>
                                                            <small className="text-muted d-block">{wrong.pos}</small>
                                                        </td>
                                                        <td className="small">{wrong.meaning}</td>
                                                        <td>
                                                            <span className="badge bg-secondary">{wrong.level}</span>
                                                        </td>
                                                        <td>
                                                            <span className="badge bg-warning">{wrong.attempts}</span>
                                                        </td>
                                                        <td className="small">
                                                            {formatDate(wrong.wrongAt)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-muted">
                                        최근 오답 기록이 없습니다.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 사용자 목록 */}
            {!selectedUser && (
                <div className="card">
                    <div className="card-header d-flex justify-content-between align-items-center">
                        <h6 className="card-title mb-0">👥 사용자 목록</h6>
                        <small className="text-muted">총 {pagination.totalCount}명</small>
                    </div>
                    <div className="card-body p-0">
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th>사용자</th>
                                        <th>연속일수</th>
                                        <th>학습카드</th>
                                        <th>단어정확도</th>
                                        <th>최근활동</th>
                                        <th>최근학습</th>
                                        <th>액션</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.length > 0 ? users.map(user => (
                                        <tr key={user.id}>
                                            <td>
                                                <div>
                                                    <strong>{user.email}</strong>
                                                    <small className="text-muted d-block">
                                                        ID: {user.id}
                                                    </small>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`badge ${user.streak > 7 ? 'bg-success' : user.streak > 3 ? 'bg-warning' : 'bg-secondary'}`}>
                                                    {user.streak}일
                                                </span>
                                            </td>
                                            <td>
                                                <span className="fw-bold">{user.totalCards}</span>
                                                {user.totalWrongAnswers > 0 && (
                                                    <small className="text-danger d-block">
                                                        오답: {user.totalWrongAnswers}
                                                    </small>
                                                )}
                                            </td>
                                            <td>
                                                <span className={`fw-bold ${getAccuracyClass(user.vocabAccuracy)}`}>
                                                    {user.vocabAccuracy}%
                                                </span>
                                            </td>
                                            <td className="small">
                                                리딩: {user.recentActivity.readingProblems}
                                                <br />
                                                리스닝: {user.recentActivity.listeningProblems}
                                            </td>
                                            <td className="small">
                                                {formatDate(user.lastStudiedAt)}
                                            </td>
                                            <td>
                                                <button
                                                    className="btn btn-outline-primary btn-sm"
                                                    onClick={() => loadUserDetail(user.id)}
                                                >
                                                    <i className="bi bi-eye me-1"></i>상세보기
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="7" className="text-center py-4">
                                                <div className="text-muted">
                                                    <i className="bi bi-people fs-1 mb-2"></i>
                                                    <p>표시할 사용자가 없습니다.</p>
                                                    <small>
                                                        {apiError ?
                                                            'API 연결에 문제가 있거나 데이터가 없습니다.' :
                                                            '선택된 필터 조건에 맞는 사용자가 없습니다.'
                                                        }
                                                    </small>
                                                    <div className="mt-2">
                                                        <button
                                                            className="btn btn-outline-primary btn-sm"
                                                            onClick={() => loadUsers(1)}
                                                        >
                                                            <i className="bi bi-arrow-clockwise me-1"></i>새로고침
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* 페이지네이션 */}
                        {pagination.totalPages > 1 && (
                            <div className="card-footer">
                                <nav>
                                    <ul className="pagination pagination-sm mb-0 justify-content-center">
                                        <li className={`page-item ${!pagination.hasPrev ? 'disabled' : ''}`}>
                                            <button
                                                className="page-link"
                                                onClick={() => loadUsers(pagination.page - 1)}
                                                disabled={!pagination.hasPrev}
                                            >
                                                이전
                                            </button>
                                        </li>
                                        <li className="page-item active">
                                            <span className="page-link">
                                                {pagination.page} / {pagination.totalPages}
                                            </span>
                                        </li>
                                        <li className={`page-item ${!pagination.hasNext ? 'disabled' : ''}`}>
                                            <button
                                                className="page-link"
                                                onClick={() => loadUsers(pagination.page + 1)}
                                                disabled={!pagination.hasNext}
                                            >
                                                다음
                                            </button>
                                        </li>
                                    </ul>
                                </nav>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserLearningAnalytics;