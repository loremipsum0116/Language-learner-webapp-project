// server/prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // 기본 단어
    const vocabData = [
        {
            lemma: 'stehen', pos: 'V', gender: null, plural: null, levelCEFR: 'A2', freq: 5000,
            dictMeta: {
                create: {
                    ipa: 'ˈʃteːən',
                    audioUrl: null,
                    audioLocal: null,
                    license: 'CC BY-SA',
                    attribution: 'Wiktionary',
                    examples: [
                        { de: 'Ich stehe früh auf.', ko: '나는 일찍 일어난다.', cefr: 'A2', source: 'wiktionary' }
                    ]
                }
            }
        },
        {
            lemma: 'Haus', pos: 'N', gender: 'das', plural: 'Häuser', levelCEFR: 'A1', freq: 2000,
            dictMeta: {
                create: {
                    ipa: 'haʊ̯s',
                    audioUrl: null,
                    audioLocal: null,
                    license: 'CC BY-SA',
                    attribution: 'Wiktionary',
                    examples: [
                        { de: 'Das Haus ist groß.', ko: '그 집은 크다.', cefr: 'A1', source: 'wiktionary' }
                    ]
                }
            }
        }
    ];

    for (const v of vocabData) {
        await prisma.vocab.upsert({
            where: { id: 0 }, // trick to force create via createMany fallback
            update: {},
            create: v
        });
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});
