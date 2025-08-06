const dayjs = require('dayjs');
const { prisma } = require('../lib/prismaClient');
const { nextAlarmSlot } = require('../lib/alarmSlot');
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

    res.json({ highMistake: hiErrIds.length });
}

module.exports = { finishSession };
