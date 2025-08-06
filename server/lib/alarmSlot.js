const { Queue, Worker } = require('bullmq');
const { prisma } = require('../lib/prismaClient');
const { nextAlarmSlot } = require('./alarmSlot');

const alarmQ = new Queue('alarm', {
    connection: { host: '127.0.0.1', port: 6379 }
});

async function scheduleFolder(folderId, delayMs) {
    await alarmQ.add('fire', { folderId }, { delay: delayMs, removeOnComplete: true });
}

new Worker('alarm', async job => {
    const folder = await prisma.category.findUnique({ where: { id: job.data.folderId } });
    if (!folder || !folder.alarmActive) return;

    /* TODO: 실제 Web-Push 또는 e-mail 발송 */
    console.log(`[ALARM] remind user#${folder.userId} about "${folder.name}"`);

    const next = nextAlarmSlot();
    await prisma.category.update({
        where: { id: folder.id },
        data: { nextAlarmAt: next }
    });
    await scheduleFolder(folder.id, next.getTime() - Date.now());
}, { connection: { host: '127.0.0.1', port: 6379 } });

module.exports = { scheduleFolder, alarmQ };
