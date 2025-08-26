#!/usr/bin/env node
/**
 * annotate-toefl.js
 * - 원본: cefr_vocabs.json (배열; 각 원소 { lemma, categories, ... })
 * - 리스트: TOEFL.txt (단어 목록; 줄/공백 혼합 허용)
 * - 동작:
 *   1) TOEFL.txt 분리/트림 → 중복 제거(입력 순서 보존)
 *   2) lemma와 매칭되는 항목의 categories에 'TOEFL'(기본) 라벨 추가(중복 방지)
 *   3) 전체 항목을 복사한 새 JSON 저장(원본 미변경)
 *   4) JSON에 존재하지 않은 단어를 unmatched TXT로 저장
 *
 * 옵션:
 *   -o, --out <file>        : 출력 JSON 경로 (기본: cefr_vocabs.TOEFL.json)
 *   --unmatched <file>      : 불일치 목록 TXT 경로 (기본: TOEFL.unmatched.txt)
 *   -i, --insensitive       : 대소문자 무시 매칭
 *   --match exact|base      : exact=정확 일치(기본), base=괄호 내용 제거 후 매칭
 *   --category <label>      : 추가 라벨명 (기본: 'TOEFL')
 *
 * Node 18+ 권장, 외부 의존성 없음.
 */

const fs = require('fs/promises');
const path = require('path');

(async () => {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (!args.jsonPath || !args.listPath) {
      usage();
      process.exit(1);
    }

    const jsonPath = args.jsonPath;
    const listPath = args.listPath;
    const outJsonPath = args.outPath || withSuffix(jsonPath, '.TOEFL.json');
    const unmatchedPath = args.unmatchedPath || defaultUnmatchedPath(listPath);
    const insensitive = !!args.insensitive;
    const matchMode = args.matchMode || 'exact'; // 'exact' | 'base'
    const categoryLabel = args.category || 'TOEFL';

    // 파일 읽기 (BOM 제거)
    const rawJson = (await fs.readFile(jsonPath, 'utf8')).replace(/^\uFEFF/, '');
    const vocab = JSON.parse(rawJson);
    if (!Array.isArray(vocab)) throw new Error('cefr_vocabs.json 최상위는 배열이어야 합니다.');

    const rawList = (await fs.readFile(listPath, 'utf8')).replace(/^\uFEFF/, '');
    const wordsRaw = splitWords(rawList).map(s => s.trim()).filter(Boolean);

    // 정규화
    const lower = (x) => (insensitive ? x.toLowerCase() : x);
    const norm = (s) => lower(String(s).trim().replace(/\s+/g, ' '));
    const base = (s) => String(s).replace(/\s*\([^)]*\)\s*/g, ' ').trim().replace(/\s+/g, ' ');
    const keyFn = (s) => matchMode === 'base' ? norm(base(s)) : norm(s);

    // 1) TOEFL.txt 중복 제거(순서 보존)
    const dedupedWords = dedupPreserveOrder(wordsRaw, keyFn);

    // 2) JSON 인덱스 구축
    const index = new Map();
    vocab.forEach((item, i) => {
      const lem = item?.lemma;
      if (typeof lem !== 'string') return;
      const k = keyFn(lem);
      if (!index.has(k)) index.set(k, []);
      index.get(k).push(i);
    });

    // 3) 매칭/불일치 분류
    const matched = [];
    const unmatched = [];
    for (const w of dedupedWords) {
      const k = keyFn(w);
      if (index.has(k)) matched.push(w);
      else unmatched.push(w);
    }

    // 4) 출력용 사본 생성 + 카테고리 주입
    const out = vocab.map(x => ({ ...x })); // 원본 보호
    let annotatedEntries = 0;
    const stamped = new Set();

    for (const w of matched) {
      const k = keyFn(w);
      const idxs = index.get(k) || [];
      for (const idx of idxs) {
        const stamp = `${k}#${idx}`;
        if (stamped.has(stamp)) continue;
        if (addCategory(out[idx], categoryLabel)) annotatedEntries++;
        stamped.add(stamp);
      }
    }

    // 5) 파일 저장
    await fs.writeFile(outJsonPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
    await fs.writeFile(unmatchedPath, unmatched.join('\n') + '\n', 'utf8');

    // 리포트
    console.log('[OK] TOEFL 태깅 완료');
    console.log(` - 입력 JSON: ${jsonPath}`);
    console.log(` - 입력 리스트: ${listPath}`);
    console.log(` - 출력 JSON: ${outJsonPath}`);
    console.log(` - 불일치 목록: ${unmatchedPath}`);
    console.log(` - 원시 단어 수: ${wordsRaw.length}`);
    console.log(` - 중복 제거 후 단어 수: ${dedupedWords.length}`);
    console.log(` - 매칭 단어 수: ${matched.length}`);
    console.log(` - 불일치 단어 수: ${unmatched.length}`);
    console.log(` - 카테고리 주입된 JSON 항목 수(중복 제외): ${annotatedEntries}`);
    console.log(` - 옵션: case=${insensitive ? 'insensitive' : 'sensitive'}, match=${matchMode}, category='${categoryLabel}'`);
  } catch (err) {
    console.error('[ERROR]', err?.message || err);
    process.exit(1);
  }
})();

// ---- helpers ----

function usage() {
  console.log('사용: node annotate-toefl.js cefr_vocabs.json TOEFL.txt [-o 출력.json] [--unmatched 불일치.txt] [-i] [--match exact|base] [--category TOEFL]');
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
    } else if (a === '--category') out.category = argv[++i];
    else throw new Error(`알 수 없는 인자/옵션: ${a}`);
  }
  return out;
}

function splitWords(s) {
  // 줄/공백 혼합 분리
  return s.split(/\s+/);
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

/** categories에 라벨을 중복 없이 추가(문자열/배열 모두 지원). 변경 시 true 반환 */
function addCategory(item, label) {
  const cat = item.categories;

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
