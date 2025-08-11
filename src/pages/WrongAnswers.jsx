// src/pages/WrongAnswers.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import { fetchJSON, withCreds } from "../api/client";

dayjs.locale("ko");

function formatTimeRemaining(hours) {
  if (hours <= 0) return "지금";
  if (hours < 24) return `${Math.ceil(hours)}시간 후`;
  const days = Math.floor(hours / 24);
  return `${days}일 후`;
}

function getStatusBadge(status) {
  switch (status) {
    case 'available':
      return <span className="badge bg-success">복습 가능</span>;
    case 'overdue':
      return <span className="badge bg-danger">복습 지남</span>;
    case 'pending':
      return <span className="badge bg-secondary">대기 중</span>;
    default:
      return <span className="badge bg-light">알 수 없음</span>;
  }
}

export default function WrongAnswers() {
  const [wrongAnswers, setWrongAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [includeCompleted, setIncludeCompleted] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const { data } = await fetchJSON(
        `/srs/wrong-answers?includeCompleted=${includeCompleted}`, 
        withCreds()
      );
      setWrongAnswers(data || []);
    } catch (error) {
      console.error('Failed to load wrong answers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, [includeCompleted]);

  const handleCompleteWrongAnswer = async (vocabId) => {
    try {
      await fetchJSON(`/srs/wrong-answers/${vocabId}/complete`, withCreds({
        method: 'POST'
      }));
      await reload(); // 목록 새로고침
    } catch (error) {
      alert(`복습 완료 처리 실패: ${error.message}`);
    }
  };

  const availableCount = wrongAnswers.filter(wa => wa.canReview).length;
  const pendingCount = wrongAnswers.filter(wa => wa.reviewStatus === 'pending').length;

  return (
    <main className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>📝 오답노트</h2>
        <Link to="/srs" className="btn btn-outline-secondary">
          ← SRS 대시보드
        </Link>
      </div>

      {/* 요약 정보 */}
      <div className="row mb-4">
        <div className="col-md-4">
          <div className="card text-center">
            <div className="card-body">
              <h3 className="text-success">{availableCount}</h3>
              <p className="mb-0">복습 가능</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-center">
            <div className="card-body">
              <h3 className="text-secondary">{pendingCount}</h3>
              <p className="mb-0">대기 중</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-center">
            <div className="card-body">
              <h3 className="text-primary">{wrongAnswers.length}</h3>
              <p className="mb-0">전체</p>
            </div>
          </div>
        </div>
      </div>

      {/* 액션 버튼들 */}
      <div className="d-flex gap-2 mb-4">
        {availableCount > 0 && (
          <Link to="/srs/wrong-answers/quiz" className="btn btn-warning">
            🎯 복습하기 ({availableCount}개)
          </Link>
        )}
        <div className="form-check form-switch">
          <input
            className="form-check-input"
            type="checkbox"
            id="includeCompleted"
            checked={includeCompleted}
            onChange={(e) => setIncludeCompleted(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="includeCompleted">
            완료된 항목 포함
          </label>
        </div>
      </div>

      {loading ? (
        <div className="text-center">
          <div className="spinner-border" role="status" />
        </div>
      ) : wrongAnswers.length === 0 ? (
        <div className="text-center text-muted py-5">
          <h4>🎉 오답노트가 비어있습니다!</h4>
          <p>모든 문제를 정확히 풀고 있군요.</p>
        </div>
      ) : (
        <div className="list-group">
          {wrongAnswers.map((wa, index) => (
            <div key={wa.id} className="list-group-item">
              <div className="d-flex justify-content-between align-items-start">
                <div className="flex-grow-1">
                  <h5 className="mb-2">
                    {wa.vocab.lemma}
                    <span className="ms-2 text-muted">({wa.vocab.pos})</span>
                  </h5>
                  <p className="mb-2">
                    {wa.vocab.dictMeta?.examples?.[0]?.koGloss || '번역 정보 없음'}
                  </p>
                  <div className="d-flex align-items-center gap-3">
                    {getStatusBadge(wa.reviewStatus)}
                    <small className="text-muted">
                      틀린 횟수: {wa.attempts}회
                    </small>
                    <small className="text-muted">
                      틀린 시각: {dayjs(wa.wrongAt).format('MM/DD HH:mm')}
                    </small>
                    {wa.reviewStatus === 'pending' && (
                      <small className="text-info">
                        복습 가능: {formatTimeRemaining(wa.timeUntilReview)}
                      </small>
                    )}
                    {wa.isCompleted && (
                      <small className="text-success">
                        완료: {dayjs(wa.reviewedAt).format('MM/DD HH:mm')}
                      </small>
                    )}
                  </div>
                </div>
                <div>
                  {wa.canReview && !wa.isCompleted && (
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => handleCompleteWrongAnswer(wa.vocab.id)}
                    >
                      ✅ 복습 완료
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}