/*
  LearnVocab.jsx — 오디오 종료 확정 패치
  ------------------------------------------------------------
  핵심 변경점
  1) 오디오 소스 단일화: 절대로 new Audio() 생성하지 않음. 항상 <audio ref> 하나만 사용.
  2) 모든 분기에서 <audio ref>가 렌더되도록 하고, 언마운트/라우트 변경 시 stopAudio()로 반드시 정지.
  3) playUrl()은 ref가 준비된 뒤에만 동작. loop 여부는 파라미터로 전달.
  4) flash 분기에서 기존 <audio src autoPlay loop> 제거 → 항상 제어형 재생.
*/

import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import _ from 'lodash';
import AddLearnedToFolderModal from '../components/AddLearnedToFolderModal';

import { fetchJSON, withCreds, API_BASE, isAbortError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Pron from '../components/Pron';
import MiniQuiz from '../components/MiniQuiz';

// ───────────────────── 헬퍼 ─────────────────────
const safeFileName = (s) => encodeURIComponent(String(s ?? ''));
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
    const { refreshSrsIds } = useAuth();

    // URL 파라미터
    const mode = query.get('mode');
    const idsParam = query.get('ids');
    const autoParam = query.get('auto');
    const folderIdParam = query.get('folderId');
    const selectedItemsParam = query.get('selectedItems');

    // 공통 상태
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const audioRef = useRef(null); // 전역 단일 오디오 ref

    // 배치 상태
    const [allBatches, setAllBatches] = useState([]);
    const [batchIndex, setBatchIndex] = useState(0);
    const [modeForBatch, setModeForBatch] = useState('flash');

    // 기존 모드 상태
    const [queue, setQueue] = useState(() => location.state?.initialQueue ?? []);
    const [idx, setIdx] = useState(0);
    const [userAnswer, setAnswer] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [isSubmitting, setSubmitting] = useState(false);
    const [reloading, setReloading] = useState(false);
    const [reloadKey, forceReload] = useReducer((k) => k + 1, 0);
    const [showFolderPicker, setShowFolderPicker] = useState(false);
    const [learnedVocabIds, setLearnedVocabIds] = useState([]);

    // 플래시 공통
    const [flipped, setFlipped] = useState(false);
    const [auto, setAuto] = useState(autoParam === '1');
    const [currentDetail, setDetail] = useState(null);
    const [currentPron, setPron] = useState(null);
    const [reviewQuiz, setReviewQuiz] = useState({ show: false, batch: [] });
    const [audioPlayCount, setAudioPlayCount] = useState(0);
    
    // 설정 상태
    const [maxPlayCount, setMaxPlayCount] = useState(3);
    const [flipInterval, setFlipInterval] = useState(5000); // 5초 기본값
    const [showSettings, setShowSettings] = useState(false);
    const [showSettingsToast, setShowSettingsToast] = useState(false);
    
    // 현재 카드의 최대 재생횟수 고정 (카드 시작 시 설정값으로 고정)
    const [currentCardMaxPlayCount, setCurrentCardMaxPlayCount] = useState(3);
    const flipIntervalRef = useRef(flipInterval);
    
    // 설정값 변경 시 토스트 표시 (다음 카드부터 적용됨을 알림)
    useEffect(() => {
        if (maxPlayCount !== 3) { // 기본값이 아닐 때만 토스트 표시
            showToast();
        }
    }, [maxPlayCount]);
    
    useEffect(() => {
        flipIntervalRef.current = flipInterval;
        if (flipInterval !== 5000) { // 기본값이 아닐 때만 토스트 표시
            showToast();
        }
    }, [flipInterval]);
    
    const showToast = () => {
        setShowSettingsToast(true);
        setTimeout(() => setShowSettingsToast(false), 3000); // 3초 후 자동 사라짐
    };

    // 공통 현재 카드 포인터 (TDZ 방지)
    const current = useMemo(
        () => (mode === 'batch' ? allBatches[batchIndex]?.[idx] : queue[idx]),
        [mode, allBatches, batchIndex, idx, queue]
    );

    // ───────────────────── 오디오 제어 ─────────────────────
    const stopAudio = () => {
        const el = audioRef.current;
        if (!el) return;
        try { el.pause(); } catch { }
        try { el.removeAttribute('src'); } catch { }
        try { el.currentTime = 0; } catch { }
        try { el.load(); } catch { }
    };

    const playUrl = (url, { loop = false } = {}) => {
        const el = audioRef.current;
        if (!el || !url) return; // ref가 아직 준비되지 않았으면 재생하지 않음
        stopAudio();
        el.loop = !!loop;
        el.src = url.startsWith('/') ? `${API_BASE}${url}` : url;
        try { el.load(); } catch { }
        el.play().catch((e) => console.error('오디오 재생 실패:', e));
    };

    // 페이지 언마운트/라우트 변경/탭 숨김 시 강제 정지
    useEffect(() => {
        const onHide = () => stopAudio();
        const onBeforeUnload = () => stopAudio();
        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => {
            document.removeEventListener('visibilitychange', onHide);
            window.removeEventListener('beforeunload', onBeforeUnload);
        };
    }, []);

    // 라우트 변경 시 정지(보수적 방어)
    useEffect(() => {
        return () => stopAudio();
    }, [location.pathname]);

    // 마운트 해제 시 정지
    useEffect(() => () => stopAudio(), []);

    // ───────────────────── 데이터 로딩 ─────────────────────
    useEffect(() => {
        const ac = new AbortController();
        setLoading(true);
        setErr(null);

        (async () => {
            try {
                if (mode === 'batch') {
                    await fetchJSON('/learn/flash/start', withCreds({ signal: ac.signal }));
                    const { data } = await fetchJSON('/srs/queue?limit=100', withCreds({ signal: ac.signal }));
                    if (Array.isArray(data) && data.length > 0) {
                        setAllBatches(_.chunk(data, 10));
                        setModeForBatch('flash');
                        setIdx(0);
                        setFlipped(false);
                    } else {
                        setAllBatches([]);
                    }
                } else {
                    if (queue.length && !location.state?.fromFlashcardSrs) return;
                    let data = [];
                    if (mode === 'srs_folder' && folderIdParam) {
                        const queueUrl = `/srs/queue?folderId=${folderIdParam}${
                            selectedItemsParam ? `&selectedItems=${selectedItemsParam}` : ''
                        }`;
                        ({ data } = await fetchJSON(queueUrl, withCreds({ signal: ac.signal })));
                    } else if (mode === 'odat') {
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
                    setIdx(0);
                    setFlipped(false);
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
    }, [mode, idsParam, folderIdParam, selectedItemsParam, location.state?.fromFlashcardSrs, reloadKey, navigate]);

    // ───────────────────── 카드 상세/발음 메타 ─────────────────────
    useEffect(() => {
        setDetail(null);
        setPron(null);
        const cur = current;
        if (!cur || !cur.vocab) return;
        const vocabData = cur.vocab;
        setDetail(vocabData.dictMeta || {});
        setPron({ ipa: vocabData.dictMeta?.ipa, ipaKo: vocabData.dictMeta?.ipaKo });
    }, [current]);

    // ───────────────────── 자동재생/타이머 ─────────────────────
    useEffect(() => {
        if (mode !== 'flash' || !auto || !current || !audioRef.current) return;
        
        // 새 카드 시작 시: 현재 설정값으로 고정하고 재생 횟수 초기화
        setCurrentCardMaxPlayCount(maxPlayCount);
        setAudioPlayCount(0);
        
        const localAudioPath = `/${current.levelCEFR || 'A1'}/audio/${safeFileName(current.question)}.mp3`;
        const el = audioRef.current;
        
        // Setup audio event listeners
        const handleAudioStart = () => {
            setAudioPlayCount(prevCount => prevCount + 1);
        };
        
        const handleAudioEnd = () => {
            setAudioPlayCount(prevCount => {
                if (prevCount >= currentCardMaxPlayCount) {
                    // After max plays, advance to next card
                    stopAudio();
                    setIdx((i) => i + 1);
                    return 0;
                } else {
                    // Play again
                    setTimeout(() => {
                        if (el && el.src) {
                            el.currentTime = 0;
                            el.play().catch(e => console.error('오디오 재생 실패:', e));
                        }
                    }, 1000); // 1-second gap between plays
                    return prevCount;
                }
            });
        };

        // Start first play and setup listeners
        el.addEventListener('play', handleAudioStart);
        el.addEventListener('ended', handleAudioEnd);
        playUrl(localAudioPath, { loop: false });

        const flip = setInterval(() => setFlipped((f) => !f), flipIntervalRef.current);

        return () => { 
            clearInterval(flip); 
            el.removeEventListener('play', handleAudioStart);
            el.removeEventListener('ended', handleAudioEnd);
            stopAudio(); 
        };
    }, [mode, auto, current, maxPlayCount]);

    useEffect(() => { if (!queue[idx]) refreshSrsIds(); }, [queue, idx, refreshSrsIds]);

    // ───────────────────── 플로우 헬퍼 ─────────────────────
    const goToNextCard = () => {
        stopAudio();
        setAudioPlayCount(0); // Reset play count when manually advancing
        const nextIdx = idx + 1;
        const isFlashLike = (mode === 'flash' || !!idsParam);
        const shouldTriggerQuiz = isFlashLike && queue.length >= 10 && nextIdx % 10 === 0 && nextIdx < queue.length;
        if (shouldTriggerQuiz) {
            const lastTenWords = queue.slice(nextIdx - 10, nextIdx);
            const quizBatch = _.sampleSize(lastTenWords, 3);
            setReviewQuiz({ show: true, batch: quizBatch });
        } else {
            setFlipped(false);
            setIdx(nextIdx);
        }
    };

    const handleReviewQuizDone = () => {
        setReviewQuiz({ show: false, batch: [] });
        setFlipped(false);
        setAudioPlayCount(0); // Reset play count after quiz
        setIdx((i) => i + 1);
    };

    // ───────────────────── 배치 모드 핸들러 ─────────────────────
    const handleNextFlash = () => {
        stopAudio();
        setAudioPlayCount(0); // Reset play count when advancing
        const currentBatch = allBatches[batchIndex] || [];
        if (idx < currentBatch.length - 1) {
            setIdx((i) => i + 1);
            setFlipped(false);
        } else {
            setModeForBatch('quiz');
        }
    };

    const handleQuizDone = async () => {
        stopAudio();
        setAudioPlayCount(0); // Reset play count when advancing
        if (batchIndex < allBatches.length - 1) {
            setBatchIndex((i) => i + 1);
            setIdx(0);
            setFlipped(false);
            setModeForBatch('flash');
            return;
        }
        setModeForBatch('finished');
        try {
            const currentBatchIds = (allBatches[batchIndex] || []).map(it => it.vocabId).filter(Boolean);
            if (currentBatchIds.length) {
                await fetchJSON('/learn/flash/finish', withCreds({
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ vocabIds: currentBatchIds, createFolder: true })
                }));
            }
        } catch (e) {
            toast.error('오늘 폴더 생성 중 오류: ' + e.message);
        }
        try {
            const { data } = await fetchJSON('/learn/session/finish', withCreds({ method: 'POST' }));
            if (data?.highMistake > 0) toast.success(`오답률 높은 단어 ${data.highMistake}개로 복습 폴더가 생성되었습니다!`);
            else toast.info('완벽히 학습하셨네요! 다음날 복습 폴더는 생성되지 않았습니다.');
        } catch (e) {
            toast.error('세션 종료 중 오류 발생: ' + e.message);
        }
    };

    // ───────────────────── 기존(SRS/odat/ids) 핸들러 ─────────────────────
    const submit = async () => {
        if (!current || !userAnswer) return;
        setSubmitting(true);
        stopAudio();
        const isCorrect = userAnswer === current.answer;
        try {
            if (mode === 'odat') {
                setFeedback({ status: isCorrect ? 'pass' : 'fail', answer: current.answer });
                return;
            }
            const folderId = current.folderId || folderIdParam;
            if (!folderId) {
                toast.error('folderId가 없어 SRS 채점을 진행할 수 없습니다. 폴더에서 퀴즈를 시작하세요.');
                return;
            }
            const { data } = await fetchJSON('/quiz/answer', withCreds({
                method: 'POST', body: JSON.stringify({ folderId, cardId: current.cardId, correct: isCorrect })
            }));
            
            // 마스터 달성 축하 메시지 표시
            if (data?.isMasteryAchieved) {
                toast.success('🎉🌟 120일 마스터 완료! 축하합니다! 🌟🎉', {
                    duration: 5000,
                    style: {
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '16px'
                    }
                });
            }
            
            setFeedback({ status: data?.status ?? (isCorrect ? 'pass' : 'fail'), answer: current.answer });
        } catch (e) {
            console.error('답변 제출 실패:', e);
            toast.error(`답변 제출 실패: ${e.message || 'Internal Server Error'}`);
        } finally {
            setSubmitting(false);
        }
    };

    const next = () => {
        stopAudio();
        if (idx < queue.length - 1) {
            setIdx((i) => i + 1);
            setAnswer(null);
            setFeedback(null);
        } else {
            setIdx(queue.length);
        }
    };

    const handleRestart = () => {
        setIdx(0);
        setAnswer(null);
        setFeedback(null);
        forceReload();
    };


    // ───────────────────── 렌더링 ─────────────────────
    if (loading) return <main className="container py-4"><h4>학습 데이터 로딩 중…</h4></main>;
    if (err) return <main className="container py-4"><div className="alert alert-danger">퀴즈 로드 실패: {err.message}</div></main>;

    if (reviewQuiz.show) {
        return (
            <main className="container py-4" style={{ maxWidth: 720 }}>
                {/* 전역 오디오 엘리먼트 (숨김) */}
                <audio ref={audioRef} style={{ display: 'none' }} />

                <div className="alert alert-info text-center">
                    <h5 className="alert-heading">📝 중간 복습 퀴즈</h5>
                    <p className="mb-0">방금 학습한 10개 단어 중 3개를 복습합니다. (점수 미반영)</p>
                </div>
                <MiniQuiz batch={reviewQuiz.batch} onDone={handleReviewQuizDone} folderId={folderIdParam} isReviewQuiz={true} />
            </main>
        );
    }

    // 배치 모드
    if (mode === 'batch') {
        const currentBatch = allBatches[batchIndex];

        if (!currentBatch) {
            return (
                <main className="container py-4 text-center">
                    <audio ref={audioRef} style={{ display: 'none' }} />
                    <h4>🎉</h4>
                    <p className="lead">오늘 학습할 단어가 없습니다.</p>
                    <button onClick={() => navigate('/my-wordbook')} className="btn btn-primary">단어 추가하러 가기</button>
                </main>
            );
        }

        if (modeForBatch === 'finished') {
            return (
                <main className="container py-4" style={{ maxWidth: 720 }}>
                    <audio ref={audioRef} style={{ display: 'none' }} />
                    <div className="p-4 bg-light rounded text-center">
                        <h4 className="mb-2">🎉 모든 학습 완료!</h4>
                        <p className="text-muted">오답률이 높은 단어들은 내일 복습 폴더에 자동으로 추가됩니다.</p>
                        <div className="d-flex justify-content-center gap-3 mt-4">
                            <button className="btn btn-outline-secondary" onClick={() => window.location.reload()}>다시 학습하기</button>
                            <button className="btn btn-primary" onClick={() => navigate('/srs')}>SRS 학습하기</button>
                            <Link className="btn btn-outline-secondary" to="/">홈으로</Link>



                        </div>
                    </div>
                </main>
            );
        }

        return (
            <main className="container py-4" style={{ maxWidth: 720 }}>
                <audio ref={audioRef} style={{ display: 'none' }} />

                <div className="mb-3 text-center">
                    <span className="badge bg-dark">Batch {batchIndex + 1} / {allBatches.length}</span>
                </div>

                {modeForBatch === 'flash' && current && (
                    <div className="card">
                        <div className="card-header">플래시카드 ({idx + 1} / {currentBatch.length})</div>
                        <div className="card-body text-center p-5" style={{ minHeight: '300px', cursor: 'pointer' }} onClick={() => setFlipped(f => !f)}>
                            {!flipped ? (
                                <>
                                    <h2 className="display-4">{current.question}</h2>
                                    <Pron ipa={current.pron?.ipa} ipaKo={current.pron?.ipaKo} />
                                </>
                            ) : (
                                <>
                                    <h3 className="display-5 text-primary">{current.answer}</h3>
                                    {Array.isArray(current.examples) && current.examples.length > 0 && (
                                        <div className="mt-4 p-3 bg-light rounded w-100 text-start">
                                            <h6 className="fw-bold">예문</h6>
                                            {current.examples.map((ex, index) => (
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

    // 완료 화면 분기
    if (!current) {
        // 학습 완료 후 "폴더에 저장" 버튼을 눌렀을 때 실행될 함수
        const handleSaveToFolder = () => {
            const idsToSave = queue.map(item => item.vocabId).filter(Boolean);
            if (idsToSave.length === 0) {
                toast.info('저장할 단어가 없습니다.');
                return;
            }
            setLearnedVocabIds(idsToSave);
            setShowFolderPicker(true);
        };

        return (
            <>
                <main className="container py-4" style={{ maxWidth: 720 }}>
                    <audio ref={audioRef} style={{ display: 'none' }} />
                    <div className="p-4 bg-light rounded text-center">
                        <h4 className="mb-2">🎉 학습 완료!</h4>
                        <p className="text-muted">다음 작업을 선택하세요.</p>
                        <div className="d-flex flex-wrap justify-content-center gap-3 mt-4">
                            <button className="btn btn-outline-secondary" onClick={handleRestart}>다시 학습하기</button>

                            {/* --- 이 부분이 핵심 변경 사항입니다 --- */}
                            {(mode === 'flash' || !!idsParam) && (
                                <button className="btn btn-primary" onClick={handleSaveToFolder}>
                                    학습 단어 폴더에 저장
                                </button>
                            )}
                            {/* --- 여기까지 --- */}

                            {(!mode || mode === 'srs') && (
                                <>
                                    <Link className="btn btn-outline-secondary" to="/learn/srs-manager">문제 편집</Link>
                                    <Link className="btn btn-primary" to="/odat-note">오답 문제 풀이</Link>
                                </>
                            )}
                            {mode === 'odat' && (<Link className="btn btn-primary" to="/learn/vocab">SRS 퀴즈로 가기</Link>)}
                        </div>
                    </div>
                </main>

                {/* --- 모달 렌더링 로직 추가 --- */}
                {showFolderPicker && (
                    <AddLearnedToFolderModal
                        show={showFolderPicker}
                        onClose={() => setShowFolderPicker(false)}
                        vocabIds={learnedVocabIds}
                    />
                )}
            </>
        );
    }


    // 플래시 모드
    if (mode === 'flash') {
        const examples = currentDetail?.examples ?? [];
        return (
            <main className="container py-4" style={{ maxWidth: 720 }}>
                {/* 제어형 오디오: src/loop는 코드에서만 설정 */}
                <audio ref={audioRef} style={{ display: 'none' }} />

                <div className="d-flex align-items-center mb-2">
                    <strong className="me-auto">플래시카드 ({queue.length}개)</strong>
                    <button
                        type="button"
                        className="btn btn-light d-flex justify-content-center align-items-center"
                        onClick={() => { stopAudio(); setAuto((a) => !a); }}
                        style={{ borderRadius: '50%', width: '2.5rem', height: '2.5rem', border: '1px solid #dee2e6' }}
                        aria-label={auto ? '자동재생 멈춤' : '자동재생 시작'}
                    >
                        {auto
                            ? <svg xmlns="http://www.w3.org/2000/svg" width="18" viewBox="0 0 16 16"><path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z" /></svg>
                            : <svg xmlns="http://www.w3.org/2000/svg" width="18" viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.058c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z" /></svg>}
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
                        {/* 재생횟수 표시 & 설정 버튼 - 카드 우측 상단 */}
                        {auto && (
                            <div 
                                className="position-absolute d-flex align-items-center gap-2"
                                style={{ top: '10px', right: '10px' }}
                            >
                                <div className="bg-info text-white px-2 py-1 rounded small" style={{ fontSize: '0.75rem' }}>
                                    재생횟수: {audioPlayCount}회
                                </div>
                                <button
                                    className="btn btn-sm btn-outline-secondary p-1 d-flex align-items-center justify-content-center"
                                    style={{ width: '24px', height: '24px', fontSize: '12px' }}
                                    onClick={(e) => { e.stopPropagation(); setShowSettings(true); }}
                                    title="자동학습 설정"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                                        <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"/>
                                    </svg>
                                </button>
                            </div>
                        )}
                        {!flipped ? (
                            <>
                                <div className="d-flex justify-content-center gap-2 mb-2">
                                    {(current.pos || '').split(',').map((t) => t.trim()).filter((t) => t && t !== 'unk')
                                        .map((t) => <span key={t} className={`badge ${getPosBadgeColor(t)}`}>{t}</span>)}
                                </div>
                                <h2 className="display-5 mb-3" lang="en">{current.question}</h2>
                                <Pron ipa={current.pron?.ipa || currentPron?.ipa} ipaKo={current.pron?.ipaKo || currentPron?.ipaKo} />
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
                                                                <span
                                                                    lang="en"
                                                                    dangerouslySetInnerHTML={{
                                                                        __html: (ex.de || '').replace(
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
                        <button className="btn btn-primary w-75" onClick={goToNextCard}>다음 →</button>
                    </div>
                </div>
                
                {/* 설정 모달 */}
                {showSettings && (
                    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <div className="modal-dialog modal-dialog-centered">
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h5 className="modal-title">자동학습 설정</h5>
                                    <button type="button" className="btn-close" onClick={() => setShowSettings(false)}></button>
                                </div>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label className="form-label">재생 횟수 (1-10회)</label>
                                        <input
                                            type="range"
                                            className="form-range"
                                            min="1"
                                            max="10"
                                            value={maxPlayCount}
                                            onChange={(e) => setMaxPlayCount(parseInt(e.target.value))}
                                        />
                                        <div className="d-flex justify-content-between">
                                            <small>1회</small>
                                            <strong>{maxPlayCount}회</strong>
                                            <small>10회</small>
                                        </div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">카드 뒤집기 간격</label>
                                        <input
                                            type="range"
                                            className="form-range"
                                            min="3000"
                                            max="10000"
                                            step="1000"
                                            value={flipInterval}
                                            onChange={(e) => setFlipInterval(parseInt(e.target.value))}
                                        />
                                        <div className="d-flex justify-content-between">
                                            <small>3초</small>
                                            <strong>{flipInterval / 1000}초</strong>
                                            <small>10초</small>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowSettings(false)}>
                                        닫기
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* 설정 변경 토스트 알림 */}
                {showSettingsToast && (
                    <div 
                        className="position-fixed top-50 start-50 translate-middle alert alert-info alert-dismissible shadow-lg border-0"
                        style={{ 
                            zIndex: 1060,
                            minWidth: '320px',
                            maxWidth: '400px',
                            borderRadius: '12px',
                            backgroundColor: '#d1ecf1',
                            borderColor: '#bee5eb',
                            opacity: showSettingsToast ? 1 : 0,
                            transform: `translate(-50%, -50%) scale(${showSettingsToast ? 1 : 0.9})`,
                            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                        }}
                        role="alert"
                    >
                        <div className="d-flex align-items-center">
                            <div 
                                className="me-3 d-flex align-items-center justify-content-center"
                                style={{ 
                                    width: '40px', 
                                    height: '40px', 
                                    backgroundColor: '#0dcaf0', 
                                    borderRadius: '50%',
                                    flexShrink: 0
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="white" viewBox="0 0 16 16">
                                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                                    <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
                                </svg>
                            </div>
                            <div className="flex-grow-1">
                                <div className="fw-semibold text-info-emphasis mb-1">설정 변경됨</div>
                                <div className="small text-muted">다음 카드부터 새 설정이 적용됩니다</div>
                            </div>
                        </div>
                        <button 
                            type="button" 
                            className="btn-close position-absolute top-0 end-0 mt-2 me-2" 
                            onClick={() => setShowSettingsToast(false)}
                            aria-label="Close"
                            style={{ fontSize: '0.75rem' }}
                        ></button>
                    </div>
                )}
            </main>
        );
    }

    // SRS/오답노트 퀴즈
    return (
        <main className="container py-4" style={{ maxWidth: 720 }}>
            <audio ref={audioRef} style={{ display: 'none' }} />

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
