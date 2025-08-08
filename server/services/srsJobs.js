// server/services/srsJobs.js
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const tz = require('dayjs/plugin/timezone');
dayjs.extend(utc); dayjs.extend(tz);

const { prisma } = require('../lib/prismaClient');
const { nextAlarmSlot } = require('../utils/alarmTime');
 // 이미 존재

function kstNow() { return dayjs().tz('Asia/Seoul'); }
function startOfKstDay(d = new Date()) { return dayjs(d).tz('Asia/Seoul').startOf('day'); }
function addKstDays(d, n) { return dayjs(d).add(n, 'day').tz('Asia/Seoul').startOf('day'); }

/**
 * 6시간 간격 알림 스케줄:
 * - KST 오늘 날짜 폴더들 중 미학습(learned=false) 아이템이 1개 이상 있으면 nextAlarmAt 갱신
 */
async function sixHourlyNotify() {
    const start = startOfKstDay();
    const end = addKstDays(start, 1);

    // 오늘 날짜의 SRS 루트 폴더(또는 날짜 폴더) 추정: date 컬럼 기준
    const todayFolders = await prisma.srsFolder.findMany({
        where: { date: { gte: start.toDate(), lt: end.toDate() } },
        select: { id: true, userId: true },
    });

    for (const f of todayFolders) {
        const due = await prisma.srsFolderItem.count({
            where: { folderId: f.id, learned: false },
        });
        if (due > 0) {
            const when = nextAlarmSlot(kstNow()); // 다음 0/6/12/18시
            await prisma.srsFolder.update({
                where: { id: f.id },
                data: { nextAlarmAt: when.toDate() },
            });
            // 실제 "대시보드 알림"은 프론트가 폴더 상태(nextAlarmAt, due 여부)를 조회해 배지/토스트로 처리
        }
    }
}

/**
 * 자정 롤업(00:05 KST):
 * - 전일 폴더 기준으로 streak 증감/리셋
 * - 전일 폴더 알림 중지(nextAlarmAt=null)
 * 정책: 전일 learned>=10 && 미학습(learned=false) 0개 -> streak+1, 아니면 0으로 초기화
 */
async function midnightRoll() {
    const todayStart = startOfKstDay();
    const yStart = addKstDays(todayStart, -1);
    const yEnd = todayStart;

    const users = await prisma.user.findMany({ select: { id: true, streak: true } });

    for (const u of users) {
        const learnedCount = await prisma.srsFolderItem.count({
            where: { folder: { userId: u.id, date: { gte: yStart.toDate(), lt: yEnd.toDate() } }, learned: true },
        });
        const unlearnedCount = await prisma.srsFolderItem.count({
            where: { folder: { userId: u.id, date: { gte: yStart.toDate(), lt: yEnd.toDate() } }, learned: false },
        });

        const nextStreak = (learnedCount >= 10 && unlearnedCount === 0) ? (u.streak + 1) : 0;

        await prisma.$transaction([
            prisma.user.update({ where: { id: u.id }, data: { streak: nextStreak } }),
            prisma.srsFolder.updateMany({
                where: { userId: u.id, date: { gte: yStart.toDate(), lt: yEnd.toDate() } },
                data: { nextAlarmAt: null }, // 어제 알림은 중지
            }),
        ]);
    }
}

module.exports = { sixHourlyNotify, midnightRoll, startOfKstDay, addKstDays };
