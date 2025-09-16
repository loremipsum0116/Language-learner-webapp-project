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
  // Debug logging
  if (kanji?.includes('おさき') || kanji?.includes('ありがとう')) {
    console.log('FuriganaDisplay debug:', { kanji, kana });
  }

  // Special handling for problematic phrases - show furigana only over kanji
  if (kanji === 'お先に失礼します') {
    return (
      <span className="fs-4" lang="ja">
        お<ruby>先<rt className="fs-6">さき</rt></ruby>に<ruby>失礼<rt className="fs-6">しつれい</rt></ruby>します
      </span>
    );
  }

  // If no kanji text, return kana
  if (!kanji) {
    return <span className="fs-4" lang="ja">{kana || ''}</span>;
  }

  // If no kana provided, return kanji only
  if (!kana) {
    return <span className="fs-4" lang="ja">{kanji}</span>;
  }

  // If kanji and kana are the same, no need for furigana
  if (kanji === kana) {
    return <span className="fs-4" lang="ja">{kanji}</span>;
  }

  // Check if kanji contains any actual kanji characters
  const hasKanji = /[\u4e00-\u9faf]/.test(kanji);

  if (!hasKanji) {
    // No kanji characters, just display the kanji text without furigana
    return <span className="fs-4" lang="ja">{kanji}</span>;
  }

  // If the displayed text (kanji) is already in hiragana/katakana only, don't show furigana
  const isKanjiAlreadyHiragana = /^[\u3040-\u309f\u30a0-\u30ff\s\u3000]+$/.test(kanji);
  if (isKanjiAlreadyHiragana) {
    return <span className="fs-4" lang="ja">{kanji}</span>;
  }

  // Complex parsing for mixed kanji/hiragana text
  const result = [];
  let kanaIndex = 0;

  for (let i = 0; i < kanji.length; i++) {
    const char = kanji[i];

    // If it's a kanji character
    if (/[\u4e00-\u9faf]/.test(char)) {
      // Find the reading for this kanji
      let reading = '';

      // Look ahead to find the next non-kanji character or end
      let nextNonKanjiIndex = i + 1;
      while (nextNonKanjiIndex < kanji.length && /[\u4e00-\u9faf]/.test(kanji[nextNonKanjiIndex])) {
        nextNonKanjiIndex++;
      }

      if (nextNonKanjiIndex < kanji.length) {
        // There's a hiragana part after this kanji sequence
        const nextHiragana = kanji[nextNonKanjiIndex];
        const nextHiraganaIndexInKana = kana.indexOf(nextHiragana, kanaIndex);

        if (nextHiraganaIndexInKana > kanaIndex) {
          const kanjiSequence = kanji.slice(i, nextNonKanjiIndex);
          reading = kana.slice(kanaIndex, nextHiraganaIndexInKana);

          result.push(
            <ruby key={i}>
              {kanjiSequence}
              <rt className="fs-6">{reading}</rt>
            </ruby>
          );

          kanaIndex = nextHiraganaIndexInKana;
          i = nextNonKanjiIndex - 1; // -1 because the loop will increment
          continue;
        }
      } else {
        // This is the last kanji sequence
        reading = kana.slice(kanaIndex);
        const kanjiSequence = kanji.slice(i);

        result.push(
          <ruby key={i}>
            {kanjiSequence}
            <rt className="fs-6">{reading}</rt>
          </ruby>
        );
        break;
      }
    }
    // If it's hiragana/katakana, add it directly
    else if (/[\u3040-\u309f\u30a0-\u30ff]/.test(char)) {
      result.push(char);
      kanaIndex++;
    }
    // Other characters (spaces, punctuation)
    else {
      result.push(char);
    }
  }

  return <span className="fs-4" lang="ja">{result}</span>;
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
          style={{ cursor: 'pointer', position: 'relative' }}
        >
          <div className="text-center mb-2">
            <FuriganaDisplay kanji={vocab.lemma} kana={vocab.kana || vocab.ipa} />
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
            {/* Audio play button */}
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
          </div>
        </div>
      </div>
    </div>
  );
}