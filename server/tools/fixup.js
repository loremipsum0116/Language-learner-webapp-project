// server/tools/fixup.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 소문자→대문자 보정
const titlecaseFirst = (s='') => s ? s[0].toUpperCase() + s.slice(1) : s;

async function deleteDummies() {
  const dummies = ['asdsad', 'qwe', 'test', 'zzz'];
  const res = await prisma.vocab.deleteMany({
    where: { lemma: { in: dummies } }
  });
  console.log(`[cleanup] 삭제된 더미 lemma 수: ${res.count}`);
}

async function ensureExamples(lemma, examples) {
  // lemma 대소문자 모두 고려해서 탐색
  const cand = await prisma.vocab.findMany({
    where: { lemma: { contains: lemma } },
    include: { dictMeta: true }
  });

  // 정확 일치 우선
  let vocab = cand.find(v => v.lemma.toLowerCase() === lemma.toLowerCase());

  if (!vocab) {
    // 없으면 대문자 보정으로 생성
    vocab = await prisma.vocab.create({
      data: { lemma: titlecaseFirst(lemma), pos: 'UNK', levelCEFR: 'A1' }
    });
    console.log(`[seed] 새 Vocab 생성: ${vocab.lemma} (#${vocab.id})`);
  } else if (vocab.lemma !== titlecaseFirst(vocab.lemma)) {
    // casing 보정(선택)
    vocab = await prisma.vocab.update({
      where: { id: vocab.id },
      data: { lemma: titlecaseFirst(vocab.lemma) }
    });
    console.log(`[fix] lemma 대소문자 보정: ${vocab.lemma} (#${vocab.id})`);
  }

  const exist = await prisma.dictEntry.findUnique({ where: { vocabId: vocab.id } });
  if (!exist) {
    await prisma.dictEntry.create({
      data: {
        vocabId: vocab.id,
        ipa: null,
        audioUrl: null,
        audioLocal: null,
        license: 'CC BY-SA',
        attribution: 'Wiktionary/Wikimedia',
        examples
      }
    });
    console.log(`[seed] dictMeta 생성 + 예문 주입: ${vocab.lemma}`);
  } else {
    // examples 없으면 주입, 있으면 덮어쓰지 않고 병합(간단)
    const prev = Array.isArray(exist.examples) ? exist.examples : [];
    const merged = prev.length ? prev : examples;
    await prisma.dictEntry.update({
      where: { vocabId: vocab.id },
      data: { examples: merged }
    });
    console.log(`[fix] dictMeta 예문 보정: ${vocab.lemma} (prev:${prev.length}, now:${merged.length})`);
  }
}

async function main() {
  await deleteDummies();

  // 최소 샘플 보강: Stadt / Haus / stehen
  await ensureExamples('Stadt', [
    { de: 'Die Stadt ist groß.', ko: '그 도시는 크다.', cefr: 'A1', source: 'seed' },
    { de: 'Ich wohne in der Stadt.', ko: '나는 도시에서 산다.', cefr: 'A2', source: 'seed' }
  ]);

  await ensureExamples('Haus', [
    { de: 'Das Haus ist alt.', ko: '그 집은 오래되었다.', cefr: 'A1', source: 'seed' }
  ]);

  await ensureExamples('stehen', [
    { de: 'Ich stehe früh auf.', ko: '나는 일찍 일어난다.', cefr: 'A2', source: 'seed' }
  ]);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
