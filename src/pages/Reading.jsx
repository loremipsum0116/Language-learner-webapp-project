import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchJSON, withCreds } from '../api/client';
import './Reading.css';

export default function Reading() {
    const [searchParams] = useSearchParams();
    const level = searchParams.get('level') || 'A1';
    
    const [readingData, setReadingData] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [showExplanation, setShowExplanation] = useState(false);
    const [score, setScore] = useState(0);
    const [completedQuestions, setCompletedQuestions] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadReadingData();
    }, [level]);

    const loadReadingData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            // A1, A2, B1 레벨 데이터 로드
            if (level === 'A1' || level === 'A2' || level === 'B1') {
                const response = await fetch(`/${level}/${level}_reading/${level}_reading.json`);
                if (!response.ok) {
                    throw new Error(`Failed to load ${level} reading data`);
                }
                const data = await response.json();
                setReadingData(data);
            } else {
                // 다른 레벨은 아직 구현되지 않음
                setReadingData([]);
                setError(`${level} 레벨 리딩 데이터는 아직 준비되지 않았습니다.`);
            }
            
            setCurrentQuestion(0);
            setSelectedAnswer(null);
            setShowExplanation(false);
            setScore(0);
            setCompletedQuestions(new Set());
        } catch (err) {
            console.error('Failed to load reading data:', err);
            setError('리딩 데이터를 불러오는데 실패했습니다.');
            setReadingData([]);
        } finally {
            setLoading(false);
        }
    };

    const recordWrongAnswer = async (questionData, userAnswer) => {
        try {
            // 오답노트에 리딩 문제 기록
            await fetchJSON('/odat-note/create', withCreds({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    itemType: 'reading',
                    itemId: `${level}_${currentQuestion}`, // 레벨과 문제 번호로 고유 ID 생성
                    wrongData: {
                        level: level,
                        questionIndex: currentQuestion,
                        passage: questionData.passage,
                        question: questionData.question,
                        options: questionData.options,
                        correctAnswer: questionData.answer,
                        userAnswer: userAnswer,
                        explanation: questionData.explanation_ko
                    }
                })
            }));
        } catch (error) {
            console.error('Failed to record reading wrong answer:', error);
            throw error;
        }
    };

    const handleAnswerSelect = (option) => {
        if (showExplanation) return;
        setSelectedAnswer(option);
    };

    const handleSubmit = async () => {
        if (!selectedAnswer) return;
        
        const current = readingData[currentQuestion];
        const isCorrect = selectedAnswer === current.answer;
        
        if (isCorrect && !completedQuestions.has(currentQuestion)) {
            setScore(score + 1);
            setCompletedQuestions(prev => new Set([...prev, currentQuestion]));
        } else if (!isCorrect) {
            // 틀린 경우 오답노트에 기록
            try {
                await recordWrongAnswer(current, selectedAnswer);
            } catch (error) {
                console.error('Failed to record wrong answer:', error);
                // 오답 기록 실패해도 UI는 계속 진행
            }
        }
        
        setShowExplanation(true);
    };

    const handleNext = () => {
        if (currentQuestion < readingData.length - 1) {
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

    const handleRestart = () => {
        setCurrentQuestion(0);
        setSelectedAnswer(null);
        setShowExplanation(false);
        setScore(0);
        setCompletedQuestions(new Set());
    };

    if (loading) {
        return (
            <main className="container py-4">
                <div className="text-center">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2">리딩 데이터를 불러오는 중...</p>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="container py-4">
                <div className="alert alert-warning text-center">
                    <h4>📚 리딩 연습</h4>
                    <p>{error}</p>
                    <small className="text-muted">현재 A1 레벨만 이용 가능합니다.</small>
                </div>
            </main>
        );
    }

    if (readingData.length === 0) {
        return (
            <main className="container py-4">
                <div className="alert alert-info text-center">
                    <h4>📚 {level} 리딩 연습</h4>
                    <p>리딩 문제가 없습니다.</p>
                </div>
            </main>
        );
    }

    const current = readingData[currentQuestion];
    const progress = ((currentQuestion + 1) / readingData.length) * 100;
    const isCorrect = selectedAnswer === current.answer;

    return (
        <main className="container py-4">
            <div className="reading-container">
                {/* Header */}
                <div className="reading-header">
                    <h2 className="reading-title">📚 {level} 리딩 연습</h2>
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
                                        <span className="result-icon correct">✅ 정답!</span>
                                    ) : (
                                        <span className="result-icon incorrect">❌ 틀렸습니다</span>
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
                            disabled={currentQuestion === readingData.length - 1}
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
                                onClick={currentQuestion === readingData.length - 1 ? handleRestart : handleNext}
                            >
                                {currentQuestion === readingData.length - 1 ? '다시 시작' : '다음 문제'}
                            </button>
                        )}
                    </div>

                    <div className="utility-buttons">
                        <button 
                            className="btn btn-outline-warning"
                            onClick={handleRestart}
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