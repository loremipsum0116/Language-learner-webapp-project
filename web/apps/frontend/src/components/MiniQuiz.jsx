// src/pages/LearnVocab.jsx

import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import _ from 'lodash';

import { fetchJSON, withCreds, API_BASE, isAbortError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Pron from '../components/Pron';
import MiniQuiz from '../components/MiniQuiz';

// --- Helper Functions (No changes) ---
const safeFileName = (s) => encodeURIComponent(String(s ?? '').toLowerCase().replace(/\s+/g, '_'));

const cefrToFolder = {
    'A1': 'starter',
    'A2': 'elementary', 
    'B1': 'intermediate',
    'B2': 'upper',
    'C1': 'advanced',
    'C2': 'advanced'
};

const getCurrentAudioPath = (vocab) => {
    const audioData = vocab.dictentry?.audioLocal ? JSON.parse(vocab.dictentry.audioLocal) : null;
    const exampleAudioPath = audioData?.example;
    if (exampleAudioPath) {
        return exampleAudioPath.startsWith('/') ? exampleAudioPath : `/${exampleAudioPath}`;
    }
    
    // 숙어/구동사인 경우 특별 처리
    if (vocab.source === 'idiom_migration' && vocab.lemma) {
        const cleanLemma = vocab.lemma.toLowerCase().replace(/\s+/g, '_');
        return `/idiom/${cleanLemma}_example.mp3`;
    }
    
    const folderName = cefrToFolder[vocab.levelCEFR] || 'starter';
    return `/${folderName}/${safeFileName(vocab.question)}/example.mp3`;
};

const getCefrBadgeColor = (level) => {
    switch (level) {
        case 'A1': return 'bg-danger';
        case 'A2': return 'bg-warning text-dark';
        case 'B1': return 'bg-success';
        case 'B2': return 'bg-info text-dark';
        case 'C1': return 'bg-primary';
        case 'C2': return 'bg-dark';
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

const shuffleArray = (arr) => _.shuffle(arr);
const useQuery = () => {
    const { search } = useLocation();
    return useMemo(() => new URLSearchParams(search), [search]);
};


export default function LearnVocab() {
    console.log('[COMPONENT] LearnVocab component is rendering');
    const navigate = useNavigate();
    const location = useLocation();
    const query = useQuery();
    const { refreshSrsIds } = useAuth();

    const mode = query.get('mode');
    const idsParam = query.get('ids');
    const autoParam = query.get('auto');
    const folderIdParam = query.get('folderId');

    // --- State Management ---
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const audioRef = useRef(null);
    const [queue, setQueue] = useState(() => location.state?.initialQueue ?? []);
    const [idx, setIdx] = useState(0);
    const [userAnswer, setAnswer] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [isSubmitting, setSubmitting] = useState(false);
    const [reloading, setReloading] = useState(false);
    const [reloadKey, forceReload] = useReducer((k) => k + 1, 0);
    const [flipped, setFlipped] = useState(false);
    const [auto, setAuto] = useState(autoParam === '1');
    const [currentDetail, setDetail] = useState(null);
    const [currentPron, setPron] = useState(null);
    
    const [reviewQuiz, setReviewQuiz] = useState({ show: false, batch: [] });

    // --- Audio Control ---
    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.removeAttribute('src');
            audioRef.current = null;
        }
    };

    const playUrl = (url) => {
        stopAudio();
        if (!url) return;

        // URL 경로의 각 세그먼트를 개별적으로 인코딩
        let encodedUrl = url;
        if (url.startsWith('/')) {
            const pathSegments = url.split('/').filter(segment => segment);
            const encodedSegments = pathSegments.map(segment => encodeURIComponent(segment));
            encodedUrl = '/' + encodedSegments.join('/');
        }

        const src = encodedUrl.startsWith('/') ? `${API_BASE}${encodedUrl}` : encodedUrl;
        const audio = new Audio(src);
        if ((mode === 'flash' || idsParam) && auto) {
            audio.loop = true;
        }
        audio.play().then(() => { audioRef.current = audio; }).catch(e => { console.error("Audio playback failed:", e, src); });
    };

    useEffect(() => {
        return () => stopAudio();
    }, []);

    // --- Data Loading ---
    useEffect(() => {
        const ac = new AbortController();
        setLoading(true);
        setErr(null);

        (async () => {
            try {
                let data = [];
                if (mode === 'srs_folder' && folderIdParam) {
                    ({ data } = await fetchJSON(`/srs/queue?folderId=${folderIdParam}`, withCreds({ signal: ac.signal })));
                } else if (mode === 'odat') {
                    ({ data } = await fetchJSON('/api/odat-note/queue?limit=100', withCreds({ signal: ac.signal })));
                } else if (idsParam) {
                    const vocabIds = idsParam.split(',').map(Number).filter(Boolean);
                    ({ data } = await fetchJSON('/quiz/by-vocab', withCreds({ method: 'POST', body: JSON.stringify({ vocabIds }), signal: ac.signal })));
                } else {
                    ({ data } = await fetchJSON('/srs/queue?limit=100', withCreds({ signal: ac.signal })));
                }
                let fetched = Array.isArray(data) ? data : [];
                if (mode === 'flash') fetched = shuffleArray(fetched);
                setQueue(fetched);
            } catch (e) {
                if (!isAbortError(e)) setErr(e);
            } finally {
                if (!ac.signal.aborted) setLoading(false);
            }
        })();

        return () => { ac.abort(); stopAudio(); };
    }, [mode, idsParam, folderIdParam, location.state?.fromFlashcardSrs, reloadKey, navigate]);
    
    // ✅ FIX: Moved variable definition to a higher scope
    // This makes it accessible to both useEffect hooks below.
    const currentCardForDetail = queue[idx];

    // --- Card Detail Loading ---
    useEffect(() => {
        setDetail(null);
        setPron(null);
        if (!currentCardForDetail || !currentCardForDetail.vocab) return;
        
        const vocabData = currentCardForDetail.vocab;
        setDetail(vocabData.dictMeta || {});
        setPron({ ipa: vocabData.dictMeta?.ipa, ipaKo: vocabData.dictMeta?.ipaKo });

    }, [currentCardForDetail]);

    // --- Handlers ---
    const goToNextCard = () => {
        stopAudio();
        const nextIdx = idx + 1;
        
        const shouldTriggerQuiz = (mode === 'flash' || idsParam) && 
                                  queue.length >= 10 && 
                                  nextIdx % 10 === 0 && 
                                  nextIdx < queue.length;

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
        setIdx(idx + 1);
    };

    const submit = async () => { /* ... (Existing submit logic) ... */ };
    const next = () => { /* ... (Existing next logic) ... */ };
    const handleRestart = () => { /* ... (Existing restart logic) ... */ };
    const handleReplaceSrsAndLearn = async () => { /* ... (Existing replace logic) ... */ };

    // --- Auto-play Timer ---
    useEffect(() => {
        if (mode !== 'flash' && !idsParam) return;
        if (!auto || !currentCardForDetail) return;
        
        // 현재 cefr_vocabs.json 오디오 경로 사용
        const localAudioPath = getCurrentAudioPath(currentCardForDetail);
        playUrl(localAudioPath);

        const flip = setInterval(() => setFlipped((f) => !f), 5000);
        const nextT = setInterval(goToNextCard, 20000);
        
        return () => { 
            clearInterval(flip); 
            clearInterval(nextT);
            stopAudio();
        };
    }, [mode, auto, currentCardForDetail, idsParam]);

    // ======================== RENDER ========================
    console.log('[RENDER] Loading:', loading, 'Error:', err, 'Current:', current, 'Queue length:', queue.length);
    if (loading) {
        console.log('[RENDER] Showing loading screen');
        return <main className="container py-4"><h4>학습 데이터 로딩 중…</h4></main>;
    }
    if (err) {
        console.log('[RENDER] Showing error screen:', err);
        return <main className="container py-4"><div className="alert alert-danger">퀴즈 로드 실패: {err.message}</div></main>;
    }
    
    if (reviewQuiz.show) {
        return (
            <main className="container py-4" style={{ maxWidth: 720 }}>
                <div className="alert alert-info text-center">
                    <h5 className="alert-heading">📝 중간 복습 퀴즈</h5>
                    <p className="mb-0">방금 학습한 10개 단어 중 3개를 복습합니다. (점수 미반영)</p>
                </div>
                <MiniQuiz 
                    batch={reviewQuiz.batch} 
                    onDone={handleReviewQuizDone} 
                    isReviewQuiz={true}
                />
            </main>
        );
    }

    const current = queue[idx];
    if (!current) { 
        // ... Existing completion screen logic ...
        return (
            <main className="container py-4 text-center">
                <h4>🎉 학습 완료!</h4>
                <p>수고하셨습니다.</p>
            </main>
        );
    }

    if (mode === 'flash' || idsParam) {
        const vocab = current.vocab || current;
        const koGloss = vocab.ko_gloss || '뜻 정보 없음';
        const uniquePosList = [...new Set(vocab.pos ? vocab.pos.split(',').map(p => p.trim()) : [])];
        
        return (
            <main className="container py-4" style={{ maxWidth: 720 }}>
                {/* Header */}
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h4 className="mb-0">
                        🎯 {mode === 'flash' ? '플래시카드 학습' : '선택 자동학습'} 
                        <span className="text-muted"> ({idx + 1}/{queue.length})</span>
                    </h4>
                    <div className="d-flex align-items-center gap-2">
                        <label className="form-check-label d-flex align-items-center">
                            <input
                                type="checkbox"
                                className="form-check-input me-1"
                                checked={auto}
                                onChange={(e) => setAuto(e.target.checked)}
                            />
                            자동 재생
                        </label>
                    </div>
                </div>

                <div className="card">
                    <div className="card-body text-center">
                        <div className="mb-3">
                            <h2 className="card-title mb-2" lang="en">{vocab.lemma || vocab.question}</h2>
                            <div className="d-flex justify-content-center gap-1 mb-2">
                                {vocab.levelCEFR && <span className={`badge ${getCefrBadgeColor(vocab.levelCEFR)}`}>{vocab.levelCEFR}</span>}
                                {uniquePosList.map(p => (
                                    p && p.toLowerCase() !== 'unk' && (
                                        <span key={p} className={`badge ${getPosBadgeColor(p)} fst-italic`}>
                                            {p}
                                        </span>
                                    )
                                ))}
                            </div>
                            {currentPron && (
                                <div className="mb-2">
                                    <Pron ipa={currentPron.ipa} ipaKo={currentPron.ipaKo} />
                                </div>
                            )}
                        </div>


{console.log('[RENDER DEBUG] Flipped state:', flipped)}
                        {!flipped ? (
                            <div className="text-center">
                                <p className="text-muted mb-3">카드를 뒤집어서 뜻과 예문을 확인하세요</p>
                                <button 
                                    className="btn btn-primary btn-lg"
                                    onClick={() => setFlipped(true)}
                                >
                                    뒤집기
                                </button>
                                <div className="mt-2 text-muted small">
                                    DEBUG: flipped = {flipped.toString()}
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div className="mb-3">
                                    <h5 className="text-primary">🇰🇷 뜻</h5>
                                    <p className="fs-5">{koGloss}</p>
                                </div>
                                
{/* Debug: Show all available data - Always show for debugging */}
                                <div className="mb-2 p-2 bg-light border rounded">
                                    <small className="text-muted">Debug Info:</small>
                                    <pre style={{ fontSize: '10px', maxHeight: '150px', overflow: 'auto' }}>
                                        {JSON.stringify({
                                            currentDetail,
                                            vocab: vocab,
                                            dictMeta: vocab.dictMeta,
                                            dictentry: vocab.dictentry,
                                            examples: vocab?.dictentry?.examples
                                        }, null, 2)}
                                    </pre>
                                </div>
                                
                                {/* Use the exact same logic as VocabDetailModal */}
                                {(() => {
                                    const dictentry = vocab?.dictentry || {};
                                    const rawMeanings = Array.isArray(dictentry.examples) ? dictentry.examples : [];
                                    const exampleExample = rawMeanings.find(ex => ex.kind === 'example');
                                    
                                    // Same condition as VocabDetailModal
                                    if (exampleExample && exampleExample.ko) {
                                        // Same logic as VocabDetailModal, with chirpScript fallback
                                        let englishExample = exampleExample.en || '';
                                        
                                        // If no en field, try to extract from chirpScript
                                        if (!englishExample && exampleExample.chirpScript) {
                                            const match = exampleExample.chirpScript.match(/예문은 (.+?)\./);
                                            englishExample = match ? match[1] : '';
                                            console.log('[EXAMPLE DEBUG] Extracted from chirpScript:', englishExample);
                                        }
                                        
                                        console.log('[EXAMPLE DEBUG] Final englishExample:', englishExample);
                                        console.log('[EXAMPLE DEBUG] Korean translation:', exampleExample.ko);
                                        
                                        return (
                                            <div className="mb-3">
                                                <h5 className="text-success">🇺🇸 예문</h5>
                                                <div className="p-2 rounded bg-light">
                                                    {englishExample && (
                                                        <p lang="en" className="fw-bold mb-1">{englishExample}</p>
                                                    )}
                                                    <p className="text-muted small mb-0">— {exampleExample.ko}</p>
                                                </div>
                                                
                                                <button 
                                                    className="btn btn-sm btn-outline-success mt-2"
                                                    onClick={() => {
                                                        const localAudioPath = getCurrentAudioPath(current);
                                                        playUrl(localAudioPath);
                                                    }}
                                                >
                                                    🔊 예문 듣기
                                                </button>
                                            </div>
                                        );
                                    }
                                    
                                    return null;
                                })()}
                                
                                <button 
                                    className="btn btn-secondary"
                                    onClick={() => setFlipped(false)}
                                >
                                    앞면 보기
                                </button>
                            </div>
                        )}
                    </div>
                    
                    <div className="card-footer d-flex gap-2">
                        <button className="btn btn-outline-secondary w-25"
                            onClick={() => { stopAudio(); setFlipped(false); setIdx((i) => Math.max(0, i - 1)); }}>
                            ← 이전
                        </button>
                        <button className="btn btn-primary w-75" onClick={goToNextCard}>
                            다음 →
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    // --- SRS / Odat-note Quiz Render ---
    return ( 
        <main className="container py-4" style={{ maxWidth: 720 }}>
            {/* ... Existing quiz render logic ... */}
        </main>
    );
}
