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

// ★ 추가: 요청 로깅
app.use((req, res, next) => { console.log('>>>', req.method, req.url); next(); });
// ★ 추가: 헬스체크
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

// ===== Wiktionary 간단 통합 (inline) =====

// ===== Wiktionary 통합 (정리판) =====
const WIKI_API = 'https://de.wiktionary.org/w/api.php';

// Node 18 미만이면 주석 해제하여 사용 (node-fetch 설치 필요: npm i node-fetch@3)
// global.fetch ||= ((...args) => import('node-fetch').then(({default: f}) => f(...args)));

function titlecaseFirst(s = '') { return s ? s[0].toUpperCase() + s.slice(1) : s; }

// IPA/오디오/예문(간이)
function parseWikitext(wikitext = '') {
    const out = { ipa: null, audioTitles: [], examples: [] };
    const ipaMatch = wikitext.match(/\{\{(?:Lautschrift|IPA)\|([^}]+)\}\}/i);
    if (ipaMatch) out.ipa = ipaMatch[1].trim().replace(/\|/g, ' ').split(/\s+/)[0];

    const audioRegex = /\[\[(?:Datei|File):([^[\]|]+?\.(?:ogg|wav|mp3))/gi;
    let m; while ((m = audioRegex.exec(wikitext)) !== null) out.audioTitles.push(m[1]);

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

// KO 번역 추출(Ü, Üt, Ü-표 변형)
function extractKoTranslations(wikitext = '') {
    const out = new Set();
    const push = (s) => {
        const v = String(s || '').trim().replace(/\[\[|\]\]/g, '').split('|')[0];
        if (v) out.add(v);
    };

    let m;
    const re1 = /\{\{Ü\|ko\|([^}|]+)(?:\|[^}]*)?\}\}/gi;  // {{Ü|ko|...}}
    while ((m = re1.exec(wikitext)) !== null) push(m[1]);

    const re2 = /\{\{Üt\|ko\|([^}|]+)(?:\|[^}]*)?\}\}/gi; // {{Üt|ko|...}}
    while ((m = re2.exec(wikitext)) !== null) push(m[1]);

    const re3 = /\{\{Ü\|koreanisch\|([^}|]+)(?:\|[^}]*)?\}\}/gi; // 드물게 언어명 독일어
    while ((m = re3.exec(wikitext)) !== null) push(m[1]);

    // {{Ü-Tabelle|...|ko=...}} 블록
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

// term, TitleCase, 검색 1건까지 모아 **배열** 반환
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

// KO/IPA/오디오/예문을 모아 dictMeta 생성/갱신
async function enrichFromWiktionary(queryLemma) {
    const cands = await getAllCandidateWikitexts(queryLemma);
    if (cands.length === 0) return { vocab: null, entry: null };

    let ipa = null, audioUrl = null, ko = null;
    const examples = [];

    for (const { text } of cands) {
        if (!ipa) {
            const m = text.match(/\{\{(?:Lautschrift|IPA)\|([^}]+)\}\}/i);
            if (m) ipa = m[1].trim().replace(/\|/g, ' ').split(/\s+/)[0];
        }
        if (!ko) {
            const kos = extractKoTranslations(text);
            if (kos && kos[0]) ko = kos[0];
        }
        if (!audioUrl) {
            const m = /\[\[(?:Datei|File):([^[\]|]+?\.(?:ogg|wav|mp3))/i.exec(text);
            if (m) {
                try {
                    audioUrl = await fetchCommonsFileUrl(m[1]);
                } catch { }
            }
        }
        const parsed = parseWikitext(text);
        for (const ex of parsed.examples) {
            examples.push(ex);
            if (examples.length >= 3) break;
        }
        if (examples.length >= 3 && ipa && (ko || audioUrl)) break;
    }

    const finalExamples = [
        ...(ko ? [{ de: '', ko, source: 'wiktionary-ko', kind: 'gloss' }] : []),
        ...examples
    ];

    // vocab 찾기/보정
    let vocab = await prisma.vocab.findFirst({
        where: { lemma: { in: [queryLemma, titlecaseFirst(queryLemma)] } }
    });
    if (!vocab) {
        vocab = await prisma.vocab.create({
            data: { lemma: titlecaseFirst(queryLemma), pos: 'UNK', levelCEFR: 'A1' }
        });
    } else if (vocab.lemma !== titlecaseFirst(vocab.lemma)) {
        vocab = await prisma.vocab.update({
            where: { id: vocab.id },
            data: { lemma: titlecaseFirst(vocab.lemma) }
        });
    }

    // dictMeta 생성/갱신 (KO 없을 때 갱신)
    let entry = await prisma.dictEntry.findUnique({ where: { vocabId: vocab.id } });
    if (!entry) {
        entry = await prisma.dictEntry.create({
            data: {
                vocabId: vocab.id,
                ipa: ipa || null,
                audioUrl: audioUrl || null,
                audioLocal: null,
                license: 'CC BY-SA',
                attribution: 'Wiktionary/Wikimedia',
                examples: finalExamples
            }
        });
    } else {
        const hasKo = Array.isArray(entry.examples) && entry.examples.some(ex => ex && ex.ko);
        if (!hasKo) {
            entry = await prisma.dictEntry.update({
                where: { vocabId: vocab.id },
                data: {
                    ipa: entry.ipa || ipa || null,
                    audioUrl: entry.audioUrl || audioUrl || null,
                    examples: finalExamples.length ? finalExamples : entry.examples
                }
            });
        }
    }

    return { vocab, entry };
}


// ===== Auth =====
app.post('/auth/register', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return fail(res, 400, 'email and password required');

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
    const { email, password } = req.body || {};
    if (!email || !password) return fail(res, 400, 'email and password required');

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

app.get('/debug/vocab-counts', async (req, res) => {
    const rows = await prisma.$queryRaw`
    SELECT UPPER(TRIM(levelCEFR)) AS lvl, COUNT(*) AS cnt
    FROM Vocab
    GROUP BY UPPER(TRIM(levelCEFR))
    ORDER BY lvl
  `;
    return ok(res, rows);
});


app.get('/srs/cards', requireAuth, async (req, res) => {
    const cards = await prisma.sRSCard.findMany({
        where: { userId: req.user.id, itemType: 'vocab' },
        select: { itemId: true },
    });
    return ok(res, cards.map(c => c.itemId));
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
// 이 함수를 교체하세요
// server/server.js
// server/server.js
// server/server.js
// server/server.js
// server/server.js
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

        // 오답 풀(글로스가 있는 항목) 넉넉히 확보
        const distractorPool = await prisma.vocab.findMany({
            where: { id: { notIn: ids }, dictMeta: { isNot: null } },
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

            // 3개 오답 생성
            const wrong = [];
            const tried = new Set();
            while (wrong.length < 3 && tried.size < poolGlosses.length) {
                const idx = Math.floor(Math.random() * poolGlosses.length);
                tried.add(idx);
                const cand = poolGlosses[idx];
                if (cand && cand !== correct && !wrong.includes(cand)) wrong.push(cand);
            }
            if (wrong.length < 3) continue; // MCQ 구성 불가 시 스킵

            queue.push({
                cardId: c.id,              // or card.id / null
                question: v.lemma,
                answer: correct,
                quizType: 'mcq',
                options: [correct, ...wrong].sort(() => Math.random() - 0.5),
                // ★ 추가
                pron: buildPron(v),
            });
        }
        return ok(res, queue);
    } catch (e) {
        console.error('SRS Queue 생성 오류:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});



// server/server.js
// server/server.js
// server/server.js

app.post('/quiz/by-vocab', requireAuth, async (req, res) => {
    try {
        const { vocabIds } = req.body || {};
        if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
            return fail(res, 400, 'vocabIds must be a non-empty array');
        }
        const ids = vocabIds.map(Number).filter(Number.isFinite);
        if (ids.length === 0) return ok(res, []); // 방어

        // 선택된 단어와 카드 id 매핑
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

        // 오답 풀(글로스 있는 것만). notIn: ids
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

        // 선택 항목 자체에서 얻을 수 있는 글로스(상호 오답 보강용)
        const selectedGlosses = new Map(
            vocabs.map(v => {
                const g = v.dictMeta?.examples?.find(ex => ex && ex.kind === 'gloss')?.ko || null;
                return [v.id, g];
            })
        );

        // 유틸: 무작위에서 n개 뽑기
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

            // 오답 후보 만들기: 전역 풀 + (선택 집합 내에서 나 자신을 뺀 글로스)
            const localWrongSet = new Set(poolGlosses);
            for (const [otherId, g] of selectedGlosses.entries()) {
                if (otherId !== v.id && g && g !== correct) localWrongSet.add(g);
            }
            // 정답과 중복 제거
            localWrongSet.delete(correct);

            const wrongs = pickN(Array.from(localWrongSet), 3);
            if (wrongs.length < 3) {
                // 오답이 3개 미만이면 이 문항은 건너뜀 (500 내지 않고 skip)
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
        // 원인 파악을 쉽게 로그 상세 출력
        console.error('POST /quiz/by-vocab 오류:', e && e.stack ? e.stack : e);
        console.error('요청 바디:', req.body);
        return fail(res, 500, 'Internal Server Error');
    }
});


// server/server.js
// ★ 신규 API: 오답 노트 퀴즈 목록 가져오기
// server/server.js
app.get('/odat-note/queue', requireAuth, async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit || 20), 100);

        // 1) 오답이 1회 이상인 카드
        const incorrectCards = await prisma.sRSCard.findMany({
            where: { userId: req.user.id, itemType: 'vocab', incorrectCount: { gt: 0 } },
            orderBy: { updatedAt: 'asc' },
            take: limit,
            select: { id: true, itemId: true },
        });
        if (incorrectCards.length === 0) return ok(res, []);

        const ids = incorrectCards.map(c => c.itemId);

        // 2) 정답 후보 로드
        const vocabs = await prisma.vocab.findMany({
            where: { id: { in: ids } },
            include: { dictMeta: true },
        });
        const vocabMap = new Map(vocabs.map(v => [v.id, v]));

        // 3) 오답 풀 (글로스 있는 것만)
        const distractorPool = await prisma.vocab.findMany({
            where: { id: { notIn: ids }, dictMeta: { isNot: null } },
            include: { dictMeta: true },
            take: 300,
        });
        const poolGlosses = distractorPool
            .map(d => d.dictMeta?.examples?.find(ex => ex && ex.kind === 'gloss')?.ko)
            .filter(Boolean);

        // 4) MCQ 생성
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
                pron: buildPron(v),

            });
        }

        return ok(res, quizQueue);
    } catch (e) {
        console.error('오답 노트 생성 중 오류:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});

// ★ 오답 노트: 목록 조회(틀린 단어 리스트)
// server/server.js
app.get('/odat-note/list', requireAuth, async (req, res) => {
    try {
        // 1) 오답 카드(incorrectCount > 0)만 추출
        const cards = await prisma.sRSCard.findMany({
            where: { userId: req.user.id, itemType: 'vocab', incorrectCount: { gt: 0 } },
            orderBy: { updatedAt: 'asc' },
            select: { id: true, itemId: true, incorrectCount: true, updatedAt: true },
        });

        if (cards.length === 0) return ok(res, []);

        // 2) 해당 vocab 들을 한 번에 로드
        const ids = cards.map(c => c.itemId);
        const vocabs = await prisma.vocab.findMany({
            where: { id: { in: ids } },
            include: { dictMeta: true },
        });
        const vmap = new Map(vocabs.map(v => [v.id, v]));

        // 3) 프런트용 행 구성
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
                // ★ 추가
                ipa: v?.dictMeta?.ipa || null,
                ipaKo: v?.dictMeta?.ipaKo || null,
            };
        }).filter(r => r.lemma); // 없는 vocab 방어

        return ok(res, rows);
    } catch (e) {
        console.error('GET /odat-note/list failed:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});

// ★ 신규 API: 선택한 오답 카드들로 퀴즈 큐 생성
app.post('/odat-note/quiz', requireAuth, async (req, res) => {
    try {
        const { cardIds } = req.body || {};
        if (!Array.isArray(cardIds) || cardIds.length === 0) {
            return fail(res, 400, 'cardIds must be a non-empty array');
        }
        const ids = cardIds.map(Number).filter(Number.isFinite);
        if (ids.length === 0) return ok(res, []);

        // 1) 내 카드 중 오답인 것만 필터
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

        // 2) 정답 후보 로드
        const vocabs = await prisma.vocab.findMany({
            where: { id: { in: vocabIds } },
            include: { dictMeta: true },
        });
        const vmap = new Map(vocabs.map(v => [v.id, v]));

        // 3) 오답 풀(글로스 있는 것만) 로드
        const distractorPool = await prisma.vocab.findMany({
            where: { id: { notIn: vocabIds }, dictMeta: { isNot: null } },
            include: { dictMeta: true },
            take: 300,
        });
        const poolGlosses = distractorPool
            .map(d => d.dictMeta?.examples?.find(ex => ex && ex.kind === 'gloss')?.ko)
            .filter(Boolean);

        // 4) MCQ 생성
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

// ★ 오답 노트: 선택 항목 일괄 정리(정답 처리 = 오답 카운트 0)
app.post('/odat-note/resolve-many', requireAuth, async (req, res) => {
    try {
        const { cardIds } = req.body || {};
        if (!Array.isArray(cardIds) || cardIds.length === 0) {
            return fail(res, 400, 'cardIds must be a non-empty array');
        }
        // 내 카드만 대상
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


// ★ 수정된 API: 오답 노트에서 정답 시 incorrectCount 초기화
// server/server.js
// server/server.js
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

    // ★ 오답노트/선택퀴즈에서 맞춘 경우 오답 카운트 초기화
    if (result === 'pass' && source === 'odatNote') {
        data.incorrectCount = { set: 0 }; // ← 반드시 set 사용
    }

    const updated = await prisma.sRSCard.update({ where: { id: card.id }, data });
    return ok(res, updated);
});


// server/server.js
// server/server.js
app.post('/srs/create-many', requireAuth, async (req, res) => {
    const { vocabIds } = req.body;
    if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
        return fail(res, 400, 'vocabIds must be a non-empty array');
    }

    const dataToCreate = vocabIds.map(id => ({
        userId: req.user.id,
        itemType: 'vocab',
        itemId: Number(id),
    }));

    // 이미 있는 카드는 무시하고 없는 것만 추가
    const result = await prisma.sRSCard.createMany({
        data: dataToCreate,
        skipDuplicates: true,
    });

    return ok(res, result); // result.count 에 새로 추가된 카드 개수가 담김
});

// ★ 신규 API 2: 단어 1개 내 단어장에 추가
app.post('/my-wordbook/add', requireAuth, async (req, res) => {
    const { vocabId } = req.body;
    if (!vocabId) return fail(res, 400, 'vocabId is required');

    // 이미 추가된 단어인지 확인 (@@unique 제약조건이 있지만, 부드러운 처리를 위해)
    const existing = await prisma.userVocab.findUnique({
        where: { userId_vocabId: { userId: req.user.id, vocabId: Number(vocabId) } }
    });
    if (existing) return ok(res, existing); // 이미 있으면 그냥 성공 응답

    const newItem = await prisma.userVocab.create({
        data: {
            userId: req.user.id,
            vocabId: Number(vocabId)
        }
    });
    return ok(res, newItem, { created: true });
});

// ★ 신규 API 3: 여러 단어 내 단어장에 추가 (전체 추가 기능용)
app.post('/my-wordbook/add-many', requireAuth, async (req, res) => {
    const { vocabIds } = req.body;
    if (!Array.isArray(vocabIds)) return fail(res, 400, 'vocabIds must be an array');

    const dataToCreate = vocabIds.map(id => ({
        userId: req.user.id,
        vocabId: Number(id)
    }));

    // ignoreDuplicates: 이미 있는 단어는 무시하고 없는 단어만 추가
    const result = await prisma.userVocab.createMany({
        data: dataToCreate,
        skipDuplicates: true,
    });

    return ok(res, result); // result.count에 추가된 개수가 담김
});
// ★ 신규 API 4: 단어 1개 내 단어장에서 삭제 (멱등)
app.delete('/my-wordbook/:vocabId', requireAuth, async (req, res) => {
    const vocabId = Number(req.params.vocabId);
    if (!Number.isFinite(vocabId)) return fail(res, 400, 'invalid vocabId');
    try {
        await prisma.userVocab.delete({
            where: { userId_vocabId: { userId: req.user.id, vocabId } }
        });
    } catch (e) {
        // 이미 없는 경우(P2025)는 성공으로 간주(멱등)
        if (e.code !== 'P2025') return fail(res, 500, 'delete failed');
    }
    return ok(res, { removed: 1 });
});

// ★ 신규 API 5: 여러 단어 일괄 삭제
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

// ===== Vocab / Dict =====
app.get('/vocab/search', async (req, res) => {
    const q = (req.query.q || '').trim();
    const level = (req.query.level || '').trim();
    const where = {
        ...(q ? { lemma: { contains: q } } : {}),
        ...(level ? { levelCEFR: level } : {}),
    };

    let items = await prisma.vocab.findMany({
        where,
        take: 20,
        orderBy: [{ freq: 'asc' }, { lemma: 'asc' }],
        include: { dictMeta: true }
    });

    const lacksKo = (v) => !v.dictMeta
        || !Array.isArray(v.dictMeta.examples)
        || !v.dictMeta.examples.some(ex => ex && ex.ko);

    if (items.length && items.every(lacksKo) && !q.includes(' ')) {
        try {
            await enrichFromWiktionary(items[0].lemma);
            items = await prisma.vocab.findMany({
                where,
                take: 20,
                orderBy: [{ freq: 'asc' }, { lemma: 'asc' }],
                include: { dictMeta: true }
            });
        } catch { }
    }

    return ok(res, items);
});

// ★ 신규 API 엔드포인트: 레벨별로 단어 그룹화하여 반환

// ★ 수정된 API: 'Internal Seed' 출처의 단어만 필터링
// 이 함수 전체를 교체하세요
// 이 함수를 교체하세요
app.get('/vocab/by-level', async (req, res) => {
    try {
        const allVocab = await prisma.vocab.findMany({
            where: { source: { startsWith: 'seed-' } }, // 'seed-A1', 'seed-A2' 등 모두 포함
            orderBy: [{ levelCEFR: 'asc' }, { lemma: 'asc' }],
            // ★ include 제거: 여기서 더 이상 상세 정보를 불러오지 않습니다.
        });

        const groupedByLevel = allVocab.reduce((acc, vocab) => {
            const level = vocab.levelCEFR || 'UNCATEGORIZED';
            if (!acc[level]) acc[level] = [];
            acc[level].push(vocab); // 이제 가공 없이 그대로 전달
            return acc;
        }, {});

        return ok(res, groupedByLevel);
    } catch (e) {
        console.error(e);
        return fail(res, 500, '단어 목록을 불러오는 데 실패했습니다.');
    }
});

// ★ 숫자 id 라우트보다 위에 둘 것
// /vocab/:id 보다 위에 유지
// /vocab/:id 보다 위에 유지
// server/server.js - /vocab/:id 라우트보다 위에 유지
app.get('/vocab/list', async (req, res) => {
    const level = String(req.query.level || 'A1').toUpperCase();

    try {
        // 1) 레벨 정규화해 id만 추출 (공백/대소문자 오염 방지)
        const rows = await prisma.$queryRaw`
      SELECT id
      FROM Vocab
      WHERE UPPER(TRIM(levelCEFR)) = ${level}
      ORDER BY lemma ASC
      LIMIT 1000
    `;
        const ids = rows.map(r => r.id);
        if (ids.length === 0) return ok(res, []);

        // 2) 필요한 필드만 로드 (예문만 포함)
        const vocabs = await prisma.vocab.findMany({
            where: { id: { in: ids } },
            orderBy: { lemma: 'asc' },
            include: { dictMeta: { select: { examples: true, ipa: true, ipaKo: true } } },
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
                // ★ 추가
                ipa: v.dictMeta?.ipa || null,
                ipaKo: v.dictMeta?.ipaKo || null,
            };
        });


        return ok(res, items);
    } catch (e) {
        console.error('GET /vocab/list failed:', e);
        return fail(res, 500, 'list query failed');
    }
});




// ★ 이 함수를 새로 추가하세요
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
    return ok(res, card);
});

// 사전 검색: DB → 미스면 보강(enrich) 시도 → 재조회 → 최종 폴백
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



// Wiktionary 보강 수동 트리거(로그인 필요: 악용 방지)
app.get('/dict/enrich', requireAuth, async (req, res) => {
    const lemma = (req.query.lemma || '').trim();
    if (!lemma) return fail(res, 400, 'lemma required');
    const { vocab, entry } = await enrichFromWiktionary(lemma);
    if (!entry) return fail(res, 404, 'wiktionary not found');
    return ok(res, { id: vocab.id, lemma: vocab.lemma, ...entry });
});

// 오디오 로컬 캐시(관리자 전용)
app.post('/dict/cache-audio', requireAuth, requireAdmin, async (req, res) => {
    const { vocabId } = req.body || {};
    if (!vocabId) return fail(res, 400, 'vocabId required');

    const entry = await prisma.dictEntry.findUnique({ where: { vocabId: Number(vocabId) } });
    if (!entry?.audioUrl) return fail(res, 404, 'audio url not found');

    const ext = path.extname(new URL(entry.audioUrl).pathname) || '.ogg';
    const localName = `v${vocabId}${ext}`;
    const localPath = path.join(AUDIO_DIR, localName);

    await downloadToFile(entry.audioUrl, localPath);
    const rel = `/static/audio/${localName}`;

    const updated = await prisma.dictEntry.update({
        where: { vocabId: Number(vocabId) },
        data: { audioLocal: rel }
    });

    return ok(res, updated);
});

// ===== Reading =====
app.get('/reading/list', (req, res) => {
    return ok(res, [
        { id: 1, title: 'Mein Tag', levelCEFR: 'A1' },
        { id: 2, title: 'Berliner Geschichte', levelCEFR: 'B1' },
        { id: 3, title: 'Umwelt und Politik', levelCEFR: 'B2' }
    ]);
});

// ===== Tutor (mock) =====
app.post('/tutor/chat', requireAuth, (req, res) => {
    return ok(res, {
        de_answer: 'Das klingt gut. Achten Sie auf die Verbzweitstellung im Hauptsatz.',
        ko_explain: '좋습니다. 주절에서는 동사가 두 번째 위치에 와야 합니다.',
        tips: ['주어 뒤 동사 위치 확인', '종속절에서는 동사가 문장 끝'],
        refs: ['kb:V2', 'kb:Subclause-Vfinal', 'dict:stehen'],
    });
});

// ===== Admin (mock shell) =====
app.post('/admin/upload/vocab', requireAuth, requireAdmin, (req, res) => fail(res, 501, 'Not implemented'));
app.post('/admin/upload/grammar', requireAuth, requireAdmin, (req, res) => fail(res, 501, 'Not implemented'));
app.post('/admin/upload/reading', requireAuth, requireAdmin, (req, res) => fail(res, 501, 'Not implemented'));
app.get('/admin/reports', requireAuth, requireAdmin, (req, res) => ok(res, { vocabAccuracy: 0.78, grammarAccuracy: 0.64, readingAccuracy: 0.71 }));

// ===== Root =====
app.get('/', (req, res) => {
    res.type('html').send('<h1>Mock API</h1><p>/auth/*, /me, /srs/*, /vocab/*, /dict/*, /reading/list, /admin/*</p>');
});

// ---------- Category(Folder) APIs ----------
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

app.patch('/categories/:id', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const name = String(req.body?.name || '').trim();
    if (!name) return fail(res, 400, 'name required');
    const c = await prisma.category.update({ where: { id }, data: { name } });
    return ok(res, c);
});

app.delete('/categories/:id', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    await prisma.userVocab.updateMany({
        where: { userId: req.user.id, categoryId: id },
        data: { categoryId: null },
    });
    await prisma.category.delete({ where: { id } });
    return ok(res, { ok: true });
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

// SRS 카드 여러 개 삭제 (또는 전체 삭제)
app.post('/srs/remove-many', requireAuth, async (req, res) => {
    try {
        const { vocabIds, all } = req.body || {};
        if (all === true) {
            const result = await prisma.sRSCard.deleteMany({
                where: { userId: req.user.id, itemType: 'vocab' },
            });
            return ok(res, { count: result.count });
        }
        if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
            return fail(res, 400, 'vocabIds must be a non-empty array or use all:true');
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

// ---------- Category(Folder) APIs ----------
// ... /categories, /categories/:id, /my-wordbook/assign 다음에 붙이세요.

app.get('/my-wordbook', requireAuth, async (req, res) => {
    const q = req.query.categoryId; // '123' | 'none' | undefined | ''
    const where = { userId: req.user.id };

    if (q === 'none') {
        where.categoryId = null;                 // 미분류만
    } else if (q !== undefined && q !== '') {
        const cid = Number(q);
        if (!Number.isFinite(cid)) return fail(res, 400, 'invalid categoryId');
        where.categoryId = cid;                  // 특정 폴더
    }
    // q가 undefined 또는 ''이면 전체

    const rows = await prisma.userVocab.findMany({
        where,
        include: { vocab: { include: { dictMeta: { select: { ipa: true, ipaKo: true, examples: true } } } } },
        orderBy: { createdAt: 'desc' },
    });
    const words = rows.map(r => r.vocab);
    return ok(res, words);
});


// 카테고리 필터 지원: ?categoryId=123 | ?categoryId=none | (없음/빈문자열=전체)




// ===== Global error handler =====
app.use((err, req, res, next) => {
    console.error(err);
    return fail(res, 500, 'internal error');
});

app.listen(PORT, () => {
    console.log(`API http://localhost:${PORT}`);
});
