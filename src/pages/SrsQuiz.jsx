// src/pages/SrsQuiz.jsx (lang='en'으로 수정)
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { fetchJSON, withCreds, isAbortError } from '../api/client';
import Pron from '../components/Pron';
import { toast } from 'react-toastify';

export default function SrsQuiz() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const folderId = Number(params.get('folder'));

    const [loading, setLoading] = useState(true);
    const [queue, setQueue] = useState([]);
    const [idx, setIdx] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState(null);

    // 폴더 ID가 변경될 때마다 퀴즈 큐를 가져옵니다.
    useEffect(() => {
        const ac = new AbortController();
        if (!folderId || isNaN(folderId)) {
            setErr(new Error('폴더가 지정되지 않았습니다.'));
            setLoading(false);
            return;
        }

        (async () => {
            try {
                setLoading(true);
                setErr(null);
                const { data } = await fetchJSON(`/srs/folders/${folderId}/queue`, withCreds({ signal: ac.signal }));
                if (!ac.signal.aborted) {
                    setQueue(Array.isArray(data) ? data : []);
                    setIdx(0);
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
    }, [folderId]);

    const current = queue[idx];

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
            const response = await fetchJSON('/quiz/answer', withCreds({
                method: 'POST',
                body: JSON.stringify({ folderId, cardId: current.cardId, correct })
            }));

            // 서버 응답에서 카드 정보 가져오기
            const { 
                stage, 
                nextReviewAt, 
                waitingUntil,
                isOverdue,
                overdueDeadline,
                isFromWrongAnswer,
                canUpdateCardState, 
                calculatedStage,
                calculatedNextReviewAt,
                calculatedWaitingUntil,
                message 
            } = response.data || {};

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
                        isFromWrongAnswer: isFromWrongAnswer !== undefined ? isFromWrongAnswer : item.isFromWrongAnswer,
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

    return (
        <main className="container py-4" style={{ maxWidth: 720 }}>
            <div className="d-flex justify-content-between align-items-center mb-2">
                <h4 className="m-0">SRS 복습 퀴즈</h4>
                <span className="badge bg-dark fs-6">{progress.learned} / {progress.total}</span>
            </div>

            <div className="card shadow-sm">
                <div className="card-body text-center p-5">
                    {/* ✅ [수정] lang 속성을 'en'으로 고정 */}
                    <h2 className="display-5 mb-2" lang="en">{current?.question ?? '—'}</h2>
                    <Pron ipa={current?.pron?.ipa} ipaKo={current?.pron?.ipaKo} />
                    <div className="d-flex gap-2 justify-content-center mt-4">
                        <button className="btn btn-success btn-lg" disabled={submitting} onClick={() => submit(true)}>맞음</button>
                        <button className="btn btn-danger btn-lg" disabled={submitting} onClick={() => submit(false)}>틀림</button>
                    </div>
                </div>
            </div>
        </main>
    );
};
