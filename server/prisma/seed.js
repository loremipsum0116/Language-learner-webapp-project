// server/tools/seed.js
require('dotenv').config({ path: '../.env' });
const { PrismaClient } = require('@prisma/client');
const vocabData = require('../data/A1_vocab.js'); // ★ CSV 대신 JS 파일을 직접 임포트

const prisma = new PrismaClient();

// 소문자 -> 대문자 보정 (ex: stadt -> Stadt)
const titlecaseFirst = (s = '') => (s ? s[0].toUpperCase() + s.slice(1) : s);

async function main() {
    console.log('🌱 A1 단어 데이터베이스 시딩을 시작합니다 (JS 모듈 방식)...');

    // ★ CSV 스트림 대신, JS 배열을 직접 순회합니다.
    for (const row of vocabData) {
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
                    source: 'seed-A1-js',
                },
                create: {
                    lemma: lemma,
                    pos: row.pos || 'UNK',
                    gender: row.gender || null,
                    plural: row.plural || null,
                    levelCEFR: row.levelCEFR || 'A1',
                    source: 'seed-A1-js',
                },
            });

            // ★ 더 이상 JSON.parse가 필요 없습니다. row.examples는 이미 배열입니다.
            const examplesJson = Array.isArray(row.examples) ? row.examples : [];
            
            const hasKoGloss = examplesJson.some(ex => ex.kind === 'gloss');
            if (!hasKoGloss) {
                examplesJson.unshift({ de: '', ko: ko, source: 'seed-A1', kind: 'gloss' });
            }

            // 2. DictEntry 테이블에 상세 정보 주입
            await prisma.dictEntry.upsert({
                where: { vocabId: vocab.id },
                update: {
                    ipa: row.ipa || null,
                    ipaKo: row.ipa_ko || null,
                    audioUrl: row.audioUrl || null,
                    examples: examplesJson,
                    attribution: 'Internal Seed',
                    license: 'Proprietary',
                },
                create: {
                    vocabId: vocab.id,
                    ipa: row.ipa || null,
                    ipaKo: row.ipa_ko || null,
                    audioUrl: row.audioUrl || null,
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
