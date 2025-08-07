import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { fetchJSON, withCreds, isAbortError } from '../api/client';
import Pron from '../components/Pron';
import { toast } from 'react-toastify';

export default function SrsQuiz() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const date = searchParams.get('date');

    const [queue, setQueue] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [isSubmitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // URL의 날짜를 기반으로 퀴즈 데이터를 서버에서 가져옵니다.
    useEffect(() => {
        if (!date) {
            setError(new Error("퀴즈 날짜가 지정되지 않았습니다."));
            setLoading(false);
            return;
        }
        const ac = new AbortController();
        fetchJSON(`/srs/quiz?date=${date}`, withCreds({ signal: ac.signal }))
            .then(({ data }) => setQueue(data || []))
            .catch(err => { if (!isAbortError(err)) setError(err); })
            .finally(() => { if (!ac.signal.aborted) setLoading(false); });

        return () => ac.abort();
    }, [date]);

    const currentQuestion = queue[currentIndex];

    // 정답 제출 핸들러
    const handleSubmit = async () => {
        if (!userAnswer || !currentQuestion) return;
        setSubmitting(true);
        const isCorrect = userAnswer === currentQuestion.answer;
        try {
            await fetchJSON('/quiz/answer', withCreds({
                method: 'POST',
                body: JSON.stringify({ cardId: currentQuestion.cardId, correct: isCorrect })
            }));
            setFeedback({ isCorrect, answer: currentQuestion.answer });
        } catch (e) {
            toast.error('답변 제출에 실패했습니다.');
        } finally {
            setSubmitting(false);
        }
    };

    // 다음 문제로 이동 또는 퀴즈 완료 처리
    const handleNext = () => {
        if (currentIndex < queue.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setUserAnswer(null);
            setFeedback(null);
        } else {
            toast.success('복습을 완료했습니다! 대시보드로 돌아갑니다.');
            navigate('/srs/dashboard');
        }
    };
    
    // 로딩 및 에러 상태 UI
    if (loading) return <main className="container py-5 text-center"><h4>퀴즈 로딩 중…</h4><div className="spinner-border mt-3"></div></main>;
    if (error) return <main className="container py-4"><div className="alert alert-danger">퀴즈 로드 실패: {error.message}</div></main>;
    
    // 퀴즈가 비어있거나 모두 풀었을 때의 UI
    if (!currentQuestion) {
        return (
            <main className="container py-5 text-center">
                <div className="p-5 bg-light rounded">
                    <h4 className="mb-3">🎉 모든 단어 학습 완료!</h4>
                    <p className="text-muted">이 폴더의 모든 단어 학습을 완료했습니다.</p>
                    <Link to="/srs/dashboard" className="btn btn-primary mt-3">대시보드로 돌아가기</Link>
                </div>
            </main>
        );
    }
    
    // 메인 퀴즈 UI
    return (
        <main className="container py-4" style={{ maxWidth: 720 }}>
            <div className="d-flex justify-content-between align-items-center mb-2">
                <h4 className="m-0">SRS 복습 퀴즈</h4>
                <span className="badge bg-dark fs-6">{currentIndex + 1} / {queue.length}</span>
            </div>
            <div className="progress mb-4" style={{ height: '10px' }}>
                <div className="progress-bar" role="progressbar" style={{ width: `${((currentIndex + 1) / queue.length) * 100}%` }}></div>
            </div>

            <div className="card shadow-sm">
                <div className="card-body text-center p-5">
                    <h2 className="display-4 mb-2" lang="en">{currentQuestion.question}</h2>
                    <Pron ipa={currentQuestion.pron?.ipa} ipaKo={currentQuestion.pron?.ipaKo} />

                    {!feedback ? (
                        <div className="d-grid gap-2 col-10 mx-auto mt-4">
                            {currentQuestion.options?.map((opt) => (
                                <button key={opt} className={`btn btn-lg ${userAnswer === opt ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setUserAnswer(opt)} disabled={isSubmitting}>
                                    {opt}
                                </button>
                            ))}
                            <button className="btn btn-success btn-lg mt-3" disabled={!userAnswer || isSubmitting} onClick={handleSubmit}>
                                {isSubmitting ? '처리 중…' : '제출하기'}
                            </button>
                        </div>
                    ) : (
                        <div className={`mt-4 p-3 rounded ${feedback.isCorrect ? 'bg-success-subtle' : 'bg-danger-subtle'}`}>
                            <h4 className="fw-bold">{feedback.isCorrect ? '정답입니다!' : '오답입니다'}</h4>
                            <p className="lead fs-4">정답: {feedback.answer}</p>
                            <button className="btn btn-primary w-100 mt-3" onClick={handleNext}>
                                {currentIndex < queue.length - 1 ? '다음 문제' : '완료하고 대시보드로'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}