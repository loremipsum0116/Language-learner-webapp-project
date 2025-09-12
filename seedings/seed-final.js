// server/seed-final.js
require('dotenv').config({ path: './.env' });
const { PrismaClient } = require('@prisma/client');
const {
    parseWikitext,
    fetchWiktionaryWikitext,
    fetchCommonsFileUrl,
} = require('./integrations/wiktionary'); // 우리가 만든 파서를 가져옵니다.

const prisma = new PrismaClient();

const IELTS_WORDS = [
    "analyze", "approach", "assess", "assume", "benefit", "concept", "context", "create", "data", "define",
    "derive", "distribute", "economy", "environment", "establish", "estimate", "evidence", "factor", "finance", "formula",
    "academic", "achieve", "acquire", "affect", "appropriate", "aspect", "assist", "category", "chapter", "commission",
    "community", "complex", "compute", "conclude", "conduct", "consequent", "construct", "consume", "credit", "culture",
    "abstract", "coherent", "comprehensive", "crucial", "empirical", "ethic", "ideology", "imply", "innovate", "paradigm"
];

const titlecaseFirst = (s = '') => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * 단어 하나를 Wiktionary에서 조회하여 DB에 저장하는 함수
 */
async function enrichAndSave(lemma) {
    try {
        const wikitext = await fetchWiktionaryWikitext(lemma);
        if (!wikitext) {
            console.log(`[Skip] No wikitext for "${lemma}"`);
            return;
        }

        const parsed = parseWikitext(wikitext);
        const { ipa, audioTitles, koreanMeaning, examples } = parsed;

        if (!koreanMeaning) {
            console.log(`[Skip] No Korean meaning for "${lemma}"`);
            return;
        }

        let audioUrl = null;
        if (audioTitles.length > 0) {
            audioUrl = await fetchCommonsFileUrl(audioTitles[0]);
        }

        const vocab = await prisma.vocab.upsert({
            where: { lemma: titlecaseFirst(lemma) },
            update: { levelCEFR: 'B2' },
            create: {
                lemma: titlecaseFirst(lemma),
                pos: 'UNK',
                levelCEFR: 'B2',
                source: 'seed-wiktionary',
            },
        });

        const finalExamples = [
            { ko: koreanMeaning, kind: 'gloss', source: 'ko-wiktionary' },
            ...examples,
        ];

        await prisma.dictEntry.upsert({
            where: { vocabId: vocab.id },
            update: {
                ipa,
                audioUrl,
                examples: finalExamples,
            },
            create: {
                vocabId: vocab.id,
                ipa,
                audioUrl,
                examples: finalExamples,
                attribution: 'Korean Wiktionary',
                license: 'CC-BY-SA',
            },
        });
        console.log(`✅ Seeded: ${lemma} -> ${koreanMeaning}`);

    } catch (error) {
        console.error(`❌ Failed to seed: ${lemma}`, error);
    }
}

/**
 * 메인 실행 함수
 */
async function main() {
    console.log(`🌱 Starting to seed ${IELTS_WORDS.length} words from Wiktionary...`);
    for (const word of IELTS_WORDS) {
        await enrichAndSave(word);
        await new Promise(resolve => setTimeout(resolve, 300)); // API에 부담을 주지 않도록 잠시 대기
    }
    console.log('🌳 Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });