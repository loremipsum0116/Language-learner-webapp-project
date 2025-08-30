import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import './Reading.css';

export default function ListeningPractice() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const level = searchParams.get('level') || 'A1';
    const startIndex = parseInt(searchParams.get('start')) || 0;
    const selectedQuestions = searchParams.get('questions')?.split(',').map(Number) || null;
    
    const [listeningData, setListeningData] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState(startIndex);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [showExplanation, setShowExplanation] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [score, setScore] = useState(0);
    const [completedQuestions, setCompletedQuestions] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentAudio, setCurrentAudio] = useState(null);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [showScript, setShowScript] = useState(false);
    const [history, setHistory] = useState(new Map()); // 사용자 학습 기록

    useEffect(() => {
        loadListeningData();
        loadHistory();
    }, [level, startIndex]);

    // 오디오 정리
    useEffect(() => {
        return () => {
            cleanupAudio(currentAudio);
        };
    }, [currentAudio]);

    const loadListeningData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            // JSON 파일에서 리스닝 데이터 로드
            const response = await fetch(`/${level}/${level}_Listening/${level}_Listening.json`);
            if (!response.ok) {
                throw new Error(`Failed to load ${level} listening data`);
            }
            const result = await response.json();
            
            console.log('🔍 [DATA LOAD DEBUG] First question from JSON:', result[0]);
            console.log('🔍 [DATA LOAD DEBUG] Keys in first question:', result[0] ? Object.keys(result[0]) : 'No first question');
            console.log('🔍 [DATA LOAD DEBUG] First question fields - topic:', result[0]?.topic, 'question:', result[0]?.question, 'script:', result[0]?.script);
            
            if (result && Array.isArray(result) && result.length > 0) {
                // 선택된 문제들만 필터링
                if (selectedQuestions && selectedQuestions.length > 0) {
                    const filteredData = selectedQuestions.map(index => result[index]).filter(Boolean);
                    setListeningData(filteredData);
                    setCurrentQuestion(0);
                } else if (!selectedQuestions && startIndex >= 0 && searchParams.get('start')) {
                    // 단일 문제 모드: start 파라미터가 있고 questions 파라미터가 없는 경우
                    const singleQuestion = result[startIndex];
                    if (singleQuestion) {
                        setListeningData([singleQuestion]);
                        setCurrentQuestion(0);
                    } else {
                        setListeningData([]);
                        setError('해당 문제를 찾을 수 없습니다.');
                    }
                } else {
                    // 전체 데이터 로드
                    setListeningData(result);
                    setCurrentQuestion(startIndex);
                }
            } else {
                setListeningData([]);
                setError(`${level} 레벨 리스닝 데이터가 없습니다.`);
            }
            
            // 필터링되지 않은 전체 데이터를 로드한 경우에만 startIndex 사용
            if (!selectedQuestions && startIndex === 0) {
                setCurrentQuestion(startIndex);
            }
            
            setSelectedAnswer(null);
            setShowExplanation(false);
            setIsCorrect(false);
            setScore(0);
            setCompletedQuestions(new Set());
        } catch (err) {
            console.error('Failed to load listening data:', err);
            setError('리스닝 데이터를 불러오는데 실패했습니다.');
            setListeningData([]);
        } finally {
            setLoading(false);
        }
    };

    // 사용자 리스닝 학습 기록 로드
    const loadHistory = async () => {
        try {
            const response = await fetch(`http://localhost:4000/api/listening/history/${level}`, {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const result = await response.json();
                const historyData = result.data ? Object.values(result.data) : [];
                console.log(`✅ [리스닝 기록 로드] ${level} 레벨:`, historyData);
                
                const historyMap = new Map();
                historyData.forEach(record => {
                    const questionId = record.wrongData?.questionId;
                    if (questionId) {
                        // 다양한 방식으로 isCorrect 확인
                        const isCorrect = record.wrongData?.isCorrect || record.isCompleted;
                        
                        console.log(`📝 [리스닝 기록] questionId: ${questionId}`);
                        console.log(`   - record.wrongData.isCorrect: ${record.wrongData?.isCorrect}`);
                        console.log(`   - record.isCompleted: ${record.isCompleted}`);
                        console.log(`   - 최종 isCorrect: ${isCorrect}`);
                        
                        historyMap.set(String(questionId), {
                            questionId: questionId,
                            isCorrect: isCorrect,
                            solvedAt: record.wrongData?.recordedAt,
                            isCompleted: record.isCompleted,
                            attempts: record.attempts,
                            wrongData: record.wrongData // 원본 데이터도 포함
                        });
                    }
                });
                
                console.log(`🗺️ [히스토리 맵 생성 완료] 총 ${historyMap.size}개 기록`);
                historyMap.forEach((record, questionId) => {
                    console.log(`   - '${questionId}' -> isCorrect: ${record.isCorrect}`);
                });
                
                setHistory(historyMap);
            } else if (response.status === 401) {
                console.log('📝 [비로그인 사용자] 리스닝 기록을 불러올 수 없습니다.');
                setHistory(new Map());
            } else {
                console.error(`❌ 리스닝 기록 로드 실패 (${response.status})`);
                setHistory(new Map());
            }
        } catch (error) {
            console.error('❌ 리스닝 기록 로드 실패:', error);
            setHistory(new Map());
        }
    };

    // 문제 상태 확인 헬퍼 함수들
    const getQuestionStatus = (questionId) => {
        const record = history.get(String(questionId));
        console.log(`🔍 getQuestionStatus for '${questionId}':`, record);
        if (!record) return 'unsolved';
        
        // wrongData.isCorrect 또는 isCompleted 확인
        const isCorrect = record.isCorrect || record.wrongData?.isCorrect || record.isCompleted;
        console.log(`🎯 Question '${questionId}' isCorrect:`, isCorrect);
        return isCorrect ? 'correct' : 'incorrect';
    };

    const isQuestionSolved = (questionId) => {
        return history.has(String(questionId));
    };

    const isQuestionCorrect = (questionId) => {
        const record = history.get(String(questionId));
        return record?.isCorrect || record?.wrongData?.isCorrect || record?.isCompleted || false;
    };

    const playAudio = () => {
        const current = listeningData[currentQuestion];
        if (!current || !current.id) return;

        // 기존 오디오 정리
        if (currentAudio) {
            currentAudio.pause();
        }

        const audioPath = `/${level}/${level}_Listening/${level}_Listening_mix/${current.id}.mp3`;
        const audio = new Audio(audioPath);
        
        console.log('🎵 Attempting to play audio:', audioPath);
        
        const handleLoadStart = () => {
            console.log('🎵 Audio loading started');
            setIsPlaying(true);
        };
        
        const handleCanPlay = () => {
            console.log('🎵 Audio can play');
        };
        
        const handleEnded = () => {
            console.log('🎵 Audio ended');
            setIsPlaying(false);
        };
        
        const handleError = (e) => {
            // 페이지 이탈이나 컴포넌트 언마운트 시 발생하는 자연스러운 오류는 로깅하지 않음
            if (e.target.networkState !== e.target.NETWORK_NO_SOURCE) {
                console.error('❌ Audio playback error:', e);
                console.error('❌ Failed audio path:', audioPath);
                setIsPlaying(false);
                alert(`오디오를 재생할 수 없습니다: ${audioPath}`);
            }
        };
        
        audio.addEventListener('loadstart', handleLoadStart);
        audio.addEventListener('canplay', handleCanPlay);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError);
        
        // 이벤트 리스너 정리를 위해 오디오 객체에 핸들러 저장
        audio._handlers = {
            loadstart: handleLoadStart,
            canplay: handleCanPlay,
            ended: handleEnded,
            error: handleError
        };

        // 재생 속도 설정
        audio.playbackRate = playbackRate;
        
        setCurrentAudio(audio);
        
        audio.play().then(() => {
            console.log('🎵 Audio started playing successfully');
        }).catch((error) => {
            console.error('❌ Audio play() failed:', error);
            setIsPlaying(false);
            alert(`오디오 재생에 실패했습니다: ${error.message}`);
        });
    };

    const changePlaybackRate = (rate) => {
        setPlaybackRate(rate);
        if (currentAudio) {
            currentAudio.playbackRate = rate;
        }
    };

    const toggleScript = () => {
        setShowScript(!showScript);
    };

    const cleanupAudio = (audio) => {
        if (audio) {
            if (audio._handlers) {
                audio.removeEventListener('loadstart', audio._handlers.loadstart);
                audio.removeEventListener('canplay', audio._handlers.canplay);
                audio.removeEventListener('ended', audio._handlers.ended);
                audio.removeEventListener('error', audio._handlers.error);
            }
            audio.pause();
            audio.src = '';
        }
    };

    // recordWrongAnswer 함수 제거 - listening/record API에서 자동 처리

    const handleAnswerSelect = (option) => {
        if (showExplanation) return;
        setSelectedAnswer(option);
    };

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!selectedAnswer || isSubmitting) return;
        
        setIsSubmitting(true);
        const current = listeningData[currentQuestion];
        
        console.log('🔍 [SUBMIT DEBUG] Current Question Data:', current);
        console.log('🔍 [SUBMIT DEBUG] Fields - topic:', current?.topic, 'question:', current?.question, 'script:', current?.script);
        console.log('🔍 [SUBMIT DEBUG] All Keys in current:', current ? Object.keys(current) : 'current is null/undefined');
        console.log('🔍 [SUBMIT DEBUG] current.id:', current?.id);
        console.log('🔍 [SUBMIT DEBUG] current object type:', typeof current);
        
        // JSON에서는 'answer' 필드를 사용
        const correctAnswer = current.correctAnswer || current.answer;
        const correct = String(selectedAnswer).trim() === String(correctAnswer).trim();
        setIsCorrect(correct);
        
        console.log('Debug - Selected Answer:', selectedAnswer, 'Correct Answer:', correctAnswer, 'Result:', correct);
        
        // 정답/오답 모두 기록 저장 (로그인된 사용자만)
        console.log('🔄 [API CALL] Starting listening/record API call...');
        
        const requestData = {
            questionId: current.id,
            level: level,
            isCorrect: correct,
            userAnswer: selectedAnswer,
            correctAnswer: correctAnswer,
            // 추가 데이터 포함
            question: current.question,
            script: current.script,
            topic: current.topic,
            options: current.options,
            explanation: current.explanation
        };
        
        console.log('🔍 [API REQUEST DATA] Full request payload:', requestData);
        console.log('🔍 [API REQUEST DATA] question field:', requestData.question);
        console.log('🔍 [API REQUEST DATA] script field:', requestData.script);
        console.log('🔍 [API REQUEST DATA] topic field:', requestData.topic);
        
        try {
            const response = await fetch('http://localhost:4000/api/listening/record', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });
            
            if (response.ok) {
                console.log(`✅ [리스닝 기록 저장 완료] ${level} - Question ${current.id} - ${correct ? '정답' : '오답'}`);
                console.log(`📝 [저장된 데이터] questionId: ${current.id}, level: ${level}, isCorrect: ${correct}`);
                
                // UI 상태 즉시 업데이트
                setHistory(prev => {
                    const newHistory = new Map(prev);
                    newHistory.set(String(current.id), {
                        questionId: current.id,
                        isCorrect: correct,
                        solvedAt: new Date().toISOString(),
                        isCompleted: correct,
                        attempts: 1
                    });
                    return newHistory;
                });
            } else if (response.status === 401) {
                console.log('📝 [비로그인 사용자] 리스닝 기록은 로그인 후 저장됩니다.');
            } else {
                const errorText = await response.text();
                console.error(`❌ 리스닝 기록 저장 실패 (${response.status}):`, errorText);
            }
        } catch (error) {
            console.error('❌ 리스닝 기록 저장 실패:', error);
        }

        if (correct && !completedQuestions.has(currentQuestion)) {
            setScore(score + 1);
            setCompletedQuestions(prev => new Set([...prev, currentQuestion]));
            console.log(`✅ [리스닝 정답] ${level} - 문제 ${currentQuestion + 1} - 정답: ${correctAnswer}`);
        }
        // 오답노트 기록은 listening/record API에서 자동으로 처리되므로 별도 호출 불필요
        
        setIsSubmitting(false);
        setShowExplanation(true);
    };

    const handleNext = () => {
        if (currentQuestion < listeningData.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
            setSelectedAnswer(null);
            setShowExplanation(false);
            setIsCorrect(false);
            setShowScript(false); // 스크립트 숨기기
            setIsSubmitting(false); // 제출 상태 리셋
            
            // 오디오 정리
            if (currentAudio) {
                cleanupAudio(currentAudio);
                setIsPlaying(false);
                setCurrentAudio(null);
            }
        }
    };

    const handlePrevious = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion(currentQuestion - 1);
            setSelectedAnswer(null);
            setShowExplanation(false);
            setIsCorrect(false);
            setShowScript(false); // 스크립트 숨기기
            setIsSubmitting(false); // 제출 상태 리셋
            
            // 오디오 정리
            if (currentAudio) {
                cleanupAudio(currentAudio);
                setIsPlaying(false);
                setCurrentAudio(null);
            }
        }
    };

    const handleRestart = () => {
        setCurrentQuestion(0);
        setSelectedAnswer(null);
        setShowExplanation(false);
        setIsCorrect(false);
        setScore(0);
        setCompletedQuestions(new Set());
        setShowScript(false); // 스크립트 숨기기
        
        // 오디오 정리
        if (currentAudio) {
            currentAudio.pause();
            setIsPlaying(false);
            setCurrentAudio(null);
        }
    };

    if (loading) {
        return (
            <main className="container py-4">
                <div className="text-center">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2">리스닝 데이터를 불러오는 중...</p>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="container py-4">
                <div className="alert alert-warning text-center">
                    <h4>🎧 리스닝 연습</h4>
                    <p>{error}</p>
                    <small className="text-muted">현재 A1 레벨만 이용 가능합니다.</small>
                </div>
            </main>
        );
    }

    if (listeningData.length === 0) {
        return (
            <main className="container py-4">
                <div className="alert alert-info text-center">
                    <h4>🎧 {level} 리스닝 연습</h4>
                    <p>리스닝 문제가 없습니다.</p>
                </div>
            </main>
        );
    }

    const current = listeningData[currentQuestion];
    const progress = ((currentQuestion + 1) / listeningData.length) * 100;

    return (
        <main className="container py-4">
            <div className="reading-container listening-container">
                {/* Header */}
                <div className="reading-header">
                    <div className="reading-header-top">
                        <button 
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => navigate(`/listening/list?level=${level}`)}
                            title="문제 목록으로 돌아가기"
                        >
                            ← 뒤로가기
                        </button>
                        <h2 className="reading-title">🎧 {level} 리스닝 연습</h2>
                        {/* 현재 문제 상태 표시 */}
                        {listeningData[currentQuestion] && (
                            <div className="question-status">
                                {getQuestionStatus(listeningData[currentQuestion].id) === 'correct' && (
                                    <span className="status-badge correct" title="정답으로 해결한 문제">✅ 해결됨</span>
                                )}
                                {getQuestionStatus(listeningData[currentQuestion].id) === 'incorrect' && (
                                    <span className="status-badge incorrect" title="틀린 문제 (오답노트 등록됨)">❌ 오답</span>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="reading-stats">
                        <div className="progress-info">
                            <span className="question-counter">
                                {currentQuestion + 1} / {listeningData.length}
                            </span>
                            <span className="score-display">
                                점수: {score} / {listeningData.length}
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

                {/* Listening Question Card */}
                <div className="reading-card">
                    <div className="passage-section">
                        <h5 className="passage-title">🎵 오디오</h5>
                        <div className="audio-controls">
                            <div className="audio-main-controls">
                                <button 
                                    className={`btn btn-lg ${isPlaying ? 'btn-secondary' : 'btn-primary'}`}
                                    onClick={playAudio}
                                    disabled={isPlaying}
                                >
                                    {isPlaying ? '🔊 재생중...' : '🎵 오디오 재생'}
                                </button>
                                
                                {/* 재생 속도 제어 버튼 */}
                                <div className="playback-rate-controls">
                                    <span className="rate-label">속도:</span>
                                    {[0.75, 1.0, 1.25].map((rate) => (
                                        <button
                                            key={rate}
                                            className={`btn btn-sm ${playbackRate === rate ? 'btn-primary' : 'btn-outline-secondary'}`}
                                            onClick={() => changePlaybackRate(rate)}
                                        >
                                            {rate}x
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* 스크립트 보기 버튼 */}
                            <div className="script-controls">
                                <button 
                                    className={`btn btn-outline-info ${showScript ? 'active' : ''}`}
                                    onClick={toggleScript}
                                >
                                    📝 스크립트 {showScript ? '숨기기' : '보기'}
                                </button>
                            </div>
                            
                            {current.topic && (
                                <p className="audio-topic">주제: {current.topic}</p>
                            )}
                        </div>
                        
                        {/* 스크립트 드롭다운 */}
                        {showScript && current.script && (
                            <div className="script-dropdown">
                                <div className="script-content">
                                    <h6>📝 스크립트:</h6>
                                    <p className="script-text">{current.script}</p>
                                </div>
                            </div>
                        )}
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
                                            ? key === (current.correctAnswer || current.answer)
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
                                    <span className="correct-answer">정답: {current.correctAnswer || current.answer}</span>
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
                            disabled={currentQuestion === listeningData.length - 1}
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
                                onClick={currentQuestion === listeningData.length - 1 ? handleRestart : handleNext}
                            >
                                {currentQuestion === listeningData.length - 1 ? '다시 시작' : '다음 문제'}
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
                {currentQuestion === listeningData.length - 1 && showExplanation && (
                    <div className="results-summary">
                        <h4>🎉 완료!</h4>
                        <p>
                            총 점수: {score} / {listeningData.length} 
                            ({Math.round((score / listeningData.length) * 100)}%)
                        </p>
                        <div className="performance-message">
                            {score === listeningData.length 
                                ? "완벽합니다! 🌟" 
                                : score >= listeningData.length * 0.8 
                                    ? "훌륭해요! 👏" 
                                    : score >= listeningData.length * 0.6 
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