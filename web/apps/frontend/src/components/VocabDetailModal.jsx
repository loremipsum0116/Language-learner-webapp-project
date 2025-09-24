// src/components/VocabDetailModal.jsx
import React, { useState } from 'react';
import Pron from './Pron';
import { API_BASE } from '../api/client';
// ❌ Do not import SrsFolderPickerModal / SrsApi here. The parent (VocabList) handles SRS.
import { toast } from 'react-toastify';
import { parseAudioLocal } from '../utils/audioUtils';

function safeFileName(str) {
  if (!str) return '';
  return encodeURIComponent(str.toLowerCase().replace(/\s+/g, '_'));
}

// String similarity function (Levenshtein distance-based)
function stringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  if (s1 === s2) return 1;
  
  const len1 = s1.length;
  const len2 = s2.length;
  
  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;
  
  const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
  
  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j - 1][i] + 1,
        matrix[j][i - 1] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }
  
  const maxLen = Math.max(len1, len2);
  return (maxLen - matrix[len2][len1]) / maxLen;
}

// parseAudioLocal 함수는 이제 utils/audioUtils.js에서 import하여 사용

const getCefrBadgeColor = (level) => {
  switch (level) {
    case 'A1': return 'bg-danger';
    case 'A2': return 'bg-warning text-dark';
    case 'B1': return 'bg-success';
    case 'B2': return 'bg-info text-dark';
    case 'C1': return 'bg-primary';
    case 'C2': return 'bg-dark';
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
  onPlayGlossAudio, // 새로 추가된 gloss 오디오 재생 함수
  playingAudio,
  onAddSRS,
}) {
  console.log('🐛 [VocabDetailModal] vocab.lemma:', vocab.lemma);
  console.log('🐛 [VocabDetailModal] vocab.dictentry?.audioLocal:', vocab.dictentry?.audioLocal);
  const dictentry = vocab?.dictentry || {};
  const isJapanese = vocab.levelJLPT || vocab.source === 'jlpt';
  
  // Parse examples if it's a string - handle all possible cases
  let rawMeanings = [];
  console.log('VocabDetailModal - dictentry.examples type:', typeof dictentry.examples);
  console.log('VocabDetailModal - dictentry.examples value:', dictentry.examples);
  
  if (typeof dictentry.examples === 'string') {
    try {
      rawMeanings = JSON.parse(dictentry.examples);
    } catch (e) {
      console.warn('Failed to parse examples in modal:', e);
      rawMeanings = [];
    }
  } else if (Array.isArray(dictentry.examples)) {
    rawMeanings = dictentry.examples;
  } else if (dictentry.examples) {
    console.warn('Unexpected examples type:', typeof dictentry.examples);
    rawMeanings = [];
  }
  
  console.log('VocabDetailModal - parsed rawMeanings:', rawMeanings);
  
  // CEFR 데이터 구조를 위한 간소화된 처리
  const glossExample = rawMeanings.find(ex => ex.kind === 'gloss');
  const exampleExample = rawMeanings.find(ex => ex.kind === 'example');
  console.log('[EXAMPLE SETUP] exampleExample:', exampleExample);
  
  const uniquePosList = [...new Set(vocab.pos ? vocab.pos.split(',').map(p => p.trim()) : [])];
  const isVocabPlaying = playingAudio?.type === 'vocab' && playingAudio?.id === vocab.id;
  const isExamplePlaying = playingAudio?.type === 'example' && playingAudio?.id === vocab.id;

  return (
    <div className="modal show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <div className="d-flex align-items-center flex-wrap">
              {/* Check if it's actually Japanese based on new database structure */}
              {(() => {
                // Use levelJLPT or source to identify Japanese words
                const isJapanese = vocab.levelJLPT || vocab.source === 'jlpt';

                if (isJapanese) {
                  return (
                <div className="d-flex align-items-center me-2">
                  {vocab.lemma && vocab.lemma !== dictentry.ipa ? (
                    (() => {
                      // Check if lemma contains any actual kanji characters
                      const hasKanji = /[\u4e00-\u9faf]/.test(vocab.lemma);

                      if (!hasKanji) {
                        // No kanji characters, just display as text
                        return <h4 className="modal-title mb-0 me-2" lang="ja">{vocab.lemma}</h4>;
                      }

                      // Simple approach for common patterns like 食べる (taberu)
                      const match = vocab.lemma.match(/^([\u4e00-\u9faf]+)([\u3040-\u309f\u30a0-\u30ff]*)$/);

                      if (match && dictentry.ipa) {
                        const kanjiPart = match[1];  // e.g., "食"
                        const hiraganaPart = match[2];  // e.g., "べる"

                        // Find where hiragana part starts in kana reading
                        const hiraganStartIndex = dictentry.ipa.indexOf(hiraganaPart);

                        if (hiraganStartIndex > 0) {
                          const kanjiReading = dictentry.ipa.slice(0, hiraganStartIndex);  // e.g., "た"

                          return (
                            <h4 className="modal-title mb-0 me-2" lang="ja">
                              <ruby>
                                {kanjiPart}
                                <rt className="fs-6">{kanjiReading}</rt>
                              </ruby>
                              {hiraganaPart}
                            </h4>
                          );
                        }
                      }

                      // Render Japanese text with furigana only over kanji characters
                      const renderJapaneseWithRuby = (text, reading) => {
                        if (!reading || !text) return <span lang="ja">{text}</span>;

                        // Check if text has kanji
                        const hasKanji = /[\u4e00-\u9faf]/.test(text);
                        if (!hasKanji) {
                          return <span lang="ja">{text}</span>;
                        }

                        // For simple cases with common patterns, try to match kanji to readings
                        const result = [];
                        let textIndex = 0;
                        let readingIndex = 0;

                        console.log('🔍 renderJapaneseWithRuby:', { text, reading });

                        while (textIndex < text.length) {
                          const char = text[textIndex];
                          console.log('Processing char at index', textIndex, ':', char);

                          // If it's kanji, try to find corresponding reading
                          if (/[\u4e00-\u9faf]/.test(char)) {
                            // Find consecutive kanji
                            let kanjiSegment = char;
                            let nextIndex = textIndex + 1;
                            while (nextIndex < text.length && /[\u4e00-\u9faf]/.test(text[nextIndex])) {
                              kanjiSegment += text[nextIndex];
                              nextIndex++;
                            }

                            // Find corresponding reading for this kanji segment
                            // This is a simplified approach - in reality, you'd need a dictionary
                            let kanjiReading = '';

                            // Special handling for common patterns
                            if (text === 'お先に失礼します' && reading === 'おさきにしつれいします') {
                              // Handle known phrase mapping
                              if (kanjiSegment === '先') {
                                kanjiReading = 'さき';
                                readingIndex = 3; // Skip "おさき" to position after "き"
                              } else if (kanjiSegment === '失礼') {
                                kanjiReading = 'しつれい';
                                readingIndex = 9; // Skip "おさきにしつれい" to position after "い"
                              }
                            } else {
                              // For simple mapping, try to extract reading by finding hiragana that follows
                              if (nextIndex < text.length && /[\u3040-\u309f]/.test(text[nextIndex])) {
                                // Find the hiragana part that follows
                                const followingHiragana = text.slice(nextIndex).match(/^[\u3040-\u309f]+/)?.[0] || '';

                                // Find where this hiragana appears in the reading
                                if (followingHiragana) {
                                  const hiraganaIndex = reading.indexOf(followingHiragana, readingIndex);
                                  if (hiraganaIndex > readingIndex) {
                                    kanjiReading = reading.slice(readingIndex, hiraganaIndex);
                                    readingIndex = hiraganaIndex;
                                  }
                                }
                              } else {
                                // No following hiragana, take remaining reading
                                kanjiReading = reading.slice(readingIndex);
                                readingIndex = reading.length;
                              }
                            }

                            // If we found a reading for this kanji segment, add ruby
                            if (kanjiReading) {
                              result.push(
                                <ruby key={textIndex} lang="ja">
                                  {kanjiSegment}
                                  <rt className="fs-6">{kanjiReading}</rt>
                                </ruby>
                              );
                            } else {
                              result.push(<span key={textIndex} lang="ja">{kanjiSegment}</span>);
                            }

                            textIndex = nextIndex;
                          }
                          // If it's hiragana/katakana, just add it without ruby
                          else {
                            let kanaSegment = char;
                            let nextIndex = textIndex + 1;
                            while (nextIndex < text.length && /[\u3040-\u309f\u30a0-\u30ff]/.test(text[nextIndex])) {
                              kanaSegment += text[nextIndex];
                              nextIndex++;
                            }

                            result.push(<span key={textIndex} lang="ja">{kanaSegment}</span>);

                            // Advance reading index to match the kana (only for non-special cases)
                            if (!(text === 'お先に失礼します' && reading === 'おさきにしつれいします')) {
                              readingIndex += kanaSegment.length;
                            }
                            textIndex = nextIndex;
                          }
                        }

                        return <>{result}</>;
                      };

                      // Special handling for お先に失礼します - show furigana only over kanji
                      if (vocab.lemma === 'お先に失礼します') {
                        return (
                          <h4 className="modal-title mb-0 me-2" lang="ja">
                            お<ruby>先<rt className="fs-6">さき</rt></ruby>に<ruby>失礼<rt className="fs-6">しつれい</rt></ruby>します
                          </h4>
                        );
                      }

                      return (
                        <h4 className="modal-title mb-0 me-2">
                          {renderJapaneseWithRuby(vocab.lemma, dictentry.ipa)}
                        </h4>
                      );
                    })()
                  ) : (
                    <h4 className="modal-title mb-0 me-2" lang="ja">{dictentry.ipa || vocab.lemma}</h4>
                  )}
                </div>
                  );
                } else {
                  // English vocabulary
                  return <h4 className="modal-title mb-0 me-2" lang="en">{vocab?.lemma}</h4>;
                }
              })()}
              <div className="d-flex gap-1">
                {vocab.levelCEFR && <span className={`badge ${getCefrBadgeColor(vocab.levelCEFR)}`}>{vocab.levelCEFR}</span>}
                {vocab.levelJLPT && <span className={`badge bg-success`}>{vocab.levelJLPT}</span>}
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
                onClick={(e) => { 
                  e.stopPropagation(); 
                  
                  // cefr_vocabs.json의 audio 경로 사용
                  const audioData = parseAudioLocal(dictentry.audioLocal);
                  
                  // 상세 보기 상단 오디오는 gloss 경로 사용
                  const isJapanese = vocab.levelJLPT || vocab.source === 'jlpt';
                  const isIdiomOrPhrasal = vocab.source === 'idiom_migration' || vocab.source === 'phrasal_verb_migration' || (vocab.lemma && (vocab.lemma.includes(' ') || vocab.lemma.includes('-') || vocab.lemma.includes("'")));
                  let glossAudioPath = null;

                  if (isJapanese) {
                    // JLPT 단어의 경우 우선 audioLocal 데이터 사용
                    const audioData = parseAudioLocal(dictentry.audioLocal);
                    if (audioData?.gloss) {
                      glossAudioPath = audioData.gloss.startsWith('/') ? audioData.gloss : `/${audioData.gloss}`;
                      console.log('🔍 [VocabDetailModal] Using JLPT gloss audio from audioLocal:', vocab.lemma, '->', glossAudioPath);
                    }
                    // Fallback: 데이터베이스의 audioUrl을 사용하되, gloss.mp3로 변경
                    else if (vocab.dictentry?.audioUrl) {
                      const baseUrl = vocab.dictentry.audioUrl.replace('/word.mp3', '/gloss.mp3');
                      glossAudioPath = `/${baseUrl}`;
                      console.log('🔍 [VocabDetailModal] Fallback to database audioUrl for JLPT gloss:', vocab.lemma, '->', glossAudioPath);
                    }
                  } else if (isIdiomOrPhrasal) {
                    // 숙어/구동사의 경우 실제 데이터베이스의 audioUrl을 사용
                    if (vocab.dictentry?.audioUrl) {
                      // audioUrl이 이미 파일명만 있는 경우 (예: "idiom/a_stones_throw.mp3")
                      // gloss 버전으로 변환
                      const baseUrl = vocab.dictentry.audioUrl.replace('.mp3', '_gloss.mp3');
                      glossAudioPath = `/${baseUrl}`;
                      console.log('🔍 [VocabDetailModal] Using database audioUrl for idiom/phrasal:', vocab.lemma, '->', glossAudioPath);
                    } else {
                      // Fallback: Use unified folder structure based on CEFR level
                      const cefrToFolder = {
                        'A1': 'starter',
                        'A2': 'elementary',
                        'B1': 'intermediate',
                        'B2': 'upper',
                        'C1': 'advanced',
                        'C2': 'advanced'
                      };

                      let cleanLemma = vocab.lemma.toLowerCase()
                        .replace(/\s*\([^)]*\)/g, (match) => {
                          const content = match.replace(/[()]/g, '').trim();
                          if (!content) return '';
                          const cleaned = content.replace(/[\/\\]/g, '').replace(/\s+/g, '-').trim();
                          return cleaned ? '-' + cleaned : '';
                        })
                        .replace(/'/g, '');

                      // Ensure ALL remaining spaces are converted to hyphens and clean up multiple hyphens
                      cleanLemma = cleanLemma.replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

                      const folderName = cefrToFolder[vocab.levelCEFR] || 'starter';
                      glossAudioPath = `/${folderName}/${cleanLemma}/gloss.mp3`;
                      console.log('🔍 [VocabDetailModal] Fallback to folder structure:', vocab.lemma, '->', folderName, 'cleanLemma:', cleanLemma);
                    }
                  } else {
                    // 일반 단어의 경우 audioData.gloss 사용
                    glossAudioPath = audioData?.gloss;
                  }
                  
                  if (glossAudioPath && onPlayUrl) {
                    // 절대 경로로 변환
                    const absolutePath = glossAudioPath.startsWith('/') ? glossAudioPath : `/${glossAudioPath}`;
                    console.log('🔊 [VocabDetailModal] Playing GLOSS audio:', absolutePath);
                    onPlayUrl(absolutePath, 'vocab', vocab.id);
                  } else if (onPlayGlossAudio) {
                    // 새로운 gloss 전용 재생 함수 사용
                    console.log('🔊 [VocabDetailModal] Using onPlayGlossAudio function');
                    onPlayGlossAudio(vocab);
                  } else {
                    // 최종 폴백: 기존 방식
                    console.log('🔊 [VocabDetailModal] Final fallback - calling onPlayVocabAudio');
                    onPlayVocabAudio(vocab);
                  }
                }}
                aria-label="한국어 뜻 오디오 재생"
                title="뜻 듣기"
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
            <Pron ipa={dictentry.ipa} ipaKo={dictentry.ipaKo} />


            {/* 한국어 뜻 표시 */}
            {(vocab.koGloss || vocab.ko_gloss || glossExample?.ko) && (
              <div className="mb-3">
                <div className="ps-2 mt-2">
                  <p className="mb-1">
                    <strong>{vocab.koGloss || vocab.ko_gloss || glossExample?.ko}</strong>
                  </p>
                </div>
              </div>
            )}

            {/* Japanese readings display - kun/on readings */}
            {isJapanese && dictentry.examples && (typeof dictentry.examples === 'object') &&
             (dictentry.examples.kunyomi || dictentry.examples.onyomi) && (
              <div className="mb-3 border-top pt-3">
                <h6 className="fw-bold mb-2">한자 읽기</h6>
                <div className="ps-2">
                  {dictentry.examples.onyomi && (
                    <div className="mb-1">
                      <span className="text-muted small">음독:</span> <span className="ms-1" lang="ja">{dictentry.examples.onyomi}</span>
                    </div>
                  )}
                  {dictentry.examples.kunyomi && (
                    <div className="mb-1">
                      <span className="text-muted small">훈독:</span> <span className="ms-1" lang="ja">{dictentry.examples.kunyomi}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Examples section - for both English and Japanese */}
            {(() => {
              // Check for examples in various formats
              const hasEnglishExamples = glossExample || exampleExample || vocab.example || vocab.koExample || vocab.dictentry?.examples?.example || vocab.dictentry?.examples?.koExample;

              // Check for Japanese examples in new array format
              const hasJapaneseExamples = Array.isArray(vocab.dictentry?.examples) &&
                vocab.dictentry.examples.some(ex => ex.kind === 'example' && (ex.ja || ex.ko));

              return hasEnglishExamples || hasJapaneseExamples;
            })() ? (
              <div className="mt-3">{/* 기존 코드 계속 */}

                {(() => {
                  // Debug: Check what example data is available
                  console.log(`[EXAMPLE DEBUG] Checking examples for ${vocab.lemma}:`);
                  console.log('  - vocab.dictentry?.examples:', vocab.dictentry?.examples);

                  // Check if examples exist in different formats
                  const hasExamples = (
                    (exampleExample && exampleExample.ko) ||
                    vocab.example ||
                    vocab.koExample ||
                    vocab.dictentry?.examples?.example ||
                    vocab.dictentry?.examples?.koExample ||
                    (Array.isArray(vocab.dictentry?.examples) && vocab.dictentry.examples.length > 0)
                  );

                  console.log(`  - hasExamples: ${hasExamples}`);
                  return hasExamples;
                })() && (
                  <div className="mt-3 border-top pt-3">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <h6 className="fw-bold mb-0">예문</h6>
                      {(() => {
                        // Handle audio for both English and Japanese examples
                        let exampleAudioPath = null;

                        // For Japanese vocabulary (JLPT words)
                        if (isJapanese) {
                          // Parse audioLocal data for JLPT words
                          const audioData = parseAudioLocal(dictentry.audioLocal);
                          if (audioData?.example) {
                            exampleAudioPath = audioData.example;
                            console.log('🔍 [VocabDetailModal] Using JLPT example audio from audioLocal:', vocab.lemma, '->', exampleAudioPath);
                          }
                          // Fallback: use database audioUrl if available
                          else if (vocab.dictentry?.audioUrl) {
                            const baseUrl = vocab.dictentry.audioUrl.replace('/word.mp3', '/example.mp3');
                            exampleAudioPath = `/${baseUrl}`;
                            console.log('🔍 [VocabDetailModal] Fallback to database audioUrl for JLPT example:', vocab.lemma, '->', exampleAudioPath);
                          }
                        }
                        // For English vocabulary
                        else {
                          const audioData = parseAudioLocal(dictentry.audioLocal);
                          exampleAudioPath = audioData?.example;

                          // 숙어/구동사의 경우 예문 오디오 버튼을 숨김 (사용법 섹션에서 재생)
                          const isIdiomOrPhrasal = vocab.source === 'idiom_migration';
                          if (isIdiomOrPhrasal) {
                            exampleAudioPath = null;
                          }
                        }

                        if (exampleAudioPath) {
                          return (
                            <button
                              className="btn btn-sm btn-outline-primary rounded-circle d-flex align-items-center justify-content-center"
                              style={{ width: '32px', height: '32px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onPlayUrl) {
                                  // 절대 경로로 변환
                                  const absolutePath = exampleAudioPath.startsWith('/') ? exampleAudioPath : `/${exampleAudioPath}`;
                                  onPlayUrl(absolutePath, 'example', vocab.id);
                                }
                              }}
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
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <div className="mb-2 p-2 rounded bg-light">
                      <div className="me-2">
                        {(() => {
                          // Handle examples for both Japanese and English vocabulary
                          let exampleText = '';
                          let koreanTranslation = '';

                          // For Japanese vocabulary
                          if (isJapanese) {
                            // Check if examples is an array (new JLPT structure)
                            if (Array.isArray(dictentry.examples)) {
                              const exampleEntry = dictentry.examples.find(ex => ex.kind === 'example');
                              if (exampleEntry) {
                                exampleText = exampleEntry.ja;
                                koreanTranslation = exampleEntry.ko;
                              }
                            }
                            // Fallback to old structure or direct properties
                            else {
                              exampleText = dictentry.examples?.example || vocab.example;
                              koreanTranslation = dictentry.examples?.koExample || vocab.koExample;
                            }


                            // If we have English translation but no Korean, provide a simple mapping for common phrases
                            if (!vocab.koExample && !vocab.dictentry?.examples?.koExample && vocab.dictentry?.examples?.exampleTranslation) {
                              const englishTranslation = vocab.dictentry.examples.exampleTranslation;
                              // Simple mapping for common Japanese phrases
                              const commonTranslations = {
                                'Good morning': '좋은 아침입니다',
                                'Good morning (polite)': '안녕하세요 (아침 인사)',
                                'Hello': '안녕하세요',
                                'Thank you': '감사합니다',
                                'Thank you for helping': '도와주셔서 감사합니다',
                                'Excuse me': '실례합니다',
                                'I am a student': '저는 학생입니다',
                                'Good night': '좋은 밤 되세요',
                                'Goodbye': '안녕히 가세요'
                              };

                              koreanTranslation = commonTranslations[englishTranslation] || englishTranslation;
                            }
                          }
                          // For English vocabulary
                          else {
                            // 다양한 소스에서 영어 예문 찾기
                            console.log('Starting English example search for:', vocab.lemma);
                            console.log('vocab.example:', vocab.example);
                            console.log('exampleExample:', exampleExample);

                            // 1. exampleExample에서 직접 찾기 (CEFR 데이터가 있을 때)
                            console.log('Checking exampleExample for English vocab:', exampleExample);
                            if (exampleExample && exampleExample.en) {
                              exampleText = exampleExample.en;
                              console.log('Found english example from exampleExample:', exampleText);
                            }
                            // 2. vocab.example에서 찾기 (보조 소스)
                            else if (vocab.example) {
                              exampleText = vocab.example;
                              console.log('Found english example from vocab.example:', exampleText);
                            }
                            // 3. 숙어/구동사 데이터에서 영어 예문 찾기 (dictentry.examples 배열 또는 객체)
                            else if (vocab.dictentry && vocab.dictentry.examples) {
                              console.log('Checking vocab.dictentry.examples:', vocab.dictentry.examples);
                              // Check if examples is an array or object
                              if (Array.isArray(vocab.dictentry.examples)) {
                                console.log('dictentry.examples is array with length:', vocab.dictentry.examples.length);
                                console.log('First example:', vocab.dictentry.examples[0]);
                                const exampleEntry = vocab.dictentry.examples.find(ex => ex.kind === 'example' && ex.en);
                                console.log('Found exampleEntry with en field:', exampleEntry);
                                if (exampleEntry) {
                                  exampleText = exampleEntry.en;
                                  koreanTranslation = exampleEntry.ko;
                                  console.log('Found english example from dictentry.examples:', exampleText);
                                  console.log('Found korean translation from dictentry.examples:', koreanTranslation);
                                }
                              } else if (typeof vocab.dictentry.examples === 'object') {
                                // For Japanese vocab where examples is an object
                                if (vocab.dictentry.examples.example) {
                                  exampleText = vocab.dictentry.examples.example;
                                  console.log('Found example from dictentry.examples object:', exampleText);
                                }
                              }
                              // 1.5. dictentry.examples에서 찾지 못했으면 chirpScript에서 영어 예문 추출 (CEFR 데이터)
                              else if (exampleExample && exampleExample.chirpScript) {
                                console.log('Processing chirpScript:', exampleExample.chirpScript);
                                // "예문은 I need a pen to write this down. 이것을" 패턴에서 영어 부분 추출
                                let match = exampleExample.chirpScript.match(/예문은\s+([^.]+\.)/);
                                console.log('First pattern match:', match);
                                if (match) {
                                  exampleText = match[1].trim();
                                  console.log('Found english example (pattern 1):', exampleText);
                                } else {
                                  // "What is the book about? 그 책은" 패턴에서 영어 부분 추출
                                  // 영어 문장 다음에 공백이 있고 한글이 나오는 패턴을 찾음
                                  match = exampleExample.chirpScript.match(/([A-Z][^가-힣]*[?!.])\s+[가-힣]/);
                                  console.log('Second pattern match:', match);
                                  if (match) {
                                    exampleText = match[1].trim();
                                    console.log('Found english example (pattern 2):', exampleText);
                                  } else {
                                    console.log('No pattern matched for chirpScript');
                                  }
                                }
                              }
                            }
                            // 2. exampleExample.en에서 찾기
                            else if (exampleExample?.en) {
                              exampleText = exampleExample.en;
                            }
                            // 3. exampleExample 자체가 문자열인 경우
                            else if (typeof exampleExample === 'string') {
                              exampleText = exampleExample;
                            }
                            // 4. definitions 내부의 examples에서 찾기
                            else if (exampleExample?.definitions) {
                              for (const def of exampleExample.definitions) {
                                if (def.examples && def.examples.length > 0) {
                                  // 첫 번째 예문이 객체인 경우 en 필드 사용, 문자열인 경우 그대로 사용
                                  const firstExample = def.examples[0];
                                  if (typeof firstExample === 'object' && firstExample.en) {
                                    exampleText = firstExample.en;
                                  } else if (typeof firstExample === 'string') {
                                    exampleText = firstExample;
                                  }
                                  break;
                                }
                              }
                            }

                            koreanTranslation = vocab.koExample || exampleExample?.ko;
                            console.log('Final exampleText:', exampleText);
                            console.log('Final koreanTranslation:', koreanTranslation);
                          }


                          return (
                            <>
                              {exampleText && (
                                <span className="d-block fw-bold mb-1" lang={vocab.kana ? "ja" : "en"}>
                                  {exampleText}
                                </span>
                              )}
                              {koreanTranslation && (
                                <span className="text-muted small">— {koreanTranslation}</span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* 사용법 섹션 - 숙어/구동사용 */}
                {(() => {
                  // dictentry.examples에서 usage 종류의 데이터 찾기
                  if (vocab.dictentry && vocab.dictentry.examples && Array.isArray(vocab.dictentry.examples)) {
                    const usageEntry = vocab.dictentry.examples.find(ex => ex.kind === 'usage' && ex.ko);
                    if (usageEntry) {
                      return (
                        <div className="mt-3 border-top pt-3">
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <h6 className="fw-bold mb-0">사용법</h6>
                            {(() => {
                              // 사용법 오디오 버튼
                              const dictentry = vocab.dictentry;
                              const audioData = parseAudioLocal(dictentry?.audioLocal);
                              const isIdiomOrPhrasal = vocab.source === 'idiom_migration';
                              
                              // 숙어/구동사의 경우 example 오디오를 사용법에서 재생
                              const usageAudioPath = isIdiomOrPhrasal ? audioData?.example : audioData?.gloss;
                              const isUsagePlaying = playingAudio?.type === 'usage' && playingAudio?.id === vocab.id;
                              
                              if (usageAudioPath && onPlayUrl) {
                                return (
                                  <button
                                    className="btn btn-sm btn-outline-primary rounded-circle d-flex align-items-center justify-content-center"
                                    style={{ width: '32px', height: '32px' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // 절대 경로로 변환
                                      const absolutePath = usageAudioPath.startsWith('/') ? usageAudioPath : `/${usageAudioPath}`;
                                      onPlayUrl(absolutePath, 'usage', vocab.id);
                                    }}
                                    aria-label="사용법 오디오 재생"
                                    title="사용법 듣기"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={`bi ${isUsagePlaying ? 'bi-pause-fill' : 'bi-play-fill'}`} viewBox="0 0 16 16">
                                      {isUsagePlaying ? (
                                        <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z" />
                                      ) : (
                                        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z M6.271 5.055a.5.5 0 0 1 .52.098L11.5 7.854a.5.5 0 0 1 0 .292L6.791 10.847a.5.5 0 0 1-.791-.292V5.445a.5.5 0 0 1 .271-.39z" />
                                      )}
                                    </svg>
                                  </button>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          <div className="mb-2 p-2 rounded bg-light">
                            <div className="me-2">
                              <span className="text-muted small">{usageEntry.ko}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  }
                  return null;
                })()}
                
              </div>
            ) : (
              // Only show "no detailed info" message for non-Japanese vocabulary without examples
              !vocab.kana && !vocab.example && !vocab.koExample && !vocab.dictentry?.examples?.example && !vocab.dictentry?.examples?.koExample && (
                <p className="text-muted mt-3">상세한 뜻 정보가 없습니다.</p>
              )
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
