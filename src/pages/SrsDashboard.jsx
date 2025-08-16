// src/pages/SrsDashboard.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { fetchJSON, withCreds } from "../api/client";
import { SrsApi } from "../api/srs";
import ReviewTimer from "../components/ReviewTimer";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("ko");

function fmt(d) {
    if (!d) return "-";
    // UTC로 저장된 날짜를 KST로 변환하여 표시
    return dayjs.utc(d).tz('Asia/Seoul').format("YYYY.MM.DD (ddd)");
}
function isDue(nextReviewDate) {
    const kstNow = dayjs().tz('Asia/Seoul');
    return dayjs(nextReviewDate).tz('Asia/Seoul').isSame(kstNow, "day") || dayjs(nextReviewDate).tz('Asia/Seoul').isBefore(kstNow, "day");
}

export default function SrsDashboard() {
    const [folders, setFolders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newFolderName, setNewFolderName] = useState("");
    const [learningCurveType, setLearningCurveType] = useState("long"); // "long" 또는 "short"
    const [streakInfo, setStreakInfo] = useState(null);
    const [wrongAnswersCount, setWrongAnswersCount] = useState(0);
    const [srsStatus, setSrsStatus] = useState(null);

    const reload = async () => {
        setLoading(true);
        try {
            const { data } = await fetchJSON("/srs/dashboard", withCreds());
            // 서버가 nextReviewAt로 주던 과거 호환
            const normalized = (data || []).map(f => ({
                ...f,
                nextReviewDate: f.nextReviewDate ?? f.nextReviewAt,
                isDue: f.nextReviewDate ? isDue(f.nextReviewDate) : (f.kind === 'manual' && !f.isCompleted)
            }));
            setFolders(normalized);
            
            // Streak 정보 로드
            const streakRes = await fetchJSON("/srs/streak", withCreds());
            setStreakInfo(streakRes.data);
            
            // 오답노트 개수 로드
            const wrongRes = await fetchJSON("/srs/wrong-answers/count", withCreds());
            setWrongAnswersCount(wrongRes.data.count);
            
            // SRS 상태 정보 로드 (overdue 알림용)
            const statusRes = await fetchJSON("/srs/status", withCreds());
            setSrsStatus(statusRes.data);
            
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { reload(); }, []);

    async function deleteFolderSafely(e, id, reload) {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm("폴더를 삭제하시겠습니까? (연결된 아이템도 함께 삭제)")) return;
        await SrsApi.deleteFolder(id);
        await reload();
    }
    const handleCreateFolder = async (e) => {
        e.preventDefault();
        const name = newFolderName.trim();
        if (!name) { alert("폴더 이름을 입력하세요."); return; }
        try {
            await fetchJSON("/srs/folders", withCreds({
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    name, 
                    parentId: null, // 최상위 폴더 생성
                    learningCurveType: learningCurveType // 학습 곡선 타입 추가
                }),
            }));
            setNewFolderName("");
            setLearningCurveType("long"); // 기본값으로 리셋
            await reload();
        } catch (e) {
            alert(`폴더 생성 실패: ${e.message || "Unknown error"}`);
        }
    };

    const toggleAlarm = async (folder) => {
        const turnOn = !folder.alarmActive;
        if (turnOn && !window.confirm("알림을 다시 켜면 진행도가 stage 0으로 초기화됩니다. 계속하시겠습니까?")) return;
        try {
            await fetchJSON(`/srs/folders/${folder.id}/alarm`, withCreds({
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ active: turnOn }),
            }));
            await reload();
        } catch (e) {
            alert(`알림 상태 변경 실패: ${e.message || "Unknown error"}`);
        }
    };


    const restartMasteredFolder = async (folder) => {
        if (!window.confirm(`${folder.name}을 새로운 120일 사이클로 재시작하시겠습니까?\n\n모든 단어가 미학습 상태로 리셋되고 Stage 0부터 다시 시작합니다.`)) return;
        
        try {
            await fetchJSON(`/srs/folders/${folder.id}/restart`, withCreds({
                method: "POST"
            }));
            alert("마스터된 폴더가 재시작되었습니다. 새로운 120일 사이클이 시작됩니다!");
            await reload();
        } catch (e) {
            alert(`폴더 재시작 실패: ${e.message || "Unknown error"}`);
        }
    };

    // Overdue 알림 메시지 컴포넌트
    const OverdueAlertBanner = () => {
        if (!srsStatus?.shouldShowAlarm || !srsStatus?.alarmInfo) return null;
        
        const { overdueCount, alarmInfo } = srsStatus;
        const { currentPeriod, nextAlarmAtKst, minutesToNextAlarm, periodProgress } = alarmInfo;
        
        return (
            <div className="alert alert-warning alert-dismissible mb-4" role="alert">
                <div className="d-flex align-items-center justify-content-between">
                    <div className="flex-grow-1">
                        <div className="d-flex align-items-center mb-2">
                            <strong className="me-2">🔔 복습 알림</strong>
                            <span className="badge bg-danger text-white me-2">{overdueCount}개</span>
                            <span className="text-muted small">
                                ({currentPeriod})
                            </span>
                        </div>
                        <div className="d-flex align-items-center">
                            <span className="me-3">
                                복습이 필요한 단어가 <strong>{overdueCount}개</strong> 있습니다.
                            </span>
                            <span className="text-muted small">
                                다음 알림: {nextAlarmAtKst} ({minutesToNextAlarm}분 후)
                            </span>
                        </div>
                        {/* 진행 바 */}
                        <div className="progress mt-2" style={{ height: '4px' }}>
                            <div 
                                className="progress-bar bg-warning" 
                                style={{ width: `${periodProgress}%` }}
                                title={`현재 알림 주기 ${periodProgress}% 경과`}
                            ></div>
                        </div>
                    </div>
                    <div className="ms-3">
                        <Link to="/srs/quiz" className="btn btn-warning btn-sm">
                            <strong>지금 복습하기</strong>
                        </Link>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <main className="container py-4">
            <h2 className="mb-4">SRS 학습 🧠</h2>

            {/* Overdue 알림 배너 */}
            <OverdueAlertBanner />

            {/* Streak 정보 및 오답노트 */}
            {streakInfo && (
                <div className="row mb-4">
                    <div className="col-md-6">
                        <div className="card">
                            <div className="card-body">
                                <div className="d-flex justify-content-between align-items-start mb-3">
                                    <div>
                                        <h5 className="card-title">
                                            {streakInfo?.status?.icon || '🔥'} 연속 학습
                                        </h5>
                                        <h2 className="mb-1" style={{ 
                                            color: streakInfo?.status?.color === 'gray' ? '#6c757d' :
                                                   streakInfo?.status?.color === 'blue' ? '#0d6efd' :
                                                   streakInfo?.status?.color === 'green' ? '#198754' :
                                                   streakInfo?.status?.color === 'orange' ? '#fd7e14' :
                                                   streakInfo?.status?.color === 'purple' ? '#6f42c1' : '#0d6efd'
                                        }}>
                                            {streakInfo.streak}일
                                        </h2>
                                        <small className={`text-${
                                            streakInfo?.status?.color === 'purple' ? 'primary' : 'muted'
                                        }`}>
                                            {streakInfo?.status?.message || ''}
                                        </small>
                                    </div>
                                    {/* 보너스 뱃지 */}
                                    {streakInfo?.bonus?.current && (
                                        <span className="badge bg-warning text-dark fs-6">
                                            {streakInfo.bonus.current.emoji} {streakInfo.bonus.current.title}
                                        </span>
                                    )}
                                </div>
                                
                                {/* 진행률 바 */}
                                <div className="progress mb-2" style={{height: '20px'}}>
                                    <div 
                                        className={`progress-bar ${
                                            streakInfo.isCompletedToday ? 'bg-success' : 'bg-primary'
                                        }`}
                                        style={{width: `${streakInfo.progressPercent}%`}}
                                    >
                                        {streakInfo.dailyQuizCount}/{streakInfo.requiredDaily}
                                    </div>
                                </div>
                                
                                {/* 상태 메시지 */}
                                <div className="d-flex justify-content-between align-items-center">
                                    <small className="text-muted">
                                        {streakInfo.isCompletedToday ? 
                                            '오늘 목표 달성! 🎉' : 
                                            `오늘 ${streakInfo.remainingForStreak}개 더 필요`}
                                    </small>
                                    {streakInfo?.bonus?.next && (
                                        <small className="text-muted">
                                            다음: {streakInfo.bonus.next.emoji} {streakInfo.bonus.next.title} 
                                            ({streakInfo.bonus.next.days - streakInfo.streak}일 남음)
                                        </small>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-6">
                        <div className="card">
                            <div className="card-body">
                                <h5 className="card-title">📝 오답노트</h5>
                                <h2 className="text-warning mb-2">{wrongAnswersCount}개</h2>
                                <Link to="/srs/wrong-answers" className="btn btn-outline-warning btn-sm">
                                    오답노트 보기
                                </Link>
                                {wrongAnswersCount > 0 && (
                                    <Link to="/srs/wrong-answers/quiz" className="btn btn-warning btn-sm ms-2">
                                        복습하기
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 폴더 생성 폼 */}
            <div className="card mb-4">
                <div className="card-header">
                    <h5 className="card-title mb-0">🆕 새 학습 폴더 만들기</h5>
                </div>
                <div className="card-body">
                    <form onSubmit={handleCreateFolder}>
                        <div className="row g-3">
                            <div className="col-md-8">
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="새 학습 폴더 이름..."
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="col-md-4">
                                <button type="submit" className="btn btn-primary w-100">만들기</button>
                            </div>
                        </div>
                        
                        <div className="mt-3">
                            <label className="form-label">
                                <strong>📊 학습 곡선 선택 (중요!)</strong>
                                <small className="text-muted ms-2">- 폴더 생성 후 변경 불가</small>
                            </label>
                                <div className="row g-3">
                                    <div className="col-md-6">
                                        <div className={`card h-100 ${learningCurveType === 'long' ? 'border-primary bg-light' : ''}`}>
                                            <div className="card-body p-3">
                                                <div className="form-check">
                                                    <input
                                                        className="form-check-input"
                                                        type="radio"
                                                        name="learningCurve"
                                                        id="longCurve"
                                                        value="long"
                                                        checked={learningCurveType === 'long'}
                                                        onChange={(e) => setLearningCurveType(e.target.value)}
                                                    />
                                                    <label className="form-check-label" htmlFor="longCurve">
                                                        <strong>🐢 장기 학습 곡선 (추천)</strong>
                                                    </label>
                                                </div>
                                                <small className="text-muted d-block mt-2">
                                                    2일 → 6일 → 13일 → 29일 → 59일 → 119일<br/>
                                                    <strong>Stage 6</strong>에서 마스터 완료<br/>
                                                    망각곡선에 최적화된 장기 기억
                                                </small>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className={`card h-100 ${learningCurveType === 'short' ? 'border-warning bg-light' : ''}`}>
                                            <div className="card-body p-3">
                                                <div className="form-check">
                                                    <input
                                                        className="form-check-input"
                                                        type="radio"
                                                        name="learningCurve"
                                                        id="shortCurve"
                                                        value="short"
                                                        checked={learningCurveType === 'short'}
                                                        onChange={(e) => setLearningCurveType(e.target.value)}
                                                    />
                                                    <label className="form-check-label" htmlFor="shortCurve">
                                                        <strong>🐰 단기 스퍼트 곡선</strong>
                                                    </label>
                                                </div>
                                                <small className="text-muted d-block mt-2">
                                                    2일 간격으로 10회 반복<br/>
                                                    <strong>Stage 10</strong>에서 마스터 완료<br/>
                                                    빠른 집중 학습 선호자용
                                                </small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-2">
                                    <small className="text-muted">
                                        💡 <strong>팁:</strong> 장기 학습 곡선은 망각곡선 이론에 기반하여 장기 기억에 최적화되어 있습니다. 
                                        단기 스퍼트 곡선은 시험 준비 등 빠른 암기가 필요한 경우에 적합합니다. 어떤 곡선을 택하든, 자율 복습은 언제든지 가능합니다!
                                    </small>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            {loading ? <div className="spinner-border" /> : (
                <div className="list-group">
                    {folders.map(f => (
                        <div key={f.id} className="border rounded mb-2">
                            {/* 최상위 폴더 */}
                            <div className="list-group-item d-flex justify-content-between align-items-center">
                                <div className="flex-grow-1">
                                    <div className="d-flex align-items-center">
                                        <Link
                                            to={f.type === 'parent' ? `/srs/parent/${f.id}` : `/srs/folder/${f.id}`}
                                            className="text-decoration-none flex-grow-1"
                                        >
                                            <h5 className={`mb-1 ${f.isDue && !f.isMastered ? "text-primary" : ""}`}>
                                                📁 {f.name}
                                                {f.type === 'parent' && <span className="badge bg-primary ms-2">상위폴더</span>}
                                                {f.kind === 'manual' && !f.isMastered && !f.type && <span className="badge bg-secondary ms-2">수동</span>}
                                                {f.kind === 'review' && !f.isMastered && !f.type && <span className="badge bg-info ms-2">복습</span>}
                                                {f.learningCurveType === 'short' && !f.type && <span className="badge bg-warning ms-2">🐰 단기</span>}
                                                {f.learningCurveType === 'long' && !f.type && <span className="badge bg-primary ms-2">🐢 장기</span>}
                                                {f.isMastered && <span className="badge bg-warning text-dark ms-2">🏆 마스터</span>}
                                                {f.isCompleted && !f.isMastered && <span className="badge bg-success ms-2">완료</span>}
                                            </h5>
                                            <small>
                                                생성일: <strong>{fmt(f.createdDate ?? f.createdAt ?? f.date ?? null)}</strong>
                                                <span className="mx-2">|</span>
                                                {f.type === 'parent' ? (
                                                    <>
                                                        하위폴더 <strong>{f.childrenCount || 0}개</strong>
                                                        <span className="mx-2">|</span>
                                                        총 카드 <strong>{f.total ?? 0}개</strong>
                                                    </>
                                                ) : f.isMastered ? (
                                                    <>
                                                        <strong className="text-warning">🏆 {f.completionCount || 1}회차 마스터 완료</strong>
                                                        <span className="mx-2">|</span>
                                                        <span className="text-muted">알림 비활성화</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        {f.kind === 'manual' && !f.isCompleted ? 
                                                            <strong className="text-primary">학습 중</strong> :
                                                            f.isDue
                                                                ? <strong className="text-success">오늘 복습!</strong>
                                                                : (
                                                                    <>
                                                                        다음 복습: <strong>{fmt(f.nextReviewDate)}</strong>
                                                                        <br />
                                                                        <ReviewTimer 
                                                                            nextReviewAt={f.nextReviewDate}
                                                                            className="small"
                                                                        />
                                                                    </>
                                                                )}
                                                        <span className="mx-2">|</span>
                                                        Stage {f.stage}
                                                        <span className="mx-2">|</span>
                                                        카드 {f.total ?? 0}개
                                                    </>
                                                )}
                                                {f.counts && (
                                                    <>
                                                        <span className="mx-2">|</span>
                                                        <span className="text-success">완료 {f.counts.learned}</span> / 
                                                        <span className="text-warning"> 남은 {f.counts.remaining}</span>
                                                    </>
                                                )}
                                            </small>
                                        </Link>
                                    </div>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    {f.type === 'parent' ? (
                                        <span className="text-muted small">하위폴더에서 카드 관리</span>
                                    ) : f.isMastered ? (
                                        <>
                                            <button
                                                className="btn btn-sm btn-warning"
                                                onClick={(e) => { e.preventDefault(); restartMasteredFolder(f); }}
                                                title="새로운 120일 사이클 재시작"
                                            >
                                                🔄 재시작
                                            </button>
                                            <span className="text-muted small">🔕 알림 OFF</span>
                                        </>
                                    ) : (
                                        <button
                                            className="btn btn-sm"
                                            onClick={(e) => { e.preventDefault(); toggleAlarm(f); }}
                                            title={f.alarmActive ? "알림 끄기" : "알림 켜기 (stage 0 초기화)"}
                                        >
                                            {f.alarmActive ? "🔔" : "🔕"}
                                        </button>
                                    )}
                                    <button
                                        className="btn btn-sm btn-outline-danger"
                                        title="폴더 삭제"
                                        onClick={(e) => deleteFolderSafely(e, f.id, reload)}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!loading && folders.length === 0 && (
                <div className="text-center p-5 bg-light rounded">
                    <h4>복습할 폴더가 없습니다.</h4>
                    <p>위에서 새 복습 폴더를 만들어 단어를 추가해보세요.</p>
                </div>
            )}
        </main>
    );
}
