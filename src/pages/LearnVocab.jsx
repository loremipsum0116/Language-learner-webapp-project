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
    const isManualPlayRef = useRef(false); // 수동 재생인지 구분하는 플래그
    
    // 깜짝 퀴즈 상태
    const [surpriseQuiz, setSurpriseQuiz] = useState({ show: false, questions: [], currentQ: 0, answers: [], showFeedback: false, selectedAnswer: null });
    const [studiedCards, setStudiedCards] = useState([]); // 이미 학습한 카드들 저장
    
    // 스펠링 입력 상태
    const [spellingInput, setSpellingInput] = useState('');
    const [attemptCount, setAttemptCount] = useState(0);
    const [maxAttempts] = useState(3);
    const [showSpellingWarning, setShowSpellingWarning] = useState(false);
    
    // 오답 추적 상태
    const [wrongAnswerCards, setWrongAnswerCards] = useState([]);
    
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
    
    // maxPlayCount ref 업데이트 (항상)
    useEffect(() => {
        maxPlayCountRef.current = maxPlayCount;
        console.log('[SETTINGS] maxPlayCount ref updated to:', maxPlayCount);
    }, [maxPlayCount]);
    
    // maxPlayCount 변경 시 즉시 진행 체크 (설정 변경에만 반응)
    useEffect(() => {
        console.log('[SETTINGS] maxPlayCount changed to:', maxPlayCount, '- checking conditions');
        
        // 초기 로딩이나 기본값인 경우 무시
        if (maxPlayCount === 3) {
            console.log('[SETTINGS] Default value (3) - skipping');
            return; 
        }
        
        // 선택 자동학습 모드가 아니면 무시
        if (!(mode === 'flash' && auto)) {
            console.log('[SETTINGS] Not flash auto mode - skipping');
            return;
        }
        
        // 데이터 로딩 상태 확인
        const currentBatch = allBatches[batchIndex] || [];
        const hasQueueData = queue && queue.length > 0;
        const hasBatchData = currentBatch.length > 0;
        
        if (!hasQueueData && !hasBatchData) {
            console.log('[SETTINGS] No data loaded yet - skipping. Queue length:', queue?.length, 'Batch length:', currentBatch.length);
            return;
        }
        
        // 현재 오디오가 재생 중인지 확인 (재생 중이 아닐 때만 진행 체크)
        const el = audioRef.current;
        if (el && el.currentSrc && !el.paused) {
            console.log('[SETTINGS] Audio is playing - waiting for natural end');
            return;
        }
        
        const currentCount = audioPlayCountRef.current;
        console.log('[SETTINGS] All checks passed - current count:', currentCount, 'new max:', maxPlayCount);
        
        // 현재 재생 횟수가 새로운 설정값에 이미 도달한 경우에만 즉시 진행
        if (maxPlayCount > 0 && currentCount >= maxPlayCount) {
            console.log('[SETTINGS] IMMEDIATE ADVANCE NEEDED - current:', currentCount, 'max:', maxPlayCount);
            
            // 현재 재생 중인 오디오가 있다면 정리
            const el = audioRef.current;
            if (el) {
                console.log('[SETTINGS] Cleaning up audio listeners');
                if (el._currentPlayHandler) {
                    el.removeEventListener('play', el._currentPlayHandler);
                    el._currentPlayHandler = null;
                }
                if (el._currentEndHandler) {
                    el.removeEventListener('ended', el._currentEndHandler);
                    el._currentEndHandler = null;
                }
                stopAudio();
            }
            
            // 다음 카드로 진행 (timeout으로 비동기 처리)
            setTimeout(() => {
                setIdx(currentIdx => {
                    // 실제 사용 중인 데이터 구조 확인
                    const currentBatch = allBatches[batchIndex] || [];
                    const queueLength = queue?.length || 0;
                    
                    // batch 모드인지 queue 모드인지 확인
                    let isLastCard, totalLength;
                    if (mode === 'batch' && currentBatch.length > 0) {
                        isLastCard = currentIdx >= currentBatch.length - 1;
                        totalLength = currentBatch.length;
                    } else {
                        isLastCard = currentIdx >= queueLength - 1;
                        totalLength = queueLength;
                    }
                    
                    console.log('[SETTINGS] ADVANCING - isLastCard:', isLastCard, 'currentIdx:', currentIdx, 'totalLength:', totalLength, 'mode:', mode);
                    
                    if (isLastCard) {
                        console.log('[SETTINGS] LAST CARD - COMPLETING');
                        setModeForBatch('finished');
                        return currentIdx;
                    } else {
                        console.log('[SETTINGS] NEXT CARD');
                        setFlipped(false);
                        return currentIdx + 1;
                    }
                });
            }, 100);
            
        } else {
            console.log('[SETTINGS] No advance needed - current:', currentCount, 'max:', maxPlayCount);
        }
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
        
        // 이벤트 리스너 정리
        try {
            if (el._currentPlayHandler) {
                el.removeEventListener('play', el._currentPlayHandler);
                el._currentPlayHandler = null;
            }
            if (el._currentEndHandler) {
                el.removeEventListener('ended', el._currentEndHandler);
                el._currentEndHandler = null;
            }
        } catch { }
        
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
                    
                    // 플래시 모드에서 선택된 아이템들의 경우 allBatches도 설정
                    if (mode === 'flash' && folderIdParam && selectedItemsParam && fetched.length > 0) {
                        console.log('[BATCH DEBUG] Setting allBatches for selected items:', fetched);
                        // 자동학습 모드에서는 모든 단어를 하나의 배치로 처리 (배치 분할 없음)
                        if (auto) {
                            setAllBatches([fetched]); // 전체 단어를 하나의 배치로
                        } else {
                            setAllBatches(_.chunk(fetched, 10)); // 일반 모드에서는 10개씩 분할
                        }
                        setModeForBatch('flash');
                    }
                    setIdx(0);
                    setFlipped(false);
                    // 스펠링 입력 상태 초기화
                    setSpellingInput('');
                    setAttemptCount(0);
                    setShowSpellingWarning(false);
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
            // 새 카드에서만 maxPlayCount 설정을 업데이트
            maxPlayCountRef.current = maxPlayCount;
            console.log('[AUDIO DEBUG] New card detected:', currentCardId, 'resetting count to 0, max:', maxPlayCountRef.current);
            setLastCardId(currentCardId);
            // 새 카드에서는 0부터 시작 (첫 재생 후 1이 됨)
            audioPlayCountRef.current = 0;
            setAudioPlayCount(0);
            
            const localAudioPath = `/${current.levelCEFR || 'A1'}/audio/${safeFileName(current.question)}.mp3`;
            const el = audioRef.current;
            
            // 기존 이벤트 리스너 제거 (중복 방지)
            el.removeEventListener('play', el._currentPlayHandler);
            el.removeEventListener('ended', el._currentEndHandler);
            
            const handleAudioStart = () => {
                // 수동 재생이 아닌 경우에만 카운트 증가
                if (!isManualPlayRef.current) {
                    audioPlayCountRef.current = audioPlayCountRef.current + 1;
                    setAudioPlayCount(audioPlayCountRef.current);
                    console.log('[AUDIO DEBUG] Play started, count increased to:', audioPlayCountRef.current);
                } else {
                    console.log('[AUDIO DEBUG] Manual play detected, count not increased');
                    isManualPlayRef.current = false; // 플래그 리셋
                }
            };
            
            const handleAudioEnd = () => {
                console.log('[AUDIO DEBUG] Audio ended, count:', audioPlayCountRef.current, 'max:', maxPlayCountRef.current);
                
                // 동적으로 현재 인덱스와 배치 정보 가져오기
                setIdx(currentIdx => {
                    const currentBatch = allBatches[batchIndex] || [];
                    const queueLength = queue?.length || 0;
                    
                    // batch 모드인지 queue 모드인지 확인하여 올바른 길이 사용
                    let isLastCard, totalLength;
                    if (mode === 'batch' && currentBatch.length > 0) {
                        isLastCard = currentIdx >= currentBatch.length - 1;
                        totalLength = currentBatch.length;
                    } else {
                        isLastCard = currentIdx >= queueLength - 1;
                        totalLength = queueLength;
                    }
                    
                    console.log('[AUDIO DEBUG] isLastCard:', isLastCard, 'currentIdx:', currentIdx, 'totalLength:', totalLength, 'mode:', mode, 'queueLength:', queueLength);
                    
                    if (audioPlayCountRef.current >= maxPlayCountRef.current) {
                        // After max plays, check if last card or advance to next
                        console.log('[AUDIO DEBUG] Max plays reached');
                        el.removeEventListener('play', handleAudioStart);
                        el.removeEventListener('ended', handleAudioEnd);
                        stopAudio();
                        
                        if (isLastCard) {
                            // 마지막 카드이면 완료 처리
                            console.log('[AUDIO DEBUG] LAST CARD - Force completing after max plays');
                            handleQuizDone();
                            return currentIdx; // 인덱스 변경 없음
                        } else {
                            // 다음 카드로 이동 (범위 체크 추가)
                            const nextIdx = currentIdx + 1;
                            console.log('[AUDIO DEBUG] Advancing to next card, nextIdx:', nextIdx, 'totalLength:', totalLength);
                            setFlipped(false);
                            
                            // 범위를 벗어나지 않도록 체크
                            if (nextIdx < totalLength) {
                                return nextIdx;
                            } else {
                                // 범위 초과 시 학습 완료 처리
                                console.log('[AUDIO DEBUG] Index overflow - triggering completion');
                                handleQuizDone();
                                return currentIdx; // 인덱스 변경 없음
                            }
                        }
                    } else {
                        // 아직 최대 재생 횟수에 도달하지 않음 - 다시 재생
                        // Play again after delay (count will be incremented on 'play' event)
                        console.log('[AUDIO DEBUG] Playing again in 1 second, current count:', audioPlayCountRef.current);
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
                        return currentIdx; // 인덱스 변경 없음
                    }
                });
            };

            // Remove any existing listeners first to prevent duplicates
            el.removeEventListener('play', el._currentPlayHandler);
            el.removeEventListener('ended', el._currentEndHandler);
            
            // Setup listeners first, then start first play
            el._currentPlayHandler = handleAudioStart;
            el._currentEndHandler = handleAudioEnd;
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

    // 페이지 이탈 감지
    useEffect(() => {
        const handleBeforeUnload = () => {
            console.log('[PAGE DEBUG] Page unloading - auto:', auto, 'mode:', mode, 'modeForBatch:', modeForBatch);
        };
        
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [auto, mode, modeForBatch]);

    useEffect(() => { if (!queue[idx]) refreshSrsIds(); }, [queue, idx, refreshSrsIds]);

    // 컴포넌트 상태 디버깅 및 자동완료 체크
    useEffect(() => {
        console.log('[COMPONENT DEBUG] Current state - mode:', mode, 'auto:', auto, 'modeForBatch:', modeForBatch, 'idx:', idx, 'batchIndex:', batchIndex, 'allBatches.length:', allBatches.length);
        
        // 자동학습 모드에서 배치 완료 체크 (수동 네비게이션 시에만)
        // 오디오 자동 재생에서는 이미 처리하므로 여기서는 수동 조작 시에만 체크
        if (mode === 'flash' && auto && modeForBatch === 'flash' && allBatches.length > 0) {
            const currentBatch = allBatches[batchIndex] || [];
            // 더 엄격한 조건: idx가 배치 길이와 정확히 같을 때만 (수동으로 마지막 카드를 넘겼을 때)
            if (idx === currentBatch.length && !audioRef.current?.src) {
                console.log('[AUTO COMPLETE DEBUG] Batch completed via manual navigation - calling handleQuizDone');
                setTimeout(() => handleQuizDone(), 100);
            }
        }
    }, [mode, auto, modeForBatch, idx, batchIndex, allBatches.length]);

    // ───────────────────── 플로우 헬퍼 ─────────────────────
    const goToNextCard = () => {
        stopAudio();
        
        // 현재 카드를 학습 완료된 카드 목록에 추가
        if (current) {
            setStudiedCards(prev => [...prev, current]);
        }
        
        const nextIdx = idx + 1;
        
        // 마지막 카드가 아닐 때만 재생횟수 초기화
        if (nextIdx < queue.length) {
            setAudioPlayCount(0); // Reset play count when manually advancing
        }
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
            // 인덱스 범위 체크 추가
            if (nextIdx < queue.length) {
                setIdx(nextIdx);
            } else {
                // 마지막 카드인 경우 학습 완료 상태로 전환
                setIdx(queue.length);
            }
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
                // 마지막 카드가 아닐 때만 다음 카드로 이동
                const nextIdx = idx + 1;
                if (nextIdx < queue.length) {
                    setIdx(nextIdx);
                } else {
                    // 마지막 카드인 경우 학습 완료 상태로 전환
                    setIdx(queue.length);
                }
            }
        }, 1500);
    };

    // ───────────────────── 배치 모드 핸들러 ─────────────────────
    const handleNextFlash = () => {
        stopAudio();
        const currentBatch = allBatches[batchIndex] || [];
        console.log('[NEXT FLASH DEBUG] idx:', idx, 'currentBatch.length:', currentBatch.length);
        
        if (idx < currentBatch.length - 1) {
            setAudioPlayCount(0); // Reset play count when advancing to next card
            setIdx((i) => i + 1);
            setFlipped(false);
        } else {
            // 마지막 카드인 경우 재생횟수 초기화하지 않음
            console.log('[NEXT FLASH DEBUG] Batch completed, auto:', auto);
            // 자동학습 모드에서는 퀴즈 건너뛰고 바로 완료 처리
            if (auto) {
                console.log('[NEXT FLASH DEBUG] Auto mode - calling handleQuizDone');
                handleQuizDone();
            } else {
                setModeForBatch('quiz');
            }
        }
    };

    const handleQuizDone = async () => {
        stopAudio();
        
        // 다음 배치가 있는 경우에만 재생횟수 초기화 (마지막 완료가 아닌 경우)
        if (batchIndex < allBatches.length - 1) {
            setAudioPlayCount(0); // Reset play count when advancing to next batch
            setBatchIndex((i) => i + 1);
            setIdx(0);
            setFlipped(false);
            setModeForBatch('flash');
            return;
        }
        
        // 마지막 배치 완료 시에는 재생횟수를 초기화하지 않음
        setModeForBatch('finished');
        try {
            // 실제 사용 중인 데이터 구조 확인
            const currentBatch = allBatches[batchIndex] || [];
            const queueData = queue || [];
            
            let vocabIds = [];
            let cardIds = [];
            
            // batch 모드인지 queue 모드인지 확인하여 올바른 데이터 사용
            if (mode === 'batch' && currentBatch.length > 0) {
                vocabIds = currentBatch.map(it => it.vocabId).filter(Boolean);
                cardIds = currentBatch.map(it => it.cardId).filter(Boolean);
                console.log('[LEARN FINISH DEBUG] Using batch data - currentBatch:', currentBatch);
            } else {
                vocabIds = queueData.map(it => it.vocabId).filter(Boolean);
                cardIds = queueData.map(it => it.cardId).filter(Boolean);
                console.log('[LEARN FINISH DEBUG] Using queue data - queue:', queueData);
            }
            
            console.log('[LEARN FINISH DEBUG] vocabIds:', vocabIds);
            console.log('[LEARN FINISH DEBUG] cardIds:', cardIds);
            
            if (vocabIds.length || cardIds.length) {
                const requestBody = { 
                    vocabIds: vocabIds, 
                    cardIds: cardIds, 
                    createFolder: true 
                };
                console.log('[LEARN FINISH DEBUG] Sending request body:', requestBody);
                
                await fetchJSON('/learn/flash/finish', withCreds({
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                }));
            }
        } catch (e) {
            toast.error('오늘 폴더 생성 중 오류: ' + e.message);
        }
        try {
            const { data } = await fetchJSON('/learn/session/finish', withCreds({ method: 'POST' }));
            // 자동학습 모드에서는 토스트 메시지 출력하지 않음
            if (!auto) {
                if (data?.highMistake > 0) toast.success(`오답률 높은 단어 ${data.highMistake}개로 복습 폴더가 생성되었습니다!`);
                else toast.info('완벽히 학습하셨네요! 다음날 복습 폴더는 생성되지 않았습니다.');
            }
        } catch (e) {
            // 자동학습 모드에서는 세션 종료 에러도 조용히 처리
            if (!auto) {
                toast.error('세션 종료 중 오류 발생: ' + e.message);
            }
        }
        
        // API 요청 완료 후 강제로 상태 재설정하여 완료 페이지가 확실히 표시되도록 함
        console.log('[LEARN FINISH DEBUG] All API calls completed - forcing rerender with finished state');
        setTimeout(() => {
            setModeForBatch('finished');
            // 추가로 컴포넌트 상태도 업데이트하여 리렌더링 확실히 트리거
            setFlipped(false);
        }, 100);
    };

    // ───────────────────── 스펠링 입력 헬퍼 함수들 ─────────────────────
    const isSpellingMixedType = () => {
        if (quizTypeParam === 'mixed') {
            const cardId = current.cardId || current.vocabId || 0;
            // 혼합형에서 스펠링은 1/3 확률 (0, 3, 6, 9... 일 때)
            return (cardId % 3) === 0;
        }
        return false;
    };

    const handleSpellingSubmit = async () => {
        if (!current || !spellingInput.trim()) return;
        
        setSubmitting(true);
        stopAudio();
        
        const correctAnswer = current.question || current.vocab?.lemma || '';
        
        // 예문에서 실제 사용된 형태를 찾는 함수
        const findOriginalFormInSentence = (sentence, baseWord) => {
            if (!sentence) return null;
            
            const words = sentence.toLowerCase().match(/\b\w+\b/g) || [];
            const base = baseWord.toLowerCase();
            
            // 불규칙 동사 매핑
            const irregularForms = {
                'call': ['calls', 'called', 'calling'],
                'receive': ['receives', 'received', 'receiving'],
                'go': ['goes', 'went', 'going', 'gone'],
                'get': ['gets', 'got', 'getting', 'gotten'],
                'make': ['makes', 'made', 'making'],
                'take': ['takes', 'took', 'taking', 'taken'],
                'have': ['has', 'had', 'having'],
                'be': ['is', 'are', 'was', 'were', 'being', 'been'],
                'do': ['does', 'did', 'doing', 'done'],
                'say': ['says', 'said', 'saying'],
                'see': ['sees', 'saw', 'seeing', 'seen'],
                'know': ['knows', 'knew', 'knowing', 'known'],
                'think': ['thinks', 'thought', 'thinking'],
                'come': ['comes', 'came', 'coming'],
                'give': ['gives', 'gave', 'giving', 'given'],
                'find': ['finds', 'found', 'finding'],
                'tell': ['tells', 'told', 'telling'],
                'become': ['becomes', 'became', 'becoming'],
                'leave': ['leaves', 'left', 'leaving'],
                'feel': ['feels', 'felt', 'feeling'],
                'bring': ['brings', 'brought', 'bringing'],
                'begin': ['begins', 'began', 'beginning', 'begun'],
                'keep': ['keeps', 'kept', 'keeping'],
                'hold': ['holds', 'held', 'holding'],
                'write': ['writes', 'wrote', 'writing', 'written'],
                'stand': ['stands', 'stood', 'standing'],
                'hear': ['hears', 'heard', 'hearing'],
                'let': ['lets', 'letting'],
                'mean': ['means', 'meant', 'meaning'],
                'set': ['sets', 'setting'],
                'meet': ['meets', 'met', 'meeting'],
                'run': ['runs', 'ran', 'running'],
                'pay': ['pays', 'paid', 'paying'],
                'sit': ['sits', 'sat', 'sitting'],
                'speak': ['speaks', 'spoke', 'speaking', 'spoken'],
                'lie': ['lies', 'lay', 'lying'],
                'lead': ['leads', 'led', 'leading'],
                'read': ['reads', 'reading'],
                'grow': ['grows', 'grew', 'growing', 'grown'],
                'lose': ['loses', 'lost', 'losing'],
                'send': ['sends', 'sent', 'sending'],
                'build': ['builds', 'built', 'building'],
                'understand': ['understands', 'understood', 'understanding'],
                'draw': ['draws', 'drew', 'drawing', 'drawn'],
                'break': ['breaks', 'broke', 'breaking', 'broken'],
                'spend': ['spends', 'spent', 'spending'],
                'cut': ['cuts', 'cutting'],
                'rise': ['rises', 'rose', 'rising', 'risen'],
                'drive': ['drives', 'drove', 'driving', 'driven'],
                'buy': ['buys', 'bought', 'buying'],
                'wear': ['wears', 'wore', 'wearing', 'worn'],
                'choose': ['chooses', 'chose', 'choosing', 'chosen']
            };
            
            // 1. 불규칙 동사 확인
            if (irregularForms[base]) {
                for (const form of irregularForms[base]) {
                    if (words.includes(form)) {
                        return form;
                    }
                }
            }
            
            // 2. 규칙 변화 확인
            for (const word of words) {
                // 복수형 s, es
                if (word === base + 's' || word === base + 'es') return word;
                
                // 과거형 ed
                if (word === base + 'ed') return word;
                
                // ing형
                if (word === base + 'ing') return word;
                
                // y -> ies 변화
                if (base.endsWith('y') && word === base.slice(0, -1) + 'ies') return word;
                
                // e 탈락 변화
                if (base.endsWith('e')) {
                    const baseWithoutE = base.slice(0, -1);
                    if (word === baseWithoutE + 'ed' || word === baseWithoutE + 'ing') return word;
                }
            }
            
            return null;
        };
        
        // 스펠링 정답 체크 함수 - 원형과 예문의 실제 형태만 인정
        const checkSpellingAnswer = (userInput, targetWord) => {
            const input = userInput.trim().toLowerCase();
            const target = targetWord.toLowerCase();
            
            // 1. 원형은 항상 정답
            if (input === target) return true;
            
            // 2. 예문에서 실제 사용된 형태 찾기
            let exampleSentence = '';
            if (current.contextSentence) {
                exampleSentence = current.contextSentence;
            } else if (current.vocab?.dictentry?.examples) {
                // 현재 표시된 예문을 찾기 (빈칸 대체 전 원본)
                const examples = current.vocab.dictentry.examples;
                let parsedExamples = examples;
                if (typeof examples === 'string') {
                    try {
                        parsedExamples = JSON.parse(examples);
                    } catch (e) {
                        console.warn('Failed to parse examples:', e);
                    }
                }
                
                for (const exampleBlock of parsedExamples) {
                    if (exampleBlock.definitions) {
                        for (const def of exampleBlock.definitions) {
                            if (def.examples && def.examples.length > 0) {
                                const firstExample = def.examples[0];
                                if (firstExample.en || firstExample.de) {
                                    exampleSentence = firstExample.en || firstExample.de;
                                    break;
                                }
                            }
                        }
                        if (exampleSentence) break;
                    }
                    else if (exampleBlock.examples && exampleBlock.examples.length > 0) {
                        const firstExample = exampleBlock.examples[0];
                        if (firstExample.en || firstExample.de) {
                            exampleSentence = firstExample.en || firstExample.de;
                            break;
                        }
                    }
                    else if (exampleBlock.en || exampleBlock.de) {
                        exampleSentence = exampleBlock.en || exampleBlock.de;
                        break;
                    }
                }
            }
            
            console.log('[SPELLING DEBUG] Finding original form in sentence:', exampleSentence);
            const originalForm = findOriginalFormInSentence(exampleSentence, target);
            console.log('[SPELLING DEBUG] Original form found:', originalForm);
            
            // 3. 예문에서 찾은 형태도 정답으로 인정
            if (originalForm && input === originalForm) return true;
            
            return false;
        };
        
        const isCorrect = checkSpellingAnswer(spellingInput, correctAnswer);
        
        console.log('[SPELLING DEBUG] Input:', spellingInput, 'Correct:', correctAnswer, 'isCorrect:', isCorrect, 'Attempt:', attemptCount + 1);
        
        if (isCorrect) {
            // 정답인 경우 바로 서버로 전송
            try {
                if (mode === 'odat') {
                    setFeedback({ status: 'pass', answer: correctAnswer });
                    return;
                }
                const folderId = current.folderId || folderIdParam;
                if (!folderId) {
                    toast.error('folderId가 없어 SRS 채점을 진행할 수 없습니다. 폴더에서 퀴즈를 시작하세요.');
                    return;
                }
                const { data } = await fetchJSON('/quiz/answer', withCreds({
                    method: 'POST', body: JSON.stringify({ folderId, cardId: current.cardId, correct: true })
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
                
                setFeedback({ status: data?.status ?? 'pass', answer: correctAnswer });
            } catch (e) {
                console.error('답변 제출 실패:', e);
                toast.error(`답변 제출 실패: ${e.message || 'Internal Server Error'}`);
            } finally {
                setSubmitting(false);
            }
        } else {
            // 오답인 경우 시도 횟수 증가
            const newAttemptCount = attemptCount + 1;
            setAttemptCount(newAttemptCount);
            
            if (newAttemptCount >= maxAttempts) {
                // 3번째 오답이면 최종 오답 처리
                try {
                    if (mode === 'odat') {
                        setFeedback({ status: 'fail', answer: correctAnswer });
                        return;
                    }
                    const folderId = current.folderId || folderIdParam;
                    if (!folderId) {
                        toast.error('folderId가 없어 SRS 채점을 진행할 수 없습니다. 폴더에서 퀴즈를 시작하세요.');
                        return;
                    }
                    const { data } = await fetchJSON('/quiz/answer', withCreds({
                        method: 'POST', body: JSON.stringify({ folderId, cardId: current.cardId, correct: false })
                    }));
                    
                    setFeedback({ status: data?.status ?? 'fail', answer: correctAnswer });
                    
                    // 오답인 경우 wrongAnswerCards에 추가
                    setWrongAnswerCards(prev => {
                        const cardExists = prev.some(card => card.cardId === current.cardId || card.vocabId === current.vocabId);
                        if (!cardExists) {
                            return [...prev, current];
                        }
                        return prev;
                    });
                } catch (e) {
                    console.error('답변 제출 실패:', e);
                    toast.error(`답변 제출 실패: ${e.message || 'Internal Server Error'}`);
                } finally {
                    setSubmitting(false);
                }
            } else {
                // 아직 기회가 남은 경우
                if (newAttemptCount === 2) {
                    // 2번째 오답이면 노란색 경고 표시
                    setShowSpellingWarning(true);
                }
                setSubmitting(false);
                // 입력 필드 클리어하여 다시 입력 가능하게 함
                setSpellingInput('');
            }
        }
    };

    // ───────────────────── 기존(SRS/odat/ids) 핸들러 ─────────────────────
    const submit = async () => {
        // 스펠링 입력 모드인지 확인
        const isSpellingMode = quizTypeParam === 'spelling' || (quizTypeParam === 'mixed' && isSpellingMixedType());
        
        if (isSpellingMode) {
            // 스펠링 입력 모드 처리
            return await handleSpellingSubmit();
        }
        
        // 기존 선택형 퀴즈 모드 처리
        if (!current || !userAnswer) return;
        setSubmitting(true);
        stopAudio();
        
        // 퀴즈 유형에 따라 정답 비교 로직 분기
        let isCorrect = false;
        if (quizTypeParam === 'context' || (quizTypeParam === 'mixed' && (() => {
            // 혼합형에서 context 타입 확인
            if (quizTypeParam === 'mixed') {
                const cardId = current.cardId || current.vocabId || 0;
                const remainder = cardId % 3;
                return remainder === 1; // context는 1일 때
            }
            return false;
        })())) {
            // 한국어 뜻 매칭: 영단어끼리 비교
            const correctAnswer = current.question || current.vocab?.lemma || '';
            isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();
            console.log('[SUBMIT DEBUG] Context quiz (Korean meaning matching) - userAnswer:', userAnswer, 'correctAnswer:', correctAnswer, 'isCorrect:', isCorrect);
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
            
            // 오답인 경우 wrongAnswerCards에 추가
            if (!isCorrect) {
                setWrongAnswerCards(prev => {
                    const cardExists = prev.some(card => card.cardId === current.cardId || card.vocabId === current.vocabId);
                    if (!cardExists) {
                        return [...prev, current];
                    }
                    return prev;
                });
            }
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
            // 스펠링 입력 상태 초기화
            setSpellingInput('');
            setAttemptCount(0);
            setShowSpellingWarning(false);
        } else {
            setIdx(queue.length);
        }
    };

    const handleRestart = () => {
        setIdx(0);
        setAnswer(null);
        setFeedback(null);
        // 스펠링 입력 상태 초기화
        setSpellingInput('');
        setAttemptCount(0);
        setShowSpellingWarning(false);
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
                                    <div className="me-3" style={{ fontSize: '2rem' }}>📖</div>
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
                                    <div className="me-3" style={{ fontSize: '2rem' }}>🔤</div>
                                    <div>
                                        <h6 className="mb-1">4지선다 (한국어 뜻 매칭)</h6>
                                        <small className="text-muted">한국어 뜻을 보고 알맞은 영어 단어를 선택합니다</small>
                                    </div>
                                </div>
                            </button>
                            
                            <button 
                                className="btn btn-outline-info btn-lg text-start p-3"
                                onClick={() => handleQuizTypeSelect('spelling')}
                            >
                                <div className="d-flex align-items-center">
                                    <div className="me-3" style={{ fontSize: '2rem' }}>✏️</div>
                                    <div>
                                        <h6 className="mb-1">스펠링 입력 (예문 직접 타이핑)</h6>
                                        <small className="text-muted">예문의 빈칸에 영어 단어를 직접 입력합니다 (3번 기회)</small>
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
                                        <small className="text-muted">영단어→한국어, 한국어→영단어, 스펠링 입력이 랜덤하게 출제됩니다</small>
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

    // 학습 완료 상태 체크 (모든 모드에서 공통)
    if (modeForBatch === 'finished') {
        return (
            <main className="container py-4" style={{ maxWidth: 720 }}>
                <audio ref={audioRef} style={{ display: 'none' }} />
                <div className="p-4 bg-light rounded text-center">
                    <h4 className="mb-2">🎉 모든 학습 완료!</h4>
                    <p className="text-muted">오답률이 높은 단어들은 내일 복습 폴더에 자동으로 추가됩니다.</p>
                    <div className="d-flex justify-content-center gap-3 mt-4">
                        <button className="btn btn-outline-secondary" onClick={() => window.location.reload()}>다시 학습하기</button>
                        
                        {/* SRS 폴더에서 온 학습인 경우 폴더로 돌아가기 버튼 추가 */}
                        {folderIdParam ? (
                            <Link className="btn btn-primary" to={`/srs/folder/${folderIdParam}`}>
                                폴더로 돌아가기
                            </Link>
                        ) : (
                            <button className="btn btn-primary" onClick={() => navigate('/srs')}>SRS 학습하기</button>
                        )}
                        
                        <Link className="btn btn-outline-secondary" to="/">홈으로</Link>
                    </div>
                </div>
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
                            
                            {/* 오답문제 다시 학습 버튼 */}
                            {wrongAnswerCards.length > 0 && (
                                <button className="btn btn-warning" onClick={() => {
                                    // 오답 카드들로 새로운 학습 세션 시작
                                    setQueue(wrongAnswerCards);
                                    setWrongAnswerCards([]); // 초기화
                                    setIdx(0);
                                    setAnswer(null);
                                    setFeedback(null);
                                    setSpellingInput('');
                                    setAttemptCount(0);
                                    setShowSpellingWarning(false);
                                }}>
                                    오답문제 다시 학습 ({wrongAnswerCards.length}개)
                                </button>
                            )}

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

                            {(!mode || mode === 'srs' || mode === 'srs_folder') && (
                                <>
                                    
                                    {/* SRS 폴더에서 온 학습인 경우 폴더로 돌아가기 버튼 추가 */}
                                    {(folderIdParam || queue[0]?.folderId) ? (
                                        <Link className="btn btn-primary" to={`/srs/folder/${folderIdParam || queue[0]?.folderId}`}>
                                            폴더로 돌아가기
                                        </Link>
                                    ) : (
                                        <>
                                            <Link className="btn btn-outline-secondary" to="/learn/srs-manager">문제 편집</Link>
                                            <Link className="btn btn-primary" to="/odat-note">오답 문제 풀이</Link>
                                            <Link className="btn btn-outline-primary" to="/srs">SRS 대시보드</Link>
                                        </>
                                    )}
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
                        onClick={() => {
                            if (auto) {
                                // 자동재생 멈춤 - 오디오 정지하고 이벤트 리스너 정리
                                stopAudio();
                                console.log('[AUTO TOGGLE] Stopping auto mode');
                            } else {
                                // 자동재생 시작 - 현재 카드에서 이어서 진행
                                console.log('[AUTO TOGGLE] Starting auto mode, current count:', audioPlayCountRef.current);
                                
                                // 수동 재생 플래그 설정
                                isManualPlayRef.current = true;
                                
                                const el = audioRef.current;
                                if (el && current) {
                                    // 재생횟수가 0인 상태는 유지 (첫 재생 시 증가됨)
                                    
                                    // lastCardId를 현재 카드 ID로 설정하여 새 카드 감지 방지
                                    const currentCardId = current?.vocabId || current?.cardId;
                                    if (currentCardId) {
                                        setLastCardId(currentCardId);
                                    }
                                    
                                    // 오디오 재생 재개를 위한 이벤트 리스너 설정
                                    const localAudioPath = `/${current.levelCEFR || 'A1'}/audio/${safeFileName(current.question)}.mp3`;
                                    
                                    // 기존 이벤트 리스너 제거
                                    el.removeEventListener('play', el._currentPlayHandler);
                                    el.removeEventListener('ended', el._currentEndHandler);
                                    
                                    const handleResumeStart = () => {
                                        // 수동 재생이 아닌 경우에만 카운트 증가
                                        if (!isManualPlayRef.current) {
                                            audioPlayCountRef.current = audioPlayCountRef.current + 1;
                                            setAudioPlayCount(audioPlayCountRef.current);
                                            console.log('[AUTO RESUME] Play started, count increased to:', audioPlayCountRef.current);
                                        } else {
                                            console.log('[AUTO RESUME] Manual play detected, count not increased');
                                            isManualPlayRef.current = false; // 플래그 리셋
                                        }
                                    };
                                    
                                    const handleResumeEnd = () => {
                                        console.log('[AUTO RESUME] Audio ended, count:', audioPlayCountRef.current, 'max:', maxPlayCountRef.current);
                                        
                                        // 동적으로 현재 인덱스와 배치 정보 가져오기
                                        setIdx(currentIdx => {
                                            const currentBatch = allBatches[batchIndex] || [];
                                            const queueLength = queue?.length || 0;
                                            
                                            // batch 모드인지 queue 모드인지 확인하여 올바른 길이 사용
                                            let isLastCard, totalLength;
                                            if (mode === 'batch' && currentBatch.length > 0) {
                                                isLastCard = currentIdx >= currentBatch.length - 1;
                                                totalLength = currentBatch.length;
                                            } else {
                                                isLastCard = currentIdx >= queueLength - 1;
                                                totalLength = queueLength;
                                            }
                                            
                                            if (audioPlayCountRef.current >= maxPlayCountRef.current) {
                                                // 최대 재생횟수 도달
                                                el.removeEventListener('play', handleResumeStart);
                                                el.removeEventListener('ended', handleResumeEnd);
                                                stopAudio();
                                                
                                                if (isLastCard) {
                                                    // 마지막 카드이면 완료 처리
                                                    console.log('[AUTO RESUME] LAST CARD - Force completing after max plays');
                                                    handleQuizDone();
                                                    return currentIdx; // 인덱스 변경 없음
                                                } else {
                                                    // 다음 카드로 이동 (범위 체크 추가)
                                                    const nextIdx = currentIdx + 1;
                                                    console.log('[AUTO RESUME] Advancing to next card, nextIdx:', nextIdx, 'totalLength:', totalLength);
                                                    setFlipped(false);
                                                    
                                                    // 범위를 벗어나지 않도록 체크
                                                    if (nextIdx < totalLength) {
                                                        return nextIdx;
                                                    } else {
                                                        // 범위 초과 시 학습 완료 처리
                                                        console.log('[AUTO RESUME] Index overflow - triggering completion');
                                                        handleQuizDone();
                                                        return currentIdx; // 인덱스 변경 없음
                                                    }
                                                }
                                            } else {
                                                // 다시 재생 (count는 'play' 이벤트에서 증가됨)
                                                setTimeout(() => {
                                                    if (el && el.src) {
                                                        el.currentTime = 0;
                                                        el.play().catch(console.error);
                                                    }
                                                }, 1000);
                                                return currentIdx; // 인덱스 변경 없음
                                            }
                                        });
                                    };
                                    
                                    // 새 이벤트 리스너 등록
                                    el._currentPlayHandler = handleResumeStart;
                                    el._currentEndHandler = handleResumeEnd;
                                    el.addEventListener('play', handleResumeStart);
                                    el.addEventListener('ended', handleResumeEnd);
                                    
                                    // 오디오 재생 시작
                                    el.src = localAudioPath.startsWith('/') ? `${API_BASE}${localAudioPath}` : localAudioPath;
                                    el.load();
                                    el.play().catch(console.error);
                                }
                            }
                            setAuto((a) => !a);
                        }}
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
                    {/* 퀴즈 유형 결정 및 렌더링 */}
                    {(() => {
                        // 스펠링 입력 모드 확인
                        const isSpellingMode = quizTypeParam === 'spelling' || (quizTypeParam === 'mixed' && isSpellingMixedType());
                        
                        if (isSpellingMode) {
                            return 'spelling';
                        }
                        
                        // 혼합형인 경우 클라이언트에서 랜덤하게 유형 결정  
                        if (quizTypeParam === 'mixed') {
                            // 카드 ID를 시드로 사용하여 일관된 랜덤 결정 (나머지 2/3은 50:50 비율)
                            const cardId = current.cardId || current.vocabId || 0;
                            const remainder = cardId % 3;
                            if (remainder === 0) return 'spelling'; // 이미 위에서 처리됨
                            return remainder === 1 ? 'context' : 'meaning'; // 1이면 예문, 2면 뜻 맞추기
                        }
                        
                        return quizTypeParam === 'context' || current.contextQuestion ? 'context' : 'meaning';
                    })() === 'spelling' ? (
                        <>
                            {/* 스펠링 입력 유형 */}
                            <div className={`mb-4 ${showSpellingWarning ? 'p-3 rounded' : ''}`} 
                                 style={showSpellingWarning ? { backgroundColor: '#fff3cd', border: '1px solid #ffeaa7' } : {}}>
                                <h4 className="text-primary mb-3">다음 빈칸에 들어갈 영어 단어를 입력하세요</h4>
                                
                                {showSpellingWarning && (
                                    <div className="alert alert-warning mb-3">
                                        <strong>⚠️ 다시 생각해보세요!</strong>
                                        <div className="small mt-1">남은 기회: {maxAttempts - attemptCount}번</div>
                                    </div>
                                )}
                                
                                {(() => {
                                    // 예문 데이터 찾기 (기존 로직 재사용)
                                    let exampleSentence = '';
                                    let exampleTranslation = '';
                                    
                                    console.log('[SPELLING DEBUG] Current data:', current);
                                    
                                    // 단어 변형을 고려한 빈칸 대체 함수
                                    const replaceWithBlank = (sentence, targetWord) => {
                                        let result = sentence;
                                        
                                        // 1. 정확한 매칭 시도
                                        result = result.replace(new RegExp(`\\b${targetWord}\\b`, 'gi'), '____');
                                        
                                        // 2. 매칭이 안 된 경우, 다양한 변형 고려
                                        if (result === sentence) {
                                            const lowerTarget = targetWord.toLowerCase();
                                            
                                            // 불규칙 변화 우선 처리
                                            const irregularForms = {
                                                'call': ['calls', 'called', 'calling'],
                                                'receive': ['receives', 'received', 'receiving'],
                                                'go': ['goes', 'went', 'going', 'gone'],
                                                'get': ['gets', 'got', 'getting', 'gotten'],
                                                'make': ['makes', 'made', 'making'],
                                                'take': ['takes', 'took', 'taking', 'taken']
                                            };
                                            
                                            if (irregularForms[lowerTarget]) {
                                                for (const form of irregularForms[lowerTarget]) {
                                                    result = result.replace(new RegExp(`\\b${form}\\b`, 'gi'), '____');
                                                    if (result !== sentence) break;
                                                }
                                            }
                                            
                                            // 여전히 매칭 안 된 경우, 규칙 변화 시도
                                            if (result === sentence) {
                                                // 복수형 (s, es)
                                                result = result.replace(new RegExp(`\\b${targetWord}s\\b`, 'gi'), '____');
                                                if (result === sentence) {
                                                    result = result.replace(new RegExp(`\\b${targetWord}es\\b`, 'gi'), '____');
                                                }
                                                
                                                // 과거형 (ed)
                                                if (result === sentence) {
                                                    result = result.replace(new RegExp(`\\b${targetWord}ed\\b`, 'gi'), '____');
                                                }
                                                
                                                // ing형
                                                if (result === sentence) {
                                                    result = result.replace(new RegExp(`\\b${targetWord}ing\\b`, 'gi'), '____');
                                                }
                                            }
                                        }
                                        
                                        return result;
                                    };
                                    
                                    // 1. current.contextSentence가 있는 경우 (서버에서 직접 제공)
                                    if (current.contextSentence) {
                                        exampleSentence = current.contextSentence;
                                        exampleTranslation = current.contextTranslation || '';
                                    }
                                    // 2. vocab.dictentry.examples에서 찾기
                                    else if (current.vocab?.dictentry?.examples) {
                                        const examples = current.vocab.dictentry.examples;
                                        
                                        let parsedExamples = examples;
                                        if (typeof examples === 'string') {
                                            try {
                                                parsedExamples = JSON.parse(examples);
                                            } catch (e) {
                                                console.warn('[SPELLING DEBUG] Failed to parse examples:', e);
                                            }
                                        }
                                        
                                        for (const exampleBlock of parsedExamples) {
                                            if (exampleBlock.definitions) {
                                                for (const def of exampleBlock.definitions) {
                                                    if (def.examples && def.examples.length > 0) {
                                                        const firstExample = def.examples[0];
                                                        if ((firstExample.en || firstExample.de) && firstExample.ko) {
                                                            const lemma = current.question || current.vocab.lemma;
                                                            const englishSentence = firstExample.en || firstExample.de;
                                                            console.log('[SPELLING DEBUG] Replacing:', { lemma, englishSentence });
                                                            exampleSentence = replaceWithBlank(englishSentence, lemma);
                                                            console.log('[SPELLING DEBUG] Result:', exampleSentence);
                                                            exampleTranslation = firstExample.ko;
                                                            break;
                                                        }
                                                    }
                                                }
                                                if (exampleSentence) break;
                                            }
                                            else if (exampleBlock.examples && exampleBlock.examples.length > 0) {
                                                const firstExample = exampleBlock.examples[0];
                                                if ((firstExample.en || firstExample.de) && firstExample.ko) {
                                                    const lemma = current.question || current.vocab.lemma;
                                                    const englishSentence = firstExample.en || firstExample.de;
                                                    exampleSentence = replaceWithBlank(englishSentence, lemma);
                                                    exampleTranslation = firstExample.ko;
                                                    break;
                                                }
                                            }
                                            else if ((exampleBlock.en || exampleBlock.de) && exampleBlock.ko) {
                                                const lemma = current.question || current.vocab.lemma;
                                                const englishSentence = exampleBlock.en || exampleBlock.de;
                                                exampleSentence = replaceWithBlank(englishSentence, lemma);
                                                exampleTranslation = exampleBlock.ko;
                                                break;
                                            }
                                        }
                                    }
                                    // 3. fallback 예문 생성
                                    else {
                                        const lemma = current.question || current.vocab?.lemma || 'word';
                                        exampleSentence = `This is an example sentence with ____.`;
                                        exampleTranslation = `이것은 ${lemma}가 포함된 예문입니다.`;
                                    }
                                    
                                    return exampleSentence ? (
                                        <div className="mb-3">
                                            <p className="fs-5 mb-2" lang="en">
                                                {exampleSentence.split('____').map((part, index, array) => (
                                                    <span key={index}>
                                                        {part}
                                                        {index < array.length - 1 && (
                                                            <span className="d-inline-block position-relative">
                                                                <input
                                                                    type="text"
                                                                    className="form-control d-inline-block text-center fw-bold"
                                                                    style={{
                                                                        width: '120px',
                                                                        display: 'inline-block',
                                                                        margin: '0 4px',
                                                                        borderColor: showSpellingWarning ? '#ffc107' : '#dee2e6'
                                                                    }}
                                                                    value={spellingInput}
                                                                    onChange={(e) => setSpellingInput(e.target.value)}
                                                                    onKeyPress={(e) => {
                                                                        if (e.key === 'Enter' && spellingInput.trim()) {
                                                                            submit();
                                                                        }
                                                                    }}
                                                                    placeholder="단어 입력"
                                                                    disabled={feedback || isSubmitting}
                                                                    autoFocus={index === 0}
                                                                />
                                                            </span>
                                                        )}
                                                    </span>
                                                ))}
                                            </p>
                                            {exampleTranslation && (
                                                <p className="text-muted">
                                                    {(() => {
                                                        const lemma = current.question || current.vocab?.lemma || '';
                                                        let koreanMeaning = '';
                                                        if (current.answer && current.answer.includes('.')) {
                                                            const meaningPart = current.answer.split('.')[1];
                                                            koreanMeaning = meaningPart.split(',')[0].trim();
                                                        }
                                                        
                                                        if (koreanMeaning && exampleTranslation.includes(koreanMeaning)) {
                                                            return exampleTranslation.split(koreanMeaning).map((part, index, array) => (
                                                                <span key={index}>
                                                                    {part}
                                                                    {index < array.length - 1 && <strong className="text-danger">{koreanMeaning}</strong>}
                                                                </span>
                                                            ));
                                                        }
                                                        
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
                                <div className="mt-3">
                                    <div className="d-flex justify-content-center align-items-center gap-3 mb-3">
                                        <span className="text-muted small">
                                            시도 {attemptCount + 1}/{maxAttempts} 
                                            {attemptCount > 0 && ` (${maxAttempts - attemptCount}번 기회 남음)`}
                                        </span>
                                    </div>
                                    <button 
                                        className="btn btn-success btn-lg"
                                        disabled={!spellingInput.trim() || isSubmitting}
                                        onClick={submit}
                                    >
                                        {isSubmitting ? '처리 중…' : '제출하기'}
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (() => {
                        const quizType = (() => {
                            if (quizTypeParam === 'mixed') {
                                const cardId = current.cardId || current.vocabId || 0;
                                const remainder = cardId % 3;
                                return remainder === 1 ? 'context' : 'meaning';
                            }
                            return quizTypeParam === 'context' || current.contextQuestion ? 'context' : 'meaning';
                        })();
                        
                        return quizType === 'context';
                    })() ? (
                        <>
                            {/* 한국어 뜻 매칭 문제 */}
                            <div className="mb-4">
                                <h4 className="text-primary mb-3">다음 한국어 뜻에 해당하는 영어 단어를 선택하세요</h4>
                                {(() => {
                                    // 한국어 뜻 추출하기
                                    let koreanMeaning = '';
                                    
                                    console.log('[CONTEXT DEBUG] Current data:', current);
                                    
                                    // 1. current.answer 그대로 사용 (예: "n.가방, 봉지" 전체)
                                    if (current.answer) {
                                        koreanMeaning = current.answer.trim();
                                        console.log('[CONTEXT DEBUG] Found meaning from current.answer:', koreanMeaning);
                                    }
                                    // 2. vocab.ko_gloss에서 추출
                                    else if (current.vocab?.ko_gloss) {
                                        koreanMeaning = current.vocab.ko_gloss;
                                        console.log('[CONTEXT DEBUG] Found meaning from ko_gloss:', koreanMeaning);
                                    }
                                    // 3. fallback
                                    else {
                                        koreanMeaning = '한국어 뜻 정보 없음';
                                    }
                                    
                                    return koreanMeaning ? (
                                        <div className="mb-4">
                                            <div className="p-4 bg-light rounded">
                                                <h2 className="display-6 text-center text-primary mb-0">
                                                    {koreanMeaning}
                                                </h2>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="alert alert-warning">
                                            이 단어의 한국어 뜻을 찾을 수 없습니다.
                                        </div>
                                    );
                                })()}
                            </div>
                            
                            {!feedback && (
                                <div className="d-grid gap-2 col-8 mx-auto mt-3">
                                    {/* 한국어 뜻 매칭에서는 영단어 옵션 사용 */}
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
                                        
                                        // 2. current.options가 있는 경우 (기존 로직과 호환)
                                        if (current.options && current.options.length > 0) {
                                            // 기존 options는 한국어 뜻이므로, 영단어로 변환 필요
                                            // 여기서는 정답 영단어와 오답 영단어들을 생성
                                            const correctAnswer = current.question || current.vocab?.lemma || 'unknown';
                                            
                                            // 기본 오답 영단어 풀
                                            const commonWords = [
                                                'apple', 'book', 'chair', 'door', 'egg', 'face', 'good', 'hand', 
                                                'ice', 'job', 'key', 'love', 'make', 'name', 'open', 'page',
                                                'quick', 'read', 'send', 'time', 'use', 'very', 'work', 'year'
                                            ];
                                            
                                            // 정답이 아닌 단어들 중에서 3개 선택
                                            const wrongOptions = commonWords
                                                .filter(word => word.toLowerCase() !== correctAnswer.toLowerCase())
                                                .slice(0, 3);
                                            
                                            const allOptions = [correctAnswer, ...wrongOptions];
                                            
                                            // 카드 ID를 시드로 사용하여 일관된 순서 생성
                                            const cardId = current.cardId || current.vocabId || 0;
                                            const shuffledOptions = [...allOptions].sort((a, b) => {
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
                                        }
                                        
                                        // 3. fallback: 기본 영단어 옵션 생성
                                        const correctAnswer = current.question || current.vocab?.lemma || 'unknown';
                                        const basicWrongOptions = ['example', 'sample', 'test'];
                                        const allOptions = [correctAnswer, ...basicWrongOptions];
                                        
                                        const cardId = current.cardId || current.vocabId || 0;
                                        const shuffledOptions = [...allOptions].sort((a, b) => {
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
