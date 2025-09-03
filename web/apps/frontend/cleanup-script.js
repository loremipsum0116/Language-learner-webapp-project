// cleanup-script.js - 잘못된 학습 기록 정리
const { PrismaClient } = require('@prisma/client');
const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');
const utc = require('dayjs/plugin/utc');

dayjs.extend(utc);
dayjs.extend(timezone);

const prisma = new PrismaClient();
const KST = 'Asia/Seoul';

async function cleanupInvalidRecords() {
    try {
        const userId = 1; // 사용자 ID (필요시 변경)
        
        // 오늘 날짜 범위
        const today = dayjs().tz(KST).startOf('day');
        const startOfDay = today.toDate();
        const endOfDay = today.endOf('day').toDate();
        
        console.log('오늘 날짜 범위:', {
            start: startOfDay.toISOString(),
            end: endOfDay.toISOString()
        });
        
        // 1. 현재 문제가 되는 기록들 조회
        const problematicRecords = await prisma.srsfolderitem.findMany({
            where: {
                lastReviewedAt: {
                    gte: startOfDay,
                    lte: endOfDay
                },
                srscard: {
                    userId: userId,
                    waitingUntil: {
                        gt: new Date()
                    },
                    isOverdue: false
                }
            },
            include: {
                srscard: {
                    select: {
                        id: true,
                        waitingUntil: true,
                        isOverdue: true
                    }
                }
            }
        });
        
        console.log(`문제가 되는 기록 ${problematicRecords.length}개 발견:`, 
            problematicRecords.map(r => ({
                cardId: r.cardId,
                lastReviewedAt: r.lastReviewedAt,
                waitingUntil: r.srscard.waitingUntil
            }))
        );
        
        // 2. 문제가 되는 기록들의 lastReviewedAt을 NULL로 설정
        if (problematicRecords.length > 0) {
            const cardIds = problematicRecords.map(r => r.cardId);
            
            const updateResult = await prisma.srsfolderitem.updateMany({
                where: {
                    cardId: { in: cardIds }
                },
                data: {
                    lastReviewedAt: null
                }
            });
            
            console.log(`${updateResult.count}개 기록의 lastReviewedAt을 정리했습니다.`);
        }
        
        // 3. 사용자 dailyQuizCount도 리셋
        await prisma.user.update({
            where: { id: userId },
            data: {
                dailyQuizCount: 0,
                lastQuizDate: null
            }
        });
        
        console.log('사용자 dailyQuizCount도 리셋했습니다.');
        console.log('정리 완료! 이제 SrsDashboard를 새로고침하세요.');
        
    } catch (error) {
        console.error('정리 중 오류 발생:', error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanupInvalidRecords();