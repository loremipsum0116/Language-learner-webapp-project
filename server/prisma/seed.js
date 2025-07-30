// server/tools/seed.js
require('dotenv').config({ path: '../.env' }); // 상위 폴더의 .env 파일을 로드
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CSV_PATH = path.join(__dirname, '..', 'data', 'A1_vocab.csv');

const HEADERS = ['lemma', 'ko', 'pos', 'gender', 'plural', 'levelCEFR', 'ipa', 'examples'];

// 소문자 -> 대문자 보정 (ex: stadt -> Stadt)
const titlecaseFirst = (s = '') => (s ? s[0].toUpperCase() + s.slice(1) : s);

async function main() {
    console.log('🌱 A1 단어 데이터베이스 시딩을 시작합니다...');

    if (!fs.existsSync(CSV_PATH)) {
        console.error(`❌ 에러: 데이터 파일(${CSV_PATH})을 찾을 수 없습니다.`);
        return;
    }

    const stream = fs.createReadStream(CSV_PATH)
        .pipe(csv({
            headers: HEADERS,
            skipLines: 1 // CSV 파일의 첫 번째 줄(헤더)은 건너뜁니다.
        }));

    for await (const row of stream) {
        const lemma = titlecaseFirst(row.lemma);
        const ko = row.ko;

        if (!lemma || !ko) {
            console.warn('⚠️ lemma 또는 ko가 비어있어 건너뜁니다:', row);
            continue;
        }

        try {
            // 1. Vocab 테이블에 단어 생성 또는 업데이트 (Upsert)
            const vocab = await prisma.vocab.upsert({
                where: { lemma: lemma },
                update: {
                    pos: row.pos || 'UNK',
                    gender: row.gender || null,
                    plural: row.plural || null,
                    levelCEFR: row.levelCEFR || 'A1',
                    source: 'seed-A1', // ★ 이 줄 추가
                },
                create: {
                    lemma: lemma,
                    pos: row.pos || 'UNK',
                    gender: row.gender || null,
                    plural: row.plural || null,
                    levelCEFR: row.levelCEFR || 'A1',
                    source: 'seed-A1', // ★ 이 줄 추가
                },
            });

            // ★ 변경됨: ipa, examples 처리
            let examplesJson = [];
            try {
                // CSV의 예문이 JSON 형식이면 파싱, 아니면 무시
                if (row.examples && row.examples.startsWith('[')) {
                    examplesJson = JSON.parse(row.examples);
                }
            } catch (e) {
                console.warn(`⚠️ 예문(examples) JSON 파싱 실패: ${lemma}`);
            }

            // KO 뜻을 예문 맨 앞에 gloss 형태로 추가 (중복 방지)
            const hasKoGloss = examplesJson.some(ex => ex.kind === 'gloss');
            if (!hasKoGloss) {
                examplesJson.unshift({ de: '', ko: ko, source: 'seed-A1', kind: 'gloss' });
            }

            // 2. DictEntry 테이블에 IPA, 예문 등 상세 정보 주입
            await prisma.dictEntry.upsert({
                where: { vocabId: vocab.id },
                update: { // 이미 존재하면 업데이트
                    ipa: row.ipa || null,
                    examples: examplesJson,
                    attribution: 'Internal Seed',
                    license: 'Proprietary',
                },
                create: { // 없으면 새로 생성
                    vocabId: vocab.id,
                    ipa: row.ipa || null,
                    examples: examplesJson,
                    attribution: 'Internal Seed',
                    license: 'Proprietary',
                },
            });
            console.log(`✅ 처리 완료: ${lemma} -> ${ko}`);
        } catch (e) {
            console.error(`❌ 처리 실패: ${lemma}`, e.message);
        }
    }

    console.log('🌳 시딩 작업이 완료되었습니다.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });