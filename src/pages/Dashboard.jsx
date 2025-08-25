// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchJSON, withCreds, isAbortError } from '../api/client';
import { SrsApi } from '../api/srs';
import RainbowStar from '../components/RainbowStar';

// dayjs(KST 라벨용)
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tz from 'dayjs/plugin/timezone';
dayjs.extend(utc); dayjs.extend(tz);
dayjs.tz.setDefault("Asia/Seoul");
const todayKst = () => dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');

function StatCard({ title, value, icon, link, linkText, loading, showDetails, onDetailsClick, detailsButtonRef }) {
    return (
        <div className="card h-100">
            <div className="card-body text-center">
                <div className="d-flex justify-content-center align-items-center mb-2">
                    {icon}
                    <h5 className="card-title ms-2 mb-0">{title}</h5>
                </div>
                {loading ? (
                    <div className="spinner-border spinner-border-sm" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                ) : (
                    <p className="display-4 fw-bold mb-1">{value}</p>
                )}
                <div className="d-flex justify-content-center gap-2 align-items-center">
                    {link && <Link to={link}>{linkText}</Link>}
                    {showDetails && (
                        <button 
                            ref={detailsButtonRef}
                            className="btn btn-sm btn-outline-secondary"
                            onClick={onDetailsClick}
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        >
                            상세보기 ▼
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function Dashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState({ srsQueue: 0, odatNote: 0, masteredWords: 0 });
    const [masteredCards, setMasteredCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [srsStatus, setSrsStatus] = useState(null);
    const [streakInfo, setStreakInfo] = useState(null);
    const [todayStudyLog, setTodayStudyLog] = useState(null);
    const [showStudyDetails, setShowStudyDetails] = useState(false);
    const [showMasteredDetails, setShowMasteredDetails] = useState(false);
    const dropdownButtonRef = useRef(null);
    const masteredButtonRef = useRef(null);

    // 🔔 오늘(KST) 루트 폴더의 미학습 합계 + 가장 이른 알림시각
    const [alarm, setAlarm] = useState({ totalDue: 0, nextAlarmAtKst: null });

    useEffect(() => {
        const ac = new AbortController();

        (async () => {
            try {
                setLoading(true);

                // 1) 카드/오답/마스터 통계 병렬 로딩
                const [srsQueueRes, odatNoteRes, masteredCardsRes] = await Promise.all([
                    fetchJSON('/srs/available', withCreds({ signal: ac.signal })),
                    fetchJSON('/srs/wrong-answers?includeCompleted=false', withCreds({ signal: ac.signal })),
                    fetchJSON('/srs/mastered-cards', withCreds({ signal: ac.signal })),
                ]);

                if (!ac.signal.aborted) {
                    // VocabList와 동일한 방식으로 마스터된 카드 카운트
                    const masteredData = Array.isArray(masteredCardsRes.data) ? masteredCardsRes.data : [];
                    const masteredCount = masteredData.length;
                    
                    console.log('[Dashboard] Mastered cards API response:', masteredData);
                    console.log('[Dashboard] Mastered count from /srs/mastered-cards:', masteredCount);
                    console.log('[Dashboard] Sample mastered card structure:', masteredData[0]);
                    
                    setStats({
                        srsQueue: Array.isArray(srsQueueRes.data) ? srsQueueRes.data.length : 0,
                        odatNote: Array.isArray(odatNoteRes.data) ? odatNoteRes.data.length : 0,
                        masteredWords: masteredCount,
                    });
                    
                    // 마스터된 카드 데이터 저장
                    setMasteredCards(masteredData);
                    console.log('[Dashboard] Sample mastered card with vocab:', masteredData[0]);
                }

                // 2) 오늘 루트(id) 찾고 → 하위 폴더 children-lite로 dueCount/nextAlarmAt 수집
                //    SrsApi.picker는 서버에서 루트 목록을 주는 전제(이미 프로젝트에 존재)
                let rootId = null;
                try {
                    const picker = await SrsApi.picker(); // GET /srs/folders/picker
                    const roots = Array.isArray(picker) ? picker : (picker?.data ?? []);
                    const root = roots.find(r => r?.name === todayKst());
                    rootId = root?.id ?? null;
                } catch {
                    // picker 없으면 건너뜀
                }

                if (rootId && !ac.signal.aborted) {
                    const list = await SrsApi.listChildrenLite(rootId); // GET /srs/folders/:rootId/children-lite
                    const children = Array.isArray(list) ? list : (list?.data ?? []);
                    const totalDue = children.reduce((s, f) => s + (f?.dueCount ?? 0), 0);

                    // 가장 이른 nextAlarmAt (있으면 KST 포맷)
                    const nexts = children.map(c => c?.nextAlarmAt).filter(Boolean);
                    const earliest = nexts.length
                        ? dayjs(Math.min(...nexts.map(d => new Date(d).getTime()))).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm')
                        : null;

                    setAlarm({ totalDue, nextAlarmAtKst: earliest, rootId, children });
                } else {
                    setAlarm({ totalDue: 0, nextAlarmAtKst: null });
                }
                
                // 3) SRS 상태 정보 로드 (새로운 overdue 알림용)
                try {
                    const statusRes = await fetchJSON('/srs/status', withCreds({ signal: ac.signal }));
                    if (!ac.signal.aborted) {
                        setSrsStatus(statusRes.data);
                    }
                } catch (e) {
                    if (!isAbortError(e)) console.warn('SRS 상태 로딩 실패:', e);
                }
                
                // 4) 연속학습일 정보 로드
                try {
                    const streakRes = await fetchJSON('/srs/streak', withCreds({ signal: ac.signal }));
                    if (!ac.signal.aborted) {
                        setStreakInfo(streakRes.data);
                    }
                } catch (e) {
                    if (!isAbortError(e)) console.warn('연속학습일 로딩 실패:', e);
                }
                
                // 5) 오늘 학습 로그 로드 (SRS 대시보드와 동일한 방식)
                const today = dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');
                try {
                    const studyLogRes = await fetchJSON(`/srs/study-log?date=${today}`, withCreds({ signal: ac.signal }));
                    if (!ac.signal.aborted) {
                        setTodayStudyLog(studyLogRes.data || studyLogRes);
                    }
                } catch (err) {
                    if (!isAbortError(err)) {
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
                }
                
            } catch (e) {
                if (!isAbortError(e)) console.error('대시보드 데이터 로딩 실패:', e);
            } finally {
                if (!ac.signal.aborted) setLoading(false);
            }
        })();

        return () => ac.abort();
    }, []);


    const cefrLevel = user?.profile?.level || 'A1';

    // 오늘 학습한 단어들을 그룹화하고 통계 계산 (SRS 대시보드와 동일한 로직)
    const processTodayStudyData = () => {
        // streakInfo에서 실제 학습 횟수를 우선 사용
        const actualStudyCount = streakInfo?.dailyQuizCount || 0;
        
        if (!todayStudyLog || !todayStudyLog.studies) {
            // API 데이터가 없으면 streakInfo를 기반으로 추정
            return { 
                wordCounts: {}, 
                wordFirstAttempts: {},
                totalAttempts: actualStudyCount, 
                wrongAttempts: 0, 
                errorRate: 0,
                isEstimated: actualStudyCount > 0 // 추정 데이터임을 표시
            };
        }

        const wordFirstAttempts = {}; // lemma별 첫 시도 추적
        
        // 학습 데이터가 있으면 첫 시도만 처리
        todayStudyLog.studies.forEach(card => {
            const lemma = card.vocab?.lemma || card.lemma || '미상';
            
            // lemma별 첫 학습만 기록
            if (!wordFirstAttempts[lemma]) {
                // 정답/오답 여부 판단
                let isCorrect = false;
                if (card.todayFirstResult !== null && card.todayFirstResult !== undefined) {
                    isCorrect = card.todayFirstResult === true;
                } else if (card.isTodayStudy && card.stage !== undefined) {
                    // 오늘 처음 학습한 카드는 stage > 0이면 정답
                    isCorrect = card.stage > 0;
                }
                
                wordFirstAttempts[lemma] = {
                    word: lemma,
                    isCorrect,
                    folderId: card.folderId,
                    time: card.studiedAt || new Date().toISOString()
                };
            }
        });

        // 서버 제공 통계를 사용 (가장 정확함)
        const totalAttempts = todayStudyLog.stats?.todayTotalAttempts || actualStudyCount;
        const errorRate = todayStudyLog.stats?.errorRate || 0;

        return { 
            wordFirstAttempts,
            totalAttempts, 
            errorRate,
            isEstimated: false
        };
    };

    const { wordFirstAttempts, totalAttempts, errorRate, isEstimated } = processTodayStudyData();

    // 🔔 기존 알림 문구 (폴더 시스템용)
    const alarmText = useMemo(() => {
        if (!alarm.totalDue) return null;
        const when = alarm.nextAlarmAtKst ? ` (다음 알림: ${alarm.nextAlarmAtKst})` : '';
        return `오늘 미학습 ${alarm.totalDue}개가 남았습니다.${when}`;
    }, [alarm]);
    
    // 🔔 새로운 Overdue 알림 컴포넌트
    const OverdueAlertBanner = () => {
        if (!srsStatus?.shouldShowAlarm || !srsStatus?.alarmInfo) return null;
        
        const { overdueCount, alarmInfo } = srsStatus;
        const { currentPeriod, nextAlarmAtKst, minutesToNextAlarm, periodProgress } = alarmInfo;
        
        return (
            <div className="alert alert-danger mb-4" role="alert">
                <div className="d-flex align-items-center justify-content-between">
                    <div className="flex-grow-1">
                        <div className="d-flex align-items-center mb-2">
                            <strong className="me-2">⚠️ 긴급 복습 알림</strong>
                            <span className="badge bg-dark text-white me-2">{overdueCount}개</span>
                            <span className="text-muted small">
                                알림 주기: {currentPeriod}
                            </span>
                        </div>
                        <div className="mb-2">
                            복습 기한이 임박한 단어가 <strong className="text-danger">{overdueCount}개</strong> 있습니다.
                            <br />
                            <small className="text-muted">
                                다음 알림: <strong>{nextAlarmAtKst}</strong> ({minutesToNextAlarm}분 후)
                            </small>
                        </div>
                        {/* 진행 바 */}
                        <div className="progress" style={{ height: '6px' }}>
                            <div 
                                className="progress-bar bg-danger" 
                                style={{ width: `${periodProgress}%` }}
                                title={`현재 알림 주기 ${periodProgress}% 경과`}
                            ></div>
                        </div>
                    </div>
                    <div className="ms-3">
                        <Link to="/srs/quiz" className="btn btn-danger">
                            <strong>지금 복습하기</strong>
                        </Link>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <main className="container py-4" style={{ overflow: 'visible' }}>
            {/* 환영 섹션 */}
            <section className="mb-4 p-4 rounded" style={{ backgroundColor: 'var(--bs-light)' }}>
                <h2 className="mb-1">Welcome, {user?.email}!</h2>
                <p className="text-muted">
                    현재 설정된 학습 레벨은 <strong>{cefrLevel}</strong> 입니다. 오늘도 꾸준히 학습해 보세요!
                </p>
            </section>

            {/* 🔔 긴급 Overdue 알림 배너 (우선순위 1) */}
            <OverdueAlertBanner />

            {/* 🔔 일반 폴더 알림 배너 (우선순위 2) */}
            {alarmText && !srsStatus?.shouldShowAlarm && (
                <div className="alert alert-warning d-flex align-items-center justify-content-between" role="alert">
                    <div>🔔 {alarmText}</div>
                    <div className="ms-3">
                        <Link to="/learn/vocab" className="btn btn-sm btn-warning">SRS로 이동</Link>
                    </div>
                </div>
            )}

            {/* 핵심 지표 */}
            <section className="row g-3 mb-4" style={{ overflow: 'visible' }}>
                <div className="col-md-6 col-lg-3">
                    <StatCard
                        title="오늘 학습할 카드"
                        value={stats.srsQueue}
                        loading={loading}
                        icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-stack" viewBox="0 0 16 16"><path d="m14.12 10.163 1.715.858c.22.11.22.424 0 .534L8.267 15.34a.598.598 0 0 1-.534 0L.165 11.555a.299.299 0 0 1 0-.534l1.716-.858 5.317 2.659c.505.252 1.1.252 1.604 0l5.317-2.66zM7.733.063a.598.598 0 0 1 .534 0l7.568 3.784a.3.3 0 0 1 0 .535L8.267 8.165a.598.598 0 0 1-.534 0L.165 4.382a.299.299 0 0 1 0-.535L7.733.063z" /></svg>}
                    />
                </div>
                <div className="col-md-6 col-lg-3">
                    <StatCard
                        title="오답 노트 단어"
                        value={stats.odatNote}
                        loading={loading}
                        icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-journal-x" viewBox="0 0 16 16"><path fillRule="evenodd" d="M6.146 6.146a.5.5 0 0 1 .708 0L8 7.293l1.146-1.147a.5.5 0 1 1 .708.708L8.707 8l1.147 1.146a.5.5 0 0 1-.708.708L8 8.707l-1.146 1.147a.5.5 0 0 1-.708-.708L7.293 8 6.146 6.854a.5.5 0 0 1 0-.708z" /><path d="M3 0h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-1h1v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v1H1V2a2 2 0 0 1 2-2z" /><path d="M1 5v-.5a.5.5 0 0 1 1 0V5h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1H1zm0 3v-.5a.5.5 0 0 1 1 0V8h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1H1zm0 3v-.5a.5.5 0 0 1 1 0v.5h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1H1z" /></svg>}
                    />
                </div>
                <div className="col-md-6 col-lg-3">
                    <StatCard
                        title="마스터 한 단어"
                        value={stats.masteredWords}
                        loading={loading}
                        icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-award" viewBox="0 0 16 16"><path d="M9.669.864 8 0 6.331.864l-1.858.282-.842 1.68-1.337 1.32L2.6 6l-.306 1.854 1.337 1.32.842 1.68 1.858.282L8 12l1.669-.864 1.858-.282.842-1.68 1.337-1.32L13.4 6l.306-1.854-1.337-1.32-.842-1.68L9.669.864zm1.196 1.193.684 1.365 1.086 1.072L12.387 6l.248 1.506-1.086 1.072-.684 1.365-1.51.229L8 10.874l-1.355-.702-1.51-.229-.684-1.365-1.086-1.072L3.614 6l-.25-1.506 1.087-1.072.684-1.365 1.51-.229L8 1.126l1.356.702 1.509.229z"/><path d="M4 11.794V16l4-1 4 1v-4.206l-2.018.306L8 13.126 6.018 12.1 4 11.794z"/></svg>}
                        showDetails={stats.masteredWords > 0}
                        onDetailsClick={() => setShowMasteredDetails(!showMasteredDetails)}
                        detailsButtonRef={masteredButtonRef}
                    />
                </div>
                <div className="col-md-6 col-lg-3" style={{ overflow: 'visible' }}>
                    {/* 연속학습 카드 (SRS 대시보드와 동일한 스타일) */}
                    <div className="card h-100" style={{ overflow: 'visible' }}>
                        <div className="card-body">
                            {loading ? (
                                <div className="text-center">
                                    <div className="spinner-border spinner-border-sm" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : streakInfo ? (
                                <>
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
                                    <div className="border-top pt-3 position-relative">
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
                                                ref={dropdownButtonRef}
                                                className="btn btn-sm btn-outline-secondary"
                                                onClick={() => setShowStudyDetails(!showStudyDetails)}
                                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                            >
                                                {showStudyDetails ? '숨기기' : '상세보기'} {showStudyDetails ? '▲' : '▼'}
                                            </button>
                                        </div>
                                        
                                    </div>
                                </>
                            ) : (
                                <div className="text-center">
                                    <span className="text-muted">연속학습 정보를 불러올 수 없습니다.</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* 빠른 시작 */}
            <section style={{ overflow: 'visible' }}>
                <h4 className="mb-3">빠른 시작</h4>
                <div className="row g-3" style={{ overflow: 'visible' }}>
                    <div className="col-md-6">
                        <div className="card">
                            <div className="card-body">
                                <h5 className="card-title">SRS 학습</h5>
                                <p className="card-text text-muted">오늘 복습할 단어들을 Leitner 시스템으로 학습합니다.</p>
                                <button 
                                    className="btn btn-primary"
                                    onClick={async () => {
                                        try {
                                            // 모든 overdue 카드의 vocabId 조회
                                            const availableData = await fetchJSON(`/srs/available`, withCreds());
                                            
                                            if (Array.isArray(availableData?.data) && availableData.data.length > 0) {
                                                // overdue 카드들의 vocabId 추출
                                                const vocabIds = availableData.data
                                                    .map(card => card.srsfolderitem?.[0]?.vocabId || card.srsfolderitem?.[0]?.vocab?.id)
                                                    .filter(Boolean);
                                                
                                                if (vocabIds.length > 0) {
                                                    // learn/vocab 시스템으로 리다이렉트 (전체 overdue 모드)
                                                    window.location.href = `/learn/vocab?mode=all_overdue&selectedItems=${vocabIds.join(',')}`;
                                                } else {
                                                    alert('복습할 단어가 없습니다.');
                                                }
                                            } else {
                                                alert('복습할 단어가 없습니다.');
                                            }
                                        } catch (error) {
                                            console.error('Failed to start SRS learning:', error);
                                            alert('학습을 시작할 수 없습니다.');
                                        }
                                    }}
                                >
                                    학습 시작
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-6">
                        <div className="card">
                            <div className="card-body">
                                <h5 className="card-title">오답 노트</h5>
                                <p className="card-text text-muted">이전에 틀렸던 단어들을 집중적으로 다시 학습합니다.</p>
                                <Link to="/odat-note" className="btn btn-danger">오답 확인</Link>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-6">
                        <div className="card">
                            <div className="card-body">
                                <h5 className="card-title">내 단어장</h5>
                                <p className="card-text text-muted">직접 추가한 단어들을 관리하고, 폴더별로 학습합니다.</p>
                                <Link to="/my-wordbook" className="btn btn-outline-secondary">단어장 가기</Link>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-6">
                        <div className="card">
                            <div className="card-body">
                                <h5 className="card-title">AI 튜터</h5>
                                <p className="card-text text-muted">AI와 자유롭게 대화하며 영어 실력을 향상시키세요.</p>
                                <Link to="/tutor" className="btn btn-outline-secondary">튜터와 대화</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 마스터된 단어 모달 */}
            {showMasteredDetails && createPortal(
                <div 
                    style={{ 
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 999999,
                        padding: '20px'
                    }}
                    onClick={() => setShowMasteredDetails(false)}
                >
                    <div 
                        style={{ 
                            backgroundColor: '#ffffff',
                            border: '2px solid #ffc107',
                            borderRadius: '0.5rem',
                            boxShadow: '0 1rem 3rem rgba(255, 193, 7, 0.3)',
                            fontSize: '0.9rem',
                            maxHeight: '80vh',
                            overflowY: 'auto',
                            width: '100%',
                            maxWidth: '700px',
                            position: 'relative'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 모달 헤더 */}
                        <div className="d-flex justify-content-between align-items-center p-3 border-bottom bg-warning bg-opacity-10">
                            <h5 className="mb-0 text-warning">🏆 마스터한 단어들</h5>
                            <button 
                                className="btn-close" 
                                onClick={() => setShowMasteredDetails(false)}
                                aria-label="Close"
                            ></button>
                        </div>
                        
                        {/* 모달 바디 */}
                        <div className="p-3">
                            {masteredCards.length > 0 ? (
                                <>
                                    <div className="mb-3 text-center">
                                        <small className="text-muted">
                                            총 {masteredCards.length}개의 단어를 마스터했습니다! 🎉
                                        </small>
                                    </div>
                                    <div className="row g-2">
                                        {masteredCards
                                            .sort((a, b) => new Date(b.masteredAt) - new Date(a.masteredAt))
                                            .map((card, index) => {
                                                const vocab = card.srsfolderitem?.[0]?.vocab || {};
                                                const masterCycles = card.masterCycles || 1;
                                                
                                                return (
                                                    <div key={card.id || index} className="col-sm-6 col-md-4">
                                                        <div className="card h-100 border-warning bg-light position-relative">
                                                            {/* 무지개 별 */}
                                                            <RainbowStar 
                                                                size="small" 
                                                                cycles={masterCycles} 
                                                                className="position-absolute top-0 end-0 m-2"
                                                            />
                                                            
                                                            <div className="card-body p-2">
                                                                <h6 className="card-title mb-1" style={{ marginRight: '30px' }}>
                                                                    {vocab.lemma || 'Unknown'}
                                                                </h6>
                                                                {vocab.pos && (
                                                                    <small className="text-muted">{vocab.pos}</small>
                                                                )}
                                                                {vocab.ko_gloss && (
                                                                    <p className="card-text small mb-1">
                                                                        {vocab.ko_gloss.slice(0, 50)}
                                                                        {vocab.ko_gloss.length > 50 ? '...' : ''}
                                                                    </p>
                                                                )}
                                                                <div className="text-warning small">
                                                                    🏆 {dayjs(card.masteredAt).format('MM/DD')} 마스터
                                                                </div>
                                                                {masterCycles > 1 && (
                                                                    <div className="text-success small">
                                                                        ⭐ {masterCycles}회 마스터
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        }
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-4">
                                    <span className="text-muted h5">🌟 아직 마스터한 단어가 없습니다.</span>
                                    <br />
                                    <small className="text-muted">꾸준히 학습해서 첫 마스터를 달성해보세요!</small>
                                </div>
                            )}
                        </div>
                        
                        {/* 모달 푸터 */}
                        <div className="p-3 border-top text-center bg-warning bg-opacity-10">
                            <button 
                                className="btn btn-warning btn-sm"
                                onClick={() => setShowMasteredDetails(false)}
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* 오늘 학습 단어 모달 */}
            {showStudyDetails && createPortal(
                <div 
                    style={{ 
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 999999,
                        padding: '20px'
                    }}
                    onClick={() => setShowStudyDetails(false)}
                >
                    <div 
                        style={{ 
                            backgroundColor: '#ffffff',
                            border: '2px solid #dee2e6',
                            borderRadius: '0.5rem',
                            boxShadow: '0 1rem 3rem rgba(0, 0, 0, 0.175)',
                            fontSize: '0.9rem',
                            maxHeight: '80vh',
                            overflowY: 'auto',
                            width: '100%',
                            maxWidth: '500px',
                            position: 'relative'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 모달 헤더 */}
                        <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
                            <h5 className="mb-0 text-primary">📊 오늘 학습한 단어들</h5>
                            <button 
                                className="btn-close" 
                                onClick={() => setShowStudyDetails(false)}
                                aria-label="Close"
                            ></button>
                        </div>
                        
                        {/* 모달 바디 */}
                        <div className="p-3">
                            {Object.keys(wordFirstAttempts || {}).length > 0 ? (
                                <>
                                    <div className="mb-3">
                                        <small className="text-muted">
                                            총 {Object.keys(wordFirstAttempts || {}).length}개 단어 | 
                                            정답: {Object.values(wordFirstAttempts || {}).filter(a => a.isCorrect).length}개 | 
                                            오답: {Object.values(wordFirstAttempts || {}).filter(a => !a.isCorrect).length}개
                                        </small>
                                    </div>
                                    <div className="d-flex flex-wrap gap-2">
                                        {/* lemma별 첫 학습만 표시 */}
                                        {Object.values(wordFirstAttempts)
                                            .sort((a, b) => new Date(b.time) - new Date(a.time))
                                            .map((attempt, index) => {
                                                // 첫 학습 결과에 따른 스타일
                                                const badgeClass = attempt.isCorrect ? 'bg-success' : 'bg-danger';
                                                const icon = attempt.isCorrect ? '✅' : '❌';
                                                
                                                return (
                                                    <span key={`${attempt.word}_${index}`} className={`badge ${badgeClass} mb-2 me-1`} style={{fontSize: '0.8rem', display: 'inline-block', whiteSpace: 'nowrap', padding: '0.5rem 0.75rem'}}>
                                                        {icon} {attempt.word} <small className="opacity-75">[F{attempt.folderId}]</small>
                                                    </span>
                                                );
                                            })
                                        }
                                    </div>
                                </>
                            ) : totalAttempts > 0 && isEstimated ? (
                                <div className="text-center py-4">
                                    <span className="text-info h5">📚 {totalAttempts}회 학습 완료!</span>
                                    <br />
                                    <small className="text-muted">상세 학습 기록을 불러올 수 없습니다.</small>
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <span className="text-muted h5">🦜 아직 학습한 단어가 없습니다.</span>
                                    <br />
                                    <small className="text-muted">SRS 학습을 시작해보세요!</small>
                                </div>
                            )}
                        </div>
                        
                        {/* 모달 푸터 */}
                        <div className="p-3 border-top text-center">
                            <button 
                                className="btn btn-secondary btn-sm"
                                onClick={() => setShowStudyDetails(false)}
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </main>
    );
}
