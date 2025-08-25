import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useLocation } from 'react-router-dom';
import './ReadingList.css';

export default function ListeningList() {
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const level = searchParams.get('level') || 'A1';
    
    const [listeningData, setListeningData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedQuestions, setSelectedQuestions] = useState(new Set());
    const [history, setHistory] = useState(new Map()); // Map<questionId, historyData>

    useEffect(() => {
        loadListeningData();
        loadHistory();
    }, [level, location]); // location 변경 시에도 새로고침

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

    const loadHistory = async () => {
        try {
            const response = await fetch(`http://localhost:4000/api/listening/history/${level}`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const historyData = await response.json();
                console.log(`✅ [리스닝 기록 로드] ${level} 레벨:`, historyData);
                
                const historyMap = new Map();
                historyData.forEach(record => {
                    console.log(`📝 [리스닝 기록] questionId: ${record.questionId}, isCorrect: ${record.isCorrect}, solvedAt: ${record.solvedAt}`);
                    historyMap.set(record.questionId, record);
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
        
        window.location.href = `/listening/practice?${queryParams.toString()}`;
    };

    const handleSingleQuestion = (questionIndex) => {
        const queryParams = new URLSearchParams({
            level: level,
            start: questionIndex.toString()
        });
        
        window.location.href = `/listening/practice?${queryParams.toString()}`;
    };

    const getQuestionStatus = (questionId) => {
        const record = history.get(questionId);
        console.log(`🔍 [상태 확인] questionId: ${questionId}, record:`, record);
        if (!record) return 'unsolved';
        return record.isCorrect ? 'correct' : 'incorrect';
    };

    const getQuestionDate = (questionId) => {
        const record = history.get(questionId);
        if (!record) return null;
        return new Date(record.solvedAt).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
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
                                <Link to="/listening">리스닝</Link>
                            </li>
                            <li className="breadcrumb-item active">{level} 문제 목록</li>
                        </ol>
                    </nav>
                    <h2 className="reading-title">🎧 {level} 리스닝 문제 목록</h2>
                    <p className="reading-subtitle">
                        총 {listeningData.length}개 문제 | 해결: {correctCount}개 | 시도: {totalSolved}개
                    </p>
                </div>

                {/* Level Selection */}
                <div className="level-selector">
                    <label className="level-label">레벨:</label>
                    <div className="level-buttons">
                        {['A1', 'A2', 'B1', 'B2', 'C1'].map((lv) => (
                            <Link
                                key={lv}
                                to={`/listening/list?level=${lv}`}
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
                    
                    return (
                        <div key={index} className={`question-card ${status}`}>
                            <div className="question-checkbox">
                                <input
                                    type="checkbox"
                                    id={`question-${index}`}
                                    checked={selectedQuestions.has(index)}
                                    onChange={(e) => handleQuestionSelect(index, e.target.checked)}
                                />
                            </div>
                            
                            <div className="question-content">
                                <div className="question-header">
                                    <span className="question-number">문제 {index + 1}</span>
                                    <div className="question-meta">
                                        <span className="question-topic">{question.topic || '리스닝'}</span>
                                        {status !== 'unsolved' && (
                                            <span className={`status-badge ${status}`}>
                                                {status === 'correct' ? '✅' : '❌'}
                                            </span>
                                        )}
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
                                
                                {solvedDate && (
                                    <div className="solved-date">
                                        📅 {solvedDate}
                                    </div>
                                )}
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
                <Link to="/listening" className="btn btn-outline-secondary">
                    ← 리스닝 홈으로
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