// 중복된 일본어 오답노트 데이터 정리 스크립트
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupDuplicateWrongAnswers() {
    try {
        console.log('🔍 중복된 오답노트 데이터 정리 시작...');

        // 같은 사용자, 같은 단어, 같은 날짜에 생성된 중복 데이터 찾기
        const duplicates = await prisma.$queryRaw`
            SELECT userId, vocabId, DATE(wrongAt) as wrongDate, COUNT(*) as count
            FROM wronganswer
            WHERE wrongAt >= '2025-09-16'
            GROUP BY userId, vocabId, DATE(wrongAt)
            HAVING COUNT(*) > 1
            ORDER BY count DESC
        `;

        console.log(`📊 발견된 중복 그룹: ${duplicates.length}개`);

        for (const duplicate of duplicates) {
            console.log(`👤 사용자 ${duplicate.userId}, 단어 ${duplicate.vocabId}, 날짜 ${duplicate.wrongDate}: ${duplicate.count}개`);

            // 해당 그룹의 모든 레코드 가져오기 (최신 것 하나만 남기고 나머지 삭제)
            const records = await prisma.wronganswer.findMany({
                where: {
                    userId: duplicate.userId,
                    vocabId: duplicate.vocabId,
                    wrongAt: {
                        gte: new Date(duplicate.wrongDate + 'T00:00:00.000Z'),
                        lt: new Date(new Date(duplicate.wrongDate + 'T00:00:00.000Z').getTime() + 24 * 60 * 60 * 1000)
                    }
                },
                orderBy: {
                    wrongAt: 'desc'
                }
            });

            // 가장 최신 것 하나만 남기고 나머지 삭제
            const toDelete = records.slice(1);

            if (toDelete.length > 0) {
                console.log(`🗑️  삭제할 레코드 ID: ${toDelete.map(r => r.id).join(', ')}`);

                await prisma.wronganswer.deleteMany({
                    where: {
                        id: {
                            in: toDelete.map(r => r.id)
                        }
                    }
                });

                console.log(`✅ ${toDelete.length}개 중복 레코드 삭제 완료`);
            }
        }

        // 정리 결과 확인
        const remainingCount = await prisma.wronganswer.count({
            where: {
                wrongAt: {
                    gte: new Date('2025-09-16T00:00:00.000Z')
                }
            }
        });

        console.log(`🎉 정리 완료! 오늘 생성된 오답노트 총 ${remainingCount}개`);

    } catch (error) {
        console.error('❌ 중복 데이터 정리 중 오류:', error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanupDuplicateWrongAnswers();