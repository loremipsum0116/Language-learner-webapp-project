// src/pages/LearnStart.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function LearnStart() {
  const nav = useNavigate();
  return (
    <main className="container py-5" style={{ maxWidth: 680 }}>
      <h2 className="mb-4">SRS 학습 시작</h2>
      <div className="card">
        <div className="card-body p-4">
          <p className="text-muted mb-4">방법을 선택하세요.</p>
          <div className="d-grid gap-3">
            <button className="btn btn-primary btn-lg" onClick={() => nav('/learn/vocab')}>
              전체 문제 풀기
            </button>
            <button className="btn btn-outline-primary btn-lg" onClick={() => nav('/my-wordbook')}>
              내 단어장에 가서 선택하기
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
