// // server/server.js
// require('dotenv').config();

// const express = require('express');
// const cors = require('cors');
// const cookieParser = require('cookie-parser');
// const jwt = require('jsonwebtoken');
// const bcrypt = require('bcryptjs');
// const path = require('path');
// const fs = require('node:fs/promises');
// const { prisma } = require('./db/prisma');
// const { ok, fail } = require('./lib/resp');
// const {
//     parseWikitext,
//     fetchWiktionaryWikitext,
//     fetchCommonsFileUrl,
// } = require('./integrations/wiktionary');


// const app = express();

// // ===== Config =====
// const PORT = 4000;
// const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
// const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
// const COOKIE_NAME = 'token';
// const SLIDING_MINUTES = 15;

// // ===== Middlewares =====
// app.use((req, res, next) => { console.log('>>>', req.method, req.url); next(); });
// app.use(cookieParser());
// app.use(express.json());
// app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
// app.use('/static', express.static(path.join(__dirname, 'static')));
// app.get('/__ping', (req, res) => res.type('text').send('pong'));
// app.use('/audio', express.static(path.join(__dirname, 'audio')));

// // ===== Helpers =====

// function signToken(payload) {
//     return jwt.sign(payload, JWT_SECRET, { expiresIn: `${SLIDING_MINUTES}m` });
// }

// function setAuthCookie(res, token) {
//     res.cookie(COOKIE_NAME, token, {
//         httpOnly: true,
//         sameSite: 'lax',
//         secure: process.env.NODE_ENV === 'production',
//         maxAge: SLIDING_MINUTES * 60 * 1000,
//     });
// }


// async function generateMcqQuizItems(prisma, userId, vocabIds) {
//     if (!vocabIds || vocabIds.length === 0) return [];

//     const ids = vocabIds.map(Number).filter(Number.isFinite);
//     if (ids.length === 0) return [];

//     // 1. Fetch all necessary data in one go
//     const [vocabs, cards, distractorPool] = await Promise.all([
//         prisma.vocab.findMany({
//             where: { id: { in: ids } },
//             include: { dictMeta: true }
//         }),
//         prisma.sRSCard.findMany({
//             where: { userId, itemType: 'vocab', itemId: { in: ids } },
//             select: { id: true, itemId: true }
//         }),
//         prisma.vocab.findMany({
//             where: { id: { notIn: ids }, dictMeta: { isNot: null } },
//             include: { dictMeta: true },
//             take: 500,
//         })
//     ]);

//     const cardIdMap = new Map(cards.map(c => [c.itemId, c.id]));

//     // 2. Create a robust pool of distractor (incorrect) answers
//     const distractorGlosses = new Set();
//     distractorPool.forEach(v => {
//         const examples = Array.isArray(v.dictMeta?.examples) ? v.dictMeta.examples : [];
//         // Handle both old and new schema for finding the gloss
//         const glossEntry = examples.find(ex => ex.kind === 'gloss' && ex.ko) ||
//             examples.find(ex => ex.definitions?.[0]?.ko_def);
//         let gloss = glossEntry?.ko || glossEntry?.definitions?.[0]?.ko_def;
//         if (gloss) {
//             distractorGlosses.add(gloss.split(';')[0].split(',')[0].trim());
//         }
//     });

//     const pickN = (arr, n) => {
//         const shuffled = [...arr].sort(() => 0.5 - Math.random());
//         return shuffled.slice(0, n);
//     };

//     const quizItems = [];
//     for (const vocab of vocabs) {
//         if (!vocab.dictMeta) continue;

//         // 3. Reliably find the correct answer and details from multiple schemas
//         const examples = Array.isArray(vocab.dictMeta.examples) ? vocab.dictMeta.examples : [];
//         const glossEntry = examples.find(ex => ex.kind === 'gloss' && ex.ko) ||
//             examples.find(ex => ex.definitions?.[0]?.ko_def);
//         const correct = glossEntry?.ko || glossEntry?.definitions?.[0]?.ko_def;

//         if (!correct) continue; // Skip if no meaning is found

//         // 4. Generate options for the quiz
//         const localDistractors = new Set(distractorGlosses);
//         localDistractors.delete(correct);
//         const wrongOptions = pickN(Array.from(localDistractors), 3);
//         const options = [correct, ...wrongOptions];
//         // Ensure there are always 4 options
//         while (options.length < 4) {
//             options.push("관련 없는 뜻"); // Add a generic distractor
//         }

//         // 5. Build the final, complete quiz item object
//         quizItems.push({
//             cardId: cardIdMap.get(vocab.id) || null,
//             vocabId: vocab.id,
//             question: vocab.lemma,
//             answer: correct,
//             quizType: 'mcq',
//             options: shuffleArray(options),
//             // Ensure all details are included for the flashcard UI
//             pron: {
//                 ipa: vocab.dictMeta.ipa || null,
//                 ipaKo: vocab.dictMeta.ipaKo || null
//             },
//             levelCEFR: vocab.levelCEFR,
//             pos: vocab.pos,
//             // Pass the full vocab object for maximum flexibility on the frontend
//             vocab: vocab,
//         });
//     }
//     return quizItems;
// }
// // ★★★ 종료 ★★★
// function clearAuthCookie(res) {
//     res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: false });
// }

// // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// // ★ 여기에 shuffleArray 함수를 추가했습니다. ★
// // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// function shuffleArray(array) {
//     for (let i = array.length - 1; i > 0; i--) {
//         const j = Math.floor(Math.random() * (i + 1));
//         [array[i], array[j]] = [array[j], array[i]];
//     }
//     return array;
// }
// async function requireAuth(req, res, next) {
//     const token = req.cookies[COOKIE_NAME];
//     if (!token) return fail(res, 401, 'Unauthorized');
//     try {
//         const decoded = jwt.verify(token, JWT_SECRET);
//         req.user = decoded;
//         setAuthCookie(res, signToken({ id: decoded.id, email: decoded.email, role: decoded.role || 'USER' }));
//         next();
//     } catch {
//         return fail(res, 401, 'Unauthorized');
//     }
// }

// // ... (이하 다른 모든 헬퍼 함수 및 라우트 코드는 이전과 동일하게 유지됩니다)
// // ... (전체 파일의 일관성을 위해 모든 코드를 제공합니다)

// function requireAdmin(req, res, next) {
//     if (!req.user) return fail(res, 401, 'Unauthorized');
//     if (req.user.role !== 'admin') return fail(res, 403, 'Forbidden');
//     return next();
// }

// function buildPron(vocab) {
//     if (!vocab || !vocab.dictMeta) return { ipa: null, ipaKo: null };
//     return { ipa: vocab.dictMeta.ipa || null, ipaKo: vocab.dictMeta.ipaKo || null };
// }

// function scheduleNext(stage = 0, result) {
//     const intervals = [1, 3, 7, 16, 35];
//     let newStage = stage;
//     if (result === 'pass') newStage = Math.min(newStage + 1, intervals.length - 1);
//     else if (result === 'fail') newStage = Math.max(newStage - 1, 0);
//     const days = intervals[newStage];
//     const nextReviewAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
//     return { newStage, nextReviewAt };
// }

// const titlecaseFirst = (s = '') => (s ? s[0].toUpperCase() + s.slice(1) : s);

// async function enrichFromWiktionary(queryLemma) {
//     try {
//         const vocab = await prisma.vocab.findUnique({
//             where: { lemma: titlecaseFirst(queryLemma) },
//             include: { dictMeta: true },
//         });

//         if (!vocab) {
//             console.log(`[Enrich] Vocab not found for "${queryLemma}", cannot enrich.`);
//             return;
//         }

//         const wikitext = await fetchWiktionaryWikitext(queryLemma);
//         if (!wikitext) {
//             console.log(`[Enrich] No wikitext found for "${queryLemma}"`);
//             return;
//         }

//         const parsed = parseWikitext(wikitext);
//         const { ipa, audioTitles, koreanMeaning, examples } = parsed;

//         const updateData = {};
//         if (ipa && !vocab.dictMeta?.ipa) {
//             updateData.ipa = ipa;
//         }
//         if (audioTitles.length > 0 && !vocab.dictMeta?.audioUrl) {
//             const audioUrl = await fetchCommonsFileUrl(audioTitles[0]);
//             if (audioUrl) {
//                 updateData.audioUrl = audioUrl;
//             }
//         }
//         const existingExamples = vocab.dictMeta?.examples || [];
//         const hasExistingGloss = Array.isArray(existingExamples) && existingExamples.some(e => e.kind === 'gloss' && e.ko);
//         if (koreanMeaning && !hasExistingGloss) {
//             updateData.examples = [
//                 { de: '', ko: koreanMeaning, kind: 'gloss', source: 'wiktionary' },
//                 ...examples,
//             ];
//         }
//         if (Object.keys(updateData).length === 0) {
//             console.log(`[Enrich] No new information to update for "${queryLemma}". Skipping.`);
//             return;
//         }
//         await prisma.dictEntry.update({
//             where: { vocabId: vocab.id },
//             data: updateData,
//         });
//         console.log(`[Enrich] Enriched "${queryLemma}" from Wiktionary successfully with new data.`);
//     } catch (error) {
//         console.error(`[Enrich] CRITICAL ERROR during Wiktionary enrichment for "${queryLemma}":`, error);
//     }
// }
// // ===== API Routes =====

// // --- Auth --- (생략, 변경 없음)
// app.post('/auth/register', async (req, res) => {
//     const { email, password } = req.body;
//     if (!email || !password) return fail(res, 400, 'Email and password are required');
//     try {
//         const existingUser = await prisma.user.findUnique({ where: { email } });
//         if (existingUser) return fail(res, 409, 'User with this email already exists');
//         const passwordHash = await bcrypt.hash(password, 10);
//         const userRole = email === 'super@naver.com' ? 'admin' : 'USER';
//         const user = await prisma.user.create({ data: { email, passwordHash, role: userRole } });
//         setAuthCookie(res, signToken({ id: user.id, email: user.email, role: user.role }));
//         const { passwordHash: _, ...userSafe } = user;
//         return ok(res, userSafe);
//     } catch (e) {
//         console.error('POST /auth/register failed:', e);
//         return fail(res, 500, 'Internal Server Error');
//     }
// });
// app.post('/auth/login', async (req, res) => {
//     let { email, password } = req.body || {};
//     if (!email || !password) return fail(res, 400, 'email and password required');
//     email = email.toLowerCase().trim();
//     const user = await prisma.user.findUnique({ where: { email } });
//     if (!user) return fail(res, 401, 'invalid credentials');
//     const okPw = await bcrypt.compare(password, user.passwordHash);
//     if (!okPw) return fail(res, 401, 'invalid credentials');
//     setAuthCookie(res, signToken({ id: user.id, email: user.email, role: user.role }));
//     return ok(res, { id: user.id, email: user.email, role: user.role, profile: user.profile });
// });
// app.post('/auth/logout', (req, res) => {
//     clearAuthCookie(res);
//     return ok(res, { ok: true });
// });
// app.get('/me', requireAuth, async (req, res) => {
//     const user = await prisma.user.findUnique({
//         where: { id: req.user.id },
//         select: { id: true, email: true, role: true, profile: true }
//     });
//     if (!user) return fail(res, 401, 'Unauthorized');
//     return ok(res, user);
// });
// app.patch('/me', requireAuth, async (req, res) => {
//     const payload = req.body?.profile || req.body || {};
//     const { level, tone, address } = payload;
//     const ALLOWED_LEVEL = ['A1', 'A2', 'B1', 'B2', 'C1'];
//     const ALLOWED_TONE = ['formal', 'friendly'];
//     const ALLOWED_ADDRESS = ['du', 'Sie'];
//     if (level && !ALLOWED_LEVEL.includes(level)) return fail(res, 422, 'invalid level');
//     if (tone && !ALLOWED_TONE.includes(tone)) return fail(res, 422, 'invalid tone');
//     if (address && !ALLOWED_ADDRESS.includes(address)) return fail(res, 422, 'invalid address');
//     const user = await prisma.user.update({
//         where: { id: req.user.id },
//         data: { profile: { ...(payload || {}) } },
//         select: { id: true, email: true, role: true, profile: true }
//     });
//     return ok(res, user);
// });

// // --- Vocab / Dict --- (생략, 변경 없음)
// app.get('/dict/search', async (req, res) => {
//     try {
//         const q = (req.query.q || '').trim();
//         if (!q) return ok(res, { entries: [] });
//         const isKoreanQuery = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(q);
//         let hits = [];
//         if (isKoreanQuery) {
//             const allEntries = await prisma.dictEntry.findMany({ include: { Vocab: true } });
//             for (const entry of allEntries) {
//                 const glossExample = Array.isArray(entry.examples) ? entry.examples.find(ex => ex.kind === 'gloss') : null;
//                 if (glossExample && glossExample.ko && glossExample.ko.includes(q)) {
//                     if (entry.Vocab) {
//                         hits.push({ ...entry.Vocab, dictMeta: entry });
//                     }
//                     if (hits.length >= 5) break;
//                 }
//             }
//         } else {
//             const queryDB = () => prisma.vocab.findMany({ where: { lemma: { contains: q } }, take: 5, include: { dictMeta: true } });
//             hits = await queryDB();
//             const lacksKo = (v) => !v.dictMeta?.examples?.some(ex => ex && ex.kind === 'gloss' && ex.ko);
//             if (hits.length === 0 || hits.every(lacksKo)) {
//                 await enrichFromWiktionary(q);
//                 hits = await queryDB();
//             }
//         }
//         const entries = hits.map(v => ({ id: v.id, lemma: v.lemma, pos: v.pos, ipa: v.dictMeta?.ipa || null, audio: v.dictMeta?.audioUrl || null, license: v.dictMeta?.license || null, attribution: v.dictMeta?.attribution || null, examples: Array.isArray(v.dictMeta?.examples) ? v.dictMeta.examples : [] }));
//         return ok(res, { entries });
//     } catch (error) {
//         console.error(`[ERROR] /dict/search?q=${req.query.q} failed:`, error);
//         return fail(res, 500, 'Internal Server Error');
//     }
// });
// app.get('/vocab/list', async (req, res) => {
//     try {
//         const { level, q } = req.query;
//         const where = {};
//         if (q && q.trim()) {
//             where.lemma = { contains: q.trim() };
//         } else if (level) {
//             where.levelCEFR = level;
//         } else {
//             where.levelCEFR = 'A1';
//         }
//         const vocabs = await prisma.vocab.findMany({ where, orderBy: { lemma: 'asc' }, include: { dictMeta: { select: { examples: true, ipa: true, ipaKo: true, audioUrl: true } } } });
//         if (vocabs.length === 0) return ok(res, []);
//         const items = vocabs.map(v => {
//             const meanings = Array.isArray(v.dictMeta?.examples) ? v.dictMeta.examples : [];
//             let primaryGloss = null;
//             if (meanings.length > 0 && meanings[0].definitions && meanings[0].definitions.length > 0) {
//                 primaryGloss = meanings[0].definitions[0].ko_def || null;
//             }
//             return { id: v.id, lemma: v.lemma, pos: v.pos, levelCEFR: v.levelCEFR, ko_gloss: primaryGloss, ipa: v.dictMeta?.ipa || null, ipaKo: v.dictMeta?.ipaKo || null, audio: v.dictMeta?.audioUrl || null };
//         });
//         return ok(res, items);
//     } catch (e) {
//         console.error('GET /vocab/list failed:', e);
//         return fail(res, 500, 'list query failed');
//     }
// });
// app.get('/vocab/:id', requireAuth, async (req, res) => {
//     const vocabId = Number(req.params.id);
//     if (!vocabId || !Number.isFinite(vocabId)) return fail(res, 400, 'Invalid vocab ID');
//     try {
//         const vocab = await prisma.vocab.findUnique({ where: { id: vocabId }, include: { dictMeta: true } });
//         if (!vocab) return fail(res, 404, '단어를 찾을 수 없습니다.');
//         const examples = Array.isArray(vocab.dictMeta?.examples) ? vocab.dictMeta.examples : [];
//         const glossEntry = examples.find(ex => ex && ex.kind === 'gloss');
//         const responseData = { ...vocab, definition: glossEntry?.de || null };
//         return ok(res, responseData);
//     } catch (e) {
//         console.error(e);
//         return fail(res, 500, '상세 정보를 불러오는 데 실패했습니다.');
//     }
// });
// app.post('/vocab/:id/enrich', requireAuth, async (req, res) => {
//     const vocabId = Number(req.params.id);
//     if (!vocabId) return fail(res, 400, 'Invalid vocabId');
//     try {
//         const vocab = await prisma.vocab.findUnique({ where: { id: vocabId } });
//         if (!vocab) return fail(res, 404, 'Vocab not found');
//         await enrichFromWiktionary(vocab.lemma);
//         const updatedVocab = await prisma.vocab.findUnique({ where: { id: vocabId }, include: { dictMeta: true } });
//         const gloss = Array.isArray(updatedVocab.dictMeta?.examples) ? updatedVocab.dictMeta.examples.find(ex => ex && ex.kind === 'gloss')?.ko : null;
//         const result = { id: updatedVocab.id, lemma: updatedVocab.lemma, levelCEFR: updatedVocab.levelCEFR, ko_gloss: gloss || null, ipa: updatedVocab.dictMeta?.ipa || null, ipaKo: updatedVocab.dictMeta?.ipaKo || null, audio: updatedVocab.dictMeta?.audioLocal || updatedVocab.dictMeta?.audioUrl || null };
//         return ok(res, result);
//     } catch (e) {
//         console.error(`Failed to enrich vocabId ${vocabId}:`, e);
//         return fail(res, 500, 'Enrichment failed');
//     }
// });
// app.post('/vocab/:id/bookmark', requireAuth, async (req, res) => {
//     const vid = Number(req.params.id);
//     const vocab = await prisma.vocab.findUnique({ where: { id: vid } });
//     if (!vocab) return fail(res, 404, 'vocab not found');
//     const existing = await prisma.sRSCard.findFirst({ where: { userId: req.user.id, itemType: 'vocab', itemId: vid } });
//     if (existing) return ok(res, existing);
//     const card = await prisma.sRSCard.create({ data: { userId: req.user.id, itemType: 'vocab', itemId: vid, stage: 0, nextReviewAt: new Date(), lastResult: null } });
//     return ok(res, card, { created: true });
// });
// app.delete('/vocab/:id', requireAuth, requireAdmin, async (req, res) => {
//     const id = Number(req.params.id);
//     if (!Number.isFinite(id)) return fail(res, 400, 'Invalid ID');
//     try {
//         await prisma.$transaction(async (tx) => {
//             await tx.userVocab.deleteMany({ where: { vocabId: id } });
//             await tx.sRSCard.deleteMany({ where: { itemType: 'vocab', itemId: id } });
//             await tx.dictEntry.deleteMany({ where: { vocabId: id } });
//             await tx.vocab.delete({ where: { id } });
//         });
//         return ok(res, { message: `Vocab ID ${id} and all related data deleted successfully.` });
//     } catch (e) {
//         if (e.code === 'P2025') return fail(res, 404, 'Vocab not found');
//         console.error(`DELETE /vocab/${id} failed:`, e);
//         return fail(res, 500, 'Internal Server Error');
//     }
// });

// // --- SRS --- (생략, 변경 없음)
// app.post('/srs/replace-deck', requireAuth, async (req, res) => {
//     const { vocabIds } = req.body;
//     if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
//         return fail(res, 400, 'vocabIds must be a non-empty array');
//     }
//     const userId = req.user.id;
//     const uniqueVocabIds = [...new Set(vocabIds.map(Number).filter(Boolean))];
//     try {
//         await prisma.$transaction(async (tx) => {
//             await tx.sRSCard.deleteMany({ where: { userId: userId, itemType: 'vocab' } });
//             const dataToCreate = uniqueVocabIds.map(id => ({ userId: userId, itemType: 'vocab', itemId: id, stage: 0, nextReviewAt: new Date() }));
//             if (dataToCreate.length > 0) {
//                 await tx.sRSCard.createMany({ data: dataToCreate });
//             }
//         });
//         return ok(res, { message: `Successfully replaced SRS deck with ${uniqueVocabIds.length} cards.` });
//     } catch (e) {
//         console.error('POST /srs/replace-deck failed:', e);
//         return fail(res, 500, 'Internal Server Error');
//     }
// });
// app.get('/srs/all-cards', requireAuth, async (req, res) => {
//     try {
//         const now = new Date();
//         const cards = await prisma.sRSCard.findMany({
//             where: {
//                 userId: req.user.id, itemType: 'vocab', active: true,
//                 nextReviewAt: { lte: now }
//             }
//         });
//         if (cards.length === 0) return ok(res, []);
//         const vocabIds = cards.map(card => card.itemId);
//         const vocabs = await prisma.vocab.findMany({ where: { id: { in: vocabIds } }, include: { dictMeta: true } });
//         const vocabMap = new Map(vocabs.map(v => [v.id, v]));
//         const result = cards.map(card => {
//             const vocab = vocabMap.get(card.itemId);
//             if (!vocab) return null;
//             const gloss = Array.isArray(vocab.dictMeta?.examples) ? vocab.dictMeta.examples.find(ex => ex && ex.kind === 'gloss')?.ko : null;
//             return { cardId: card.id, vocabId: card.itemId, lemma: vocab.lemma || 'N/A', ko_gloss: gloss, nextReviewAt: card.nextReviewAt, stage: card.stage, ipa: vocab.dictMeta?.ipa, ipaKo: vocab.dictMeta?.ipaKo };
//         }).filter(Boolean);
//         return ok(res, result);
//     } catch (e) {
//         console.error('GET /srs/all-cards Error:', e);
//         return fail(res, 500, 'Internal Server Error');
//     }
// });
// // server/server.js

// // (다른 코드는 그대로 두시고, 이 부분만 교체합니다)

// app.get('/srs/queue', requireAuth, async (req, res) => {
//     try {
//         const limit = Math.min(Number(req.query.limit || 20), 100);
//         const now = new Date();
//         const cards = await prisma.sRSCard.findMany({
//             where: {
//                 userId: req.user.id, itemType: 'vocab', active: true,
//                 nextReviewAt: { lte: now }
//             },
//             orderBy: { nextReviewAt: 'asc' },
//             take: limit,
//             select: { itemId: true },
//         });

//         if (cards.length === 0) return ok(res, []);

//         const vocabIds = cards.map(c => c.itemId);
//         const queue = await generateMcqQuizItems(prisma, req.user.id, vocabIds);
//         return ok(res, queue);
//     } catch (e) {
//         console.error('SRS Queue 생성 오류:', e);
//         return fail(res, 500, 'Internal Server Error');
//     }
// });
// app.post('/srs/remove-many', requireAuth, async (req, res) => {
//     try {
//         const { vocabIds } = req.body || {};
//         if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
//             return fail(res, 400, 'vocabIds must be a non-empty array');
//         }
//         const ids = vocabIds.map(Number).filter(Number.isFinite);
//         const result = await prisma.sRSCard.deleteMany({ where: { userId: req.user.id, itemType: 'vocab', itemId: { in: ids } } });
//         return ok(res, { count: result.count });
//     } catch (e) {
//         console.error('POST /srs/remove-many failed:', e);
//         return fail(res, 500, 'Internal Server Error');
//     }
// });

// // --- Quiz by Vocab ---
// app.post('/quiz/by-vocab', requireAuth, async (req, res) => {
//     try {
//         const { vocabIds } = req.body || {};
//         const items = await generateMcqQuizItems(prisma, req.user.id, vocabIds);
//         return ok(res, items);
//     } catch (e) {
//         console.error('POST /quiz/by-vocab 오류:', e);
//         return fail(res, 500, 'Internal Server Error');
//     }
// });

// // --- OdatNote & other routes --- (생략, 변경 없음)
// // server/server.js

// // server/server.js

// app.post('/srs/answer', requireAuth, async (req, res) => {
//     const { cardId, result, source } = req.body || {};
//     if (!cardId || !['pass', 'fail'].includes(result)) return fail(res, 400, 'invalid payload');

//     try {
//         const card = await prisma.sRSCard.findFirst({
//             where: { id: Number(cardId), userId: req.user.id },
//         });

//         if (!card) {
//             return fail(res, 404, 'card not found');
//         }

//         if (result === 'pass') {
//             // ★★★ 시작: 올바른 작업 순서로 수정 ★★★
//             // 1. 먼저 필요한 업데이트를 수행합니다. (현재는 오답노트 카운트 초기화)
//             if (source === 'odatNote') {
//                 // 이 로직은 이제 삭제와 별개로 안전하게 실행됩니다.
//                 await prisma.sRSCard.update({
//                     where: { id: card.id },
//                     data: { incorrectCount: 0 }
//                 });
//             }

//             // 2. 모든 작업이 끝난 후, 마지막에 카드를 삭제합니다.
//             await prisma.sRSCard.delete({ where: { id: card.id } });

//             return ok(res, { message: 'Card completed and removed.' });
//             // ★★★ 종료 ★★★

//         } else { // 오답일 경우
//             const { newStage, nextReviewAt } = scheduleNext(card.stage, result);
//             const updated =  // 틀렸으면 오답노트용으로 남기되 SRS에서 빠지도록 active=false
//                 await prisma.sRSCard.update({
//                     where: { id: card.id },
//                     data: { active: false, incorrectCount: { increment: 1 } }
//                 });
//             return ok(res, updated);
//         }
//     } catch (e) {
//         // 'card not found' 오류는 Prisma의 delete/update 작업이 실패했을 때 발생할 수 있습니다.
//         if (e.code === 'P2025') {
//             return fail(res, 404, 'card not found');
//         }
//         console.error('[/srs/answer] Error:', e);
//         return fail(res, 500, 'Internal Server Error');
//     }
// });
// // server/server.js

// // 기존 app.post('/srs/create-many', ...) 부분을 삭제하고 아래 코드로 대체합니다.

// // server/server.js

// // 기존 app.post('/srs/create-many', ...) 부분을 삭제하고 아래 코드로 대체합니다.

// app.post('/srs/create-many', requireAuth, async (req, res) => {
//     const { vocabIds } = req.body;
//     if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
//         return fail(res, 400, 'vocabIds must be a non-empty array');
//     }

//     const userId = req.user.id;
//     let createdCount = 0;

//     console.log(`[SRS Create] User #${userId} requested to add ${vocabIds.length} vocabs:`, vocabIds);

//     try {
//         for (const id of vocabIds) {
//             const vocabId = Number(id);
//             if (!Number.isFinite(vocabId)) {
//                 console.warn(`[SRS Create] Invalid vocabId skipped: ${id}`);
//                 continue;
//             }

//             await prisma.sRSCard.upsert({
//                 where: {
//                     userId_itemId_itemType: {
//                         userId: userId,
//                         itemId: vocabId,
//                         itemType: 'vocab',
//                     }
//                 },
//                 update: {},
//                 create: {
//                     userId: userId,
//                     itemType: 'vocab',
//                     itemId: vocabId,
//                     stage: 0,
//                     // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
//                     // ★ new Date() 대신 new Date(0)으로 변경하여 시간 문제를 원천 차단 ★
//                     // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
//                     nextReviewAt: new Date(0), // 1970-01-01 00:00:00 UTC
//                     lastResult: null,
//                 }
//             });
//             createdCount++;
//         }

//         console.log(`[SRS Create] Finished. Total processed: ${createdCount}`);
//         return ok(res, { count: createdCount });

//     } catch (e) {
//         console.error('[SRS Create] CRITICAL ERROR during upsert loop:', e);
//         return fail(res, 500, 'Internal Server Error during SRS card creation');
//     }
// });
// app.get('/odat-note/queue', requireAuth, async (req, res) => {
//     try {
//         const limit = Math.min(Number(req.query.limit || 20), 100);
//         const incorrectCards = await prisma.sRSCard.findMany({ where: { userId: req.user.id, itemType: 'vocab', incorrectCount: { gt: 0 } }, orderBy: { updatedAt: 'asc' }, take: limit, select: { id: true, itemId: true } });
//         if (incorrectCards.length === 0) return ok(res, []);
//         const ids = incorrectCards.map(c => c.itemId);
//         const vocabs = await prisma.vocab.findMany({ where: { id: { in: ids } }, include: { dictMeta: true } });
//         const vocabMap = new Map(vocabs.map(v => [v.id, v]));
//         const distractorPool = await prisma.vocab.findMany({ where: { id: { notIn: ids }, dictMeta: { isNot: null } }, include: { dictMeta: true }, take: 300 });
//         const poolGlosses = distractorPool.map(d => d.dictMeta?.examples?.find(ex => ex && ex.kind === 'gloss')?.ko).filter(Boolean);
//         const quizQueue = [];
//         for (const card of incorrectCards) {
//             const vocab = vocabMap.get(card.itemId);
//             if (!vocab) continue;
//             const correct = vocab.dictMeta?.examples?.find(ex => ex && ex.kind === 'gloss')?.ko;
//             if (!correct) continue;
//             const wrong = [];
//             const tried = new Set();
//             while (wrong.length < 3 && tried.size < poolGlosses.length) {
//                 const idx = Math.floor(Math.random() * poolGlosses.length);
//                 tried.add(idx);
//                 const cand = poolGlosses[idx];
//                 if (cand && cand !== correct && !wrong.includes(cand)) wrong.push(cand);
//             }
//             if (wrong.length < 3) continue;
//             const options = [correct, ...wrong].sort(() => Math.random() - 0.5);
//             quizQueue.push({ cardId: card.id, vocabId: vocab.id, question: vocab.lemma, answer: correct, quizType: 'mcq', options, pron: buildPron(vocab) });
//         }
//         return ok(res, quizQueue);
//     } catch (e) {
//         console.error('오답 노트 생성 중 오류:', e);
//         return fail(res, 500, 'Internal Server Error');
//     }
// });
// app.get('/odat-note/list', requireAuth, async (req, res) => {
//     try {
//         const cards = await prisma.sRSCard.findMany({ where: { userId: req.user.id, itemType: 'vocab', incorrectCount: { gt: 0 } }, orderBy: { updatedAt: 'asc' }, select: { id: true, itemId: true, incorrectCount: true, updatedAt: true } });
//         if (cards.length === 0) return ok(res, []);
//         const ids = cards.map(c => c.itemId);
//         const vocabs = await prisma.vocab.findMany({ where: { id: { in: ids } }, include: { dictMeta: true } });
//         const vmap = new Map(vocabs.map(v => [v.id, v]));
//         const rows = cards.map(c => {
//             const v = vmap.get(c.itemId);

//             /* ── 1. ko_gloss / koGloss 컬럼 ── */
//             let gloss =
//                 v?.ko_gloss      // snake_case
//                 ?? v?.koGloss       // camelCase
//                 ?? null;

//             /* ── 2. dictMeta.examples 의 gloss 항목 ── */
//             if (!gloss && Array.isArray(v?.dictMeta?.examples)) {
//                 const g = v.dictMeta.examples.find(ex => ex?.kind === 'gloss' && ex.ko);
//                 if (g) gloss = g.ko;
//             }

//             /* ── 3. 가장 첫 definitions[0].ko_def (VocabList 와 동일) ── */
//             if (!gloss && Array.isArray(v?.dictMeta?.examples)) {
//                 const first = v.dictMeta.examples[0];
//                 if (first?.definitions?.length) {
//                     gloss = first.definitions[0].ko_def || null;
//                 }
//             }

//             return {
//                 cardId: c.id,
//                 vocabId: c.itemId,
//                 lemma: v?.lemma || '',
//                 levelCEFR: v?.levelCEFR || '',
//                 pos: v?.pos || '',
//                 ko_gloss: gloss,                // ← 이제 반드시 값이 생깁니다
//                 incorrectCount: c.incorrectCount,
//                 updatedAt: c.updatedAt,
//                 ipa: v?.dictMeta?.ipa || null,
//                 ipaKo: v?.dictMeta?.ipaKo || null
//             };
//         }).filter(r => r.lemma);
//         return ok(res, rows);
//     } catch (e) {
//         console.error('GET /odat-note/list failed:', e);
//         return fail(res, 500, 'Internal Server Error');
//     }
// });
// app.post('/odat-note/quiz', requireAuth, async (req, res) => {
//     try {
//         const { cardIds } = req.body || {};
//         if (!Array.isArray(cardIds) || cardIds.length === 0) {
//             return ok(res, []);
//         }

//         const cards = await prisma.sRSCard.findMany({
//             where: {
//                 userId: req.user.id,
//                 id: { in: cardIds.map(Number) }
//             },
//             select: { itemId: true }
//         });

//         const vocabIds = cards.map(c => c.itemId);
//         const quizQueue = await generateMcqQuizItems(prisma, req.user.id, vocabIds);
//         return ok(res, quizQueue);
//     } catch (e) {
//         console.error('POST /odat-note/quiz failed:', e);
//         return fail(res, 500, 'Internal Server Error');
//     }
// });
// app.post('/odat-note/resolve-many', requireAuth, async (req, res) => {
//     try {
//         const { cardIds } = req.body || {};
//         if (!Array.isArray(cardIds) || cardIds.length === 0) {
//             return fail(res, 400, 'cardIds must be a non-empty array');
//         }
//         const result = await prisma.sRSCard.updateMany({ where: { userId: req.user.id, id: { in: cardIds.map(Number).filter(Number.isFinite) } }, data: { incorrectCount: 0, lastResult: 'pass' } });
//         return ok(res, { count: result.count });
//     } catch (e) {
//         console.error('POST /odat-note/resolve-many failed:', e);
//         return fail(res, 500, 'Internal Server Error');
//     }
// });

// // --- My Wordbook & Categories --- (생략, 변경 없음)
// app.get('/my-wordbook', requireAuth, async (req, res) => {
//     const q = req.query.categoryId;
//     const where = { userId: req.user.id };
//     if (q === 'none') {
//         where.categoryId = null;
//     } else if (q !== undefined && q !== '') {
//         const cid = Number(q);
//         if (!Number.isFinite(cid)) return fail(res, 400, 'invalid categoryId');
//         where.categoryId = cid;
//     }
//     const rows = await prisma.userVocab.findMany({ where, include: { vocab: { include: { dictMeta: { select: { ipa: true, ipaKo: true, examples: true, audioUrl: true } } } } }, orderBy: { createdAt: 'desc' } });
//     const processedRows = rows.map(row => {
//         if (!row.vocab) return row;
//         const meanings = Array.isArray(row.vocab.dictMeta?.examples) ? row.vocab.dictMeta.examples : [];
//         let primaryGloss = null;
//         if (meanings.length > 0 && meanings[0].definitions && meanings[0].definitions.length > 0) {
//             primaryGloss = meanings[0].definitions[0].ko_def || null;
//         }
//         return { ...row, vocab: { ...row.vocab, ko_gloss: primaryGloss } };
//     });
//     return ok(res, processedRows);
// });
// app.post('/my-wordbook/add', requireAuth, async (req, res) => {
//     const { vocabId } = req.body;
//     if (!vocabId) return fail(res, 400, 'vocabId is required');
//     const existing = await prisma.userVocab.findUnique({ where: { userId_vocabId: { userId: req.user.id, vocabId: Number(vocabId) } } });
//     if (existing) return ok(res, existing);
//     const newItem = await prisma.userVocab.create({ data: { userId: req.user.id, vocabId: Number(vocabId) } });
//     return ok(res, newItem, { created: true });
// });
// app.post('/my-wordbook/add-many', requireAuth, async (req, res) => {
//     const { vocabIds } = req.body;
//     if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
//         return fail(res, 400, 'vocabIds must be a non-empty array');
//     }
//     const userId = req.user.id;
//     const dataToCreate = vocabIds.map(id => ({ userId, vocabId: Number(id) }));
//     const existingEntries = await prisma.userVocab.findMany({ where: { userId, vocabId: { in: vocabIds.map(Number) } }, select: { vocabId: true } });
//     const existingVocabIds = new Set(existingEntries.map(e => e.vocabId));
//     const newEntries = dataToCreate.filter(d => !existingVocabIds.has(d.vocabId));
//     let newCount = 0;
//     if (newEntries.length > 0) {
//         const result = await prisma.userVocab.createMany({ data: newEntries });
//         newCount = result.count;
//     }
//     return ok(res, { count: newCount });
// });
// app.post('/my-wordbook/remove-many', requireAuth, async (req, res) => {
//     const { vocabIds } = req.body || {};
//     if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
//         return fail(res, 400, 'vocabIds must be a non-empty array');
//     }
//     const ids = vocabIds.map(Number).filter(Number.isFinite);
//     const result = await prisma.userVocab.deleteMany({ where: { userId: req.user.id, vocabId: { in: ids } } });
//     return ok(res, { count: result.count });
// });
// app.patch('/my-wordbook/assign', requireAuth, async (req, res) => {
//     const { vocabIds, categoryId } = req.body || {};
//     if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
//         return fail(res, 400, 'vocabIds required');
//     }
//     let cid = null;
//     if (categoryId !== undefined && categoryId !== null && categoryId !== '' && categoryId !== 'none') {
//         cid = Number(categoryId);
//         if (!Number.isFinite(cid)) return fail(res, 400, 'invalid categoryId');
//     }
//     const result = await prisma.userVocab.updateMany({ where: { userId: req.user.id, vocabId: { in: vocabIds.map(Number) } }, data: { categoryId: cid } });
//     return ok(res, { updated: result.count });
// });
// app.get('/categories', requireAuth, async (req, res) => {
//     const cats = await prisma.category.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'asc' } });
//     const totals = await prisma.userVocab.groupBy({ by: ['categoryId'], where: { userId: req.user.id }, _count: { _all: true } });
//     const countMap = new Map(totals.map(t => [t.categoryId ?? 0, t._count._all]));
//     const data = cats.map(c => ({ ...c, count: countMap.get(c.id) || 0 }));
//     const uncategorized = countMap.get(0) || 0;
//     return ok(res, { categories: data, uncategorized });
// });
// app.post('/categories', requireAuth, async (req, res) => {
//     const name = String(req.body?.name || '').trim();
//     if (!name) return fail(res, 400, 'name required');
//     const c = await prisma.category.create({ data: { userId: req.user.id, name } });
//     return ok(res, c);
// });

// // ===== Global error handler =====
// app.use((err, req, res, next) => {
//     console.error(err);
//     return fail(res, 500, 'internal error');
// });

// app.listen(PORT, () => {
//     console.log(`API http://localhost:${PORT}`)
// });