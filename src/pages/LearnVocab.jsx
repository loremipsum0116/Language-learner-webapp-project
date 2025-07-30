// src/pages/LearnVocab.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { fetchJSON, withCreds } from '../api/client';
import Pron from '../components/Pron';

const isAbortError = (e) =>
    e?.name === 'AbortError' || e?.message?.toLowerCase?.().includes('abort');

function useQuery() {
    const { search } = useLocation();
    return useMemo(() => new URLSearchParams(search), [search]);
}

export default function LearnVocab() {
    const q = useQuery();
    const idsParam = q.get('ids');          // "1,2,3"
    const mode = q.get('mode');             // 'odat' | 'flash' | null
    const autoParam = q.get('auto');        // "1" | null  ← URL용

    const [queue, setQueue] = useState([]);
    const [idx, setIdx] = useState(0);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [err, setErr] = useState(null);
    const [userAnswer, setUserAnswer] = useState(null);
    const [feedback, setFeedback] = useState(null); // {status:'pass'|'fail', answer}
    const [auto, setAuto] = useState(autoParam === '1'); // ← 자동 넘김 on/off (URL ?auto=1이면 시작시 켬)
    const [currentPron, setCurrentPron] = useState(null); // {ipa, ipaKo}
    const [showAddMenu, setShowAddMenu] = useState(false); // (미사용 중이면 추후 제거 가능)

    // URL이 바뀌면 auto 상태 동기화(선택)
    useEffect(() => {
        setAuto(autoParam === '1');
    }, [autoParam]);

    useEffect(() => {
        const ac = new AbortController();
        (async () => {
            try {
                setLoading(true); setErr(null);
                setIdx(0); setUserAnswer(null); setFeedback(null);

                let data;
                if (mode === 'odat') {
                    ({ data } = await fetchJSON(
                        '/odat-note/queue?limit=100',
                        withCreds({ signal: ac.signal }),
                        20000
                    ));
                } else if (idsParam) {
                    const vocabIds = idsParam.split(',').map(n => Number(n)).filter(Number.isFinite);
                    ({ data } = await fetchJSON(
                        '/quiz/by-vocab',
                        withCreds({ method: 'POST', body: JSON.stringify({ vocabIds }), signal: ac.signal }),
                        20000
                    ));
                } else {
                    ({ data } = await fetchJSON('/srs/queue?limit=100', withCreds({ signal: ac.signal }), 15000));
                }
                setQueue(Array.isArray(data) ? data : []);
            } catch (e) {
                if (!isAbortError(e)) setErr(e);
            } finally {
                if (!ac.signal.aborted) setLoading(false);
            }
        })();
        return () => ac.abort();
    }, [idsParam, mode]);

    const current = queue[idx];

    // 현재 카드 발음 정보 로드(가능한 경우)
    useEffect(() => {
        setCurrentPron(null);
        if (!current) return;
        const ac = new AbortController();
        (async () => {
            try {
                if (current.vocabId) {
                    const { data } = await fetchJSON(`/vocab/${current.vocabId}`, withCreds({ signal: ac.signal }), 15000);
                    setCurrentPron({
                        ipa: data?.dictMeta?.ipa || null,
                        ipaKo: data?.dictMeta?.ipaKo || null,
                    });
                    return;
                }
                if (current.question) {
                    const { data } = await fetchJSON(`/vocab/search?q=${encodeURIComponent(current.question)}`, withCreds({ signal: ac.signal }), 15000);
                    const hit = Array.isArray(data) ? data.find(v => v.lemma?.toLowerCase() === current.question.toLowerCase()) : null;
                    setCurrentPron({
                        ipa: hit?.dictMeta?.ipa || null,
                        ipaKo: hit?.dictMeta?.ipaKo || null,
                    });
                }
            } catch (_) { /* no-op */ }
        })();
        return () => ac.abort();
    }, [current?.question, current?.vocabId]);

    const submit = async () => {
        if (!current || !userAnswer) return;
        const ok = userAnswer === current.answer;
        setFeedback({ status: ok ? 'pass' : 'fail', answer: current.answer });

        if (current.cardId) {
            try {
                await fetchJSON('/srs/answer', withCreds({
                    method: 'POST',
                    body: JSON.stringify({ cardId: current.cardId, result: ok ? 'pass' : 'fail' }),
                }));
            } catch (e) {
                if (!isAbortError(e)) console.error('정답 기록 실패:', e);
            }
        }
    };

    const next = () => { setIdx(i => i + 1); setUserAnswer(null); setFeedback(null); };

    // ★ 자동재생: mode=flash && auto=true 이면 3초마다 다음 카드
    useEffect(() => {
        if (mode !== 'flash' || !auto) return;
        if (!current) return;
        const t = setInterval(() => {
            setIdx(i => (i + 1 < queue.length ? i + 1 : i)); // 마지막에서 정지
        }, 3000);
        return () => clearInterval(t);
    }, [mode, auto, current, queue.length]);

    const reload = async () => {
        try {
            setReloading(true);
            if (mode === 'odat') {
                const { data } = await fetchJSON('/odat-note/queue?limit=100', withCreds(), 20000);
                setQueue(Array.isArray(data) ? data : []);
            } else if (idsParam) {
                const vocabIds = idsParam.split(',').map(n => Number(n)).filter(Number.isFinite);
                const { data } = await fetchJSON('/quiz/by-vocab', withCreds({
                    method: 'POST', body: JSON.stringify({ vocabIds })
                }), 20000);
                setQueue(Array.isArray(data) ? data : []);
            } else {
                const { data } = await fetchJSON('/srs/queue?limit=100', withCreds(), 15000);
                setQueue(Array.isArray(data) ? data : []);
            }
            setIdx(0); setUserAnswer(null); setFeedback(null);
        } finally { setReloading(false); }
    };

    if (loading) return <main className="container py-4"><h4>퀴즈 로딩 중…</h4></main>;
    if (err) {
        return (
            <main className="container py-4">
                <div className="alert alert-danger">퀴즈를 불러오지 못했습니다. {err.status ? `(HTTP ${err.status})` : ''}</div>
                <button className="btn btn-outline-secondary" onClick={reload} disabled={reloading}>
                    {reloading ? '불러오는 중…' : '다시 시도'}
                </button>
            </main>
        );
    }
    if (!current) {
        return (
            <main className="container py-4" style={{ maxWidth: 720 }}>
                <div className="p-4 bg-light rounded text-center">
                    <h4 className="mb-2">학습 완료</h4>
                    <div className="d-flex justify-content-center gap-2">
                        <button className="btn btn-primary" onClick={reload} disabled={reloading}>
                            {reloading ? '불러오는 중…' : '새로 불러오기'}
                        </button>
                        <Link to="/my-wordbook" className="btn btn-outline-secondary">내 단어장</Link>
                    </div>
                </div>
            </main>
        );
    }

    // ★ 플래시카드 모드 렌더링 (보기 전용 + 발음 표시 + 자동재생 + 멈춤/재생)
    if (mode === 'flash') {
        return (
            <main className="container py-4" style={{ maxWidth: 720 }}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                    <strong>플래시카드 (선택 {queue.length}개)</strong>
                    <div className="d-flex align-items-center gap-2">
                        <button
                            className={`btn btn-sm ${auto ? 'btn-outline-warning' : 'btn-outline-primary'}`}
                            onClick={() => setAuto(a => !a)}
                            title={auto ? '자동 넘김 멈춤' : '자동 넘김 시작'}
                        >
                            {auto ? '⏸ 멈춤' : '▶ 재생'}
                        </button>
                        <span className="text-muted">{idx + 1} / {queue.length}</span>
                    </div>
                </div>
                <div className="card">
                    <div className="card-body text-center p-5">
                        <h2 className="display-5 mb-3" lang="de">{current.question}</h2>
                        <Pron ipa={currentPron?.ipa} ipaKo={currentPron?.ipaKo} />
                        <p className="lead mt-3">뜻: {current.answer}</p>
                    </div>
                    <div className="card-footer d-flex gap-2">
                        <button className="btn btn-outline-secondary w-100" onClick={() => setIdx(i => Math.max(0, i - 1))}>← 이전</button>
                        <button className="btn btn-primary w-100" onClick={() => setIdx(i => Math.min(queue.length - 1, i + 1))}>다음 →</button>
                    </div>
                </div>
            </main>
        );
    }

    // 진행 중 화면 (MCQ)
    return (
        <main className="container py-4" style={{ maxWidth: 720 }}>
            <div className="d-flex justify-content-between align-items-center mb-2">
                <strong>{mode === 'odat' ? '오답노트 퀴즈' : 'SRS 퀴즈'}</strong>
                <div className="d-flex align-items-center gap-2">
                    <Link to="/odat-note" className="btn btn-sm btn-outline-secondary">오답노트</Link>
                    <span className="text-muted">{idx + 1} / {queue.length}</span>
                </div>
            </div>

            <div className="card">
                <div className="card-body text-center p-4">
                    <h2 className="display-5 mb-1" lang="de">{current.question}</h2>
                    <Pron ipa={currentPron?.ipa} ipaKo={currentPron?.ipaKo} />
                    <Pron ipa={current.pron?.ipa} ipaKo={current.pron?.ipaKo} />

                    {!feedback && (
                        <div className="d-grid gap-2 col-8 mx-auto mt-3">
                            {current.options.map(opt => (
                                <button
                                    key={opt}
                                    className={`btn btn-lg ${userAnswer === opt ? 'btn-primary' : 'btn-outline-primary'}`}
                                    onClick={() => setUserAnswer(opt)}
                                >
                                    {opt}
                                </button>
                            ))}
                            <button className="btn btn-success btn-lg mt-2" disabled={!userAnswer} onClick={submit}>
                                제출하기
                            </button>
                        </div>
                    )}

                    {feedback && (
                        <div className={`mt-3 p-3 rounded ${feedback.status === 'pass' ? 'bg-success-subtle' : 'bg-danger-subtle'}`}>
                            <h5>{feedback.status === 'pass' ? '정답입니다!' : '오답입니다'}</h5>
                            <p className="lead">정답: {feedback.answer}</p>
                        </div>
                    )}
                </div>

                <div className="card-footer p-3">
                    {feedback && <button className="btn btn-primary w-100" onClick={next}>다음 →</button>}
                </div>
            </div>
        </main>
    );
}
