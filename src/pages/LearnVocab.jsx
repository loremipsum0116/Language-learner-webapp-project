
/*
  LearnVocab.jsx (통합 버전)
  ──────────────────────
  URL 쿼리에 따라 다양한 학습 모드를 제공합니다.
  - mode=batch (신규): 10개 단위 플래시 -> 퀴즈 반복 학습. /flash/start, /session/finish API 사용.
  - mode=flash: 기존의 자동재생 기능이 포함된 플래시카드 모드.
  - mode=odat: 오답노트 퀴즈 모드.
  - ids=[...]: 선택된 단어들로 학습하는 모드.
  - (기본): 표준 SRS 퀴즈 모드.
*/
import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import _ from 'lodash';

import { fetchJSON, withCreds, API_BASE, isAbortError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Pron from '../components/Pron';
import MiniQuiz from '../components/MiniQuiz'; // 새로 추가한 미니퀴즈

// 헬퍼 함수들 (기존과 동일)
const safeFileName = (s) => encodeURIComponent(String(s ?? '').toLowerCase().replace(/\s+/g, '_'));
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


export default function LearnVocab() {
    const navigate = useNavigate();
    const location = useLocation();
    const query = useQuery();
    const { removeSrsId, refreshSrsIds } = useAuth();

    // URL 파라미터로 모드 결정
    const mode = query.get('mode');
    const idsParam = query.get('ids');
    const autoParam = query.get('auto');

    // --- 상태 관리 ---
    // 공통 상태
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const audioRef = useRef(null);

    // 1. 신규 'batch' 모드 상태
    const [allBatches, setAllBatches] = useState([]);
    const [batchIndex, setBatchIndex] = useState(0);
    const [modeForBatch, setModeForBatch] = useState('flash'); // 'flash' | 'quiz'

    // 2. 기존 모드 상태
    const [queue, setQueue] = useState(() => location.state?.initialQueue ?? []);
    const [idx, setIdx] = useState(0);
    const [userAnswer, setAnswer] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [isSubmitting, setSubmitting] = useState(false);
    const [reloading, setReloading] = useState(false);
    const [reloadKey, forceReload] = useReducer((k) => k + 1, 0);

    // 3. 플래시카드 공통 상태
    const [flipped, setFlipped] = useState(false);
    const [auto, setAuto] = useState(autoParam === '1');
    const [currentDetail, setDetail] = useState(null);
    const [currentPron, setPron] = useState(null);

    // --- 오디오 핸들러 --- (기존과 동일)
    const stopAudio = () => {
        if (audioRef.current) { try { audioRef.current.pause(); } catch { /* noop */ } }
        audioRef.current = null;
    };
    const playUrl = (url) => {
        stopAudio();
        const src = url.startsWith('/') ? `${API_BASE}${url}` : url;
        const audio = new Audio(src);
        audio.play().then(() => { audioRef.current = audio; }).catch(() => { });
    };

    // --- 데이터 로딩 ---
    useEffect(() => {
        const ac = new AbortController();
        setLoading(true);
        setErr(null);

        (async () => {
            try {
                // ========== 🚀 신규 배치(batch) 모드 로직 ==========
                if (mode === 'batch') {
                    const { data } = await fetchJSON('/srs/queue?limit=100', withCreds({ signal: ac.signal }));
                    if (Array.isArray(data) && data.length > 0) {
                        setAllBatches(_.chunk(data, 10));
                        setModeForBatch('flash');
                    } else {
                        setAllBatches([]);
                    }
                }
                // ========== 낡은 기존 모드 로직 ==========
                else {
                    if (queue.length && !location.state?.fromFlashcardSrs) return;
                    let data = [];
                    if (mode === 'odat') {
                        ({ data } = await fetchJSON('/odat-note/queue?limit=100', withCreds({ signal: ac.signal })));
                    } else if (idsParam) {
                        const vocabIds = idsParam.split(',').map(Number).filter(Boolean);
                        ({ data } = await fetchJSON('/quiz/by-vocab', withCreds({ method: 'POST', body: JSON.stringify({ vocabIds }), signal: ac.signal })));
                    } else {
                        ({ data } = await fetchJSON('/srs/queue?limit=100', withCreds({ signal: ac.signal })));
                    }
                    let fetched = Array.isArray(data) ? data : [];
                    if (mode === 'flash') fetched = shuffleArray(fetched);
                    setQueue(fetched);
                    if (!mode && fetched.length === 0) {
                        alert('학습할 SRS 카드가 없습니다.');
                        navigate('/vocab');
                    }
                }
            } catch (e) {
                if (!isAbortError(e)) setErr(e);
            } finally {
                if (!ac.signal.aborted) setLoading(false);
            }
        })();

        return () => { ac.abort(); stopAudio(); };
    }, [mode, idsParam, location.state?.fromFlashcardSrs, reloadKey, navigate]);

    // --- 카드 상세 정보 로딩 ---
    const cardForDetail = (mode === 'batch') ? allBatches[batchIndex]?.[idx] : queue[idx];

    useEffect(() => {
        setDetail(null); setPron(null);
        if (!cardForDetail) return;
        const ac = new AbortController();
        (async () => {
            try {
                const { data } = await fetchJSON(`/dict/search?q=${encodeURIComponent(cardForDetail.question)}`, withCreds({ signal: ac.signal }));
                const first = data?.entries?.[0];
                if (first) {
                    setDetail(first);
                    if (first.ipa) setPron({ ipa: first.ipa, ipaKo: first.ipaKo });
                }
                if (mode === 'flash' && auto) {
                    playUrl(`/audio/${safeFileName(cardForDetail.question)}.mp3`);
                }
            } catch (_) { /* ignore */ }
        })();
        return () => ac.abort();
    }, [cardForDetail, mode, auto]);


    // --- 핸들러 함수 ---
    // 신규 배치 모드 핸들러
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
            fetchJSON('/session/finish', withCreds({ method: 'POST' }))
                .then(({ data }) => {
                    if (data?.highMistake > 0) {
                        toast.success(`오답률 높은 단어 ${data.highMistake}개로 복습 폴더가 생성되었습니다!`);
                    } else {
                        toast.info('완벽히 학습하셨네요! 다음날 복습 폴더는 생성되지 않았습니다.');
                    }
                })
                .catch(e => toast.error('세션 종료 중 오류 발생: ' + e.message));
        }
    };

    // 기존 모드 핸들러
    const submit = async () => { /* ... 이전 코드와 동일 ... */ };
    const next = () => { /* ... 이전 코드와 동일 ... */ };
    const handleRestart = () => { /* ... 이전 코드와 동일 ... */ };
    const handleReplaceSrsAndLearn = async () => { /* ... 이전 코드와 동일 ... */ };

    // --- 자동 재생 타이머 --- (기존 로직)
    const currentCardForTimer = (mode === 'batch') ? allBatches[batchIndex]?.[idx] : queue[idx];
    useEffect(() => {
        if (mode !== 'flash' || !auto || !currentCardForTimer) return;
        const flip = setInterval(() => setFlipped((f) => !f), 5000);
        const nextT = setInterval(() => setIdx((i) => i + 1), 20000);
        return () => { clearInterval(flip); clearInterval(nextT); };
    }, [mode, auto, currentCardForTimer]);

    useEffect(() => { if (!queue[idx]) refreshSrsIds(); }, [queue, idx, refreshSrsIds]);

    // ======================== 렌더링 ========================
    if (loading) return <main className="container py-4"><h4>학습 데이터 로딩 중…</h4></main>;
    if (err) return <main className="container py-4"><div className="alert alert-danger">퀴즈 로드 실패: {err.message}</div></main>;

    // ========== 🚀 신규 배치(batch) 모드 렌더링 ==========
    if (mode === 'batch') {
        const currentBatch = allBatches[batchIndex];

        if (!currentBatch) {
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

        return (
            <main className="container py-4" style={{ maxWidth: 720 }}>
                <div className="mb-3 text-center">
                    <span className="badge bg-dark">Batch {batchIndex + 1} / {allBatches.length}</span>
                </div>

                {modeForBatch === 'flash' && currentFlashCard && (
                    <div className="card">
                        <div className="card-header">플래시카드 ({idx + 1} / {currentBatch.length})</div>
                        <div className="card-body text-center p-5" style={{ minHeight: '300px', cursor: 'pointer' }} onClick={() => setFlipped(f => !f)}>
                            {!flipped ? (
                                <>
                                    <h2 className="display-4">{currentFlashCard.question}</h2>
                                    <Pron ipa={currentFlashCard.pron?.ipa} ipaKo={currentFlashCard.pron?.ipaKo} />
                                </>
                            ) : (
                                <>
                                    <h3 className="display-5 text-primary">{currentFlashCard.answer}</h3>
                                    {Array.isArray(currentFlashCard.examples) && currentFlashCard.examples.length > 0 && (
                                        <div className="mt-4 p-3 bg-light rounded w-100 text-start">
                                            <h6 className="fw-bold">예문</h6>
                                            {currentFlashCard.examples.map((ex, index) => (
                                                <div key={index} className="mt-2">
                                                    <p className="mb-0" lang="en">{ex.de}</p>
                                                    <small className="text-muted">— {ex.ko}</small>
                                                </div>
                                            ))}
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

    // ========== 낡은 기존 모드 렌더링 (그대로 유지) ==========
    const current = queue[idx];

    if (!current) {
        // 기존 완료 화면
        const isFlashLike = mode === 'flash' || !!idsParam;
        const isOdat = mode === 'odat';
        const isPureSrs = !isFlashLike && !isOdat;
        return (
            <main className="container py-4" style={{ maxWidth: 720 }}>
                <div className="p-4 bg-light rounded text-center">
                    <h4 className="mb-2">🎉 학습 완료!</h4>
                    <p className="text-muted">다음 작업을 선택하세요.</p>
                    <div className="d-flex flex-wrap justify-content-center gap-3 mt-4">
                        <button className="btn btn-outline-secondary" onClick={handleRestart}>다시 학습하기</button>
                        {isFlashLike && (<button className="btn btn-primary" onClick={handleReplaceSrsAndLearn} disabled={reloading}>{reloading ? '준비 중…' : '지금 단어들로 SRS 학습하기'}</button>)}
                        {isPureSrs && (<><Link className="btn btn-outline-secondary" to="/learn/srs-manager">문제 편집</Link><Link className="btn btn-primary" to="/odat-note">오답 문제 풀이</Link></>)}
                        {isOdat && (<Link className="btn btn-primary" to="/learn/vocab">SRS 퀴즈로 가기</Link>)}
                    </div>
                </div>
            </main>
        );
    }

    // ── Flash 모드(자동학습) ───────────────────
    if (mode === 'flash') {
        const examples = currentDetail?.examples ?? [];
        return (
            <main className="container py-4" style={{ maxWidth: 720 }}>
                <div className="d-flex align-items-center mb-2">
                    <strong className="me-auto">플래시카드 ({queue.length}개)</strong>

                    {/* 자동재생 토글 */}
                    <button
                        type="button"
                        className="btn btn-light d-flex justify-content-center align-items-center"
                        onClick={() => { stopAudio(); setAuto((a) => !a); }}
                        style={{ borderRadius: '50%', width: '2.5rem', height: '2.5rem', border: '1px solid #dee2e6' }}
                        aria-label={auto ? '자동재생 멈춤' : '자동재생 시작'}
                    >
                        {auto
                            ? <svg xmlns="http://www.w3.org/2000/svg" width="18" viewBox="0 0 16 16"><path d="M5.5 3.5A1.5 1.5 0 017 5v6a1.5 1.5 0 01-3 0V5a1.5 1.5 0 011.5-1.5zm5 0A1.5 1.5 0 0112 5v6a1.5 1.5 0 01-3 0V5a1.5 1.5 0 011.5-1.5z" /></svg>
                            : <svg xmlns="http://www.w3.org/2000/svg" width="18" viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.058c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 010 1.393z" /></svg>}
                    </button>
                    <span className="text-muted ms-2">{idx + 1} / {queue.length}</span>
                </div>

                <div className="card">
                    <div
                        className="card-body position-relative text-center p-5 d-flex flex-column justify-content-center align-items-center"
                        role="button"
                        onClick={() => setFlipped((f) => !f)}
                        style={{ minHeight: '45rem' }}
                    >
                        {!flipped ? (
                            <>
                                {/* 품사 뱃지 */}
                                <div className="d-flex justify-content-center gap-2 mb-2">
                                    {(current.pos || '')
                                        .split(',').map((t) => t.trim()).filter((t) => t && t !== 'unk')
                                        .map((t) => <span key={t} className={`badge ${getPosBadgeColor(t)}`}>{t}</span>)}
                                </div>
                                <h2 className="display-5 mb-3" lang="en">{current.question}</h2>
                                <Pron ipa={current.pron?.ipa || currentPron?.ipa}
                                    ipaKo={current.pron?.ipaKo || currentPron?.ipaKo} />
                                <div className="text-muted mt-2">카드를 클릭하면 뜻이 표시됩니다.</div>
                            </>
                        ) : (
                            <>
                                {/* 수정된 부분: 카드 뒷면에서 품사 뱃지 제거 */}
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
                                                                <span
                                                                    lang="en"
                                                                    dangerouslySetInnerHTML={{
                                                                        __html: ex.de.replace(
                                                                            new RegExp(`\\b(${current.question})\\b`, 'gi'),
                                                                            '<strong>$1</strong>',
                                                                        ),
                                                                    }}
                                                                />
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
                        <button className="btn btn-outline-secondary w-25"
                            onClick={() => { stopAudio(); setFlipped(false); setIdx((i) => Math.max(0, i - 1)); }}>
                            ← 이전
                        </button>
                        <button className="btn btn-primary w-75"
                            onClick={() => { stopAudio(); setFlipped(false); setIdx((i) => i + 1); }}>
                            다음 →
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    // ── SRS / 오답노트 퀴즈 ─────────────────────
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
                                <button key={opt}
                                    className={`btn btn-lg ${userAnswer === opt ? 'btn-primary' : 'btn-outline-primary'}`}
                                    onClick={() => setAnswer(opt)}
                                    disabled={isSubmitting}>
                                    {opt}
                                </button>
                            ))}
                            <button className="btn btn-success btn-lg mt-2"
                                disabled={!userAnswer || isSubmitting}
                                onClick={submit}>
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
