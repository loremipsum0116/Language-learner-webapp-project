// server/create_vocab/seed_a1_from_json.js
require('dotenv').config();
const fs = require('fs'); // ★ 수정: require() 사용
const path = require('path'); // ★ 수정: require() 사용
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const relativePath = process.argv[2];
if (!relativePath) {
    console.error('Usage: node server/create_vocab/seed_a1_from_json.js <path_to_json_file>');
    process.exit(1);
}
const file = path.resolve(__dirname, '..', relativePath);
if (!fs.existsSync(file)) {
    console.error('File not found:', file);
    process.exit(1);
}

const toTitleCase = (s = '') => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s);

(async () => {
    try {
        const jsonData = fs.readFileSync(file, 'utf8');
        const vocabList = JSON.parse(jsonData);

        let upserted = 0;

        for (const r of vocabList) {
            const lemma = (r.lemma || '').trim();
            if (!lemma) continue;

            const titleLemma = toTitleCase(lemma);

            const existingVocab = await prisma.vocab.findUnique({
                where: { lemma: titleLemma },
                include: { dictMeta: true }
            });

            const existingExamples = existingVocab?.dictMeta?.examples || [];
            const newExamples = [];

            if (r.koGloss) {
                newExamples.push({
                    ko: r.koGloss,
                    de: r.definition,
                    kind: 'gloss',
                    source: 'seed-ielts-api'
                });
            }
            if (r.koExample) {
                newExamples.push({
                    ko: r.koExample,
                    de: r.example,
                    audioUrl: r.audioUrl,
                    source: 'seed-ielts-api'
                });
            }

            const finalExamples = [...existingExamples, ...newExamples];
            const finalAudioUrl = r.audioUrl || existingVocab?.dictMeta?.audioUrl || null;

            const vocab = await prisma.vocab.upsert({
                where: { lemma: titleLemma },
                update: {
                    pos: r.pos || 'UNK',
                    levelCEFR: r.levelCEFR || 'A1',
                    source: 'seed-ielts-api'
                },
                create: {
                    lemma: titleLemma,
                    pos: r.pos || 'UNK',
                    levelCEFR: r.levelCEFR || 'A1',
                    source: 'seed-ielts-api'
                }
            });

            await prisma.dictEntry.upsert({
                where: { vocabId: vocab.id },
                update: {
                    audioUrl: finalAudioUrl,
                    examples: finalExamples
                },
                create: {
                    vocabId: vocab.id,
                    ipa: null,
                    ipaKo: null,
                    audioUrl: finalAudioUrl,
                    examples: finalExamples,
                    license: 'Proprietary',
                    attribution: 'ielts-api'
                }
            });

            upserted++;
        }

        console.log(`Successfully seeded ${upserted} words from ${path.basename(file)}.`);
    } catch (e) {
        console.error('Error during seeding:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
})();