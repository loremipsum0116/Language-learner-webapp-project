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
    const quizTypeParam = query.get('quizType'); // 퀴즈 유형 파라미터 추가

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
    const audioPlayCountRef = useRef(0);
    
    // 깜짝 퀴즈 상태
    const [surpriseQuiz, setSurpriseQuiz] = useState({ show: false, questions: [], currentQ: 0, answers: [], showFeedback: false, selectedAnswer: null });
    const [studiedCards, setStudiedCards] = useState([]); // 이미 학습한 카드들 저장
    
    // 설정 상태
    const [maxPlayCount, setMaxPlayCount] = useState(3);
    const [flipInterval, setFlipInterval] = useState(5000); // 5초 기본값
    const [showSettings, setShowSettings] = useState(false);
    const [showSettingsToast, setShowSettingsToast] = useState(false);
    
    const [lastCardId, setLastCardId] = useState(null); // 카드 변경 감지용
    const flipIntervalRef = useRef(flipInterval);
    const maxPlayCountRef = useRef(maxPlayCount); // maxPlayCount의 최신값을 참조하기 위한 ref
    
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
    
    // maxPlayCount가 변경될 때 ref 업데이트
    useEffect(() => {
        maxPlayCountRef.current = maxPlayCount;
    }, [maxPlayCount]);

    
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
        
        // Stop current audio first
        stopAudio();
        
        // Small delay to ensure pause() completes before play()
        setTimeout(() => {
            if (!el) return; // Check again in case ref changed
            el.loop = !!loop;
            el.src = url.startsWith('/') ? `${API_BASE}${url}` : url;
            try { el.load(); } catch { }
            el.play().catch((e) => console.error('오디오 재생 실패:', e));
        }, 10); // Very small delay to avoid play/pause conflict
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
                        }${quizTypeParam ? `&quizType=${quizTypeParam}` : ''}`;
                        ({ data } = await fetchJSON(queueUrl, withCreds({ signal: ac.signal })));
                    } else if (mode === 'odat') {
                        const queueUrl = `/odat-note/queue?limit=100${quizTypeParam ? `&quizType=${quizTypeParam}` : ''}`;
                        ({ data } = await fetchJSON(queueUrl, withCreds({ signal: ac.signal })));
                    } else if (mode === 'flash' && folderIdParam && selectedItemsParam) {
                        // 플래시 모드에서 SRS 폴더의 선택된 아이템들로 자동학습
                        const queueUrl = `/srs/queue?folderId=${folderIdParam}&selectedItems=${selectedItemsParam}${quizTypeParam ? `&quizType=${quizTypeParam}` : ''}`;
                        ({ data } = await fetchJSON(queueUrl, withCreds({ signal: ac.signal })));
                    } else if (idsParam) {
                        const vocabIds = idsParam.split(',').map(Number).filter(Boolean);
                        ({ data } = await fetchJSON('/quiz/by-vocab', withCreds({ method: 'POST', body: JSON.stringify({ vocabIds }), signal: ac.signal })));
                    } else {
                        const queueUrl = `/srs/queue?limit=100${quizTypeParam ? `&quizType=${quizTypeParam}` : ''}`;
                        ({ data } = await fetchJSON(queueUrl, withCreds({ signal: ac.signal })));
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
        console.log('[DEBUG DETAIL] vocabData:', vocabData);
        console.log('[DEBUG DETAIL] dictentry:', vocabData.dictentry);
        console.log('[DEBUG DETAIL] dictMeta:', vocabData.dictMeta);
        setDetail(vocabData.dictentry || vocabData.dictMeta || {});
        setPron({ ipa: vocabData.dictentry?.ipa || vocabData.dictMeta?.ipa, ipaKo: vocabData.dictentry?.ipaKo || vocabData.dictMeta?.ipaKo });
    }, [current]);

    // ───────────────────── 자동재생/타이머 ─────────────────────
    useEffect(() => {
        if (mode !== 'flash' || !auto || !current || !audioRef.current) return;
        
        // 실제 카드가 변경된 경우에만 재생 횟수 초기화와 이벤트 리스너 설정
        const currentCardId = current.vocabId || current.cardId;
        const isNewCard = currentCardId !== lastCardId;
        
        if (isNewCard) {
            console.log('[AUDIO DEBUG] New card detected:', currentCardId, 'resetting count to 1, max:', maxPlayCountRef.current);
            setLastCardId(currentCardId);
            // 새 카드에서는 1부터 시작
            audioPlayCountRef.current = 1;
            setAudioPlayCount(1);
            
            const localAudioPath = `/${current.levelCEFR || 'A1'}/audio/${safeFileName(current.question)}.mp3`;
            const el = audioRef.current;
            
            // Setup audio event listeners only for new cards
            const handleAudioStart = () => {
                console.log('[AUDIO DEBUG] Play started, count:', audioPlayCountRef.current);
            };
            
            const handleAudioEnd = () => {
                console.log('[AUDIO DEBUG] Audio ended, count:', audioPlayCountRef.current, 'max:', maxPlayCountRef.current);
                if (audioPlayCountRef.current >= maxPlayCountRef.current) {
                    // After max plays, advance to next card
                    console.log('[AUDIO DEBUG] Max plays reached, advancing to next card');
                    el.removeEventListener('play', handleAudioStart);
                    el.removeEventListener('ended', handleAudioEnd);
                    stopAudio();
                    setIdx((i) => i + 1);
                } else {
                    // Increment count and play again after delay
                    audioPlayCountRef.current = audioPlayCountRef.current + 1;
                    setAudioPlayCount(audioPlayCountRef.current);
                    console.log('[AUDIO DEBUG] Playing again in 1 second, new count:', audioPlayCountRef.current);
                    setTimeout(() => {
                        if (el && el.src) {
                            console.log('[AUDIO DEBUG] Actually playing again now');
                            el.currentTime = 0;
                            el.play().then(() => {
                                console.log('[AUDIO DEBUG] Repeat play started successfully');
                            }).catch(e => {
                                console.error('[AUDIO DEBUG] 재생 반복 실패:', e);
                            });
                        }
                    }, 1000); // 1-second gap between plays
                }
            };

            // Remove any existing listeners first to prevent duplicates
            el.removeEventListener('play', handleAudioStart);
            el.removeEventListener('ended', handleAudioEnd);
            
            // Setup listeners first, then start first play
            el.addEventListener('play', handleAudioStart);
            el.addEventListener('ended', handleAudioEnd);
            
            console.log('[AUDIO DEBUG] Starting first play for new card:', currentCardId);
            // 즉시 오디오 재생 (딜레이 제거)
            el.loop = false;
            el.src = localAudioPath.startsWith('/') ? `${API_BASE}${localAudioPath}` : localAudioPath;
            console.log('[AUDIO DEBUG] Audio src set to:', el.src);
            el.load();
            el.play().then(() => {
                console.log('[AUDIO DEBUG] Audio play started successfully');
            }).catch((e) => {
                console.error('[AUDIO DEBUG] 오디오 재생 실패:', e);
            });

            const flip = setInterval(() => setFlipped((f) => !f), flipIntervalRef.current);

            return () => { 
                clearInterval(flip); 
                el.removeEventListener('play', handleAudioStart);
                el.removeEventListener('ended', handleAudioEnd);
                // 새 카드일 때만 오디오 정지
                stopAudio();
            };
        } else {
            // Same card - just handle flip interval changes, don't touch audio
            console.log('[AUDIO DEBUG] Same card:', currentCardId, 'updating flip interval only');
            const flip = setInterval(() => setFlipped((f) => !f), flipIntervalRef.current);
            return () => clearInterval(flip);
        }
    }, [mode, auto, current?.vocabId, current?.cardId]); // lastCardId 의존성 제거로 중복 실행 방지

    useEffect(() => { if (!queue[idx]) refreshSrsIds(); }, [queue, idx, refreshSrsIds]);

    // ───────────────────── 플로우 헬퍼 ─────────────────────
    const goToNextCard = () => {
        stopAudio();
        setAudioPlayCount(0); // Reset play count when manually advancing
        
        // 현재 카드를 학습 완료된 카드 목록에 추가
        if (current) {
            setStudiedCards(prev => [...prev, current]);
        }
        
        const nextIdx = idx + 1;
        const isFlashLike = (mode === 'flash' || !!idsParam);
        const shouldTriggerSurpriseQuiz = isFlashLike && queue.length >= 11 && nextIdx % 10 === 0 && nextIdx < queue.length;
        
        if (shouldTriggerSurpriseQuiz) {
            // 방금 학습한 10개 카드에서 랜덤으로 3개 선택 (새로 추가될 현재 카드 포함)
            const allStudiedCards = [...studiedCards, current];
            const lastTenCards = allStudiedCards.slice(-10);
            const selectedCards = _.sampleSize(lastTenCards, Math.min(3, lastTenCards.length));
            
            // 깜짝 퀴즈 문제 생성
            const quizQuestions = selectedCards.map(card => {
                // 오답 선택지를 전체 큐에서 생성 (더 많은 선택지 확보)
                const otherAnswers = queue
                    .filter(q => q.vocabId !== card.vocabId)
                    .map(q => q.answer);
                
                const wrongOptions = _.sampleSize(otherAnswers, 3);
                
                // 중복 제거 후 4개가 안 되면 기본 오답 추가
                const uniqueOptions = _.uniq([card.answer, ...wrongOptions]);
                while (uniqueOptions.length < 4) {
                    uniqueOptions.push(`기타 선택지 ${uniqueOptions.length}`);
                }
                
                const allOptions = _.shuffle(uniqueOptions.slice(0, 4));
                
                return {
                    question: card.question,
                    correctAnswer: card.answer,
                    options: allOptions,
                    vocabId: card.vocabId
                };
            });
            
            setSurpriseQuiz({ 
                show: true, 
                questions: quizQuestions, 
                currentQ: 0, 
                answers: [] 
            });
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

    // 깜짝 퀴즈 핸들러
    const handleSurpriseQuizAnswer = (selectedAnswer) => {
        const currentQuestion = surpriseQuiz.questions[surpriseQuiz.currentQ];
        const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
        
        // 피드백 표시
        setSurpriseQuiz(prev => ({
            ...prev,
            showFeedback: true,
            selectedAnswer: selectedAnswer
        }));
        
        const newAnswers = [...surpriseQuiz.answers, {
            question: currentQuestion.question,
            selected: selectedAnswer,
            correct: currentQuestion.correctAnswer,
            isCorrect: isCorrect
        }];

        // 1.5초 후 다음 문제로 이동 또는 퀴즈 완료
        setTimeout(() => {
            if (surpriseQuiz.currentQ < surpriseQuiz.questions.length - 1) {
                // 다음 문제로
                setSurpriseQuiz(prev => ({
                    ...prev,
                    currentQ: prev.currentQ + 1,
                    answers: newAnswers,
                    showFeedback: false,
                    selectedAnswer: null
                }));
            } else {
                // 퀴즈 완료
                setSurpriseQuiz({ show: false, questions: [], currentQ: 0, answers: [], showFeedback: false, selectedAnswer: null });
                setFlipped(false);
                setIdx(idx + 1); // 다음 카드로 이동
            }
        }, 1500);
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
        
        // 퀴즈 유형에 따라 정답 비교 로직 분기
        let isCorrect = false;
        if (quizTypeParam === 'context' || (quizTypeParam === 'mixed' && current.contextQuestion)) {
            // 예문 빈칸 채우기: 영단어끼리 비교
            const correctAnswer = current.question || current.vocab?.lemma || '';
            isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();
            console.log('[SUBMIT DEBUG] Context quiz - userAnswer:', userAnswer, 'correctAnswer:', correctAnswer, 'isCorrect:', isCorrect);
        } else {
            // 기존 뜻 맞추기: 한국어 뜻끼리 비교  
            isCorrect = userAnswer === current.answer;
            console.log('[SUBMIT DEBUG] Meaning quiz - userAnswer:', userAnswer, 'current.answer:', current.answer, 'isCorrect:', isCorrect);
        }
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

    // SRS 모드에서 퀴즈 유형이 선택되지 않은 경우 유형 선택 화면 표시
    if ((mode === 'srs_folder' || (!mode && !idsParam)) && !quizTypeParam) {
        const currentUrl = new URL(window.location);
        
        const handleQuizTypeSelect = (type) => {
            currentUrl.searchParams.set('quizType', type);
            navigate(currentUrl.pathname + currentUrl.search);
        };

        return (
            <main className="container py-4" style={{ maxWidth: 720 }}>
                <audio ref={audioRef} style={{ display: 'none' }} />
                <div className="card">
                    <div className="card-header bg-primary text-white">
                        <h5 className="mb-0">📚 학습 유형 선택</h5>
                    </div>
                    <div className="card-body p-4">
                        <p className="text-muted mb-4">원하는 학습 유형을 선택해주세요.</p>
                        
                        <div className="d-grid gap-3">
                            <button 
                                className="btn btn-outline-primary btn-lg text-start p-3"
                                onClick={() => handleQuizTypeSelect('meaning')}
                            >
                                <div className="d-flex align-items-center">
                                    <div className="me-3" style={{ fontSize: '2rem' }}>🔤</div>
                                    <div>
                                        <h6 className="mb-1">4지선다 (영단어 뜻 맞추기)</h6>
                                        <small className="text-muted">영어 단어를 보고 한국어 뜻을 선택합니다</small>
                                    </div>
                                </div>
                            </button>
                            
                            <button 
                                className="btn btn-outline-success btn-lg text-start p-3"
                                onClick={() => handleQuizTypeSelect('context')}
                            >
                                <div className="d-flex align-items-center">
                                    <div className="me-3" style={{ fontSize: '2rem' }}>📝</div>
                                    <div>
                                        <h6 className="mb-1">4지선다 (예문 빈칸 채우기)</h6>
                                        <small className="text-muted">예문의 빈칸에 들어갈 알맞은 영어 단어를 선택합니다</small>
                                    </div>
                                </div>
                            </button>
                            
                            <button 
                                className="btn btn-outline-warning btn-lg text-start p-3"
                                onClick={() => handleQuizTypeSelect('mixed')}
                            >
                                <div className="d-flex align-items-center">
                                    <div className="me-3" style={{ fontSize: '2rem' }}>🎯</div>
                                    <div>
                                        <h6 className="mb-1">혼합형</h6>
                                        <small className="text-muted">두 유형이 랜덤하게 섞여서 출제됩니다</small>
                                    </div>
                                </div>
                            </button>
                        </div>
                        
                        <div className="mt-4 text-center">
                            <Link 
                                className="btn btn-outline-secondary"
                                to={folderIdParam ? `/srs/folder/${folderIdParam}` : '/srs'}
                            >
                                ← 돌아가기
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    // 깜짝 퀴즈 렌더링
    if (surpriseQuiz.show) {
        const currentQ = surpriseQuiz.questions[surpriseQuiz.currentQ];
        const isCorrect = surpriseQuiz.selectedAnswer === currentQ.correctAnswer;
        
        return (
            <main className="container py-4" style={{ maxWidth: 720 }}>
                <div className="card">
                    <div className="card-header bg-warning text-dark">
                        <h5 className="mb-0">🎯 깜짝 퀴즈! ({surpriseQuiz.currentQ + 1}/{surpriseQuiz.questions.length})</h5>
                    </div>
                    <div className="card-body text-center p-4">
                        <h3 className="mb-4" lang="en">{currentQ.question}</h3>
                        
                        {surpriseQuiz.showFeedback && (
                            <div className={`alert ${isCorrect ? 'alert-success' : 'alert-danger'} mb-4`}>
                                <strong>{isCorrect ? '✅ 정답!' : '❌ 오답!'}</strong>
                                {!isCorrect && (
                                    <div className="mt-1">
                                        정답: <strong>{currentQ.correctAnswer}</strong>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        <div className="d-grid gap-2">
                            {currentQ.options.map((option, index) => {
                                let btnClass = 'btn btn-outline-primary btn-lg text-start';
                                
                                if (surpriseQuiz.showFeedback) {
                                    if (option === currentQ.correctAnswer) {
                                        btnClass = 'btn btn-success btn-lg text-start';
                                    } else if (option === surpriseQuiz.selectedAnswer && !isCorrect) {
                                        btnClass = 'btn btn-danger btn-lg text-start';
                                    } else {
                                        btnClass = 'btn btn-secondary btn-lg text-start';
                                    }
                                }
                                
                                return (
                                    <button
                                        key={index}
                                        className={btnClass}
                                        onClick={() => !surpriseQuiz.showFeedback && handleSurpriseQuizAnswer(option)}
                                        disabled={surpriseQuiz.showFeedback}
                                    >
                                        {option}
                                    </button>
                                );
                            })}
                        </div>
                        
                        {!surpriseQuiz.showFeedback && (
                            <div className="mt-3 text-muted small">
                                방금 학습한 단어들 중에서 출제됩니다
                            </div>
                        )}
                    </div>
                </div>
            </main>
        );
    }

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
                                    <div className="d-flex justify-content-center gap-2 mb-2">
                                        {(current.pos || '').split(',').map((t) => t.trim()).filter((t) => t && t !== 'unk')
                                            .map((t) => <span key={t} className={`badge ${getPosBadgeColor(t)}`}>{t}</span>)}
                                    </div>
                                    <Pron ipa={current.pron?.ipa} ipaKo={current.pron?.ipaKo} />
                                    <h2 className="display-4">{current.question}</h2>
                                </>
                            ) : (
                                <>
                                    <h3 className="display-5 text-primary">{current.answer}</h3>
{/* 예문 표시 - 배치 모드에서도 동일한 로직 사용 */}
                                    {(() => {
                                        const examples = current.vocab?.dictentry?.examples || [];
                                        
                                        // 예문 구조 파싱
                                        let displayExamples = [];
                                        
                                        for (const ex of examples) {
                                            if (ex.definitions) {
                                                for (const def of ex.definitions) {
                                                    if (def.examples && Array.isArray(def.examples)) {
                                                        displayExamples.push(...def.examples.slice(0, 2));
                                                        break;
                                                    }
                                                }
                                            }
                                            if (displayExamples.length > 0) break;
                                        }
                                        
                                        if (displayExamples.length === 0) return null;
                                        
                                        return (
                                            <div className="mt-4 p-3 bg-light rounded w-100 text-start">
                                                <h6 className="fw-bold">예문</h6>
                                                {displayExamples.map((example, index) => (
                                                    <div key={index} className="mt-2">
                                                        <p className="mb-0" lang="en">{example.en}</p>
                                                        <small className="text-muted">— {example.ko}</small>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
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

                            {/* SRS 폴더에서 온 자동학습이 아닌 경우에만 "폴더에 저장" 버튼 표시 */}
                            {(mode === 'flash' || !!idsParam) && !folderIdParam && (
                                <button className="btn btn-primary" onClick={handleSaveToFolder}>
                                    학습 단어 폴더에 저장
                                </button>
                            )}
                            
                            {/* SRS 폴더에서 온 자동학습인 경우 "폴더로 돌아가기" 버튼 표시 */}
                            {(mode === 'flash' || !!idsParam) && folderIdParam && (
                                <Link className="btn btn-primary" to={`/srs/folder/${folderIdParam}`}>
                                    폴더로 돌아가기
                                </Link>
                            )}

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
                                <Pron ipa={current.pron?.ipa || currentPron?.ipa} ipaKo={current.pron?.ipaKo || currentPron?.ipaKo} />
                                <h2 className="display-5 mb-3" lang="en">{current.question}</h2>
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
                    {/* 예문 빈칸 채우기 유형 */}
                    {(() => {
                        // 혼합형인 경우 클라이언트에서 랜덤하게 유형 결정
                        if (quizTypeParam === 'mixed') {
                            // 카드 ID를 시드로 사용하여 일관된 랜덤 결정 (50:50 비율)
                            const cardId = current.cardId || current.vocabId || 0;
                            const isContextType = (cardId % 2) === 0; // 짝수면 예문 빈칸 채우기, 홀수면 뜻 맞추기
                            console.log('[MIXED DEBUG] Card ID:', cardId, 'isContextType:', isContextType, 'Type:', isContextType ? 'Context' : 'Meaning');
                            return isContextType;
                        }
                        return quizTypeParam === 'context' || current.contextQuestion;
                    })() ? (
                        <>
                            {/* 예문과 한국어 번역 표시 */}
                            <div className="mb-4">
                                <h4 className="text-primary mb-3">다음 빈칸에 들어갈 알맞은 단어를 선택하세요</h4>
                                {(() => {
                                    // 예문 데이터 찾기 - 여러 소스에서 시도
                                    let exampleSentence = '';
                                    let exampleTranslation = '';
                                    
                                    console.log('[CONTEXT DEBUG] Current data:', current);
                                    console.log('[CONTEXT DEBUG] vocab.dictentry:', current.vocab?.dictentry);
                                    console.log('[CONTEXT DEBUG] vocab.dictMeta:', current.vocab?.dictMeta);
                                    
                                    // 1. current.contextSentence가 있는 경우 (서버에서 직접 제공)
                                    if (current.contextSentence) {
                                        exampleSentence = current.contextSentence;
                                        exampleTranslation = current.contextTranslation || '';
                                        console.log('[CONTEXT DEBUG] Found contextSentence:', exampleSentence);
                                    }
                                    // 2. vocab.dictentry.examples에서 찾기
                                    else if (current.vocab?.dictentry?.examples) {
                                        const examples = current.vocab.dictentry.examples;
                                        console.log('[CONTEXT DEBUG] dictentry.examples:', examples);
                                        console.log('[CONTEXT DEBUG] first example structure:', examples[0]);
                                        
                                        // examples가 JSON 문자열인 경우 파싱
                                        let parsedExamples = examples;
                                        if (typeof examples === 'string') {
                                            try {
                                                parsedExamples = JSON.parse(examples);
                                            } catch (e) {
                                                console.warn('[CONTEXT DEBUG] Failed to parse examples:', e);
                                            }
                                        }
                                        
                                        for (const exampleBlock of parsedExamples) {
                                            console.log('[CONTEXT DEBUG] processing exampleBlock:', exampleBlock);
                                            
                                            // 다양한 구조 시도
                                            if (exampleBlock.definitions) {
                                                console.log('[CONTEXT DEBUG] found definitions:', exampleBlock.definitions);
                                                for (const def of exampleBlock.definitions) {
                                                    if (def.examples && def.examples.length > 0) {
                                                        const firstExample = def.examples[0];
                                                        console.log('[CONTEXT DEBUG] checking firstExample:', firstExample);
                                                        // de 필드에 영어 예문이 있는 경우 처리
                                                        if ((firstExample.en || firstExample.de) && firstExample.ko) {
                                                            // 영어 예문에서 현재 단어를 빈칸으로 교체
                                                            const lemma = current.question || current.vocab.lemma;
                                                            const englishSentence = firstExample.en || firstExample.de;
                                                            exampleSentence = englishSentence.replace(
                                                                new RegExp(`\\b${lemma}\\b`, 'gi'), 
                                                                '____'
                                                            );
                                                            exampleTranslation = firstExample.ko;
                                                            console.log('[CONTEXT DEBUG] Found example from definitions:', exampleSentence);
                                                            break;
                                                        }
                                                    }
                                                }
                                                if (exampleSentence) break;
                                            }
                                            // 직접 examples 배열이 있는 경우도 확인
                                            else if (exampleBlock.examples && exampleBlock.examples.length > 0) {
                                                console.log('[CONTEXT DEBUG] found direct examples:', exampleBlock.examples);
                                                const firstExample = exampleBlock.examples[0];
                                                if ((firstExample.en || firstExample.de) && firstExample.ko) {
                                                    const lemma = current.question || current.vocab.lemma;
                                                    const englishSentence = firstExample.en || firstExample.de;
                                                    exampleSentence = englishSentence.replace(
                                                        new RegExp(`\\b${lemma}\\b`, 'gi'), 
                                                        '____'
                                                    );
                                                    exampleTranslation = firstExample.ko;
                                                    console.log('[CONTEXT DEBUG] Found example from direct examples:', exampleSentence);
                                                    break;
                                                }
                                            }
                                            // exampleBlock 자체가 example인 경우
                                            else if ((exampleBlock.en || exampleBlock.de) && exampleBlock.ko) {
                                                console.log('[CONTEXT DEBUG] exampleBlock is direct example:', exampleBlock);
                                                const lemma = current.question || current.vocab.lemma;
                                                const englishSentence = exampleBlock.en || exampleBlock.de;
                                                exampleSentence = englishSentence.replace(
                                                    new RegExp(`\\b${lemma}\\b`, 'gi'), 
                                                    '____'
                                                );
                                                exampleTranslation = exampleBlock.ko;
                                                console.log('[CONTEXT DEBUG] Found example from direct block:', exampleSentence);
                                                break;
                                            }
                                        }
                                    }
                                    // 3. vocab.dictMeta.examples에서 찾기 (백업)
                                    else if (current.vocab?.dictMeta?.examples) {
                                        const examples = current.vocab.dictMeta.examples;
                                        console.log('[CONTEXT DEBUG] dictMeta.examples:', examples);
                                        
                                        // examples가 JSON 문자열인 경우 파싱
                                        let parsedExamples = examples;
                                        if (typeof examples === 'string') {
                                            try {
                                                parsedExamples = JSON.parse(examples);
                                            } catch (e) {
                                                console.warn('[CONTEXT DEBUG] Failed to parse dictMeta examples:', e);
                                            }
                                        }
                                        
                                        for (const exampleBlock of parsedExamples) {
                                            if (exampleBlock.definitions) {
                                                for (const def of exampleBlock.definitions) {
                                                    if (def.examples && def.examples.length > 0) {
                                                        const firstExample = def.examples[0];
                                                        if (firstExample.en && firstExample.ko) {
                                                            const lemma = current.question || current.vocab.lemma;
                                                            exampleSentence = firstExample.en.replace(
                                                                new RegExp(`\\b${lemma}\\b`, 'gi'), 
                                                                '____'
                                                            );
                                                            exampleTranslation = firstExample.ko;
                                                            console.log('[CONTEXT DEBUG] Found example from dictMeta:', exampleSentence);
                                                            break;
                                                        }
                                                    }
                                                }
                                                if (exampleSentence) break;
                                            }
                                        }
                                    }
                                    // 4. 임시 예문 생성 (마지막 fallback)
                                    else {
                                        const lemma = current.question || current.vocab?.lemma || 'word';
                                        exampleSentence = `This is an example sentence with ____.`;
                                        exampleTranslation = `이것은 ${lemma}가 포함된 예문입니다.`;
                                        console.log('[CONTEXT DEBUG] Using fallback example:', exampleSentence);
                                    }
                                    
                                    return exampleSentence ? (
                                        <div className="mb-3">
                                            <p className="fs-5 mb-2" lang="en">
                                                {exampleSentence.split('____').map((part, index, array) => (
                                                    <span key={index}>
                                                        {part}
                                                        {index < array.length - 1 && <span className="text-danger fw-bold">____</span>}
                                                    </span>
                                                ))}
                                            </p>
                                            {exampleTranslation && (
                                                <p className="text-muted">
                                                    {(() => {
                                                        // 한국어 번역에서 정답에 해당하는 단어 찾기
                                                        const lemma = current.question || current.vocab?.lemma || '';
                                                        // 여러 가능한 한국어 뜻들을 시도
                                                        const possibleKoreanWords = [
                                                            '가방', '봉지', // bag의 경우
                                                            '책', // book의 경우  
                                                            '집', '가정', // home의 경우
                                                            '물', // water의 경우
                                                        ];
                                                        
                                                        // current.answer에서 한국어 뜻 추출 (예: "n.가방, 봉지" → "가방")
                                                        let koreanMeaning = '';
                                                        if (current.answer && current.answer.includes('.')) {
                                                            const meaningPart = current.answer.split('.')[1];
                                                            koreanMeaning = meaningPart.split(',')[0].trim();
                                                        }
                                                        
                                                        // 한국어 번역에서 해당 단어를 찾아서 빨간색으로 표시
                                                        if (koreanMeaning && exampleTranslation.includes(koreanMeaning)) {
                                                            return exampleTranslation.split(koreanMeaning).map((part, index, array) => (
                                                                <span key={index}>
                                                                    {part}
                                                                    {index < array.length - 1 && <strong className="text-danger">{koreanMeaning}</strong>}
                                                                </span>
                                                            ));
                                                        }
                                                        
                                                        // fallback: 전체 번역 표시
                                                        return exampleTranslation;
                                                    })()}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="alert alert-warning">
                                            이 단어의 예문을 찾을 수 없습니다.
                                        </div>
                                    );
                                })()}
                            </div>
                            
                            {!feedback && (
                                <div className="d-grid gap-2 col-8 mx-auto mt-3">
                                    {/* 예문 빈칸 채우기에서는 영단어 옵션 사용 */}
                                    {(() => {
                                        // 1. 서버에서 wordOptions를 제공하는 경우
                                        if (current.wordOptions && current.wordOptions.length > 0) {
                                            return current.wordOptions.map((opt) => (
                                                <button key={opt}
                                                    className={`btn btn-lg ${userAnswer === opt ? 'btn-primary' : 'btn-outline-primary'}`}
                                                    onClick={() => setAnswer(opt)}
                                                    disabled={isSubmitting}>
                                                    {opt}
                                                </button>
                                            ));
                                        }
                                        
                                        // 2. fallback: 클라이언트에서 현실적인 영단어 옵션 생성
                                        const correctAnswer = current.question || current.vocab?.lemma || 'unknown';
                                        
                                        // 단어 유형별 오답 옵션 풀
                                        const wordPools = {
                                            // 명사
                                            'bag': ['box', 'cup', 'book', 'pen'],
                                            'book': ['bag', 'pen', 'cup', 'desk'],
                                            'cup': ['bag', 'book', 'pen', 'box'],
                                            'pen': ['book', 'bag', 'cup', 'desk'],
                                            'desk': ['chair', 'table', 'bed', 'door'],
                                            'chair': ['desk', 'table', 'bed', 'door'],
                                            'car': ['bus', 'bike', 'train', 'plane'],
                                            'house': ['school', 'park', 'store', 'hotel'],
                                            // 동사  
                                            'run': ['walk', 'jump', 'sit', 'sleep'],
                                            'walk': ['run', 'jump', 'sit', 'stand'],
                                            'eat': ['drink', 'sleep', 'read', 'write'],
                                            'read': ['write', 'eat', 'sleep', 'walk'],
                                            // 형용사
                                            'big': ['small', 'long', 'short', 'tall'],
                                            'small': ['big', 'long', 'short', 'wide'],
                                            'good': ['bad', 'nice', 'great', 'fine'],
                                            'bad': ['good', 'nice', 'great', 'fine'],
                                            // 기본 풀
                                            'default': ['word', 'item', 'thing', 'part']
                                        };
                                        
                                        // 현재 단어에 맞는 오답 옵션 가져오기
                                        const lowerAnswer = correctAnswer.toLowerCase();
                                        const wrongOptions = wordPools[lowerAnswer] || wordPools['default'];
                                        
                                        // 정답 + 오답 3개 조합
                                        const allOptions = [correctAnswer, ...wrongOptions.slice(0, 3)];
                                        
                                        // 카드 ID를 시드로 사용하여 일관된 순서 생성
                                        const cardId = current.cardId || current.vocabId || 0;
                                        const shuffledOptions = [...allOptions].sort((a, b) => {
                                            // 카드 ID와 옵션 텍스트를 조합하여 일관된 해시 생성
                                            const hashA = (cardId + a.charCodeAt(0)) % 1000;
                                            const hashB = (cardId + b.charCodeAt(0)) % 1000;
                                            return hashA - hashB;
                                        });
                                        
                                        return shuffledOptions.map((opt) => (
                                            <button key={opt}
                                                className={`btn btn-lg ${userAnswer === opt ? 'btn-primary' : 'btn-outline-primary'}`}
                                                onClick={() => setAnswer(opt)}
                                                disabled={isSubmitting}>
                                                {opt}
                                            </button>
                                        ));
                                    })()}
                                    <button className="btn btn-success btn-lg mt-2"
                                        disabled={!userAnswer || isSubmitting}
                                        onClick={submit}>
                                        {isSubmitting ? '처리 중…' : '제출하기'}
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        /* 기존 영단어 뜻 맞추기 유형 */
                        <>
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
                        </>
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
