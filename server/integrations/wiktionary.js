// server/integrations/wiktionary.js
// Node 18+: global fetch 사용
const WIKI_API = 'https://de.wiktionary.org/w/api.php';

// 간단 파서: IPA / 오디오 파일명 / 예문 추정
function parseWikitext(wikitext = '') {
  const out = { ipa: null, audioTitles: [], examples: [] };

  // IPA: {{Lautschrift|...}} 또는 {{IPA|...}}
  const ipaMatch = wikitext.match(/\{\{(?:Lautschrift|IPA)\|([^}]+)\}\}/i);
  if (ipaMatch) out.ipa = ipaMatch[1].trim().replace(/\|/g, ' ').split(/\s+/)[0];

  // 오디오 파일: [[Datei:...ogg]] 또는 [[File:...ogg]]
  const audioRegex = /\[\[(?:Datei|File):([^[\]|]+?\.(?:ogg|wav|mp3))/gi;
  let m;
  while ((m = audioRegex.exec(wikitext)) !== null) {
    out.audioTitles.push(m[1]);
  }

  // 예문(아주 단순): #: ''Beispiel:'' ... 또는 * ...
  // 실제 품질은 낮으므로 후속(코퍼스)와 병합 권장
  const lines = wikitext.split('\n').slice(0, 400);
  for (const line of lines) {
    const s = line.trim();
    const ex = s.replace(/^#:\s*''Beispiel:''\s*/i, '').replace(/^#\s*/, '').replace(/''/g, '');
    if (ex && /^[A-ZÄÖÜß]/.test(ex) && ex.split(' ').length >= 3) {
      out.examples.push({ de: ex, ko: null, source: 'wiktionary' });
      if (out.examples.length >= 3) break;
    }
  }

  return out;
}

// MediaWiki parse API로 위키텍스트 가져오기
async function fetchWiktionaryWikitext(lemma) {
  const url = `${WIKI_API}?action=parse&prop=wikitext&format=json&page=${encodeURIComponent(lemma)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'de-learner/0.1' } });
  if (!res.ok) throw new Error(`wiktionary http ${res.status}`);
  const json = await res.json();
  const text = json?.parse?.wikitext?.['*'] || '';
  return text;
}

// Commons의 파일 실제 URL 조회(오디오 다운로드용)
async function fetchCommonsFileUrl(title) {
  // title 예: "De-stehen.ogg"
  const url = `${WIKI_API}?action=query&titles=Datei:${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&format=json`;
  const res = await fetch(url, { headers: { 'User-Agent': 'de-learner/0.1' } });
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
