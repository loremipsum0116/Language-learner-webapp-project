// src/components/TestModal.jsx
import React from 'react';

export default function TestModal({ show, onClose, onPick }) {
  console.log('[TestModal] 렌더링:', { show });
  
  if (!show) return null;

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">테스트 모달</h5>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>

          <div className="modal-body">
            <p>이 모달이 보이면 기본 모달 기능은 작동합니다.</p>
            <p>원래 모달에서 API 호출 문제가 있을 수 있습니다.</p>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              닫기
            </button>
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={() => {
                alert('테스트 완료');
                onClose?.();
              }}
            >
              테스트
            </button>
          </div>
        </div>
      </div>

      <div className="modal-backdrop fade show" />
    </div>
  );
}