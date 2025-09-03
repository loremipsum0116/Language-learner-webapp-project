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
      
      {/* 레벨별 리스닝 연습 카드 */}
      <div className="row mb-4">
        {['A1', 'A2', 'B1', 'B2', 'C1'].map((lv) => (
          <div key={lv} className="col-md-4 mb-3">
            <div className={`card h-100 ${level === lv ? 'border-primary' : ''}`}>
              <div className="card-body text-center">
                <h5 className="card-title">
                  🎧 {lv} 리스닝
                </h5>
                <p className="card-text text-muted">
                  {lv === level ? questions.length : '200'}개 문제
                </p>
                <p className="card-text small text-muted">
                  {lv === 'A1' && '기초 일상 대화'}
                  {lv === 'A2' && '간단한 상황 대화'}
                  {lv === 'B1' && '일반적인 주제 대화'}
                  {lv === 'B2' && '복잡한 내용 이해'}
                  {lv === 'C1' && '전문적인 내용 이해'}
                </p>
                <Link
                  to={`/listening/list?level=${lv}`}
                  className={`btn ${level === lv ? 'btn-primary' : 'btn-outline-primary'}`}
                >
                  📋 목록 보기
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      
    </div>
  );
}