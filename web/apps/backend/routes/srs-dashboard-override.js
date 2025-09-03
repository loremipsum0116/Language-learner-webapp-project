// // server/routes/srs-dashboard-override.js
// const express = require('express');
// const router = express.Router();

// const dayjs = require('dayjs');
// const utc = require('dayjs/plugin/utc');
// const tz = require('dayjs/plugin/timezone');
// dayjs.extend(utc); dayjs.extend(tz);
// const KST = 'Asia/Seoul';

// let auth;
// try { auth = require('../middleware/auth'); } catch { auth = (_req,_res,next)=>next(); }
// let prisma;
// try { ({ prisma } = require('../lib/prismaClient')); } catch { prisma = null; }

// router.use(auth);

// router.get('/srs/dashboard', async (req, res) => {
//   if (!prisma) return res.status(500).json({ error: 'DB 초기화 실패(prisma 없음)' });
//   try {
//     const userId = req.user?.id;
//     if (!userId) return res.status(401).json({ error: 'unauthorized' });

//     const rows = await prisma.srsFolder.findMany({
//       where: { userId },
//       orderBy: [{ date: 'desc' }, { id: 'desc' }],
//       select: { id: true, name: true, date: true, alarmActive: true, nextAlarmAt: true },
//     });

//     const data = rows.map(f => ({
//       id: f.id,
//       name: f.name,
//       date: f.date ? dayjs(f.date).tz(KST).format('YYYY-MM-DD') : null,
//       alarmActive: !!f.alarmActive,
//       nextAlarmAt: f.nextAlarmAt || null,
//       stage: 0, completed: 0, total: 0, incorrect: 0,
//     }));

//     res.json({ data });
//   } catch (e) {
//     console.error('[srs-dashboard-override] /srs/dashboard failed:', e);
//     res.status(500).json({ error: '대시보드 데이터를 불러오는 데 실패했습니다.' });
//   }
// });

// module.exports = router;
