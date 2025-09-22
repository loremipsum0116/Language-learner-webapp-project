import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useLocation } from 'react-router-dom';
import './ReadingList.css';

export default function JapaneseListeningList() {
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const level = searchParams.get('level') || 'N5';

    const [listeningData, setListeningData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedQuestions, setSelectedQuestions] = useState(new Set());
    const [history, setHistory] = useState(new Map());
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        console.log(`🔄🆕 [EFFECT START] useEffect 시작`);

        const abortController = new AbortController();

        const loadData = async () => {
            try {
                console.log(`🔄🆕 [DATA LOADING START] 데이터 로딩 시작`);

                // 리스닝 데이터와 히스토리를 순차적으로 로드
                await loadListeningData();
                console.log(`📚🆕 [LISTENING DATA LOADED] 리스닝 데이터 로드 완료`);

                if (!abortController.signal.aborted) {
                    await loadHistory(abortController.signal);
                    console.log(`📊🆕 [HISTORY LOADED] 히스토리 로드 완료`);
                }

                console.log(`✅🆕 [ALL DATA LOADED] 모든 데이터 로딩 완료`);
            } catch (error) {
                if (error.name === 'AbortError') {
                    console.log(`🚫🆕 [EFFECT ABORTED] useEffect가 정리되어 요청 중단됨`);
                } else {
                    console.error(`❌🆕 [EFFECT ERROR]`, error);
                }
            }
        };

        loadData();

        // Cleanup function
        return () => {
            console.log(`🧹🆕 [EFFECT CLEANUP] useEffect 정리 중`);
            abortController.abort();
        };
    }, [level, location, refreshTrigger]);

    // 오답노트에서 삭제 시 실시간 업데이트
    useEffect(() => {
        const handleWrongAnswersUpdate = () => {
            console.log('🔄 [REAL-TIME UPDATE] Wrong answers updated, triggering refresh...');
            setRefreshTrigger(prev => prev + 1);
        };

        // localStorage 변경 이벤트 리스닝
        const handleStorageChange = (e) => {
            if (e.key === 'wrongAnswersUpdated') {
                handleWrongAnswersUpdate();
            }
        };

        window.addEventListener('storage', handleStorageChange);

        // 같은 탭에서의 변경도 감지 (storage 이벤트는 다른 탭에서만 발생)
        window.addEventListener('wrongAnswersUpdated', handleWrongAnswersUpdate);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('wrongAnswersUpdated', handleWrongAnswersUpdate);
        };
    }, [level]);

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

            if (result && Array.isArray(result) && result.length > 0) {
                setListeningData(result);
            } else {
                setListeningData([]);
                setError(`${level} 레벨 리스닝 데이터가 없습니다.`);
            }
        } catch (err) {
            console.error('Failed to load listening data:', err);
            setError('리스닝 데이터를 불러오는데 실패했습니다.');
            setListeningData([]);
        } finally {
            setLoading(false);
        }
    };

    const loadHistory = async (signal) => {
        try {
            console.log(`🚀🆕 [SIMPLIFIED FETCH START] 단순화된 fetch 시작`);

            const response = await fetch(`http://localhost:4000/api/listening/history/${level}`, {
                credentials: 'include',
                signal: signal
            });

            console.log(`📡🆕 [SIMPLE RESPONSE] Status: ${response.status}, OK: ${response.ok}`);

            if (response.ok) {
                const result = await response.json();
                console.log(`✅🆕 [SIMPLE SUCCESS] 데이터 받음:`, result);

                const historyMap = new Map();
                // API returns { data: { questionId: record } } format
                if (result.data) {
                    Object.entries(result.data).forEach(([questionId, record]) => {
                        // wrongData가 문자열인 경우 JSON 파싱
                        let wrongData = record.wrongData;
                        if (typeof wrongData === 'string') {
                            try {
                                wrongData = JSON.parse(wrongData);
                            } catch (e) {
                                console.error(`❌🆕 [PARSE ERROR] JSON 파싱 실패:`, e);
                                wrongData = {};
                            }
                        } else if (!wrongData) {
                            wrongData = {};
                        }

                        // 통계 정보가 없다면 userAnswer와 correctAnswer로 계산
                        let isCorrect = wrongData?.isCorrect;
                        let lastResult = wrongData?.lastResult;

                        if (isCorrect === undefined && wrongData?.userAnswer && wrongData?.correctAnswer) {
                            isCorrect = wrongData.userAnswer === wrongData.correctAnswer;
                            lastResult = isCorrect ? 'correct' : 'incorrect';
                        }

                        // 기본 통계값 설정
                        const correctCount = wrongData?.correctCount || (isCorrect ? 1 : 0);
                        const incorrectCount = wrongData?.incorrectCount || (isCorrect ? 0 : 1);
                        const totalAttempts = wrongData?.totalAttempts || record.attempts || 1;

                        // wrongData에 계산된 값들 추가
                        const enhancedWrongData = {
                            ...wrongData,
                            isCorrect,
                            lastResult,
                            correctCount,
                            incorrectCount,
                            totalAttempts
                        };

                        historyMap.set(questionId, {
                            ...record,
                            questionId,
                            isCorrect,
                            solvedAt: record.solvedAt || record.wrongAt,
                            wrongData: enhancedWrongData
                        });
                    });
                }
                setHistory(historyMap);
            } else if (response.status === 401) {
                console.log('📝🆕 [비로그인 사용자] 리스닝 기록을 불러올 수 없습니다.');
                setHistory(new Map());
            } else {
                console.error(`❌🆕 [리스닝 기록 로드 실패] (${response.status})`);
                setHistory(new Map());
            }
        } catch (error) {
            console.error('❌🆕 [리스닝 기록 로드 실패] - ERROR DETAILS:', error);

            if (error.name === 'AbortError') {
                console.error('⏰🆕 [TIMEOUT ERROR] 요청이 10초 내에 완료되지 않아 타임아웃됨');
            } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
                console.error('🌐🆕 [NETWORK ERROR] 네트워크 연결 실패 - 서버가 응답하지 않음');
            }

            setHistory(new Map());
        }
    };

    const handleQuestionSelect = (questionIndex, isSelected) => {
        const newSelected = new Set(selectedQuestions);
        if (isSelected) {
            newSelected.add(questionIndex);
        } else {
            newSelected.delete(questionIndex);
        }
        setSelectedQuestions(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedQuestions.size === listeningData.length) {
            setSelectedQuestions(new Set());
        } else {
            setSelectedQuestions(new Set(listeningData.map((_, index) => index)));
        }
    };

    // 오답 문제만 선택
    const handleSelectWrongAnswers = () => {
        const wrongAnswerIndexes = listeningData
            .map((question, index) => {
                const status = getQuestionStatus(question.id);
                return status === 'incorrect' ? index : null;
            })
            .filter(index => index !== null);

        setSelectedQuestions(new Set(wrongAnswerIndexes));
    };

    const handleStartSelectedQuestions = () => {
        if (selectedQuestions.size === 0) {
            alert('학습할 문제를 선택해주세요.');
            return;
        }

        const selectedIndexes = Array.from(selectedQuestions).sort((a, b) => a - b);
        const queryParams = new URLSearchParams({
            level: level,
            questions: selectedIndexes.join(',')
        });

        window.location.href = `/japanese-listening/practice?${queryParams.toString()}`;
    };

    const handleSingleQuestion = (questionIndex) => {
        const queryParams = new URLSearchParams({
            level: level,
            start: questionIndex.toString()
        });

        window.location.href = `/japanese-listening/practice?${queryParams.toString()}`;
    };

    const getQuestionStatus = (questionId) => {
        const record = history.get(questionId);
        if (!record) return 'unsolved';

        // lastResult가 있으면 최신 결과를 사용, 없으면 기존 isCorrect 사용
        const lastResult = record.wrongData?.lastResult;
        if (lastResult) {
            return lastResult === 'correct' ? 'correct' : 'incorrect';
        }

        // 호환성을 위한 fallback
        return record.isCorrect ? 'correct' : 'incorrect';
    };

    const getQuestionDate = (questionId) => {
        const record = history.get(questionId);

        if (!record || !record.solvedAt) {
            return null;
        }

        try {
            // UTC 시간으로 저장되어 있으므로 KST로 변환
            const date = new Date(record.solvedAt);

            if (isNaN(date.getTime())) {
                console.warn(`Invalid date for questionId ${questionId}:`, record.solvedAt);
                return null;
            }

            const formattedDate = date.toLocaleString('ko-KR', {
                timeZone: 'Asia/Seoul',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });

            return formattedDate;
        } catch (error) {
            console.warn(`Date conversion error for questionId ${questionId}:`, error);
            return null;
        }
    };

    const getQuestionStats = (questionId) => {
        const record = history.get(questionId);
        if (!record || !record.wrongData) return null;

        const { correctCount = 0, incorrectCount = 0, totalAttempts = 0 } = record.wrongData;
        return { correctCount, incorrectCount, totalAttempts };
    };

    if (loading) {
        return (
            <main className="container py-4">
                <div className="text-center">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2">일본어 리스닝 데이터를 불러오는 중...</p>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="container py-4">
                <div className="alert alert-warning text-center">
                    <h4>🎌 일본어 리스닝 연습</h4>
                    <p>{error}</p>
                    <small className="text-muted">현재 N1-N5 레벨이 이용 가능합니다.</small>
                </div>
            </main>
        );
    }

    if (listeningData.length === 0) {
        return (
            <main className="container py-4">
                <div className="alert alert-info text-center">
                    <h4>🎌 {level} 일본어 리스닝 연습</h4>
                    <p>리스닝 문제가 없습니다.</p>
                </div>
            </main>
        );
    }

    const correctCount = Array.from(history.values()).filter(record => record.isCorrect).length;
    const totalSolved = history.size;

    return (
        <main className="container py-4">
            {/* Header */}
            <div className="reading-header">
                <div className="reading-title-section">
                    <nav aria-label="breadcrumb">
                        <ol className="breadcrumb">
                            <li className="breadcrumb-item"><Link to="/">홈</Link></li>
                            <li className="breadcrumb-item">
                                <Link to="/japanese-listening">일본어 리스닝</Link>
                            </li>
                            <li className="breadcrumb-item active">{level} 문제 목록</li>
                        </ol>
                    </nav>
                    <h2 className="reading-title">🎌 {level} 일본어 리스닝 문제 목록</h2>
                    <p className="reading-subtitle">
                        총 {listeningData.length}개 문제 | 해결: {correctCount}개 | 시도: {totalSolved}개
                    </p>
                </div>

                {/* Level Selection */}
                <div className="level-selector">
                    <label className="level-label">레벨:</label>
                    <div className="level-buttons">
                        {['N1', 'N2', 'N3', 'N4', 'N5'].map((lv) => (
                            <Link
                                key={lv}
                                to={`/japanese-listening/list?level=${lv}`}
                                className={`level-btn ${level === lv ? 'active' : ''}`}
                            >
                                {lv}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* Selection Controls */}
            <div className="selection-controls">
                <div className="selection-info">
                    <div className="select-all-container">
                        <input
                            type="checkbox"
                            id="selectAll"
                            className="select-all-checkbox"
                            checked={selectedQuestions.size === listeningData.length && listeningData.length > 0}
                            onChange={handleSelectAll}
                        />
                        <label htmlFor="selectAll" className="select-all-label">
                            전체 선택 ({selectedQuestions.size}/{listeningData.length})
                        </label>
                    </div>
                    <button
                        className="btn btn-outline-danger btn-sm ms-3"
                        onClick={handleSelectWrongAnswers}
                        title="빨간색 표시된 오답 문제들만 선택합니다"
                    >
                        ❌ 오답만 선택
                    </button>
                </div>

                {selectedQuestions.size > 0 && (
                    <button
                        className="btn btn-primary start-selected-btn"
                        onClick={handleStartSelectedQuestions}
                    >
                        선택한 {selectedQuestions.size}개 문제 학습하기
                    </button>
                )}
            </div>

            {/* Questions List */}
            <div className="questions-grid">
                {listeningData.map((question, index) => {
                    const status = getQuestionStatus(question.id);
                    const solvedDate = getQuestionDate(question.id);
                    const stats = getQuestionStats(question.id);

                    return (
                        <div key={index} className={`question-card ${status === 'correct' ? 'studied-correct' : status === 'incorrect' ? 'studied-incorrect' : ''}`}>
                            <div className="question-checkbox">
                                <input
                                    type="checkbox"
                                    id={`question-${index}`}
                                    checked={selectedQuestions.has(index)}
                                    onChange={(e) => handleQuestionSelect(index, e.target.checked)}
                                />
                            </div>

                            <div className="question-content">
                                {status !== 'unsolved' && (
                                    <div className="study-status">
                                        <div className="status-badge">
                                            {status === 'correct' ? '✅ 정답' : '❌ 오답'}
                                        </div>
                                        {solvedDate && (
                                            <div className="last-study-date">
                                                📅 마지막 학습: {solvedDate}
                                            </div>
                                        )}
                                        {stats && (
                                            <div className="study-stats">
                                                📊 정답: {stats.correctCount}회, 오답: {stats.incorrectCount}회 (총 {stats.totalAttempts}회)
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="question-header">
                                    <span className="question-number">문제 {index + 1}</span>
                                    <div className="question-meta">
                                        <span className="question-topic">{question.topic || '일본어 리스닝'}</span>
                                    </div>
                                </div>

                                <div className="question-text">
                                    {question.question}
                                </div>

                                <div className="question-preview">
                                    <p className="audio-info">🎵 오디오: {question.id}.mp3</p>
                                    <p className="script-preview">
                                        "{question.script?.slice(0, 80) || '스크립트 미리보기'}..."
                                    </p>
                                </div>

                            </div>

                            <div className="question-actions">
                                <button
                                    className="btn btn-sm btn-outline-primary single-question-btn"
                                    onClick={() => handleSingleQuestion(index)}
                                >
                                    풀어보기
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer Actions */}
            <div className="footer-actions">
                <Link to="/japanese-listening" className="btn btn-outline-secondary">
                    ← 일본어 리스닝 홈으로
                </Link>

                {selectedQuestions.size > 0 && (
                    <button
                        className="btn btn-success"
                        onClick={handleStartSelectedQuestions}
                    >
                        🚀 선택한 문제들 학습 시작
                    </button>
                )}
            </div>
        </main>
    );
}