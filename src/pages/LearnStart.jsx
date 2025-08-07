// src/pages/LearnStart.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchJSON, withCreds } from '../api/client';

export default function LearnStart() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleStartSession = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. 백엔드에 새로운 학습 세션 배치를 생성하도록 요청합니다.
      await fetchJSON('/flash/start', withCreds({ method: 'POST' }));
      
      // 2. 성공하면 실제 학습 화면으로 이동합니다.
      nav('/learn/vocab?mode=batch'); // 새로운 'batch' 모드로 이동
    } catch (e) {
      console.error("학습 세션 시작 실패:", e);
      setError('학습 세션을 시작하지 못했습니다. 다시 시도해 주세요.');
      setLoading(false);
    }
  };

  return (
    <main className="container py-5" style={{ maxWidth: 680 }}>
      <h2 className="mb-4">SRS 학습 시작</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="card">
        <div className="card-body p-4">
          <p className="text-muted mb-4">
            오늘 학습할 단어들을 10개 단위로 나누어 플래시카드와 퀴즈를 진행합니다.
          </p>
          <div className="d-grid gap-3">
            <button 
              className="btn btn-primary btn-lg" 
              onClick={handleStartSession}
              disabled={loading}
            >
              {loading ? '준비 중...' : '자동 학습 시작'}
            </button>
            <button 
              className="btn btn-outline-secondary btn-lg" 
              onClick={() => nav('/my-wordbook')}
            >
              내 단어장에서 선택하여 학습
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}