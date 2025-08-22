import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchJSON, withCreds } from '../api/client';
import './Reading.css';

export default function ReadingReview() {
    const navigate = useNavigate();
    const [reviewData, setReviewData] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [showExplanation, setShowExplanation] = useState(false);
    const [score, setScore] = useState(0);
    const [completedQuestions, setCompletedQuestions] = useState(new Set());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadReviewData();
    }, []);

    const loadReviewData = () => {
        try {
            const data = sessionStorage.getItem('readingReviewData');
            if (data) {
                const parsedData = JSON.parse(data);
                setReviewData(parsedData);
                setLoading(false);
            } else {
                // 복습 데이터가 없으면 오답노트로 돌아가기
                navigate('/srs/wrong-answers');
            }
        } catch (error) {
            console.error('Failed to load review data:', error);
            navigate('/srs/wrong-answers');
        }
    };

    const markAsResolved = async (wrongAnswerId) => {
        try {
            // 오답을 완료 처리
            await fetchJSON(`/odat-note/${wrongAnswerId}/resolve`, withCreds({
                method: 'POST'
            }));
        } catch (error) {
            console.error('Failed to mark wrong answer as resolved:', error);
        }
    };

    const handleAnswerSelect = (option) => {
        if (showExplanation) return;
        setSelectedAnswer(option);
    };

    const handleSubmit = async () => {
        if (!selectedAnswer) return;
        
        const current = reviewData[currentQuestion];
        const isCorrect = selectedAnswer === current.answer;
        
        if (isCorrect && !completedQuestions.has(currentQuestion)) {
            setScore(score + 1);
            setCompletedQuestions(prev => new Set([...prev, currentQuestion]));
            
            // 정답이면 오답노트에서 해결 처리
            if (current.wrongAnswerId) {
                try {
                    await markAsResolved(current.wrongAnswerId);
                } catch (error) {
                    console.error('Failed to mark as resolved:', error);
                }
            }
        }
        
        setShowExplanation(true);
    };

    const handleNext = () => {
        if (currentQuestion < reviewData.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
            setSelectedAnswer(null);
            setShowExplanation(false);
        }
    };

    const handlePrevious = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion(currentQuestion - 1);
            setSelectedAnswer(null);
            setShowExplanation(false);
        }
    };

    const handleFinishReview = () => {
        // 세션 스토리지 정리
        sessionStorage.removeItem('readingReviewData');
        // 오답노트로 돌아가기
        navigate('/srs/wrong-answers');
    };

    if (loading) {
        return (
            <main className="container py-4">
                <div className="text-center">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2">복습 데이터를 불러오는 중...</p>
                </div>
            </main>
        );
    }

    if (reviewData.length === 0) {
        return (
            <main className="container py-4">
                <div className="alert alert-warning text-center">
                    <h4>📚 리딩 복습</h4>
                    <p>복습할 문제가 없습니다.</p>
                    <button 
                        className="btn btn-primary"
                        onClick={() => navigate('/srs/wrong-answers')}
                    >
                        오답노트로 돌아가기
                    </button>
                </div>
            </main>
        );
    }

    const current = reviewData[currentQuestion];
    const progress = ((currentQuestion + 1) / reviewData.length) * 100;
    const isCorrect = selectedAnswer === current.answer;

    return (
        <main className="container py-4">
            <div className="reading-container">
                {/* Header */}
                <div className="reading-header">
                    <h2 className="reading-title">📖 리딩 오답 복습</h2>
                    <div className="reading-stats">
                        <div className="progress-info">
                            <span className="question-counter">
                                {currentQuestion + 1} / {reviewData.length}
                            </span>
                            <span className="score-display">
                                정답: {score} / {reviewData.length}
                            </span>
                        </div>
                        <div className="progress-bar">
                            <div 
                                className="progress-fill" 
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                </div>

                {/* Question Info */}
                <div className="alert alert-info mb-3">
                    <strong>📝 원래 틀린 문제:</strong> {current.level} 레벨 #{current.questionIndex + 1}번
                </div>

                {/* Reading Question Card */}
                <div className="reading-card">
                    <div className="passage-section">
                        <h5 className="passage-title">📖 지문</h5>
                        <div className="passage-text">
                            {current.passage}
                        </div>
                    </div>

                    <div className="question-section">
                        <h5 className="question-title">❓ 문제</h5>
                        <p className="question-text">{current.question}</p>

                        <div className="options-grid">
                            {Object.entries(current.options).map(([key, value]) => (
                                <button
                                    key={key}
                                    className={`option-btn ${
                                        selectedAnswer === key ? 'selected' : ''
                                    } ${
                                        showExplanation 
                                            ? key === current.answer 
                                                ? 'correct' 
                                                : selectedAnswer === key 
                                                    ? 'incorrect' 
                                                    : ''
                                            : ''
                                    }`}
                                    onClick={() => handleAnswerSelect(key)}
                                    disabled={showExplanation}
                                >
                                    <span className="option-letter">{key}</span>
                                    <span className="option-text">{value}</span>
                                </button>
                            ))}
                        </div>

                        {showExplanation && (
                            <div className={`explanation-box ${isCorrect ? 'correct' : 'incorrect'}`}>
                                <div className="explanation-header">
                                    {isCorrect ? (
                                        <span className="result-icon correct">✅ 정답! 오답노트에서 해결됨</span>
                                    ) : (
                                        <span className="result-icon incorrect">❌ 다시 틀렸습니다</span>
                                    )}
                                    <span className="correct-answer">정답: {current.answer}</span>
                                </div>
                                <p className="explanation-text">{current.explanation_ko}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Control Buttons */}
                <div className="reading-controls">
                    <div className="nav-buttons">
                        <button 
                            className="btn btn-outline-secondary"
                            onClick={handlePrevious}
                            disabled={currentQuestion === 0}
                        >
                            ← 이전
                        </button>
                        
                        <button 
                            className="btn btn-outline-secondary"
                            onClick={handleNext}
                            disabled={currentQuestion === reviewData.length - 1}
                        >
                            다음 →
                        </button>
                    </div>

                    <div className="action-buttons">
                        {!showExplanation ? (
                            <button 
                                className="btn btn-primary"
                                onClick={handleSubmit}
                                disabled={!selectedAnswer}
                            >
                                정답 확인
                            </button>
                        ) : (
                            <button 
                                className="btn btn-success"
                                onClick={currentQuestion === reviewData.length - 1 ? handleFinishReview : handleNext}
                            >
                                {currentQuestion === reviewData.length - 1 ? '복습 완료' : '다음 문제'}
                            </button>
                        )}
                    </div>

                    <div className="utility-buttons">
                        <button 
                            className="btn btn-outline-warning"
                            onClick={handleFinishReview}
                        >
                            🏠 오답노트로 돌아가기
                        </button>
                    </div>
                </div>

                {/* Final Results */}
                {currentQuestion === reviewData.length - 1 && showExplanation && (
                    <div className="results-summary">
                        <h4>🎉 복습 완료!</h4>
                        <p>
                            복습 점수: {score} / {reviewData.length} 
                            ({Math.round((score / reviewData.length) * 100)}%)
                        </p>
                        <div className="performance-message">
                            {score === reviewData.length 
                                ? "완벽합니다! 모든 문제가 해결되었습니다! 🌟" 
                                : score >= reviewData.length * 0.8 
                                    ? "훌륭해요! 대부분의 문제를 해결했습니다! 👏" 
                                    : score >= reviewData.length * 0.6 
                                        ? "잘했어요! 몇 문제가 더 연습이 필요합니다! 👍" 
                                        : "더 연습해보세요! 아직 해결되지 않은 문제들이 있습니다! 💪"
                            }
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}