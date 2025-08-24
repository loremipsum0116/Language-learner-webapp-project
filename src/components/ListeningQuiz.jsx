import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { fetchJSON, withCreds } from '../api/client';

/**
 * 리스닝 퀴즈 컴포넌트
 * A1~C1 레벨의 Listening.json 형식 데이터를 사용
 */
export default function ListeningQuiz({ questions = [], onComplete, level = 'A1' }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [results, setResults] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showScript, setShowScript] = useState(false);
  
  const audioRef = useRef(null);
  
  const currentQuestion = questions[currentIndex];
  
  // 실제 MP3 파일 재생
  const playScript = () => {
    if (!currentQuestion?.id) return;
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    setIsPlaying(true);
    
    // 음성 파일 경로 생성 (A1_L_001.mp3 형식)
    const audioSrc = `/${level}/${level}_Listening/${level}_Listening_mix/${currentQuestion.id}.mp3`;
    
    if (audioRef.current) {
      audioRef.current.src = audioSrc;
      audioRef.current.playbackRate = playbackRate;
      
      audioRef.current.play()
        .then(() => {
          // 재생 성공
        })
        .catch((error) => {
          console.error('Audio playback failed:', error);
          setIsPlaying(false);
          toast.error('음성 재생에 실패했습니다.');
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
    
    const isCorrect = answer === currentQuestion.answer;
    const result = {
      questionId: currentQuestion.id,
      question: currentQuestion.question,
      selectedAnswer: answer,
      correctAnswer: currentQuestion.answer,
      isCorrect,
      topic: currentQuestion.topic,
      script: currentQuestion.script
    };
    
    setResults(prev => [...prev, result]);
    
    if (isCorrect) {
      setScore(prev => prev + 1);
      toast.success('정답입니다! 🎉');
    } else {
      toast.error(`틀렸습니다. 정답은 "${currentQuestion.answer}" 입니다.`);
      
      // 오답노트에 리스닝 문제 기록
      try {
        await fetchJSON('/odat-note', withCreds({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'listening',
            wrongData: {
              questionId: currentQuestion.id,
              level: level,
              topic: currentQuestion.topic,
              question: currentQuestion.question,
              script: currentQuestion.script,
              userAnswer: answer,
              correctAnswer: currentQuestion.answer,
              options: currentQuestion.options,
              audioFile: `${level}_Listening_mix/${currentQuestion.id}.mp3`
            }
          })
        }));
        console.log(`[리스닝 오답 기록 완료] ${level} - ${currentQuestion.topic}`);
      } catch (error) {
        console.error('리스닝 오답 기록 실패:', error);
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
        리스닝 문제가 없습니다.
      </div>
    );
  }
  
  if (showResult) {
    const percentage = Math.round((score / questions.length) * 100);
    
    return (
      <div className="listening-quiz-result">
        <div className="card">
          <div className="card-header text-center">
            <h3>🎧 리스닝 퀴즈 완료!</h3>
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
        
        {/* 상세 결과 */}
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
                    <p className="mb-1"><strong>주제:</strong> {result.topic}</p>
                    <p className="mb-1"><strong>질문:</strong> {result.question}</p>
                    <p className="mb-1 text-muted"><em>스크립트: "{result.script}"</em></p>
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
          <h5 className="mb-0">🎧 {level} 리스닝 퀴즈</h5>
          <span className="badge bg-primary">{currentQuestion.topic}</span>
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
                  <strong>스크립트:</strong> <em>"{currentQuestion.script}"</em>
                </div>
              )}
            </div>
          </div>
          
          {/* 질문 */}
          <div className="question-section mb-4">
            <h6 className="question-text">
              {currentQuestion.question}
            </h6>
          </div>
          
          
          {/* 선택지 */}
          <div className="options-section">
            {Object.entries(currentQuestion.options).map(([key, value]) => (
              <button
                key={key}
                className={`btn btn-outline-primary btn-lg d-block w-100 mb-2 text-center ${
                  selectedAnswer === key ? (
                    key === currentQuestion.answer ? 'btn-success' : 'btn-danger'
                  ) : ''
                } ${
                  isAnswered && key === currentQuestion.answer ? 'btn-success' : ''
                }`}
                onClick={() => handleAnswerSelect(key)}
                disabled={isAnswered}
                style={{ fontSize: '1.5rem', fontWeight: 'bold', padding: '1rem' }}
              >
                {key}
                {isAnswered && key === currentQuestion.answer && (
                  <span className="badge bg-light text-success ms-2">✓ 정답</span>
                )}
                {isAnswered && selectedAnswer === key && key !== currentQuestion.answer && (
                  <span className="badge bg-light text-danger ms-2">✗ 오답</span>
                )}
              </button>
            ))}
          </div>
          
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
    </div>
  );
}