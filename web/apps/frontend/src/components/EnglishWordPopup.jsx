import React from 'react';
import { createPortal } from 'react-dom';

/**
 * 영어 단어 뜻을 보여주는 팝업 컴포넌트 (동음이의어 지원)
 */
export default function EnglishWordPopup({ word, definitions, position, onClose }) {
  if (!word || !definitions || definitions.length === 0) return null;

  const popupContent = (
    <>
      {/* 오버레이 */}
      <div
        className="word-popup-overlay"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          zIndex: 9999
        }}
      />

      {/* 팝업 창 */}
      <div
        className="word-popup"
        style={{
          position: 'fixed',
          top: Math.min(position.y + 10, window.innerHeight - 200), // 화면 하단을 벗어나지 않도록
          left: Math.min(position.x, window.innerWidth - 320), // 화면 우측을 벗어나지 않도록
          backgroundColor: 'white',
          border: '2px solid #0d6efd',
          borderRadius: '8px',
          padding: '12px',
          maxWidth: '300px',
          minWidth: '200px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 10000,
          fontSize: '14px'
        }}
      >
        {/* 헤더 */}
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h6 className="mb-0" style={{ color: '#0d6efd', fontWeight: 'bold' }}>
            {word}
            <span className="text-muted ms-2" style={{ fontSize: '12px', fontWeight: 'normal' }}>
              ({definitions.length}개 의미)
            </span>
          </h6>
          <button
            onClick={onClose}
            className="btn btn-sm"
            style={{
              color: '#6c757d',
              padding: '0 4px',
              fontSize: '16px',
              lineHeight: '1'
            }}
          >
            ×
          </button>
        </div>

        {/* 여러 뜻들 */}
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {definitions.map((wordData, index) => (
            <div key={index} className="mb-3" style={{
              paddingBottom: '12px',
              borderBottom: index < definitions.length - 1 ? '1px solid #e9ecef' : 'none'
            }}>
              {/* Lemma (원형과 변형) */}
              <div className="mb-1">
                <strong style={{ color: '#2c3e50', fontSize: '16px' }}>
                  {wordData.lemma}
                </strong>
              </div>

              {/* 품사와 레벨 */}
              <div className="mb-2">
                {wordData.pos && (
                  <span className="badge bg-secondary me-1" style={{ fontSize: '10px' }}>
                    {wordData.pos}
                  </span>
                )}
                {wordData.level && (
                  <span className="badge bg-primary" style={{ fontSize: '10px' }}>
                    {wordData.level}
                  </span>
                )}
              </div>

              {/* 한국어 뜻 */}
              <div className="mb-2">
                <strong style={{ color: '#198754', fontSize: '13px' }}>뜻:</strong>
                <div style={{ marginTop: '2px', color: '#2c3e50', fontSize: '13px' }}>
                  {wordData.koGloss}
                </div>
              </div>

              {/* 예문 */}
              {wordData.koExample && (
                <div style={{
                  backgroundColor: '#f8f9fa',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  borderLeft: '3px solid #fd7e14',
                  fontSize: '12px'
                }}>
                  <strong>예문:</strong><br />
                  {wordData.koExample}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );

  // Portal을 사용하여 document.body에 직접 렌더링
  return createPortal(popupContent, document.body);
}