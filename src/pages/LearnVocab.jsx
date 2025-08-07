/*
  LearnVocab.jsx (통합 버전)
  ──────────────────────
  URL 쿼리에 따라 다양한 학습 모드를 제공합니다.
  - mode=batch: 10개 단위 플래시 -> 퀴즈 반복 학습.
  - mode=flash: 자동재생 기능이 포함된 플래시카드 모드.
  - mode=odat: 오답노트 퀴즈 모드.
  - ids=[...]: 선택된 단어들로 학습하는 모드.
  - (기본): 표준 SRS 퀴즈 모드.
*/
import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import _ from 'lodash';

// 실제 프로젝트 구조처럼 외부 파일에서 함수와 컴포넌트를 가져옵니다.
import { fetchJSON, withCreds, API_BASE, isAbortError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Pron from '../components/Pron';
import MiniQuiz from '../components/MiniQuiz';

// Helper Functions
const getPosBadgeColor = (pos) => {
    switch ((pos || '').toLowerCase()) {
        case 'noun': return 'bg-primary';
        case 'verb': return 'bg-success';
        case 'adjective': return 'bg-warning text-dark';
        case 'adverb': return 'bg-info text-dark';
        default: return 'bg-secondary';
    }
};
const shuffleArray = (arr) => {
    if (!arr) return [];
    let i = arr.length;
    while (i) {
        const j = Math.floor(Math.random() * i--);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};
const useQuery = () => {
    const { search } = useLocation();
    return useMemo(() => new URLSearchParams(search), [search]);
};
const safeFileName = (s) => encodeURIComponent(String(s ?? '').toLowerCase().replace(/\s+/g, '_'));

// ▼▼▼ [핵심 수정] 뜻을 찾는 로직을 별도 함수로 분리하여 안정성 강화 ▼▼▼
const getMeaningFromVocab = (card) => {
    if (card.answer && card.answer !== '뜻 정보 없음') return card.answer;
    if (card.ko_gloss) return card.ko_gloss;
    const examples = Array.isArray(card.vocab?.dictMeta?.examples) ? card.vocab.dictMeta.examples : [];
    if (examples.length > 0) {
        const primaryMeaning = examples[0]?.definitions?.[0]?.ko_def;
        if (primaryMeaning) return primaryMeaning;
    }
    return '뜻 정보 없음';
};


export default function LearnVocab() {
    const navigate = useNavigate();
    const location = useLocation();
    const query = useQuery();
    const { removeSrsId, refreshSrsIds } = useAuth();

    const mode = query.get('mode');
    const idsParam = query.get('ids');
    const autoParam = query.get('auto');

    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const audioRef = useRef(null);
    const [allBatches, setAllBatches] = useState([]);
    const [batchIndex, setBatchIndex] = useState(0);
    const [modeForBatch, setModeForBatch] = useState('flash');
    const [queue, setQueue] = useState(() => location.state?.initialQueue ?? []);
    const [idx, setIdx] = useState(0);
    const [userAnswer, setAnswer] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [isSubmitting, setSubmitting] = useState(false);
    const [reloading, setReloading] = useState(false);
    const [reloadKey, forceReload] = useReducer((k) => k + 1, 0);
    const [flipped, setFlipped] = useState(false);
    const [auto, setAuto] = useState(autoParam === '1');

    const stopAudio = () => {
        if (audioRef.current) {
            try { audioRef.current.pause(); } catch { /* noop */ }
        }
        audioRef.current = null;
    };
    const playUrl = (url) => {
        if (!url) return;
        stopAudio();
        const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
        const audio = new Audio(fullUrl);
        audio.loop = true;
        audio.play().then(() => {
            audioRef.current = audio;
        }).catch(e => console.error("Audio play failed:", e));
    };

    useEffect(() => {
        const ac = new AbortController();

        const normalizeCardData = async (card) => {
            // 이미 완전한 데이터면 그대로 반환
            if (card.vocab && card.vocab.dictMeta) {
                // answer 필드가 비어있을 경우를 대비해 한번 더 확인
                return { ...card, answer: getMeaningFromVocab(card) };
            }
            try {
                // 단어 상세 정보를 가져와 데이터 보강
                const { data: fullVocab } = await fetchJSON(`/vocab/${card.vocabId || card.itemId}`, withCreds({ signal: ac.signal }));
                const enrichedCard = {
                    ...card,
                    question: fullVocab.lemma,
                    pos: fullVocab.pos,
                    pron: { ipa: fullVocab.dictMeta?.ipa, ipaKo: fullVocab.dictMeta?.ipaKo },
                    vocab: fullVocab,
                };
                return { ...enrichedCard, answer: getMeaningFromVocab(enrichedCard) };

            } catch (e) {
                console.error(`Failed to fetch details for vocabId ${card.vocabId || card.itemId}`, e);
                return { ...card, question: card.lemma || 'Error', answer: '뜻 정보 없음', vocab: { dictMeta: { examples: [] } } };
            }
        };

        (async () => {
            setLoading(true);
            setErr(null);
            try {
                let { data } = { data: [] };
                if (mode === 'batch') {
                    await fetchJSON('/learn/flash/start', withCreds({ method: 'POST', signal: ac.signal }));
                    ({ data } = await fetchJSON('/srs/queue?limit=100', withCreds({ signal: ac.signal })));
                    if (Array.isArray(data) && data.length > 0) {
                        setAllBatches(_.chunk(data, 10));
                        setModeForBatch('flash');
                    } else {
                        setAllBatches([]);
                    }
                } else {
                    if (queue.length && !location.state?.fromFlashcardSrs) return;

                    if (mode === 'odat') {
                        ({ data } = await fetchJSON('/odat-note/list', withCreds({ signal: ac.signal })));
                    } else if (idsParam) {
                        const vocabIds = idsParam.split(',').map(Number).filter(Boolean);
                        ({ data } = await fetchJSON('/quiz/by-vocab', withCreds({ method: 'POST', body: JSON.stringify({ vocabIds }), signal: ac.signal })));
                    } else {
                        ({ data } = await fetchJSON('/srs/queue?limit=100', withCreds({ signal: ac.signal })));
                    }

                    let fetched = Array.isArray(data) ? data : [];

                    // 데이터 정규화 로직 실행
                    fetched = await Promise.all(fetched.map(normalizeCardData));

                    if (mode === 'flash') fetched = shuffleArray(fetched);
                    setQueue(fetched);
                    if (!mode && fetched.length === 0) {
                        toast.info('학습할 SRS 카드가 없습니다.');
                        navigate('/vocab');
                    }
                }
            } catch (e) {
                if (!isAbortError(e)) setErr(e);
            } finally {
                if (!ac.signal.aborted) setLoading(false);
            }
        })();

        return () => {
            ac.abort();
            stopAudio();
        };
    }, [mode, idsParam, reloadKey, navigate]);


    const handleNextFlash = () => {
        if (idx < allBatches[batchIndex].length - 1) {
            setIdx(i => i + 1);
            setFlipped(false);
        } else {
            setModeForBatch('quiz');
        }
    };

    const handleQuizDone = () => {
        if (batchIndex < allBatches.length - 1) {
            setBatchIndex(i => i + 1);
            setIdx(0);
            setFlipped(false);
            setModeForBatch('flash');
        } else {
            setModeForBatch('finished');
            fetchJSON('/learn/session/finish', withCreds({ method: 'POST' }))
                .then((response) => {
                    const data = response?.data;
                    if (data?.highMistake > 0) {
                        toast.success(`오답률 높은 단어 ${data.highMistake}개로 복습 폴더가 생성되었습니다!`);
                    } else {
                        toast.info('완벽히 학습하셨네요! 다음날 복습 폴더는 생성되지 않았습니다.');
                    }
                })
                .catch(e => toast.error('세션 종료 중 오류 발생: ' + e.message));
        }
    };

    const submit = async () => {
        if (!userAnswer) return;
        const current = queue[idx];
        setSubmitting(true);
        const isCorrect = userAnswer === current.answer;
        try {
            await fetchJSON('/quiz/answer', withCreds({
                method: 'POST',
                body: JSON.stringify({ cardId: current.cardId, correct: isCorrect })
            }));
            setFeedback({ status: isCorrect ? 'pass' : 'fail', answer: current.answer });
            if (isCorrect) removeSrsId(current.cardId);
        } catch (e) {
            toast.error('답변 제출 실패: ' + e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const next = () => {
        setFeedback(null);
        setAnswer(null);
        setIdx(i => i + 1);
    };

    const handleRestart = () => {
        setIdx(0);
        setQueue(shuffleArray([...queue]));
        forceReload();
    };

    // 학습한 단어를 기존 SRS 덱에 추가하는 새 함수
    const handleAddLearnedToSrs = async () => {
        setReloading(true);
        try {
            const vocabIds = queue.map(v => v.vocabId);
            if (vocabIds.length === 0) {
                toast.info("SRS에 추가할 단어가 없습니다.");
                setReloading(false);
                return;
            }

            // 기존 SRS 덱을 교체하는 대신, 새로운 단어만 추가하는 API를 호출합니다.
            const { data } = await fetchJSON('/srs/create-many', withCreds({
                method: 'POST',
                body: JSON.stringify({ vocabIds })
            }));

            const count = data?.count || 0;
            if (count > 0) {
                toast.success(`${count}개의 새로운 단어를 SRS에 추가했습니다.`);
            } else {
                toast.info('학습한 모든 단어가 이미 SRS 목록에 있습니다.');
            }

            await refreshSrsIds(); // AuthContext의 SRS 목록을 새로고침합니다.

        } catch (e) {
            // ◀◀◀ 3. catch 블록을 아래와 같이 수정합니다.
            if (e.status === 401) {
                toast.error('세션이 만료되었습니다. 다시 로그인 해주세요.');
                // 로그인 후 현재 페이지로 돌아올 수 있도록 state를 전달하며 로그인 페이지로 이동시킵니다.
                navigate('/login', { replace: true, state: { from: location } });
            } else {
                toast.error('SRS에 단어 추가 실패: ' + e.message);
            }
        } finally {
            setReloading(false);
        }
    };

    const currentCardForTimer = (mode === 'batch') ? allBatches[batchIndex]?.[idx] : queue[idx];
    useEffect(() => {
        if (mode !== 'flash' || !auto || !currentCardForTimer) return;

        const audioUrl = `/A1/audio/${safeFileName(currentCardForTimer.question)}.mp3`;
        playUrl(audioUrl);

        const flipTimer = setTimeout(() => setFlipped(true), 5000);
        const nextTimer = setTimeout(() => {
            setFlipped(false);
            if (idx < queue.length - 1) {
                setIdx(i => i + 1);
            } else {
                setAuto(false);
            }
        }, 10000);

        return () => {
            clearTimeout(flipTimer);
            clearTimeout(nextTimer);
            stopAudio();
        };
    }, [mode, auto, idx, currentCardForTimer, queue.length]);

    useEffect(() => {
        if (queue && !queue[idx]) {
            refreshSrsIds();
        }
    }, [queue, idx, refreshSrsIds]);

    if (loading) return <main className="container py-4"><h4>학습 데이터 로딩 중…</h4></main>;
    if (err) return <main className="container py-4"><div className="alert alert-danger">퀴즈 로드 실패: {err.message}</div></main>;

    if (mode === 'batch') {
        const currentBatch = allBatches[batchIndex];

        if (!currentBatch || currentBatch.length === 0) {
            return (
                <main className="container py-4 text-center">
                    <h4>🎉</h4>
                    <p className="lead">오늘 학습할 단어가 없습니다.</p>
                    <button onClick={() => navigate('/my-wordbook')} className="btn btn-primary">단어 추가하러 가기</button>
                </main>
            );
        }

        if (modeForBatch === 'finished') {
            return (
                <main className="container py-4" style={{ maxWidth: 720 }}>
                    <div className="p-4 bg-light rounded text-center">
                        <h4 className="mb-2">🎉 모든 학습 완료!</h4>
                        <p className="text-muted">오답률이 높은 단어들은 내일 복습 폴더에 자동으로 추가됩니다.</p>
                        <div className="d-flex justify-content-center gap-3 mt-4">
                            <button className="btn btn-outline-secondary" onClick={() => window.location.reload()}>다시 학습하기</button>
                            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>대시보드로 가기</button>
                        </div>
                    </div>
                </main>
            );
        }

        const currentFlashCard = currentBatch[idx];
        const examples = currentFlashCard?.vocab?.dictMeta?.examples ?? [];

        return (
            <main className="container py-4" style={{ maxWidth: 720 }}>
                <div className="mb-3 text-center">
                    <span className="badge bg-dark">Batch {batchIndex + 1} / {allBatches.length}</span>
                </div>

                {modeForBatch === 'flash' && currentFlashCard && (
                    <div className="card">
                        <div className="card-header">플래시카드 ({idx + 1} / {currentBatch.length})</div>
                        <div className="card-body text-center p-5 d-flex flex-column justify-content-center align-items-center" style={{ minHeight: '300px', cursor: 'pointer' }} onClick={() => setFlipped(f => !f)}>
                            {!flipped ? (
                                <>
                                    <div className="d-flex justify-content-center gap-2 mb-2">
                                        {(currentFlashCard.pos || '').split(',').map(t => t.trim()).filter(Boolean).map(t => <span key={t} className={`badge ${getPosBadgeColor(t)}`}>{t}</span>)}
                                    </div>
                                    <h2 className="display-4">{currentFlashCard.question}</h2>
                                    <Pron ipa={currentFlashCard.pron?.ipa} ipaKo={currentFlashCard.pron?.ipaKo} />
                                </>
                            ) : (
                                <>
                                    <h3 className="display-5 text-primary">{currentFlashCard.answer}</h3>
                                    {examples[0]?.definitions?.[0]?.examples?.[0] && (
                                        <div className="mt-3 text-muted">
                                            <p className="mb-0">{examples[0].definitions[0].examples[0].de}</p>
                                            <small>— {examples[0].definitions[0].examples[0].ko}</small>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="card-footer">
                            <button className="btn btn-primary w-100" onClick={handleNextFlash}>
                                {idx < currentBatch.length - 1 ? '다음 단어' : '퀴즈 풀기'}
                            </button>
                        </div>
                    </div>
                )}

                {modeForBatch === 'quiz' && (
                    <MiniQuiz batch={currentBatch} onDone={handleQuizDone} />
                )}
            </main>
        );
    }

    const current = queue[idx];

    if (!current) {
        return (
            <main className="container py-4" style={{ maxWidth: 720 }}>
                <div className="p-4 bg-light rounded text-center">
                    <h4 className="mb-2">🎉 학습 완료!</h4>
                    <p className="text-muted">다음 작업을 선택하세요.</p>
                    <div className="d-flex flex-wrap justify-content-center gap-3 mt-4">
                        {/* 선택지 1: 홈으로 */}
                        <Link className="btn btn-secondary" to="/">홈으로</Link>
                        {/* 선택지 2: 다시 학습하기 */}
                        <button className="btn btn-outline-primary" onClick={handleRestart}>다시 학습하기</button>
                        {/* 선택지 3: SRS 학습 가기 */}
                        <Link className="btn btn-primary" to="/srs/dashboard">SRS 학습 가기</Link>
                    </div>
                </div>
            </main>
        );
    }

    if (mode === 'flash') {
        const examples = current.vocab?.dictMeta?.examples ?? [];
        return (
            <main className="container py-4" style={{ maxWidth: 720 }}>
                <div className="d-flex align-items-center mb-2">
                    <strong className="me-auto">플래시카드 ({queue.length}개)</strong>
                    <button type="button" className="btn btn-light d-flex justify-content-center align-items-center" onClick={() => { stopAudio(); setAuto(a => !a); }} style={{ borderRadius: '50%', width: '2.5rem', height: '2.5rem', border: '1px solid #dee2e6' }} aria-label={auto ? '자동재생 멈춤' : '자동재생 시작'}>
                        {auto ? <svg xmlns="http://www.w3.org/2000/svg" width="18" viewBox="0 0 16 16"><path d="M5.5 3.5A1.5 1.5 0 017 5v6a1.5 1.5 0 01-3 0V5a1.5 1.5 0 011.5-1.5zm5 0A1.5 1.5 0 0112 5v6a1.5 1.5 0 01-3 0V5a1.5 1.5 0 011.5-1.5z" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="18" viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.058c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 010 1.393z" /></svg>}
                    </button>
                    <span className="text-muted ms-2">{idx + 1} / {queue.length}</span>
                </div>

                <div className="card">
                    <div className="card-body position-relative text-center p-5 d-flex flex-column justify-content-center align-items-center" role="button" onClick={() => setFlipped(f => !f)} style={{ minHeight: '45rem' }}>
                        {!flipped ? (
                            <>
                                <div className="d-flex justify-content-center gap-2 mb-2">
                                    {(current.pos || '').split(',').map(t => t.trim()).filter(t => t && t.toLowerCase() !== 'unk').map(t => <span key={t} className={`badge ${getPosBadgeColor(t)}`}>{t}</span>)}
                                </div>
                                <h2 className="display-5 mb-3" lang="en">{current.question}</h2>
                                <Pron ipa={current.pron?.ipa} ipaKo={current.pron?.ipaKo} />
                                <div className="text-muted mt-2">카드를 클릭하면 뜻이 표시됩니다.</div>
                            </>
                        ) : (
                            <>
                                <div className="mb-3 lead"><strong>뜻:</strong> {current.answer}</div>
                                {examples.length > 0 && (
                                    <div className="mt-4 text-start w-100">
                                        <h6 className="fw-bold">예문</h6>
                                        {examples.map((blk, i) => (
                                            <div key={i}>
                                                {blk.definitions?.map((def, j) => (
                                                    <ul key={j} className="list-unstyled mt-2">
                                                        {def.examples?.map((ex, k) => (
                                                            <li key={k} className="mb-2 p-2 bg-light rounded">
                                                                <span lang="en" dangerouslySetInnerHTML={{ __html: ex.de.replace(new RegExp(`\\b(${current.question})\\b`, 'gi'), '<strong>$1</strong>') }} />
                                                                {ex.ko && <div className="text-muted small mt-1">— {ex.ko}</div>}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="card-footer d-flex gap-2">
                        <button className="btn btn-outline-secondary w-25" onClick={() => { stopAudio(); setFlipped(false); setIdx(i => Math.max(0, i - 1)); }} disabled={idx === 0}>← 이전</button>
                        {idx === queue.length - 1 ? (
                            <button className="btn btn-success w-75" onClick={() => { stopAudio(); setIdx(i => i + 1); }}>학습 완료</button>
                        ) : (
                            <button className="btn btn-primary w-75" onClick={() => { stopAudio(); setFlipped(false); setIdx(i => i + 1); }}>다음 →</button>
                        )}
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
                    <h2 className="display-5 mb-1" lang="en">{current.question}</h2>
                    <Pron ipa={current.pron?.ipa} ipaKo={current.pron?.ipaKo} />

                    {!feedback && (
                        <div className="d-grid gap-2 col-8 mx-auto mt-3">
                            {current.options?.map((opt) => (
                                <button key={opt} className={`btn btn-lg ${userAnswer === opt ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setAnswer(opt)} disabled={isSubmitting}>
                                    {opt}
                                </button>
                            ))}
                            <button className="btn btn-success btn-lg mt-2" disabled={!userAnswer || isSubmitting} onClick={submit}>
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
