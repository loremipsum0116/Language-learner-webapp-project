import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetchJSON, withCreds } from '../api/client';
import EnglishWordPopup from '../components/EnglishWordPopup';
import './Reading.css';

export default function Reading() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
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
    const [englishDict, setEnglishDict] = useState(new Map());
    const [selectedWord, setSelectedWord] = useState(null);
    const [wordPopupPosition, setWordPopupPosition] = useState(null);
    const [showTranslation, setShowTranslation] = useState(false);
    const [translationData, setTranslationData] = useState(new Map());
    const [translationByIndex, setTranslationByIndex] = useState([]);

    useEffect(() => {
        loadReadingData();
        loadEnglishDictionary();
        loadTranslationData();
    }, [level, startIndex]);

    // 영어 사전 데이터 로드 (모든 레벨의 모든 IELTS JSON 파일)
    const loadEnglishDictionary = async () => {
        try {
            const dictMap = new Map();

            // 모든 레벨의 세부 폴더 수
            const allLevelFolders = {
                'A1': 9, 'A2': 9, 'B1': 8, 'B2': 8, 'C1': 5
            };

            // 모든 레벨의 모든 IELTS 파일 로드
            for (const [levelName, folderCount] of Object.entries(allLevelFolders)) {
                for (let i = 1; i <= folderCount; i++) {
                    try {
                        const response = await fetch(`/${levelName}/${levelName}_${i}/ielts_${levelName.toLowerCase()}_${i}.json`);
                        if (response.ok) {
                            const words = await response.json();
                            words.forEach(word => {
                                if (word.lemma && word.koGloss) {
                                    // 기본 단어 추출 (괄호 앞 부분)
                                    const baseWord = word.lemma.split('(')[0].trim().toLowerCase();

                                    // 해당 기본 단어에 대한 배열이 없으면 생성
                                    if (!dictMap.has(baseWord)) {
                                        dictMap.set(baseWord, []);
                                    }

                                    // 동음이의어 배열에 추가
                                    dictMap.get(baseWord).push({
                                        lemma: word.lemma,
                                        koGloss: word.koGloss,
                                        pos: word.pos,
                                        definition: word.definition,
                                        example: word.example,
                                        koExample: word.koExample,
                                        level: levelName
                                    });
                                }
                            });
                        }
                    } catch (error) {
                        console.warn(`Failed to load ${levelName}_${i} dictionary:`, error);
                    }
                }
            }

            console.log(`✅ [영어 사전 로드 완료] 전체 레벨: ${dictMap.size}개 단어`);
            setEnglishDict(dictMap);
        } catch (error) {
            console.error('❌ 영어 사전 로드 실패:', error);
            setEnglishDict(new Map());
        }
    };

    // 번역 데이터 로드 (백엔드 파일 직접 접근)
    const loadTranslationData = async () => {
        try {
            // 프론트엔드 public 폴더의 번역 파일 접근
            const response = await fetch(`/${level}/${level}_Translation.json`);
            if (response.ok) {
                const translations = await response.json();
                const translationMap = new Map();
                const translationArray = [];
                translations.forEach((item, index) => {
                    // 번역 데이터의 id(숫자)를 리딩 데이터의 dbId와 매핑
                    translationMap.set(item.id, item.translation);
                    // 인덱스 기반 배열로도 저장 (C1 등 dbId가 다른 레벨용)
                    translationArray[index] = item.translation;
                });
                setTranslationData(translationMap);
                setTranslationByIndex(translationArray);
                console.log(`✅ [번역 데이터 로드 완료] ${level}: ${translations.length}개 번역`);
            } else {
                console.warn(`번역 데이터 로드 실패: ${level}`);
                setTranslationData(new Map());
                setTranslationByIndex([]);
            }
        } catch (error) {
            console.error('번역 데이터 로드 오류:', error);
            setTranslationData(new Map());
            setTranslationByIndex([]);
        }
    };

    // 클릭 가능한 영어 텍스트 생성
    const makeClickableText = (text) => {
        if (!text) return text;

        const words = text.split(/(\s+|[.!?,:;()"])/);

        return (
            <span>
                {words.map((word, index) => {
                    const cleanWord = word.toLowerCase().replace(/[.!?,:;()"]/g, '');
                    const hasDefinition = cleanWord && englishDict.has(cleanWord);

                    if (/\s+|[.!?,:;()]/.test(word)) {
                        return <span key={index}>{word}</span>;
                    }

                    return (
                        <span
                            key={index}
                            onClick={(e) => {
                                if (hasDefinition) {
                                    const wordData = englishDict.get(cleanWord);
                                    console.log('클릭된 단어:', word, 'cleanWord:', cleanWord, 'wordData:', wordData);
                                    if (wordData && wordData.length > 0) {
                                        setSelectedWord(wordData);
                                        setWordPopupPosition({
                                            x: e.clientX,
                                            y: e.clientY - 10
                                        });
                                    }
                                }
                            }}
                            style={{
                                cursor: hasDefinition ? 'pointer' : 'default',
                                textDecoration: hasDefinition ? 'underline dotted' : 'none',
                                color: 'inherit'
                            }}
                        >
                            {word}
                        </span>
                    );
                })}
            </span>
        );
    };

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
                    // start=1은 첫 번째 문제를 의미하므로 인덱스를 1 빼야 함
                    const questionIndex = startIndex > 0 ? startIndex - 1 : 0;
                    const singleQuestion = result.data[questionIndex];
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

    const handleAnswerSelect = (option) => {
        if (showExplanation) return;
        setSelectedAnswer(option);
    };

    const handleSubmit = async () => {
        if (!selectedAnswer) return;

        const current = readingData[currentQuestion];
        const correct = String(selectedAnswer).trim() === String(current.correctAnswer).trim();
        setIsCorrect(correct);

        // 즉시 업데이트: 문제 제출 후 바로 목록 페이지 데이터 새로고침 신호
        const updateData = {
            questionId: current.id,
            level: level,
            isCorrect: correct,
            timestamp: Date.now()
        };

        // 여러 방법으로 알림 발송
        localStorage.setItem('englishReadingInstantUpdate', JSON.stringify(updateData));
        window.dispatchEvent(new CustomEvent('englishReadingUpdate', { detail: updateData }));
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'englishReadingInstantUpdate',
            newValue: JSON.stringify(updateData)
        }));

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
                    correctAnswer: current.correctAnswer,
                    timeTaken: null,
                    question: current.question,
                    passage: current.passage,
                    options: current.options,
                    explanation: current.explanation
                })
            });

            if (response.ok) {
                console.log(`✅ [리딩 기록 저장 완료] ${level} - Question ${current.id} - ${correct ? '정답' : '오답'}`);
            } else if (response.status === 401) {
                const errorText = await response.text();
                console.log('📝 [비로그인 사용자] 리딩 기록은 로그인 후 저장됩니다.');
                console.log('📝 [응답 내용]:', errorText);
            } else {
                const errorText = await response.text();
                console.error(`❌ 리딩 기록 저장 실패 (${response.status}):`, errorText);
            }
        } catch (error) {
            console.error('❌ 리딩 기록 저장 실패:', error);
        }

        if (correct && !completedQuestions.has(currentQuestion)) {
            setScore(score + 1);
            setCompletedQuestions(prev => new Set([...prev, currentQuestion]));
        }

        setShowExplanation(true);
        setShowTranslation(true); // 정답 확인 후 번역 표시
    };

    const handleNext = () => {
        if (currentQuestion < readingData.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
            setSelectedAnswer(null);
            setShowExplanation(false);
            setIsCorrect(false);
            setShowTranslation(false);
        }
    };

    const handlePrevious = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion(currentQuestion - 1);
            setSelectedAnswer(null);
            setShowExplanation(false);
            setIsCorrect(false);
            setShowTranslation(false);
        }
    };

    const handleRestart = () => {
        setCurrentQuestion(0);
        setSelectedAnswer(null);
        setShowExplanation(false);
        setIsCorrect(false);
        setScore(0);
        setCompletedQuestions(new Set());
        setShowTranslation(false);
    };

    const navigateToList = () => {
        // 영어 리딩 목록 페이지에 통계 업데이트 알림
        localStorage.setItem('englishReadingInstantUpdate', JSON.stringify({
            level: level,
            timestamp: Date.now()
        }));
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'englishReadingInstantUpdate',
            newValue: Date.now().toString()
        }));
        navigate(`/reading?level=${level}`);
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


    // 데이터가 로드되지 않았거나 current가 없으면 로딩 표시
    if (!readingData.length || !current) {
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

    return (
        <main className="container py-4">
            <div className="reading-container">
                {/* Header */}
                <div className="reading-header">
                    <div className="reading-header-top">
                        <button
                            className="btn btn-outline-secondary btn-sm"
                            onClick={navigateToList}
                            title="문제 목록으로 돌아가기"
                        >
                            ← 뒤로가기
                        </button>
                        <h2 className="reading-title">📚 {level} 리딩 연습</h2>
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
                        <div className="passage-text" style={{ cursor: 'pointer' }}>
                            {makeClickableText(current.passage)}
                        </div>
                        {showTranslation && showExplanation && translationByIndex[currentQuestion] && (
                            <div className="translation-text" style={{
                                marginTop: '12px',
                                padding: '12px',
                                backgroundColor: '#e8f4f8',
                                borderRadius: '6px',
                                borderLeft: '4px solid #0d6efd'
                            }}>
                                <h6 style={{ marginBottom: '8px', color: '#0c5460' }}>📄 번역:</h6>
                                <div style={{ color: '#2c3e50', fontSize: '14px', lineHeight: '1.6' }}>
                                    {translationByIndex[currentQuestion]}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="question-section">
                        <h5 className="question-title">❓ 문제</h5>
                        <p className="question-text">{current.question}</p>

                        <div className="options-grid">
                            {current.options && Object.entries(current.options).map(([key, value]) => (
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
                                    onClick={() => {
                                        if (!showExplanation) {
                                            handleAnswerSelect(key);
                                        }
                                    }}
                                    disabled={showExplanation}
                                >
                                    <span className="option-letter">{key}</span>
                                    <span
                                        className="option-text"
                                        style={{ cursor: showExplanation ? 'pointer' : 'default' }}
                                    >
                                        {showExplanation ? makeClickableText(value) : value}
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

                {/* Word Popup */}
                {selectedWord && wordPopupPosition && (
                    <EnglishWordPopup
                        word={selectedWord[0]?.lemma}
                        definitions={selectedWord}
                        position={wordPopupPosition}
                        onClose={() => {
                            setSelectedWord(null);
                            setWordPopupPosition(null);
                        }}
                    />
                )}
            </div>
        </main>
    );
}