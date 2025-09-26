// find-exact-cards.js
// UI에 표시된 정확한 카드들 찾기

const { PrismaClient } = require('@prisma/client');

async function findExactCards() {
    console.log('🔍 Finding exact cards from UI');

    const PROD_URL = "mysql://root:mdsooQRAMNBnvXHjTyMYwpQvmXUtlZsG@shuttle.proxy.rlwy.net:25466/railway";

    // UI에서 보여진 일본어 단어들
    const words = [
        'あさって', 'あそこ', 'あちら', 'あっち', 'あなた',
        'あの', 'アパート', 'あまり', 'ある', 'あれ',
        'いい', 'いいえ', 'いかが', 'いくつ', 'いくら',
        'いす', 'いちばん', 'いつ', 'いつも', 'いろいろ',
        'ええ', 'エレベーター', 'おいしい', 'おなか', 'おばあさん',
        'おもしろい', 'お兄さん', 'お姉さん', 'お巡りさん', 'お弁当'
    ];

    try {
        const prisma = new PrismaClient({
            datasources: { db: { url: PROD_URL } }
        });

        await prisma.$connect();

        const user = await prisma.user.findUnique({
            where: { email: 'sst7050@naver.com' }
        });

        console.log(`✅ Found user: ID ${user.id}`);

        // 각 단어를 vocab 테이블에서 찾기
        console.log('\n📋 Finding exact cards...');

        const foundCards = [];

        for (const word of words.slice(0, 10)) { // 처음 10개만
            // vocab 테이블에서 단어 찾기
            const vocabs = await prisma.vocab.findMany({
                where: {
                    OR: [
                        { word: word },
                        { reading: word },
                        { word: { contains: word } }
                    ]
                },
                take: 1
            });

            if (vocabs.length > 0) {
                const vocab = vocabs[0];

                // 이 vocab에 해당하는 사용자의 srscard 찾기
                const cards = await prisma.srscard.findMany({
                    where: {
                        userId: user.id,
                        stage: 2,
                        srsfolderitem: {
                            some: {
                                vocabId: vocab.id
                            }
                        }
                    },
                    include: {
                        srsfolderitem: {
                            include: {
                                srsfolder: {
                                    select: { id: true, name: true, parentId: true }
                                },
                                vocab: {
                                    select: { word: true, reading: true }
                                }
                            }
                        }
                    }
                });

                if (cards.length > 0) {
                    foundCards.push(...cards);
                    const card = cards[0];
                    const folder = card.srsfolderitem[0]?.srsfolder;
                    const vocab = card.srsfolderitem[0]?.vocab;

                    const now = new Date();
                    const reviewTime = new Date(card.nextReviewAt);
                    const minutesLeft = Math.floor((reviewTime - now) / 1000 / 60);

                    console.log(`📌 "${word}" → Card ${card.id} in "${folder?.name}" (Parent: ${folder?.parentId})`);
                    console.log(`   Review in: ${minutesLeft} minutes | Vocab: ${vocab?.word || vocab?.reading}`);
                }
            }
        }

        if (foundCards.length > 0) {
            // 같은 하위 폴더별로 그룹화
            const folderGroups = {};

            for (const card of foundCards) {
                const folder = card.srsfolderitem[0]?.srsfolder;
                if (!folder?.id) continue;

                if (!folderGroups[folder.id]) {
                    folderGroups[folder.id] = {
                        name: folder.name,
                        parentId: folder.parentId,
                        cards: []
                    };
                }
                folderGroups[folder.id].cards.push(card);
            }

            console.log('\n🗂️  Cards by subfolder:');

            for (const [folderId, group] of Object.entries(folderGroups)) {
                console.log(`\n📂 "${group.name}" (ID: ${folderId}, Parent: ${group.parentId})`);
                console.log(`   ${group.cards.length} cards found`);

                if (group.cards.length > 1) {
                    // 타이머 차이 계산
                    const times = group.cards.map(c => new Date(c.nextReviewAt).getTime());
                    const diffMs = Math.max(...times) - Math.min(...times);
                    const diffMin = diffMs / 1000 / 60;

                    console.log(`   ⏱️  Timer difference: ${diffMin.toFixed(1)} minutes`);

                    if (diffMin > 0) {
                        console.log(`   🚀 EXECUTING SYNC NOW...`);

                        const earliestTime = new Date(Math.min(...times));

                        try {
                            const updateResult = await prisma.srscard.updateMany({
                                where: { id: { in: group.cards.map(c => c.id) } },
                                data: { nextReviewAt: earliestTime }
                            });

                            console.log(`   ✅ Synchronized ${updateResult.count} cards to ${earliestTime.toLocaleString()}`);
                        } catch (syncError) {
                            console.log(`   ❌ Sync error: ${syncError.message}`);
                        }
                    } else {
                        console.log(`   ✅ Already synchronized`);
                    }
                }
            }
        }

        await prisma.$disconnect();

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

findExactCards();