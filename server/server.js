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
        secure: false, // dev
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
        // sliding refresh
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
    if (!vocab || !vocab.dictMeta) {
        return { ipa: null, ipaKo: null };
    }
    return {
        ipa: vocab.dictMeta.ipa || null,
        ipaKo: vocab.dictMeta.ipaKo || null,
    };
}

// Leitner 변형 스케줄러
function scheduleNext(stage = 0, result) {
    const intervals = [1, 3, 7, 16, 35]; // days
    let newStage = stage;
    if (result === 'pass') newStage = Math.min(newStage + 1, intervals.length - 1);
    else if (result === 'fail') newStage = Math.max(newStage - 1, 0);
    const days = intervals[newStage];
    const nextReviewAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return { newStage, nextReviewAt };
}

// ===== Wiktionary 통합 (정리판) =====
const WIKI_API = 'https://de.wiktionary.org/w/api.php';

function titlecaseFirst(s = '') { return s ? s[0].toUpperCase() + s.slice(1) : s; }

// ▼▼▼ [수정] Wikitext 분석 로직 개선 (음성 파일 탐지 강화) ▼▼▼
function parseWikitext(wikitext = '') {
    const out = { ipa: null, audioTitles: [], examples: [] };
    const ipaMatch = wikitext.match(/\{\{(?:Lautschrift|IPA)\|([^}]+)\}\}/i);
    if (ipaMatch) out.ipa = ipaMatch[1].trim().replace(/\|/g, ' ').split(/\s+/)[0];

    // 정규식 1: [[Datei:Filename.ogg]] 형식
    const audioRegex1 = /\[\[(?:Datei|File):([^[\]|]+?\.(?:ogg|wav|mp3))/gi;
    // 정규식 2: {{Audio|datei=Filename.ogg}} 형식
    const audioRegex2 = /\{\{Audio\|(?:de\|)?datei=([^|}]+)/gi;
    let m;
    while ((m = audioRegex1.exec(wikitext)) !== null) out.audioTitles.push(m[1]);
    while ((m = audioRegex2.exec(wikitext)) !== null) out.audioTitles.push(m[1]);
    // 중복 제거
    out.audioTitles = [...new Set(out.audioTitles)];

    const lines = wikitext.split('\n').slice(0, 500);
    for (const line of lines) {
        const s = line.trim().replace(/''/g, '');
        const ex = s.replace(/^#:\s*Beispiel:\s*/i, '').replace(/^#:\s*/, '').replace(/^#\s*/, '');
        if (ex && /^[A-ZÄÖÜß]/.test(ex) && ex.split(' ').length >= 3) {
            out.examples.push({ de: ex, ko: null, source: 'wiktionary' });
            if (out.examples.length >= 3) break;
        }
    }
    return out;
}

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

async function fetchCommonsFileUrl(title) {
    const url = `${WIKI_API}?action=query&titles=Datei:${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&format=json`;
    const res = await fetch(url, { headers: { 'User-Agent': 'de-learner/0.1' } });
    if (!res.ok) return null;
    const json = await res.json();
    const pages = json?.query?.pages || {};
    const first = Object.values(pages)[0];
    return first?.imageinfo?.[0]?.url || null;
}

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
        const url = `https://de.wiktionary.org/wiki/${encodeURIComponent(queryLemma)}`;
        let html;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                const capitalizedUrl = `https://de.wiktionary.org/wiki/${encodeURIComponent(titlecaseFirst(queryLemma))}`;
                const capResponse = await fetch(capitalizedUrl);
                if (!capResponse.ok) return { vocab: null, entry: null };
                html = await capResponse.text();
            } else {
                html = await response.text();
            }
        } catch (e) {
            console.error(`[Enrich] Wiktionary fetch failed for ${queryLemma}:`, e);
            return { vocab: null, entry: null };
        }

        const $ = cheerio.load(html);

        const findSection = (title) => {
            const header = $(`#${title}`).parent();
            return header.length ? header.nextUntil('h2, h3') : null;
        };

        const ausspracheSection = findSection('Aussprache');
        const ipa = ausspracheSection ? ausspracheSection.find('.ipa').first().text().trim().replace(/[\[\]]/g, '') : null;

        // ▼▼▼ [수정] audio 태그에서 직접 src를 찾거나, source 태그에서 찾는 로직으로 강화 ▼▼▼
        let audioUrl = null;
        const findAudio = (section) => {
            if (!section) return null;
            const sourceTag = section.find('audio > source').first();
            if (sourceTag.length) return sourceTag.attr('src');
            const audioTag = section.find('audio').first();
            if (audioTag.length) return audioTag.attr('src');
            return null;
        };
        
        const horbeispieleSection = findSection('Hörbeispiele');
        audioUrl = findAudio(horbeispieleSection);
        if (!audioUrl) {
            audioUrl = findAudio(ausspracheSection);
        }
        if (!audioUrl) {
            audioUrl = findAudio($('body')); // 최후의 수단
        }
        
        if (audioUrl && audioUrl.startsWith('//')) {
            audioUrl = 'https:' + audioUrl;
        }

        const bedeutungenSection = findSection('Bedeutungen');
        const ko = bedeutungenSection ? bedeutungenSection.find('dd > .Übersetzung > a[title="Koreanisch"]').first().text().trim() : null;

        const examples = [];
        if (bedeutungenSection) {
            const beispieleHeader = bedeutungenSection.find('dd:contains("Beispiele:")');
            beispieleHeader.first().next('dl').find('dd').each((i, el) => {
                if (examples.length < 2) {
                    examples.push({ de: $(el).text().trim().split(/\[\d+\]/)[0], ko: null, source: 'wiktionary' });
                }
            });
        }

        const finalExamples = [
            ...(ko ? [{ de: '', ko, source: 'wiktionary-ko', kind: 'gloss' }] : []),
            ...examples
        ];

        let vocab = await prisma.vocab.findFirst({
            where: { lemma: { equals: queryLemma, mode: 'insensitive' } }
        });
        if (!vocab) {
            vocab = await prisma.vocab.create({
                data: { lemma: titlecaseFirst(queryLemma), pos: 'UNK', levelCEFR: 'A1' }
            });
        }

        let entry = await prisma.dictEntry.findUnique({ where: { vocabId: vocab.id } });
        const dataToUpdate = {
            ipa: entry?.ipa || ipa || null,
            audioUrl: entry?.audioUrl || audioUrl || null,
            examples: finalExamples.length ? finalExamples : (entry?.examples || []),
            license: 'CC BY-SA',
            attribution: 'Wiktionary/Wikimedia',
        };

        if (!entry) {
            entry = await prisma.dictEntry.create({ data: { vocabId: vocab.id, ...dataToUpdate } });
        } else {
            entry = await prisma.dictEntry.update({ where: { vocabId: vocab.id }, data: dataToUpdate });
        }

        return { vocab, entry };
    } catch (error) {
        console.error(`[Enrich] CRITICAL ERROR during enrichFromWiktionary for "${queryLemma}":`, error);
        return { vocab: null, entry: null };
    }
}

// ===== Auth =====
app.post('/auth/register', async (req, res) => {
    let { email, password } = req.body || {};
    if (!email || !password) return fail(res, 400, 'email and password required');

    email = email.toLowerCase().trim();

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return fail(res, 409, 'email already exists');

    const passwordHash = await bcrypt.hash(password, 11);
    const user = await prisma.user.create({
        data: { email, passwordHash, role: 'USER', profile: { level: 'A2', tone: 'formal', address: 'Sie' } },
        select: { id: true, email: true, role: true, profile: true }
    });

    setAuthCookie(res, signToken({ id: user.id, email: user.email, role: user.role }));
    return ok(res, user);
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
            gender: v.gender,
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

    const rows = await prisma.userVocab.findMany({
        where,
        include: { vocab: { include: { dictMeta: { select: { ipa: true, ipaKo: true, examples: true } } } } },
        orderBy: { createdAt: 'desc' },
    });
    const words = rows.map(r => r.vocab);
    return ok(res, words);
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