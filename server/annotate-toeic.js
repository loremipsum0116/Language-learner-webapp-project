#!/usr/bin/env node
/**
 * annotate-toeic.js
 * - 입력: cefr_vocabs.json (배열, 각 항목은 { lemma, categories, ... })
 *        TOEIC.txt (단어 목록; 줄/공백 구분 모두 허용)
 * - 출력: (1) 원본을 복사한 새 JSON (기본: cefr_vocabs.TOEIC.json)
 *         (2) JSON에 존재하지 않은 TOEIC 단어 목록 txt (기본: TOEIC.unmatched.txt)
 *
 * 기본 동작:
 *  - lemma와 TOEIC 단어가 일치하면 해당 항목의 categories에 'TOEIC' 라벨 추가(중복 방지).
 *  - 원본 파일은 덮어쓰지 않음.
 *
 * 옵션:
 *  - -i, --insensitive : 대소문자 무시 매칭
 *  - --match exact|base : exact=정확히, base=괄호( ) 내부 제거 후 기반 매칭
 *  - --category <name> : 추가 라벨명(기본 'TOEIC')
 *  - -o, --out <file>  : 출력 JSON 경로
 *  - --unmatched <file>: 불일치 단어 txt 경로
 *  - --keep-dups       : 불일치 목록 중복 유지(기본은 중복 제거)
 *
 * Node 18+ 권장. 외부 라이브러리 불필요.
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

    // 경로 및 기본값
    const jsonPath = args.jsonPath;
    const listPath = args.listPath;
    const outJsonPath = args.outPath || withSuffix(jsonPath, '.TOEIC.json');
    const unmatchedPath = args.unmatchedPath || defaultUnmatchedPath(listPath);
    const categoryLabel = args.category || 'TOEIC';
    const insensitive = !!args.insensitive;
    const matchMode = args.matchMode || 'exact'; // exact | base
    const keepDups = !!args.keepDups;

    // 파일 읽기
    const rawJson = await fs.readFile(jsonPath, 'utf8');
    const vocab = JSON.parse(rawJson);
    if (!Array.isArray(vocab)) {
      throw new Error('cefr_vocabs.json 형식 오류: 최상위가 배열이어야 합니다.');
    }

    const listRaw = await fs.readFile(listPath, 'utf8');
    let toeicWords = splitWords(listRaw); // 줄/공백 혼합 허용
    // 전처리: 앞뒤 공백 제거, 빈 값 제거
    toeicWords = toeicWords.map(w => w.trim()).filter(Boolean);

    // 매칭 키 구성
    const { keyFn, baseFn } = makeNormalizers({ insensitive });
    const lemmaKey = (s) => {
      if (matchMode === 'base') return keyFn(baseFn(s));
      return keyFn(s);
    };

    // JSON 쪽 인덱스 맵 (동일 키가 여러 항목에 매핑될 수 있으므로 배열 보관)
    const indexMap = new Map();
    vocab.forEach((item, idx) => {
      const lemma = item?.lemma;
      if (typeof lemma !== 'string') return;
      const k = lemmaKey(lemma);
      if (!indexMap.has(k)) indexMap.set(k, []);
      indexMap.get(k).push(idx);
    });

    // 처리 루프
    const matchedWords = [];
    const unmatchedWords = [];

    // 성능: 한 번만 lower/normalize 하도록
    for (const w of toeicWords) {
      const k = lemmaKey(w);
      const hitIdxs = indexMap.get(k);
      if (hitIdxs && hitIdxs.length > 0) {
        matchedWords.push(w);
      } else {
        unmatchedWords.push(w);
      }
    }

    // 출력용 사본 만들며 카테고리 주입
    const out = vocab.map(obj => ({ ...obj })); // 얕은 복사로 원본 보호
    let entriesAnnotated = 0;

    // 중복을 피하려고, 같은 키를 여러 번 주입하지 않도록 관리
    const doneForIndex = new Set();

    for (const w of toeicWords) {
      const k = lemmaKey(w);
      const hitIdxs = indexMap.get(k);
      if (!hitIdxs) continue;
      for (const idx of hitIdxs) {
        const uniqueKey = `${k}#${idx}`;
        if (doneForIndex.has(uniqueKey)) continue;
        const item = out[idx];
        const updated = addCategory(item, categoryLabel);
        if (updated) entriesAnnotated++;
        doneForIndex.add(uniqueKey);
      }
    }

    // JSON 저장
    await fs.writeFile(outJsonPath, JSON.stringify(out, null, 2) + '\n', 'utf8');

    // 불일치 목록 저장 (기본: 중복 제거 + 입력 순서 유지)
    let unmatchedToWrite = unmatchedWords;
    if (!keepDups) unmatchedToWrite = dedupPreserveOrder(unmatchedWords, { insensitive });
    await fs.writeFile(unmatchedPath, unmatchedToWrite.join('\n') + '\n', 'utf8');

    // 리포트
    const total = toeicWords.length;
    const matched = matchedWords.length;
    const unmatched = unmatchedWords.length;

    console.log('[OK] 주석(카테고리) 주입 완료');
    console.log(` - 입력 JSON: ${jsonPath}`);
    console.log(` - 입력 리스트: ${listPath}`);
    console.log(` - 출력 JSON: ${outJsonPath}`);
    console.log(` - 불일치 목록: ${unmatchedPath}`);
    console.log(` - 리스트 총 개수: ${total}`);
    console.log(` - 매칭 단어 수: ${matched}`);
    console.log(` - 불일치 단어 수: ${unmatched}`);
    console.log(` - 주입된 JSON 항목 수(중복 제외): ${entriesAnnotated}`);
    console.log(` - 옵션: case=${insensitive ? 'insensitive' : 'sensitive'}, match=${matchMode}, category='${categoryLabel}', keepDups=${keepDups}`);
  } catch (err) {
    console.error('[ERROR]', err?.message || err);
    process.exit(1);
  }
})();

// ---- helpers ----

function usage() {
  console.log(`사용: node annotate-toeic.js cefr_vocabs.json TOEIC.txt [-i] [--match exact|base] [--category TOEIC] [-o 출력.json] [--unmatched 불일치.txt] [--keep-dups]`);
}

function parseArgs(argv) {
  const out = {
    jsonPath: argv[0],
    listPath: argv[1],
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-o' || a === '--out') out.outPath = argv[++i];
    else if (a === '--unmatched') out.unmatchedPath = argv[++i];
    else if (a === '-i' || a === '--insensitive') out.insensitive = true;
    else if (a === '--match') {
      const v = (argv[++i] || '').toLowerCase();
      if (v !== 'exact' && v !== 'base') throw new Error('--match 값은 exact | base');
      out.matchMode = v;
    } else if (a === '--category') {
      out.category = argv[++i];
    } else if (a === '--keep-dups') {
      out.keepDups = true;
    } else {
      if (!out.jsonPath) out.jsonPath = a;
      else if (!out.listPath) out.listPath = a;
      else throw new Error(`알 수 없는 인자/옵션: ${a}`);
    }
  }
  return out;
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

function splitWords(s) {
  // 줄/공백 혼합 지원
  // (한 줄에 여러 단어가 있는 파일도 처리)
  return s.replace(/^\uFEFF/, '').split(/\s+/);
}

function makeNormalizers({ insensitive }) {
  const lower = (x) => (insensitive ? x.toLowerCase() : x);
  const keyFn = (s) => lower(String(s).trim().replace(/\s+/g, ' '));
  // base: 괄호 내용 제거 → 다중 괄호도 제거
  const baseFn = (s) => String(s).replace(/\s*\([^)]*\)\s*/g, ' ').trim().replace(/\s+/g, ' ');
  return { keyFn, baseFn };
}

/** categories에 라벨 추가 (문자열/배열 모두 지원, 중복 방지). 변경되면 true */
/** categories에 라벨 추가 (문자열/배열 모두 지원, 중복 방지; 'TOEIC' 존재 시 무시, 대소문자 불문). 변경되면 true */
function addCategory(item, label) {
  const norm = (s) => String(s).trim().toLowerCase();
  const target = norm(label);
  const cat = item.categories;

  if (Array.isArray(cat)) {
    const has = cat.some(x => norm(x) === target);
    if (has) return false;              // 이미 존재 → 무시
    item.categories = [...cat, label];  // 없으면 추가
    return true;
  }

  const toList = (str) =>
    String(str || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

  const fromList = (arr) => (arr.length ? arr.join(', ') : '');

  const list = toList(cat);
  const has = list.some(x => norm(x) === target);
  if (has) return false;                // 이미 존재 → 무시
  list.push(label);                     // 없으면 추가
  item.categories = fromList(list);
  return true;
}


function dedupPreserveOrder(arr, { insensitive }) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = insensitive ? String(x).toLowerCase() : String(x);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
}
