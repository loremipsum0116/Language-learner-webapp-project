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
    const { refreshSrsIds } = useAuth();
    const q = useQuery();
    const idsParam = q.get('ids');
    const mode = q.get('mode');

    const autoParam = q.get('auto');          // ?auto=1이면 자동학습 모드
    const [auto, setAuto] = useState(autoParam === '1');   // 기본 false

    const [queue, setQueue] = useState([]);
    const [idx, setIdx] = useState(0);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [flipped, setFlipped] = useState(false);
    const audioRef = useRef(null);
    const [currentDetail, setCurrentDetail] = useState(null);
    const [userAnswer, setUserAnswer] = useState(null);

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
        return () => {
            ac.abort();
            refreshSrsIds();
        };
    }, [fetchQueue, refreshSrsIds]);

    const current = queue[idx];

    useEffect(() => {
        if (!loading && !current) {
            refreshSrsIds();
        }
    }, [loading, current, refreshSrsIds]);

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
        }
    };

    const playUrl = (url, type = 'vocab') => {
        if (!url) return;
        if (audioRef.current?.src?.endsWith(url)) {  // 같은 소스면 토글
            stopAudio();
            return;
        }
        stopAudio();
        const full = url.startsWith('/') ? `${API_BASE}${url}` : url;
        const audio = new Audio(full);
        audio.loop = auto;                // 자동학습 중엔 반복
        audio.onended = () => { if (!auto) stopAudio(); };
        audio.play().catch(console.error);
        audioRef.current = audio;
    };

    useEffect(() => {
        if (!auto) return;            // 수동 모드면 타이머 X
        // ① 5 초 뒤 카드 뒤집기
        const flipTimer = setTimeout(() => setFlipped(true), 5000);
        // ② 30 초 뒤 다음 카드로
        const nextTimer = setTimeout(() => {
            setFlipped(false);
            setIdx(i => i + 1);
        }, 30000);
        return () => {
            clearTimeout(flipTimer);
            clearTimeout(nextTimer);
        };
    }, [idx, auto]);

    useEffect(() => {
        if (!current) { stopAudio(); return; }
        // 예문 mp3가 있으면 그것부터, 없으면 vocab mp3
        const url =
            current.exampleAudio     // ex) /audio/examples/...
            || current.audio         // vocab 자체 mp3
            || currentDetail?.audio;
        if (url) playUrl(url);
        // currentDetail 로드 로직 그대로 유지 (IPA·예문 표시용)
    }, [current]);

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
                if (isCorrect) {
                    setQueue(prevQueue => {
                        const newQueue = [...prevQueue];
                        const currentItem = newQueue[idx];
                        if (currentItem) { newQueue[idx] = { ...currentItem, cardId: null }; }
                        return newQueue;
                    });
                }
            }
        } catch (e) {
            if (!isAbortError(e)) { console.error('답변 제출 실패:', e); alert('답변을 기록하는 중 오류가 발생했습니다.'); }
        } finally {
            setFeedback({ status: isCorrect ? 'pass' : 'fail', answer: current.answer });
            setIsSubmitting(false);
        }
    };

    const next = () => { setIdx(i => i + 1); setUserAnswer(null); setFeedback(null); };

    // ★ '다시 학습하기'는 이제 상태만 초기화합니다.
    const handleRestart = () => {
        setIdx(0);
        setUserAnswer(null);
        setFeedback(null);
        setFlipped(false);
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
                    <div>
                        <button
                            className={`btn btn-sm ${auto ? 'btn-warning' : 'btn-outline-secondary'}`}
                            onClick={() => {
                                setAuto(a => !a);
                                if (audioRef.current) audioRef.current.loop = !auto; // loop 동기화
                            }}
                        >
                            {auto ? '⏸ 자동멈춤' : '▶ 자동학습'}
                        </button>
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