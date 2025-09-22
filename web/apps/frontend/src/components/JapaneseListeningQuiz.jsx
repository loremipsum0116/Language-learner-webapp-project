import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { fetchJSON, withCreds } from '../api/client';
import WordMeaningPopup from './WordMeaningPopup';

/**
 * 일본어 리스닝 퀴즈 컴포넌트 (N1-N5)
 * 한국어 번역 분리 및 표시/숨김 기능 포함
 */
export default function JapaneseListeningQuiz({
  questions = [],
  onComplete,
  level = 'N5',
  showTranslation = false
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [results, setResults] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showScript, setShowScript] = useState(false);
  const [showTranslationToggle, setShowTranslationToggle] = useState(showTranslation);
  const [autoShowTranslation, setAutoShowTranslation] = useState(false);

  // 단어 뜻 팝업 관련 상태
  const [jlptWords, setJlptWords] = useState({});
  const [selectedWord, setSelectedWord] = useState(null);
  const [wordPopupPosition, setWordPopupPosition] = useState({ x: 0, y: 0 });

  const audioRef = useRef(null);

  const currentQuestion = questions[currentIndex];

  // JLPT 단어 데이터 로드
  useEffect(() => {
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

    loadJlptWords();
  }, []);

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

  // 실제 MP3 파일 재생
  const playScript = () => {
    if (!currentQuestion?.id) {
      toast.error('음성 파일 ID가 없습니다.');
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setIsPlaying(true);

    // 음성 파일 경로 생성 (N1_L_001.mp3 형식)
    const audioSrc = `/${level}/${level}_Listening/${level}_Listening_mix/${currentQuestion.id}.mp3`;

    console.log('Attempting to play audio:', audioSrc);

    if (audioRef.current) {
      audioRef.current.src = audioSrc;
      audioRef.current.playbackRate = playbackRate;

      // 파일이 로드되었는지 먼저 확인
      audioRef.current.load();

      audioRef.current.play()
        .then(() => {
          console.log('Audio playback started successfully');
        })
        .catch((error) => {
          console.error('Audio playback failed:', error);
          setIsPlaying(false);

          // 구체적인 에러 메시지 제공
          if (error.name === 'NotSupportedError') {
            toast.error(`음성 파일을 찾을 수 없습니다: ${audioSrc}`);
          } else if (error.name === 'NotAllowedError') {
            toast.error('브라우저에서 음성 재생이 차단되었습니다. 사용자 상호작용 후 다시 시도하세요.');
          } else {
            toast.error(`음성 재생 오류: ${error.message}`);
          }
        });
    }
  };

  // 음성 중지
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  };

  // 답안 선택
  const handleAnswerSelect = async (answer) => {
    if (isAnswered) return;

    setSelectedAnswer(answer);
    setIsAnswered(true);
    setAutoShowTranslation(true); // 정답 확인 후 자동으로 번역 표시
    setShowScript(true); // 정답 확인 후 스크립트 자동 표시

    const isCorrect = answer === currentQuestion.answer;
    const result = {
      questionId: currentQuestion.id,
      question: currentQuestion.question,
      question_ko: currentQuestion.question_ko,
      selectedAnswer: answer,
      correctAnswer: currentQuestion.answer,
      isCorrect,
      topic: currentQuestion.topic,
      topic_ko: currentQuestion.topic_ko,
      script: currentQuestion.script,
      script_ko: currentQuestion.script_ko
    };

    setResults(prev => [...prev, result]);

    if (isCorrect) {
      setScore(prev => prev + 1);
      toast.success('정답입니다! 🎉');
    } else {
      toast.error(`틀렸습니다. 정답은 "${currentQuestion.answer}" 입니다.`);

      // 오답노트에 일본어 리스닝 문제 기록
      try {
        await fetchJSON('/api/odat-note', withCreds({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'japanese_listening',
            wrongData: {
              questionId: currentQuestion.id,
              level: level,
              topic: currentQuestion.topic,
              topic_ko: currentQuestion.topic_ko,
              question: currentQuestion.question,
              question_ko: currentQuestion.question_ko,
              script: currentQuestion.script,
              script_ko: currentQuestion.script_ko,
              userAnswer: answer,
              correctAnswer: currentQuestion.answer,
              options: currentQuestion.options,
              audioFile: `${level}_Listening_mix/${currentQuestion.id}.mp3`
            }
          })
        }));
        console.log(`✅ [일본어 리스닝 오답 기록 완료] ${level} - ${currentQuestion.topic}`);
      } catch (error) {
        console.error('❌ 일본어 리스닝 오답 기록 실패:', error);
        if (error.message.includes('Unauthorized')) {
          console.warn('⚠️ 로그인이 필요합니다. 오답노트 기록을 위해 로그인해주세요.');
          toast.warn('로그인이 필요합니다. 오답노트에 기록하려면 로그인해주세요.');
        } else {
          console.warn('⚠️ 오답노트 저장에 실패했습니다. 네트워크 연결을 확인해주세요.');
          toast.error('오답노트 저장에 실패했습니다.');
        }
      }
    }
  };

  // 다음 문제로 이동
  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer('');
      setIsAnswered(false);
      setShowScript(false);
      setAutoShowTranslation(false);
      stopAudio();
    } else {
      // 퀴즈 완료
      setShowResult(true);
      stopAudio();
      onComplete?.(results, score);
    }
  };

  // 퀴즈 재시작
  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedAnswer('');
    setIsAnswered(false);
    setScore(0);
    setShowResult(false);
    setResults([]);
    setShowScript(false);
    stopAudio();
  };

  // 오디오 이벤트 핸들러 설정
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      setIsPlaying(false);
    };

    const handleError = (e) => {
      console.error('Audio error:', e);
      setIsPlaying(false);
      toast.error('음성 파일을 로드할 수 없습니다.');
    };

    const handleLoadStart = () => {
      setIsPlaying(true);
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('loadstart', handleLoadStart);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('loadstart', handleLoadStart);
    };
  }, []);

  // 재생 속도 변경 시 오디오에 적용
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // 컴포넌트 언마운트 시 음성 정리
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  if (!questions.length) {
    return (
      <div className="alert alert-warning">
        일본어 리스닝 문제가 없습니다.
      </div>
    );
  }

  if (showResult) {
    const percentage = Math.round((score / questions.length) * 100);

    return (
      <div className="japanese-listening-quiz-result">
        <div className="card">
          <div className="card-header text-center">
            <h3>🎌 일본어 리스닝 퀴즈 완료!</h3>
          </div>
          <div className="card-body text-center">
            <div className="score-display mb-4">
              <div className="score-circle">
                <span className="score-number">{score}</span>
                <span className="score-total">/{questions.length}</span>
              </div>
              <p className="score-percentage">{percentage}%</p>
            </div>

            <div className="result-stats mb-4">
              <div className="row">
                <div className="col-4">
                  <div className="stat-item">
                    <div className="stat-value text-success">{score}</div>
                    <div className="stat-label">정답</div>
                  </div>
                </div>
                <div className="col-4">
                  <div className="stat-item">
                    <div className="stat-value text-danger">{questions.length - score}</div>
                    <div className="stat-label">오답</div>
                  </div>
                </div>
                <div className="col-4">
                  <div className="stat-item">
                    <div className="stat-value text-primary">{questions.length}</div>
                    <div className="stat-label">총 문제</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="result-actions">
              <button className="btn btn-primary me-2" onClick={handleRestart}>
                다시 풀기
              </button>
              <button className="btn btn-outline-secondary" onClick={() => onComplete?.(results, score)}>
                완료
              </button>
            </div>
          </div>
        </div>

        {/* 상세 결과 (번역 포함) */}
        <div className="card mt-3">
          <div className="card-header">
            <h5>📋 상세 결과</h5>
          </div>
          <div className="card-body">
            {results.map((result, index) => (
              <div key={result.questionId} className={`result-item ${result.isCorrect ? 'correct' : 'incorrect'} mb-3`}>
                <div className="d-flex align-items-start">
                  <span className={`badge me-3 ${result.isCorrect ? 'bg-success' : 'bg-danger'}`}>
                    {index + 1}
                  </span>
                  <div className="flex-grow-1">
                    <p className="mb-1">
                      <strong>주제:</strong> {result.topic}
                      {result.topic_ko && <span className="text-muted ms-2">({result.topic_ko})</span>}
                    </p>
                    <p className="mb-1">
                      <strong>질문:</strong> {result.question}
                      {result.question_ko && <span className="text-muted ms-2">({result.question_ko})</span>}
                    </p>
                    <div className="mb-2">
                      <strong className="text-muted">스크립트:</strong>
                      <div className="mt-1 p-2 bg-white border rounded" style={{ fontSize: '0.9em' }}>
                        <div>
                          <strong>일본어:</strong>
                          <div className="mt-1">
                            {result.script.split(/([A-Z]:\s)/).map((part, partIndex) => {
                              if (part.match(/^[A-Z]:\s$/)) {
                                // 발화자 표시 (A:, B:, C: 등)
                                return (
                                  <div key={partIndex} className="mt-2 mb-1">
                                    <strong style={{ color: '#0d6efd', fontSize: '0.85em' }}>{part}</strong>
                                  </div>
                                );
                              } else if (part.trim()) {
                                // 발화 내용 - 클릭 가능한 단어로 렌더링
                                return (
                                  <div key={partIndex} style={{ marginLeft: '0.8rem', marginBottom: '0.3rem', fontSize: '0.85em' }}>
                                    <em>{renderClickableText(part.trim())}</em>
                                  </div>
                                );
                              }
                              return null;
                            })}
                          </div>
                        </div>
                        {result.script_ko && (
                          <div className="mt-2 text-muted">
                            <strong>한국어:</strong>
                            <div className="mt-1">
                              {result.script_ko.split(' / ').map((sentence, sentenceIndex) => (
                                <div key={sentenceIndex} className="mt-1" style={{ marginLeft: '0.8rem', fontSize: '0.8em' }}>
                                  <strong style={{ color: '#fd7e14', fontSize: '0.9em' }}>
                                    {String.fromCharCode(65 + sentenceIndex)}:
                                  </strong>
                                  <span className="ms-1">{sentence.trim()}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="mb-0">
                      <span className={result.isCorrect ? 'text-success' : 'text-danger'}>
                        선택한 답: {result.selectedAnswer}
                      </span>
                      {!result.isCorrect && (
                        <span className="text-success ms-2">
                          (정답: {result.correctAnswer})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 단어 뜻 팝업 - 결과 화면에서도 표시 */}
        {selectedWord && (
          <WordMeaningPopup
            kana={selectedWord.kana}
            wordDataArray={selectedWord.dataArray}
            position={wordPopupPosition}
            onClose={closeWordPopup}
          />
        )}
      </div>
    );
  }

  return (
    <div className="listening-quiz-container">
      {/* 숨겨진 오디오 엘리먼트 */}
      <audio ref={audioRef} preload="none" style={{ display: 'none' }} />

      {/* 진행률 바 */}
      <div className="progress mb-4">
        <div
          className="progress-bar"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        >
          {currentIndex + 1} / {questions.length}
        </div>
      </div>

      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">🎌 {level} 일본어 리스닝 퀴즈</h5>
          <div className="d-flex align-items-center">
            <span className="badge bg-primary me-2">{currentQuestion.topic}</span>
            <button
              className={`btn btn-sm ${showTranslationToggle ? 'btn-warning' : 'btn-outline-warning'}`}
              onClick={() => setShowTranslationToggle(!showTranslationToggle)}
              title="한국어 번역 표시/숨김"
            >
              {showTranslationToggle ? '🇰🇷 번역 ON' : '🇰🇷 번역 OFF'}
            </button>
          </div>
        </div>

        <div className="card-body">
          {/* 오디오 플레이어 섹션 */}
          <div className="audio-section mb-4">
            <div className="d-flex align-items-center gap-3 mb-3">
              <button
                className={`btn ${isPlaying ? 'btn-danger' : 'btn-success'} btn-lg`}
                onClick={isPlaying ? stopAudio : playScript}
                disabled={!currentQuestion.id}
              >
                {isPlaying ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    🔊 재생 중...
                  </>
                ) : (
                  '🔊 음성 듣기'
                )}
              </button>

              <div className="playback-controls">
                <label className="form-label mb-0 me-2">재생 속도:</label>
                {[0.75, 1.0, 1.25].map(rate => (
                  <button
                    key={rate}
                    className={`btn btn-sm ${playbackRate === rate ? 'btn-primary' : 'btn-outline-primary'} me-1`}
                    onClick={() => setPlaybackRate(rate)}
                  >
                    {rate}×
                  </button>
                ))}
              </div>
            </div>

            <div className="script-hint text-muted">
              <small>
                💡 음성을 듣고 A, B, C 중에서 정답을 선택하세요. 여러 번 들을 수 있습니다.
              </small>
            </div>

            {/* 스크립트 힌트 버튼 */}
            <div className="script-controls mt-3">
              <button
                className="btn btn-outline-info btn-sm"
                onClick={() => setShowScript(!showScript)}
              >
                {showScript ? '📝 스크립트 숨기기' : '📝 스크립트 보기 (힌트)'}
              </button>

              {showScript && (
                <div className="script-display mt-2 p-3 bg-light border rounded">
                  <div>
                    <strong>일본어:</strong>
                    <div className="mt-2">
                      {currentQuestion.script.split(/([A-Z]:\s)/).map((part, index) => {
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
                  </div>
                  {autoShowTranslation && renderKoreanTranslation(currentQuestion.script) && (
                    <div className="translation-text" style={{
                      marginTop: '8px',
                      padding: '8px',
                      backgroundColor: '#e8f4f8',
                      borderLeft: '4px solid #17a2b8',
                      fontSize: '14px',
                      color: '#0c5460'
                    }}>
                      <strong>번역:</strong> {renderKoreanTranslation(currentQuestion.script)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 질문 */}
          <div className="question-section mb-4">
            <h6 className="question-text">
              {renderClickableText(currentQuestion.question)}
            </h6>
            {autoShowTranslation && renderKoreanTranslation(currentQuestion.question) && (
              <div className="translation-text" style={{
                marginTop: '8px',
                padding: '8px',
                backgroundColor: '#e8f4f8',
                borderLeft: '4px solid #17a2b8',
                fontSize: '14px',
                color: '#0c5460'
              }}>
                <strong>번역:</strong> {renderKoreanTranslation(currentQuestion.question)}
              </div>
            )}
          </div>

          {/* 선택지 */}
          <div className="options-section">
            {Object.entries(currentQuestion.options).map(([key, value]) => (
              <button
                key={key}
                className={`option-btn ${
                  selectedAnswer === key ? 'selected' : ''
                } ${
                  isAnswered
                    ? key === currentQuestion.answer
                      ? 'correct'
                      : selectedAnswer === key
                        ? 'incorrect'
                        : ''
                    : ''
                }`}
                onClick={() => handleAnswerSelect(key)}
                disabled={isAnswered}
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  padding: '1rem',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: isAnswered ? '8px' : '0' }}>
                    <span style={{ marginRight: '10px' }}>{key}.</span>
                    {isAnswered && (
                      <span>{renderClickableText(value)}</span>
                    )}
                  </div>
                  {isAnswered && renderKoreanTranslation(value) && (
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
              </button>
            ))}
          </div>

          {/* Explanation Box */}
          {isAnswered && (
            <div className={`explanation-box ${selectedAnswer === currentQuestion.answer ? 'correct' : 'incorrect'}`}>
              <div className="explanation-header">
                {selectedAnswer === currentQuestion.answer ? (
                  <span className="result-icon correct">✅ 정답!</span>
                ) : (
                  <span className="result-icon incorrect">❌ 틀렸습니다</span>
                )}
                <span className="correct-answer">정답: {currentQuestion.answer}</span>
              </div>
              {currentQuestion.explanation && (
                <p className="explanation-text">{currentQuestion.explanation}</p>
              )}
            </div>
          )}

          {/* 다음 버튼 */}
          {isAnswered && (
            <div className="text-center mt-4">
              <button className="btn btn-primary btn-lg" onClick={handleNext}>
                {currentIndex < questions.length - 1 ? '다음 문제 →' : '결과 보기 →'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 점수 표시 */}
      <div className="score-info mt-3">
        <div className="d-flex justify-content-between align-items-center">
          <span>현재 점수: <strong>{score}/{currentIndex + (isAnswered ? 1 : 0)}</strong></span>
          <span>진행률: <strong>{Math.round(((currentIndex + (isAnswered ? 1 : 0)) / questions.length) * 100)}%</strong></span>
        </div>
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

      {/* 단어 뜻 팝업 */}
      {selectedWord && (
        <WordMeaningPopup
          kana={selectedWord.kana}
          wordDataArray={selectedWord.dataArray}
          position={wordPopupPosition}
          onClose={closeWordPopup}
        />
      )}

      <style jsx>{`
        .listening-quiz-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 1rem;
        }

        .audio-section {
          background: #f8f9fa;
          border-radius: 0.5rem;
          padding: 1.5rem;
          border-left: 4px solid #0d6efd;
        }

        .playback-controls {
          display: flex;
          align-items: center;
        }

        .question-text {
          font-size: 1.2rem;
          font-weight: 600;
          color: #2c3e50;
        }

        .score-display {
          margin: 2rem 0;
        }

        .score-circle {
          width: 120px;
          height: 120px;
          border: 8px solid #0d6efd;
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1rem;
          background: #f8f9fa;
        }

        .score-number {
          font-size: 2rem;
          font-weight: bold;
          color: #0d6efd;
        }

        .score-total {
          font-size: 1rem;
          color: #6c757d;
        }

        .score-percentage {
          font-size: 1.5rem;
          font-weight: bold;
          color: #0d6efd;
        }

        .stat-item {
          text-align: center;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: bold;
        }

        .stat-label {
          font-size: 0.9rem;
          color: #6c757d;
        }

        .result-item.correct {
          border-left: 4px solid #198754;
          background: rgba(25, 135, 84, 0.05);
          padding: 1rem;
          border-radius: 0.375rem;
        }

        .result-item.incorrect {
          border-left: 4px solid #dc3545;
          background: rgba(220, 53, 69, 0.05);
          padding: 1rem;
          border-radius: 0.375rem;
        }

        .score-info {
          background: #e9ecef;
          padding: 0.75rem 1rem;
          border-radius: 0.375rem;
          font-size: 0.9rem;
        }
      `}</style>

      {/* 단어 뜻 팝업 */}
      {selectedWord && (
        <WordMeaningPopup
          kana={selectedWord.kana}
          wordDataArray={selectedWord.dataArray}
          position={wordPopupPosition}
          onClose={closeWordPopup}
        />
      )}
    </div>
  );
}