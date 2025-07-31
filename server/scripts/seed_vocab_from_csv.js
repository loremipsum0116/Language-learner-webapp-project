require('dotenv').config();
const fs = require('fs');

let parse;
try { ({ parse } = require('csv-parse/sync')); }
catch { parse = require('csv-parse/lib/sync'); }

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const file = process.argv[2];
if (!file) {
    console.error('Usage: node scripts/seed_vocab_from_csv.js <csv path>');
    process.exit(1);
}

(async () => {
    const csv = fs.readFileSync(file, 'utf8');

    // 헤더를 읽고, 컬럼수 불일치 허용, 빈줄 스킵
    const rows = parse(csv, {
        bom: true,
        columns: true,                 // 첫 줄을 헤더로 사용
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true
    })
        // 섹션 제목/공란 행 건너뛰기
        .filter(r => {
            const allEmpty = Object.values(r).every(v => (v ?? '').trim() === '');
            if (allEmpty) return false;
            // pos/levelCEFR 등 핵심 필드가 전부 비어 있으면 제목줄로 간주
            const isSection = !r.pos && !r.levelCEFR && !r.examples && !r.ipa && !r.ko;
            return !isSection;
        });

    let upserted = 0;

    for (const r of rows) {
        const lemma = (r.lemma || '').trim();
        if (!lemma) continue;

        const vocab = await prisma.vocab.upsert({
            where: { lemma },
            update: {
                pos: r.pos || '',
                gender: r.gender || null,
                plural: r.plural || null,
                levelCEFR: r.levelCEFR || 'A1',
                source: 'seed-csv'
            },
            create: {
                lemma,
                pos: r.pos || '',
                gender: r.gender || null,
                plural: r.plural || null,
                levelCEFR: r.levelCEFR || 'A1',
                source: 'seed-csv'
            }
        });

        // examples 문자열 → JSON 파싱
        let examples = [];
        if (r.examples) {
            try { examples = JSON.parse(r.examples); }
            catch { /* 무시: 형식 이상이면 빈 배열 */ }
        }
        // ipa_ko → prisma 의 ipaKo
        const ipaKo = (r.ipa_ko ?? '').trim() || null;

        await prisma.dictEntry.upsert({
            where: { vocabId: vocab.id },
            update: { ipa: r.ipa || null, ipaKo, examples },
            create: {
                vocabId: vocab.id,
                ipa: r.ipa || null,
                ipaKo,
                examples,
                license: 'Proprietary',
                attribution: 'Internal Seed'
            }
        });

        upserted++;
    }

    console.log(`Done. upserted=${upserted}`);
    await prisma.$disconnect();
})().catch(async e => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
