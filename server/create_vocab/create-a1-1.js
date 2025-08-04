// server/create_vocab/seed_ielts_json.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 파일 경로를 올바르게 수정합니다.
// 스크립트 위치: server/create_vocab
// JSON 파일 위치: server/A1
// 따라서 상위 디렉토리로 이동(..) 후 A1 디렉토리로 진입해야 합니다.
const file = path.join(__dirname, '..', 'A1', 'ielts_a1_1.json');

const titlecaseFirst = (s = '') => (s ? s[0].toUpperCase() + s.slice(1) : s);

// ★★★★★ 하드코딩된 한국어 뜻과 예문 해석 데이터 ★★★★★
const koreanData = {
    "book": {
        gloss: "책",
        examples: [
            { ko: "그는 책에서 공룡에 대한 어떤 것도 찾을 수 없어서 좌절했다." }
        ]
    },
    "friend": {
        gloss: "친구",
        examples: [
            { ko: "존과 나는 대학 시절 룸메이트였을 때부터 친구였다." }
        ]
    },
    "go": {
        gloss: "가다",
        examples: [
            { ko: "네 차례야." }
        ]
    },
    "school": {
        gloss: "학교",
        examples: [
            { ko: "다이버들은 거대한 고등어 떼를 만났다." }
        ]
    },
    "student": {
        gloss: "학생",
        examples: [
            { ko: "그는 삶의 학생이다." }
        ]
    },
    "teacher": {
        gloss: "교사",
        examples: []
    },
    "water": {
        gloss: "물",
        examples: [
            { ko: "전기의 작용으로 물은 산소와 수소 두 부분으로 분해되었다." }
        ]
    },
    "time": {
        gloss: "시간",
        examples: [
            { ko: "시간은 누구를 위해서도 멈추지 않는다." }
        ]
    },
    "people": {
        gloss: "사람들",
        examples: [
            { ko: "어젯밤 식당에 사람들이 너무 많았다." }
        ]
    },
    "world": {
        gloss: "세계",
        examples: [
            { ko: "세상 끝까지 언제나 연인들은 있을 것이다." }
        ]
    },
    "ask": {
        gloss: "묻다, 요청하다",
        examples: [
            { ko: "이것이 큰 부탁인 것을 알지만..." }
        ]
    },
    "become": {
        gloss: "되다",
        examples: [
            { ko: "많은 사람들이 굶주려야 할 지경에 이르렀다." }
        ]
    },
    "begin": {
        gloss: "시작하다",
        examples: [
            { ko: "모두가 여기에 있으니, 이제 발표를 시작해야 한다." }
        ]
    },
    "call": {
        gloss: "부르다, 전화하다",
        examples: [
            { ko: "오늘 여러 통의 전화를 받았다." }
        ]
    },
    "can": {
        gloss: "~할 수 있다",
        examples: [
            { ko: "그녀는 영어, 프랑스어, 독일어를 할 수 있다." }
        ]
    },
    "come": {
        gloss: "오다",
        examples: [
            { ko: "그녀가 올 때면 산 주위를 돌아서 올 것이다." }
        ]
    },
    "do": {
        gloss: "하다",
        examples: [
            { ko: "내 생일을 축하하기 위해 토요일에 작은 파티를 할 거야." }
        ]
    },
    "feel": {
        gloss: "느끼다",
        examples: [
            { ko: "나무껍질은 거친 느낌을 준다." }
        ]
    },
    "find": {
        gloss: "찾다",
        examples: [
            { ko: "나는 내 차 키를 찾았다. 그것들은 소파 밑에 있었다." }
        ]
    },
    "get": {
        gloss: "얻다, 받다",
        examples: [
            { ko: "나는 내일 할인점에서 컴퓨터를 한 대 살 거야." }
        ]
    },
    "give": {
        gloss: "주다",
        examples: [
            { ko: "그의 독단적인 종교적 신념에는 융통성이 없다." }
        ]
    },
    "have": {
        gloss: "가지다",
        examples: [
            { ko: "나는 집과 차가 있다." }
        ]
    },
    "hear": {
        gloss: "듣다",
        examples: [
            { ko: "나는 귀가 먹었었는데, 이제 들을 수 있다." }
        ]
    },
    "help": {
        gloss: "돕다",
        examples: [
            { ko: "숙제 좀 도와줘." }
        ]
    },
    "keep": {
        gloss: "유지하다, 지키다",
        examples: [
            { ko: "그는 숙식을 제공받는 조건으로 구두장이의 제자로 일한다." }
        ]
    },
    "know": {
        gloss: "알다",
        examples: [
            { ko: "그는 무언가 끔찍한 일이 일어날 것을 알았다." }
        ]
    },
    "leave": {
        gloss: "떠나다",
        examples: []
    },
    "let": {
        gloss: "허락하다, ~하게 하다",
        examples: [
            { ko: "그가 몇 시간 동안 문을 두드린 후에야, 나는 그를 들어오게 하기로 결정했다." }
        ]
    },
    "like": {
        gloss: "좋아하다, ~와 같은",
        examples: [
            { ko: "네가 좋아하는 것과 싫어하는 것을 말해줘." }
        ]
    },
    "live": {
        gloss: "살다",
        examples: [
            { ko: "그는 몇 달 이상 살지 못할 것으로 예상된다." }
        ]
    },
    "make": {
        gloss: "만들다",
        examples: [
            { ko: "어떤 브랜드의 차를 운전하니?" }
        ]
    },
    "may": {
        gloss: "~일지도 모른다",
        examples: [
            { ko: "밖에 나가서 담배를 피워도 좋다." }
        ]
    },
    "mean": {
        gloss: "의미하다",
        examples: [
            { ko: "그녀는 어젯밤 그에게 말한 것을 정말로 의미한 것일까?" }
        ]
    },
    "move": {
        gloss: "움직이다",
        examples: [
            { ko: "키를 살짝만 움직여도 배는 항로를 벗어날 것이다." }
        ]
    },
    "need": {
        gloss: "필요하다",
        examples: [
            { ko: "나는 항상 음식, 옷, 주거지 외에는 욕구가 거의 없으려 노력했다." }
        ]
    },
    "play": {
        gloss: "놀다, 연주하다",
        examples: [
            { ko: "아이들은 놀이를 통해 배운다." }
        ]
    },
    "put": {
        gloss: "두다, 놓다",
        examples: [
            { ko: "그는 자신의 내기에서 위험을 회피하기 위해 프록터 앤드 갬블에 대한 1월 '08 풋옵션(80달러)을 샀다." }
        ]
    },
    "run": {
        gloss: "달리다",
        examples: [
            { ko: "나는 방금 아침 달리기를 마치고 돌아왔다." }
        ]
    }
};

(async () => {
    try {
        const jsonData = fs.readFileSync(file, 'utf8');
        const vocabList = JSON.parse(jsonData);

        let upserted = 0;

        for (const r of vocabList) {
            const lemma = (r.lemma || '').trim();
            if (!lemma) continue;

            const existingVocab = await prisma.vocab.findUnique({
                where: { lemma },
                include: { dictMeta: true }
            });
            
            // ★★★★★ 수정된 부분 ★★★★★
            // 기존 단어가 없는 경우, upsert에서 생성하도록 합니다.
            // existingVocab이 null일 경우를 처리해야 합니다.
            const existingExamples = existingVocab?.dictMeta?.examples ?
                (Array.isArray(existingVocab.dictMeta.examples) ? existingVocab.dictMeta.examples : []) :
                [];

            const hardcoded = koreanData[lemma.toLowerCase()];
            const newExamples = [];
            
            if (hardcoded?.gloss) {
                newExamples.push({
                    ko: hardcoded.gloss,
                    de: r.definition,
                    kind: 'gloss',
                    source: 'ielts-api-seed'
                });
            }
            if (hardcoded?.examples) {
                for (const ex of hardcoded.examples) {
                    newExamples.push({
                        de: r.example,
                        ko: ex.ko,
                        audioUrl: r.audioUrl,
                        source: 'ielts-api-seed'
                    });
                }
            }

            const finalExamples = [...existingExamples, ...newExamples];
            const finalAudioUrl = r.audioUrl || existingVocab?.dictMeta?.audioUrl || null;
            
            const vocab = await prisma.vocab.upsert({
                where: { lemma: titlecaseFirst(lemma) },
                update: {
                    pos: r.pos || 'UNK',
                    levelCEFR: r.levelCEFR || 'A1',
                    source: 'seed-ielts-api'
                },
                create: {
                    lemma: titlecaseFirst(lemma),
                    pos: r.pos || 'UNK',
                    levelCEFR: r.levelCEFR || 'A1',
                    source: 'seed-ielts-api'
                }
            });

            await prisma.dictEntry.upsert({
                where: { vocabId: vocab.id },
                update: {
                    audioUrl: finalAudioUrl,
                    examples: finalExamples
                },
                create: {
                    vocabId: vocab.id,
                    ipa: null,
                    ipaKo: null,
                    audioUrl: finalAudioUrl,
                    examples: finalExamples,
                    license: 'Proprietary',
                    attribution: 'ielts-api'
                }
            });

            upserted++;
        }

        console.log(`Done. upserted=${upserted}`);
    } catch (e) {
        console.error('Error during seeding:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
})();
