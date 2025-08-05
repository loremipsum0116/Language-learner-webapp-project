import React from 'react';
import Pron from './Pron';
import { API_BASE } from '../api/client'; // 필요 시 경로 조정

function safeFileName(str) {
    return encodeURIComponent(str.toLowerCase().replace(/\s+/g, '_'));
}

export default function VocabDetailModal({ vocab, onClose, onPlayUrl, onPlayVocabAudio }) {
    const koGloss =
        vocab?.dictMeta?.examples?.find?.(ex => ex && ex.kind === 'gloss')?.ko || null;

    const examples =
        Array.isArray(vocab?.dictMeta?.examples)
            ? vocab.dictMeta.examples.filter(ex => ex && ex.kind !== 'gloss')
            : [];

    return (
        <div className="modal show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
            <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
                <div className="modal-content">
                    <div className="modal-header">
                        <div className="d-flex align-items-center">
                            <h5 className="modal-title mb-0" lang="en">{vocab?.lemma}</h5>
                            <button
                                className="btn btn-sm btn-outline-primary ms-2 rounded-circle d-flex align-items-center justify-content-center"
                                style={{ width: '32px', height: '32px' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPlayVocabAudio(vocab);
                                }}
                                aria-label="단어 오디오 재생"
                                title="단어 듣기"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-play-fill" viewBox="0 0 16 16">
                                    <path d="M11.596 8.697l-6.363 3.692A.5.5 0 0 1 4 11.942V4.058a.5.5 0 0 1 .777-.416l6.363 3.692a.5.5 0 0 1 0 .863z"/>
                                </svg>
                            </button>
                        </div>
                        <button type="button" className="btn-close" aria-label="닫기" onClick={onClose} />
                    </div>
                    <div className="modal-body">
                        <Pron ipa={vocab?.dictMeta?.ipa} ipaKo={vocab?.dictMeta?.ipaKo} />
                        {koGloss && (
                            <div className="mt-2">
                                <strong>뜻</strong>: {koGloss}
                            </div>
                        )}
                        {examples.length > 0 && (
                            <ul className="mt-2 list-unstyled">
                                {examples.map((ex, i) => {
                                    const safeLemma = safeFileName(vocab.lemma);
                                    const localAudioPath = `/audio/${safeLemma}.mp3`;
                                    return (
                                        <li
                                            key={i}
                                            className="d-flex justify-content-between align-items-center mb-1 p-2 rounded hover-bg-light"
                                        >
                                            <div className="me-2">
                                                <span lang="en">{ex.de}</span>
                                                {ex.ko && (
                                                    <span className="text-muted d-block small">— {ex.ko}</span>
                                                )}
                                            </div>
                                            <button
                                                className="btn btn-sm btn-outline-primary ms-2 rounded-circle d-flex align-items-center justify-content-center"
                                                style={{ width: '32px', height: '32px' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onPlayUrl(localAudioPath, vocab.lemma, i);
                                                }}
                                                aria-label="  오디오 재생"
                                                title="  듣기"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-play-fill" viewBox="0 0 16 16">
                                                    <path d="M11.596 8.697l-6.363 3.692A.5.5 0 0 1 4 11.942V4.058a.5.5 0 0 1 .777-.416l6.363 3.692a.5.5 0 0 1 0 .863z"/>
                                                </svg>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        <details className="mt-2">
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
