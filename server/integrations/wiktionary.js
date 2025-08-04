// server/integrations/wiktionary.js
// ★★★★★ 수정된 부분: API 주소를 영어 위키로 변경 ★★★★★
const WIKI_API = 'https://en.wiktionary.org/w/api.php';

// ★★★★★ 수정된 부분: 영어 위키 구조에 맞게 파서 로직 전면 수정 ★★★★★
/**
 * 영어 위키텍스트를 분석하여 IPA, 오디오 파일, 예문을 추출합니다.
 * @param {string} wikitext - 파싱할 위키텍스트
 * @returns {{ipa: string|null, audioTitles: string[], examples: {de: string, ko: string|null, source: string}[]}}
 */
function parseWikitext(wikitext = '') {
  const out = { ipa: null, audioTitles: [], examples: [] };

  // IPA: {{IPA|/ipa_string/|lang=en}}
  const ipaMatch = wikitext.match(/\{\{IPA\|([^}]+)\|lang=en\}\}/i) || wikitext.match(/\{\{IPA\|en\|([^}]+)\}\}/i);
  if (ipaMatch) {
    out.ipa = ipaMatch[1].replace(/\//g, '').trim();
  }

  // 오디오 파일: {{audio|en|Filename.ogg}}
  const audioRegex = /\{\{audio\|en\|([^|}]+)/gi;
  let m;
  while ((m = audioRegex.exec(wikitext)) !== null) {
    out.audioTitles.push(m[1]);
  }

  // 예문: {{ux|en|This is an example.}}
  const exampleRegex = /\{\{ux\|en\|([^}]+)\}\}/gi;
  while ((m = exampleRegex.exec(wikitext)) !== null) {
    out.examples.push({ de: m[1], ko: null, source: 'wiktionary-en' }); // 'de' 필드는 텍스트 저장을 위해 그대로 사용
    if (out.examples.length >= 3) break;
  }

  return out;
}

// MediaWiki parse API로 위키텍스트 가져오기 (수정 불필요)
async function fetchWiktionaryWikitext(lemma) {
  const url = `${WIKI_API}?action=parse&prop=wikitext&format=json&page=${encodeURIComponent(lemma)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'en-learner/0.1' } }); // User-Agent 변경
  if (!res.ok) throw new Error(`wiktionary http ${res.status}`);
  const json = await res.json();
  const text = json?.parse?.wikitext?.['*'] || '';
  return text;
}

// Commons의 파일 실제 URL 조회(오디오 다운로드용) (수정 불필요)
async function fetchCommonsFileUrl(title) {
  const url = `${WIKI_API}?action=query&titles=File:${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&format=json`; // "Datei:" -> "File:"
  const res = await fetch(url, { headers: { 'User-Agent': 'en-learner/0.1' } });
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