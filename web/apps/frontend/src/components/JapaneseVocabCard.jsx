import React from 'react';

// Helper function to get JLPT badge color
const getJlptBadgeColor = (level) => {
  switch (level) {
    case 'N5': return 'bg-success';
    case 'N4': return 'bg-info';
    case 'N3': return 'bg-warning text-dark';
    case 'N2': return 'bg-danger';
    case 'N1': return 'bg-dark';
    default: return 'bg-secondary';
  }
};

// Helper function to get POS badge color
const getPosBadgeColor = (pos) => {
  if (!pos) return 'bg-secondary';
  switch (pos.toLowerCase().trim()) {
    case 'noun': return 'bg-primary';
    case 'verb': return 'bg-success';
    case 'adjective': return 'bg-warning text-dark';
    case 'adverb': return 'bg-info text-dark';
    case 'pronoun': return 'bg-purple text-white';
    case 'interjection': return 'bg-pink text-dark';
    default: return 'bg-secondary';
  }
};

// Furigana display component - handles mixed kanji/hiragana
function FuriganaDisplay({ kanji, kana }) {
  // If no kanji, just return the kana
  if (!kanji || kanji === kana) {
    return <span className="fs-4" lang="ja">{kana}</span>;
  }

  // Check if kanji contains any actual kanji characters
  const hasKanji = /[\u4e00-\u9faf]/.test(kanji);

  if (!hasKanji) {
    // No kanji characters, just display as text
    return <span className="fs-4" lang="ja">{kanji}</span>;
  }

  // Simple approach for common patterns like 食べる (taberu)
  // Split the word at the boundary between kanji and hiragana
  const match = kanji.match(/^([\u4e00-\u9faf]+)([\u3040-\u309f\u30a0-\u30ff]*)$/);

  if (match) {
    const kanjiPart = match[1];  // e.g., "食"
    const hiraganaPart = match[2];  // e.g., "べる"

    // Find where hiragana part starts in kana reading
    const hiraganStartIndex = kana.indexOf(hiraganaPart);

    if (hiraganStartIndex > 0) {
      const kanjiReading = kana.slice(0, hiraganStartIndex);  // e.g., "た"

      return (
        <span className="fs-4" lang="ja">
          <ruby>
            {kanjiPart}
            <rt className="fs-6">{kanjiReading}</rt>
          </ruby>
          {hiraganaPart}
        </span>
      );
    }
  }

  // Fallback to simple ruby for complex cases
  return (
    <ruby className="fs-4" lang="ja">
      {kanji}
      <rt className="fs-6">{kana}</rt>
    </ruby>
  );
}

export default function JapaneseVocabCard({
  vocab,
  onOpenDetail,
  onAddWordbook,
  onAddSRS,
  inWordbook,
  inSRS,
  onPlayAudio,
  enrichingId,
  isSelected,
  onToggleSelect,
  playingAudio,
  masteredCards = []
}) {
  const koGloss = vocab.ko_gloss || '뜻 정보 없음';
  const isEnriching = enrichingId === vocab.id;
  const isPlaying = playingAudio?.type === 'vocab' && playingAudio?.id === vocab.id;
  const isMastered = masteredCards.some(card =>
    card.itemType === 'vocab' && card.itemId === vocab.id
  );

  return (
    <div className="col-md-6 col-lg-4 mb-3">
      <div className={`card h-100 ${isSelected ? 'border-primary' : ''} ${isMastered ? 'border-warning' : ''} position-relative`}>
        {isMastered && (
          <div className="position-absolute" style={{ top: '5px', right: '40px', zIndex: 10 }}>
            <span className="badge bg-warning text-dark">마스터</span>
          </div>
        )}
        <div className="card-header d-flex justify-content-end align-items-center p-1">
          <div className="d-flex gap-1 align-items-center">
            {vocab.pos && (
              <span className={`badge ${getPosBadgeColor(vocab.pos)} fst-italic`}>
                {vocab.pos}
              </span>
            )}
            {vocab.levelJLPT && (
              <span className={`badge ${getJlptBadgeColor(vocab.levelJLPT)}`}>
                {vocab.levelJLPT}
              </span>
            )}
            <input
              className="form-check-input ms-2"
              type="checkbox"
              checked={isSelected}
              onChange={(e) => { e.stopPropagation(); onToggleSelect(vocab.id); }}
              title="단어 선택"
            />
          </div>
        </div>
        <div
          className="card-body card-clickable pt-0"
          onClick={() => onOpenDetail(vocab.id)}
          style={{ cursor: 'pointer' }}
        >
          <div className="text-center mb-2">
            <FuriganaDisplay kanji={vocab.lemma} kana={vocab.kana} />
          </div>

          {vocab.romaji && (
            <div className="text-center text-muted small mb-1">
              {vocab.romaji}
            </div>
          )}

          <div className="card-subtitle text-muted text-center">
            {koGloss}
          </div>

        </div>
        <div className="card-footer d-flex gap-2 justify-content-between align-items-center">
          <div className="d-flex align-items-center">
            <div className="btn-group">
              <button
                className={`btn btn-sm ${inWordbook ? 'btn-secondary' : 'btn-outline-primary'}`}
                onClick={(e) => { e.stopPropagation(); onAddWordbook(vocab.id); }}
                disabled={inWordbook}
                title="내 단어장에 추가"
              >
                {inWordbook ? '단어장에 있음' : '내 단어장'}
              </button>
              <button
                className="btn btn-sm btn-outline-success"
                onClick={(e) => { e.stopPropagation(); onAddSRS([vocab.id]); }}
                title="오늘 학습할 SRS 폴더에 추가"
              >
                + SRS
              </button>
            </div>
            {vocab.audio && (
              <button
                className="btn btn-sm btn-outline-info rounded-circle d-flex align-items-center justify-content-center ms-2"
                style={{ width: '32px', height: '32px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayAudio(vocab);
                }}
                disabled={isEnriching}
                title="음성 듣기"
              >
                {isEnriching ? (
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                ) : isPlaying ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-pause-fill" viewBox="0 0 16 16">
                    <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-play-fill" viewBox="0 0 16 16">
                    <path d="M11.596 8.697l-6.363 3.692A.5.5 0 0 1 4 11.942V4.058a.5.5 0 0 1 .777-.416l6.363 3.692a.5.5 0 0 1 0 .863z" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}