// // server/routes/srs-flat-extensions.js  (교체용 핸들러만 발췌)
// const express = require('express');
// const router = express.Router();

// let auth;
// try { auth = require('../middleware/auth'); } catch { auth = (_req,_res,next)=>next(); }
// let prisma;
// try { ({ prisma } = require('../lib/prismaClient')); } catch { prisma = null; }

// const dayjs = require('dayjs');
// const utc = require('dayjs/plugin/utc');
// const tz = require('dayjs/plugin/timezone');
// dayjs.extend(utc); dayjs.extend(tz);
// const KST = 'Asia/Seoul';
// const kstDayStr = () => dayjs().tz(KST).format('YYYY-MM-DD');
// const kstDayStart = (s) => dayjs.tz(s || kstDayStr(), KST).startOf('day').toDate();

// // 선택: 알림 스케줄러가 있으면 사용
// let nextAlarmSlot = null, scheduleFolder = null;
// try {
//   ({ nextAlarmSlot, scheduleFolder } = require('../services/alarmQueue'));
// } catch { /* optional */ }

// router.use(auth);

// // ✅ POST /srs/folders/create  — kind/enableAlarm 지원 버전
// // server/routes/srs-flat-extensions.js
// // 필요한 경우 상단에 추가:
// // const { nextAlarmSlot, scheduleFolder } = require('../services/alarmQueue');

// router.post('/srs/folders/create', async (req, res) => {
//   if (!prisma) return res.status(500).json({ error: 'DB 초기화 실패(prisma 없음)' });
//   try {
//     const userId = req.user?.id;
//     if (!userId) return res.status(401).json({ error: 'unauthorized' });

//     const { name, forDate, kind: bodyKind, enableAlarm } = req.body || {};
//     const dayStr = (typeof forDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(forDate)) ? forDate : kstDayStr();
//     const dayStart = kstDayStart(dayStr);

//     const kind = (bodyKind && String(bodyKind).trim()) || 'review';
//     const alarmActive = !!enableAlarm;
//     const nextAlarmAt = alarmActive && typeof nextAlarmSlot === 'function' ? nextAlarmSlot(dayjs()).toDate() : null;

//     let row;
//     try {
//       row = await prisma.srsFolder.create({
//         data: {
//           userId,
//           parentId: null,
//           name: (name && String(name).trim()) || dayStr,
//           date: dayStart,
//           kind,
//           scheduledOffset: 0,
//           autoCreated: true,
//           alarmActive,
//           nextAlarmAt,
//         },
//         select: { id: true, name: true, date: true, alarmActive: true, nextAlarmAt: true },
//       });

//       if (alarmActive && nextAlarmAt && typeof scheduleFolder === 'function') {
//         try { await scheduleFolder(row.id, nextAlarmAt); } catch (_) {}
//       }
//     } catch (e) {
//       // 유니크 충돌 시 동일 (userId, date, kind) 반환
//       if (e && e.code === 'P2002') {
//         row = await prisma.srsFolder.findFirst({
//           where: { userId, date: dayStart, kind },
//           select: { id: true, name: true, date: true, alarmActive: true, nextAlarmAt: true },
//           orderBy: { id: 'desc' },
//         });
//         if (row) return res.json({ data: row });
//       }
//       console.error('[srs-flat-extensions] create error:', e);
//       return res.status(500).json({ error: '폴더 생성에 실패했습니다.' });
//     }

//     return res.json({ data: row });
//   } catch (e) {
//     console.error('[srs-flat-extensions] POST /srs/folders/create failed:', e);
//     res.status(500).json({ error: '폴더 생성에 실패했습니다.' });
//   }
// });


// module.exports = router;
