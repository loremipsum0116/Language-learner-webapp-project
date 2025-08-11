const { prisma } = require('../lib/prismaClient');
const { startOfKstDay } = require('../lib/kst');

async function disableAlarmsForOverdueFolders() {
  const today = startOfKstDay();
  
  // Find folders that were due before today but are still active
  const overdueFolders = await prisma.srsFolder.findMany({
    where: {
      alarmActive: true,
      nextReviewAt: {
        lt: today, // Less than the start of today
      },
    },
    select: { id: true },
  });

  if (overdueFolders.length > 0) {
    const idsToDisable = overdueFolders.map(f => f.id);
    await prisma.srsFolder.updateMany({
      where: { id: { in: idsToDisable } },
      data: { alarmActive: false },
    });
    console.log(`[CRON] Disabled alarms for ${idsToDisable.length} overdue SRS folders.`);
  }
}

module.exports = { disableAlarmsForOverdueFolders };