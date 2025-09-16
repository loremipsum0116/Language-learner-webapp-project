// 오답노트 데이터 확인 스크립트
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkWrongAnswers() {
    try {
        console.log('🔍 오답노트 데이터 확인 중...');

        // 모든 오답노트 데이터 확인
        const wrongAnswers = await prisma.wronganswer.findMany({
            where: {
                wrongAt: {
                    gte: new Date('2025-09-16T00:00:00.000Z')
                }
            },
            orderBy: {
                wrongAt: 'desc'
            },
            include: {
                vocab: {
                    select: {
                        lemma: true,
                        levelJLPT: true
                    }
                }
            }
        });

        console.log(`📊 오늘 생성된 오답노트: ${wrongAnswers.length}개`);

        wrongAnswers.forEach((wa, index) => {
            console.log(`${index + 1}. [${wa.id}] 사용자: ${wa.userId}, 단어: ${wa.vocab?.lemma || 'N/A'} (${wa.vocabId}), 시간: ${wa.wrongAt}`);
        });

        // odat_note 테이블도 확인해보기
        const odatNotes = await prisma.odat_note.findMany({
            where: {
                createdAt: {
                    gte: new Date('2025-09-16T00:00:00.000Z')
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        console.log(`\n📋 오늘 생성된 ODAT 노트: ${odatNotes.length}개`);

        odatNotes.forEach((note, index) => {
            console.log(`${index + 1}. [${note.id}] 사용자: ${note.userId}, 아이템: ${note.itemId}, 타입: ${note.itemType}, 시간: ${note.createdAt}`);
            if (note.wrongData) {
                const wrongData = typeof note.wrongData === 'string' ? JSON.parse(note.wrongData) : note.wrongData;
                console.log(`   문제: "${wrongData.question}", 정답: "${wrongData.answer}", 퀴즈타입: "${wrongData.quizType}"`);
            }
        });

    } catch (error) {
        console.error('❌ 오답노트 확인 중 오류:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkWrongAnswers();