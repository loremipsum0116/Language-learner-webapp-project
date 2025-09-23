import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import ListeningQuiz from '../components/ListeningQuiz';

/**
 * 일본어 리스닝 학습 페이지
 * N5_Listening.json 등의 데이터를 로드하여 리스닝 퀴즈 제공
 */
export default function JapaneseListening() {
  const [searchParams] = useSearchParams();
  const level = searchParams.get('level') || 'N5';

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
      // public 폴더의 N5_Listening.json 파일을 로드
      const response = await fetch(`/${level}/${level}_Listening/${level}_Listening.json`);

      if (!response.ok) {
        throw new Error(`Failed to load ${level} listening questions`);
      }

      const data = await response.json();
      setQuestions(Array.isArray(data) ? data : []);

      toast.success(`${level} 리스닝 문제 ${data.length}개를 불러왔습니다.`);
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

  // JLPT 레벨 설명
  const getLevelDescription = (lv) => {
    switch(lv) {
      case 'N5': return '기초적인 일본어';
      case 'N4': return '기본적인 일본어를 어느 정도 이해';
      case 'N3': return '일상적인 장면의 일본어를 어느 정도 이해';
      case 'N2': return '일상적인 장면의 일본어 이해와 더불어 폭넓은 장면의 일본어를 어느 정도 이해';
      case 'N1': return '폭넓은 장면에서 사용되는 일본어를 이해';
      default: return '';
    }
  };

  // JLPT 레벨 색상
  const getLevelColor = (lv) => {
    switch(lv) {
      case 'N5': return 'success';
      case 'N4': return 'info';
      case 'N3': return 'warning';
      case 'N2': return 'danger';
      case 'N1': return 'dark';
      default: return 'primary';
    }
  };

  if (loading) {
    return (
      <div className="container py-4">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">리스닝 문제를 불러오는 중...</p>
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
          <h2>🎌 JLPT {level} 리스닝 퀴즈</h2>
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
              <li className="breadcrumb-item active">일본어 리스닝</li>
            </ol>
          </nav>
          <h1 className="display-6">🎌 일본어 리스닝 연습</h1>
          <p className="text-muted">원어민 음성을 들으며 일본어 듣기 실력을 향상시켜보세요.</p>
        </div>
      </div>

      {/* 레벨 선택 */}
      <div className="row mb-4">
        <div className="col">
          <div className="card">
            <div className="card-header">
              <h5>📊 JLPT 레벨 선택</h5>
            </div>
            <div className="card-body">
              <div className="btn-group" role="group">
                {['N5', 'N4', 'N3', 'N2', 'N1'].map((lv) => (
                  <Link
                    key={lv}
                    to={`/japanese-listening?level=${lv}`}
                    className={`btn btn-${level === lv ? getLevelColor(lv) : `outline-${getLevelColor(lv)}`}`}
                  >
                    {lv}
                  </Link>
                ))}
              </div>
              <p className="mt-2 mb-0 text-muted">
                현재 선택된 레벨: <strong className={`text-${getLevelColor(level)}`}>{level}</strong> ({questions.length}개 문제)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 레벨별 리스닝 연습 카드 */}
      <div className="row mb-4">
        {['N5', 'N4', 'N3', 'N2', 'N1'].map((lv) => (
          <div key={lv} className="col-md-4 mb-3">
            <div className={`card h-100 ${level === lv ? `border-${getLevelColor(lv)}` : ''}`}>
              <div className={`card-header bg-${getLevelColor(lv)} bg-opacity-10`}>
                <h5 className={`card-title text-center mb-0 text-${getLevelColor(lv)}`}>
                  JLPT {lv}
                </h5>
              </div>
              <div className="card-body text-center">
                <h6 className="card-subtitle mb-2 text-muted">
                  🎧 리스닝 연습
                </h6>
                <p className="card-text small text-muted">
                  {getLevelDescription(lv)}
                </p>
                <p className="card-text">
                  <span className="badge bg-secondary">
                    {lv === level ? questions.length : (lv === 'N1' || lv === 'N2' ? '100' : '200')}개 문제
                  </span>
                </p>
                <div className="d-grid gap-2">
                  <Link
                    to={`/japanese-listening/list?level=${lv}`}
                    className={`btn btn-${level === lv ? getLevelColor(lv) : `outline-${getLevelColor(lv)}`}`}
                  >
                    📋 목록 보기
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 학습 팁 */}
      <div className="row">
        <div className="col">
          <div className="card bg-light">
            <div className="card-body">
              <h5 className="card-title">💡 학습 팁</h5>
              <ul className="mb-0">
                <li>매일 조금씩 꾸준히 연습하는 것이 중요합니다</li>
                <li>모르는 단어가 있어도 먼저 전체 내용을 들어보세요</li>
                <li>반복해서 들으면 자연스럽게 귀가 열립니다</li>
                <li>섀도잉(들리는 음성을 따라 말하기)도 효과적입니다</li>
                <li>JLPT 시험에서는 속도감 있게 문제를 푸는 것이 중요합니다</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}