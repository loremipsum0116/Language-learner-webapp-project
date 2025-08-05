// src/components/VocabDetailModal.jsx
import React from 'react';
import Pron from './Pron';
import { API_BASE } from '../api/client';

// ★ 시작: 단어 lemma를 안전한 파일명으로 변환하는 헬퍼 함수
function safeFileName(str) {
    if (!str) return '';
    return encodeURIComponent(str.toLowerCase().replace(/\s+/g, '_'));
}
// ★ 종료: 헬퍼 함수

// CEFR 레벨에 따라 다른 Bootstrap 배경색 클래스를 반환하는 헬퍼 함수
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

// 품사(POS)에 따라 다른 Bootstrap 배경색 클래스를 반환하는 헬퍼 함수
const getPosBadgeColor = (pos) => {
    if (!pos) return 'bg-secondary';
    switch (pos.toLowerCase().trim()) {
        case 'noun':
            return 'bg-primary';
        case 'verb':
            return 'bg-success';
        case 'adjective':
            return 'bg-warning text-dark';
        case 'adverb':
            return 'bg-info text-dark';
        case 'preposition':
            return 'bg-danger';
        default:
            return 'bg-secondary';
    }
};

export default function VocabDetailModal({ vocab, onClose, onPlayUrl, onPlayVocabAudio, playingAudio }) {
    // API 응답에서 필요한 데이터를 안전하게 추출합니다.
    const dictMeta = vocab?.dictMeta || {};
    const meanings = Array.isArray(dictMeta.examples) ? dictMeta.examples : [];
    const posList = vocab.pos ? vocab.pos.split(',').map(p => p.trim()) : [];
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
                                {posList.map(p => (
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
                                        <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/>
                                    ) : (
                                        <path d="M11.596 8.697l-6.363 3.692A.5.5 0 0 1 4 11.942V4.058a.5.5 0 0 1 .777-.416l6.363 3.692a.5.5 0 0 1 0 .863z"/>
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
                                                        
                                                        // ★ 시작: 예문 오디오 URL을 항상 로컬 경로로 생성합니다.
                                                        const localAudioPath = `/audio/${safeFileName(vocab.lemma)}.mp3`;
                                                        // ★ 종료: 로컬 경로 생성

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
                                                                            <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/>
                                                                        ) : (
                                                                            <path d="M11.596 8.697l-6.363 3.692A.5.5 0 0 1 4 11.942V4.058a.5.5 0 0 1 .777-.416l6.363 3.692a.5.5 0 0 1 0 .863z"/>
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
                        <button className="btn btn-secondary" onClick={onClose}>닫기</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
