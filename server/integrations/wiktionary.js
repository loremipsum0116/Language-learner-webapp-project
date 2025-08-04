// server/integrations/wiktionary.js

const WIKI_API = 'https://ko.wiktionary.org/w/api.php';

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

  const ipaMatch = englishText.match(/\{\{(?:en-)?IPA\|([^}]+)\}\}/i);
  if (ipaMatch) result.ipa = ipaMatch[1].trim();

  const audioMatch = englishText.match(/(?:\[\[파일:|{{발음 듣기\|)([^|\]]+\.(?:ogg|mp3))/i);
  if (audioMatch) result.audioTitles.push(audioMatch[1]);

  const posSectionMatch = englishText.match(/(===\s*(?:명사|동사|형용사|부사)\s*===[\s\S]*)/);
  const textToSearch = posSectionMatch ? posSectionMatch[1] : englishText;

  const lines = textToSearch.split('\n');
  for (const line of lines) {
    const meaningLineMatch = line.match(/^(?:#|\*?\s*'''?1\.)/);
    if (meaningLineMatch) {
      // ▼▼▼ 핵심 수정: 텍스트 정제 로직 강화 ▼▼▼
      let meaning = line
        .replace(/^(?:#|\*?\s*'''?)?1\.(?:'''|\s)*/, '') // #, 1. 등 접두사 제거
        .replace(/<[^>]+>/g, '')      // HTML 태그 제거
        .replace(/\[\[([^|\]]+?)(?:\|[^\]]+)?\]\]/g, '$1') // 위키 링크 [[표시|값]] -> 표시
        .replace(/\{\{.+?\}\}/g, '')      // {{...}} 템플릿 제거
        .replace(/\(불가산\)|\(가산\)/g, '') // (불가산), (가산) 등 괄호 안 설명 제거
        .replace(/[.'"]/g, '')       // 불필요한 문장 부호 제거
        .split(/,|;/)[0]              // 쉼표나 세미콜론이 있으면 첫 번째 뜻만 사용
        .trim();
      
      if (meaning) {
        result.koreanMeaning = meaning;
        break; 
      }
    }
  }

  const exampleRegex = /\{\{(?:예|uxi)\|(?:en\|)?([^|]+)\|([^}]+)\}\}/g;
  let exampleMatch;
  while ((exampleMatch = exampleRegex.exec(englishText)) !== null && result.examples.length < 3) {
    result.examples.push({
      de: exampleMatch[1].trim(),
      ko: exampleMatch[2].trim(),
      source: 'ko-wiktionary'
    });
  }

  return result;
}

function findEnglishTranslation(koreanWikitext) {
 console.log('[FindTranslation] 함수가 수신한 텍스트 (앞 100자):', koreanWikitext.substring(0, 100).replace(/\n/g, "\\n"));

  const translationSectionMatch = koreanWikitext.match(/===\s*번역\s*===([\s\S]*?)(?===|$)/);
  
  console.log('[FindTranslation] "번역" 섹션 찾기 시도 결과:', !!translationSectionMatch);
  if (!translationSectionMatch) return null;

  const translationText = translationSectionMatch[1];
  console.log('[FindTranslation] 분리된 "번역" 섹션 텍스트 (앞 100자):', translationText.substring(0, 100).replace(/\n/g, "\\n"));

  const regex = /\*\s*영어(?:\(en\))?\s*:\s*(?:\[\[([^\]]+)\]\]|\{\{t\|en\|([^}]+)\}\})/;
  const englishMatch = translationText.match(regex);

  console.log('[FindTranslation] 최종 정규식 매치 결과:', englishMatch);
  // ▲▲▲ 진단용 로그 종료 ▲▲▲
  
  if (englishMatch) {
    return (englishMatch[1] || englishMatch[2] || '').trim();
  }
  return null;
}

async function fetchWiktionaryWikitext(lemma) {
  const url = `${WIKI_API}?action=parse&prop=wikitext&format=json&page=${encodeURIComponent(lemma)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Vocab-Learner/1.0' } });
  if (!res.ok) throw new Error(`wiktionary http ${res.status}`);
  const json = await res.json();
  const text = json?.parse?.wikitext?.['*'] || '';
  return text;
}

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
  findEnglishTranslation,
};