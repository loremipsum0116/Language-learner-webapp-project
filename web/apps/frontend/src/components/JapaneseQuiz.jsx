// src/components/JapaneseQuiz.jsx - 일본어 전용 퀴즈 컴포넌트
import React, { useState, useEffect } from 'react';
import { JapaneseQuizTypes, isMultipleChoiceQuiz, isInputQuiz, getQuizTypeDescription } from '../types/japanese-quiz';
import { fetchJSON, withCreds } from '../api/client';
import { toast } from 'react-toastify';

// Furigana display component - handles mixed kanji/hiragana
function FuriganaDisplay({ kanji, kana }) {
  // Debug logging
  if (kanji?.includes('おさき') || kanji?.includes('ありがとう')) {
    console.log('FuriganaDisplay debug:', { kanji, kana });
  }

  // Special handling for problematic phrases - show furigana only over kanji
  if (kanji === 'お先に失礼します') {
    return (
      <span className="fs-4" lang="ja">
        お<ruby>先<rt className="fs-6">さき</rt></ruby>に<ruby>失礼<rt className="fs-6">しつれい</rt></ruby>します
      </span>
    );
  }

  // If no kanji text, return kana
  if (!kanji) {
    return <span className="fs-4" lang="ja">{kana || ''}</span>;
  }

  // If no kana provided, return kanji only
  if (!kana) {
    return <span className="fs-4" lang="ja">{kanji}</span>;
  }

  // If kanji and kana are the same, no need for furigana
  if (kanji === kana) {
    return <span className="fs-4" lang="ja">{kanji}</span>;
  }

  // Check if kanji contains any actual kanji characters
  const hasKanji = /[\u4e00-\u9faf]/.test(kanji);

  if (!hasKanji) {
    // No kanji characters, just display the kanji text without furigana
    return <span className="fs-4" lang="ja">{kanji}</span>;
  }

  // If the displayed text (kanji) is already in hiragana/katakana only, don't show furigana
  const isKanjiAlreadyHiragana = /^[\u3040-\u309f\u30a0-\u30ff\s\u3000]+$/.test(kanji);
  if (isKanjiAlreadyHiragana) {
    return <span className="fs-4" lang="ja">{kanji}</span>;
  }

  // Complex parsing for mixed kanji/hiragana text
  const result = [];
  let kanaIndex = 0;

  for (let i = 0; i < kanji.length; i++) {
    const char = kanji[i];

    // If it's a kanji character
    if (/[\u4e00-\u9faf]/.test(char)) {
      // Find the reading for this kanji
      let reading = '';

      // Look ahead to find the next non-kanji character or end
      let nextNonKanjiIndex = i + 1;
      while (nextNonKanjiIndex < kanji.length && /[\u4e00-\u9faf]/.test(kanji[nextNonKanjiIndex])) {
        nextNonKanjiIndex++;
      }

      if (nextNonKanjiIndex < kanji.length) {
        // There's a hiragana part after this kanji sequence
        const nextHiragana = kanji[nextNonKanjiIndex];
        const nextHiraganaIndexInKana = kana.indexOf(nextHiragana, kanaIndex);

        if (nextHiraganaIndexInKana > kanaIndex) {
          const kanjiSequence = kanji.slice(i, nextNonKanjiIndex);
          reading = kana.slice(kanaIndex, nextHiraganaIndexInKana);

          result.push(
            <ruby key={i}>
              {kanjiSequence}
              <rt className="fs-6">{reading}</rt>
            </ruby>
          );

          kanaIndex = nextHiraganaIndexInKana;
          i = nextNonKanjiIndex - 1; // -1 because the loop will increment
          continue;
        }
      } else {
        // This is the last kanji sequence
        reading = kana.slice(kanaIndex);
        const kanjiSequence = kanji.slice(i);

        result.push(
          <ruby key={i}>
            {kanjiSequence}
            <rt className="fs-6">{reading}</rt>
          </ruby>
        );
        break;
      }
    }
    // If it's hiragana/katakana, add it directly
    else if (/[\u3040-\u309f\u30a0-\u30ff]/.test(char)) {
      result.push(char);
      kanaIndex++;
    }
    // Other characters (spaces, punctuation)
    else {
      result.push(char);
    }
  }

  return <span className="fs-4" lang="ja">{result}</span>;
}

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
    cards = null, // 새로 추가: 카드 정보
    quizType = JapaneseQuizTypes.JP_WORD_TO_KO_MEANING,
    onQuizComplete,
    folderId = null,
    mode = null
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
    // 혼합형 퀴즈의 경우 originalQuizType을 사용, 그렇지 않으면 quizType 사용
    const actualQuizType = currentQuiz?.originalQuizType || currentQuiz?.quizType;
    const isMultipleChoice = currentQuiz && isMultipleChoiceQuiz(actualQuizType);
    const isInput = currentQuiz && isInputQuiz(actualQuizType);

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

    // 오디오 재생 함수 (2025-09-17 추가)
    const playAudio = (audioPath) => {
        if (!audioPath) {
            console.error('오디오 경로가 없습니다');
            return;
        }

        try {
            // JLPT 오디오 경로 구성: /jlpt/{level}/{folder}/word.mp3
            const fullAudioUrl = `${process.env.REACT_APP_API_URL || 'https://clever-elegance-production.up.railway.app'}${audioPath}`;
            console.log('🔊 Playing audio:', fullAudioUrl);

            const audio = new Audio(fullAudioUrl);
            audio.play().catch(error => {
                console.error('오디오 재생 실패:', error);
                alert('오디오를 재생할 수 없습니다. 파일이 존재하지 않을 수 있습니다.');
            });
        } catch (error) {
            console.error('오디오 재생 중 오류:', error);
        }
    };

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
                let processedQuizItems = response.data.quizItems;

                // cards 정보가 있으면 중복 카드 처리
                if (cards && cards.length > 0) {
                    console.log('[JAPANESE QUIZ] Processing duplicate cards:', {
                        originalItems: processedQuizItems.length,
                        availableCards: cards.map(c => ({cardId: c.cardId, vocabId: c.vocabId, vocab: c.vocab?.lemma}))
                    });

                    // 각 vocab에 대해 여러 카드가 있다면 복수 생성
                    const expandedQuizItems = [];
                    processedQuizItems.forEach(item => {
                        const matchingCards = cards.filter(card => card.vocabId === item.vocabId);

                        if (matchingCards.length > 1) {
                            // 중복 카드가 있는 경우: 각 카드별로 퀴즈 아이템 생성
                            matchingCards.forEach((card, index) => {
                                expandedQuizItems.push({
                                    ...item,
                                    cardId: card.cardId, // 실제 카드 ID로 교체
                                    folderId: card.folderId,
                                    folderName: card.folderName,
                                    duplicateIndex: index // 디버깅용
                                });
                            });
                        } else {
                            // 단일 카드인 경우: 기존 로직 유지
                            const card = matchingCards[0];
                            if (card) {
                                expandedQuizItems.push({
                                    ...item,
                                    cardId: card.cardId,
                                    folderId: card.folderId,
                                    folderName: card.folderName
                                });
                            } else {
                                expandedQuizItems.push(item); // fallback
                            }
                        }
                    });

                    processedQuizItems = expandedQuizItems;
                    console.log('[JAPANESE QUIZ] Expanded quiz items:', {
                        expandedCount: processedQuizItems.length,
                        items: processedQuizItems.map(item => ({cardId: item.cardId, vocabId: item.vocabId, answer: item.answer}))
                    });
                }

                setQuizItems(processedQuizItems);
                setCurrentIndex(0);
                setScore({ correct: 0, total: processedQuizItems.length });
                console.log('[JAPANESE QUIZ] Loaded quiz items:', processedQuizItems);
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

        console.log('[JAPANESE QUIZ] submitAnswer 함수 시작:', { currentIndex, currentQuiz: currentQuiz.question });

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
                console.log('[JAPANESE QUIZ SRS DEBUG] 체크:', {
                    mode,
                    folderId,
                    cardId: currentQuiz.cardId,
                    correct
                });

                // all_overdue 모드에서는 folderId가 없어도 SRS 업데이트 진행
                if (!folderId && mode !== 'all_overdue') {
                    console.warn('[JAPANESE QUIZ] folderId가 없어 SRS 채점을 건너뜁니다.');
                } else {
                    console.log('[JAPANESE QUIZ SRS DEBUG] API 호출 시작:', { folderId, cardId: currentQuiz.cardId, correct });

                    const srsResponse = await fetchJSON('/quiz/answer', withCreds({
                        method: 'POST',
                        body: JSON.stringify({
                            folderId: folderId,
                            cardId: currentQuiz.cardId,
                            correct: correct
                        })
                    }));

                    console.log('[JAPANESE QUIZ SRS DEBUG] API 응답:', srsResponse);
                    console.log('[JAPANESE QUIZ] SRS answer recorded:', { cardId: currentQuiz.cardId, correct });
                }
            } catch (error) {
                console.error('[JAPANESE QUIZ] Failed to record SRS answer:', error);
                // SRS 기록 실패는 퀴즈 진행을 막지 않음
            }
        }

        // 오답인 경우 오답노트에 기록 (SRS 카드가 아닌 경우에만)
        // SRS 카드인 경우는 백엔드에서 처리하지만, 일본어는 백엔드에서 건너뛰므로 여기서도 건너뜀
        if (!correct && !currentQuiz.cardId) {
            try {
                const odatPayload = {
                    itemType: 'vocab',
                    itemId: currentQuiz.vocabId || currentQuiz.cardId,
                    wrongData: {
                        question: currentQuiz.question || '알 수 없는 단어',
                        answer: currentQuiz.answer || '정답',
                        userAnswer: isMultipleChoice ? finalAnswer : finalAnswer,
                        quizType: actualQuizType || currentQuiz.quizType || 'japanese-quiz',
                        folderId: folderId,
                        vocabId: currentQuiz.vocabId || currentQuiz.cardId,
                        ko_gloss: currentQuiz.answerTranslation || currentQuiz.answer || '뜻 정보 없음',
                        context: currentQuiz.contextSentence || null,
                        pron: currentQuiz.pron || null,
                        language: 'ja' // 일본어 퀴즈임을 명시
                    }
                };

                console.log('[JAPANESE QUIZ] Recording wrong answer to odat-note:', odatPayload);

                const response = await fetchJSON('/api/odat-note/create', withCreds({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(odatPayload)
                }));

                console.log('✅ [일본어 퀴즈 오답 기록 완료] 응답:', response);

                // 오답노트에 새로운 기록이 추가되었음을 알리는 이벤트 발생
                window.dispatchEvent(new CustomEvent('wrongAnswerAdded', {
                    detail: {
                        itemType: 'vocab',
                        itemId: currentQuiz.vocabId || currentQuiz.cardId,
                        language: 'ja'
                    }
                }));
            } catch (odatError) {
                console.error('❌ [일본어 퀴즈 오답 기록 실패]:', odatError);
                // 오답 기록 실패도 퀴즈 진행을 막지 않음
            }
        }

        // 점수 업데이트
        if (correct) {
            setScore(prev => ({ ...prev, correct: prev.correct + 1 }));
        }
    };

    // 다음 문제로 진행
    const nextQuestion = () => {
        console.log('[JapaneseQuiz] nextQuestion called:', {
            currentIndex: currentIndex,
            totalItems: quizItems.length,
            isLastItem: currentIndex + 1 >= quizItems.length,
            vocabIds: vocabIds
        });

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
            console.log('[JapaneseQuiz] Quiz completed with score:', finalScore);
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
                <small>
                    {quizType === JapaneseQuizTypes.JP_MIXED && currentQuiz
                        ? getQuizTypeDescription(actualQuizType)
                        : getQuizTypeDescription(quizType)
                    }
                </small>
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

                            {/* 오디오 퀴즈인 경우 오디오 재생 버튼 표시 (2025-09-17 추가) */}
                            {currentQuiz.audioQuestion ? (
                                <div className="audio-question-section">
                                    <div className="text-center mb-3">
                                        <p className="h5 text-muted mb-3">🎧 오디오를 듣고 알맞은 일본어 단어를 선택하세요</p>
                                        <button
                                            className="btn btn-primary btn-lg"
                                            onClick={() => playAudio(currentQuiz.audioQuestion)}
                                            style={{ fontSize: '1.5rem', padding: '12px 24px' }}
                                        >
                                            🔊 오디오 재생
                                        </button>
                                        <div className="text-muted mt-2">
                                            <small>버튼을 눌러 오디오를 재생할 수 있습니다</small>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="display-6 mb-3">
                                    {(() => {
                                        console.log('🔍 [JAPANESE QUIZ DEBUG]', {
                                            question: currentQuiz.question,
                                            pron: currentQuiz.pron,
                                            hiragana: currentQuiz.pron?.hiragana,
                                            kana: currentQuiz.pron?.kana,
                                            romaji: currentQuiz.pron?.romaji
                                        });
                                        return null;
                                    })()}
                                    <FuriganaDisplay
                                        kanji={currentQuiz.question}
                                        kana={currentQuiz.pron?.hiragana || currentQuiz.pron?.kana}
                                    />
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
                                        {/* 예문 한국어 해석 표시 (예문 모드일 때만) */}
                                        {currentQuiz.useExample && currentQuiz.contextTranslation && (
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

                                {/* 발음 정보 및 뜻 표시 */}
                                {(currentQuiz.pron || currentQuiz.vocab) && (
                                    <div className="pronunciation-info mt-3 p-3 bg-light rounded">
                                        {/* 히라가나 발음 표시 */}
                                        {(currentQuiz.pron?.hiragana || currentQuiz.vocab?.dictentry?.examples?.kana || currentQuiz.vocab?.dictentry?.ipa) && (
                                            <div className="mb-2">
                                                <strong>발음: </strong>
                                                <span className="fs-4 text-primary ms-1" lang="ja">
                                                    {currentQuiz.pron?.hiragana || currentQuiz.vocab?.dictentry?.examples?.kana || currentQuiz.vocab?.dictentry?.ipa}
                                                </span>
                                            </div>
                                        )}

                                        {/* 로마지 발음 표시 */}
                                        {(currentQuiz.pron?.romaji || currentQuiz.vocab?.dictentry?.examples?.romaji) && (
                                            <div className="mb-3">
                                                <strong>로마지: </strong>
                                                <span className="fs-5 text-secondary ms-1">
                                                    {currentQuiz.pron?.romaji || currentQuiz.vocab?.dictentry?.examples?.romaji}
                                                </span>
                                            </div>
                                        )}

                                        {/* 뜻을 같은 박스 안에서 크게 표시 */}
                                        {currentQuiz.vocab && currentQuiz.vocab.translations && (
                                            <div>
                                                <strong>뜻: </strong>
                                                <span className="fs-5 text-dark">
                                                    {currentQuiz.vocab.translations[0]?.translation || currentQuiz.answer}
                                                </span>
                                            </div>
                                        )}
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