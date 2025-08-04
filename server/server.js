// server/server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('node:path');
const fs = require('node:fs/promises');
const { prisma } = require('./db/prisma');   // Prisma 싱글턴
const { ok, fail } = require('./lib/resp');  // 통일 응답 헬퍼
const {
    parseWikitext,
    fetchWiktionaryWikitext,
    fetchCommonsFileUrl,
} = require('./integrations/wiktionary');

const app = express();
// ===== Config =====
const PORT = 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
const COOKIE_NAME = 'token';
const SLIDING_MINUTES = 15; // 15분 유휴(슬라이딩 만료)
const AUDIO_DIR = path.join(__dirname, 'static', 'audio');

// ===== Middlewares =====
app.use((req, res, next) => { console.log('>>>', req.method, req.url); next(); });
app.use(cookieParser());
app.use(express.json());
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use('/static', express.static(path.join(__dirname, 'static')));

app.get('/__ping', (req, res) => res.type('text').send('pong'));

// ===== Helpers =====
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
    if (req.user.role !== 'ADMIN') return fail(res, 403, 'Forbidden');
    return next();
}

function buildPron(vocab) {
    if (!vocab || !vocab.dictMeta) return { ipa: null, ipaKo: null };
    return { ipa: vocab.dictMeta.ipa || null, ipaKo: vocab.dictMeta.ipaKo || null };
}

// Leitner 변형 스케줄러
function scheduleNext(stage = 0, result) {
    const intervals = [1, 3, 7, 16, 35];
    let newStage = stage;
    if (result === 'pass') newStage = Math.min(newStage + 1, intervals.length - 1);
    else if (result === 'fail') newStage = Math.max(newStage - 1, 0);
    const days = intervals[newStage];
    const nextReviewAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return { newStage, nextReviewAt };
}

// const titlecaseFirst = (s = '') => (s ? s[0].toUpperCase() + s.slice(1) : s);
async function ensureDir(p) { await fs.mkdir(p, { recursive: true }); }
async function downloadToFile(url, filepath) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await ensureDir(path.dirname(filepath));
    await fs.writeFile(filepath, buf);
}
// ===== Wiktionary 통합 (정리판) =====
const WIKI_API = 'https://de.wiktionary.org/w/api.php';

function titlecaseFirst(s = '') { return s ? s[0].toUpperCase() + s.slice(1) : s; }

// ▼▼▼ [수정] Wikitext 분석 로직 개선 (음성 파일 탐지 강화) ▼▼▼
// function parseWikitext(wikitext = '') {
//     const out = { ipa: null, audioTitles: [], examples: [] };
//     const ipaMatch = wikitext.match(/\{\{(?:Lautschrift|IPA)\|([^}]+)\}\}/i);
//     if (ipaMatch) out.ipa = ipaMatch[1].trim().replace(/\|/g, ' ').split(/\s+/)[0];

//     // 정규식 1: [[Datei:Filename.ogg]] 형식
//     const audioRegex1 = /\[\[(?:Datei|File):([^[\]|]+?\.(?:ogg|wav|mp3))/gi;
//     // 정규식 2: {{Audio|datei=Filename.ogg}} 형식
//     const audioRegex2 = /\{\{Audio\|(?:de\|)?datei=([^|}]+)/gi;
//     let m;
//     while ((m = audioRegex1.exec(wikitext)) !== null) out.audioTitles.push(m[1]);
//     while ((m = audioRegex2.exec(wikitext)) !== null) out.audioTitles.push(m[1]);
//     // 중복 제거
//     out.audioTitles = [...new Set(out.audioTitles)];

//     const lines = wikitext.split('\n').slice(0, 500);
//     for (const line of lines) {
//         const s = line.trim().replace(/''/g, '');
//         const ex = s.replace(/^#:\s*Beispiel:\s*/i, '').replace(/^#:\s*/, '').replace(/^#\s*/, '');
//         if (ex && /^[A-ZÄÖÜß]/.test(ex) && ex.split(' ').length >= 3) {
//             out.examples.push({ de: ex, ko: null, source: 'wiktionary' });
//             if (out.examples.length >= 3) break;
//         }
//     }
//     return out;
// }

function extractKoTranslations(wikitext = '') {
    const out = new Set();
    const push = (s) => {
        const v = String(s || '').trim().replace(/\[\[|\]\]/g, '').split('|')[0];
        if (v) out.add(v);
    };

    let m;
    const re1 = /\{\{Ü\|ko\|([^}|]+)(?:\|[^}]*)?\}\}/gi;
    while ((m = re1.exec(wikitext)) !== null) push(m[1]);

    const re2 = /\{\{Üt\|ko\|([^}|]+)(?:\|[^}]*)?\}\}/gi;
    while ((m = re2.exec(wikitext)) !== null) push(m[1]);

    const re3 = /\{\{Ü\|koreanisch\|([^}|]+)(?:\|[^}]*)?\}\}/gi;
    while ((m = re3.exec(wikitext)) !== null) push(m[1]);

    const tbl = /\{\{Ü-Tabelle[^}]*\}\}/gis;
    while ((m = tbl.exec(wikitext)) !== null) {
        const block = m[0];
        const kv = /\|\s*ko\s*=\s*([^|\n}]+)/gi;
        let t; while ((t = kv.exec(block)) !== null) push(t[1]);
    }

    return Array.from(out);
}

async function fetchParseWikitext(title) {
    const url = `${WIKI_API}?action=parse&redirects=1&prop=wikitext&format=json&page=${encodeURIComponent(title)}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'de-learner/0.1' } });
    if (!r.ok) return '';
    const j = await r.json();
    return j?.parse?.wikitext?.['*'] || '';
}

async function getAllCandidateWikitexts(term) {
    const tried = new Set();
    const texts = [];

    const candidates = [term, titlecaseFirst(term)].filter(Boolean);
    for (const t of candidates) {
        if (tried.has(t)) continue;
        tried.add(t);
        const text = await fetchParseWikitext(t);
        if (text) texts.push({ title: t, text });
    }

    const qurl = `${WIKI_API}?action=query&list=search&srsearch=${encodeURIComponent(term)}&srlimit=1&format=json`;
    const sres = await fetch(qurl, { headers: { 'User-Agent': 'de-learner/0.1' } });
    if (sres.ok) {
        const sjson = await sres.json();
        const title = sjson?.query?.search?.[0]?.title;
        if (title && !tried.has(title)) {
            tried.add(title);
            const text = await fetchParseWikitext(title);
            if (text) texts.push({ title, text });
        }
    }
    return texts;
}

// async function fetchCommonsFileUrl(title) {
//     const url = `${WIKI_API}?action=query&titles=Datei:${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&format=json`;
//     const res = await fetch(url, { headers: { 'User-Agent': 'de-learner/0.1' } });
//     if (!res.ok) return null;
//     const json = await res.json();
//     const pages = json?.query?.pages || {};
//     const first = Object.values(pages)[0];
//     return first?.imageinfo?.[0]?.url || null;
// }

async function ensureDir(p) { await fs.mkdir(p, { recursive: true }); }
async function downloadToFile(url, filepath) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await ensureDir(path.dirname(filepath));
    await fs.writeFile(filepath, buf);
}


async function enrichFromWiktionary(queryLemma) {
    try {
        const wikitext = await fetchWiktionaryWikitext(queryLemma);
        if (!wikitext) {
            console.log(`[Enrich] No wikitext found for "${queryLemma}"`);
            return null;
        }

        const parsed = parseWikitext(wikitext);
        const { ipa, audioTitles, examples } = parsed;

        let audioUrl = null;
        let audioLocal = null;

        if (audioTitles.length > 0) {
            audioUrl = await fetchCommonsFileUrl(audioTitles[0]);
            if (audioUrl) {
                const filename = path.basename(audioTitles[0]);
                const localPath = path.join(AUDIO_DIR, filename);
                try {
                    await downloadToFile(audioUrl, localPath);
                    audioLocal = `/static/audio/${filename}`;
                    console.log(`[Enrich] Audio downloaded for "${queryLemma}" to ${audioLocal}`);
                } catch (e) {
                    console.error(`[Enrich] Failed to download audio ${audioUrl}`, e);
                }
            }
        }

        if (!ipa && !audioUrl && examples.length === 0) {
            console.log(`[Enrich] Not enough useful info found for "${queryLemma}"`);
            return null; // 유용한 정보가 충분하지 않으면 중단
        }

        const vocab = await prisma.vocab.upsert({
            where: { lemma: titlecaseFirst(queryLemma) },
            update: {},
            create: {
                lemma: titlecaseFirst(queryLemma),
                pos: 'UNK',
                levelCEFR: 'UNSET',
                source: 'wiktionary-en'
            }
        });

        const updatedEntry = await prisma.dictEntry.upsert({
            where: { vocabId: vocab.id },
            create: {
                vocabId: vocab.id,
                ipa,
                audioUrl,
                audioLocal,
                examples,
                license: 'CC BY-SA 3.0',
                attribution: 'Wiktionary'
            },
            update: {
                ipa: ipa || undefined,
                audioUrl: audioUrl || undefined,
                audioLocal: audioLocal || undefined,
                examples,
            }
        });

        console.log(`[Enrich] Enriched "${queryLemma}" successfully.`);
        return { vocab, entry: updatedEntry };

    } catch (error) {
        console.error(`[Enrich] CRITICAL ERROR during enrichFromWiktionary for "${queryLemma}":`, error);
        return null;
    }
}


// ===== Auth =====
app.post('/auth/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return fail(res, 400, 'Email and password are required');
    }

    try {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return fail(res, 409, 'User with this email already exists');
        }

        const passwordHash = await bcrypt.hash(password, 10);

        // ★★★★★ 관리자 계정 지정 로직 ★★★★★
        // 특정 이메일 주소일 경우 'admin' 역할을 부여합니다.
        const userRole = email === 'super@naver.com' ? 'admin' : 'USER';

        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                role: userRole, // ★ role 필드에 userRole 변수 할당
            },
        });

        // DELETE /vocab/:id - 단어 영구 삭제 (관리자용)
        app.delete('/vocab/:id', requireAuth, async (req, res) => {
            // 관리자 권한이 있는지 확인합니다.
            if (req.user.role !== 'admin') {
                return fail(res, 403, 'Forbidden: Admins only');
            }

            const id = Number(req.params.id);
            if (!Number.isFinite(id)) {
                return fail(res, 400, 'Invalid ID');
            }

            try {
                // 트랜잭션을 사용하여 단어와 관련된 모든 데이터를 (사전 정보, 내 단어장, SRS 카드 등)
                // 한 번에 안전하게 삭제합니다.
                await prisma.$transaction(async (tx) => {
                    await tx.userVocab.deleteMany({ where: { vocabId: id } });
                    await tx.sRSCard.deleteMany({ where: { itemType: 'vocab', itemId: id } });
                    await tx.dictEntry.deleteMany({ where: { vocabId: id } });
                    await tx.vocab.delete({ where: { id } });
                });

                return ok(res, { message: `Vocab ID ${id} and all related data deleted successfully.` });
            } catch (e) {
                // Prisma에서 "삭제할 레코드가 없습니다" 오류가 발생한 경우
                if (e.code === 'P2025') {
                    return fail(res, 404, 'Vocab not found');
                }
                console.error(`DELETE /vocab/${id} failed:`, e);
                return fail(res, 500, 'Internal Server Error');
            }
        });
        // 회원가입 성공 후 바로 로그인 처리
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
            expiresIn: `${SLIDING_MINUTES}m`,
        });

        res.cookie(COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: SLIDING_MINUTES * 60 * 1000,
        });

        // 비밀번호 해시를 제외하고 사용자 정보 반환
        const { passwordHash: _, ...userSafe } = user;
        return ok(res, userSafe);

    } catch (e) {
        console.error('POST /auth/register failed:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});
// POST /my-wordbook/add-many - 여러 단어를 내 단어장에 추가
app.post('/my-wordbook/add-many', requireAuth, async (req, res) => {
    const { vocabIds } = req.body;
    if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
        return fail(res, 400, 'vocabIds must be a non-empty array');
    }

    const userId = req.user.id;
    let newCount = 0;

    try {
        // 이미 단어장에 있는 단어는 건너뛰고, 새로운 단어만 추가합니다.
        const dataToCreate = vocabIds.map(id => ({
            userId,
            vocabId: Number(id),
        }));

        // createMany는 중복을 허용하지 않으므로, 먼저 존재하는 항목을 찾습니다.
        const existingEntries = await prisma.userVocab.findMany({
            where: {
                userId,
                vocabId: { in: vocabIds.map(Number) },
            },
            select: { vocabId: true },
        });
        const existingVocabIds = new Set(existingEntries.map(e => e.vocabId));

        const newEntries = dataToCreate.filter(d => !existingVocabIds.has(d.vocabId));

        if (newEntries.length > 0) {
            const result = await prisma.userVocab.createMany({
                data: newEntries,
            });
            newCount = result.count;
        }

        return ok(res, { count: newCount });
    } catch (e) {
        console.error('POST /my-wordbook/add-many failed:', e);
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

// ===== SRS =====

// server.js

// [추가] SRS 덱을 통째로 교체하는 API
app.post('/srs/replace-deck', requireAuth, async (req, res) => {
    const { vocabIds } = req.body;
    if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
        return fail(res, 400, 'vocabIds must be a non-empty array');
    }

    const userId = req.user.id;
    // 중복 제거 및 유효한 숫자 ID만 필터링
    const uniqueVocabIds = [...new Set(vocabIds.map(Number).filter(Boolean))];

    try {
        // 트랜잭션으로 원자적 실행 보장
        await prisma.$transaction(async (tx) => {
            // 1단계: 사용자의 기존 SRS 카드 모두 삭제
            await tx.sRSCard.deleteMany({
                where: { userId: userId, itemType: 'vocab' },
            });

            // 2단계: 제공된 단어 ID로 새 카드 생성
            const dataToCreate = uniqueVocabIds.map(id => ({
                userId: userId,
                itemType: 'vocab',
                itemId: id,
                stage: 0,
                nextReviewAt: new Date(), // 즉시 복습 가능하도록 설정
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

        if (cards.length === 0) {
            return ok(res, []);
        }

        const vocabIds = cards.map(card => card.itemId);

        const vocabs = await prisma.vocab.findMany({
            where: {
                id: { in: vocabIds }
            },
            include: {
                dictMeta: true,
            },
        });

        const vocabMap = new Map(vocabs.map(v => [v.id, v]));

        const result = cards
            .map(card => {
                const vocab = vocabMap.get(card.itemId);
                if (!vocab) {
                    return null;
                }

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
            if (wrongs.length < 3) {
                continue;
            }

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

    // 이미 있는 카드는 무시하고 없는 것만 추가
    const result = await prisma.sRSCard.createMany({
        data: dataToCreate,
        skipDuplicates: true,
    });

    return ok(res, result);
});

// ===== Vocab / Dict =====
app.post('/vocab/:id/enrich', requireAuth, async (req, res) => {
    const vocabId = Number(req.params.id);
    if (!vocabId) return fail(res, 400, 'Invalid vocabId');

    try {
        const vocab = await prisma.vocab.findUnique({ where: { id: vocabId } });
        if (!vocab) return fail(res, 404, 'Vocab not found');

        // 기존 Wiktionary 보강 로직을 재사용합니다.
        await enrichFromWiktionary(vocab.lemma);

        // 새로 업데이트된 단어 정보를 다시 불러옵니다.
        const updatedVocab = await prisma.vocab.findUnique({
            where: { id: vocabId },
            include: { dictMeta: true },
        });

        // 프론트엔드가 사용하는 형식과 동일하게 데이터를 가공하여 반환합니다.
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

app.get('/vocab/list', async (req, res) => {
    const level = String(req.query.level || 'A1').toUpperCase();

    try {
        const rows = await prisma.$queryRaw`
      SELECT id
      FROM Vocab
      WHERE UPPER(TRIM(levelCEFR)) = ${level}
      ORDER BY lemma ASC
      LIMIT 1000
    `;
        const ids = rows.map(r => r.id);
        if (ids.length === 0) return ok(res, []);

        const vocabs = await prisma.vocab.findMany({
            where: { id: { in: ids } },
            orderBy: { lemma: 'asc' },
            include: { dictMeta: { select: { examples: true, ipa: true, ipaKo: true, audioUrl: true, audioLocal: true } } },
        });

        // ▼ 예문(examples) 중 audio 필드가 있는 경우만 통과
        const filtered = vocabs.filter(v => {
            const exs = Array.isArray(v.dictMeta?.examples) ? v.dictMeta.examples : [];
            const hasExampleAudio = exs.some(ex => ex?.audio || ex?.audioUrl || ex?.audioLocal);
            return hasExampleAudio;
        });

        const items = filtered.map(v => {
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
                // ▼▼▼ [수정] audio 필드를 추가하여 로컬 캐시 또는 원격 URL을 전달합니다. ▼▼▼
                audio: v.dictMeta?.audioLocal || v.dictMeta?.audioUrl || null,
            };
        });
        return ok(res, items);
    } catch (e) {
        console.error('GET /vocab/list failed:', e);
        return fail(res, 500, 'list query failed');
    }
});

app.get('/vocab/:id', requireAuth, async (req, res) => {
    try {
        const vocabId = Number(req.params.id);
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

app.post('/vocab/:id/bookmark', requireAuth, async (req, res) => {
    const vid = Number(req.params.id);
    const vocab = await prisma.vocab.findUnique({ where: { id: vid } });
    if (!vocab) return fail(res, 404, 'vocab not found');

    const existing = await prisma.sRSCard.findFirst({
        where: { userId: req.user.id, itemType: 'vocab', itemId: vid }
    });
    if (existing) return ok(res, existing);

    const card = await prisma.sRSCard.create({
        data: {
            userId: req.user.id,
            itemType: 'vocab',
            itemId: vid,
            stage: 0,
            nextReviewAt: new Date(),
            lastResult: null
        }
    });
    return ok(res, card, { created: true });
});

app.get('/dict/search', async (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q) return ok(res, { entries: [] });

    const queryDB = async () => prisma.vocab.findMany({
        where: { lemma: { contains: q } },
        take: 5,
        include: { dictMeta: true }
    });

    let hits = await queryDB();

    const lacksKo = (v) => !v.dictMeta
        || !Array.isArray(v.dictMeta.examples)
        || !v.dictMeta.examples.some(ex => ex && ex.ko);

    if (hits.length === 0 || hits.every(lacksKo)) {
        try {
            await enrichFromWiktionary(q);
            hits = await queryDB();
        } catch { }
    }

    if (hits.length) {
        const entries = hits.map(v => ({
            id: v.id,
            lemma: v.lemma,
            pos: v.pos,
            // ★★★★★ 수정된 부분: gender 필드 삭제 ★★★★★
            ipa: v.dictMeta?.ipa || null,
            audio: v.dictMeta?.audioLocal || v.dictMeta?.audioUrl || null,
            license: v.dictMeta?.license || null,
            attribution: v.dictMeta?.attribution || null,
            examples: Array.isArray(v.dictMeta?.examples) ? v.dictMeta.examples : []
        }));
        return ok(res, { entries });
    }

    return ok(res, { entries: [] });
});

// ===== My Wordbook & Categories =====
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
    // 예문 오디오가 있는지 판단
    function hasExampleAudio(dictMeta) {
        const exs = Array.isArray(dictMeta?.examples) ? dictMeta.examples : [];
        return exs.some(ex => ex?.audio || ex?.audioUrl || ex?.audioLocal);
    }

    // POST /my-wordbook/purge-uncategorized-no-audio
    // 미분류( categoryId = null ) 중 예문 오디오 없는 항목을 전부 삭제
    app.post('/my-wordbook/purge-uncategorized-no-audio', requireAuth, async (req, res) => {
        try {
            const rows = await prisma.userVocab.findMany({
                where: { userId: req.user.id, categoryId: null },
                include: { vocab: { include: { dictMeta: { select: { examples: true, audioUrl: true, audioLocal: true } } } } },
            });
            const targetVocabIds = rows
                .filter(r => !hasExampleAudio(r.vocab?.dictMeta))
                .map(r => r.vocabId);
            if (targetVocabIds.length === 0) return ok(res, { count: 0 });

            const result = await prisma.userVocab.deleteMany({
                where: { userId: req.user.id, categoryId: null, vocabId: { in: targetVocabIds } }
            });
        } catch (e) {
            console.error('purge-uncategorized-no-audio failed:', e);
            return fail(res, 500, 'Internal Server Error');
        }
    });
    const rows = await prisma.userVocab.findMany({
        where,
        include: { vocab: { include: { dictMeta: { select: { ipa: true, ipaKo: true, examples: true, audioUrl: true, audioLocal: true } } } } },
        orderBy: { createdAt: 'desc' },
    });
    const filtered = rows.filter(r => {
        const exs = Array.isArray(r.vocab?.dictMeta?.examples) ? r.vocab.dictMeta.examples : [];
        return exs.some(ex => ex?.audio || ex?.audioUrl || ex?.audioLocal);
    });
    return ok(res, filtered);
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