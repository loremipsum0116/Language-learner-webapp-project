import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { fetchJSON, withCreds, API_BASE } from '../api/client';
import Pron from '../components/Pron';
import { useAuth } from '../context/AuthContext';

const getCefrBadgeColor = (level) => {
    switch (level) {
        case 'A1': return 'bg-danger';
        case 'A2': return 'bg-warning text-dark';
        case 'B1': return 'bg-success';
        case 'B2': return 'bg-info text-dark';
        case 'C1': return 'bg-primary';
        default: return 'bg-secondary';
    }
};
const getPosBadgeColor = (pos) => {
    if (!pos) return 'bg-secondary';
    switch (pos.toLowerCase().trim()) {
        case 'noun': return 'bg-primary';
        case 'verb': return 'bg-success';
        case 'adjective': return 'bg-warning text-dark';
        case 'adverb': return 'bg-info text-dark';
        default: return 'bg-secondary';
    }
};
const isAbortError = (e) => e?.name === 'AbortError' || e?.message?.toLowerCase?.().includes('abort');

function safeFileName(str) {
    if (!str) return '';
    return encodeURIComponent(str.toLowerCase().replace(/\s+/g, '_'));
}

function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

function useQuery() {
    const { search } = useLocation();
    return useMemo(() => new URLSearchParams(search), [search]);
}

export default function LearnVocab() {
    const navigate = useNavigate();
    const location = useLocation();
    const { refreshSrsIds, removeSrsId } = useAuth();
    const q = useQuery();
    const idsParam = q.get('ids');
    const mode = q.get('mode');
    const autoParam = q.get('auto');

    const [flipped, setFlipped] = useState(false);
    const audioRef = useRef(null);
    const [currentDetail, setCurrentDetail] = useState(null);
    const [queue, setQueue] = useState([]);
    const [sessionCards, setSessionCards] = useState([]);  // ← 이번 세션 전체 백업
    const [idx, setIdx] = useState(0);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const [userAnswer, setUserAnswer] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [auto, setAuto] = useState(autoParam === '1');
    const [isSubmitting, setIsSubmitting] = useState(false);
    // 오답 vocabId 모음
    const [wrongIds, setWrongIds] = useState([]);
    // ★ 1. 퀴즈 데이터를 불러오는 로직을 별도 함수로 분리 (재사용 목적)
    const fetchQueue = useCallback(async (signal) => {
        try {
            setLoading(true); setErr(null);
            setIdx(0); setUserAnswer(null); setFeedback(null);
            let data;
            let isDefaultSrsMode = false;

            if (mode === 'odat' && location.state?.cardIds) {
                const cardIds = location.state.cardIds;
                ({ data } = await fetchJSON('/odat-note/quiz', withCreds({ method: 'POST', body: JSON.stringify({ cardIds }), signal }), 20000));
            } else if (mode === 'odat') {
                ({ data } = await fetchJSON('/odat-note/queue?limit=100', withCreds({ signal }), 20000));
            } else if (idsParam) {
                const vocabIds = idsParam.split(',').map(n => Number(n)).filter(Number.isFinite);
                ({ data } = await fetchJSON('/quiz/by-vocab', withCreds({ method: 'POST', body: JSON.stringify({ vocabIds }), signal }), 20000));
            } else {
                isDefaultSrsMode = true;
                ({ data } = await fetchJSON('/srs/queue?limit=100', withCreds({ signal }), 15000));
            }

            let fetchedQueue = Array.isArray(data) ? data : [];
            if (mode === 'flash') {
                fetchedQueue = shuffleArray(fetchedQueue);
            }
            setQueue(fetchedQueue);
            setSessionCards(fetchedQueue);

            if (isDefaultSrsMode && fetchedQueue.length === 0) {
                if (window.confirm("현재 학습할 SRS 문제가 없습니다. 단어를 추가하시겠습니까?")) {
                    navigate(window.confirm("내 단어장으로 이동하시겠습니까?\n(취소 시 '전체 단어장'으로 이동합니다.)") ? '/my-wordbook' : '/vocab');
                } else {
                    navigate('/learn');
                }
            }
        } catch (e) {
            if (!isAbortError(e)) setErr(e);
        } finally {
            if (!signal || !signal.aborted) setLoading(false);
        }
    }, [idsParam, mode, navigate, location.state]);

    useEffect(() => {
        const ac = new AbortController();
        fetchQueue(ac.signal);
        return () => ac.abort();
    }, [fetchQueue]);

    const current = queue[idx];

    // ★ 2. 퀴즈 완료 시(current가 없을 때) SRS 상태를 전역으로 새로고침
    useEffect(() => {
        if (!loading && !current) {
            console.log("Quiz finished, refreshing SRS IDs globally...");
            refreshSrsIds();
        }
    }, [loading, current, refreshSrsIds]);

    const stopAudio = () => { if (audioRef.current) { try { audioRef.current.pause(); } catch { /* no-op */ } audioRef.current = null; } };
    const playUrl = (url) => { /* ... */ };

    useEffect(() => { setFlipped(false); stopAudio(); }, [idx]);
    useEffect(() => {
        if (!current) { stopAudio(); return; }
        const ac = new AbortController();
        (async () => {
            try {
                if (current.vocabId) {
                    const { data } = await fetchJSON(`/vocab/${current.vocabId}`, withCreds({ signal: ac.signal }), 15000);
                    setCurrentDetail(data || null);
                }
            } catch (_) { /* no-op */ }
        })();
        return () => { ac.abort(); stopAudio(); };
    }, [current]);

    const submit = async () => {
        if (!current || !userAnswer || isSubmitting) return;
        setIsSubmitting(true);
        const isCorrect = userAnswer === current.answer;
        try {
            if (current.cardId) {
                await fetchJSON('/srs/answer', withCreds({ method: 'POST', body: JSON.stringify({ cardId: current.cardId, result: isCorrect ? 'pass' : 'fail', source: mode === 'odat' ? 'odatNote' : 'srs' }) }));
            }
        } catch (e) {
            if (!isAbortError(e)) { console.error('답변 제출 실패:', e); alert('답변을 기록하는 중 오류가 발생했습니다.'); }
        } finally {
            if (current?.vocabId) removeSrsId(current.vocabId);
            setFeedback({ status: isCorrect ? 'pass' : 'fail', answer: current.answer });

            /* ▼▼ 오답 처리: 버튼 상태 & 재학습 대비 ▼▼ */
            if (!isCorrect) {
                if (current.vocabId) setWrongIds(prev => [...prev, current.vocabId]);
                refreshSrsIds();        // vocab / 단어장 페이지 버튼 즉시 갱신
            }
            setIsSubmitting(false);
        }
    };

    const next = () => { setIdx(i => i + 1); setUserAnswer(null); setFeedback(null); };

    // ★ 3. '다시 학습하기'가 화면 인덱스만 초기화하는 대신, 데이터를 새로고침하도록 수정
    const handleRestart = () => {
        if (sessionCards.length === 0) {
            alert('이번 세션에 풀었던 카드가 없습니다.');
            return;
        }
        // ▶ cardId를 null 로 지워 서버 호출 대상에서 제외
        const cleanQueue = sessionCards.map(c => ({ ...c, cardId: null }));
        setQueue(shuffleArray(cleanQueue)); // 백업으로 새 큐
        setIdx(0);
        setFeedback(null);
        setUserAnswer(null);
    };

    const handleAddQueueToSrsAndLearn = async () => {
        try {
            const vocabIds = queue.map(item => item.vocabId).filter(Boolean);
            if (vocabIds.length === 0) { alert("학습할 단어가 없습니다."); return; }
            await fetchJSON('/srs/create-many', withCreds({ method: 'POST', body: JSON.stringify({ vocabIds }) }));
            alert(`${vocabIds.length}개의 단어가 SRS 학습 목록에 추가되었습니다. 지금 바로 학습을 시작합니다.`);
            navigate('/learn/vocab', { replace: true });
        } catch (e) {
            console.error("SRS 덱 추가 실패:", e);
            alert("SRS 학습으로 이동하는 데 실패했습니다.");
        }
    };

    if (loading) return <main className="container py-4"><h4>퀴즈 로딩 중…</h4></main>;
    if (err) return <main className="container py-4"><div className="alert alert-danger">퀴즈를 불러오지 못했습니다. {err.status ? `(HTTP ${err.status})` : ''}</div></main>;

    // ★ 4. 학습 완료 화면에서 모드에 따라 다른 버튼을 표시하도록 수정
    if (!current) {
        const isFromFlashcardOrSelection = mode === 'flash' || !!idsParam;
        return (
            <main className="container py-4" style={{ maxWidth: 720 }}>
                <div className="p-4 bg-light rounded text-center">
                    <h4 className="mb-2">🎉 학습 완료!</h4>
                    <p className="text-muted">학습을 모두 마쳤습니다. 다음 단계를 선택하세요.</p>
                    <div className="d-flex justify-content-center gap-3 mt-4">
                        <button className="btn btn-outline-secondary" onClick={handleRestart}>다시 학습하기</button>
                        {isFromFlashcardOrSelection ? (
                            <button className="btn btn-primary" onClick={handleAddQueueToSrsAndLearn}>
                                지금 단어들로 SRS 학습하기
                            </button>
                        ) : (
                            <Link to="/odat-note" className="btn btn-primary">
                                오답노트 가기
                            </Link>
                        )}
                    </div>
                </div>
            </main>
        );
    }

    const uniquePosList = [...new Set((current?.pos || '').split(',').map(p => p.trim()).filter(Boolean))];

    if (mode === 'flash') {
        return (
            <main className="container py-4" style={{ maxWidth: 720 }}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                    <strong>플래시카드 ({queue.length}개)</strong>
                    <span className="text-muted">{idx + 1} / {queue.length}</span>
                </div>
                <div className="card">
                    <div className="card-body text-center p-5 d-flex flex-column justify-content-center" role="button" onClick={() => setFlipped(f => !f)} style={{ minHeight: '40rem' }}>
                        {!flipped ? (
                            <>
                                <div className="d-flex justify-content-center align-items-center gap-2 mb-2">
                                    {current.levelCEFR && <span className={`badge ${getCefrBadgeColor(current.levelCEFR)}`}>{current.levelCEFR}</span>}
                                    {uniquePosList.map(p => p && p.toLowerCase() !== 'unk' && (<span key={p} className={`badge ${getPosBadgeColor(p)} fst-italic`}>{p}</span>))}
                                </div>
                                <h2 className="display-5" lang="en">{current.question}</h2>
                                <Pron ipa={current.pron?.ipa} ipaKo={current.pron?.ipaKo} />
                                <div className="text-muted mt-2">카드를 클릭하면 뜻이 표시됩니다.</div>
                            </>
                        ) : (
                            <>
                                <div className="lead mb-3"><strong>뜻:</strong> {current.answer}</div>
                                {currentDetail?.dictMeta?.examples && currentDetail.dictMeta.examples.length > 0 ? (
                                    <div className="text-start mx-auto mt-2" style={{ maxWidth: 560 }}>
                                        <h6 className="text-muted">예문</h6>
                                        {currentDetail.dictMeta.examples.map((meaningBlock, index) => (
                                            meaningBlock.definitions && meaningBlock.definitions.map((def, defIndex) => (
                                                def.examples && def.examples.length > 0 && (
                                                    <ul key={`${index}-${defIndex}`} className="list-unstyled ps-3">
                                                        {def.examples.map((ex, exIndex) => (
                                                            <li key={exIndex} className="mb-2">
                                                                <span lang="en">{ex.de}</span>
                                                                {ex.ko ? <div className="text-muted small">— {ex.ko}</div> : null}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )
                                            ))
                                        ))}
                                    </div>
                                ) : (<p className="text-muted small mt-4">(추가 예문 정보 없음)</p>)}
                            </>
                        )}
                    </div>
                    <div className="card-footer d-flex gap-2">
                        <button className="btn btn-outline-secondary w-25" onClick={() => { stopAudio(); setFlipped(false); setIdx(i => Math.max(0, i - 1)); }}>← 이전</button>
                        <button className="btn btn-primary w-75" onClick={() => { stopAudio(); setFlipped(false); setIdx(i => i + 1); }}>다음 →</button>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="container py-4" style={{ maxWidth: 720 }}>
            <div className="d-flex justify-content-between align-items-center mb-2">
                <strong>{mode === 'odat' ? '오답노트 퀴즈' : 'SRS 퀴즈'}</strong>
                <span className="text-muted">{idx + 1} / {queue.length}</span>
            </div>
            <div className="card">
                <div className="card-body text-center p-4">
                    <div className="d-flex justify-content-center align-items-center gap-2 mb-2">
                        {current.levelCEFR && <span className={`badge ${getCefrBadgeColor(current.levelCEFR)}`}>{current.levelCEFR}</span>}
                        {uniquePosList.map(p => p && p.toLowerCase() !== 'unk' && (<span key={p} className={`badge ${getPosBadgeColor(p)} fst-italic`}>{p}</span>))}
                    </div>
                    <h2 className="display-5" lang="en">{current.question}</h2>
                    <Pron ipa={current.pron?.ipa} ipaKo={current.pron?.ipaKo} />
                    {!feedback && (
                        <div className="d-grid gap-2 col-8 mx-auto mt-3">
                            {current.options.map(opt => (
                                <button key={opt} className={`btn btn-lg ${userAnswer === opt ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setUserAnswer(opt)} disabled={isSubmitting || feedback}>
                                    {opt}
                                </button>
                            ))}
                            <button className="btn btn-success btn-lg mt-2" disabled={!userAnswer || isSubmitting || feedback} onClick={submit}>
                                {isSubmitting ? '처리 중…' : '제출하기'}
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