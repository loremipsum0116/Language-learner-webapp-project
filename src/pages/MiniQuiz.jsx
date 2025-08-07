// src/components/MiniQuiz.jsx
import React, { useState } from 'react';
import { fetchJSON, withCreds } from '../api/client';
import Pron from './Pron';

export default function MiniQuiz({ batch, onDone }) {
  const [idx, setIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const current = batch[idx];

  const submit = async () => {
    if (!current || isSubmitting) return;
    
    setIsSubmitting(true);
    const correct = userAnswer === current.answer;

    try {
      // 정답/오답 결과를 서버에 전송합니다.
      await fetchJSON('/quiz/answer', withCreds({
        method: 'POST',
        body: JSON.stringify({ cardId: current.cardId, correct }),
      }));
    } catch (e) {
      console.error("퀴즈 답변 제출 실패:", e);
      alert('답변을 기록하는 중 오류가 발생했습니다.');
    } finally {
      setFeedback({ status: correct ? 'pass' : 'fail', answer: current.answer });
      setIsSubmitting(false);
    }
  };

  const next = () => {
    if (idx < batch.length - 1) {
      setIdx(i => i + 1);
      setUserAnswer(null);
      setFeedback(null);
    } else {
      // 배치의 모든 퀴즈가 끝나면 onDone 콜백을 호출합니다.
      onDone();
    }
  };

  if (!current) return <p>퀴즈 로딩 중...</p>;

  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between">
        <strong>미니 퀴즈</strong>
        <span className="text-muted">{idx + 1} / {batch.length}</span>
      </div>
      <div className="card-body text-center p-4">
        <h2 className="display-5 mb-1" lang="en">{current.question}</h2>
        <Pron ipa={current.pron?.ipa} ipaKo={current.pron?.ipaKo} />

        {!feedback && (
          <div className="d-grid gap-2 col-8 mx-auto mt-3">
            {current.options?.map(opt => (
              <button
                key={opt}
                className={`btn btn-lg ${userAnswer === opt ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setUserAnswer(opt)}
                disabled={isSubmitting}
              >
                {opt}
              </button>
            ))}
            <button
              className="btn btn-success btn-lg mt-2"
              disabled={!userAnswer || isSubmitting}
              onClick={submit}
            >
              {isSubmitting ? '처리 중…' : '제출하기'}
            </button>
          </div>
        )}

        {feedback && (
          <div className={`mt-3 p-3 rounded ${feedback.status === 'pass' ? 'bg-success-subtle' : 'bg-danger-subtle'}`}>
            <h5>{feedback.status === 'pass' ? '정답입니다!' : '오답입니다'}</h5>
            <p className="lead">정답: {feedback.answer}</p>
          </div>
        )}
      </div>
      <div className="card-footer p-3">
        {feedback && (
          <button className="btn btn-primary w-100" onClick={next}>
            {idx < batch.length - 1 ? '다음 →' : '다음 학습으로'}
          </button>
        )}
      </div>
    </div>
  );
}