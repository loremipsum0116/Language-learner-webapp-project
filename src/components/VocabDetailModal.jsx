// src/components/VocabDetailModal.jsx
import React, { useState } from 'react';
import Pron from './Pron';
import { API_BASE } from '../api/client';
// ❌ Do not import SrsFolderPickerModal / SrsApi here. The parent (VocabList) handles SRS.
import { toast } from 'react-toastify';

function safeFileName(str) {
  if (!str) return '';
  return encodeURIComponent(str.toLowerCase().replace(/\s+/g, '_'));
}

function getAudioFileName(lemma, pos) {
  if (!lemma) return '';
  
  // Handle special cases with parentheses
  if (lemma.includes('(')) {
    // Method 1: Try direct file name pattern: "lemma(pos).mp3"
    const posAbbrev = {
      'noun': 'n',
      'verb': 'v', 
      'adjective': 'adj',
      'adverb': 'adv',
      'preposition': 'prep'
    };
    
    const cleanLemma = lemma.toLowerCase();
    const shortPos = posAbbrev[pos?.toLowerCase()] || pos?.toLowerCase() || 'unknown';
    return `${cleanLemma}(${shortPos})`;
  }
  
  // Regular case - use existing safeFileName
  return safeFileName(lemma);
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

// Get best matching audio file name using similarity
function getBestMatchingFileName(lemma, pos, availableFiles) {
  if (!lemma) return '';
  
  const lemmaLower = lemma.toLowerCase();
  
  // For words without parentheses, use simple encoding
  if (!lemma.includes('(')) {
    return safeFileName(lemma);
  }
  
  // Known mappings for parentheses words based on actual files
  const knownMappings = {
    'rock (music)': 'rock (music)',
    'rock (stone)': 'rock (stone)(n)',
    'light (not heavy)': 'light (not heavy)(adj)',
    'light (from the sun/a lamp)': 'light (from the suna lamp)(v)',
    'last (taking time)': 'last (taking time)(v)',
    'last (final)': 'last (final)(unknown)',
    'mine (belongs to me)': 'mine (belongs to me)(pron)',
    'bank (money)': 'bank (money)',
    'bear (animal)': 'bear (animal)',
    'race (competition)': 'race (competition)(unknown)',
    'rest (remaining part)': 'rest (remaining part)(n)',
    'rest (sleep/relax)': 'rest (sleeprelax)(unknown)'
  };
  
  // Check known mappings first
  if (knownMappings[lemmaLower]) {
    return knownMappings[lemmaLower];
  }
  
  // If we have available files, find the best match
  if (availableFiles && availableFiles.length > 0) {
    let bestMatch = '';
    let bestScore = 0;
    
    // Extract base names from files (remove .mp3 extension)
    const fileNames = availableFiles.map(file => 
      file.replace('.mp3', '').toLowerCase()
    );
    
    // Try to find the best matching file
    for (const fileName of fileNames) {
      // Direct match
      if (fileName === lemmaLower) {
        return fileName;
      }
      
      // Check if filename starts with the lemma base word
      const baseWord = lemmaLower.split(' ')[0];
      if (fileName.startsWith(baseWord)) {
        const score = stringSimilarity(lemmaLower, fileName);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = fileName;
        }
      }
    }
    
    // If we found a good match (>0.6 similarity), use it
    if (bestMatch && bestScore > 0.6) {
      return bestMatch;
    }
  }
  
  // Fallback: try with abbreviated pos
  const posAbbrev = {
    'noun': 'n',
    'verb': 'v', 
    'adjective': 'adj',
    'adverb': 'adv',
    'preposition': 'prep'
  };
  
  const shortPos = posAbbrev[pos?.toLowerCase()] || pos?.toLowerCase() || 'unknown';
  return `${lemmaLower}(${shortPos})`;
}

// 오디오 파일 목록을 서버에서 가져오는 함수
const audioFilesCache = new Map();

const fetchAudioFiles = async (level) => {
  if (audioFilesCache.has(level)) {
    return audioFilesCache.get(level);
  }
  
  try {
    const response = await fetch(`${API_BASE}/audio-files/${level}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio files for ${level}`);
    }
    const data = await response.json();
    const files = data.files || [];
    
    // 캐시에 저장
    audioFilesCache.set(level, files);
    return files;
  } catch (error) {
    console.error(`Error fetching audio files for ${level}:`, error);
    return [];
  }
};

// Smart file name matching based on known patterns (synchronous version for VocabDetailModal)
function getSmartAudioFileName(lemma, pos) {
  if (!lemma) return '';
  
  const lemmaLower = lemma.toLowerCase();
  
  // For words without parentheses, use simple encoding
  if (!lemma.includes('(')) {
    return safeFileName(lemma);
  }
  
  // Enhanced known mappings for parentheses words based on ACTUAL A2 files
  const knownMappings = {
    // Correct A2 file mappings
    'rock (music)': 'rock (music)',
    'rock (stone)': 'rock (stone)(n)',
    'light (not heavy)': 'light (not heavy)(adj)',
    'light (from the sun/a lamp)': 'light (from the sun)',
    'last (taking time)': 'last (taking time)(v)',
    'last (final)': 'last (final)',
    'mine (belongs to me)': 'mine (belongs to me)',
    'bear (animal)': 'bear (animal)',
    'bank (money)': 'bank (money)', // A1에서도 매칭되도록 추가
    'race (competition)': 'race (competition)',
    'rest (remaining part)': 'rest (remaining part)',
    'rest (sleep/relax)': 'rest (sleeprelax)(unkown)', // Note: actual file has typo "unkown"
    'second (next after the first)': 'second (next after the first)',
    
    // Additional mappings for common patterns
    'used to': 'used to',
    'have': 'have',
    'may': 'may',
    'might': 'might',
    'either': 'either',
    'neither': 'neither'
  };
  
  // Check known mappings first
  if (knownMappings[lemmaLower]) {
    return knownMappings[lemmaLower];
  }
  
  // Handle slash-separated words in parentheses
  if (lemmaLower.includes('/')) {
    // Replace "/" with empty string for matching
    const withoutSlash = lemmaLower.replace(/\//g, '');
    if (knownMappings[withoutSlash]) {
      return knownMappings[withoutSlash];
    }
  }
  
  // Fallback: try with abbreviated pos
  const posAbbrev = {
    'noun': 'n',
    'verb': 'v', 
    'adjective': 'adj',
    'adverb': 'adv',
    'preposition': 'prep'
  };
  
  const shortPos = posAbbrev[pos?.toLowerCase()] || pos?.toLowerCase() || 'unknown';
  return `${lemmaLower}(${shortPos})`;
}

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
  playingAudio,
  onAddSRS,
}) {
  const dictentry = vocab?.dictentry || {};
  
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
  
  const uniquePosList = [...new Set(vocab.pos ? vocab.pos.split(',').map(p => p.trim()) : [])];
  const isVocabPlaying = playingAudio?.type === 'vocab' && playingAudio?.id === vocab.id;
  const isExamplePlaying = playingAudio?.type === 'example' && playingAudio?.id === vocab.id;

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
                onClick={(e) => { 
                  e.stopPropagation(); 
                  
                  // CEFR 레벨을 실제 폴더명으로 매핑
                  const cefrToFolder = {
                    'A1': 'starter',
                    'A2': 'elementary', 
                    'B1': 'intermediate',
                    'B2': 'upper',
                    'C1': 'advanced',
                    'C2': 'advanced'
                  };
                  
                  // cefr_vocabs.json의 audio 경로 사용
                  let audioData = null;
                  if (dictentry.audioLocal) {
                    try {
                      // Check if it's already a valid JSON string
                      if (typeof dictentry.audioLocal === 'string' && dictentry.audioLocal.startsWith('{')) {
                        audioData = JSON.parse(dictentry.audioLocal);
                      } else if (typeof dictentry.audioLocal === 'string') {
                        // It's a simple path string, not JSON - create proper paths
                        const basePath = dictentry.audioLocal.replace(/\/(word|gloss|example)\.mp3$/, '');
                        audioData = { 
                          word: `${basePath}/word.mp3`, 
                          gloss: `${basePath}/gloss.mp3`,
                          example: `${basePath}/example.mp3` 
                        };
                      } else {
                        audioData = dictentry.audioLocal;
                      }
                    } catch (e) {
                      console.warn('Failed to parse audioLocal:', e, dictentry.audioLocal);
                      // Fallback: treat as simple path - create proper paths
                      const basePath = dictentry.audioLocal.replace(/\/(word|gloss|example)\.mp3$/, '');
                      audioData = { 
                        word: `${basePath}/word.mp3`, 
                        gloss: `${basePath}/gloss.mp3`,
                        example: `${basePath}/example.mp3` 
                      };
                    }
                  }
                  // 상세 보기 상단 오디오는 gloss 경로 사용
                  const glossAudioPath = audioData?.gloss;
                  
                  if (glossAudioPath && onPlayUrl) {
                    // 절대 경로로 변환
                    const absolutePath = glossAudioPath.startsWith('/') ? glossAudioPath : `/${glossAudioPath}`;
                    onPlayUrl(absolutePath, 'vocab', vocab.id);
                  } else {
                    // 폴백: 기존 방식
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

            {glossExample || exampleExample ? (
              <div className="mt-3">
                {glossExample && (
                  <div className="mb-3">
                    <div className="ps-2 mt-2">
                      <p className="mb-1">
                        <strong>{glossExample.ko}</strong>
                      </p>
                    </div>
                  </div>
                )}
                
                {((exampleExample && exampleExample.ko) || vocab.example || vocab.koExample) && (
                  <div className="mt-3 border-top pt-3">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <h6 className="fw-bold mb-0">예문</h6>
                      {(() => {
                        // CEFR 레벨을 실제 폴더명으로 매핑
                        const cefrToFolder = {
                          'A1': 'starter',
                          'A2': 'elementary', 
                          'B1': 'intermediate',
                          'B2': 'upper',
                          'C1': 'advanced',
                          'C2': 'advanced'
                        };
                        
                        // cefr_vocabs.json의 audio.example 경로 사용 (예문 제목 옆 버튼)
                        let audioData = null;
                        if (dictentry.audioLocal) {
                          try {
                            // Check if it's already a valid JSON string
                            if (typeof dictentry.audioLocal === 'string' && dictentry.audioLocal.startsWith('{')) {
                              audioData = JSON.parse(dictentry.audioLocal);
                            } else if (typeof dictentry.audioLocal === 'string') {
                              // It's a simple path string, not JSON - create proper paths
                              const basePath = dictentry.audioLocal.replace(/\/(word|gloss|example)\.mp3$/, '');
                              audioData = { 
                                word: `${basePath}/word.mp3`, 
                                gloss: `${basePath}/gloss.mp3`,
                                example: `${basePath}/example.mp3` 
                              };
                            } else {
                              audioData = dictentry.audioLocal;
                            }
                          } catch (e) {
                            console.warn('Failed to parse audioLocal for example:', e, dictentry.audioLocal);
                            // Fallback: treat as simple path - create proper paths
                            const basePath = dictentry.audioLocal.replace(/\/(word|gloss|example)\.mp3$/, '');
                            audioData = { 
                              word: `${basePath}/word.mp3`, 
                              gloss: `${basePath}/gloss.mp3`,
                              example: `${basePath}/example.mp3` 
                            };
                          }
                        }
                        const exampleAudioPath = audioData?.example;
                        
                        // 숙어/구동사의 경우 예문 오디오 버튼을 숨김 (사용법 섹션에서 재생)
                        const isIdiomOrPhrasal = vocab.source === 'idiom';
                        
                        console.log('Audio button check:', { exampleAudioPath, isIdiomOrPhrasal, vocabSource: vocab.source });
                        
                        if (exampleAudioPath && !isIdiomOrPhrasal) {
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
                          // 다양한 소스에서 영어 예문 찾기
                          let englishExample = '';
                          
                          // 1. vocab.example에서 직접 찾기 (CEFR 데이터의 주요 소스)
                          if (vocab.example) {
                            englishExample = vocab.example;
                          }
                          // 1.1. 숙어/구동사 데이터에서 영어 예문 찾기 (dictentry.examples 배열)
                          else if (vocab.dictentry && vocab.dictentry.examples) {
                            const exampleEntry = vocab.dictentry.examples.find(ex => ex.kind === 'example' && ex.en);
                            if (exampleEntry) {
                              englishExample = exampleEntry.en;
                            }
                          }
                          // 1.5. chirpScript에서 영어 예문 추출 (CEFR 데이터)
                          else if (exampleExample && exampleExample.chirpScript) {
                            // "예문은 I need a pen to write this down. 이것을" 패턴에서 영어 부분 추출
                            const match = exampleExample.chirpScript.match(/예문은\s+([^.]+\.)/);
                            if (match) {
                              englishExample = match[1].trim();
                            }
                          }
                          // 2. exampleExample.en에서 찾기
                          else if (exampleExample.en) {
                            englishExample = exampleExample.en;
                          }
                          // 3. exampleExample 자체가 문자열인 경우
                          else if (typeof exampleExample === 'string') {
                            englishExample = exampleExample;
                          }
                          // 4. definitions 내부의 examples에서 찾기
                          else if (exampleExample.definitions) {
                            for (const def of exampleExample.definitions) {
                              if (def.examples && def.examples.length > 0) {
                                // 첫 번째 예문이 객체인 경우 en 필드 사용, 문자열인 경우 그대로 사용
                                const firstExample = def.examples[0];
                                if (typeof firstExample === 'object' && firstExample.en) {
                                  englishExample = firstExample.en;
                                } else if (typeof firstExample === 'string') {
                                  englishExample = firstExample;
                                }
                                break;
                              }
                            }
                          }
                          
                          return (
                            <>
                              {englishExample && (
                                <span lang="en" className="d-block fw-bold mb-1">{englishExample}</span>
                              )}
                              <span className="text-muted small">— {vocab.koExample || exampleExample.ko}</span>
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
                  if (vocab.dictentry && vocab.dictentry.examples) {
                    const usageEntry = vocab.dictentry.examples.find(ex => ex.kind === 'usage' && ex.ko);
                    if (usageEntry) {
                      return (
                        <div className="mt-3 border-top pt-3">
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <h6 className="fw-bold mb-0">사용법</h6>
                            {(() => {
                              // 사용법 오디오 버튼
                              const dictentry = vocab.dictentry;
                              let audioData = null;
                              if (dictentry?.audioLocal) {
                                try {
                                  if (typeof dictentry.audioLocal === 'string' && dictentry.audioLocal.startsWith('{')) {
                                    audioData = JSON.parse(dictentry.audioLocal);
                                  } else if (typeof dictentry.audioLocal === 'string') {
                                    // It's a simple path string, not JSON - create proper paths
                                    const basePath = dictentry.audioLocal.replace(/\/(word|gloss|example)\.mp3$/, '');
                                    audioData = { 
                                      word: `${basePath}/word.mp3`, 
                                      gloss: `${basePath}/gloss.mp3`,
                                      example: `${basePath}/example.mp3` 
                                    };
                                  } else {
                                    audioData = dictentry.audioLocal;
                                  }
                                } catch (e) {
                                  console.warn('Failed to parse audioLocal for usage:', e);
                                  // Fallback: treat as simple path - create proper paths
                                  const basePath = dictentry.audioLocal.replace(/\/(word|gloss|example)\.mp3$/, '');
                                  audioData = { 
                                    word: `${basePath}/word.mp3`, 
                                    gloss: `${basePath}/gloss.mp3`,
                                    example: `${basePath}/example.mp3` 
                                  };
                                }
                              }
                              const isIdiomOrPhrasal = vocab.source === 'idiom';
                              
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
