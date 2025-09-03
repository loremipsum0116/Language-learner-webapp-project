//server/queues/alarmQueue.js
const { Queue, Worker } = require('bullmq');
const { prisma } = require('../lib/prismaClient');
const { nextAlarmSlot } = require('../utils/alarmTime');

/* Redis 연결 설정 */
const connection = { host: '127.0.0.1', port: 6379 };

const alarmQ = new Queue('alarm', { connection });

/** 🔔 다음 알림 예약 */
async function scheduleFolder(folderId, delayMs) {
    await alarmQ.add('fire', { folderId }, { delay: delayMs, removeOnComplete: true });
}

/** 🔔 워커 – 알림 발송 후 다음 슬롯 예약 */
new Worker(
    'alarm',
    async (job) => {
        const folder = await prisma.srsFolder.findUnique({ where: { id: job.data.folderId } });
        if (!folder || !folder.alarmActive) return;

        // TODO: Web-Push / Email 발송 로직
        console.log(`[ALARM] remind user#${folder.userId} about "${folder.name}"`);

        const next = nextAlarmSlot();
        await prisma.srsFolder.update({ where: { id: folder.id }, data: { nextAlarmAt: next.toDate() } });
        await scheduleFolder(folder.id, next.getTime() - Date.now());
    },
    { connection }
);

module.exports = { scheduleFolder, alarmQ };
