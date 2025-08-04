// server/server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('node:path');
const fs = require('node:fs/promises');
const { prisma } = require('./db/prisma');
const { ok, fail } = require('./lib/resp');
const {
    parseWikitext,
    fetchWiktionaryWikitext,
    fetchCommonsFileUrl,
    findEnglishTranslation, 
} = require('./integrations/wiktionary');

const app = express();

// ===== Config =====
const PORT = 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
const COOKIE_NAME = 'token';
const SLIDING_MINUTES = 15;
const AUDIO_DIR = path.join(__dirname, 'static', 'audio');

// ===== Middlewares =====
app.use((req, res, next) => { console.log('>>>', req.method, req.url); next(); });
app.use(cookieParser());
app.use(express.json());
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use('/static', express.static(path.join(__dirname, 'static')));
app.get('/__ping', (req, res) => res.type('text').send('pong'));

// ===== Helpers (하나의 섹션으로 통합 및 정리) =====

function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: `${SLIDING_MINUTES}m` });
}

function setAuthCookie(res, token) {
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: SLIDING_MINUTES * 60 * 1000,
    });
}

function clearAuthCookie(res) {
    res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: false });
}

async function requireAuth(req, res, next) {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return fail(res, 401, 'Unauthorized');
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        setAuthCookie(res, signToken({ id: decoded.id, email: decoded.email, role: decoded.role || 'USER' }));
        next();
    } catch {
        return fail(res, 401, 'Unauthorized');
    }
}

function requireAdmin(req, res, next) {
    if (!req.user) return fail(res, 401, 'Unauthorized');
    if (req.user.role !== 'admin') return fail(res, 403, 'Forbidden');
    return next();
}

function buildPron(vocab) {
    if (!vocab || !vocab.dictMeta) return { ipa: null, ipaKo: null };
    return { ipa: vocab.dictMeta.ipa || null, ipaKo: vocab.dictMeta.ipaKo || null };
}

function scheduleNext(stage = 0, result) {
    const intervals = [1, 3, 7, 16, 35];
    let newStage = stage;
    if (result === 'pass') newStage = Math.min(newStage + 1, intervals.length - 1);
    else if (result === 'fail') newStage = Math.max(newStage - 1, 0);
    const days = intervals[newStage];
    const nextReviewAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return { newStage, nextReviewAt };
}

const titlecaseFirst = (s = '') => (s ? s[0].toUpperCase() + s.slice(1) : s);

async function ensureDir(p) { await fs.mkdir(p, { recursive: true }); }

async function downloadToFile(url, filepath) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await ensureDir(path.dirname(filepath));
    await fs.writeFile(filepath, buf);
}

// KRDict API 호출 (안정성 강화)
// server.js 파일의 수정될 부분



// 데이터 보강 로직 (Wiktionary 의존성 제거)
async function enrichFromWiktionary(queryLemma) {
    try {
        const wikitext = await fetchWiktionaryWikitext(queryLemma);
        if (!wikitext) {
            console.log(`[Enrich] No wikitext found for "${queryLemma}"`);
            return;
        }

        const parsed = parseWikitext(wikitext);
        const { ipa, audioTitles, koreanMeaning, examples } = parsed;

        if (!koreanMeaning) {
            console.log(`[Enrich] Korean meaning not found in Wiktionary for "${queryLemma}"`);
            return;
        }

        // ▼▼▼ 오디오 처리 로직 수정 ▼▼▼
        let finalAudioUrl = null; // 최종 오디오 URL을 저장할 변수

        if (audioTitles.length > 0) {
            const firstAudioTitle = audioTitles[0];
            // 파일명을 가지고 Wikimedia Commons에서 실제 파일 URL을 조회합니다.
            // 이 함수는 다운로드 없이 URL만 가져옵니다.
            finalAudioUrl = await fetchCommonsFileUrl(firstAudioTitle);
        }
        // ▲▲▲ 오디오 처리 로직 수정 ▲▲▲

        const finalExamples = [
            { de: '', ko: koreanMeaning, kind: 'gloss', source: 'wiktionary' },
            ...examples,
        ];

        const vocab = await prisma.vocab.upsert({
            where: { lemma: titlecaseFirst(queryLemma) },
            update: {},
            create: { lemma: titlecaseFirst(queryLemma), pos: 'UNK', levelCEFR: 'UNSET', source: 'wiktionary' }
        });

        await prisma.dictEntry.upsert({
            where: { vocabId: vocab.id },
            create: {
                vocabId: vocab.id,
                ipa,
                audioUrl: finalAudioUrl,
                audioLocal: null,
                examples: finalExamples,
                license: 'CC-BY-SA',
                // ▼▼▼ 출처 수정 ▼▼▼
                attribution: 'Korean Wiktionary',
            },
            update: {
                ipa: ipa || undefined,
                audioUrl: finalAudioUrl,
                audioLocal: null,
                examples: finalExamples,
                // ▼▼▼ 출처 수정 ▼▼▼
                attribution: 'Korean Wiktionary',
            }
        });
        console.log(`[Enrich] Enriched "${queryLemma}" from Wiktionary successfully.`);
    } catch (error) {
        console.error(`[Enrich] CRITICAL ERROR during Wiktionary enrichment for "${queryLemma}":`, error);
    }
}
// ===== API Routes =====

// --- Auth ---
app.post('/auth/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return fail(res, 400, 'Email and password are required');
    try {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) return fail(res, 409, 'User with this email already exists');
        const passwordHash = await bcrypt.hash(password, 10);
        const userRole = email === 'super@naver.com' ? 'admin' : 'USER';
        const user = await prisma.user.create({ data: { email, passwordHash, role: userRole } });
        setAuthCookie(res, signToken({ id: user.id, email: user.email, role: user.role }));
        const { passwordHash: _, ...userSafe } = user;
        return ok(res, userSafe);
    } catch (e) {
        console.error('POST /auth/register failed:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});

app.post('/auth/login', async (req, res) => {
    let { email, password } = req.body || {};
    if (!email || !password) return fail(res, 400, 'email and password required');
    email = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return fail(res, 401, 'invalid credentials');
    const okPw = await bcrypt.compare(password, user.passwordHash);
    if (!okPw) return fail(res, 401, 'invalid credentials');
    setAuthCookie(res, signToken({ id: user.id, email: user.email, role: user.role }));
    return ok(res, { id: user.id, email: user.email, role: user.role, profile: user.profile });
});

app.post('/auth/logout', (req, res) => {
    clearAuthCookie(res);
    return ok(res, { ok: true });
});

app.get('/me', requireAuth, async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, email: true, role: true, profile: true }
    });
    if (!user) return fail(res, 401, 'Unauthorized');
    return ok(res, user);
});

app.patch('/me', requireAuth, async (req, res) => {
    const payload = req.body?.profile || req.body || {};
    const { level, tone, address } = payload;
    const ALLOWED_LEVEL = ['A1', 'A2', 'B1', 'B2', 'C1'];
    const ALLOWED_TONE = ['formal', 'friendly'];
    const ALLOWED_ADDRESS = ['du', 'Sie'];
    if (level && !ALLOWED_LEVEL.includes(level)) return fail(res, 422, 'invalid level');
    if (tone && !ALLOWED_TONE.includes(tone)) return fail(res, 422, 'invalid tone');
    if (address && !ALLOWED_ADDRESS.includes(address)) return fail(res, 422, 'invalid address');
    const user = await prisma.user.update({
        where: { id: req.user.id },
        data: { profile: { ...(payload || {}) } },
        select: { id: true, email: true, role: true, profile: true }
    });
    return ok(res, user);
});

// --- Vocab / Dict ---
// server.js 파일의 app.get('/dict/search', ...) 부분을 아래 코드로 교체합니다.

app.get('/dict/search', async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        if (!q) return ok(res, { entries: [] });

        const isKoreanQuery = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(q);
        let hits = [];

        if (isKoreanQuery) {
            const allEntries = await prisma.dictEntry.findMany({
                include: { Vocab: true }
            });

            for (const entry of allEntries) {
                const glossExample = Array.isArray(entry.examples) ? entry.examples.find(ex => ex.kind === 'gloss') : null;
                if (glossExample && glossExample.ko && glossExample.ko.includes(q)) {
                    if (entry.Vocab) {
                        hits.push({ ...entry.Vocab, dictMeta: entry });
                    }
                    if (hits.length >= 5) break;
                }
            }
        } else {
            // ★★★★★ 수정된 부분 ★★★★★
            const queryDB = () => prisma.vocab.findMany({
                where: {
                    lemma: {
                        contains: q,
                        // 'mode: "insensitive"' 옵션을 완전히 삭제
                    }
                },
                take: 5,
                include: { dictMeta: true }
            });
            // ★★★★★ 수정 끝 ★★★★★
            
            hits = await queryDB();
            
            const lacksKo = (v) => !v.dictMeta?.examples?.some(ex => ex && ex.kind === 'gloss' && ex.ko);
            if (hits.length === 0 || hits.every(lacksKo)) {
                await enrichFromWiktionary(q);
                hits = await queryDB();
            }
        }

        const entries = hits.map(v => ({
            id: v.id,
            lemma: v.lemma,
            pos: v.pos,
            ipa: v.dictMeta?.ipa || null,
            audio: v.dictMeta?.audioUrl || null,
            license: v.dictMeta?.license || null,
            attribution: v.dictMeta?.attribution || null,
            examples: Array.isArray(v.dictMeta?.examples) ? v.dictMeta.examples : []
        }));

        return ok(res, { entries });

    } catch (error) {
        console.error(`[ERROR] /dict/search?q=${req.query.q} failed:`, error);
        return fail(res, 500, 'Internal Server Error');
    }
});
app.get('/vocab/list', async (req, res) => {
    try {
        const { level } = req.query; // activeLevel을 쿼리 파라미터로 받습니다.
        const sourceMap = {
            'A1': 'seed-ielts-api',
            'B2': 'seed-wiktionary',
        };
        const source = sourceMap[level] || 'seed-ielts-api'; // 기본값 설정

        const vocabs = await prisma.vocab.findMany({
            where: { source: source },
            orderBy: { lemma: 'asc' },
            include: {
                dictMeta: {
                    select: { examples: true, ipa: true, ipaKo: true, audioUrl: true }
                }
            },
        });

        if (vocabs.length === 0) return ok(res, []);

        const items = vocabs.map(v => {
            const gloss = Array.isArray(v.dictMeta?.examples)
                ? v.dictMeta.examples.find(ex => ex && ex.kind === 'gloss')?.ko
                : null;
            return {
                id: v.id,
                lemma: v.lemma,
                levelCEFR: v.levelCEFR,
                ko_gloss: gloss || null,
                ipa: v.dictMeta?.ipa || null,
                ipaKo: v.dictMeta?.ipaKo || null,
                audio: v.dictMeta?.audioUrl || null,
            };
        });
        return ok(res, items);
    } catch (e) {
        console.error('GET /vocab/list failed:', e);
        return fail(res, 500, 'list query failed');
    }
});

app.get('/vocab/:id', requireAuth, async (req, res) => {
    const vocabId = Number(req.params.id);
    if (!vocabId || !Number.isFinite(vocabId)) return fail(res, 400, 'Invalid vocab ID');
    try {
        const vocab = await prisma.vocab.findUnique({
            where: { id: vocabId },
            include: { dictMeta: true },
        });
        if (!vocab) return fail(res, 404, '단어를 찾을 수 없습니다.');
        return ok(res, vocab);
    } catch (e) {
        console.error(e);
        return fail(res, 500, '상세 정보를 불러오는 데 실패했습니다.');
    }
});

app.post('/vocab/:id/enrich', requireAuth, async (req, res) => {
    const vocabId = Number(req.params.id);
    if (!vocabId) return fail(res, 400, 'Invalid vocabId');
    try {
        const vocab = await prisma.vocab.findUnique({ where: { id: vocabId } });
        if (!vocab) return fail(res, 404, 'Vocab not found');
        await enrichFromWiktionary(vocab.lemma);
        const updatedVocab = await prisma.vocab.findUnique({
            where: { id: vocabId },
            include: { dictMeta: true },
        });
        const gloss = Array.isArray(updatedVocab.dictMeta?.examples)
            ? updatedVocab.dictMeta.examples.find(ex => ex && ex.kind === 'gloss')?.ko
            : null;
        const result = {
            id: updatedVocab.id,
            lemma: updatedVocab.lemma,
            levelCEFR: updatedVocab.levelCEFR,
            ko_gloss: gloss || null,
            ipa: updatedVocab.dictMeta?.ipa || null,
            ipaKo: updatedVocab.dictMeta?.ipaKo || null,
            audio: updatedVocab.dictMeta?.audioLocal || updatedVocab.dictMeta?.audioUrl || null,
        };
        return ok(res, result);
    } catch (e) {
        console.error(`Failed to enrich vocabId ${vocabId}:`, e);
        return fail(res, 500, 'Enrichment failed');
    }
});

app.post('/vocab/:id/bookmark', requireAuth, async (req, res) => {
    const vid = Number(req.params.id);
    const vocab = await prisma.vocab.findUnique({ where: { id: vid } });
    if (!vocab) return fail(res, 404, 'vocab not found');
    const existing = await prisma.sRSCard.findFirst({
        where: { userId: req.user.id, itemType: 'vocab', itemId: vid }
    });
    if (existing) return ok(res, existing);
    const card = await prisma.sRSCard.create({
        data: { userId: req.user.id, itemType: 'vocab', itemId: vid, stage: 0, nextReviewAt: new Date(), lastResult: null }
    });
    return ok(res, card, { created: true });
});

app.delete('/vocab/:id', requireAuth, requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return fail(res, 400, 'Invalid ID');
    try {
        await prisma.$transaction(async (tx) => {
            await tx.userVocab.deleteMany({ where: { vocabId: id } });
            await tx.sRSCard.deleteMany({ where: { itemType: 'vocab', itemId: id } });
            await tx.dictEntry.deleteMany({ where: { vocabId: id } });
            await tx.vocab.delete({ where: { id } });
        });
        return ok(res, { message: `Vocab ID ${id} and all related data deleted successfully.` });
    } catch (e) {
        if (e.code === 'P2025') return fail(res, 404, 'Vocab not found');
        console.error(`DELETE /vocab/${id} failed:`, e);
        return fail(res, 500, 'Internal Server Error');
    }
});

// --- SRS ---
app.post('/srs/replace-deck', requireAuth, async (req, res) => {
    const { vocabIds } = req.body;
    if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
        return fail(res, 400, 'vocabIds must be a non-empty array');
    }
    const userId = req.user.id;
    const uniqueVocabIds = [...new Set(vocabIds.map(Number).filter(Boolean))];
    try {
        await prisma.$transaction(async (tx) => {
            await tx.sRSCard.deleteMany({
                where: { userId: userId, itemType: 'vocab' },
            });
            const dataToCreate = uniqueVocabIds.map(id => ({
                userId: userId,
                itemType: 'vocab',
                itemId: id,
                stage: 0,
                nextReviewAt: new Date(),
            }));
            if (dataToCreate.length > 0) {
                await tx.sRSCard.createMany({
                    data: dataToCreate,
                });
            }
        });
        return ok(res, { message: `Successfully replaced SRS deck with ${uniqueVocabIds.length} cards.` });
    } catch (e) {
        console.error('POST /srs/replace-deck failed:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});

app.get('/srs/all-cards', requireAuth, async (req, res) => {
    try {
        const cards = await prisma.sRSCard.findMany({
            where: { userId: req.user.id, itemType: 'vocab' },
            orderBy: { createdAt: 'desc' },
        });
        if (cards.length === 0) return ok(res, []);
        const vocabIds = cards.map(card => card.itemId);
        const vocabs = await prisma.vocab.findMany({
            where: { id: { in: vocabIds } },
            include: { dictMeta: true },
        });
        const vocabMap = new Map(vocabs.map(v => [v.id, v]));
        const result = cards
            .map(card => {
                const vocab = vocabMap.get(card.itemId);
                if (!vocab) return null;
                const gloss = Array.isArray(vocab.dictMeta?.examples)
                    ? vocab.dictMeta.examples.find(ex => ex && ex.kind === 'gloss')?.ko
                    : null;
                return {
                    cardId: card.id,
                    vocabId: card.itemId,
                    lemma: vocab.lemma || 'N/A',
                    ko_gloss: gloss,
                    nextReviewAt: card.nextReviewAt,
                    stage: card.stage,
                    ipa: vocab.dictMeta?.ipa,
                    ipaKo: vocab.dictMeta?.ipaKo,
                };
            })
            .filter(Boolean);
        return ok(res, result);
    } catch (e) {
        console.error('GET /srs/all-cards Error:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});

app.get('/srs/queue', requireAuth, async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit || 20), 100);
        const now = new Date();
        const cards = await prisma.sRSCard.findMany({
            where: { userId: req.user.id, itemType: 'vocab', nextReviewAt: { lte: now } },
            orderBy: { nextReviewAt: 'asc' },
            take: limit,
            select: { id: true, itemId: true },
        });
        if (cards.length === 0) return ok(res, []);
        const ids = cards.map(c => c.itemId);
        const vocabs = await prisma.vocab.findMany({
            where: { id: { in: ids } },
            include: { dictMeta: true },
        });
        const vmap = new Map(vocabs.map(v => [v.id, v]));
        const distractorPool = await prisma.vocab.findMany({
            where: { dictMeta: { isNot: null } },
            include: { dictMeta: true },
            take: 1000,
        });
        const poolGlosses = Array.from(new Set(
            distractorPool
                .map(d => d.dictMeta?.examples?.find(ex => ex && ex.kind === 'gloss')?.ko)
                .filter(Boolean)
        ));
        const queue = [];
        for (const c of cards) {
            const v = vmap.get(c.itemId);
            if (!v) continue;
            const correct = v.dictMeta?.examples?.find(ex => ex && ex.kind === 'gloss')?.ko;
            if (!correct) continue;
            const wrong = [];
            const tried = new Set();
            while (wrong.length < 3 && tried.size < poolGlosses.length) {
                const idx = Math.floor(Math.random() * poolGlosses.length);
                tried.add(idx);
                const cand = poolGlosses[idx];
                if (cand && cand !== correct && !wrong.includes(cand)) wrong.push(cand);
            }
            if (wrong.length < 3) continue;
            queue.push({
                cardId: c.id,
                vocabId: v.id,
                question: v.lemma,
                answer: correct,
                quizType: 'mcq',
                options: [correct, ...wrong].sort(() => Math.random() - 0.5),
                pron: buildPron(v),
            });
        }
        return ok(res, queue);
    } catch (e) {
        console.error('SRS Queue 생성 오류:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});

app.post('/srs/remove-many', requireAuth, async (req, res) => {
    try {
        const { vocabIds } = req.body || {};
        if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
            return fail(res, 400, 'vocabIds must be a non-empty array');
        }
        const ids = vocabIds.map(Number).filter(Number.isFinite);
        const result = await prisma.sRSCard.deleteMany({
            where: { userId: req.user.id, itemType: 'vocab', itemId: { in: ids } },
        });
        return ok(res, { count: result.count });
    } catch (e) {
        console.error('POST /srs/remove-many failed:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});

app.post('/quiz/by-vocab', requireAuth, async (req, res) => {
    try {
        const { vocabIds } = req.body || {};
        if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
            return fail(res, 400, 'vocabIds must be a non-empty array');
        }
        const ids = vocabIds.map(Number).filter(Number.isFinite);
        if (ids.length === 0) return ok(res, []);
        const [vocabs, cards] = await Promise.all([
            prisma.vocab.findMany({
                where: { id: { in: ids } },
                include: { dictMeta: true },
            }),
            prisma.sRSCard.findMany({
                where: { userId: req.user.id, itemType: 'vocab', itemId: { in: ids } },
                select: { id: true, itemId: true },
            }),
        ]);
        const cmap = new Map(cards.map(c => [c.itemId, c.id]));
        const distractorPool = await prisma.vocab.findMany({
            where: { id: { notIn: ids }, dictMeta: { isNot: null } },
            include: { dictMeta: true },
            take: 1000,
        });
        const poolGlosses = new Set(
            distractorPool
                .map(d => d.dictMeta?.examples?.find(ex => ex && ex.kind === 'gloss')?.ko)
                .filter(Boolean)
        );
        const selectedGlosses = new Map(
            vocabs.map(v => {
                const g = v.dictMeta?.examples?.find(ex => ex && ex.kind === 'gloss')?.ko || null;
                return [v.id, g];
            })
        );
        const pickN = (arr, n) => {
            const a = arr.slice();
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a.slice(0, n);
        };
        const items = [];
        for (const v of vocabs) {
            const correct = selectedGlosses.get(v.id);
            if (!correct) continue;
            const localWrongSet = new Set(poolGlosses);
            for (const [otherId, g] of selectedGlosses.entries()) {
                if (otherId !== v.id && g && g !== correct) localWrongSet.add(g);
            }
            localWrongSet.delete(correct);
            const wrongs = pickN(Array.from(localWrongSet), 3);
            if (wrongs.length < 3) continue;
            items.push({
                cardId: cmap.get(v.id) || null,
                vocabId: v.id,
                question: v.lemma,
                answer: correct,
                quizType: 'mcq',
                options: pickN([correct, ...wrongs], 4),
                pron: {
                    ipa: v.dictMeta?.ipa || null,
                    ipaKo: v.dictMeta?.ipaKo || null,
                },
            });
        }
        return ok(res, items);
    } catch (e) {
        console.error('POST /quiz/by-vocab 오류:', e && e.stack ? e.stack : e);
        console.error('요청 바디:', req.body);
        return fail(res, 500, 'Internal Server Error');
    }
});

app.post('/srs/answer', requireAuth, async (req, res) => {
    const { cardId, result, source } = req.body || {};
    if (!cardId || !['pass', 'fail'].includes(result)) return fail(res, 400, 'invalid payload');
    const card = await prisma.sRSCard.findFirst({
        where: { id: Number(cardId), userId: req.user.id },
    });
    if (!card) return fail(res, 404, 'card not found');
    const { newStage, nextReviewAt } = scheduleNext(card.stage, result);
    const data = {
        stage: newStage,
        nextReviewAt,
        lastResult: result,
        ...(result === 'pass'
            ? { correctCount: { increment: 1 } }
            : { incorrectCount: { increment: 1 } }),
    };
    if (result === 'pass' && source === 'odatNote') {
        data.incorrectCount = { set: 0 };
    }
    const updated = await prisma.sRSCard.update({ where: { id: card.id }, data });
    return ok(res, updated);
});

app.post('/srs/create-many', requireAuth, async (req, res) => {
    const { vocabIds } = req.body;
    if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
        return fail(res, 400, 'vocabIds must be a non-empty array');
    }
    const dataToCreate = vocabIds.map(id => ({
        userId: req.user.id,
        itemType: 'vocab',
        itemId: Number(id),
        stage: 0,
        nextReviewAt: new Date(),
        lastResult: null,
    }));
    const result = await prisma.sRSCard.createMany({
        data: dataToCreate,
        skipDuplicates: true,
    });
    return ok(res, result);
});


// --- OdatNote ---
app.get('/odat-note/queue', requireAuth, async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit || 20), 100);
        const incorrectCards = await prisma.sRSCard.findMany({
            where: { userId: req.user.id, itemType: 'vocab', incorrectCount: { gt: 0 } },
            orderBy: { updatedAt: 'asc' },
            take: limit,
            select: { id: true, itemId: true },
        });
        if (incorrectCards.length === 0) return ok(res, []);
        const ids = incorrectCards.map(c => c.itemId);
        const vocabs = await prisma.vocab.findMany({
            where: { id: { in: ids } },
            include: { dictMeta: true },
        });
        const vocabMap = new Map(vocabs.map(v => [v.id, v]));
        const distractorPool = await prisma.vocab.findMany({
            where: { id: { notIn: ids }, dictMeta: { isNot: null } },
            include: { dictMeta: true },
            take: 300,
        });
        const poolGlosses = distractorPool
            .map(d => d.dictMeta?.examples?.find(ex => ex && ex.kind === 'gloss')?.ko)
            .filter(Boolean);
        const quizQueue = [];
        for (const card of incorrectCards) {
            const vocab = vocabMap.get(card.itemId);
            if (!vocab) continue;
            const correct = vocab.dictMeta?.examples?.find(ex => ex && ex.kind === 'gloss')?.ko;
            if (!correct) continue;
            const wrong = [];
            const tried = new Set();
            while (wrong.length < 3 && tried.size < poolGlosses.length) {
                const idx = Math.floor(Math.random() * poolGlosses.length);
                tried.add(idx);
                const cand = poolGlosses[idx];
                if (cand && cand !== correct && !wrong.includes(cand)) wrong.push(cand);
            }
            if (wrong.length < 3) continue;
            const options = [correct, ...wrong].sort(() => Math.random() - 0.5);
            quizQueue.push({
                cardId: card.id,
                vocabId: vocab.id,
                question: vocab.lemma,
                answer: correct,
                quizType: 'mcq',
                options,
                pron: buildPron(vocab),
            });
        }
        return ok(res, quizQueue);
    } catch (e) {
        console.error('오답 노트 생성 중 오류:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});

app.get('/odat-note/list', requireAuth, async (req, res) => {
    try {
        const cards = await prisma.sRSCard.findMany({
            where: { userId: req.user.id, itemType: 'vocab', incorrectCount: { gt: 0 } },
            orderBy: { updatedAt: 'asc' },
            select: { id: true, itemId: true, incorrectCount: true, updatedAt: true },
        });
        if (cards.length === 0) return ok(res, []);
        const ids = cards.map(c => c.itemId);
        const vocabs = await prisma.vocab.findMany({
            where: { id: { in: ids } },
            include: { dictMeta: true },
        });
        const vmap = new Map(vocabs.map(v => [v.id, v]));
        const rows = cards.map(c => {
            const v = vmap.get(c.itemId);
            const gloss = Array.isArray(v?.dictMeta?.examples)
                ? v.dictMeta.examples.find(ex => ex && ex.kind === 'gloss')?.ko
                : null;
            return {
                cardId: c.id,
                vocabId: c.itemId,
                lemma: v?.lemma || '',
                ko_gloss: gloss || null,
                incorrectCount: c.incorrectCount,
                updatedAt: c.updatedAt,
                ipa: v?.dictMeta?.ipa || null,
                ipaKo: v?.dictMeta?.ipaKo || null,
            };
        }).filter(r => r.lemma);
        return ok(res, rows);
    } catch (e) {
        console.error('GET /odat-note/list failed:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});

app.post('/odat-note/quiz', requireAuth, async (req, res) => {
    try {
        const { cardIds } = req.body || {};
        if (!Array.isArray(cardIds) || cardIds.length === 0) {
            return fail(res, 400, 'cardIds must be a non-empty array');
        }
        const ids = cardIds.map(Number).filter(Number.isFinite);
        if (ids.length === 0) return ok(res, []);
        const cards = await prisma.sRSCard.findMany({
            where: {
                userId: req.user.id,
                itemType: 'vocab',
                incorrectCount: { gt: 0 },
                id: { in: ids }
            },
            select: { id: true, itemId: true },
            orderBy: { updatedAt: 'asc' },
        });
        if (cards.length === 0) return ok(res, []);
        const vocabIds = cards.map(c => c.itemId);
        const vocabs = await prisma.vocab.findMany({
            where: { id: { in: vocabIds } },
            include: { dictMeta: true },
        });
        const vmap = new Map(vocabs.map(v => [v.id, v]));
        const distractorPool = await prisma.vocab.findMany({
            where: { id: { notIn: vocabIds }, dictMeta: { isNot: null } },
            include: { dictMeta: true },
            take: 300,
        });
        const poolGlosses = distractorPool
            .map(d => d.dictMeta?.examples?.find(ex => ex && ex.kind === 'gloss')?.ko)
            .filter(Boolean);
        const quizQueue = [];
        for (const card of cards) {
            const v = vmap.get(card.itemId);
            if (!v) continue;
            const correct = v.dictMeta?.examples?.find(ex => ex && ex.kind === 'gloss')?.ko;
            if (!correct) continue;
            const wrong = [];
            const tried = new Set();
            while (wrong.length < 3 && tried.size < poolGlosses.length) {
                const idx = Math.floor(Math.random() * poolGlosses.length);
                tried.add(idx);
                const cand = poolGlosses[idx];
                if (cand && cand !== correct && !wrong.includes(cand)) wrong.push(cand);
            }
            if (wrong.length < 3) continue;
            quizQueue.push({
                cardId: card.id,
                vocabId: v.id,
                question: v.lemma,
                answer: correct,
                options: [correct, ...wrong].sort(() => Math.random() - 0.5),
                quizType: 'mcq',
                pron: buildPron(v),
            });
        }
        return ok(res, quizQueue);
    } catch (e) {
        console.error('POST /odat-note/quiz failed:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});

app.post('/odat-note/resolve-many', requireAuth, async (req, res) => {
    try {
        const { cardIds } = req.body || {};
        if (!Array.isArray(cardIds) || cardIds.length === 0) {
            return fail(res, 400, 'cardIds must be a non-empty array');
        }
        const result = await prisma.sRSCard.updateMany({
            where: { userId: req.user.id, id: { in: cardIds.map(Number).filter(Number.isFinite) } },
            data: { incorrectCount: 0, lastResult: 'pass' },
        });
        return ok(res, { count: result.count });
    } catch (e) {
        console.error('POST /odat-note/resolve-many failed:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});

// --- My Wordbook & Categories ---
app.get('/my-wordbook', requireAuth, async (req, res) => {
    const q = req.query.categoryId;
    const where = { userId: req.user.id };
    if (q === 'none') {
        where.categoryId = null;
    } else if (q !== undefined && q !== '') {
        const cid = Number(q);
        if (!Number.isFinite(cid)) return fail(res, 400, 'invalid categoryId');
        where.categoryId = cid;
    }
    const rows = await prisma.userVocab.findMany({
        where,
        include: { vocab: { include: { dictMeta: { select: { ipa: true, ipaKo: true, examples: true, audioUrl: true, audioLocal: true } } } } },
        orderBy: { createdAt: 'desc' },
    });
    return ok(res, rows);
});

app.post('/my-wordbook/add', requireAuth, async (req, res) => {
    const { vocabId } = req.body;
    if (!vocabId) return fail(res, 400, 'vocabId is required');
    const existing = await prisma.userVocab.findUnique({
        where: { userId_vocabId: { userId: req.user.id, vocabId: Number(vocabId) } }
    });
    if (existing) return ok(res, existing);
    const newItem = await prisma.userVocab.create({
        data: {
            userId: req.user.id,
            vocabId: Number(vocabId)
        }
    });
    return ok(res, newItem, { created: true });
});

app.post('/my-wordbook/add-many', requireAuth, async (req, res) => {
    const { vocabIds } = req.body;
    if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
        return fail(res, 400, 'vocabIds must be a non-empty array');
    }
    const userId = req.user.id;
    const dataToCreate = vocabIds.map(id => ({
        userId,
        vocabId: Number(id),
    }));
    const existingEntries = await prisma.userVocab.findMany({
        where: { userId, vocabId: { in: vocabIds.map(Number) } },
        select: { vocabId: true },
    });
    const existingVocabIds = new Set(existingEntries.map(e => e.vocabId));
    const newEntries = dataToCreate.filter(d => !existingVocabIds.has(d.vocabId));
    let newCount = 0;
    if (newEntries.length > 0) {
        const result = await prisma.userVocab.createMany({
            data: newEntries,
        });
        newCount = result.count;
    }
    return ok(res, { count: newCount });
});

app.post('/my-wordbook/remove-many', requireAuth, async (req, res) => {
    const { vocabIds } = req.body || {};
    if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
        return fail(res, 400, 'vocabIds must be a non-empty array');
    }
    const ids = vocabIds.map(Number).filter(Number.isFinite);
    const result = await prisma.userVocab.deleteMany({
        where: { userId: req.user.id, vocabId: { in: ids } }
    });
    return ok(res, { count: result.count });
});

app.patch('/my-wordbook/assign', requireAuth, async (req, res) => {
    const { vocabIds, categoryId } = req.body || {};
    if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
        return fail(res, 400, 'vocabIds required');
    }
    let cid = null;
    if (categoryId !== undefined && categoryId !== null && categoryId !== '' && categoryId !== 'none') {
        cid = Number(categoryId);
        if (!Number.isFinite(cid)) return fail(res, 400, 'invalid categoryId');
    }
    const result = await prisma.userVocab.updateMany({
        where: { userId: req.user.id, vocabId: { in: vocabIds.map(Number) } },
        data: { categoryId: cid },
    });
    return ok(res, { updated: result.count });
});

app.get('/categories', requireAuth, async (req, res) => {
    const cats = await prisma.category.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'asc' },
    });
    const totals = await prisma.userVocab.groupBy({
        by: ['categoryId'],
        where: { userId: req.user.id },
        _count: { _all: true },
    });
    const countMap = new Map(totals.map(t => [t.categoryId ?? 0, t._count._all]));
    const data = cats.map(c => ({ ...c, count: countMap.get(c.id) || 0 }));
    const uncategorized = countMap.get(0) || 0;
    return ok(res, { categories: data, uncategorized });
});

app.post('/categories', requireAuth, async (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) return fail(res, 400, 'name required');
    const c = await prisma.category.create({ data: { userId: req.user.id, name } });
    return ok(res, c);
});

// ===== Global error handler =====
app.use((err, req, res, next) => {
    console.error(err);
    return fail(res, 500, 'internal error');
});

app.listen(PORT, () => {
    console.log(`API http://localhost:${PORT}`)
});
