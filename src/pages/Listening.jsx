import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { fetchJSON, withCreds } from '../api/client';
import { toast } from 'react-toastify';
import ListeningQuiz from '../components/ListeningQuiz';

/**
 * 리스닝 학습 페이지
 * A1_Listening.json 등의 데이터를 로드하여 리스닝 퀴즈 제공
 */
export default function Listening() {
  const [searchParams] = useSearchParams();
  const level = searchParams.get('level') || 'A1';
  
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizSettings, setQuizSettings] = useState({
    questionCount: 10,
    randomOrder: true
  });
  
  // 레벨별 데이터 로드
  useEffect(() => {
    loadQuestions();
  }, [level]);
  
  const loadQuestions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // public 폴더의 A1_Listening.json 파일을 로드
      const response = await fetch(`/${level}/${level}_Listening/${level}_Listening.json`);
      
      if (!response.ok) {
        throw new Error(`Failed to load ${level} listening questions`);
      }
      
      const data = await response.json();
      setQuestions(Array.isArray(data) ? data : []);
      
      toast.success(`${level} 리스닝 문제 ${data.length}개가 로드되었습니다.`);
    } catch (err) {
      console.error('Error loading listening questions:', err);
      setError(`${level} 리스닝 문제를 불러오는 중 오류가 발생했습니다: ${err.message}`);
      toast.error('리스닝 문제를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  // 퀴즈 문제 선택 및 시작
  const startQuiz = () => {
    if (questions.length === 0) {
      toast.error('문제가 없습니다.');
      return;
    }
    
    let selected = [...questions];
    
    // 랜덤 순서 적용
    if (quizSettings.randomOrder) {
      selected = selected.sort(() => Math.random() - 0.5);
    }
    
    // 문제 수 제한
    if (quizSettings.questionCount > 0 && quizSettings.questionCount < selected.length) {
      selected = selected.slice(0, quizSettings.questionCount);
    }
    
    setSelectedQuestions(selected);
    setQuizStarted(true);
  };
  
  // 퀴즈 완료 처리
  const handleQuizComplete = (results, score) => {
    console.log('Quiz completed:', { results, score });
    
    // 여기서 결과를 서버에 저장하거나 다른 처리를 할 수 있습니다
    toast.success(`퀴즈 완료! 점수: ${score}/${results.length}`);
  };
  
  // 퀴즈 다시 시작
  const resetQuiz = () => {
    setQuizStarted(false);
    setSelectedQuestions([]);
  };
  
  if (loading) {
    return (
      <div className="container py-4">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">리스닝 문제를 로드하는 중...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger">
          <h4>오류가 발생했습니다</h4>
          <p>{error}</p>
          <button className="btn btn-outline-danger" onClick={loadQuestions}>
            다시 시도
          </button>
        </div>
      </div>
    );
  }
  
  if (quizStarted) {
    return (
      <div className="container py-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2>🎧 {level} 리스닝 퀴즈</h2>
          <button className="btn btn-outline-secondary" onClick={resetQuiz}>
            ← 설정으로 돌아가기
          </button>
        </div>
        <ListeningQuiz 
          questions={selectedQuestions} 
          onComplete={handleQuizComplete}
          level={level}
        />
      </div>
    );
  }
  
  return (
    <div className="container py-4">
      {/* 헤더 */}
      <div className="row mb-4">
        <div className="col">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb">
              <li className="breadcrumb-item"><Link to="/">홈</Link></li>
              <li className="breadcrumb-item active">리스닝</li>
            </ol>
          </nav>
          <h1 className="display-6">🎧 리스닝 연습</h1>
          <p className="text-muted">원어민 음성을 듣고 청취력을 기르며 발음을 익혀보세요.</p>
        </div>
      </div>
      
      {/* 레벨 선택 */}
      <div className="row mb-4">
        <div className="col">
          <div className="card">
            <div className="card-header">
              <h5>📊 레벨 선택</h5>
            </div>
            <div className="card-body">
              <div className="btn-group" role="group">
                {['A1', 'A2', 'B1', 'B2', 'C1'].map((lv) => (
                  <Link
                    key={lv}
                    to={`/listening?level=${lv}`}
                    className={`btn ${level === lv ? 'btn-primary' : 'btn-outline-primary'}`}
                  >
                    {lv}
                  </Link>
                ))}
              </div>
              <p className="mt-2 mb-0 text-muted">
                현재 선택된 레벨: <strong>{level}</strong> ({questions.length}개 문제)
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* 퀴즈 설정 */}
      <div className="row mb-4">
        <div className="col-md-8">
          <div className="card">
            <div className="card-header">
              <h5>⚙️ 퀴즈 설정</h5>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">문제 수</label>
                  <select 
                    className="form-select"
                    value={quizSettings.questionCount}
                    onChange={(e) => setQuizSettings(prev => ({
                      ...prev,
                      questionCount: parseInt(e.target.value)
                    }))}
                  >
                    <option value={5}>5문제</option>
                    <option value={10}>10문제</option>
                    <option value={20}>20문제</option>
                    <option value={0}>전체 ({questions.length}문제)</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">문제 순서</label>
                  <div className="form-check form-switch mt-2">
                    <input 
                      className="form-check-input"
                      type="checkbox"
                      checked={quizSettings.randomOrder}
                      onChange={(e) => setQuizSettings(prev => ({
                        ...prev,
                        randomOrder: e.target.checked
                      }))}
                    />
                    <label className="form-check-label">
                      랜덤 순서
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="mt-4">
                <button 
                  className="btn btn-success btn-lg"
                  onClick={startQuiz}
                  disabled={questions.length === 0}
                >
                  🎧 리스닝 퀴즈 시작
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <h6>📋 퀴즈 정보</h6>
            </div>
            <div className="card-body">
              <ul className="list-unstyled mb-0">
                <li>📊 <strong>레벨:</strong> {level}</li>
                <li>📝 <strong>총 문제:</strong> {questions.length}개</li>
                <li>🎯 <strong>선택한 문제:</strong> {
                  quizSettings.questionCount === 0 ? questions.length : 
                  Math.min(quizSettings.questionCount, questions.length)
                }개</li>
                <li>🔀 <strong>순서:</strong> {quizSettings.randomOrder ? '랜덤' : '순차'}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      {/* 문제 미리보기 */}
      {questions.length > 0 && (
        <div className="row">
          <div className="col">
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5>📝 문제 미리보기</h5>
                <span className="badge bg-primary">{questions.length}개 문제</span>
              </div>
              <div className="card-body">
                <div className="row">
                  {questions.slice(0, 6).map((q, index) => (
                    <div key={q.id} className="col-md-6 mb-3">
                      <div className="border rounded p-3">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="badge bg-secondary">{q.topic}</span>
                          <small className="text-muted">{q.id}</small>
                        </div>
                        <p className="mb-2 fw-semibold">{q.question}</p>
                        <p className="mb-0 text-muted small">
                          <em>"{q.script.slice(0, 50)}..."</em>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {questions.length > 6 && (
                  <p className="text-center text-muted mt-3">
                    ... 그 외 {questions.length - 6}개 문제
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {questions.length === 0 && !loading && (
        <div className="alert alert-info">
          <h4>문제가 없습니다</h4>
          <p>{level} 레벨의 리스닝 문제가 아직 준비되지 않았습니다.</p>
          <p>다른 레벨을 선택해주세요.</p>
        </div>
      )}
    </div>
  );
}