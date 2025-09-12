// server/create_vocab/seed_a2_from_json.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const relativePath = process.argv[2];
if (!relativePath) {
    console.error('Usage: node server/create_vocab/seed_a2_from_json.js <path_to_json_file>');
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

            const vocab = await prisma.vocab.upsert({
                where: { 
                    lemma_pos: {
                        lemma: titleLemma,
                        pos: currentPos
                    }
                },
                update: {
                    levelCEFR: r.levelCEFR || 'A2',
                },
                create: {
                    lemma: titleLemma,
                    pos: currentPos,
                    levelCEFR: r.levelCEFR || 'A2',
                    source: 'seed-ielts-api'
                }
            });

            const existingEntry = await prisma.dictentry.findUnique({
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
                let existingExamples = Array.isArray(existingEntry.examples) ? existingEntry.examples : [];
                const posIndex = existingExamples.findIndex(e => e.pos === currentPos);

                if (posIndex > -1) {
                    const defExists = existingExamples[posIndex].definitions.some(d => d.def === r.definition);
                    if (!defExists) {
                        existingExamples[posIndex].definitions.push(newMeaningBlock.definitions[0]);
                    }
                } else {
                    existingExamples.push(newMeaningBlock);
                }

                await prisma.dictentry.update({
                    where: { vocabId: vocab.id },
                    data: {
                        examples: existingExamples,
                        audioUrl: r.audioUrl || existingEntry.audioUrl,
                        ipa: r.pronunciation || existingEntry.ipa,
                        ipaKo: r.pronunciation || existingEntry.ipaKo,
                    }
                });

            } else {
                await prisma.dictentry.create({
                    data: {
                        vocabId: vocab.id,
                        examples: [newMeaningBlock],
                        audioUrl: r.audioUrl,
                        ipa: r.pronunciation,
                        ipaKo: r.pronunciation,
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