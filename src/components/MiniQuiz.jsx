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
const getPosBadgeColor = (pos) => { /* ... */ };
const shuffleArray = (arr) => _.shuffle(arr);
const useQuery = () => {
    const { search } = useLocation();
    return useMemo(() => new URLSearchParams(search), [search]);
};


export default function LearnVocab() {
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
        const src = url.startsWith('/') ? `${API_BASE}${url}` : url;
        const audio = new Audio(src);
        if ((mode === 'flash' || idsParam) && auto) {
            audio.loop = true;
        }
        audio.play().then(() => { audioRef.current = audio; }).catch(e => { console.error("Audio playback failed:", e); });
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
        
        const localAudioPath = `/${currentCardForDetail.levelCEFR}/audio/${safeFileName(currentCardForDetail.question)}.mp3`;
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
    if (loading) return <main className="container py-4"><h4>학습 데이터 로딩 중…</h4></main>;
    if (err) return <main className="container py-4"><div className="alert alert-danger">퀴즈 로드 실패: {err.message}</div></main>;
    
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
        return (
            <main className="container py-4" style={{ maxWidth: 720 }}>
                {/* ... (Existing flashcard header) ... */}
                <div className="card">
                    {/* ... (Existing card body) ... */}
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
