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
  const rawMeanings = Array.isArray(dictentry.examples) ? dictentry.examples : [];
  
  // 고급 중복 제거: pos 기준으로 그룹화하여 가장 좋은 것만 선택
  const posGroups = new Map();
  for (const meaning of rawMeanings) {
    const pos = (meaning.pos || 'unknown').toLowerCase().trim();
    if (!posGroups.has(pos)) {
      posGroups.set(pos, []);
    }
    posGroups.get(pos).push(meaning);
  }
  
  const meanings = [];
  for (const [pos, groupMeanings] of posGroups.entries()) {
    if (groupMeanings.length === 1) {
      meanings.push(groupMeanings[0]);
    } else {
      // 같은 pos를 가진 여러 meanings 중에서 최고 선택
      const best = groupMeanings.reduce((prev, current) => {
        const prevExampleCount = prev.definitions?.[0]?.examples?.length || 0;
        const currentExampleCount = current.definitions?.[0]?.examples?.length || 0;
        
        if (currentExampleCount > prevExampleCount) return current;
        if (prevExampleCount > currentExampleCount) return prev;
        
        const prevKoDef = prev.definitions?.[0]?.ko_def || '';
        const currentKoDef = current.definitions?.[0]?.ko_def || '';
        
        if (currentKoDef.length > prevKoDef.length) return current;
        if (prevKoDef.length > currentKoDef.length) return prev;
        
        const prevDef = prev.definitions?.[0]?.def || '';
        const currentDef = current.definitions?.[0]?.def || '';
        
        return currentDef.length > prevDef.length ? current : prev;
      });
      meanings.push(best);
    }
  }
  
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
            <Pron ipa={dictentry.ipa} ipaKo={dictentry.ipaKo} />

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
                            // 모든 CEFR 레벨에 대해 동일한 경로 패턴 사용
                            const audioFileName = getSmartAudioFileName(vocab.lemma, vocab.pos);
                            const localAudioPath = `/${vocab.levelCEFR}/audio/${audioFileName}.mp3`;
                            return (
                              <li key={exIndex} className="d-flex justify-content-between align-items-center mb-2 p-2 rounded bg-light">
                                <div className="me-2">
                                  <span lang="en" className="d-block">{ex.example || ex.de}</span>
                                  <span className="text-muted small">— {ex.ko_example || ex.ko}</span>
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
