// server/scripts/import_ipa_ko.js
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('csv-parse/sync');
const { prisma } = require('../db/prisma');

function titlecaseFirst(s = '') {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
function normIPA(s = '') {
  // CSV의 [ ... ] 대괄호 제거
  return String(s || '').trim().replace(/^\[|\]$/g, '');
}
function cleanHeader(h = '') {
  return String(h)
    .replace(/\uFEFF/g, '') // BOM 제거
    .trim();
}

async function run(csvPath) {
  if (!csvPath) {
    console.error('Usage: node server/scripts/import_ipa_ko.js <csv-file>');
    process.exit(1);
  }
  const abs = path.resolve(csvPath);
  if (!fs.existsSync(abs)) {
    console.error('CSV not found:', abs);
    process.exit(1);
  }

  const csv = fs.readFileSync(abs, 'utf8');
  const rows = parse(csv, {
    bom: true,                 // ★ BOM 처리
    columns: (hdr) => hdr.map(cleanHeader), // ★ 헤더 정규화
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true,
  });

  let total = 0, updated = 0, created = 0, skipped = 0;

  for (const row of rows) {
    // 안전하게 컬럼 꺼내기
    const lemmaRaw = String(row.lemma || row['﻿lemma'] || '').trim();
    const ipaRaw   = String(row.ipa   || '').trim();
    const ipaKoRaw = String(row.ipa_ko || row['ipaKo'] || row['IPA_KO'] || '').trim();

    // 섹션 헤더(예: "Nomen (명사)") 건너뛰기
    if (!lemmaRaw || /\((명사|동사|의문사)\)/i.test(lemmaRaw)) {
      continue;
    }

    total++;

    const ipa = normIPA(ipaRaw);
    const ipaKo = ipaKoRaw || null;

    try {
      // lemma 대/소문자 보정
      const cand = await prisma.vocab.findFirst({
        where: { lemma: { in: [lemmaRaw, titlecaseFirst(lemmaRaw)] } },
        select: { id: true, lemma: true }
      });

      if (!cand) {
        console.warn(`[skip] vocab not found: "${lemmaRaw}"`);
        skipped++;
        continue;
      }

      let entry = await prisma.dictEntry.findUnique({ where: { vocabId: cand.id } });

      if (!entry) {
        entry = await prisma.dictEntry.create({
          data: {
            vocabId: cand.id,
            ipa: ipa || null,
            ipaKo: ipaKo, // ★ 주입
            license: 'Proprietary',
            attribution: 'Internal Seed',
            examples: [],  // 필요시 유지
          },
        });
        created++;
        console.log(`[create] ${cand.lemma}  ipa="${ipa}"  ipaKo="${ipaKo}"`);
      } else {
        const data = {};
        if (ipa && !entry.ipa) data.ipa = ipa;
        if (ipaKo) data.ipaKo = ipaKo;
        if (Object.keys(data).length > 0) {
          await prisma.dictEntry.update({ where: { vocabId: cand.id }, data });
          updated++;
          console.log(`[update] ${cand.lemma} ${data.ipa ? `ipa="${data.ipa}" ` : ''}${data.ipaKo ? `ipaKo="${data.ipaKo}"` : ''}`);
        } else {
          skipped++;
        }
      }
    } catch (e) {
      console.error(`[error] ${lemmaRaw}:`, e.message);
    }
  }

  console.log(`\nDone. total=${total}, created=${created}, updated=${updated}, skipped=${skipped}`);
}

run(process.argv[2]).then(() => prisma.$disconnect());
