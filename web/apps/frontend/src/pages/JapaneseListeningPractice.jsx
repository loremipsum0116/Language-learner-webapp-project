import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import WordMeaningPopup from '../components/WordMeaningPopup';
import './Reading.css';

export default function JapaneseListeningPractice() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const level = searchParams.get('level') || 'N5';
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
    const [history, setHistory] = useState(new Map());

    // 단어 뜻 팝업 관련 상태
    const [jlptWords, setJlptWords] = useState({});
    const [selectedWord, setSelectedWord] = useState(null);
    const [wordPopupPosition, setWordPopupPosition] = useState({ x: 0, y: 0 });
    const [showTranslation, setShowTranslation] = useState(false);

    useEffect(() => {
        loadListeningData();
        loadHistory();
        loadJlptWords();
    }, [level, startIndex]);

    // JLPT 단어 데이터 로드
    const loadJlptWords = async () => {
        try {
            const wordsByKana = {};
            const levels = ['N1', 'N2', 'N3', 'N4', 'N5'];

            for (const levelName of levels) {
                const response = await fetch(`/jlpt/${levelName}.json`);
                if (response.ok) {
                    const words = await response.json();
                    words.forEach(word => {
                        // kana를 키로 사용하여 단어들을 그룹화
                        if (word.kana) {
                            if (!wordsByKana[word.kana]) {
                                wordsByKana[word.kana] = [];
                            }
                            wordsByKana[word.kana].push(word);
                        }
                    });
                }
            }

            setJlptWords(wordsByKana);
            const totalWords = Object.values(wordsByKana).flat().length;
            const uniqueKana = Object.keys(wordsByKana).length;
            console.log(`JLPT 단어 ${totalWords}개 (${uniqueKana}개 읽기) 로드 완료`);
        } catch (error) {
            console.error('JLPT 단어 로드 실패:', error);
        }
    };

    // 일본어와 한글을 분리하는 함수
    const separateJapaneseKorean = (text) => {
        if (!text) return { japanese: '', korean: '' };

        // 괄호 안의 내용 찾기: (내용)
        const koreanMatches = text.match(/\([^)]+\)/g);
        let japanese = text;
        let korean = '';

        if (koreanMatches) {
            // 괄호 안의 내용 중 한글이 포함된 것만 필터링
            const koreanParts = koreanMatches
                .map(match => match.replace(/[()]/g, ''))
                .filter(content => /[가-힣]/.test(content));

            if (koreanParts.length > 0) {
                korean = koreanParts.join(' ');
                // 괄호와 그 안의 내용을 모두 제거하여 일본어만 추출
                japanese = text.replace(/\([^)]+\)/g, '').trim();
            }
        }

        return { japanese: japanese.trim(), korean: korean.trim() };
    };

    // 한글 번역만 표시하는 함수
    const renderKoreanTranslation = (text) => {
        if (!text) return null;
        const { korean } = separateJapaneseKorean(text);
        return korean || null;
    };

    // 단어 클릭 핸들러
    const handleWordClick = (kana, event) => {
        event.stopPropagation();

        const wordDataArray = jlptWords[kana];
        if (wordDataArray && wordDataArray.length > 0) {
            setSelectedWord({ kana, dataArray: wordDataArray });
            setWordPopupPosition({
                x: event.clientX,
                y: event.clientY
            });
        }
    };

    // 팝업 닫기
    const closeWordPopup = () => {
        setSelectedWord(null);
    };

    // 일본어 텍스트를 단어별로 분리하고 클릭 가능하게 만드는 함수
    const renderClickableText = (text) => {
        if (!text) return '';

        const parts = [];
        let lastIndex = 0;

        // 전체 텍스트를 문자 단위로 처리
        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            // 일본어 문자인지 확인 (히라가나, 가타카나, 한자)
            if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(char)) {
                // 이전까지의 비일본어 텍스트 추가
                if (i > lastIndex) {
                    parts.push(text.slice(lastIndex, i));
                }

                // 현재 위치에서 가능한 가장 긴 매칭 단어 찾기
                let bestMatch = null;
                let bestLength = 0;

                // 1글자부터 최대 10글자까지 확인 (일본어 단어 길이 고려)
                for (let len = 1; len <= Math.min(10, text.length - i); len++) {
                    const candidate = text.slice(i, i + len);

                    // 일본어 문자가 아닌 것이 포함되면 중단
                    if (!/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/.test(candidate)) {
                        break;
                    }

                    // JLPT 단어에 매칭되는지 확인
                    if (jlptWords[candidate] && jlptWords[candidate].length > 0) {
                        bestMatch = candidate;
                        bestLength = len;
                    }
                }

                if (bestMatch) {
                    // 매칭된 단어를 클릭 가능하게 처리
                    const wordDataArray = jlptWords[bestMatch];
                    parts.push(
                        <span
                            key={`${bestMatch}-${i}`}
                            onClick={(e) => handleWordClick(bestMatch, e)}
                            style={{
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                textDecorationStyle: 'dotted'
                            }}
                            title={`클릭하여 '${bestMatch}' 뜻 보기 (${wordDataArray.length}개 의미)`}
                        >
                            {bestMatch}
                        </span>
                    );
                    i += bestLength - 1; // 매칭된 길이만큼 인덱스 증가 (for문에서 i++가 되므로 -1)
                    lastIndex = i + 1;
                } else {
                    // 매칭되지 않는 단일 문자는 그대로 추가
                    parts.push(char);
                    lastIndex = i + 1;
                }
            }
        }

        // 남은 텍스트 추가
        if (lastIndex < text.length) {
            parts.push(text.slice(lastIndex));
        }

        return parts;
    };

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
            setError('일본어 리스닝 데이터를 불러오는데 실패했습니다.');
            setListeningData([]);
        } finally {
            setLoading(false);
        }
    };

    // 사용자 일본어 리스닝 학습 기록 로드
    const loadHistory = async () => {
        try {
            const response = await fetch(`https://clever-elegance-production.up.railway.app/api/japanese-listening/history/${level}`, {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const result = await response.json();
                const historyData = result.data ? Object.values(result.data) : [];
                console.log(`✅ [일본어 리스닝 기록 로드] ${level} 레벨:`, historyData);

                const historyMap = new Map();
                historyData.forEach(record => {
                    const questionId = record.wrongData?.questionId;
                    if (questionId) {
                        const isCorrect = record.wrongData?.isCorrect || record.isCompleted;

                        historyMap.set(String(questionId), {
                            questionId: questionId,
                            isCorrect: isCorrect,
                            solvedAt: record.wrongData?.recordedAt,
                            isCompleted: record.isCompleted,
                            attempts: record.attempts,
                            wrongData: record.wrongData
                        });
                    }
                });

                console.log(`🗺️ [히스토리 맵 생성 완료] 총 ${historyMap.size}개 기록`);
                setHistory(historyMap);
            } else if (response.status === 401) {
                console.log('📝 [비로그인 사용자] 일본어 리스닝 기록을 불러올 수 없습니다.');
                setHistory(new Map());
            } else {
                console.error(`❌ 일본어 리스닝 기록 로드 실패 (${response.status})`);
                setHistory(new Map());
            }
        } catch (error) {
            console.error('❌ 일본어 리스닝 기록 로드 실패:', error);
            setHistory(new Map());
        }
    };

    // 문제 상태 확인 헬퍼 함수들
    const getQuestionStatus = (questionId) => {
        const record = history.get(String(questionId));
        console.log(`🔍 getQuestionStatus for '${questionId}':`, record);
        if (!record) return 'unsolved';

        const isCorrect = record.isCorrect || record.wrongData?.isCorrect || record.isCompleted;
        return isCorrect ? 'correct' : 'incorrect';
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
            setIsPlaying(true);
        };

        const handleEnded = () => {
            setIsPlaying(false);
        };

        const handleError = (e) => {
            if (e.target.networkState !== e.target.NETWORK_NO_SOURCE) {
                console.error('❌ Audio playback error:', e);
                setIsPlaying(false);
                alert(`오디오를 재생할 수 없습니다: ${audioPath}`);
            }
        };

        audio.addEventListener('loadstart', handleLoadStart);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError);

        // 이벤트 리스너 정리를 위해 오디오 객체에 핸들러 저장
        audio._handlers = {
            loadstart: handleLoadStart,
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
                audio.removeEventListener('ended', audio._handlers.ended);
                audio.removeEventListener('error', audio._handlers.error);
            }
            audio.pause();
            audio.src = '';
        }
    };

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

        // JSON에서는 'answer' 필드를 사용
        const correctAnswer = current.correctAnswer || current.answer;
        const correct = String(selectedAnswer).trim() === String(correctAnswer).trim();
        setIsCorrect(correct);

        console.log('Debug - Selected Answer:', selectedAnswer, 'Correct Answer:', correctAnswer, 'Result:', correct);

        // 정답/오답 모두 기록 저장 (로그인된 사용자만)
        const requestData = {
            questionId: current.id,
            level: level,
            isCorrect: correct,
            userAnswer: selectedAnswer,
            correctAnswer: correctAnswer,
            question: current.question,
            script: current.script,
            topic: current.topic,
            options: current.options
        };

        try {
            const response = await fetch('https://clever-elegance-production.up.railway.app/api/japanese-listening/record', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });

            if (response.ok) {
                console.log(`✅ [일본어 리스닝 기록 저장 완료] ${level} - Question ${current.id} - ${correct ? '정답' : '오답'}`);

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
                console.log('📝 [비로그인 사용자] 일본어 리스닝 기록은 로그인 후 저장됩니다.');
            } else {
                const errorText = await response.text();
                console.error(`❌ 일본어 리스닝 기록 저장 실패 (${response.status}):`, errorText);
            }
        } catch (error) {
            console.error('❌ 일본어 리스닝 기록 저장 실패:', error);
        }

        if (correct && !completedQuestions.has(currentQuestion)) {
            setScore(score + 1);
            setCompletedQuestions(prev => new Set([...prev, currentQuestion]));
            console.log(`✅ [일본어 리스닝 정답] ${level} - 문제 ${currentQuestion + 1} - 정답: ${correctAnswer}`);
        }


        setIsSubmitting(false);
        setShowExplanation(true);
        setShowTranslation(true); // 문제 풀이 후 자동으로 번역 표시
        setShowScript(true); // 정답 확인 후 스크립트 자동 표시
    };

    const handleNext = () => {
        if (currentQuestion < listeningData.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
            setSelectedAnswer(null);
            setShowExplanation(false);
            setIsCorrect(false);
            setShowScript(false);
            setShowTranslation(false);
            setIsSubmitting(false);

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
            setShowScript(false);
            setShowTranslation(false);
            setIsSubmitting(false);

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
        setShowScript(false);
        setShowTranslation(false);

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
                    <p>일본어 리스닝 문제가 없습니다.</p>
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
                            onClick={() => navigate(`/japanese-listening/list?level=${level}`)}
                            title="문제 목록으로 돌아가기"
                        >
                            ← 뒤로가기
                        </button>
                        <h2 className="reading-title">🎌 {level} 일본어 리스닝 연습</h2>
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
                                <p className="audio-topic">
                                    주제: {current.topic}
                                    {showExplanation && current.topic_ko && (
                                        <span className="text-muted ms-2">({current.topic_ko})</span>
                                    )}
                                </p>
                            )}
                        </div>

                        {/* 스크립트 드롭다운 */}
                        {showScript && current.script && (
                            <div className="script-dropdown">
                                <div className="script-content">
                                    <h6>📝 스크립트:</h6>
                                    <div className="script-text">
                                        {current.script.split(/([A-Z]:\s)/).map((part, index) => {
                                            if (part.match(/^[A-Z]:\s$/)) {
                                                // 발화자 표시 (A:, B:, C: 등)
                                                return (
                                                    <div key={index} className="mt-3 mb-1">
                                                        <strong style={{ color: '#0d6efd' }}>{part}</strong>
                                                    </div>
                                                );
                                            } else if (part.trim()) {
                                                // 발화 내용 - 클릭 가능한 단어로 렌더링
                                                return (
                                                    <div key={index} style={{ marginLeft: '1rem', marginBottom: '0.5rem' }}>
                                                        <em>{renderClickableText(part.trim())}</em>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })}
                                    </div>
                                    {showExplanation && current.script_ko && (
                                        <div className="translation-text" style={{
                                            marginTop: '8px',
                                            padding: '8px',
                                            backgroundColor: '#e8f4f8',
                                            borderLeft: '4px solid #17a2b8',
                                            fontSize: '14px',
                                            color: '#0c5460'
                                        }}>
                                            <h6 style={{ marginBottom: '10px', color: '#0c5460' }}>📄 번역:</h6>
                                            <div>
                                                {(() => {
                                                    // 스크립트의 화자(A:, B:, C: 등) 추출
                                                    const speakers = (current.script.match(/[A-Z]:\s/g) || []).map(s => s.trim());
                                                    // 번역문을 슬래시로 분리
                                                    const translations = current.script_ko.split('/').map(t => t.trim()).filter(t => t);

                                                    return translations.map((translation, index) => (
                                                        <div key={index} style={{ marginBottom: '8px' }}>
                                                            {speakers[index] && (
                                                                <strong style={{ color: '#17a2b8' }}>{speakers[index]}</strong>
                                                            )}
                                                            <span style={{
                                                                marginLeft: speakers[index] ? '1rem' : '0',
                                                                display: speakers[index] ? 'inline-block' : 'block',
                                                                paddingTop: '2px'
                                                            }}>
                                                                {translation}
                                                            </span>
                                                        </div>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="question-section">
                        <h5 className="question-title">❓ 문제</h5>
                        <p className="question-text">
                            {renderClickableText(current.question)}
                        </p>
                        {showExplanation && current.question_ko && (
                            <div className="translation-text" style={{
                                marginTop: '8px',
                                padding: '8px',
                                backgroundColor: '#e8f4f8',
                                borderLeft: '4px solid #17a2b8',
                                fontSize: '14px',
                                color: '#0c5460'
                            }}>
                                <strong>번역:</strong> {current.question_ko}
                            </div>
                        )}

                        <div className="options-grid">
                            {Object.entries(current.options).map(([key, value]) => (
                                <div
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
                                    onClick={!showExplanation ? () => handleAnswerSelect(key) : undefined}
                                    style={{
                                        fontSize: '1.2rem',
                                        fontWeight: 'bold',
                                        padding: '1rem',
                                        textAlign: 'left',
                                        cursor: !showExplanation ? 'pointer' : 'default',
                                        border: '1px solid #ccc',
                                        borderRadius: '8px',
                                        marginBottom: '8px',
                                        backgroundColor: showExplanation
                                            ? key === (current.correctAnswer || current.answer)
                                                ? '#d4edda'
                                                : selectedAnswer === key
                                                    ? '#f8d7da'
                                                    : '#f8f9fa'
                                            : selectedAnswer === key
                                                ? '#e3f2fd'
                                                : '#fff'
                                    }}
                                >
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: showExplanation ? '8px' : '0' }}>
                                            <span className="option-letter" style={{ marginRight: '10px' }}>{key}.</span>
                                            {showExplanation && (
                                                <span className="option-text">
                                                    {renderClickableText(value)}
                                                </span>
                                            )}
                                        </div>
                                        {showExplanation && current.options_ko && current.options_ko[key] && (
                                            <div style={{
                                                fontSize: '14px',
                                                color: '#0c5460',
                                                backgroundColor: '#e8f4f8',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                marginLeft: '30px'
                                            }}>
                                                {current.options_ko[key]}
                                            </div>
                                        )}
                                    </div>
                                </div>
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

            {/* 단어 뜻 팝업 */}
            {selectedWord && (
                <WordMeaningPopup
                    kana={selectedWord.kana}
                    wordDataArray={selectedWord.dataArray}
                    position={wordPopupPosition}
                    onClose={closeWordPopup}
                />
            )}
        </main>
    );
}