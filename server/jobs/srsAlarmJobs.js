const { prisma } = require('../lib/prismaClient');
const { startOfKstDay, kstAt } = require('../lib/kst');

// ❶ 6시간마다: 오늘 폴더에 미학습 카드가 1개 이상이면 대시보드 알림 생성
async function sixHourlyNotify() {
  const today = startOfKstDay();
  const folders = await prisma.srsFolder.findMany({
    where: { date: today, alarmActive: true },
    include: { user: true, items: { select: { learned: true } } },
  });

  for (const f of folders) {
    const remaining = f.items.filter(i => !i.learned).length;
    if (remaining > 0) {
      // TODO: 대시보드 알림 엔터티/테이블과 통합
      // await notifyDashboard(f.userId, `오늘 SRS 미학습 ${remaining}개`);
    }
  }
}

// ❷ 자정 직후: 출석/패널티
async function midnightRoll() {
  const today = startOfKstDay();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  const stats = await prisma.dailyStudyStat.findMany({ where: { date: yesterday } });
  for (const s of stats) {
    const ok = s.srsSolved >= 10 && s.wrongDueNext === 0;
    if (ok) {
      await prisma.user.update({ where: { id: s.userId }, data: { streak: { increment: 1 } } });
    } else {
      await prisma.user.update({ where: { id: s.userId }, data: { streak: 0 } });
      // 다음날(오늘) 폴더 알림 비활성화(간단 구현: 오늘 review 폴더들 mute)
      await prisma.srsFolder.updateMany({ where: { userId: s.userId, date: today }, data: { alarmActive: false } });
    }
  }
}

module.exports = { sixHourlyNotify, midnightRoll };
