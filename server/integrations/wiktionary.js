// server/integrations/wiktionary.js

const WIKI_API = 'https://ko.wiktionary.org/w/api.php';

/**
 * 다양한 예외 서식을 처리하도록 완성된 최종 Wiktionary 파서
 * @param {string} wikitext - 파싱할 위키텍스트
 * @returns {{ipa: string|null, audioTitles: string[], koreanMeaning: string|null, examples: {de: string, ko: string|null}[]}}
 */
function parseWikitext(wikitext = '') {
  const result = {
    ipa: null,
    audioTitles: [],
    koreanMeaning: null,
    examples: [],
  };

  const englishSectionMatch = wikitext.match(/==\s*영어\s*==([\s\S]*?)(?===?\s*다른 언어\s*==?|$)/);
  if (!englishSectionMatch) return result;
  
  const englishText = englishSectionMatch[1];

  // --- IPA 추출 로직 ({{IPA|...}} 와 {{en-IPA|...}} 패턴 모두 처리) ---
  const ipaMatch = englishText.match(/\{\{(?:en-)?IPA\|([^}]+)\}\}/i);
  if (ipaMatch) result.ipa = ipaMatch[1].trim();

  // --- 오디오 파일명 추출 로직 ({{발음 듣기|...}} 와 [[파일:...]] 패턴 모두 처리) ---
  const audioMatch = englishText.match(/(?:\[\[파일:|{{발음 듣기\|)([^|\]]+\.(?:ogg|mp3))/i);
  if (audioMatch) result.audioTitles.push(audioMatch[1]);

  // --- 한국어 뜻 추출 로직 (가장 중요) ---
  const posSectionMatch = englishText.match(/(===\s*(?:명사|동사|형용사|부사)\s*===[\s\S]*)/);
  const textToSearch = posSectionMatch ? posSectionMatch[1] : englishText;

  const lines = textToSearch.split('\n');
  for (const line of lines) {
    // # 또는 1. 로 시작하는 줄을 찾음
    const meaningLineMatch = line.match(/^(?:#|\*?\s*'''?1\.)/);
    if (meaningLineMatch) {
      // 위키 마크업을 최대한 제거하여 순수한 텍스트만 추출
      let meaning = line
        .replace(/^(?:#|\*?\s*'''?)?1\.(?:'''|\s)*/, '') // 접두사 제거
        .replace(/<[^>]+>/g, '')      // HTML 태그 제거
        .replace(/\[\[([^|\]]+?)(?:\|[^\]]+)?\]\]/g, '$1') // 위키 링크 처리
        .replace(/\{\{.+?\}\}/g, '')      // {{...}} 템플릿 제거
        .replace(/[.'"]/g, '')       // 불필요한 문장 부호 제거
        .trim();
      
      if (meaning) {
        result.koreanMeaning = meaning;
        break; // 가장 첫 번째 뜻만 사용하고 중단
      }
    }
  }

  // --- 예문 추출 로직 ---
  const exampleRegex = /\{\{(?:예|uxi)\|(?:en\|)?([^|]+)\|([^}]+)\}\}/g;
  let exampleMatch;
  while ((exampleMatch = exampleRegex.exec(englishText)) !== null && result.examples.length < 3) {
    result.examples.push({
      de: exampleMatch[1].trim(), // 영어 예문
      ko: exampleMatch[2].trim(), // 한국어 번역
      source: 'ko-wiktionary'
    });
  }

  return result;
}

// (수정 불필요)
async function fetchWiktionaryWikitext(lemma) {
  const url = `${WIKI_API}?action=parse&prop=wikitext&format=json&page=${encodeURIComponent(lemma)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Vocab-Learner/1.0' } });
  if (!res.ok) throw new Error(`wiktionary http ${res.status}`);
  const json = await res.json();
  const text = json?.parse?.wikitext?.['*'] || '';
  return text;
}

// (수정 불필요)
async function fetchCommonsFileUrl(title) {
  const commonsApi = 'https://en.wiktionary.org/w/api.php';
  const url = `${commonsApi}?action=query&titles=File:${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&format=json`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Vocab-Learner/1.0' } });
  if (!res.ok) throw new Error(`commons http ${res.status}`);
  const json = await res.json();
  const pages = json?.query?.pages || {};
  const first = Object.values(pages)[0];
  const fileUrl = first?.imageinfo?.[0]?.url || null;
  return fileUrl;
}

module.exports = {
  parseWikitext,
  fetchWiktionaryWikitext,
  fetchCommonsFileUrl,
};