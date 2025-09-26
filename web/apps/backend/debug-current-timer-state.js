// 현재 타이머 상태 디버깅 스크립트
const { PrismaClient } = require('@prisma/client');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const duration = require('dayjs/plugin/duration');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(duration);

async function debugCurrentTimerState() {
    const PROD_URL = "mysql://root:mdsooQRAMNBnvXHjTyMYwpQvmXUtlZsG@shuttle.proxy.rlwy.net:25466/railway";

    const prisma = new PrismaClient({
        datasources: { db: { url: PROD_URL } }
    });

    try {
        await prisma.$connect();
        console.log('🔍 현재 타이머 상태 디버깅 시작...');
        console.log('현재 시간(KST):', dayjs().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss'));
        console.log('===================================');

        // User ID 4의 DAY1, DAY2 폴더 카드들 조회
        const cards = await prisma.srsCard.findMany({
            where: {
                userId: 4,
                folderId: {
                    in: [137, 138] // DAY1, DAY2 폴더 ID
                },
                nextReviewAt: {
                    not: null
                }
            },
            include: {
                vocab: {
                    select: {
                        lemma: true
                    }
                },
                folder: {
                    select: {
                        name: true
                    }
                }
            },
            orderBy: [
                { folderId: 'asc' },
                { nextReviewAt: 'asc' }
            ]
        });

        console.log(`📊 발견된 카드 수: ${cards.length}개`);
        console.log('');

        // 폴더별로 그룹화
        const cardsByFolder = {};
        cards.forEach(card => {
            const folderName = card.folder.name;
            if (!cardsByFolder[folderName]) {
                cardsByFolder[folderName] = [];
            }
            cardsByFolder[folderName].push(card);
        });

        const now = dayjs().tz('Asia/Seoul');

        for (const [folderName, folderCards] of Object.entries(cardsByFolder)) {
            console.log(`\n📁 ${folderName} 폴더 (${folderCards.length}개 카드):`);
            console.log('─'.repeat(60));

            // 시간 차이 분석
            let minTime = null;
            let maxTime = null;
            const timeDiffs = [];

            folderCards.forEach((card, index) => {
                const nextReview = dayjs.utc(card.nextReviewAt).tz('Asia/Seoul');
                const diff = nextReview.diff(now);
                const diffMinutes = Math.round(diff / (60 * 1000));

                timeDiffs.push({
                    card: card.vocab?.lemma || 'Unknown',
                    nextReviewAt: card.nextReviewAt,
                    nextReviewKST: nextReview.format('HH:mm:ss'),
                    diffMinutes: diffMinutes,
                    diffString: nextReview.from(now)
                });

                if (minTime === null || nextReview.isBefore(minTime)) {
                    minTime = nextReview;
                }
                if (maxTime === null || nextReview.isAfter(maxTime)) {
                    maxTime = nextReview;
                }
            });

            // 가장 이른 시간과 늦은 시간의 차이
            const totalDiffMinutes = maxTime ? Math.round(maxTime.diff(minTime) / (60 * 1000)) : 0;

            console.log(`⏰ 최조 복습 시간: ${minTime ? minTime.format('HH:mm:ss') : 'N/A'}`);
            console.log(`⏰ 최종 복습 시간: ${maxTime ? maxTime.format('HH:mm:ss') : 'N/A'}`);
            console.log(`📊 시간 차이: ${totalDiffMinutes}분`);
            console.log('');

            // 상위 5개 카드 상세 정보
            console.log('📋 상세 타이머 정보 (상위 5개):');
            timeDiffs.slice(0, 5).forEach((item, index) => {
                console.log(`  ${index + 1}. ${item.card}: ${item.nextReviewKST} (${item.diffMinutes}분 후)`);
            });

            if (timeDiffs.length > 5) {
                console.log(`  ... 외 ${timeDiffs.length - 5}개 더`);
            }
        }

        // 전체 통계
        console.log('\n📈 전체 통계:');
        console.log('─'.repeat(60));

        const allTimes = cards.map(card => dayjs.utc(card.nextReviewAt).tz('Asia/Seoul'));
        if (allTimes.length > 0) {
            const globalMin = allTimes.reduce((min, time) => time.isBefore(min) ? time : min);
            const globalMax = allTimes.reduce((max, time) => time.isAfter(max) ? time : max);
            const globalDiff = Math.round(globalMax.diff(globalMin) / (60 * 1000));

            console.log(`⏰ 전체 최조 시간: ${globalMin.format('HH:mm:ss')}`);
            console.log(`⏰ 전체 최종 시간: ${globalMax.format('HH:mm:ss')}`);
            console.log(`📊 전체 시간 차이: ${globalDiff}분`);

            // 동기화 상태 판단
            if (globalDiff === 0) {
                console.log('✅ 완벽하게 동기화됨');
            } else if (globalDiff <= 1) {
                console.log('🟡 거의 동기화됨 (1분 이내 차이)');
            } else {
                console.log('❌ 동기화 필요 (1분 이상 차이)');
            }
        }

    } catch (error) {
        console.error('❌ 디버깅 실패:', error);
    } finally {
        await prisma.$disconnect();
    }
}

debugCurrentTimerState();