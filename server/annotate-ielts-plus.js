#!/usr/bin/env node
/**
 * annotate-ielts-plus.js (updated)
 * - IELTS.txt를 읽어 "중복 제거" 후 cefr_vocabs.json의 lemma와 매칭
 * - --match exact : 괄호/공백/대소문자(옵션)에 따라 "철자 그대로" 비교
 * - --sep line|whitespace : 입력 분리 방식 (기본: line)
 * - 원본 JSON은 수정하지 않고 새 JSON 파일 생성
 */

const fs = require('fs/promises');
const path = require('path');

(async () => {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (!args.jsonPath || !args.listPath) { usage(); process.exit(1); }

    const jsonPath = args.jsonPath;
    const listPath = args.listPath;

    const outJsonPath   = args.outPath || withSuffix(jsonPath, '.IELTS.json');
    const unmatchedPath = args.unmatchedPath || defaultUnmatchedPath(listPath);
    const categoryLabel = args.category || '수능';
    const insensitive   = !!args.insensitive;       // -i 주면 대소문자 무시
    const matchMode     = args.matchMode || 'exact'; // exact | base
    const sepMode       = args.sepMode || 'line';    // line | whitespace
    const dumpParenPath = args.dumpParenPath || null;
    const skipAnnotate  = !!args.skipAnnotate;
    const onlyParenTargets = !!args.onlyParenTargets;

    // 1) 입력 로드
    const rawJson  = (await fs.readFile(jsonPath, 'utf8')).replace(/^\uFEFF/, '');
    const vocab    = JSON.parse(rawJson);
    if (!Array.isArray(vocab)) throw new Error('cefr_vocabs.json 최상위는 배열이어야 합니다.');

    const rawList  = (await fs.readFile(listPath, 'utf8')).replace(/^\uFEFF/, '');
    const wordsRaw = splitWords(rawList, sepMode).map(s => s.trim()).filter(Boolean);

    // 2) 정규화/키 함수
    const lower = (x) => insensitive ? x.toLowerCase() : x;
    const norm  = (s) => lower(String(s).trim().replace(/\s+/g, ' '));
    const base  = (s) => String(s).replace(/\s*\([^)]*\)\s*/g, ' ').trim().replace(/\s+/g, ' ');
    // exact: 괄호 보존 / base: 괄호 제거
    const keyFn = (s) => (matchMode === 'base') ? norm(base(s)) : norm(s);
    const hasParen = (s) => /\(.*\)/.test(String(s));

    // (옵션) 괄호 포함 lemma 목록 덤프
    if (dumpParenPath) {
      const lemmasWithParen = vocab
        .map(it => it?.lemma)
        .filter(lem => typeof lem === 'string' && hasParen(lem));
      await fs.writeFile(dumpParenPath, lemmasWithParen.join('\n') + '\n', 'utf8');
      console.log(`[OK] 괄호 포함 lemma 추출 완료 → ${dumpParenPath} (count=${lemmasWithParen.length})`);
      if (skipAnnotate) return;
    }

    // 3) IELTS.txt 중복 제거(입력 순서 보존)
    const dedupedWords = dedupPreserveOrder(wordsRaw, keyFn);

    // 4) 인덱스 구축 (key → indices[])
    const index = new Map();
    vocab.forEach((item, i) => {
      const lem = item?.lemma;
      if (typeof lem !== 'string') return;
      const k = keyFn(lem);
      if (!index.has(k)) index.set(k, []);
      index.get(k).push(i);
    });

    // 5) 매칭 / 불일치
    const matched = [];
    const unmatched = [];
    for (const w of dedupedWords) {
      const k = keyFn(w);
      if (index.has(k)) matched.push(w);
      else unmatched.push(w);
    }

    // 6) 출력용 사본 + 태깅
    const out = vocab.map(x => ({ ...x })); // 원본 보호
    let annotatedCount = 0;
    const stamped = new Set();

    for (const w of matched) {
      const k = keyFn(w);
      const idxs = index.get(k) || [];
      for (const idx of idxs) {
        if (onlyParenTargets && !hasParen(out[idx]?.lemma)) continue; // 괄호 포함만 태깅
        const stamp = `${k}#${idx}`;
        if (stamped.has(stamp)) continue;
        if (addCategory(out[idx], categoryLabel)) annotatedCount++;
        stamped.add(stamp);
      }
    }

    // 7) 저장
    await fs.writeFile(outJsonPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
    await fs.writeFile(unmatchedPath, unmatched.join('\n') + '\n', 'utf8');

    // 8) 리포트
    console.log('[OK] IELTS 매칭/태깅 완료');
    console.log(` - 입력 JSON: ${jsonPath}`);
    console.log(` - 입력 리스트: ${listPath} (sep=${sepMode})`);
    console.log(` - 출력 JSON: ${outJsonPath}`);
    console.log(` - 불일치 목록: ${unmatchedPath}`);
    console.log(` - 원시 단어 수: ${wordsRaw.length}`);
    console.log(` - 중복 제거 후 단어 수: ${dedupedWords.length}`);
    console.log(` - 매칭 단어 수: ${matched.length}`);
    console.log(` - 불일치 단어 수: ${unmatched.length}`);
    console.log(` - 태깅된 JSON 항목 수(중복 제외): ${annotatedCount}`);
    console.log(` - 옵션: case=${insensitive ? 'insensitive' : 'sensitive'}, match=${matchMode}, sep=${sepMode}, category='${categoryLabel}', onlyParenTargets=${onlyParenTargets}`);

  } catch (err) {
    console.error('[ERROR]', err?.message || err);
    process.exit(1);
  }
})();

// ---------- helpers ----------

function usage() {
  console.log(
    '사용: node annotate-ielts-plus.js cefr_vocabs.json IELTS.txt ' +
    '[-o 출력.json] [--unmatched 불일치.txt] [-i] [--match exact|base] ' +
    '[--sep line|whitespace] [--category 라벨] ' +
    '[--dump-paren paren.txt] [--skip-annotate] [--only-paren-targets]'
  );
}

function parseArgs(argv) {
  const out = { jsonPath: argv[0], listPath: argv[1] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-o' || a === '--out') out.outPath = argv[++i];
    else if (a === '--unmatched') out.unmatchedPath = argv[++i];
    else if (a === '-i' || a === '--insensitive') out.insensitive = true;
    else if (a === '--match') {
      const v = (argv[++i] || '').toLowerCase();
      if (v !== 'exact' && v !== 'base') throw new Error('--match 값은 exact | base');
      out.matchMode = v;
    } else if (a === '--sep') {
      const v = (argv[++i] || '').toLowerCase();
      if (v !== 'line' && v !== 'whitespace') throw new Error('--sep 값은 line | whitespace');
      out.sepMode = v;
    } else if (a === '--category') out.category = argv[++i];
    else if (a === '--dump-paren') out.dumpParenPath = argv[++i];
    else if (a === '--skip-annotate') out.skipAnnotate = true;
    else if (a === '--only-paren-targets') out.onlyParenTargets = true;
    else throw new Error(`알 수 없는 인자/옵션: ${a}`);
  }
  return out;
}

function splitWords(s, sepMode) {
  if (sepMode === 'whitespace') return s.split(/\s+/);
  // 기본: 줄 단위. 마지막 빈 줄 제거를 위해 trim하지 않고 filter(Boolean)에서 제거.
  return s.split(/\r?\n/);
}

function withSuffix(file, suffix) {
  const ext = path.extname(file);
  const base = file.slice(0, ext ? -ext.length : undefined);
  return base + suffix;
}

function defaultUnmatchedPath(listPath) {
  const { dir, name } = path.parse(listPath);
  return path.join(dir || '.', `${name}.unmatched.txt`);
}

/** keyFn 기준 중복 제거(입력 순서 보존) */
function dedupPreserveOrder(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = keyFn(x);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
}

/** categories 라벨 중복 없이 추가(문자열/배열 모두 지원). 변경 시 true 반환 */
function addCategory(item, label) {
  const cat = item?.categories;
  if (Array.isArray(cat)) {
    if (!cat.includes(label)) {
      item.categories = [...cat, label];
      return true;
    }
    return false;
  }
  const toList = (str) =>
    String(str || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  const fromList = (arr) => (arr.length ? arr.join(', ') : '');

  const list = toList(cat);
  if (!list.includes(label)) {
    list.push(label);
    item.categories = fromList(list);
    return true;
  }
  return false;
}
