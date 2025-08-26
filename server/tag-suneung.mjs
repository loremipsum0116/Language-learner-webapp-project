#!/usr/bin/env node
// PowerShell 예:
// node .\tag-suneung.mjs --a "cefr_vocabs.json" --b "수능필수.txt" --outA "cefr_vocabs_tagged.json" --outUnmatched "수능필수_unmatched.txt" --mode exact

import fs from "fs";
import fsp from "fs/promises";
import { pipeline } from "node:stream";

// stream-json은 CommonJS → default import 후 구조분해
import ParserPkg from "stream-json/Parser.js";
import StreamArrayPkg from "stream-json/streamers/StreamArray.js";
const { parser } = ParserPkg;
const { streamArray } = StreamArrayPkg;

// ---------------- CLI ----------------
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) {
      const key = cur.slice(2);
      const val = arr[i + 1]?.startsWith?.("--") ? true : arr[i + 1];
      acc.push([key, val]);
    }
    return acc;
  }, [])
);

const A_PATH = args.a ?? "cefr_vocabs.json";
const B_PATH = args.b ?? "수능필수.txt";
const OUT_A_PATH = args.outA ?? "cefr_vocabs_tagged.json";
const OUT_UNMATCHED_B = args.outUnmatched ?? "수능필수_unmatched.txt";
const MODE = (args.mode ?? "exact").toLowerCase(); // exact | morph

// ---------------- 정규화/키 ----------------
function normalize(s = "") {
  return s
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, "-");
}
const parenRe = /\([^)]*\)/g;
const tokenRe = /[a-z]+(?:[-'][a-z]+)*/;

function lemmaKey(s = "") {
  s = normalize(s).replace(parenRe, "").trim();
  const m = s.match(tokenRe);
  return m ? m[0] : "";
}

// CEFR 표시 형식: "A1, 수능" / 비어있으면 "수능"만
function appendSuneung(level) {
  const levelStr =
    typeof level === "string" ? level :
    level == null ? "" : String(level);
  if (!levelStr) return "수능";
  if (levelStr.includes("수능")) return levelStr;
  return `${levelStr}, 수능`;
}

// 간단 변형(형태/철자/기호) 생성: 과매칭 최소화(모드: morph)
function keyVariants(base) {
  const v = new Set();
  if (!base) return v;
  v.add(base);

  // 기호 변형
  v.add(base.replace(/-/g, ""));  // well-being → wellbeing
  v.add(base.replace(/'/g, ""));  // it's → its

  // 복수/3인칭
  if (base.endsWith("ies") && base.length > 3) v.add(base.slice(0, -3) + "y");
  if (base.endsWith("es") && base.length > 3) v.add(base.slice(0, -2));
  if (base.endsWith("s") && !base.endsWith("ss") && base.length > 3) v.add(base.slice(0, -1));

  // -ing / -ed
  if (base.endsWith("ing") && base.length > 4) {
    const stem = base.slice(0, -3);
    v.add(stem);
    v.add(stem + "e");
  }
  if (base.endsWith("ed") && base.length > 3) {
    const stem = base.slice(0, -2);
    v.add(stem);
    v.add(stem + "e");
  }

  // 영/미 철자 맵(필요 시 확장)
  const mapList = [
    ["colour", "color"], ["favour", "favor"], ["honour", "honor"],
    ["behaviour", "behavior"], ["labour", "labor"], ["rumour", "rumor"],
    ["centre", "center"], ["theatre", "theater"]
  ];
  for (const [gb, us] of mapList) {
    if (base === gb) v.add(us);
    if (base === us) v.add(gb);
  }

  return v;
}

// ---------------- B 로드 ----------------
function loadBLinesKeys(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split(/\r?\n/);
  const keys = lines.map(lemmaKey);
  return { lines, keys };
}

// ---------------- A 1패스: 키 수집 ----------------
async function collectAKeys(APath) {
  const setA = new Set();
  await new Promise((resolve, reject) => {
    const rs = fs.createReadStream(APath);
    const p = parser();
    const s = streamArray();
    rs.pipe(p).pipe(s);

    s.on("data", ({ value }) => {
      if (value && typeof value === "object") {
        const k = lemmaKey(value.lemma || "");
        if (k) setA.add(k);
      }
    });
    s.on("end", resolve);
    for (const st of [rs, p, s]) st.on("error", reject);
  });
  return setA;
}

// ---------------- A 2패스: 태깅/쓰기(Pretty Print) ----------------
async function tagAStream({ APath, acceptKeys, outAPath }) {
  const out = fs.createWriteStream(outAPath, { encoding: "utf-8" });

  // 배열 시작을 개행과 함께 열어 pretty print 구조를 유지
  out.write("[\n");

  let first = true;
  let taggedCount = 0;
  let matchedItemCount = 0;

  await new Promise((resolve, reject) => {
    const rs = fs.createReadStream(APath);
    const p = parser();
    const s = streamArray();
    rs.pipe(p).pipe(s);

    s.on("data", ({ value }) => {
      let item = value;
      if (item && typeof item === "object") {
        const k = lemmaKey(item.lemma || "");
        if (k && acceptKeys.has(k)) {
          matchedItemCount++;
          if (!String(item.levelCEFR ?? "").includes("수능")) {
            item = { ...item, levelCEFR: appendSuneung(item.levelCEFR) };
            taggedCount++;
          }
        }
      }

      // 각 객체를 2칸 들여쓰기하여 여러 줄로 출력
      const pretty = JSON.stringify(item, null, 2).replace(/^/gm, "  ");

      if (!first) out.write(",\n"); // 이전 요소와 구분하는 콤마+개행
      first = false;
      out.write(pretty);
    });

    s.on("end", () => {
      out.write("\n]\n"); // 배열 종료
      out.end();
    });

    for (const st of [rs, p, s, out]) st.on("error", reject);
    out.on("finish", resolve);
  });

  return { taggedCount, matchedItemCount };
}

(async () => {
  if (!fs.existsSync(A_PATH)) { console.error(`[에러] A 파일 없음: ${A_PATH}`); process.exit(1); }
  if (!fs.existsSync(B_PATH)) { console.error(`[에러] B 파일 없음: ${B_PATH}`); process.exit(1); }

  // 1) A 키 수집
  console.time("[1패스:A키 수집]");
  const setA = await collectAKeys(A_PATH);
  console.timeEnd("[1패스:A키 수집]");

  // 2) B 로드
  const { lines: B_LINES, keys: B_KEYS } = loadBLinesKeys(B_PATH);

  // 3) 허용 키 계산(모드별)
  const acceptKeys = new Set();
  const unmatchedLines = [];
  for (let i = 0; i < B_LINES.length; i++) {
    const raw = B_LINES[i];
    const bk = B_KEYS[i];
    if (!raw || !raw.trim() || !bk) { unmatchedLines.push(raw); continue; }

    const candidates = MODE === "morph" ? keyVariants(bk) : new Set([bk]);
    let hit = false;
    for (const c of candidates) {
      if (setA.has(c)) {
        acceptKeys.add(c);
        hit = true;
      }
    }
    if (!hit) unmatchedLines.push(raw);
  }

  // 4) 2패스: 태깅/쓰기(Pretty Print)
  console.time("[2패스:태깅/쓰기]");
  const { taggedCount, matchedItemCount } =
    await tagAStream({ APath: A_PATH, acceptKeys, outAPath: OUT_A_PATH });
  console.timeEnd("[2패스:태깅/쓰기]");

  // 5) 미매칭 B 저장(중복·원본 순서 유지)
  await fsp.writeFile(OUT_UNMATCHED_B, unmatchedLines.join("\n"), "utf-8");

  // 6) 리포트
  console.log("=== Summary ===");
  console.log(`모드: ${MODE}`);
  console.log(`A 고유 키 수: ${setA.size}`);
  console.log(`B 총 라인: ${B_LINES.length}`);
  console.log(`B 고유 키 수: ${new Set(B_KEYS.filter(Boolean)).size}`);
  console.log(`A에서 '수능' 추가된 항목 수: ${taggedCount}`);
  console.log(`A에서 매칭된 항목 수(중복 포함): ${matchedItemCount}`);
  console.log(`미매칭 B 라인 수: ${unmatchedLines.length}`);
  console.log(`출력 A: ${OUT_A_PATH}`);
  console.log(`미매칭 B: ${OUT_UNMATCHED_B}`);
})().catch(err => {
  console.error("[실패]", err);
  process.exit(1);
});
