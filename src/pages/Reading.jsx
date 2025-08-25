import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchJSON, withCreds } from '../api/client';
import './Reading.css';

export default function Reading() {
    const [searchParams] = useSearchParams();
    const level = searchParams.get('level') || 'A1';
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
            const response = await fetch(`http://localhost:4000/api/reading/practice/${level}`);
            if (!response.ok) {
                throw new Error(`Failed to load ${level} reading data`);
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
                        setReadingData([]);
                        setError('해당 문제를 찾을 수 없습니다.');
                    }
                } else {
                    // 전체 데이터 로드 (처음부터 시작하거나 특정 인덱스부터 시작)
                    setReadingData(result.data);
                    setCurrentQuestion(startIndex);
                }
            } else {
                setReadingData([]);
                setError(`${level} 레벨 리딩 데이터가 없습니다.`);
            }
            
            // 필터링되지 않은 전체 데이터를 로드한 경우에만 startIndex 사용
            if (!selectedQuestions && startIndex === 0) {
                setCurrentQuestion(startIndex);
            }
            // 다른 경우들은 위에서 이미 setCurrentQuestion(0)으로 처리됨
            setSelectedAnswer(null);
            setShowExplanation(false);
            setIsCorrect(false);
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
            // 오답노트에 리딩 문제 기록 (기존 API 형식 사용)
            await fetchJSON('/odat-note/create', withCreds({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    itemType: 'reading',
                    itemId: currentQuestion + 1000, // 간단한 정수 ID 생성
                    wrongData: {
                        level: level,
                        questionIndex: currentQuestion,
                        passage: questionData.passage,
                        question: questionData.question,
                        options: questionData.options,
                        correctAnswer: questionData.correctAnswer,
                        userAnswer: userAnswer,
                        explanation: questionData.explanation
                    }
                })
            }));
            console.log(`✅ [리딩 오답 기록 완료] ${level} - 문제 ${currentQuestion + 1}`);
            // 사용자에게 알림 (선택적)
            // alert(`오답이 오답노트에 저장되었습니다. (리딩: ${level} 레벨)`);
        } catch (error) {
            if (error.message.includes('Unauthorized')) {
                console.log('📝 [비로그인 사용자] 오답노트는 로그인 후 이용 가능합니다.');
            } else {
                console.error('❌ 리딩 오답 기록 실패:', error);
                console.warn('⚠️ 오답노트 저장에 실패했습니다. 네트워크 연결을 확인해주세요.');
            }
            // 오답 기록 실패해도 게임은 계속 진행
        }
    };

    const handleAnswerSelect = (option) => {
        if (showExplanation) return;
        setSelectedAnswer(option);
    };

    const handleSubmit = async () => {
        if (!selectedAnswer) return;
        
        const current = readingData[currentQuestion];
        console.log('Debug - Selected Answer:', selectedAnswer, 'Type:', typeof selectedAnswer);
        console.log('Debug - Correct Answer:', current.correctAnswer, 'Type:', typeof current.correctAnswer);
        console.log('Debug - Comparison Result:', selectedAnswer === current.correctAnswer);
        
        const correct = String(selectedAnswer).trim() === String(current.correctAnswer).trim();
        setIsCorrect(correct);
        
        console.log('Debug - isCorrect:', correct);
        console.log('Debug - completedQuestions has question:', completedQuestions.has(currentQuestion));
        console.log('Debug - Will increase score?', correct && !completedQuestions.has(currentQuestion));
        
        // 정답/오답 모두 기록 저장 (로그인된 사용자만)
        try {
            const response = await fetch('http://localhost:4000/api/reading/record', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questionId: current.id,
                    level: level,
                    isCorrect: correct,
                    userAnswer: selectedAnswer,
                    correctAnswer: current.correctAnswer
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log(`✅ [리딩 기록 저장 완료] ${level} - Question ${current.id} - ${correct ? '정답' : '오답'}`, result);
            } else if (response.status === 401) {
                console.log('📝 [비로그인 사용자] 리딩 기록은 로그인 후 저장됩니다.');
            } else {
                const errorText = await response.text();
                console.error(`❌ 리딩 기록 저장 실패 (${response.status}):`, errorText);
            }
        } catch (error) {
            console.error('❌ 리딩 기록 저장 실패:', error);
        }

        if (correct && !completedQuestions.has(currentQuestion)) {
            console.log('Debug - Increasing score');
            setScore(score + 1);
            setCompletedQuestions(prev => new Set([...prev, currentQuestion]));
        } else if (!correct) {
            console.log('Debug - Recording wrong answer');
            // 틀린 경우 추가로 오답노트에도 기록
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
            setIsCorrect(false);
        }
    };

    const handlePrevious = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion(currentQuestion - 1);
            setSelectedAnswer(null);
            setShowExplanation(false);
            setIsCorrect(false);
        }
    };

    const handleRestart = () => {
        setCurrentQuestion(0);
        setSelectedAnswer(null);
        setShowExplanation(false);
        setIsCorrect(false);
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
                                            ? key === current.correctAnswer 
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
                                    <span className="correct-answer">정답: {current.correctAnswer}</span>
                                </div>
                                {current.explanation && (
                                    <p className="explanation-text">{current.explanation}</p>
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