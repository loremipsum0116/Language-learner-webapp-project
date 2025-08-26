import fs from "fs";

const inFile = "수능필수.txt";
const outFile = "수능필수_dedup.txt";
const caseInsensitive = true; // false로 바꾸면 대/소문자 구분

const seen = new Set();
const out = [];

for (const line of fs.readFileSync(inFile, "utf8").split(/\r?\n/)) {
  const s = line.trim();
  if (!s) continue;
  const key = caseInsensitive ? s.toLowerCase() : s;
  if (!seen.has(key)) {
    seen.add(key);
    out.push(s);
  }
}

fs.writeFileSync(outFile, out.join("\n"), "utf8");
console.log(`[OK] ${inFile} → ${outFile}, lines: ${out.length}`);
