// src/pages/SrsQuiz.jsx - 언어별 SRS 퀴즈 지원
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { fetchJSON, withCreds, isAbortError } from '../api/client';
import Pron from '../components/Pron';
// JapaneseQuiz import 제거 - SRS에서는 통합 UI 사용
import { toast } from 'react-toastify';

export default function SrsQuiz() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const folderId = Number(params.get('folder'));
    const allOverdue = params.get('all') === 'true';
    const selectedItems = params.get('selectedItems');

    const [loading, setLoading] = useState(true);
    const [queue, setQueue] = useState([]);
    const [idx, setIdx] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState(null);
    const [streakInfo, setStreakInfo] = useState(null);
    const [quizLanguage, setQuizLanguage] = useState('en'); // 퀴즈 언어 상태

    // 폴더 ID가 변경될 때마다 퀴즈 큐를 가져옵니다.
    useEffect(() => {
        const ac = new AbortController();
        
        // allOverdue가 true이거나 유효한 folderId가 있어야 함
        if (!allOverdue && (!folderId || isNaN(folderId))) {
            setErr(new Error('폴더가 지정되지 않았습니다.'));
            setLoading(false);
            return;
        }

        (async () => {
            try {
                setLoading(true);
                setErr(null);
                
                // 퀴즈 큐와 연속학습일 정보를 병렬로 가져오기
                let queueUrl;
                if (allOverdue) {
                    queueUrl = '/srs/queue?all=true';
                    if (selectedItems) {
                        queueUrl += `&selectedItems=${selectedItems}`;
                    }
                } else {
                    queueUrl = `/srs/queue?folderId=${folderId}`;
                    if (selectedItems) {
                        queueUrl += `&selectedItems=${selectedItems}`;
                    }
                }
                
                const [queueRes, streakRes] = await Promise.all([
                    fetchJSON(queueUrl, withCreds({ signal: ac.signal })),
                    fetchJSON('/srs/streak', withCreds({ signal: ac.signal }))
                ]);
                
                if (!ac.signal.aborted) {
                    const queueData = Array.isArray(queueRes.data) ? queueRes.data : [];
                    setQueue(queueData);
                    setIdx(0);
                    setStreakInfo(streakRes.data);

                    console.log('[SrsQuiz] Queue loaded:', {
                        queueLength: queueData.length,
                        firstItem: queueData[0],
                        hasVocab: queueData[0]?.vocab ? 'yes' : 'no',
                        vocabCategories: queueData[0]?.vocab?.categories,
                        vocabKana: queueData[0]?.vocab?.kana,
                        vocabRomaji: queueData[0]?.vocab?.romaji
                    });

                    // 큐 전체에서 언어 감지 (일본어가 하나라도 있으면 일본어 퀴즈)
                    if (queueData.length > 0) {
                        let detectedLanguage = 'en';

                        // 큐의 모든 아이템을 확인해서 일본어 단어가 있는지 검사
                        for (const item of queueData) {
                            if (item.vocab) {
                                const itemLanguage = detectLanguageFromVocab(item.vocab);
                                if (itemLanguage === 'ja') {
                                    detectedLanguage = 'ja';
                                    break;
                                }
                            }
                        }

                        setQuizLanguage(detectedLanguage);
                        console.log('[SrsQuiz] Detected language:', detectedLanguage, 'from', queueData.length, 'items');

                        // 일본어 감지됨 (SRS에서는 영어와 동일한 UI 사용)
                    }
                }
            } catch (e) {
                if (!isAbortError(e)) {
                    setErr(e);
                    toast.error(`퀴즈를 불러오는 데 실패했습니다: ${e.message}`);
                }
            } finally {
                if (!ac.signal.aborted) setLoading(false);
            }
        })();

        return () => ac.abort();
    }, [folderId, allOverdue, selectedItems]);

    const current = queue[idx];

    // 언어 감지 함수
    const detectLanguageFromVocab = (vocab) => {
        if (!vocab) return 'en';

        // JLPT 레벨이 있으면 일본어
        if (vocab.levelJLPT) {
            return 'ja';
        }

        // source가 jlpt_vocabs이면 일본어
        if (vocab.source === 'jlpt_vocabs') {
            return 'ja';
        }

        // lemma에 일본어 문자(히라가나, 카타카나, 한자)가 있으면 일본어
        if (vocab.lemma) {
            const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
            if (japaneseRegex.test(vocab.lemma)) {
                return 'ja';
            }
        }

        // dictentry의 examples에 일본어 데이터가 있으면 일본어
        if (vocab.dictentry && vocab.dictentry.examples) {
            const examples = Array.isArray(vocab.dictentry.examples) ? vocab.dictentry.examples : [];
            const hasJapanese = examples.some(ex => ex.ja || ex.source === 'jlpt_vocabs');
            if (hasJapanese) {
                return 'ja';
            }
        }

        return 'en';
    };

    // 일본어 퀴즈 관련 코드 제거 - SRS에서는 통합 UI 사용

    // 진행률 계산
    const progress = useMemo(() => {
        if (queue.length === 0) return { total: 0, learned: 0, remaining: 0 };
        const learnedCount = queue.filter(q => q.learned).length;
        const total = queue.length;
        return { total, learned: learnedCount, remaining: total - learnedCount };
    }, [queue]);

    // 정답/오답 제출 함수
    async function submit(correct) {
        if (!current || submitting) return;

        try {
            setSubmitting(true);
            // 백엔드에 답안 제출
            const answerResponse = await fetchJSON('/quiz/answer', withCreds({
                method: 'POST',
                body: JSON.stringify({ folderId, cardId: current.cardId, correct })
            }));
            
            const response = answerResponse;
            
            // canUpdateCardState가 true일 때만 연속학습일 정보 갱신
            if (response?.data?.canUpdateCardState) {
                try {
                    const streakResponse = await fetchJSON('/srs/streak', withCreds());
                    if (streakResponse?.data) {
                        setStreakInfo(streakResponse.data);
                        console.log('[SRS QUIZ] Updated streak info after valid SRS learning');
                    }
                } catch (err) {
                    console.warn('[SRS QUIZ] Failed to update streak info:', err);
                }
            } else {
                console.log('[SRS QUIZ] Skipping streak update - canUpdateCardState=false (자율학습 상태)');
            }

            // 서버 응답에서 카드 정보 가져오기
            const { 
                stage, 
                nextReviewAt, 
                waitingUntil,
                isOverdue,
                overdueDeadline,
                frozenUntil,
                isFromWrongAnswer,
                // 동결 상태 정보 추가
                isFrozen,
                canUpdateCardState, 
                calculatedStage,
                calculatedNextReviewAt,
                calculatedWaitingUntil,
                message,
                isMasteryAchieved 
            } = response.data || {};

            // 동결 상태 처리 (최우선)
            if (isFrozen) {
                toast.error('🧊 카드가 동결 상태입니다. 학습이 불가능합니다.', {
                    duration: 3000
                });
                return;
            }

            // 마스터 달성 축하 메시지 표시
            if (isMasteryAchieved) {
                toast.success('🎉🌟 마스터 완료! 축하합니다! 🌟🎉', {
                    duration: 5000, // 5초간 표시
                    style: {
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '16px'
                    }
                });
            }
            
            // 사용자에게 SRS 상태 메시지 표시 (필요시)
            if (message && !canUpdateCardState) {
                // 상태가 변경되지 않았음을 알리는 토스트는 표시하지 않음 (자율학습 방해 방지)
                console.log('SRS Status:', message);
            }

            // 로컬 상태를 업데이트하여 UI에 반영
            const updatedQueue = queue.map((item, index) => {
                if (index === idx) {
                    return {
                        ...item,
                        // learned 상태: SRS 상태 변경 가능할 때만 업데이트, 아니면 기존 상태 유지
                        learned: canUpdateCardState ? correct : item.learned,
                        // wrongCount: SRS 상태 변경 가능할 때만 증가
                        wrongCount: (correct || !canUpdateCardState) ? item.wrongCount : (item.wrongCount || 0) + 1,
                        // SRS 정보: 실제 변경된 값 또는 계산된 값 사용 (UI 표시용)
                        stage: stage !== undefined ? stage : item.stage,
                        nextReviewAt: nextReviewAt || item.nextReviewAt,
                        waitingUntil: waitingUntil || item.waitingUntil,
                        isOverdue: isOverdue !== undefined ? isOverdue : item.isOverdue,
                        overdueDeadline: overdueDeadline || item.overdueDeadline,
                        frozenUntil: frozenUntil || item.frozenUntil,
                        isFromWrongAnswer: isFromWrongAnswer !== undefined ? isFromWrongAnswer : item.isFromWrongAnswer,
                        // 동결 상태 정보 추가
                        isFrozen: isFrozen !== undefined ? isFrozen : item.isFrozen,
                        frozenUntil: frozenUntil || item.frozenUntil,
                        // 계산된 정보를 별도 필드로 저장 (참고용)
                        _calculatedStage: calculatedStage,
                        _calculatedNextReviewAt: calculatedNextReviewAt,
                        _calculatedWaitingUntil: calculatedWaitingUntil,
                        _canUpdateCardState: canUpdateCardState
                    };
                }
                return item;
            });

            setQueue(updatedQueue);

            // 오답인 경우 오답노트에 기록 (일본어는 JapaneseQuiz에서 처리하므로 제외)
            const currentLanguage = detectLanguageFromVocab(current.vocab);
            const isJapanese = currentLanguage === 'ja';

            console.log(`[SRS 퀴즈 오답노트 DEBUG] vocab data:`, current.vocab);
            console.log(`[SRS 퀴즈 오답노트 DEBUG] correct: ${correct}, canUpdateCardState: ${canUpdateCardState}, folderId: ${folderId}, cardId: ${current.cardId}, vocabId: ${current.vocabId}, language: ${currentLanguage}, isJapanese: ${isJapanese}`);
            console.log(`[SRS 퀴즈 오답노트 DEBUG] vocab.levelJLPT:`, current.vocab?.levelJLPT);
            console.log(`[SRS 퀴즈 오답노트 DEBUG] vocab.source:`, current.vocab?.source);
            console.log(`[SRS 퀴즈 오답노트 DEBUG] vocab.lemma:`, current.vocab?.lemma);

            if (!correct && canUpdateCardState) {
                if (isJapanese) {
                    console.log(`[SRS 퀴즈 오답노트 DEBUG] 일본어 단어이므로 오답노트 기록 건너뜀`);
                    return; // 일본어는 JapaneseQuiz에서 처리
                }
                try {
                    const odatPayload = {
                        itemType: 'vocab',
                        itemId: current.vocabId || current.cardId,
                        wrongData: {
                            question: current.question || '알 수 없는 단어',
                            answer: current.answer || '정답',
                            userAnswer: 'incorrect', // SRS에서는 단순히 오답 표시
                            quizType: 'srs-meaning',
                            folderId: folderId,
                            vocabId: current.vocabId || current.cardId,
                            ko_gloss: current.answer || '뜻 정보 없음',
                            context: current.contextSentence || null,
                            pron: current.pron || null,
                            language: 'en' // 영어 퀴즈
                        }
                    };
                    console.log(`[SRS 퀴즈 오답노트 DEBUG] 전송할 데이터 (영어):`, odatPayload);
                    
                    const response = await fetchJSON('/api/odat-note/create', withCreds({
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(odatPayload)
                    }));
                    console.log(`✅ [SRS 퀴즈 오답 기록 완료] 응답:`, response);
                } catch (error) {
                    if (error.message.includes('Unauthorized')) {
                        console.log('📝 [비로그인 사용자] 오답노트는 로그인 후 이용 가능합니다.');
                    } else {
                        console.error('❌ SRS 퀴즈 오답 기록 실패:', error);
                        console.warn('⚠️ 오답노트 저장에 실패했습니다. 네트워크 연결을 확인해주세요.');
                    }
                }
            } else {
                console.log(`[SRS 퀴즈 오답노트 DEBUG] 조건 미충족 - 기록하지 않음`);
            }

            // 다음 문제 찾기
            const nextIndex = updatedQueue.findIndex((q, i) => i > idx && !q.learned);
            const fallbackIndex = updatedQueue.findIndex(q => !q.learned);

            if (nextIndex !== -1) {
                setIdx(nextIndex);
            } else if (fallbackIndex !== -1) {
                setIdx(fallbackIndex);
            } else {
                // 모든 문제를 다 풀었을 경우
                toast.success('🎉 모든 카드를 학습했습니다!');
                // 폴더 상세 페이지로 돌아가기 (자율학습이므로 새로고침 불필요)
                navigate(`/srs/folders/${folderId}`);
            }

        } catch (e) {
            toast.error('정답 제출에 실패했습니다. 다시 시도해주세요.');
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return <main className="container py-5 text-center"><div className="spinner-border" /></main>;
    }

    if (err) {
        return <main className="container py-4"><div className="alert alert-danger">퀴즈 로드 실패: {err.message}</div></main>;
    }

    // 풀 문제가 없는 경우
    if (!current && progress.remaining === 0) {
        return (
            <main className="container py-5 text-center">
                <div className="p-5 bg-light rounded">
                    <h4 className="mb-3">✨ 이 폴더의 모든 카드를 학습했습니다!</h4>
                    <p className="mb-4">새로운 단어를 추가하거나 다른 폴더를 복습해보세요.</p>
                    <div className="d-flex justify-content-center gap-2">
                        <Link className="btn btn-primary" to={`/vocab?addToFolder=${folderId}`}>+ 단어 추가</Link>
                        <Link className="btn btn-outline-secondary" to="/srs">대시보드</Link>
                    </div>
                </div>
            </main>
        );
    }

    // 일본어 SRS 퀴즈는 JapaneseQuiz 컴포넌트에서 처리됨
    // 여기서는 영어 SRS 퀴즈만 처리

    // 기존 영어 퀴즈 렌더링
    return (
        <main className="container py-4" style={{ maxWidth: 720 }}>
            {/* 연속학습일 정보 (상단 배너) */}
            {streakInfo && (
                <div className="alert alert-light border mb-3" role="alert">
                    <div className="d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center">
                            <span className="me-2" style={{ fontSize: '20px' }}>
                                {streakInfo.status?.icon || '🔥'}
                            </span>
                            <div>
                                <strong className="me-2">연속 {streakInfo.streak}일째 학습 중</strong>
                                <span className="badge bg-primary me-2">
                                    {streakInfo.dailyQuizCount}/{streakInfo.requiredDaily}
                                </span>
                                {streakInfo.bonus?.current && (
                                    <span className="badge bg-warning text-dark">
                                        {streakInfo.bonus.current.emoji} {streakInfo.bonus.current.title}
                                    </span>
                                )}
                            </div>
                        </div>
                        <small className="text-muted">
                            {streakInfo.isCompletedToday ? '✅ 오늘 목표 달성!' :
                             `${streakInfo.remainingForStreak}개 더 필요`}
                        </small>
                    </div>
                    {/* 미니 진행바 */}
                    <div className="progress mt-2" style={{ height: '4px' }}>
                        <div
                            className={`progress-bar ${
                                streakInfo.isCompletedToday ? 'bg-success' : 'bg-primary'
                            }`}
                            style={{ width: `${streakInfo.progressPercent}%` }}
                        ></div>
                    </div>
                </div>
            )}

            <div className="d-flex justify-content-between align-items-center mb-2">
                <h4 className="m-0">
                    SRS 복습 퀴즈
                    {quizLanguage === 'en' && <span className="badge bg-success ms-2">영어</span>}
                    {quizLanguage === 'ja' && <span className="badge bg-info ms-2">일본어</span>}
                </h4>
                <span className="badge bg-dark fs-6">{progress.learned} / {progress.total}</span>
            </div>

            <div className="card shadow-sm">
                <div className="card-body text-center p-5">
                    {/* 언어에 따른 lang 속성 설정 */}
                    <h2 className="display-5 mb-2" lang={quizLanguage}>{current?.question ?? '—'}</h2>
                    <Pron
                        ipa={current?.pron?.ipa}
                        ipaKo={current?.pron?.ipaKo}
                        hiragana={current?.pron?.hiragana}
                        romaji={current?.pron?.romaji}
                    />
                    <div className="d-flex gap-2 justify-content-center mt-4">
                        <button className="btn btn-success btn-lg" disabled={submitting} onClick={() => submit(true)}>맞음</button>
                        <button className="btn btn-danger btn-lg" disabled={submitting} onClick={() => submit(false)}>틀림</button>
                    </div>
                </div>
            </div>
        </main>
    );
};
