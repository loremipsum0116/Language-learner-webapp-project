import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetchJSON, withCreds } from '../api/client';
import './Reading.css';

export default function JapaneseReading() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const level = searchParams.get('level') || 'N3';
    const startIndex = parseInt(searchParams.get('start')) || 0;
    const selectedQuestions = searchParams.get('questions')?.split(',').map(Number) || null;

    const [readingData, setReadingData] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState(startIndex);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [showExplanation, setShowExplanation] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [score, setScore] = useState(0);
    const [completedQuestions, setCompletedQuestions] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadReadingData();
    }, [level, startIndex]);

    const loadReadingData = async () => {
        try {
            setLoading(true);
            setError(null);

            // API를 통해 모든 레벨 데이터 로드
            const response = await fetch(`http://localhost:4000/api/japanese-reading/practice/${level}`);
            if (!response.ok) {
                throw new Error(`Failed to load ${level} Japanese reading data`);
            }
            const result = await response.json();

            if (result.data && result.data.length > 0) {
                // 선택된 문제들만 필터링
                if (selectedQuestions && selectedQuestions.length > 0) {
                    const filteredData = selectedQuestions.map(index => result.data[index]).filter(Boolean);
                    setReadingData(filteredData);
                    setCurrentQuestion(0); // 필터된 데이터에서는 처음부터 시작
                } else if (!selectedQuestions && startIndex >= 0 && searchParams.get('start')) {
                    // 단일 문제 모드: start 파라미터가 있고 questions 파라미터가 없는 경우
                    const singleQuestion = result.data[startIndex];
                    if (singleQuestion) {
                        setReadingData([singleQuestion]);
                        setCurrentQuestion(0);
                    } else {
                        throw new Error(`Question at index ${startIndex} not found`);
                    }
                } else {
                    // 전체 데이터 모드
                    setReadingData(result.data);
                }
            } else {
                throw new Error(`No ${level} reading data found`);
            }

        } catch (error) {
            console.error('Error loading reading data:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAnswerSelect = (answer) => {
        if (showExplanation) return;
        setSelectedAnswer(answer);
    };

    const submitAnswer = async () => {
        if (selectedAnswer === null) {
            alert('답을 선택해주세요.');
            return;
        }

        const currentQuestionData = readingData[currentQuestion];
        const correct = selectedAnswer === currentQuestionData.answer;
        setIsCorrect(correct);
        setShowExplanation(true);

        if (correct) {
            setScore(score + 1);
            setCompletedQuestions(prev => new Set([...prev, currentQuestion]));
        }

        // 서버에 답안 제출
        try {
            const response = await fetch('http://localhost:4000/api/japanese-reading/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    questionId: currentQuestionData.id,
                    level: level,
                    userAnswer: selectedAnswer,
                    correctAnswer: currentQuestionData.answer,
                    isCorrect: correct,
                    passage: currentQuestionData.passage,
                    question: currentQuestionData.question,
                    options: currentQuestionData.options,
                    explanation: currentQuestionData.explanation_ko
                })
            });

            if (!response.ok) {
                console.error('Failed to submit answer to server');
            }
        } catch (error) {
            console.error('Error submitting answer:', error);
        }
    };

    const nextQuestion = () => {
        if (currentQuestion < readingData.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
            setSelectedAnswer(null);
            setShowExplanation(false);
            setIsCorrect(false);
        }
    };

    const prevQuestion = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion(currentQuestion - 1);
            setSelectedAnswer(null);
            setShowExplanation(false);
            setIsCorrect(false);
        }
    };

    const goToQuestion = (index) => {
        setCurrentQuestion(index);
        setSelectedAnswer(null);
        setShowExplanation(false);
        setIsCorrect(false);
    };

    const resetQuiz = () => {
        setCurrentQuestion(0);
        setSelectedAnswer(null);
        setShowExplanation(false);
        setIsCorrect(false);
        setScore(0);
        setCompletedQuestions(new Set());
    };

    const finishQuiz = () => {
        navigate(`/japanese-reading?level=${level}`);
    };

    if (loading) {
        return (
            <div className="reading-container">
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>일본어 리딩 문제를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="reading-container">
                <div className="error-state">
                    <h2>❌ 오류 발생</h2>
                    <p>{error}</p>
                    <button
                        onClick={() => navigate(`/japanese-reading?level=${level}`)}
                        className="btn-primary"
                    >
                        목록으로 돌아가기
                    </button>
                </div>
            </div>
        );
    }

    if (readingData.length === 0) {
        return (
            <div className="reading-container">
                <div className="error-state">
                    <h2>📭 문제가 없습니다</h2>
                    <p>{level} 레벨의 일본어 리딩 문제를 찾을 수 없습니다.</p>
                    <button
                        onClick={() => navigate('/japanese-reading')}
                        className="btn-primary"
                    >
                        레벨 선택으로 돌아가기
                    </button>
                </div>
            </div>
        );
    }

    const currentQuestionData = readingData[currentQuestion];
    const progress = ((currentQuestion + 1) / readingData.length) * 100;

    return (
        <main className="container py-4">
            <div className="reading-container">
                {/* Header */}
                <div className="reading-header">
                    <div className="reading-header-top">
                        <button
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => navigate(`/japanese-reading?level=${level}`)}
                            title="문제 목록으로 돌아가기"
                        >
                            ← 뒤로가기
                        </button>
                        <h2 className="reading-title">📚 {level} 일본어 리딩 연습</h2>
                    </div>
                    <div className="reading-stats">
                        <div className="progress-info">
                            <span className="question-counter">
                                {currentQuestion + 1} / {readingData.length}
                            </span>
                            <span className="score-display">
                                점수: {score} / {readingData.length}
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

                {/* Reading Question Card */}
                <div className="reading-card">
                    <div className="passage-section">
                        <h5 className="passage-title">📖 지문</h5>
                        <div className="passage-text">
                            <div
                                className="japanese-text"
                                dangerouslySetInnerHTML={{ __html: currentQuestionData.passage }}
                            />
                        </div>
                    </div>

                    <div className="question-section">
                        <h5 className="question-title">❓ 문제</h5>
                        <p className="question-text">
                            <div
                                className="japanese-text"
                                dangerouslySetInnerHTML={{ __html: currentQuestionData.question }}
                            />
                        </p>

                        <div className="options-grid">
                            {Object.entries(currentQuestionData.options).map(([key, value]) => (
                                <button
                                    key={key}
                                    className={`option-btn ${
                                        selectedAnswer === key ? 'selected' : ''
                                    } ${
                                        showExplanation
                                            ? key === currentQuestionData.answer
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
                                    <span className="option-text">
                                        <div
                                            className="japanese-text"
                                            dangerouslySetInnerHTML={{ __html: value }}
                                        />
                                    </span>
                                </button>
                            ))}
                        </div>

                        {showExplanation && (
                            <div className={`explanation-box ${isCorrect ? 'correct' : 'incorrect'}`}>
                                <div className="explanation-header">
                                    {isCorrect ? (
                                        <span className="result-icon correct">✅ 정답!</span>
                                    ) : (
                                        <span className="result-icon incorrect">❌ 틀렸습니다</span>
                                    )}
                                    <span className="correct-answer">정답: {currentQuestionData.answer}</span>
                                </div>
                                {currentQuestionData.explanation_ko && (
                                    <p className="explanation-text">{currentQuestionData.explanation_ko}</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Control Buttons */}
                <div className="reading-controls">
                    <div className="nav-buttons">
                        <button
                            className="btn btn-outline-secondary"
                            onClick={prevQuestion}
                            disabled={currentQuestion === 0}
                        >
                            ← 이전
                        </button>

                        <button
                            className="btn btn-outline-secondary"
                            onClick={nextQuestion}
                            disabled={currentQuestion === readingData.length - 1}
                        >
                            다음 →
                        </button>
                    </div>

                    <div className="action-buttons">
                        {!showExplanation ? (
                            <button
                                className="btn btn-primary"
                                onClick={submitAnswer}
                                disabled={!selectedAnswer}
                            >
                                정답 확인
                            </button>
                        ) : (
                            <button
                                className="btn btn-success"
                                onClick={currentQuestion === readingData.length - 1 ? resetQuiz : nextQuestion}
                            >
                                {currentQuestion === readingData.length - 1 ? '다시 시작' : '다음 문제'}
                            </button>
                        )}
                    </div>

                    <div className="utility-buttons">
                        <button
                            className="btn btn-outline-warning"
                            onClick={resetQuiz}
                        >
                            🔄 처음부터
                        </button>
                    </div>
                </div>

                {/* Final Results */}
                {currentQuestion === readingData.length - 1 && showExplanation && (
                    <div className="results-summary">
                        <h4>🎉 완료!</h4>
                        <p>
                            총 점수: {score} / {readingData.length}
                            ({Math.round((score / readingData.length) * 100)}%)
                        </p>
                        <div className="performance-message">
                            {score === readingData.length
                                ? "완벽합니다! 🌟"
                                : score >= readingData.length * 0.8
                                    ? "훌륭해요! 👏"
                                    : score >= readingData.length * 0.6
                                        ? "잘했어요! 👍"
                                        : "더 연습해보세요! 💪"
                            }
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}