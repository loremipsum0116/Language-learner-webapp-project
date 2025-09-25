import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetchJSON, withCreds } from '../api/client';
import WordMeaningPopup from '../components/WordMeaningPopup';
import './Reading.css';

export default function JapaneseReading() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const level = searchParams.get('level') || 'N3';
    const startIndex = parseInt(searchParams.get('start')) || 0;
    const selectedQuestions = searchParams.get('questions')?.split(',').map(Number) || null;

    const [readingData, setReadingData] = useState([]);
    const [currentPassage, setCurrentPassage] = useState(startIndex);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [selectedAnswers, setSelectedAnswers] = useState({}); // 복수 문제용 (questionId: answer)
    const [showExplanation, setShowExplanation] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [score, setScore] = useState(0);
    const [completedQuestions, setCompletedQuestions] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [jlptWords, setJlptWords] = useState({});
    const [selectedWord, setSelectedWord] = useState(null);
    const [wordPopupPosition, setWordPopupPosition] = useState({ x: 0, y: 0 });
    const [showTranslation, setShowTranslation] = useState(false);
    const [translationData, setTranslationData] = useState(new Map());
    const [translationByIndex, setTranslationByIndex] = useState([]);

    useEffect(() => {
        loadReadingData();
        loadJlptWords();
        loadTranslationData();
    }, [level, startIndex]);

    // JLPT 단어 데이터 로드 (lemma + kana 기준)
    const loadJlptWords = async () => {
        try {
            const wordsDict = {};
            const levels = ['N1', 'N2', 'N3', 'N4', 'N5'];

            for (const levelName of levels) {
                const response = await fetch(`/jlpt/${levelName}.json`);
                if (response.ok) {
                    const words = await response.json();
                    words.forEach(word => {
                        // lemma(한자)로 매핑
                        if (word.lemma) {
                            if (!wordsDict[word.lemma]) {
                                wordsDict[word.lemma] = [];
                            }
                            wordsDict[word.lemma].push(word);
                        }

                        // kana(히라가나)로 매핑
                        if (word.kana && word.kana !== word.lemma) {
                            if (!wordsDict[word.kana]) {
                                wordsDict[word.kana] = [];
                            }
                            wordsDict[word.kana].push(word);
                        }
                    });
                }
            }

            setJlptWords(wordsDict);
            console.log(`✅ JLPT 단어 로드 완료 (lemma + kana 기준):`, Object.keys(wordsDict).length, '개 단어');
            console.log('🔍 샘플 단어들:', Object.keys(wordsDict).slice(0, 10));
        } catch (error) {
            console.error('❌ JLPT 단어 로드 실패:', error);
        }
    };

    // 단어 클릭 핸들러
    const handleWordClick = (word, event) => {
        console.log('🔍 Word clicked:', word);
        console.log('🔍 selectedWord state before:', selectedWord);

        if (jlptWords[word] && jlptWords[word].length > 0) {
            console.log('✅ Setting popup for word:', word, jlptWords[word][0]);
            setSelectedWord(jlptWords[word][0]);
            setWordPopupPosition({
                x: event.clientX,
                y: event.clientY - 10
            });
            console.log('✅ Popup position set:', { x: event.clientX, y: event.clientY - 10 });
        } else {
            console.log('❌ No definition found for:', word);
        }
    };


    // 일본어 텍스트를 클릭 가능한 단어로 분리 (Ruby 태그와 슬래시 기반 문단 구분)
    const makeClickableText = (text) => {
        if (!text) return null;

        // Ruby 태그를 먼저 처리하여 올바르게 렌더링
        const processRubyTags = (text) => {
            // 다양한 형태의 ruby 태그 패턴을 처리
            // Pattern 1: <ruby>漢字ひらがな<rt>ひらがな<rt><ruby>
            // Pattern 2: <ruby>漢字ひらがな<rt>ひらがな<rt></ruby>
            const rubyRegex = /<ruby>([^<]+)<rt>([^<]+)<rt>(?:<\/ruby>|<ruby>)/g;
            const parts = [];
            let lastIndex = 0;
            let match;

            while ((match = rubyRegex.exec(text)) !== null) {
                // Ruby 태그 앞의 텍스트 추가
                if (match.index > lastIndex) {
                    parts.push({
                        type: 'text',
                        content: text.slice(lastIndex, match.index)
                    });
                }

                // Ruby 태그 추가
                const fullText = match[1];  // 예: "学生がくせい"
                const furiganaText = match[2]; // 예: "がくせい"

                // 한자 부분만 추출 ("学生がくせい"에서 "学生"만)
                const kanjiMatch = fullText.match(/^([一-龯]+)/);
                const cleanKanji = kanjiMatch ? kanjiMatch[1] : fullText;
                const cleanFurigana = furiganaText;

                parts.push({
                    type: 'ruby',
                    kanji: cleanKanji,
                    furigana: cleanFurigana
                });

                lastIndex = match.index + match[0].length;
            }

            // 나머지 텍스트 추가
            if (lastIndex < text.length) {
                parts.push({
                    type: 'text',
                    content: text.slice(lastIndex)
                });
            }

            return parts;
        };

        // 슬래시를 기준으로 문단 분리
        const paragraphs = text.split('/');

        return (
            <div>
                {paragraphs.map((paragraph, paragraphIndex) => {
                    if (!paragraph.trim()) return null;

                    const rubyParts = processRubyTags(paragraph);

                    return (
                        <div key={paragraphIndex} style={{
                            marginBottom: paragraphIndex < paragraphs.length - 1 ? '16px' : '0',
                            lineHeight: '1.8'
                        }}>
                            {rubyParts.map((part, partIndex) => {
                                if (part.type === 'ruby') {
                                    return (
                                        <ruby key={partIndex} style={{ cursor: 'pointer' }}
                                            onClick={(e) => handleWordClick(part.kanji, e)}>
                                            {part.kanji}
                                            <rt style={{ fontSize: '0.6em' }}>{part.furigana}</rt>
                                        </ruby>
                                    );
                                } else {
                                    // 일반 텍스트를 단어별로 분리
                                    const parseJapaneseText = (text) => {
                                        const result = [];
                                        let i = 0;

                                        while (i < text.length) {
                                            // 공백이나 구두점 처리
                                            if (/[\s、。！？]/.test(text[i])) {
                                                result.push({ text: text[i], type: 'punctuation' });
                                                i++;
                                                continue;
                                            }

                                            // 가장 긴 매칭 단어 찾기 (최대 10글자)
                                            let bestMatch = null;
                                            let bestLength = 0;

                                            for (let len = Math.min(10, text.length - i); len >= 1; len--) {
                                                const possibleWord = text.substring(i, i + len);
                                                if (jlptWords[possibleWord] && jlptWords[possibleWord].length > 0) {
                                                    bestMatch = possibleWord;
                                                    bestLength = len;
                                                    break; // 가장 긴 매칭을 찾았으므로 중단
                                                }
                                            }

                                            if (bestMatch) {
                                                result.push({ text: bestMatch, type: 'word', hasDefinition: true });
                                                i += bestLength;
                                            } else {
                                                result.push({ text: text[i], type: 'char' });
                                                i++;
                                            }
                                        }

                                        return result;
                                    };

                                    const tokens = parseJapaneseText(part.content);

                                    return tokens.map((token, tokenIndex) => {
                                        if (token.type === 'word' && token.hasDefinition) {
                                            // JLPT 단어 데이터에서 kana 정보 가져오기
                                            const wordData = jlptWords[token.text] && jlptWords[token.text][0];
                                            const hasKanji = /[\u4e00-\u9faf]/.test(token.text); // 한자 포함 여부 확인
                                            const furigana = wordData && hasKanji ? wordData.kana : null;

                                            return (
                                                <span
                                                    key={`${partIndex}-${tokenIndex}`}
                                                    onClick={(e) => handleWordClick(token.text, e)}
                                                    style={{
                                                        cursor: 'pointer',
                                                        textDecoration: 'underline dotted',
                                                        color: 'inherit',
                                                        position: 'relative',
                                                        display: 'inline-block'
                                                    }}
                                                    className="kanji-hover"
                                                >
                                                    {token.text}
                                                    {furigana && (
                                                        <span
                                                            style={{
                                                                position: 'absolute',
                                                                top: '-20px',
                                                                left: '50%',
                                                                transform: 'translateX(-50%)',
                                                                fontSize: '10px',
                                                                color: '#666',
                                                                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                                                padding: '2px 4px',
                                                                borderRadius: '3px',
                                                                border: '1px solid #ddd',
                                                                whiteSpace: 'nowrap',
                                                                opacity: '0',
                                                                transition: 'opacity 0.2s ease',
                                                                pointerEvents: 'none',
                                                                zIndex: '1000'
                                                            }}
                                                            className="furigana-tooltip"
                                                        >
                                                            {furigana}
                                                        </span>
                                                    )}
                                                </span>
                                            );
                                        } else {
                                            return <span key={`${partIndex}-${tokenIndex}`}>{token.text}</span>;
                                        }
                                    });
                                }
                            })}
                        </div>
                    );
                })}
            </div>
        );
    };

    // 번역 데이터 로드
    const loadTranslationData = async () => {
        try {
            // 프론트엔드 public 폴더의 번역 파일 접근 (일본어 경로)
            const response = await fetch(`/${level}_Reading/${level}_Reading_Translation.json`);
            if (response.ok) {
                const translations = await response.json();
                const translationMap = new Map();
                const translationArray = [];
                translations.forEach((item, index) => {
                    // 번역 데이터의 id(숫자)를 리딩 데이터의 dbId와 매핑
                    translationMap.set(item.id, item.translation);
                    // 인덱스 기반 배열로도 저장
                    translationArray[index] = item.translation;
                });
                setTranslationData(translationMap);
                setTranslationByIndex(translationArray);
                console.log(`✅ [일본어 번역 데이터 로드 완료] ${level}: ${translations.length}개 번역`);
            } else {
                console.warn(`일본어 번역 데이터 로드 실패: ${level}`);
                setTranslationData(new Map());
                setTranslationByIndex([]);
            }
        } catch (error) {
            console.error('일본어 번역 데이터 로드 오류:', error);
            setTranslationData(new Map());
            setTranslationByIndex([]);
        }
    };

    const loadReadingData = async () => {
        try {
            setLoading(true);
            setError(null);

            // API를 통해 모든 레벨 데이터 로드
            const response = await fetch(`https://clever-elegance-production.up.railway.app/api/japanese-reading/practice/${level}`);
            if (!response.ok) {
                throw new Error(`Failed to load ${level} Japanese reading data`);
            }
            const result = await response.json();

            if (result.data && result.data.length > 0) {
                // 선택된 문제들만 필터링
                if (selectedQuestions && selectedQuestions.length > 0) {
                    const filteredData = selectedQuestions.map(index => result.data[index]).filter(Boolean);
                    setReadingData(filteredData);
                    setCurrentPassage(0); // 필터된 데이터에서는 처음부터 시작
                } else if (!selectedQuestions && startIndex >= 0 && searchParams.get('start')) {
                    // 단일 지문 모드: start 파라미터가 있고 questions 파라미터가 없는 경우
                    const singlePassage = result.data[startIndex];
                    if (singlePassage) {
                        setReadingData([singlePassage]);
                        setCurrentPassage(0);
                    } else {
                        throw new Error(`Passage at index ${startIndex} not found`);
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

    const handleAnswerSelect = (answer, questionId = null) => {
        if (showExplanation) return;

        if (questionId) {
            // 복수 문제 구조: 각 문제별로 답안 저장
            setSelectedAnswers(prev => ({
                ...prev,
                [questionId]: answer
            }));
        } else {
            // 단일 문제 구조 (호환성 유지)
            setSelectedAnswer(answer);
        }
    };

    const submitAnswer = async () => {
        console.log('🎯 [SUBMIT START] submitAnswer function called');
        const currentPassageData = readingData[currentPassage];
        console.log('🎯 [SUBMIT DATA]', {
            currentPassage,
            currentPassageData: currentPassageData ? {
                questions: currentPassageData.questions?.length,
                firstQuestionId: currentPassageData.questions?.[0]?.questionId
            } : null,
            selectedAnswers
        });

        // 답안 선택 여부 확인 (단일 문제 vs 복수 문제)
        const questionsCount = currentPassageData.questions.length;

        if (questionsCount === 1) {
            // 단일 문제: selectedAnswer 확인
            if (!selectedAnswer) {
                alert('문제에 답을 선택해주세요.');
                return;
            }
        } else {
            // 복수 문제: selectedAnswers 확인
            const unansweredQuestions = currentPassageData.questions.filter(
                question => !selectedAnswers[question.questionId]
            );

            if (unansweredQuestions.length > 0) {
                alert(`모든 문제에 답을 선택해주세요. (${unansweredQuestions.length}개 문제 미완료)`);
                return;
            }
        }

        // 각 문제별 정답 확인 및 점수 계산
        let correctCount = 0;
        const questionResults = currentPassageData.questions.map(question => {
            // 단일 문제는 selectedAnswer 사용, 복수 문제는 selectedAnswers 사용
            const userAnswer = questionsCount === 1
                ? selectedAnswer
                : selectedAnswers[question.questionId];
            const isCorrect = userAnswer === question.correctAnswer;
            if (isCorrect) correctCount++;

            return {
                questionId: question.questionId,
                dbId: question.dbId,
                userAnswer: userAnswer,
                correctAnswer: question.correctAnswer,
                isCorrect: isCorrect,
                question: question.question,
                options: question.options,
                explanation: question.explanation
            };
        });

        // UI 업데이트
        setIsCorrect(correctCount === currentPassageData.questions.length); // 모든 문제가 맞아야 전체 정답
        setShowExplanation(true);
        setShowTranslation(true);
        setScore(score + correctCount);
        setCompletedQuestions(prev => new Set([...prev, currentPassage]));

        // 각 문제를 개별적으로 서버에 제출
        for (const result of questionResults) {
            try {
                console.log('🚀 [SUBMIT] Submitting question:', result.questionId);

                const updateData = {
                    questionId: result.questionId,
                    level: level,
                    isCorrect: result.isCorrect,
                    timestamp: Date.now()
                };

                // 즉시 업데이트 신호
                localStorage.setItem('japaneseReadingInstantUpdate', JSON.stringify(updateData));
                window.dispatchEvent(new CustomEvent('japaneseReadingUpdate', { detail: updateData }));
                window.dispatchEvent(new StorageEvent('storage', {
                    key: 'japaneseReadingInstantUpdate',
                    newValue: JSON.stringify(updateData)
                }));

                const response = await fetch('https://clever-elegance-production.up.railway.app/api/japanese-reading/submit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        questionId: result.questionId,
                        dbId: result.dbId,
                        level: level,
                        userAnswer: result.userAnswer,
                        correctAnswer: result.correctAnswer,
                        isCorrect: result.isCorrect,
                        passage: currentPassageData.passage,
                        question: result.question,
                        options: result.options,
                        explanation: result.explanation
                    })
                });

                if (!response.ok) {
                    console.error('Failed to submit answer to server for:', result.questionId);
                }
            } catch (error) {
                console.error('Error submitting answer for:', result.questionId, error);
            }
        }

        // 복수 문제인 경우 지문 단위 통계도 별도로 제출
        console.log('🔍 [DEBUG] currentPassageData:', currentPassageData);
        console.log('🔍 [DEBUG] questions.length:', currentPassageData.questions?.length);
        console.log('🔍 [DEBUG] passageId:', currentPassageData.id);

        if (currentPassageData.questions.length > 1) {
            try {
                const passageId = currentPassageData.id; // 지문 ID (예: N1_JR_002)
                const allCorrect = correctCount === currentPassageData.questions.length;

                console.log('🚀 [PASSAGE SUBMIT] Submitting passage stats:', passageId, 'allCorrect:', allCorrect);

                const passageResponse = await fetch('https://clever-elegance-production.up.railway.app/api/japanese-reading/submit-passage', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        passageId: passageId,
                        level: level,
                        isCorrect: allCorrect,
                        questionCount: currentPassageData.questions.length,
                        correctCount: correctCount,
                        passage: currentPassageData.passage
                    })
                });

                if (passageResponse.ok) {
                    console.log('✅ [PASSAGE SUBMIT] Passage stats submitted successfully');
                } else {
                    console.error('❌ [PASSAGE SUBMIT] Failed to submit passage stats:', passageResponse.status);
                }
            } catch (error) {
                console.error('Error submitting passage stats:', error);
            }
        }
    };

    const nextQuestion = () => {
        if (currentPassage < readingData.length - 1) {
            setCurrentPassage(currentPassage + 1);
            setSelectedAnswer(null);
            setSelectedAnswers({}); // 복수 문제 답안 초기화
            setShowExplanation(false);
            setIsCorrect(false);
            setShowTranslation(false);
        }
    };

    const prevQuestion = () => {
        if (currentPassage > 0) {
            setCurrentPassage(currentPassage - 1);
            setSelectedAnswer(null);
            setSelectedAnswers({}); // 복수 문제 답안 초기화
            setShowExplanation(false);
            setIsCorrect(false);
            setShowTranslation(false);
        }
    };

    const goToQuestion = (index) => {
        setCurrentPassage(index);
        setSelectedAnswer(null);
        setSelectedAnswers({});
        setShowExplanation(false);
        setIsCorrect(false);
        setShowTranslation(false);
    };

    const resetQuiz = () => {
        setCurrentPassage(0);
        setSelectedAnswer(null);
        setShowExplanation(false);
        setIsCorrect(false);
        setScore(0);
        setCompletedQuestions(new Set());
        setShowTranslation(false);
    };

    const navigateToList = () => {
        // 일본어 리딩 목록 페이지에 통계 업데이트 알림
        localStorage.setItem('japaneseReadingUpdated', Date.now().toString());
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'japaneseReadingUpdated',
            newValue: Date.now().toString()
        }));
        navigate(`/japanese-reading?level=${level}`);
    };

    const finishQuiz = () => {
        navigateToList();
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
                        onClick={navigateToList}
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

    const currentPassageData = readingData[currentPassage];
    const progress = ((currentPassage + 1) / readingData.length) * 100;

    return (
        <div>
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
                        <h2 className="reading-title">📚 {level} 일본어 리딩 연습</h2>
                    </div>
                    <div className="reading-stats">
                        <div className="progress-info">
                            <span className="question-counter">
                                지문 {currentPassage + 1} / {readingData.length}
                                {currentPassageData && currentPassageData.questions && (
                                    <span className="ml-2">
                                        (문제 {currentPassageData.questions.length}개)
                                    </span>
                                )}
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
                            <div className="japanese-text">
                                {makeClickableText(currentPassageData.passage)}
                            </div>
                        </div>
                        {showTranslation && showExplanation && translationByIndex[currentPassage] && (
                            <div className="translation-text" style={{
                                marginTop: '12px',
                                padding: '12px',
                                backgroundColor: '#e7f3ff',
                                borderRadius: '6px',
                                borderLeft: '4px solid #0d6efd'
                            }}>
                                <h6 style={{ marginBottom: '8px', color: '#0c5460' }}>📄 번역:</h6>
                                <div style={{ color: '#2c3e50', fontSize: '14px', lineHeight: '1.6' }}>
                                    {translationByIndex[currentPassage].split('/').map((paragraph, index) => (
                                        <div key={index} style={{
                                            marginBottom: index < translationByIndex[currentPassage].split('/').length - 1 ? '12px' : '0'
                                        }}>
                                            {paragraph.trim()}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 복수 문제 표시 */}
                    {currentPassageData.questions && currentPassageData.questions.map((questionData, questionIndex) => (
                        <div key={questionData.questionId} className="question-section" style={{
                            marginTop: questionIndex > 0 ? '32px' : '0',
                            paddingTop: questionIndex > 0 ? '24px' : '0',
                            borderTop: questionIndex > 0 ? '1px solid #e0e0e0' : 'none'
                        }}>
                            <h5 className="question-title">❓ 문제 {questionIndex + 1}</h5>
                            <div className="question-text" style={{ cursor: 'pointer' }}>
                                <div className="japanese-text">
                                    {makeClickableText(questionData.question)}
                                </div>
                            </div>

                            <div className="options-grid">
                                {Object.entries(questionData.options).map(([key, value]) => {
                                    if (!showExplanation) {
                                        // 문제 풀기 전: 리딩에서는 선택지 내용 즉시 표시
                                        return (
                                            <div
                                                key={key}
                                                className={`option-btn ${
                                                    selectedAnswers[questionData.questionId] === key ? 'selected' : ''
                                                }`}
                                                onClick={() => handleAnswerSelect(key, questionData.questionId)}
                                                style={{
                                                    cursor: 'pointer',
                                                    border: '2px solid #dee2e6',
                                                    borderRadius: '8px',
                                                    padding: '12px 16px',
                                                    margin: '8px 0',
                                                    backgroundColor: selectedAnswers[questionData.questionId] === key ? '#e3f2fd' : '#f8f9fa',
                                                    transition: 'all 0.2s ease',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px'
                                                }}
                                            >
                                                <span className="option-letter" style={{
                                                    fontWeight: 'bold',
                                                    color: '#495057',
                                                    minWidth: '24px'
                                                }}>{key}.</span>
                                                <span style={{ color: '#495057' }}>{value}</span>
                                            </div>
                                        );
                                    } else {
                                        // 정답 확인 후: 전체 내용 표시
                                        return (
                                            <div
                                                key={key}
                                                className={`option-btn ${
                                                    selectedAnswers[questionData.questionId] === key ? 'selected' : ''
                                                } ${
                                                    key === questionData.correctAnswer
                                                        ? 'correct'
                                                        : selectedAnswers[questionData.questionId] === key
                                                            ? 'incorrect'
                                                            : ''
                                                }`}
                                                style={{
                                                    cursor: 'default',
                                                    border: '2px solid #dee2e6',
                                                    borderRadius: '8px',
                                                    padding: '12px 16px',
                                                    margin: '8px 0',
                                                    backgroundColor:
                                                        key === questionData.correctAnswer ? '#d4edda' :
                                                        selectedAnswers[questionData.questionId] === key ? '#f8d7da' :
                                                        '#f8f9fa',
                                                    transition: 'all 0.2s ease',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px'
                                                }}
                                            >
                                                <span className="option-letter" style={{
                                                    fontWeight: 'bold',
                                                    color: '#495057',
                                                    minWidth: '24px'
                                                }}>{key}.</span>
                                                <span className="option-text" style={{
                                                    cursor: 'pointer',
                                                    color: 'inherit'
                                                }}>
                                                    <div className="japanese-text">
                                                        {makeClickableText(value)}
                                                    </div>
                                                </span>
                                            </div>
                                        );
                                    }
                                })}
                            </div>

                            {/* 개별 문제 해설 */}
                            {showExplanation && (
                                <div className="explanation-section">
                                    <h6 className="explanation-title">💡 해설 {questionIndex + 1}</h6>
                                    <div className="explanation-text">
                                        <div className="japanese-text">
                                            {makeClickableText(questionData.explanation)}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                {/* 전체 지문 결과 표시 */}
                {showExplanation && (
                    <div className={`explanation-box ${isCorrect ? 'correct' : 'incorrect'}`}>
                        <div className="explanation-header">
                            {isCorrect ? (
                                <span className="result-icon correct">✅ 모든 문제 정답!</span>
                            ) : (
                                <span className="result-icon incorrect">❌ 일부 오답 있음</span>
                            )}
                        </div>
                    </div>
                )}
                </div> {/* reading-card 닫기 */}

                {/* Control Buttons */}
                <div className="reading-controls">
                    <div className="nav-buttons">
                        <button
                            className="btn btn-outline-secondary"
                            onClick={prevQuestion}
                            disabled={currentPassage === 0}
                        >
                            ← 이전
                        </button>

                        <button
                            className="btn btn-outline-secondary"
                            onClick={nextQuestion}
                            disabled={currentPassage === readingData.length - 1}
                        >
                            다음 →
                        </button>
                    </div>

                    <div className="action-buttons">
                        {!showExplanation ? (
                            <button
                                className="btn btn-primary"
                                onClick={submitAnswer}
                                disabled={
                                    currentPassageData && currentPassageData.questions && currentPassageData.questions.length > 1
                                        ? currentPassageData.questions.some(q => !selectedAnswers[q.questionId])
                                        : !selectedAnswer
                                }
                            >
                                정답 확인
                            </button>
                        ) : (
                            <button
                                className="btn btn-success"
                                onClick={currentPassage === readingData.length - 1 ? resetQuiz : nextQuestion}
                            >
                                {currentPassage === readingData.length - 1 ? '다시 시작' : '다음 문제'}
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
                {currentPassage === readingData.length - 1 && showExplanation && (
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
            </div> {/* reading-container 닫기 */}
        </main>

        {/* Word Meaning Popup */}
        {selectedWord && (
            <WordMeaningPopup
                kana={selectedWord.kana}
                wordDataArray={[selectedWord]}
                position={wordPopupPosition}
                onClose={() => setSelectedWord(null)}
            />
        )}
    </div>
    );
}