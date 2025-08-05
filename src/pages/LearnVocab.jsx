import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { fetchJSON, withCreds, API_BASE } from '../api/client';
import Pron from '../components/Pron';

const isAbortError = (e) =>
    e?.name === 'AbortError' || e?.message?.toLowerCase?.().includes('abort');

// VocabDetailModal.jsx에서 사용된 safeFileName 함수와 동일하게 적용
function safeFileName(str) {
    return encodeURIComponent(str.toLowerCase().replace(/\s+/g, '_'));
}

// 배열을 무작위로 섞는 Fisher-Yates 알고리즘 함수
function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        // 남은 요소 중 하나를 선택
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        // 현재 요소와 교환
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
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
    const q = useQuery();
    const idsParam = q.get('ids');
    const mode = q.get('mode');
    const autoParam = q.get('auto');
    const [flipped, setFlipped] = useState(false);
    const [audioEl, setAudioEl] = useState(null);
    const [currentDetail, setCurrentDetail] = useState(null);
    const [queue, setQueue] = useState([]);
    const [idx, setIdx] = useState(0);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [err, setErr] = useState(null);
    const [userAnswer, setUserAnswer] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [auto, setAuto] = useState(autoParam === '1');
    const [currentPron, setCurrentPron] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExamplePlaying, setIsExamplePlaying] = useState(false); // 오디오 재생 상태

    useEffect(() => {
        setAuto(autoParam === '1');
    }, [autoParam]);

    const reload = async () => {
        try {
            setReloading(true);
            const { data } = await fetchJSON('/srs/queue?limit=100', withCreds(), 15000);
            setQueue(Array.isArray(data) ? data : []);
            setIdx(0);
            setUserAnswer(null);
            setFeedback(null);
        } catch (e) {
            if (!isAbortError(e)) setErr(e);
        } finally {
            setReloading(false);
        }
    };

    useEffect(() => {
        const ac = new AbortController();
        (async () => {
            try {
                setLoading(true); setErr(null);
                setIdx(0); setUserAnswer(null); setFeedback(null);

                let data;
                let isDefaultSrsMode = false;
                if (mode === 'odat') {
                    ({ data } = await fetchJSON('/odat-note/queue?limit=100', withCreds({ signal: ac.signal }), 20000));
                } else if (idsParam) {
                    const vocabIds = idsParam.split(',').map(n => Number(n)).filter(Number.isFinite);
                    ({ data } = await fetchJSON('/quiz/by-vocab', withCreds({ method: 'POST', body: JSON.stringify({ vocabIds }), signal: ac.signal }), 20000));
                } else {
                    isDefaultSrsMode = true;
                    ({ data } = await fetchJSON('/srs/queue?limit=100', withCreds({ signal: ac.signal }), 15000));
                }
                
                let fetchedQueue = Array.isArray(data) ? data : [];

                if (mode === 'flash') {
                    fetchedQueue = shuffleArray(fetchedQueue);
                }
                setQueue(fetchedQueue);

                if (isDefaultSrsMode && fetchedQueue.length === 0) {
                    if (window.confirm("현재 학습할 SRS 문제가 없습니다. 단어를 추가하시겠습니까?")) {
                        if (window.confirm("내 단어장으로 이동하시겠습니까?\n(취소 시 '전체 단어장'으로 이동합니다.)")) {
                            navigate('/my-wordbook');
                        } else {
                            navigate('/vocab');
                        }
                    } else {
                        navigate('/learn');
                    }
                }

            } catch (e) {
                if (!isAbortError(e)) setErr(e);
            } finally {
                if (!ac.signal.aborted) setLoading(false);
            }
        })();
        return () => ac.abort();
    }, [idsParam, mode, navigate]);

    // playUrl 함수: 루프 기능 추가
    const playUrl = (url) => {
        if (!url) return;
        if (audioEl) { 
            try { audioEl.pause(); } catch { /* no-op */ }
            setAudioEl(null); // 기존 오디오 엘리먼트 초기화
        }
        
        const full = url.startsWith('/') ? `${API_BASE}${url}` : url;
        const a = new Audio(full);

        // 로컬 파일 반복 재생 설정
        a.loop = true;

        setIsExamplePlaying(true);
        a.onended = () => {
            setIsExamplePlaying(false);
        };
        a.onerror = (e) => {
            console.error('오디오 재생 중 에러 발생:', e);
            console.error('시도된 오디오 URL:', full);
            setIsExamplePlaying(false);
        };

        a.play().catch(e => {
            console.error('오디오 재생 실패 (Promise error):', e);
            console.error('시도된 오디오 URL:', full);
            setIsExamplePlaying(false);
        });
        setAudioEl(a);
    };

    const stopAudio = () => {
        if (audioEl) { 
            try { audioEl.pause(); } catch { /* no-op */ }
            setAudioEl(null);
        }
        setIsExamplePlaying(false);
    };

    const current = queue[idx];

    // 새로운 카드로 넘어갈 때 카드 뒤집기 상태 초기화
    useEffect(() => { 
        setFlipped(false); 
    }, [idx]);

    // current 단어 상세 정보 로드 및 오디오 재생 관리
    useEffect(() => {
        setCurrentPron(null);
        if (!current) {
            stopAudio(); // 현재 카드가 없으면 오디오 정지
            return;
        }

        const ac = new AbortController();
        (async () => {
            try {
                if (current.vocabId) {
                    const { data } = await fetchJSON(`/vocab/${current.vocabId}`, withCreds({ signal: ac.signal }), 15000);
                    setCurrentDetail(data || null);
                    setCurrentPron({ ipa: data?.dictMeta?.ipa || null, ipaKo: data?.dictMeta?.ipaKo || null });
                    
                    // flash 모드이고 auto 재생 상태일 때만 오디오 재생 시도
                    if (mode === 'flash' && auto) {
                        const safeName = safeFileName(current.question);
                        const audioPath = `/audio/${safeName}.mp3`;
                        console.log('재생 시도될 오디오 URL:', audioPath);
                        playUrl(audioPath);
                    } else {
                        stopAudio(); // auto 모드가 아니면 오디오 정지
                    }
                    return;
                }
                if (current.question) {
                    const { data } = await fetchJSON(`/vocab/search?q=${encodeURIComponent(current.question)}`, withCreds({ signal: ac.signal }), 15000);
                    const hit = Array.isArray(data) ? data.find(v => v.lemma?.toLowerCase() === current.question.toLowerCase()) : null;
                    setCurrentPron({
                        ipa: hit?.dictMeta?.ipa || null,
                        ipaKo: hit?.dictMeta?.ipaKo || null,
                    });
                    stopAudio(); // 퀴즈 모드에서는 오디오 재생 안 함
                }
            } catch (_) { /* no-op */ }
        })();
        return () => {
            ac.abort();
            stopAudio(); // 컴포넌트 언마운트 또는 current/mode/auto 변경 시 오디오 정지
        };
    }, [current, mode, auto]); // current, mode, auto 상태를 dependency에 추가하여 변경 시마다 실행


    const submit = async () => {
        if (!current || !userAnswer || isSubmitting) return;
        setIsSubmitting(true);
        const isCorrect = userAnswer === current.answer;
        try {
            let cardId = current.cardId;
            if (!cardId && current.vocabId) {
                const { data: newCard } = await fetchJSON(
                    `/vocab/${current.vocabId}/bookmark`,
                    withCreds({ method: 'POST' })
                );
                cardId = newCard?.id;
            }
            if (cardId) {
                await fetchJSON('/srs/answer', withCreds({
                    method: 'POST',
                    body: JSON.stringify({ cardId, result: isCorrect ? 'pass' : 'fail' }),
                }));
            } else {
                console.error('결과를 기록할 cardId를 확보하지 못했습니다.', current);
            }
        } catch (e) {
            if (!isAbortError(e)) {
                console.error('답변 제출 또는 카드 생성 실패:', e);
                alert('답변을 기록하는 중 오류가 발생했습니다.');
            }
        } finally {
            setFeedback({ status: isCorrect ? 'pass' : 'fail', answer: current.answer });
            setIsSubmitting(false);
        }
    };

    const next = () => { setIdx(i => i + 1); setUserAnswer(null); setFeedback(null); };

    // 다음 카드로 넘어가는 시간 30초로 변경
    useEffect(() => {
        if (mode !== 'flash' || !auto || !current) return;
        const timer = setInterval(() => {
            setIdx(i => i + 1);
        }, 20000); // 30초
        return () => clearInterval(timer);
    }, [mode, auto, current, queue.length]);

    // 카드 뒤집기 시간 5초로 변경
    useEffect(() => {
        if (mode !== 'flash' || !auto) {
            return;
        }
        const flipInterval = setInterval(() => {
            setFlipped(f => !f);
        }, 5000); // 5초
        return () => clearInterval(flipInterval);
    }, [idx, mode, auto]);

    const handleRestart = () => {
        setIdx(0);
        setUserAnswer(null);
        setFeedback(null);
        setFlipped(false);
    };

    const handleReplaceSrsAndLearn = async () => {
        setReloading(true);
        try {
            const vocabIds = queue.map(item => item.vocabId).filter(Boolean);
            if (vocabIds.length === 0) {
                alert("학습할 단어가 없습니다.");
                return;
            }
            await fetchJSON('/srs/replace-deck', withCreds({
                method: 'POST',
                body: JSON.stringify({ vocabIds }),
            }));
            navigate('/learn/vocab', { state: { fromFlashcardSrs: true } });
        } catch (e) {
            console.error("SRS 덱 교체 실패:", e);
            alert("SRS 학습으로 이동하는 데 실패했습니다.");
        } finally {
            setReloading(false);
        }
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
        const fromFlashcardSrs = location.state?.fromFlashcardSrs;

        return (
            <main className="container py-4" style={{ maxWidth: 720 }}>
                <div className="p-4 bg-light rounded text-center">
                    <h4 className="mb-2">🎉 학습 완료!</h4>
                    <p className="text-muted">학습을 모두 마쳤습니다. 다음 단계를 선택하세요.</p>
                    <div className="d-flex justify-content-center gap-3 mt-4">
                        <button className="btn btn-outline-secondary" onClick={handleRestart} disabled={reloading}>
                            다시 학습하기
                        </button>
                        
                        {fromFlashcardSrs ? (
                            <Link to="/odat-note" className="btn btn-primary">
                                틀린 문제 다시 풀기
                            </Link>
                        ) : (
                            <button className="btn btn-primary" onClick={handleReplaceSrsAndLearn} disabled={reloading}>
                                {reloading ? "준비 중..." : "지금 단어들로 SRS 학습하기"}
                            </button>
                        )}
                    </div>
                </div>
            </main>
        );
    }

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
                    <div
                        className="card-body text-center p-5 d-flex flex-column justify-content-center"
                        role="button"
                        onClick={() => setFlipped(f => !f)} // 수동 카드 뒤집기 기능 유지
                        title="카드를 클릭하면 앞/뒤가 전환됩니다"
                        style={{ minHeight: '40rem' }}
                    >
                        {!flipped ? (
                            <>
                                <h2 className="display-5 mb-3" lang="en">{current.question}</h2>
                                <Pron ipa={currentPron?.ipa} ipaKo={currentPron?.ipaKo} />
                                <div className="text-muted mt-2">카드를 클릭하면 뜻/ 이 표시됩니다.</div>
                            </>
                        ) : (
                            <>
                                <div className="lead mb-2"><strong>뜻:</strong> {current.answer}</div>
                                {Array.isArray(currentDetail?.dictMeta?.examples) && (
                                    <ul className="list-unstyled text-start mx-auto mt-2" style={{ maxWidth: 560 }}>
                                        {currentDetail.dictMeta.examples
                                            .filter(ex => ex && ex.kind !== 'gloss')
                                            .slice(0, 5)
                                            .map((ex, i) => (
                                                <li key={i} className="mb-2 d-flex justify-content-between align-items-start">
                                                    <div>
                                                        <span lang="en">{ex.de}</span>
                                                        {ex.ko ? <div className="text-muted small">— {ex.ko}</div> : null}
                                                    </div>
                                                </li>
                                            ))}
                                    </ul>
                                )}
                            </>
                        )}
                    </div>
                    <div className="card-footer d-flex gap-2">
                        <button
                            className="btn btn-outline-secondary w-25"
                            onClick={() => { stopAudio(); setFlipped(false); setIdx(i => Math.max(0, i - 1)); }}
                        >← 이전</button>
                        <button
                            className="btn btn-primary w-75"
                            onClick={() => { stopAudio(); setFlipped(false); setIdx(i => i + 1); }}
                        >다음 →</button>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="container py-4" style={{ maxWidth: 720 }}>
            <div className="d-flex justify-content-between align-items-center mb-2">
                <strong>{mode === 'odat' ? '오답노트 퀴즈' : 'SRS 퀴즈'}</strong>
                <div className="d-flex align-items-center gap-2">
                    <Link to="/learn/srs-manager" className="btn btn-sm btn-outline-secondary">퀴즈 편집</Link>
                    <Link to="/odat-note" className="btn btn-sm btn-outline-danger">오답노트</Link>
                    <span className="text-muted">{idx + 1} / {queue.length}</span>
                </div>
            </div>

            <div className="card">
                <div className="card-body text-center p-4">
                    <h2 className="display-5 mb-1" lang="en">{current.question}</h2>
                    <Pron ipa={currentPron?.ipa} ipaKo={currentPron?.ipaKo} />
                    <Pron ipa={current.pron?.ipa} ipaKo={current.pron?.ipaKo} />

                    {!feedback && (
                        <div className="d-grid gap-2 col-8 mx-auto mt-3">
                            {current.options.map(opt => (
                                <button
                                    key={opt}
                                    className={`btn btn-lg ${userAnswer === opt ? 'btn-primary' : 'btn-outline-primary'}`}
                                    onClick={() => setUserAnswer(opt)}
                                    disabled={isSubmitting || feedback}
                                >
                                    {opt}
                                </button>
                            ))}
                            <button
                                className="btn btn-success btn-lg mt-2"
                                disabled={!userAnswer || isSubmitting || feedback}
                                onClick={submit}
                            >
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
