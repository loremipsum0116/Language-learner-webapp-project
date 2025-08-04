// server/create_vocab/seed_ielts_json2.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const file = path.join(__dirname, '..', 'A1', 'ielts_a1_2.json');

const toTitleCase = (s = '') => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s);

// ★ 하드코딩된 gloss/예문 ★
const koreanData = {
    "house": { gloss: "집", examples: [ { ko: "우리는 새집으로 이사했다." } ] },
    "car": { gloss: "자동차", examples: [ { ko: "그는 새 차를 샀다." } ] },
    "city": { gloss: "도시", examples: [ { ko: "나는 작은 도시에서 산다." } ] },
    "street": { gloss: "거리", examples: [ { ko: "아이들이 거리에서 놀고 있다." } ] },
    "job": { gloss: "직업", examples: [ { ko: "그는 좋은 직장을 구했다." } ] },
    "work": { gloss: "일하다", examples: [ { ko: "나는 아침 9시부터 오후 5시까지 일한다." } ] },
    "eat": { gloss: "먹다", examples: [ { ko: "나는 매일 아침을 먹는다." } ] },
    "drink": { gloss: "마시다", examples: [ { ko: "목이 마르다. 물을 좀 마셔야겠다." } ] },
    "read": { gloss: "읽다", examples: [ { ko: "나는 책 읽는 것을 좋아한다." } ] },
    "write": { gloss: "쓰다", examples: [ { ko: "그는 편지를 쓰고 있다." } ] },
    "speak": { gloss: "말하다", examples: [ { ko: "그녀는 세 가지 언어를 말할 수 있다." } ] },
    "sleep": { gloss: "자다", examples: [ { ko: "나는 밤에 일찍 잔다." } ] },
    "listen": { gloss: "듣다", examples: [ { ko: "그는 라디오를 듣고 있다." } ] }
};

(async () => {
    try {
        const jsonData = fs.readFileSync(file, 'utf8');
        const vocabList = JSON.parse(jsonData);

        let upserted = 0;

        for (const r of vocabList) {
            const lemmaKey = (r.lemma || '').trim().toLowerCase();
            if (!lemmaKey) continue;

            const titleLemma = toTitleCase(lemmaKey);

            const existingVocab = await prisma.vocab.findUnique({
                where: { lemma: titleLemma },
                include: { dictMeta: true }
            });

            const existingExamples = existingVocab?.dictMeta?.examples || [];
            const hardcoded = koreanData[lemmaKey];

            const newExamples = [];
            if (hardcoded?.gloss) {
                newExamples.push({
                    ko: hardcoded.gloss,
                    de: r.definition,
                    kind: 'gloss',
                    source: 'seed-ielts-api'
                });
            }
            if (hardcoded?.examples) {
                for (const ex of hardcoded.examples) {
                    newExamples.push({
                        ko: ex.ko,
                        de: r.example,
                        audioUrl: r.audioUrl,
                        source: 'seed-ielts-api'
                    });
                }
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

        console.log(`Done. upserted=${upserted}`);
    } catch (e) {
        console.error('Error during seeding:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
})();
