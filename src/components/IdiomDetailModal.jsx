// src/components/IdiomDetailModal.jsx
import React from 'react';
import { toast } from 'react-toastify';

const getCefrBadgeColor = (level) => {
  switch (level) {
    case 'A1': return 'bg-danger';
    case 'A2': return 'bg-warning text-dark';
    case 'B1': return 'bg-success';
    case 'B2': return 'bg-info text-dark';
    case 'C1': return 'bg-primary';
    case 'C2': return 'bg-dark';
    // 한국어 레벨
    case '입문': return 'bg-danger';
    case '기초': return 'bg-warning text-dark';
    case '중급': return 'bg-success';
    case '중상급': return 'bg-info text-dark';
    case '고급': return 'bg-primary';
    case '상급': return 'bg-primary';
    case '최고급': return 'bg-dark';
    default: return 'bg-secondary';
  }
};

export default function IdiomDetailModal({
  idiom,
  onClose,
  onPlayUrl,
  playingAudio,
  onAddSRS,
}) {
  const isIdiomPlaying = playingAudio?.type === 'idiom' && playingAudio?.id === idiom.id;

  return (
    <div className="modal show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <div className="d-flex align-items-center flex-wrap">
              <h4 className="modal-title mb-0 me-2" lang="en">{idiom?.idiom}</h4>
              <div className="d-flex gap-1">
                {idiom.level && <span className={`badge ${getCefrBadgeColor(idiom.level)}`}>{idiom.level}</span>}
                <span className={`badge ${idiom.category?.includes('숙어') ? 'bg-success' : 'bg-info'} fst-italic`}>
                  {idiom.category?.includes('숙어') ? '숙어' : '구동사'}
                </span>
              </div>
            </div>
            <div className="ms-auto d-flex align-items-center gap-1">
              {idiom.audio && (
                <>
                  {idiom.audio.word && (
                    <button
                      className="btn btn-sm btn-outline-primary rounded-circle d-flex align-items-center justify-content-center"
                      style={{ width: '32px', height: '32px' }}
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (onPlayUrl) {
                          onPlayUrl(`/${idiom.audio.word}`);
                        }
                      }}
                      aria-label="숙어 단어 발음"
                      title="숙어 발음"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={`bi ${isIdiomPlaying ? 'bi-pause-fill' : 'bi-play-fill'}`} viewBox="0 0 16 16">
                        {isIdiomPlaying ? (
                          <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z" />
                        ) : (
                          <path d="M11.596 8.697l-6.363 3.692A.5.5 0 0 1 4 11.942V4.058a.5.5 0 0 1 .777-.416l6.363 3.692a.5.5 0 0 1 0 .863z" />
                        )}
                      </svg>
                    </button>
                  )}
                  {idiom.audio.gloss && (
                    <button
                      className="btn btn-sm btn-outline-success rounded-circle d-flex align-items-center justify-content-center"
                      style={{ width: '32px', height: '32px' }}
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (onPlayUrl) {
                          onPlayUrl(`/${idiom.audio.gloss}`);
                        }
                      }}
                      aria-label="한국어 뜻 발음"
                      title="뜻 발음"
                    >
                      🇰🇷
                    </button>
                  )}
                  {idiom.audio.example && (
                    <button
                      className="btn btn-sm btn-outline-info rounded-circle d-flex align-items-center justify-content-center"
                      style={{ width: '32px', height: '32px' }}
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (onPlayUrl) {
                          onPlayUrl(`/${idiom.audio.example}`);
                        }
                      }}
                      aria-label="예시 발음"
                      title="예시 발음"
                    >
                      💡
                    </button>
                  )}
                </>
              )}
              <button type="button" className="btn-close ms-2" aria-label="닫기" onClick={onClose} />
            </div>
          </div>

          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {/* 한국어 뜻 표시 */}
            {idiom.korean_meaning && (
              <div className="mb-3">
                <div className="ps-2 mt-2">
                  <p className="mb-1">
                    <strong>{idiom.korean_meaning}</strong>
                  </p>
                </div>
              </div>
            )}
            
            {/* 영어 예문과 한국어 뜻 */}
            {(idiom.example_english || idiom.example_korean) && (
              <div className="mt-3 border-top pt-3">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h6 className="fw-bold mb-0">예문</h6>
                  {idiom.audio?.example && (
                    <button
                      className="btn btn-sm btn-outline-primary rounded-circle d-flex align-items-center justify-content-center"
                      style={{ width: '32px', height: '32px' }}
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (onPlayUrl) {
                          onPlayUrl(`/${idiom.audio.example}`);
                        }
                      }}
                      aria-label="예문 오디오 재생"
                      title="예문 듣기"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-play-fill" viewBox="0 0 16 16">
                        <path d="M11.596 8.697l-6.363 3.692A.5.5 0 0 1 4 11.942V4.058a.5.5 0 0 1 .777-.416l6.363 3.692a.5.5 0 0 1 0 .863z" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="mb-2 p-2 rounded bg-light">
                  <div className="me-2">
                    {idiom.example_english && (
                      <span lang="en" className="d-block fw-bold mb-1">{idiom.example_english}</span>
                    )}
                    {idiom.example_korean && (
                      <span className="text-muted small">— {idiom.example_korean}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* 사용법 (기존 유지) */}
            {idiom.usage_context_korean && (
              <div className="mt-3 border-top pt-3">
                <h6 className="fw-bold">사용법</h6>
                <div className="mb-2 p-2 rounded bg-light">
                  <span className="text-muted small">{idiom.usage_context_korean}</span>
                </div>
              </div>
            )}

            <details className="mt-3">
              <summary className="small text-muted">debug</summary>
              <pre className="small mb-0">{JSON.stringify(idiom, null, 2)}</pre>
            </details>
          </div>

          <div className="modal-footer">
            <button
              className="btn btn-primary"
              onClick={(e) => {
                e.stopPropagation();
                if (onAddSRS) onAddSRS([idiom.id]);
                else toast.info('SRS 추가 핸들러가 연결되지 않았습니다.');
              }}
              title="이 숙어를 SRS 폴더에 추가"
            >
              SRS에 추가
            </button>
            <button className="btn btn-secondary" onClick={onClose}>닫기</button>
          </div>
        </div>
      </div>
    </div>
  );
}