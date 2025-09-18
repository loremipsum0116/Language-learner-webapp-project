const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkWrongAnswers() {
    try {
        const recent = await prisma.wronganswer.findMany({
            where: { userId: 1 },
            orderBy: { wrongAt: 'desc' },
            take: 10,
            include: { vocab: true }
        });

        console.log('최근 오답노트 10개:');
        recent.forEach((w, i) => {
            console.log(`${i+1}. ${w.vocab?.lemma || 'N/A'} (틀린시간: ${w.wrongAt}, 폴더ID: ${w.folderId}, 완료여부: ${w.isCompleted})`);
        });

        // about 단어 오답노트 상세 확인
        const aboutWrongAnswers = await prisma.wronganswer.findMany({
            where: {
                userId: 1,
                vocab: { lemma: 'about' }
            },
            include: { vocab: true },
            orderBy: { wrongAt: 'desc' }
        });

        console.log(`\n=== ABOUT 단어 오답노트 상세 ===`);
        console.log(`about 오답노트 개수: ${aboutWrongAnswers.length}`);
        aboutWrongAnswers.forEach((w, i) => {
            console.log(`${i+1}. ID: ${w.id}, 폴더ID: ${w.folderId}, 완료여부: ${w.isCompleted}, 틀린시간: ${w.wrongAt}`);
        });

        const total = await prisma.wronganswer.count({ where: { userId: 1 } });
        console.log(`\n총 오답노트 개수: ${total}`);

        const orphanCount = await prisma.wronganswer.count({
            where: { userId: 1, folderId: null }
        });
        console.log(`고아 오답노트 개수 (folderId: null): ${orphanCount}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkWrongAnswers();