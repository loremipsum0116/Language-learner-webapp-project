// find-japanese-cards.js
// 일본어 카드들 직접 검색

const { prisma } = require('./lib/prismaClient');

async function findJapaneseCards() {
    console.log('🔍 Searching for Japanese cards...');

    try {
        // 1. 일본어 단어들 검색
        const japaneseWords = [
            'あさって', 'あそこ', 'あちら', 'あっち', 'あなた',
            'あの', 'アパート', 'あまり', 'ある', 'あれ',
            'いい', 'いいえ', 'いかが', 'いくつ', 'いくら'
        ];

        for (const word of japaneseWords.slice(0, 5)) {
            console.log(`\n🔍 Searching for: ${word}`);

            const cards = await prisma.srscard.findMany({
                where: {
                    OR: [
                        { word: { contains: word } },
                        { reading: { contains: word } }
                    ]
                },
                include: {
                    srsfolderitem: {
                        include: {
                            srsfolder: {
                                select: { id: true, parentId: true, name: true, userId: true }
                            }
                        }
                    }
                },
                take: 3
            });

            if (cards.length > 0) {
                for (const card of cards) {
                    const folder = card.srsfolderitem[0]?.srsfolder;

                    console.log(`   📌 Found: ${card.word} (ID: ${card.id})`);
                    console.log(`   📁 Folder: ${folder?.name} (Parent: ${folder?.parentId}, User: ${folder?.userId})`);
                    console.log(`   📚 Stage: ${card.stage}`);
                    console.log(`   ⏰ Next Review: ${card.nextReviewDate}`);
                    console.log(`   ❌ Wrong Count: ${card.wrongCount || 0}`);

                    if (card.nextReviewDate) {
                        const now = new Date();
                        const reviewTime = new Date(card.nextReviewDate);
                        const timeDiff = Math.floor((reviewTime - now) / 1000 / 60);
                        console.log(`   ⏱️  Time until review: ${timeDiff} minutes`);
                    }
                }
            } else {
                console.log(`   ❌ Not found: ${word}`);
            }
        }

        // 2. Stage 2 카드들로 타이머가 설정된 것들 찾기
        console.log('\n🔍 Searching Stage 2 cards with timers...');

        const stage2Cards = await prisma.srscard.findMany({
            where: {
                stage: 2,
                nextReviewDate: { not: null },
                srsfolderitem: {
                    some: {
                        srsfolder: {
                            parentId: { not: null } // 하위 폴더만
                        }
                    }
                }
            },
            include: {
                srsfolderitem: {
                    include: {
                        srsfolder: {
                            select: { id: true, parentId: true, name: true, userId: true }
                        }
                    }
                }
            },
            take: 10
        });

        console.log(`\n📊 Found ${stage2Cards.length} Stage 2 cards with timers`);

        // 하위 폴더별 그룹화
        const groups = {};
        for (const card of stage2Cards) {
            const folder = card.srsfolderitem[0]?.srsfolder;
            if (!folder?.parentId) continue;

            const key = `${folder.userId}_${folder.parentId}`;
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(card);
        }

        for (const [key, cards] of Object.entries(groups)) {
            const [userId, parentId] = key.split('_');
            console.log(`\n🗂️  User ${userId}, Parent Folder ${parentId}: ${cards.length} Stage 2 cards`);

            if (cards.length > 1) {
                const times = cards.map(c => new Date(c.nextReviewDate).getTime());
                const minTime = Math.min(...times);
                const maxTime = Math.max(...times);
                const diffMinutes = (maxTime - minTime) / 1000 / 60;

                console.log(`   ⏱️  Timer difference: ${diffMinutes.toFixed(1)} minutes`);

                if (diffMinutes > 0 && diffMinutes <= 60) {
                    console.log(`   ✅ Should be synchronized! (${diffMinutes.toFixed(1)} min difference)`);

                    // 카드 세부 정보
                    for (const card of cards.slice(0, 3)) {
                        const reviewTime = new Date(card.nextReviewDate);
                        console.log(`      - ${card.word}: ${reviewTime.toLocaleString()}`);
                    }
                }
            }
        }

    } catch (error) {
        console.error('❌ Search error:', error);
    }

    await prisma.$disconnect();
}

findJapaneseCards();