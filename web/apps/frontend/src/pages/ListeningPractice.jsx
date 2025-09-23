import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import './Reading.css';
import EnglishWordPopup from '../components/EnglishWordPopup';

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
    const [englishDict, setEnglishDict] = useState(new Map()); // 영어 사전
    const [selectedWord, setSelectedWord] = useState(null);
    const [wordPopupPosition, setWordPopupPosition] = useState(null);
    const [showTranslation, setShowTranslation] = useState(false);

    useEffect(() => {
        loadListeningData();
        loadHistory();
        loadEnglishDictionary();
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

    // 단어 클릭 핸들러 (동음이의어 지원)
    const handleWordClick = (word, event) => {
        event.preventDefault();
        event.stopPropagation();

        const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
        const wordDataArray = englishDict.get(cleanWord);

        if (wordDataArray && wordDataArray.length > 0) {
            setSelectedWord({
                word: cleanWord,
                definitions: wordDataArray
            });
            setWordPopupPosition({ x: event.clientX, y: event.clientY });
        }
    };

    // 팝업 닫기
    const closeWordPopup = () => {
        setSelectedWord(null);
        setWordPopupPosition(null);
    };

    // 영어와 한글을 분리하는 함수
    const separateEnglishKorean = (text) => {
        if (!text) return { english: '', korean: '' };

        // 괄호 안의 내용 찾기: (내용)
        const koreanMatches = text.match(/\([^)]+\)/g);
        let english = text;
        let korean = '';

        if (koreanMatches) {
            // 괄호 안의 내용 중 한글이 포함된 것만 필터링
            const koreanParts = koreanMatches
                .map(match => match.replace(/[()]/g, ''))
                .filter(content => /[가-힣]/.test(content));

            if (koreanParts.length > 0) {
                korean = koreanParts.join(' ');
                // 괄호와 그 안의 내용을 모두 제거하여 영어만 추출
                english = text.replace(/\([^)]+\)/g, '').trim();
            }
        }
        return { english: english.trim(), korean: korean.trim() };
    };

    // 텍스트를 클릭 가능한 단어들로 분할하는 함수
    const renderClickableText = (text, className = "", showOnlyEnglish = false) => {
        if (!text) return null;

        // 영어와 한글 분리
        const { english, korean } = separateEnglishKorean(text);
        const textToRender = showOnlyEnglish ? english : text;


        return textToRender.split(/(\w+)/).map((part, index) => {
            const cleanPart = part.toLowerCase().replace(/[^a-z]/g, '');
            const isWord = /^[a-zA-Z]+$/.test(part);
            const wordDataArray = englishDict.get(cleanPart);
            const hasTranslation = isWord && wordDataArray && wordDataArray.length > 0;

            if (hasTranslation) {
                return (
                    <span
                        key={index}
                        className={`clickable-word ${className}`}
                        onClick={(e) => handleWordClick(part, e)}
                        style={{
                            textDecoration: 'underline dotted',
                            cursor: 'pointer',
                            color: 'inherit',
                            fontWeight: '500'
                        }}
                        title="클릭하여 뜻 보기"
                    >
                        {part}
                    </span>
                );
            }
            return <span key={index}>{part}</span>;
        });
    };

    // 한글 번역만 표시하는 함수
    const renderKoreanTranslation = (text) => {
        if (!text) return null;
        const { korean } = separateEnglishKorean(text);
        return korean || null;
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

                // 백엔드에서 최신 데이터 다시 가져오기
                try {
                    const historyResponse = await fetch(`http://localhost:4000/api/listening/history/${level}`, {
                        method: 'GET',
                        credentials: 'include'
                    });

                    if (historyResponse.ok) {
                        const historyResult = await historyResponse.json();
                        console.log('🔄 [실시간 히스토리 업데이트] 최신 데이터:', historyResult);

                        const historyMap = new Map();
                        if (historyResult.data) {
                            Object.entries(historyResult.data).forEach(([questionId, record]) => {
                                let wrongData = record.wrongData;
                                if (typeof wrongData === 'string') {
                                    try {
                                        wrongData = JSON.parse(wrongData);
                                    } catch (e) {
                                        wrongData = {};
                                    }
                                }

                                historyMap.set(questionId, {
                                    ...record,
                                    questionId,
                                    wrongData: wrongData
                                });
                            });
                        }
                        setHistory(historyMap);
                        console.log('✅ [히스토리 즉시 업데이트 완료]', historyMap.size, '개 기록');
                    }
                } catch (historyError) {
                    console.warn('히스토리 즉시 업데이트 실패:', historyError);

                    // 폴백: UI 상태만 업데이트
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
                }

                // 모든 브라우저 스토리지 및 이벤트를 통한 강력한 업데이트 신호
                try {
                    const timestamp = Date.now().toString();

                    // 모든 스토리지에 저장
                    localStorage.setItem('wrongAnswersUpdated', timestamp);
                    localStorage.setItem('listeningRecordUpdated', timestamp);
                    localStorage.setItem('forceListeningRefresh', timestamp);
                    sessionStorage.setItem('needsRefresh', 'true');
                    sessionStorage.setItem('lastUpdated', timestamp);
                    sessionStorage.setItem('listeningUpdated', timestamp);

                    // 모든 이벤트 발생
                    window.dispatchEvent(new CustomEvent('wrongAnswersUpdated', { detail: { timestamp } }));
                    window.dispatchEvent(new CustomEvent('listeningRecordUpdated', { detail: { timestamp } }));
                    window.dispatchEvent(new CustomEvent('forceListeningRefresh', { detail: { timestamp } }));

                    console.log('🚀 [강제 업데이트 신호 전송 완료]', timestamp);
                } catch (e) {
                    console.warn('Storage update failed:', e);
                }
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
        setShowTranslation(true); // 문제 풀이 후 자동으로 번역 표시
        setShowScript(true); // 정답 확인 후 스크립트 자동 표시
    };

    const handleNext = () => {
        if (currentQuestion < listeningData.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
            setSelectedAnswer(null);
            setShowExplanation(false);
            setIsCorrect(false);
            setShowScript(false); // 스크립트 숨기기
            setIsSubmitting(false); // 제출 상태 리셋
            setShowTranslation(false); // 번역 숨기기
            
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
            setShowTranslation(false); // 번역 숨기기
            
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
        setShowTranslation(false); // 번역 숨기기

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
                            onClick={() => {
                                // 즉각 반영을 위한 다중 이벤트 발송
                                const updateData = {
                                    level: level,
                                    timestamp: Date.now()
                                };

                                localStorage.setItem('englishListeningInstantUpdate', JSON.stringify(updateData));
                                localStorage.setItem('wrongAnswersUpdated', updateData.timestamp.toString());
                                localStorage.setItem('listeningRecordUpdated', updateData.timestamp.toString());
                                localStorage.setItem('forceListeningRefresh', updateData.timestamp.toString());
                                sessionStorage.setItem('needsRefresh', 'true');

                                // Storage 이벤트 발송
                                window.dispatchEvent(new StorageEvent('storage', {
                                    key: 'englishListeningInstantUpdate',
                                    newValue: JSON.stringify(updateData)
                                }));
                                window.dispatchEvent(new StorageEvent('storage', {
                                    key: 'wrongAnswersUpdated',
                                    newValue: updateData.timestamp.toString()
                                }));
                                window.dispatchEvent(new StorageEvent('storage', {
                                    key: 'listeningRecordUpdated',
                                    newValue: updateData.timestamp.toString()
                                }));

                                // 리딩과 동일한 방식으로 이동
                                navigate(`/listening/list?level=${level}`);
                            }}
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
                                    <div className="script-text">
                                        {(() => {
                                            // 영어 스크립트를 화자별로 분리하여 표시
                                            const scriptParts = current.script.split(/(\s[A-Z]:\s)/).filter(part => part.trim());
                                            const formattedParts = [];

                                            for (let i = 0; i < scriptParts.length; i++) {
                                                const part = scriptParts[i].trim();
                                                if (part.match(/^[A-Z]:\s$/)) {
                                                    // 화자 표시 (A:, B:, C: 등)
                                                    formattedParts.push(
                                                        <div key={i} className="mt-3 mb-1">
                                                            <strong style={{ color: '#0d6efd' }}>{part}</strong>
                                                        </div>
                                                    );
                                                } else if (part.includes(':') && part.match(/^[A-Z]:/)) {
                                                    // 첫 번째 화자 (A: content 형태)
                                                    const [speaker, ...content] = part.split(':');
                                                    formattedParts.push(
                                                        <div key={i} className="mt-3 mb-1">
                                                            <strong style={{ color: '#0d6efd' }}>{speaker}:</strong>
                                                        </div>
                                                    );
                                                    if (content.join(':').trim()) {
                                                        formattedParts.push(
                                                            <div key={`${i}_content`} style={{ marginLeft: '1rem', marginBottom: '0.5rem' }}>
                                                                <em>{renderClickableText(content.join(':').trim(), "", true)}</em>
                                                            </div>
                                                        );
                                                    }
                                                } else if (part.trim()) {
                                                    // 발화 내용
                                                    formattedParts.push(
                                                        <div key={i} style={{ marginLeft: '1rem', marginBottom: '0.5rem' }}>
                                                            <em>{renderClickableText(part.trim(), "", true)}</em>
                                                        </div>
                                                    );
                                                }
                                            }

                                            return formattedParts.length > 0 ? formattedParts : renderClickableText(current.script, "", true);
                                        })()}
                                    </div>
                                    {showTranslation && renderKoreanTranslation(current.script) && (
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
                                                    // 스크립트에서 화자별로 분리된 번역 추출
                                                    const scriptParts = current.script.split(/([A-Z]:\s)/).filter(part => part.trim());
                                                    const result = [];

                                                    for (let i = 0; i < scriptParts.length; i++) {
                                                        const part = scriptParts[i].trim();

                                                        if (part.match(/^[A-Z]:\s?$/)) {
                                                            // 화자 표시 (A:, B:, C: 등)
                                                            const nextPart = scriptParts[i + 1];
                                                            if (nextPart) {
                                                                // 괄호 안의 한국어 번역 추출
                                                                const koreanMatch = nextPart.match(/\(([^)]+)\)/g);
                                                                if (koreanMatch) {
                                                                    // 모든 괄호 안의 내용을 연결
                                                                    const koreanText = koreanMatch
                                                                        .map(match => match.replace(/[()]/g, ''))
                                                                        .join(' ');

                                                                    result.push(
                                                                        <div key={i} style={{ marginBottom: '8px' }}>
                                                                            <strong style={{ color: '#17a2b8' }}>{part}</strong>
                                                                            <span style={{
                                                                                marginLeft: '1rem',
                                                                                display: 'inline-block',
                                                                                paddingTop: '2px'
                                                                            }}>
                                                                                {koreanText}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                }
                                                            }
                                                        }
                                                    }

                                                    // 결과가 없으면 기존 방식 사용
                                                    if (result.length === 0) {
                                                        const koreanText = renderKoreanTranslation(current.script);
                                                        return koreanText ? <span>{koreanText}</span> : null;
                                                    }

                                                    return result;
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
                            {renderClickableText(current.question, "", true)}
                        </p>
                        {showTranslation && renderKoreanTranslation(current.question) && (
                            <div className="translation-text" style={{
                                marginTop: '8px',
                                padding: '8px',
                                backgroundColor: '#e8f4f8',
                                borderLeft: '4px solid #17a2b8',
                                fontSize: '14px',
                                color: '#0c5460'
                            }}>
                                <strong>번역:</strong> {renderKoreanTranslation(current.question)}
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
                                                    {renderClickableText(value, "", true)}
                                                </span>
                                            )}
                                        </div>
                                        {showExplanation && renderKoreanTranslation(value) && (
                                            <div style={{
                                                fontSize: '14px',
                                                color: '#0c5460',
                                                backgroundColor: '#e8f4f8',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                marginLeft: '30px'
                                            }}>
                                                {renderKoreanTranslation(value)}
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

            {/* 영어 단어 팝업 */}
            {selectedWord && wordPopupPosition && (
                <EnglishWordPopup
                    word={selectedWord.word}
                    definitions={selectedWord.definitions}
                    position={wordPopupPosition}
                    onClose={closeWordPopup}
                />
            )}
        </main>
    );
}