// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchJSON, withCreds, isAbortError } from '../api/client';
import { SrsApi } from '../api/srs';

// dayjs(KST 라벨용)
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tz from 'dayjs/plugin/timezone';
dayjs.extend(utc); dayjs.extend(tz);
const todayKst = () => dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');

function StatCard({ title, value, icon, link, linkText, loading }) {
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
                {link && <Link to={link}>{linkText}</Link>}
            </div>
        </div>
    );
}

export default function Dashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState({ srsQueue: 0, odatNote: 0, totalWords: 0 });
    const [loading, setLoading] = useState(true);

    // 🔔 오늘(KST) 루트 폴더의 미학습 합계 + 가장 이른 알림시각
    const [alarm, setAlarm] = useState({ totalDue: 0, nextAlarmAtKst: null, rootId: null, children: [] });

    useEffect(() => {
        const ac = new AbortController();

        (async () => {
            try {
                setLoading(true);

                // 1) 카드/오답/전체 통계 병렬 로딩(기존 엔드포인트 유지)
                const [srsQueueRes, odatNoteRes, allCardsRes] = await Promise.all([
                    fetchJSON('/srs/queue?limit=500', withCreds({ signal: ac.signal })),
                    fetchJSON('/odat-note/list', withCreds({ signal: ac.signal })),
                    fetchJSON('/srs/all-cards', withCreds({ signal: ac.signal })),
                ]);

                if (!ac.signal.aborted) {
                    setStats({
                        srsQueue: Array.isArray(srsQueueRes.data) ? srsQueueRes.data.length : 0,
                        odatNote: Array.isArray(odatNoteRes.data) ? odatNoteRes.data.length : 0,
                        totalWords: Array.isArray(allCardsRes.data) ? allCardsRes.data.length : 0,
                    });
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
                    setAlarm({ totalDue: 0, nextAlarmAtKst: null, rootId: null, children: [] });
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

    // 🔔 보여줄 알림 문구
    const alarmText = useMemo(() => {
        if (!alarm.totalDue) return null;
        const when = alarm.nextAlarmAtKst ? ` (다음 알림: ${alarm.nextAlarmAtKst})` : '';
        return `오늘 미학습 ${alarm.totalDue}개가 남았습니다.${when}`;
    }, [alarm]);

    return (
        <main className="container py-4">
            {/* 환영 섹션 */}
            <section className="mb-4 p-4 rounded" style={{ backgroundColor: 'var(--bs-light)' }}>
                <h2 className="mb-1">Willkommen, {user?.email}!</h2>
                <p className="text-muted">
                    현재 설정된 학습 레벨은 <strong>{cefrLevel}</strong> 입니다. 오늘도 꾸준히 학습해 보세요!
                </p>
            </section>

            {/* 🔔 오늘 알림 배너 */}
            {alarmText && (
                <div className="alert alert-warning d-flex align-items-center justify-content-between" role="alert">
                    <div>🔔 {alarmText}</div>
                    <div className="ms-3">
                        <Link to="/learn/vocab" className="btn btn-sm btn-warning">SRS로 이동</Link>
                    </div>
                </div>
            )}

            {/* 핵심 지표 */}
            <section className="row g-3 mb-4">
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
                        title="총 학습 단어"
                        value={stats.totalWords}
                        loading={loading}
                        icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-body-text" viewBox="0 0 16 16"><path fillRule="evenodd" d="M0 .5A.5.5 0 0 1 .5 0h4a.5.5 0 0 1 0 1h-4A.5.5 0 0 1 0 .5Zm0 2A.5.5 0 0 1 .5 2h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5Zm9 0a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5Zm-9 2A.5.5 0 0 1 .5 4h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5Zm5 0a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5Zm-5 2A.5.5 0 0 1 .5 6h1a.5.5 0 0 1 0 1h-1A.5.5 0 0 1 0 6.5Zm3 0a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5Zm-3 2A.5.5 0 0 1 .5 8h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5Zm9 0a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5Zm-9 2a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5Zm3 0a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5Zm-3 2a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5Zm5 0a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5Z" /></svg>}
                    />
                </div>
                <div className="col-md-6 col-lg-3">
                    <StatCard
                        title="연속 학습일"
                        value={user?.streak || 0}
                        loading={loading}
                        icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-fire" viewBox="0 0 16 16"><path d="M8 16c3.314 0 6-2 6-5.5 0-1.5-.5-4-2.5-6 .25 1.5-1.25 2-1.25 2C11 4 9 .5 6 0c.357 2 .5 4-2 6-1.25 1-2 2.729-2 4.5C2 14 4.686 16 8 16Zm0-1c-1.657 0-3-1-3-2.75 0-.75.25-2 1.25-3C6.125 10 7 8.5 7 8.5c0-1 .5-3-1.5-5 .5 1.5-1 2.5-1 2.5C5 7.5 4 9 4 10.5c0 1.5 1.5 2.5 3 2.5.5 0 1-.5 1-1 .5 1 1.5 1.5 2.5 1.5C12 14 11 13 11 11.5c0-1.5-1-2.5-1-2.5s.5 1.5-1.5 2.5c.5-1 1.5-2.5 1.5-3.5 0-1-1-2.5-2.5-2.5s-2.5 1.5-2.5 2.5c0 .5.5 1.5 1.5 2.5C7 11.5 7 12.5 7 13c0 1 1 1.5 2 1.5 1 0 1.5-.5 1.5-1.5 0-.5-.5-1-1.5-1s-1.5.5-1.5 1.5c0 .5.5 1 1.5 1z" /></svg>}
                    />
                </div>
            </section>

            {/* 빠른 시작 */}
            <section>
                <h4 className="mb-3">빠른 시작</h4>
                <div className="row g-3">
                    <div className="col-md-6">
                        <div className="card">
                            <div className="card-body">
                                <h5 className="card-title">SRS 학습</h5>
                                <p className="card-text text-muted">오늘 복습할 단어들을 Leitner 시스템으로 학습합니다.</p>
                                <Link to="/learn/vocab" className="btn btn-primary">학습 시작</Link>
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
        </main>
    );
}
