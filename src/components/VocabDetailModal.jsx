import React from 'react';
import Pron from './Pron';

export default function VocabDetailModal({ vocab, onClose }) {
  const koGloss =
    vocab?.dictMeta?.examples?.find?.(ex => ex && ex.kind === 'gloss')?.ko || null;
  const examples = Array.isArray(vocab?.dictMeta?.examples)
    ? vocab.dictMeta.examples.filter(ex => ex && ex.kind !== 'gloss')
    : [];

  return (
    <div className="modal show" style={{ display:'block', backgroundColor:'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h5 className="modal-title" lang="en">{vocab?.lemma}</h5>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose}/>
          </div>
          <div className="modal-body">
            {/* IPA + 한국어 발음 */}
            <Pron ipa={vocab?.dictMeta?.ipa} ipaKo={vocab?.dictMeta?.ipaKo} />
            {koGloss && <div className="mt-2"><strong>뜻</strong>: {koGloss}</div>}

            {examples.length > 0 && (
              <ul className="mt-2 mb-0">
                {examples.map((ex, i) => (
                  <li key={i}>
                    <span lang="en">{ex.de}</span>{ex.ko ? <span> — {ex.ko}</span> : null}
                  </li>
                ))}
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
