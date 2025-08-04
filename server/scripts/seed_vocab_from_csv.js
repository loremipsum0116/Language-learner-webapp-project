// server/tools/seed_vocab_from_csv.js
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

    const rows = parse(csv, {
        bom: true,
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true
    }).filter(r => {
        const allEmpty = Object.values(r).every(v => (v ?? '').trim() === '');
        if (allEmpty) return false;
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
                // ★★★★★ 수정된 부분: gender 필드 관련 코드 삭제 ★★★★★
                plural: r.plural || null,
                levelCEFR: r.levelCEFR || 'A1',
                source: 'seed-csv'
            },
            create: {
                lemma,
                pos: r.pos || '',
                // ★★★★★ 수정된 부분: gender 필드 관련 코드 삭제 ★★★★★
                plural: r.plural || null,
                levelCEFR: r.levelCEFR || 'A1',
                source: 'seed-csv'
            }
        });

        let examples = [];
        if (r.examples) {
            try { examples = JSON.parse(r.examples); }
            catch { /* 무시 */ }
        }
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