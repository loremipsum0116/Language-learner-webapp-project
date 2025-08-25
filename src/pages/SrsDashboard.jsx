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
dayjs.tz.setDefault("Asia/Seoul");

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
    const [learningCurveType, setLearningCurveType] = useState("long"); // "long", "short", "free"
    const [streakInfo, setStreakInfo] = useState(null);
    const [wrongAnswersCount, setWrongAnswersCount] = useState(0);
    const [srsStatus, setSrsStatus] = useState(null);
    const [todayStudyLog, setTodayStudyLog] = useState(null);
    const [showStudyDetails, setShowStudyDetails] = useState(false);

    const reload = async () => {
        console.log('[SRS DASHBOARD] Reloading data...');
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
            
            // 오답노트 개수 로드 (전체 미완료 오답노트)
            const wrongRes = await fetchJSON("/srs/wrong-answers?includeCompleted=false", withCreds());
            setWrongAnswersCount(wrongRes.data.length);
            
            // SRS 상태 정보 로드 (overdue 알림용)
            const statusRes = await fetchJSON("/srs/status", withCreds());
            setSrsStatus(statusRes.data);
            
            // 오늘 학습 로그 로드 - 새로 구현된 API 사용
            const today = dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');
            try {
                const studyLogRes = await fetchJSON(`/srs/study-log?date=${today}`, withCreds());
                console.log('=== SRS DASHBOARD STUDY LOG DEBUG ===');
                console.log('Raw response:', studyLogRes);
                console.log('Response data:', studyLogRes.data);
                console.log('JSON stringified:', JSON.stringify(studyLogRes.data || studyLogRes, null, 2));
                console.log('===============================');
                setTodayStudyLog(studyLogRes.data || studyLogRes);
            } catch (err) {
                console.warn('Study log API failed:', err);
                // API 실패시 기본값으로 설정
                setTodayStudyLog({
                    studies: [],
                    stats: {
                        totalStudied: 0,
                        uniqueWords: 0,
                        errorRate: 0,
                        successRate: 0
                    }
                });
            }
            
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { reload(); }, []);

    // 오늘 학습한 단어들을 그룹화하고 통계 계산
    const processTodayStudyData = () => {
        // streakInfo에서 실제 학습 횟수를 우선 사용
        const actualStudyCount = streakInfo?.dailyQuizCount || 0;
        
        if (!todayStudyLog || !todayStudyLog.studies) {
            // API 데이터가 없으면 streakInfo를 기반으로 추정
            return { 
                wordCounts: {}, 
                totalAttempts: actualStudyCount, 
                wrongAttempts: 0, 
                errorRate: 0,
                isEstimated: actualStudyCount > 0 // 추정 데이터임을 표시
            };
        }

        const wordCounts = {};
        const wordFirstAttempts = {}; // lemma별 첫 학습 추적
        const firstStudyByLemma = new Map(); // lemma별 첫 학습 추적

        // 현재 시간
        const now = new Date();

        // lemma별 첫 학습 카드 식별 (서버 로직과 일치)
        (todayStudyLog.studies || []).forEach(card => {
            const lemma = card.vocab?.lemma || card.lemma;
            if (!lemma) return; // lemma가 없으면 스킵
            
            // 이미 해당 lemma가 있는지 확인
            if (firstStudyByLemma.has(lemma)) {
                // 더 이른 시간의 학습 기록이 있으면 그것을 유지
                const existingCard = firstStudyByLemma.get(lemma);
                if (new Date(card.lastReviewedAt) < new Date(existingCard.lastReviewedAt)) {
                    firstStudyByLemma.set(lemma, card);
                }
            } else {
                firstStudyByLemma.set(lemma, card);
            }
        });

        // 첫 학습 카드들만 처리 (lemma별)
        let totalAttempts = 0;
        Array.from(firstStudyByLemma.values()).forEach(card => {
            const word = card.vocab?.lemma || card.lemma || '미상';
            
            console.log(`[DEBUG] Processing first study card: ${word}, isTodayStudy: ${card.isTodayStudy}, todayFirstResult: ${card.todayFirstResult}, learningCurveType: ${card.learningCurveType}`);
            
            // 유효한 첫 학습만 카운트
            if (card.todayFirstResult !== null && card.todayFirstResult !== undefined || !card.isTodayStudy) {
                totalAttempts++;
                
                // 정답/오답 여부 판단
                let isCorrect;
                if (card.todayFirstResult !== null && card.todayFirstResult !== undefined) {
                    // todayFirstResult 필드 사용 (가장 정확함)
                    isCorrect = card.todayFirstResult;
                } else {
                    // 백업: 정식 학습 상태면 성공으로 간주
                    isCorrect = !card.isTodayStudy;
                }
                
                // lemma별 첫 학습 추적
                const reviewTime = new Date(card.lastReviewedAt);
                const wordKey = `${word}_first`; // lemma만으로 키 생성
                
                wordFirstAttempts[wordKey] = {
                    word: word,
                    time: reviewTime,
                    isCorrect: isCorrect,
                    card: card,
                    isFirstStudyToday: true,
                    // 상태 정보 추가
                    isTodayStudy: card.isTodayStudy,
                    studyType: 'valid', // 첫 학습만 유효한 것으로 처리
                    folderId: card.folderId
                };
                
                // 단어별 학습 기록 저장 (상세보기용)
                if (!wordCounts[word]) {
                    wordCounts[word] = { correct: 0, wrong: 0, total: 0 };
                }
                
                wordCounts[word].total++;
                if (isCorrect) {
                    wordCounts[word].correct++;
                } else {
                    wordCounts[word].wrong++;
                }
            }
        });
        
        // 디버깅: wordFirstAttempts 로그
        console.log('=== WORD FIRST ATTEMPTS DEBUG ===');
        console.log('wordFirstAttempts keys:', Object.keys(wordFirstAttempts));
        console.log('wordFirstAttempts:', wordFirstAttempts);
        console.log('wordCounts:', wordCounts);
        console.log('todayStudyLog.studies length:', todayStudyLog.studies?.length);
        console.log('===============================');

        // 서버 제공 통계를 우선 사용하되, 수학적 엄밀성 확보
        let errorRate = 0;
        let finalTotalAttempts = totalAttempts;
        
        if (todayStudyLog.stats) {
            // 서버에서 계산된 통계 사용 (수학적으로 정확함)
            errorRate = todayStudyLog.stats.errorRate || 0;
            
            // 서버에서 제공하는 todayTotalAttempts 사용 (정식 학습 시도 횟수만, 대기 중 학습 제외)
            if (todayStudyLog.stats.todayTotalAttempts !== undefined) {
                finalTotalAttempts = todayStudyLog.stats.todayTotalAttempts;
                console.log(`[STATS DEBUG] Using server todayTotalAttempts: ${todayStudyLog.stats.todayTotalAttempts}`);
            } else {
                finalTotalAttempts = totalAttempts; // 클라이언트 계산 백업
                console.log(`[STATS DEBUG] Server todayTotalAttempts not available, using client: ${totalAttempts}`);
            }
            
            console.log(`[STATS DEBUG] Server stats - todayTotalAttempts: ${todayStudyLog.stats.todayTotalAttempts}, totalAttempts: ${todayStudyLog.stats.totalAttempts}, errorRate: ${todayStudyLog.stats.errorRate}%`);
            console.log(`[STATS DEBUG] Client calculated - totalAttempts: ${totalAttempts}`);
            
            // 디버깅: 서버와 클라이언트 학습 횟수 비교
            if (todayStudyLog.stats.todayTotalAttempts && totalAttempts !== todayStudyLog.stats.todayTotalAttempts) {
                console.warn(`[STATS MISMATCH] Client: ${totalAttempts}, Server: ${todayStudyLog.stats.todayTotalAttempts}`);
            }
        } else {
            // 백업: 수학적으로 엄밀한 프론트엔드 계산
            // 첫 학습만 오답률 계산에 포함 (서버 로직과 일치)
            const validAttempts = Object.values(wordFirstAttempts); // 모든 첫 학습 시도
            const validWrongAttempts = validAttempts.filter(attempt => !attempt.isCorrect);
            
            errorRate = validAttempts.length > 0 ? 
                Math.round((validWrongAttempts.length / validAttempts.length) * 100) : 0;
                
            console.log(`[FALLBACK STATS] Unique lemma first studies: ${validAttempts.length}, Wrong: ${validWrongAttempts.length}, Error rate: ${errorRate}%`);
            console.log(`[FALLBACK STATS] Total unique lemmas studied: ${totalAttempts}`);
        }

        return { 
            wordCounts, 
            wordFirstAttempts, // 첫 시도 추적 데이터
            totalAttempts: finalTotalAttempts, // 서버 데이터 우선, 백업시 클라이언트 계산
            errorRate,
            isEstimated: false
        };
    };

    const { wordCounts, wordFirstAttempts, totalAttempts, errorRate, isEstimated } = processTodayStudyData();

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
            <h2 className="mb-4">SRS 학습</h2>

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
                                            totalAttempts >= streakInfo.requiredDaily ? 'bg-success' : 'bg-primary'
                                        }`}
                                        style={{width: `${Math.min(100, (totalAttempts / streakInfo.requiredDaily) * 100)}%`}}
                                    >
                                        {totalAttempts}/{streakInfo.requiredDaily}
                                    </div>
                                </div>
                                
                                {/* 상태 메시지 */}
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <small className="text-muted">
                                        {totalAttempts >= streakInfo.requiredDaily ? 
                                            '오늘 목표 달성! 🎉' : 
                                            `오늘 ${streakInfo.requiredDaily - totalAttempts}개 더 필요`}
                                    </small>
                                    {streakInfo?.bonus?.next && (
                                        <small className="text-muted">
                                            다음: {streakInfo.bonus.next.emoji} {streakInfo.bonus.next.title} 
                                            ({streakInfo.bonus.next.days - streakInfo.streak}일 남음)
                                        </small>
                                    )}
                                </div>

                                {/* 오늘 학습 상세 정보 - 항상 표시 */}
                                <div className="border-top pt-3">
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <small className="text-muted">
                                            {totalAttempts > 0 ? (
                                                <>📊 오늘 학습: {totalAttempts}회 | 오답율: <span className={errorRate > 30 ? 'text-danger' : errorRate > 15 ? 'text-warning' : 'text-success'}>{errorRate}%</span>
                                                {isEstimated && <span className="text-info"> (추정)</span>}</>
                                            ) : (
                                                <>📊 오늘 학습: 0회 | 오답율: 0%</>
                                            )}
                                        </small>
                                        <button 
                                            className="btn btn-sm btn-outline-secondary"
                                            onClick={() => setShowStudyDetails(!showStudyDetails)}
                                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                        >
                                            {showStudyDetails ? '숨기기' : '상세보기'} {showStudyDetails ? '▲' : '▼'}
                                        </button>
                                    </div>
                                    
                                    {/* 드롭다운 상세 정보 */}
                                    {showStudyDetails && (
                                        <div className="card card-body bg-light" style={{ fontSize: '0.85rem' }}>
                                            <div className="row">
                                                <div className="col-12">
                                                    <strong className="text-primary">오늘 학습한 단어들:</strong>
                                                    <div className="mt-2">
                                                        {Object.keys(wordFirstAttempts).length > 0 ? (
                                                            <div className="d-flex flex-wrap gap-2">
                                                                {/* lemma별 첫 학습만 표시 */}
                                                                {Object.values(wordFirstAttempts)
                                                                    .sort((a, b) => new Date(b.time) - new Date(a.time))
                                                                    .map((attempt, index) => {
                                                                        // 첫 학습 결과에 따른 스타일
                                                                        const badgeClass = attempt.isCorrect ? 'bg-success' : 'bg-danger';
                                                                        const icon = attempt.isCorrect ? '✅' : '❌';
                                                                        
                                                                        return (
                                                                            <span key={`${attempt.word}_${index}`} className={`badge ${badgeClass} mb-1 me-1`} style={{fontSize: '0.75rem', display: 'inline-block', whiteSpace: 'nowrap'}}>
                                                                                {icon} {attempt.word} [F{attempt.folderId}] <small className="opacity-75">첫학습</small>
                                                                            </span>
                                                                        );
                                                                    })
                                                                }
                                                                
                                                            </div>
                                                        ) : totalAttempts > 0 && isEstimated ? (
                                                            <div className="text-center py-3">
                                                                <span className="text-info">📚 {totalAttempts}회 학습 완료!</span>
                                                                <br />
                                                                <small className="text-muted">상세 학습 기록을 불러올 수 없습니다.</small>
                                                            </div>
                                                        ) : (
                                                            <div className="text-center py-3">
                                                                <span className="text-muted">🦜 아직 학습한 단어가 없습니다.</span>
                                                                <br />
                                                                <small className="text-muted">SRS 학습을 시작해보세요!</small>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
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
                                <small className="text-muted ms-2">- 폴더 생성 후 변경 불가능, 신중히 선택하세요</small>
                            </label>
                            <div className="alert alert-info py-2 mb-3">
                                <small>
                                    <strong>💡 선택 가이드:</strong> 
                                    체계적 장기 기억을 원한다면 <strong>🐢 장기곡선</strong>, 
                                    시험 등 빠른 암기가 필요하다면 <strong>🐰 스퍼트곡선</strong>, 
                                    자유롭게 학습하고 싶다면 <strong>🎯 자율모드</strong>를 선택하세요.
                                </small>
                            </div>
                                <div className="row g-3">
                                    <div className="col-md-4">
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
                                                    1시간 → 1일 → 3일 → 7일 → 13일 → 29일 → 60일<br/>
                                                    <strong>7단계</strong>에서 마스터 완료<br/>
                                                    점진적 간격 확장으로 장기 기억 형성
                                                </small>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-md-4">
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
                                                    1시간 → 1일 → 2일 고정 간격 반복<br/>
                                                    <strong>10단계</strong>에서 마스터 완료<br/>
                                                    빠른 반복으로 단기 집중 학습
                                                </small>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-md-4">
                                        <div className={`card h-100 ${learningCurveType === 'free' ? 'border-success bg-light' : ''}`}>
                                            <div className="card-body p-3">
                                                <div className="form-check">
                                                    <input
                                                        className="form-check-input"
                                                        type="radio"
                                                        name="learningCurve"
                                                        id="freeCurve"
                                                        value="free"
                                                        checked={learningCurveType === 'free'}
                                                        onChange={(e) => setLearningCurveType(e.target.value)}
                                                    />
                                                    <label className="form-check-label" htmlFor="freeCurve">
                                                        <strong>🎯 자율 학습 모드</strong>
                                                    </label>
                                                </div>
                                                <small className="text-muted d-block mt-2">
                                                    타이머 없음, 자유로운 복습<br/>
                                                    <strong>학습 기록</strong>만 저장<br/>
                                                    원하는 대로 학습 가능
                                                </small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-2">
                                    <small className="text-muted">
                                        💡 <strong>팁:</strong> 
                                        <strong>장기곡선</strong>은 망각곡선 이론에 최적화, 
                                        <strong>스퍼트곡선</strong>은 시험 대비용, 
                                        <strong>자율모드</strong>는 스케줄 없이 편안한 학습이 가능합니다.
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
                                                {f.learningCurveType === 'short' && !f.type && <span className="badge bg-warning ms-2">🐰 스퍼트곡선</span>}
                                                {f.learningCurveType === 'long' && !f.type && <span className="badge bg-primary ms-2">🐢 장기곡선</span>}
                                                {f.learningCurveType === 'free' && !f.type && <span className="badge bg-success ms-2">🎯 자율모드</span>}
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
