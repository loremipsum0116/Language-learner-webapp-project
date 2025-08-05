// server/create_vocab/seed_a1_from_json.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
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
            const currentPos = (r.pos || 'unknown').trim();

            // 1. Vocab 항목을 먼저 확인하거나 생성합니다.
            const vocab = await prisma.vocab.upsert({
                where: { lemma: titleLemma },
                update: {
                    // 이미 다른 품사가 있다면 쉼표로 구분하여 추가합니다.
                    pos: {
                        set: await (async () => {
                            const existing = await prisma.vocab.findUnique({ where: { lemma: titleLemma } });
                            if (!existing?.pos || existing.pos === 'UNK') return currentPos;
                            const posSet = new Set(existing.pos.split(',').map(p => p.trim()));
                            posSet.add(currentPos);
                            return Array.from(posSet).join(', ');
                        })(),
                    },
                    levelCEFR: r.levelCEFR || 'A1',
                },
                create: {
                    lemma: titleLemma,
                    pos: currentPos,
                    levelCEFR: r.levelCEFR || 'A1',
                    source: 'seed-ielts-api'
                }
            });

            // 2. DictEntry를 지능적으로 업데이트하거나 생성합니다.
            const existingEntry = await prisma.dictEntry.findUnique({
                where: { vocabId: vocab.id },
            });

            const newMeaningBlock = {
                pos: currentPos,
                definitions: [{
                    def: r.definition,
                    ko_def: r.koGloss,
                    examples: (r.example && r.koExample) ? [{ de: r.example, ko: r.koExample }] : []
                }]
            };

            if (existingEntry) {
                // 기존 항목이 있으면, examples JSON 배열을 업데이트합니다.
                let existingExamples = Array.isArray(existingEntry.examples) ? existingEntry.examples : [];
                const posIndex = existingExamples.findIndex(e => e.pos === currentPos);

                if (posIndex > -1) {
                    // 같은 품사가 이미 있으면, 정의(definition)만 추가 (중복 방지)
                    const defExists = existingExamples[posIndex].definitions.some(d => d.def === r.definition);
                    if (!defExists) {
                        existingExamples[posIndex].definitions.push(newMeaningBlock.definitions[0]);
                    }
                } else {
                    // 새로운 품사 정보이면 배열에 추가
                    existingExamples.push(newMeaningBlock);
                }

                await prisma.dictEntry.update({
                    where: { vocabId: vocab.id },
                    data: {
                        examples: existingExamples,
                        audioUrl: r.audioUrl || existingEntry.audioUrl,
                    }
                });

            } else {
                // 기존 항목이 없으면 새로 생성합니다.
                await prisma.dictEntry.create({
                    data: {
                        vocabId: vocab.id,
                        examples: [newMeaningBlock],
                        audioUrl: r.audioUrl,
                        license: 'Proprietary',
                        attribution: 'ielts-api-v2'
                    }
                });
            }

            upserted++;
        }

        console.log(`Successfully processed ${upserted} entries from ${path.basename(file)}.`);
    } catch (e) {
        console.error('Error during seeding:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
})();
