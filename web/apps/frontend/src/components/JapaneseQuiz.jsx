// src/components/JapaneseQuiz.jsx - 일본어 전용 퀴즈 컴포넌트
import React, { useState, useEffect } from 'react';
import { JapaneseQuizTypes, isMultipleChoiceQuiz, isInputQuiz, getQuizTypeDescription } from '../types/japanese-quiz';
import { fetchJSON, withCreds } from '../api/client';
import { toast } from 'react-toastify';

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

    const currentQuiz = quizItems[currentIndex];
    const isMultipleChoice = currentQuiz && isMultipleChoiceQuiz(currentQuiz.quizType);
    const isInput = currentQuiz && isInputQuiz(currentQuiz.quizType);

    // 퀴즈 데이터 로드
    useEffect(() => {
        loadQuizData();
    }, [vocabIds, quizType]);

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
            finalAnswer = selectedOption;
            correct = finalAnswer === currentQuiz.answer;
        } else if (isInput) {
            finalAnswer = userAnswer.trim();
            // 일본어 입력 퀴즈는 여러 정답 허용 (한자, 히라가나, 로마자)
            correct = currentQuiz.acceptableAnswers
                ? currentQuiz.acceptableAnswers.some(acceptable =>
                    acceptable.toLowerCase() === finalAnswer.toLowerCase())
                : finalAnswer.toLowerCase() === currentQuiz.answer.toLowerCase();
        }

        setIsCorrect(correct);
        setShowResult(true);

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
                        <div className="question-section text-center mb-4">
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

                            {/* JLPT 레벨 표시 */}
                            {currentQuiz.jlptLevel && (
                                <span className="badge bg-secondary mb-3">{currentQuiz.jlptLevel}</span>
                            )}
                        </div>

                        {/* 답안 입력 영역 */}
                        {!showResult && (
                            <div className="answer-section">
                                {isMultipleChoice && currentQuiz.options && (
                                    <div className="options-container">
                                        {currentQuiz.options.map((option, index) => (
                                            <button
                                                key={index}
                                                className={`btn btn-outline-primary w-100 mb-2 ${
                                                    selectedOption === option ? 'active' : ''
                                                }`}
                                                onClick={() => setSelectedOption(option)}
                                            >
                                                {option}
                                            </button>
                                        ))}
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
                                        <div className="mb-3">
                                            <input
                                                type="text"
                                                className="form-control form-control-lg text-center"
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