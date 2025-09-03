// src/pages/WrongAnswerQuiz.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { fetchJSON, withCreds } from "../api/client";

export default function WrongAnswerQuiz() {
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    loadQuiz();
  }, []);

  const loadQuiz = async () => {
    setLoading(true);
    try {
      const { data } = await fetchJSON("/srs/wrong-answers/quiz", withCreds());
      if (!data || data.length === 0) {
        alert("복습할 오답노트가 없습니다.");
        navigate("/srs/wrong-answers");
        return;
      }
      setQuiz(data);
    } catch (error) {
      console.error('Failed to load quiz:', error);
      alert("퀴즈 로드에 실패했습니다.");
      navigate("/srs/wrong-answers");
    } finally {
      setLoading(false);
    }
  };

  const currentQuestion = quiz[currentIndex];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userAnswer.trim()) return;

    const correct = userAnswer.trim().toLowerCase() === currentQuestion.lemma.toLowerCase();
    setIsCorrect(correct);
    setShowResult(true);

    if (correct) {
      try {
        // 오답노트에서 제거
        await fetchJSON(`/srs/wrong-answers/${currentQuestion.vocabId}/complete`, withCreds({
          method: 'POST'
        }));
        setCompletedCount(prev => prev + 1);
      } catch (error) {
        console.error('Failed to complete wrong answer:', error);
      }
    }
  };

  const handleNext = () => {
    if (currentIndex < quiz.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setUserAnswer("");
      setShowResult(false);
    } else {
      // 퀴즈 완료
      const completionMessage = `오답노트 복습 완료!\n정답: ${completedCount}개\n틀림: ${quiz.length - completedCount}개`;
      alert(completionMessage);
      navigate("/srs/wrong-answers");
    }
  };

  const handleSkip = () => {
    handleNext();
  };

  if (loading) {
    return (
      <main className="container py-4 text-center">
        <div className="spinner-border" role="status" />
        <p className="mt-2">퀴즈를 불러오는 중...</p>
      </main>
    );
  }

  if (quiz.length === 0) {
    return (
      <main className="container py-4 text-center">
        <h3>복습할 오답노트가 없습니다</h3>
        <button 
          className="btn btn-primary mt-3"
          onClick={() => navigate("/srs/wrong-answers")}
        >
          오답노트로 돌아가기
        </button>
      </main>
    );
  }

  const progress = ((currentIndex + 1) / quiz.length) * 100;

  return (
    <main className="container py-4">
      <div className="row justify-content-center">
        <div className="col-md-8">
          {/* 진행률 */}
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h4>📝 오답노트 복습</h4>
              <span className="badge bg-primary">
                {currentIndex + 1} / {quiz.length}
              </span>
            </div>
            <div className="progress mb-2">
              <div 
                className="progress-bar" 
                style={{width: `${progress}%`}}
              />
            </div>
            <div className="text-center">
              <small className="text-muted">
                정답: {completedCount}개 | 
                복습 윈도우 마감: {dayjs(currentQuestion.reviewWindowEnd).format('MM/DD HH:mm')}
              </small>
            </div>
          </div>

          {/* 문제 */}
          <div className="card">
            <div className="card-header">
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-warning">
                  ⚠️ {currentQuestion.attempts}회 틀림
                </span>
                <span className="text-muted">
                  {dayjs(currentQuestion.wrongAt).format('MM/DD HH:mm')}에 틀림
                </span>
              </div>
            </div>
            <div className="card-body">
              {/* 한국어 뜻 */}
              <div className="mb-4">
                <h4 className="text-center text-primary">
                  {currentQuestion.koGloss || '번역 정보 없음'}
                </h4>
                {currentQuestion.example && (
                  <p className="text-center text-muted mt-2">
                    <em>"{currentQuestion.example}"</em>
                  </p>
                )}
              </div>

              {/* 답안 입력 */}
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="answer" className="form-label">
                    영어 단어를 입력하세요:
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-lg text-center"
                    id="answer"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    disabled={showResult}
                    placeholder="답안을 입력하세요..."
                    autoComplete="off"
                    autoFocus
                  />
                </div>

                {!showResult ? (
                  <div className="d-flex gap-2">
                    <button 
                      type="submit" 
                      className="btn btn-primary flex-grow-1"
                      disabled={!userAnswer.trim()}
                    >
                      제출
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-outline-secondary"
                      onClick={handleSkip}
                    >
                      건너뛰기
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    {/* 결과 표시 */}
                    <div className={`alert ${isCorrect ? 'alert-success' : 'alert-danger'}`}>
                      <h5 className="mb-2">
                        {isCorrect ? '🎉 정답!' : '❌ 틀렸습니다'}
                      </h5>
                      <p className="mb-0">
                        <strong>정답:</strong> {currentQuestion.lemma}
                        <span className="ms-2 text-muted">({currentQuestion.pos})</span>
                      </p>
                      {isCorrect && (
                        <small className="text-muted d-block mt-1">
                          오답노트에서 제거되었습니다
                        </small>
                      )}
                    </div>

                    <button 
                      className="btn btn-primary"
                      onClick={handleNext}
                    >
                      {currentIndex < quiz.length - 1 ? '다음 문제' : '완료'}
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* 하단 정보 */}
          <div className="text-center mt-3">
            <button 
              className="btn btn-outline-secondary"
              onClick={() => navigate("/srs/wrong-answers")}
            >
              오답노트로 돌아가기
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}