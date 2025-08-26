#!/usr/bin/env node
/**
 * dedup-words.js
 * TXT에서 중복 영단어 제거.
 * - 기본: 줄(line) 단위 분리, 첫 등장 유지, 대소문자 구분, 입력 순서 보존
 * - Node 18+ 권장
 *
 * 사용:
 *   node dedup-words.js input.txt [-o output.txt] [-i] [--keep first|last] [--sep line|whitespace] [--sort asc|desc]
 */

const fs = require('fs/promises');
const path = require('path');

(async () => {
  try {
    const argv = process.argv.slice(2);
    if (argv.length === 0 || argv[0].startsWith('-')) {
      printUsageAndExit();
    }

    const inputPath = argv[0];
    let outputPath = null;
    let insensitive = false;               // 대소문자 무시 여부
    let keep = 'first';                    // 'first' | 'last'
    let sep = 'line';                      // 'line' | 'whitespace'
    let sort = 'none';                     // 'none' | 'asc' | 'desc'

    // 간단한 옵션 파서
    for (let i = 1; i < argv.length; i++) {
      const a = argv[i];
      if (a === '-o' || a === '--out') {
        if (i + 1 >= argv.length) die('출력 파일 경로가 필요합니다: -o <file>');
        outputPath = argv[++i];
      } else if (a === '-i' || a === '--insensitive') {
        insensitive = true;
      } else if (a === '--keep') {
        if (i + 1 >= argv.length) die('--keep 옵션은 first|last 값이 필요합니다');
        const v = argv[++i].toLowerCase();
        if (v !== 'first' && v !== 'last') die('--keep 값은 first 또는 last 여야 합니다');
        keep = v;
      } else if (a === '--sep') {
        if (i + 1 >= argv.length) die('--sep 옵션은 line|whitespace 값이 필요합니다');
        const v = argv[++i].toLowerCase();
        if (v !== 'line' && v !== 'whitespace') die('--sep 값은 line 또는 whitespace 여야 합니다');
        sep = v;
      } else if (a === '--sort') {
        if (i + 1 >= argv.length) die('--sort 옵션은 asc|desc 값이 필요합니다');
        const v = argv[++i].toLowerCase();
        if (v !== 'asc' && v !== 'desc') die('--sort 값은 asc 또는 desc 여야 합니다');
        sort = v;
      } else {
        die(`알 수 없는 옵션: ${a}`);
      }
    }

    // 입력 읽기 (BOM 제거)
    const raw = await fs.readFile(inputPath, 'utf8');
    const content = raw.replace(/^\uFEFF/, '');

    // 분리
    let items = [];
    if (sep === 'whitespace') {
      items = content.split(/\s+/);
    } else {
      items = content.split(/\r?\n/);
      // 만약 한 줄뿐이고 공백으로만 분리된 경우를 자동 보정하고 싶다면 아래 주석 해제:
      // if (items.length === 1) items = content.trim().split(/\s+/);
    }
    // 전처리: 앞뒤 공백 제거, 빈 항목 제거
    items = items.map(w => w.trim()).filter(Boolean);

    // 중복 제거
    const unique = dedup(items, { insensitive, keep });

    // 정렬(선택)
    if (sort !== 'none') {
      unique.sort((a, b) =>
        a.localeCompare(b, 'en', { sensitivity: insensitive ? 'base' : 'variant' })
      );
      if (sort === 'desc') unique.reverse();
    }

    const outStr = unique.join('\n') + '\n';

    if (!outputPath) {
      const ext = path.extname(inputPath);
      const base = inputPath.slice(0, ext ? -ext.length : undefined);
      outputPath = `${base}.dedup.txt`;
    }

    await fs.writeFile(outputPath, outStr, 'utf8');

    const removed = items.length - unique.length;
    console.log(`[OK] 중복 제거 완료`);
    console.log(` - 입력:   ${inputPath}`);
    console.log(` - 출력:   ${outputPath}`);
    console.log(` - 총 개수: ${items.length}`);
    console.log(` - 고유 개수: ${unique.length}`);
    console.log(` - 제거 개수: ${removed}`);
    console.log(` - 옵션: case=${insensitive ? 'insensitive' : 'sensitive'}, keep=${keep}, sep=${sep}, sort=${sort}`);
  } catch (err) {
    console.error(`[ERROR] ${err?.message || err}`);
    process.exit(1);
  }
})();

function dedup(words, { insensitive, keep }) {
  if (keep === 'last') {
    // 뒤에서부터 보며 처음 보는 키만 살리고, 다시 뒤집어서 원래 순서로
    const seen = new Set();
    const outRev = [];
    for (let i = words.length - 1; i >= 0; i--) {
      const w = words[i];
      const key = insensitive ? w.toLowerCase() : w;
      if (!seen.has(key)) {
        seen.add(key);
        outRev.push(w);
      }
    }
    return outRev.reverse();
  } else {
    // 기본: 첫 등장 유지
    const seen = new Set();
    const out = [];
    for (const w of words) {
      const key = insensitive ? w.toLowerCase() : w;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(w);
      }
    }
    return out;
  }
}

function die(msg) {
  console.error(`[ERROR] ${msg}`);
  printUsageAndExit(1);
}

function printUsageAndExit(code = 0) {
  console.log(`사용: node dedup-words.js <입력파일.txt> [-o 출력파일.txt] [-i] [--keep first|last] [--sep line|whitespace] [--sort asc|desc]`);
  process.exit(code);
}
