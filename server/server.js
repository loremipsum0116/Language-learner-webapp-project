// server/server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { prisma } = require('./db/prisma');

const app = express();

// ===== Config =====
const PORT = 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
const COOKIE_NAME = 'token';
const SLIDING_MINUTES = 15;

app.use(cookieParser());
app.use(express.json());
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));


// ===== Helpers =====
function signToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role || 'USER' },
        JWT_SECRET,
        { expiresIn: `${SLIDING_MINUTES}m` }
    );
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
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        // sliding refresh
        setAuthCookie(res, signToken(decoded));
        next();
    } catch {
        return res.status(401).json({ error: 'Unauthorized' });
    }
}

// ===== Auth =====
app.post('/auth/register', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: 'email already exists' });

    const passwordHash = await bcrypt.hash(password, 11);
    const user = await prisma.user.create({
        data: { email, passwordHash, role: 'USER', profile: { level: 'A2', tone: 'formal', address: 'Sie' } },
        select: { id: true, email: true, role: true, profile: true }
    });

    setAuthCookie(res, signToken(user));
    res.json({ data: user });
});

app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });

    const payload = { id: user.id, email: user.email, role: user.role };
    setAuthCookie(res, signToken(payload));
    res.json({ data: { id: user.id, email: user.email, role: user.role, profile: user.profile } });
});

app.post('/auth/logout', (req, res) => { clearAuthCookie(res); res.json({ data: { ok: true } }); });

app.get('/me', requireAuth, async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, email: true, role: true, profile: true }
    });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    res.json({ data: user });
});
app.get('/vocab/search', async (req, res) => {
    const q = (req.query.q || '').trim();
    const level = (req.query.level || '').trim();
    const where = {
        ...(q ? { lemma: { contains: q, mode: 'insensitive' } } : {}),
        ...(level ? { levelCEFR: level } : {}),
    };
    const items = await prisma.vocab.findMany({
        where,
        take: 20,
        orderBy: [{ freq: 'asc' }, { lemma: 'asc' }],
        include: { dictMeta: true }
    });
    res.json({ data: items });
});
app.post('/vocab/:id/bookmark', requireAuth, async (req, res) => {
    const vid = Number(req.params.id);
    const vocab = await prisma.vocab.findUnique({ where: { id: vid } });
    if (!vocab) return res.status(404).json({ error: 'vocab not found' });

    // 중복 방지: 같은 아이템이 이미 카드에 있으면 재사용
    const existing = await prisma.sRSCard.findFirst({
        where: { userId: req.user.id, itemType: 'vocab', itemId: vid }
    });
    if (existing) return res.json({ data: existing });

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
    res.json({ data: card });
});

app.patch('/me', requireAuth, async (req, res) => {
    const payload = req.body?.profile || req.body || {};
    const { level, tone, address } = payload;
    const ALLOWED_LEVEL = ['A1', 'A2', 'B1', 'B2', 'C1'];
    const ALLOWED_TONE = ['formal', 'friendly'];
    const ALLOWED_ADDRESS = ['du', 'Sie'];
    if (level && !ALLOWED_LEVEL.includes(level)) return res.status(422).json({ error: 'invalid level' });
    if (tone && !ALLOWED_TONE.includes(tone)) return res.status(422).json({ error: 'invalid tone' });
    if (address && !ALLOWED_ADDRESS.includes(address)) return res.status(422).json({ error: 'invalid address' });

    const user = await prisma.user.update({
        where: { id: req.user.id },
        data: { profile: { ...(payload || {}) } },
        select: { id: true, email: true, role: true, profile: true }
    });
    res.json({ data: user });
});

// ===== SRS: 스케줄러 + 큐 =====
function scheduleNext(stage, result) {
    // Leitner 변형: 0→1d, 1→3d, 2→7d, 3→16d, 4→35d
    const intervals = [1, 3, 7, 16, 35];
    let newStage = stage || 0;
    if (result === 'pass') newStage = Math.min(newStage + 1, intervals.length - 1);
    else if (result === 'fail') newStage = Math.max(newStage - 1, 0);

    const days = intervals[newStage];
    const next = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return { newStage, nextReviewAt: next };
}

app.get('/srs/queue', requireAuth, async (req, res) => {
    const limit = Number(req.query.limit || 10);
    const now = new Date();
    const cards = await prisma.sRSCard.findMany({
        where: { userId: req.user.id, nextReviewAt: { lte: now } },
        orderBy: { nextReviewAt: 'asc' },
        take: limit
    });

    // vocab 카드에 한해 상세정보 조인
    const vocabIds = cards.filter(c => c.itemType === 'vocab').map(c => c.itemId);
    const vocabMap = {};
    if (vocabIds.length) {
        const vocabs = await prisma.vocab.findMany({
            where: { id: { in: vocabIds } },
            include: { dictMeta: true }
        });
        vocabs.forEach(v => { vocabMap[v.id] = v; });
    }

    const enriched = cards.map(c => ({
        ...c,
        detail: c.itemType === 'vocab' ? vocabMap[c.itemId] || null : null
    }));

    res.json({ data: enriched, meta: { count: enriched.length } });
});


app.post('/srs/answer', requireAuth, async (req, res) => {
    const { cardId, result } = req.body || {};
    if (!cardId) return res.status(400).json({ error: 'cardId required' });
    if (!['pass', 'fail'].includes(result)) return res.status(400).json({ error: 'result must be "pass" | "fail"' });

    const card = await prisma.sRSCard.findUnique({ where: { id: Number(cardId) } });
    if (!card || card.userId !== req.user.id) return res.status(404).json({ error: 'card not found' });

    const { newStage, nextReviewAt } = scheduleNext(card.stage, result);
    const updated = await prisma.sRSCard.update({
        where: { id: card.id },
        data: { stage: newStage, nextReviewAt, lastResult: result }
    });
    res.json({ data: updated });
});

// ===== Dict/Reading (목 그대로 유지) =====
app.get('/dict/search', async (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ entries: [] });

    // 우선 DB 조회 → 없으면 간단 목
    const hits = await prisma.vocab.findMany({
        where: { lemma: { contains: q, mode: 'insensitive' } },
        take: 5,
        include: { dictMeta: true }
    });

    if (hits.length) {
        const entries = hits.map(v => ({
            lemma: v.lemma,
            pos: v.pos,
            gender: v.gender,
            ipa: v.dictMeta?.ipa,
            audio: v.dictMeta?.audioLocal || v.dictMeta?.audioUrl || null,
            license: v.dictMeta?.license || null,
            attribution: v.dictMeta?.attribution || null,
            examples: Array.isArray(v.dictMeta?.examples) ? v.dictMeta.examples : []
        }));
        return res.json({ entries });
    }

    // fallback 목
    const fallback = [
        {
            lemma: 'stehen', pos: 'V', gender: null, ipa: 'ˈʃteːən', audio: null, license: 'CC BY-SA', attribution: 'Wiktionary',
            examples: [{ de: 'Ich stehe früh auf.', ko: '나는 일찍 일어난다.', cefr: 'A2' }]
        },
        {
            lemma: 'Haus', pos: 'N', gender: 'das', ipa: 'haʊ̯s', audio: null, license: 'CC BY-SA', attribution: 'Wiktionary',
            examples: [{ de: 'Das Haus ist groß.', ko: '그 집은 크다.', cefr: 'A1' }]
        }
    ].filter(e => e.lemma.toLowerCase().includes(q.toLowerCase()));
    res.json({ entries: fallback });
});

app.get('/reading/list', (req, res) => {
    res.json({
        data: [
            { id: 1, title: 'Mein Tag', levelCEFR: 'A1' },
            { id: 2, title: 'Berliner Geschichte', levelCEFR: 'B1' },
            { id: 3, title: 'Umwelt und Politik', levelCEFR: 'B2' }
        ]
    });
});

app.post('/tutor/chat', requireAuth, (req, res) => {
    res.json({
        de_answer: 'Das klingt gut. Achten Sie auf die Verbzweitstellung im Hauptsatz.',
        ko_explain: '좋습니다. 주절에서는 동사가 두 번째 위치에 와야 합니다.',
        tips: ['주어 뒤 동사 위치 확인', '종속절에서는 동사가 문장 끝'],
        refs: ['kb:V2', 'kb:Subclause-Vfinal', 'dict:stehen'],
    });
});

app.get('/', (req, res) => {
    res.type('html').send('<h1>Mock API</h1><p>/auth/*, /me, /srs/*, /dict/search, /reading/list</p>');
});

app.listen(PORT, () => console.log(`API http://localhost:${PORT}`));
