// src/components/VocabDetailModal.jsx
import React, { useState } from 'react';
import Pron from './Pron';
// import { API_BASE } from '../api/client'; // not used here
// ❌ Do not import SrsFolderPickerModal / SrsApi here. The parent (VocabList) handles SRS.
import { toast } from 'react-toastify';

function safeFileName(str) {
  if (!str) return '';
  return encodeURIComponent(str.toLowerCase().replace(/\s+/g, '_'));
}

const getCefrBadgeColor = (level) => {
  switch (level) {
    case 'A1': return 'bg-danger';
    case 'A2': return 'bg-warning text-dark';
    case 'B1': return 'bg-success';
    case 'B2': return 'bg-info text-dark';
    case 'C1': return 'bg-primary';
    default: return 'bg-secondary';
  }
};

const getPosBadgeColor = (pos) => {
  if (!pos) return 'bg-secondary';
  switch (pos.toLowerCase().trim()) {
    case 'noun': return 'bg-primary';
    case 'verb': return 'bg-success';
    case 'adjective': return 'bg-warning text-dark';
    case 'adverb': return 'bg-info text-dark';
    case 'preposition': return 'bg-danger';
    default: return 'bg-secondary';
  }
};

// ✅ Added onAddSRS prop. Parent (VocabList) must pass a handler: (ids:number[]) => void
export default function VocabDetailModal({
  vocab,
  onClose,
  onPlayUrl,
  onPlayVocabAudio,
  playingAudio,
  onAddSRS,
}) {
  const dictMeta = vocab?.dictMeta || {};
  const meanings = Array.isArray(dictMeta.examples) ? dictMeta.examples : [];
  const uniquePosList = [...new Set(vocab.pos ? vocab.pos.split(',').map(p => p.trim()) : [])];
  const isVocabPlaying = playingAudio?.type === 'vocab' && playingAudio?.id === vocab.id;

  return (
    <div className="modal show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <div className="d-flex align-items-center flex-wrap">
              <h4 className="modal-title mb-0 me-2" lang="en">{vocab?.lemma}</h4>
              <div className="d-flex gap-1">
                {vocab.levelCEFR && <span className={`badge ${getCefrBadgeColor(vocab.levelCEFR)}`}>{vocab.levelCEFR}</span>}
                {uniquePosList.map(p => (
                  p && p.toLowerCase() !== 'unk' && (
                    <span key={p} className={`badge ${getPosBadgeColor(p)} fst-italic`}>
                      {p}
                    </span>
                  )
                ))}
              </div>
            </div>
            <div className="ms-auto d-flex align-items-center">
              <button
                className="btn btn-sm btn-outline-primary rounded-circle d-flex align-items-center justify-content-center"
                style={{ width: '32px', height: '32px' }}
                onClick={(e) => { e.stopPropagation(); onPlayVocabAudio(vocab); }}
                aria-label="단어 오디오 재생"
                title="단어 듣기"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={`bi ${isVocabPlaying ? 'bi-pause-fill' : 'bi-play-fill'}`} viewBox="0 0 16 16">
                  {isVocabPlaying ? (
                    <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z" />
                  ) : (
                    <path d="M11.596 8.697l-6.363 3.692A.5.5 0 0 1 4 11.942V4.058a.5.5 0 0 1 .777-.416l6.363 3.692a.5.5 0 0 1 0 .863z" />
                  )}
                </svg>
              </button>
              <button type="button" className="btn-close ms-2" aria-label="닫기" onClick={onClose} />
            </div>
          </div>

          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <Pron ipa={dictMeta.ipa} ipaKo={dictMeta.ipaKo} />

            {meanings.length > 0 ? (
              meanings.map((meaning, index) => (
                <div key={index} className="mt-3 border-top pt-3">
                  <h6 className={`fw-bold fst-italic ${getPosBadgeColor(meaning.pos)} text-white d-inline-block px-2 py-1 rounded small`}>{meaning.pos}</h6>
                  {meaning.definitions && meaning.definitions.map((defItem, defIndex) => (
                    <div key={defIndex} className="ps-2 mt-2">
                      <p className="mb-1">
                        <strong>{defItem.ko_def}</strong>
                        <span className="d-block text-muted small">{defItem.def}</span>
                      </p>
                      {defItem.examples && defItem.examples.length > 0 && (
                        <ul className="list-unstyled ps-3 mt-2">
                          {defItem.examples.map((ex, exIndex) => {
                            const audioId = `${vocab.id}-${index}-${defIndex}-${exIndex}`;
                            const isExamplePlaying = playingAudio?.type === 'example' && playingAudio?.id === audioId;
                            const localAudioPath = `/${vocab.levelCEFR}/audio/${safeFileName(vocab.lemma)}.mp3`;
                            return (
                              <li key={exIndex} className="d-flex justify-content-between align-items-center mb-2 p-2 rounded bg-light">
                                <div className="me-2">
                                  <span lang="en" className="d-block">{ex.de}</span>
                                  <span className="text-muted small">— {ex.ko}</span>
                                </div>
                                <button
                                  className="btn btn-sm btn-outline-primary rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                                  style={{ width: '32px', height: '32px' }}
                                  onClick={(e) => { e.stopPropagation(); onPlayUrl(localAudioPath, 'example', audioId); }}
                                  aria-label="예문 오디오 재생"
                                  title="예문 듣기"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={`bi ${isExamplePlaying ? 'bi-pause-fill' : 'bi-play-fill'}`} viewBox="0 0 16 16">
                                    {isExamplePlaying ? (
                                      <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z" />
                                    ) : (
                                      <path d="M11.596 8.697l-6.363 3.692A.5.5 0 0 1 4 11.942V4.058a.5.5 0 0 1 .777-.416l6.363 3.692a.5.5 0 0 1 0 .863z" />
                                    )}
                                  </svg>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <p className="text-muted mt-3">상세한 뜻 정보가 없습니다.</p>
            )}

            <details className="mt-3">
              <summary className="small text-muted">debug</summary>
              <pre className="small mb-0">{JSON.stringify(vocab, null, 2)}</pre>
            </details>
          </div>

          <div className="modal-footer">
            <button
              className="btn btn-primary"
              onClick={(e) => {
                e.stopPropagation();
                if (onAddSRS) onAddSRS([vocab.id]);
                else toast.info('SRS 추가 핸들러가 연결되지 않았습니다.');
              }}
              title="이 단어를 SRS 폴더에 추가"
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
