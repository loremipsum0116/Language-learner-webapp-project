// src/components/JapaneseQuiz.jsx - 일본어 전용 퀴즈 컴포넌트
import React, { useState, useEffect } from 'react';
import { JapaneseQuizTypes, isMultipleChoiceQuiz, isInputQuiz, getQuizTypeDescription } from '../types/japanese-quiz';
import { fetchJSON, withCreds } from '../api/client';
import { toast } from 'react-toastify';

// JLPT 레벨 배지 색상 함수 (기존 JapaneseVocabCard와 동일)
const getJlptBadgeColor = (level) => {
    switch (level) {
        case 'N5': return 'bg-success';
        case 'N4': return 'bg-info';
        case 'N3': return 'bg-warning text-dark';
        case 'N2': return 'bg-danger';
        case 'N1': return 'bg-dark';
        default: return 'bg-secondary';
    }
};

// 한국어 해석에서 정답 단어를 강조하는 함수
const highlightAnswerInTranslation = (translation) => {
    console.log('highlightAnswerInTranslation called with:', translation);

    if (!translation) {
        console.log('No translation, returning empty');
        return '';
    }

    // 백엔드에서 전달된 강조 마킹을 처리
    if (translation.includes('{{HIGHLIGHT_START}}') && translation.includes('{{HIGHLIGHT_END}}')) {
        console.log('Found highlight markers, processing...');

        const parts = translation.split('{{HIGHLIGHT_START}}');
        const beforeHighlight = parts[0];

        const remainingPart = parts[1];
        const highlightParts = remainingPart.split('{{HIGHLIGHT_END}}');
        const highlighted = highlightParts[0];
        const afterHighlight = highlightParts[1] || '';

        console.log('Highlight parts:', { beforeHighlight, highlighted, afterHighlight });

        return (
            <span>
                {beforeHighlight}
                <span style={{ color: 'red', fontWeight: 'bold' }}>{highlighted}</span>
                {afterHighlight}
            </span>
        );
    }

    // 강조 마킹이 없으면 원본 반환
    console.log('No highlight markers found, returning original');
    return translation;
};

export default function JapaneseQuiz({
    vocabIds,
    quizType = JapaneseQuizTypes.JP_WORD_TO_KO_MEANING,
    onQuizComplete,
    folderId = null
}) {
    const [quizItems, setQuizItems] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState('');
    const [selectedOption, setSelectedOption] = useState(null);
    const [showResult, setShowResult] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [loading, setLoading] = useState(true);
    const [score, setScore] = useState({ correct: 0, total: 0 });

    // 스펠링 입력용 3번 기회 로직
    const [attemptCount, setAttemptCount] = useState(0);
    const [maxAttempts] = useState(3);
    const [showSpellingWarning, setShowSpellingWarning] = useState(false);

    const currentQuiz = quizItems[currentIndex];
    const isMultipleChoice = currentQuiz && isMultipleChoiceQuiz(currentQuiz.quizType);
    const isInput = currentQuiz && isInputQuiz(currentQuiz.quizType);

    // 퀴즈 데이터 로드
    useEffect(() => {
        loadQuizData();
    }, [vocabIds, quizType]);

    // 현재 문제가 변경될 때마다 스펠링 관련 상태 초기화
    useEffect(() => {
        setUserAnswer('');
        setSelectedOption(null);
        setAttemptCount(0);
        setShowSpellingWarning(false);
        setShowResult(false);
    }, [currentIndex]);

    const loadQuizData = async () => {
        try {
            setLoading(true);
            console.log('[JAPANESE QUIZ] Loading quiz data:', { vocabIds, quizType });

            const response = await fetchJSON('/quiz/japanese', withCreds({
                method: 'POST',
                body: JSON.stringify({
                    vocabIds,
                    quizType
                })
            }));

            if (response.data && response.data.quizItems) {
                setQuizItems(response.data.quizItems);
                setCurrentIndex(0);
                setScore({ correct: 0, total: response.data.quizItems.length });
                console.log('[JAPANESE QUIZ] Loaded quiz items:', response.data.quizItems);
            } else {
                throw new Error('No quiz items received');
            }
        } catch (error) {
            console.error('[JAPANESE QUIZ] Failed to load quiz:', error);
            toast.error('퀴즈를 불러오는 데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // 답안 제출 처리
    const submitAnswer = async () => {
        if (!currentQuiz) return;

        let finalAnswer;
        let correct = false;

        if (isMultipleChoice) {
            // selectedOption이 객체인 경우 text 속성을 사용, 문자열인 경우 그대로 사용
            if (typeof selectedOption === 'object' && selectedOption !== null) {
                finalAnswer = selectedOption.text;
            } else {
                finalAnswer = selectedOption;
            }
            correct = finalAnswer === currentQuiz.answer;

            // 4지선다는 바로 결과 표시
            setIsCorrect(correct);
            setShowResult(true);
        } else if (isInput) {
            finalAnswer = userAnswer.trim();
            // 일본어 입력 퀴즈는 여러 정답 허용 (한자, 히라가나, 로마자)
            correct = currentQuiz.acceptableAnswers
                ? currentQuiz.acceptableAnswers.some(acceptable =>
                    acceptable.toLowerCase() === finalAnswer.toLowerCase())
                : finalAnswer.toLowerCase() === currentQuiz.answer.toLowerCase();

            if (correct) {
                // 정답인 경우 바로 결과 표시
                setIsCorrect(true);
                setShowResult(true);
                setShowSpellingWarning(false);
            } else {
                // 틀린 경우 시도 횟수 증가
                const newAttemptCount = attemptCount + 1;
                setAttemptCount(newAttemptCount);

                if (newAttemptCount >= maxAttempts) {
                    // 3번 모두 틀린 경우 오답 처리
                    setIsCorrect(false);
                    setShowResult(true);
                    setShowSpellingWarning(false);
                } else {
                    // 아직 기회가 남은 경우 경고 표시
                    setShowSpellingWarning(true);
                    return; // 여기서 함수 종료 (SRS 기록하지 않음)
                }
            }
        }

        // SRS 시스템에 답안 전송 (cardId가 있는 경우에만)
        if (currentQuiz.cardId) {
            try {
                await fetchJSON('/quiz/answer', withCreds({
                    method: 'POST',
                    body: JSON.stringify({
                        folderId: folderId,
                        cardId: currentQuiz.cardId,
                        correct: correct
                    })
                }));
                console.log('[JAPANESE QUIZ] SRS answer recorded:', { cardId: currentQuiz.cardId, correct });
            } catch (error) {
                console.error('[JAPANESE QUIZ] Failed to record SRS answer:', error);
                // SRS 기록 실패는 퀴즈 진행을 막지 않음
            }
        }

        // 점수 업데이트
        if (correct) {
            setScore(prev => ({ ...prev, correct: prev.correct + 1 }));
        }
    };

    // 다음 문제로 진행
    const nextQuestion = () => {
        setShowResult(false);
        setUserAnswer('');
        setSelectedOption(null);

        if (currentIndex + 1 < quizItems.length) {
            setCurrentIndex(currentIndex + 1);
        } else {
            // 퀴즈 완료
            const finalScore = {
                correct: score.correct + (isCorrect ? 1 : 0),
                total: score.total
            };
            onQuizComplete && onQuizComplete(finalScore);
        }
    };

    // 로딩 상태
    if (loading) {
        return (
            <div className="d-flex justify-content-center p-4">
                <div className="spinner-border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    // 퀴즈 항목이 없는 경우
    if (!quizItems || quizItems.length === 0) {
        return (
            <div className="alert alert-warning text-center">
                <h5>퀴즈를 생성할 수 없습니다</h5>
                <p>선택한 단어들로 {getQuizTypeDescription(quizType)} 퀴즈를 만들 수 없습니다.</p>
            </div>
        );
    }

    return (
        <div className="japanese-quiz-container">
            {/* 진행률 표시 */}
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="m-0">일본어 퀴즈</h4>
                <div className="quiz-progress">
                    <span className="badge bg-primary fs-6">
                        {currentIndex + 1} / {quizItems.length}
                    </span>
                </div>
            </div>

            {/* 퀴즈 타입 설명 */}
            <div className="alert alert-info mb-3">
                <small>{getQuizTypeDescription(quizType)}</small>
            </div>

            {/* 현재 문제 */}
            {currentQuiz && (
                <div className="card shadow-sm">
                    <div className="card-body p-4">
                        {/* 문제 표시 */}
                        <div className="question-section text-center mb-4 position-relative">
                            {/* JLPT 레벨 표시 - 오른쪽 위 */}
                            {currentQuiz.jlptLevel && (
                                <span
                                    className={`badge ${getJlptBadgeColor(currentQuiz.jlptLevel)} position-absolute`}
                                    style={{
                                        top: '0',
                                        right: '0',
                                        fontSize: '0.75rem',
                                        padding: '0.25rem 0.5rem'
                                    }}
                                >
                                    {currentQuiz.jlptLevel}
                                </span>
                            )}

                            <h2 className="display-6 mb-3" lang="ja">
                                {currentQuiz.question}
                            </h2>

                            {/* 발음 정보 표시 (일본어 → 한국어 뜻 퀴즈에서) */}
                            {currentQuiz.quizType === JapaneseQuizTypes.JP_WORD_TO_KO_MEANING && currentQuiz.pron && (
                                <div className="pronunciation-info mb-3">
                                    {currentQuiz.pron.hiragana && (
                                        <div className="text-muted">
                                            <small>히라가나: {currentQuiz.pron.hiragana}</small>
                                        </div>
                                    )}
                                    {currentQuiz.pron.romaji && (
                                        <div className="text-muted">
                                            <small>로마자: {currentQuiz.pron.romaji}</small>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 답안 입력 영역 */}
                        {!showResult && (
                            <div className="answer-section">
                                {isMultipleChoice && currentQuiz.options && (
                                    <div className="options-container">
                                        {currentQuiz.options.map((option, index) => {
                                            // option이 객체인 경우 (로마자 정보 포함) 또는 문자열인 경우 처리
                                            const isObject = typeof option === 'object' && option !== null;
                                            const optionText = isObject ? option.text : option;
                                            const optionRomaji = isObject ? option.romaji : null;
                                            const displayValue = isObject ? option : option; // 선택값으로 사용

                                            return (
                                                <button
                                                    key={index}
                                                    className={`btn btn-outline-primary w-100 mb-2 text-start ${
                                                        selectedOption === displayValue ? 'active' : ''
                                                    }`}
                                                    onClick={() => setSelectedOption(displayValue)}
                                                    style={{ paddingTop: '12px', paddingBottom: '12px' }}
                                                >
                                                    <div>
                                                        <span className="fw-bold" lang="ja">{optionText}</span>
                                                        {optionRomaji && (
                                                            <div className="text-muted small mt-1">
                                                                ({optionRomaji})
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                        <div className="text-center mt-3">
                                            <button
                                                className="btn btn-success btn-lg"
                                                disabled={!selectedOption}
                                                onClick={submitAnswer}
                                            >
                                                답안 제출
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {isInput && (
                                    <div className="input-container">
                                        {/* 예문 한국어 해석 표시 */}
                                        {currentQuiz.contextTranslation && (
                                            <div className="alert alert-light mb-3 text-center">
                                                <small className="text-muted">
                                                    <strong>해석:</strong> {highlightAnswerInTranslation(
                                                        currentQuiz.contextTranslation
                                                    )}
                                                </small>
                                            </div>
                                        )}

                                        {/* 스펠링 경고 메시지 */}
                                        {showSpellingWarning && (
                                            <div className="alert alert-warning mb-3">
                                                <strong>⚠️ 다시 생각해보세요!</strong>
                                                <div className="small mt-1">남은 기회: {maxAttempts - attemptCount}번</div>
                                            </div>
                                        )}

                                        <div className="mb-3">
                                            <input
                                                type="text"
                                                className={`form-control form-control-lg text-center ${
                                                    showSpellingWarning ? 'border-warning' : ''
                                                }`}
                                                placeholder="답을 입력하세요 (한자, 히라가나, 또는 로마자)"
                                                value={userAnswer}
                                                onChange={(e) => setUserAnswer(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && userAnswer.trim() && submitAnswer()}
                                                lang="ja"
                                            />
                                        </div>
                                        <div className="text-center">
                                            <button
                                                className="btn btn-success btn-lg"
                                                disabled={!userAnswer.trim()}
                                                onClick={submitAnswer}
                                            >
                                                답안 제출
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 결과 표시 */}
                        {showResult && (
                            <div className="result-section text-center">
                                <div className={`alert ${isCorrect ? 'alert-success' : 'alert-danger'}`}>
                                    <h5>{isCorrect ? '✅ 정답입니다!' : '❌ 틀렸습니다'}</h5>
                                    {!isCorrect && (
                                        <p>정답: <strong>{currentQuiz.answer}</strong></p>
                                    )}
                                </div>

                                {/* 추가 정보 표시 */}
                                {currentQuiz.vocab && currentQuiz.vocab.translations && (
                                    <div className="additional-info mt-3">
                                        <small className="text-muted">
                                            뜻: {currentQuiz.vocab.translations[0]?.translation || currentQuiz.answer}
                                        </small>
                                    </div>
                                )}

                                <button
                                    className="btn btn-primary btn-lg mt-3"
                                    onClick={nextQuestion}
                                >
                                    {currentIndex + 1 < quizItems.length ? '다음 문제' : '퀴즈 완료'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 현재 점수 */}
            <div className="score-display mt-3 text-center">
                <small className="text-muted">
                    현재 점수: {score.correct + (showResult && isCorrect ? 1 : 0)} / {score.total}
                </small>
            </div>
        </div>
    );
}