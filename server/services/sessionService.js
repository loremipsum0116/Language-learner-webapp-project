const dayjs = require('dayjs');
const { prisma } = require('../lib/prismaClient');
const { nextAlarmSlot } = require('../utils/alarmTime'); 
const { scheduleFolder } = require('../queues/alarmQueue');

async function finishSession(req, res) {
    const userId = req.user.id;
    const todayStart = dayjs().startOf('day').toDate();

    const batches = await prisma.sessionBatch.findMany({
        where: { userId, createdAt: { gte: todayStart } }
    });

    const flat = batches.flatMap(b => b.cards);
    if (!flat.length) return res.sendStatus(204);

    const avgErr = flat.filter(c => c.incorrect).length / flat.length;

    const hiErrIds = flat
        .filter(c => c.incorrect)
        .filter(() => 1 > avgErr)        // 1(오답) > 평균
        .map(c => c.srsCardId);

    if (hiErrIds.length) {
        const folder = await prisma.category.create({
            data: {
                userId,
                name: `High-Mistake ${dayjs().format('YYYY-MM-DD')}`,
                kind: 'srs',
                nextAlarmAt: nextAlarmSlot(dayjs().add(1, 'day')),
                remindEvery: 1,
                items: { connect: hiErrIds.map(id => ({ id })) }
            }
        });
        await scheduleFolder(folder.id, folder.nextAlarmAt.getTime() - Date.now());
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
        const today = dayjs().startOf('day');
        const lastDay = user.lastStudiedAt ? dayjs(user.lastStudiedAt).startOf('day') : null;
        let newStreak = user.streak;

        if (!lastDay || !lastDay.isSame(today)) { // 오늘 처음 학습하는 경우
            if (lastDay && today.diff(lastDay, 'day') === 1) {
                // 어제도 학습했으면 연속일 증가
                newStreak += 1;
            } else {
                // 연속이 끊겼으면 1로 초기화
                newStreak = 1;
            }
            await prisma.user.update({
                where: { id: userId },
                data: { streak: newStreak, lastStudiedAt: new Date() }
            });
        }
    }

    res.json({ highMistake: hiErrIds.length });
}

module.exports = { finishSession };
