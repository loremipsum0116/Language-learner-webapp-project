// src/pages/GrammarQuiz.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { grammarTopics } from '../data/mockGrammar';
import { fetchJSON, withCreds } from '../api/client'; // API 호출을 위해 import

// 설명 콘텐츠를 렌더링하는 헬퍼 컴포넌트
function ExplanationContent({ item }) {
    switch (item.type) {
        case 'heading':
            return <h5 className="mt-3 mb-2">{item.content}</h5>;
        case 'list':
            return <ul className="list-unstyled ps-3">{item.items.map((li, i) => <li key={i}>- {li}</li>)}</ul>;
        case 'example':
            return <div className="p-3 my-2 rounded bg-light">{item.items.map((ex, i) => <div key={i}><span lang="en">{ex.de}</span><small className="text-muted d-block"> — {ex.ko}</small></div>)}</div>;
        default:
            return <p className="mb-2">{item.content}</p>;
    }
}

export default function GrammarQuiz() {
    const { topicId } = useParams();
    const [topic, setTopic] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [incorrectAnswers, setIncorrectAnswers] = useState([]);
    const [isCompleted, setIsCompleted] = useState(false);
    const [viewMode, setViewMode] = useState('explanation');
    
    // ★ 설명 페이지를 위한 상태 복원
    const [explanationPage, setExplanationPage] = useState(0);

    useEffect(() => {
        const currentTopic = grammarTopics.find(t => t.id === topicId);
        if (currentTopic) {
            setTopic(currentTopic);
            setQuestions(currentTopic.questions);
            // 주제가 바뀔 때 설명 페이지를 처음으로 리셋
            setExplanationPage(0);
        }
    }, [topicId]);

    const currentQuestion = questions[currentIndex];

    const handleOptionSelect = (option) => {
        if (feedback) return;
        setUserAnswer(option);
    };

    const handleSubmit = async () => {
        const isCorrect = userAnswer === currentQuestion.answer;
        setFeedback({
            isCorrect,
            explanation: currentQuestion.explanation,
        });

        if (!isCorrect) {
            setIncorrectAnswers(prev => [...prev, currentQuestion]);

            // 오답노트에 문법 문제 기록
            try {
                await fetchJSON('/api/odat-note', withCreds({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'grammar',
                        wrongData: {
                            topicId: topicId,
                            topicTitle: topic.title,
                            questionIndex: currentIndex,
                            question: currentQuestion.stem,
                            userAnswer: userAnswer,
                            correctAnswer: currentQuestion.answer,
                            options: currentQuestion.options,
                            explanation: currentQuestion.explanation,
                            level: topic.level,
                            language: 'en' // 영어 문법 명시
                        }
                    })
                }));
                console.log(`✅ [문법 오답 기록 완료] ${topic.title} - 문제 ${currentIndex + 1}`);
                // 사용자에게 알림 (선택적)
                // alert(`오답이 오답노트에 저장되었습니다. (문법: ${topic.title})`);
            } catch (error) {
                console.error('❌ 문법 오답 기록 실패:', error);
                // 사용자에게 오답 기록 실패 알림
                if (error.message.includes('Unauthorized')) {
                    console.warn('⚠️ 로그인이 필요합니다. 오답노트 기록을 위해 로그인해주세요.');
                } else {
                    console.warn('⚠️ 오답노트 저장에 실패했습니다. 네트워크 연결을 확인해주세요.');
                }
            }
        }
    };

    const handleNext = () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setUserAnswer(null);
            setFeedback(null);
        } else {
            setIsCompleted(true);
        }
    };

    const handleRestartIncorrect = () => {
        setQuestions(incorrectAnswers);
        setCurrentIndex(0);
        setUserAnswer(null);
        setFeedback(null);
        setIncorrectAnswers([]);
        setIsCompleted(false);
    };

    if (!topic) return <main className="container py-4"><h2>주제를 찾을 수 없습니다.</h2></main>;

    if (viewMode === 'explanation') {
        const explanationContent = topic.detailedExplanation || [];
        const currentPageItems = explanationContent[explanationPage] || [];
        const isLastPage = explanationPage === explanationContent.length - 1;

        return (
            <main className="container py-4" style={{ maxWidth: 720 }}>
                <div className="card">
                    <div className="card-body p-4">
                        <h3 className="card-title mb-3">{topic.title}</h3>
                        {currentPageItems.map((item, index) => (
                            <ExplanationContent key={index} item={item} />
                        ))}
                    </div>
                    <div className="card-footer d-flex justify-content-between align-items-center p-3">
                        <button 
                            className="btn btn-outline-secondary" 
                            onClick={() => setExplanationPage(p => p - 1)} 
                            disabled={explanationPage === 0}
                        >
                            이전
                        </button>
                        <span>{explanationPage + 1} / {explanationContent.length}</span>
                        {isLastPage ? (
                            <button className="btn btn-primary" onClick={() => setViewMode('quiz')}>
                                문제 풀러가기
                            </button>
                        ) : (
                            <button className="btn btn-secondary" onClick={() => setExplanationPage(p => p + 1)}>
                                다음
                            </button>
                        )}
                    </div>
                </div>
            </main>
        );
    }

    if (isCompleted) {
        return (
            <main className="container py-4" style={{ maxWidth: 720 }}>
                <div className="text-center p-4 card">
                    <h3 className="mb-2">🎉 학습 완료!</h3>
                    <p className="lead">총 {questions.length}문제 중 <strong>{questions.length - incorrectAnswers.length}</strong>개를 맞혔습니다.</p>
                    {incorrectAnswers.length > 0 && (
                        <div className="alert alert-warning mt-3">
                            <strong>부족한 부분:</strong> {incorrectAnswers.length}개의 틀린 문제가 있습니다.
                            <div className="mt-2">
                                <Link to="/wrong-answers?tab=grammar" className="btn btn-sm btn-outline-primary">
                                    📝 문법 오답노트에서 복습하기
                                </Link>
                            </div>
                        </div>
                    )}
                    <div className="d-flex justify-content-center gap-3 mt-4">
                        {incorrectAnswers.length > 0 && (
                            <button className="btn btn-primary" onClick={handleRestartIncorrect}>
                                틀린 문제 다시 풀기
                            </button>
                        )}
                        <Link to="/learn/grammar" className="btn btn-outline-secondary">
                            목록으로 돌아가기
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="container py-4" style={{ maxWidth: 720 }}>
            <div className="d-flex justify-content-between align-items-center mb-2">
                <h4 className="m-0">{topic.title}</h4>
                <span className="badge bg-secondary">{currentIndex + 1} / {questions.length}</span>
            </div>
            <div className="progress mb-4" style={{ height: '8px' }}>
                <div
                    className="progress-bar"
                    role="progressbar"
                    style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                    aria-valuenow={currentIndex + 1}
                    aria-valuemin="0"
                    aria-valuemax={questions.length}>
                </div>
            </div>

            <div className="card">
                <div className="card-body p-4 fs-5">
                    <p>{currentQuestion?.stem.split('___')[0]} <span className="fw-bold text-primary">___</span> {currentQuestion?.stem.split('___')[1]}</p>
                </div>
                <div className="list-group list-group-flush">
                    {currentQuestion?.options.map(option => (
                        <button
                            key={option}
                            className={`list-group-item list-group-item-action fs-5 ${userAnswer === option ? 'active' : ''}`}
                            onClick={() => handleOptionSelect(option)}
                            disabled={!!feedback}
                        >
                            {option}
                        </button>
                    ))}
                </div>
            </div>

            {feedback && (
                <div className={`mt-3 p-3 rounded ${feedback.isCorrect ? 'bg-success-subtle text-success-emphasis' : 'bg-danger-subtle text-danger-emphasis'}`}>
                    <h5>{feedback.isCorrect ? '정답입니다!' : `오답입니다. (정답: ${currentQuestion.answer})`}</h5>
                    <p className="mb-0">{feedback.explanation}</p>
                </div>
            )}

            <div className="mt-4">
                {feedback ? (
                    <button className="btn btn-primary w-100" onClick={handleNext}>
                        {currentIndex < questions.length - 1 ? '다음 문제' : '결과 보기'}
                    </button>
                ) : (
                    <button className="btn btn-secondary w-100" onClick={handleSubmit} disabled={!userAnswer}>
                        제출하기
                    </button>
                )}
            </div>
        </main>
    );
}