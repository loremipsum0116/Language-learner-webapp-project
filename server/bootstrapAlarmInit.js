//server/bootstrapAlarmInit.js
const { prisma } = require('./lib/prismaClient');
const { scheduleFolder } = require('./queues/alarmQueue');

(async () => {
    try {
        const folders = await prisma.category.findMany({
            where: { alarmActive: true, nextAlarmAt: { not: null } }
        });
        folders.forEach(f =>
            scheduleFolder(f.id, f.nextAlarmAt.getTime() - Date.now())
        );
        console.log(`[BOOT] Re-scheduled ${folders.length} active alarm(s)`);
    } catch (e) {
        console.error('[BOOT] alarmInit error', e);
    }
})();
