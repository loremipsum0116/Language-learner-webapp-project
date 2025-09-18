const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function fixN3Missing() {
  try {
    console.log('🔧 N3 누락된 1번 문제 추가 중...');

    // N3 JSON 파일 읽기
    const jsonPath = path.join(__dirname, '..', '..', 'N3', 'N3_Reading', 'N3_Reading.json');
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const readingData = JSON.parse(rawData);

    // 첫 번째 문제 (id: 1) 찾기
    const firstItem = readingData.find(item => item.id === 1);

    if (!firstItem) {
      console.log('❌ ID 1번 문제를 찾을 수 없습니다.');
      return;
    }

    console.log('📄 찾은 문제:', firstItem);

    // 데이터베이스에 이미 있는지 확인
    const existing = await prisma.reading.findFirst({
      where: {
        levelCEFR: 'N3',
        glosses: {
          path: '$.id',
          equals: 1
        }
      }
    });

    if (existing) {
      console.log('✅ N3-1번 문제가 이미 존재합니다.');
      return;
    }

    // 문제 삽입
    const title = `N3 Japanese Reading Question ${firstItem.id}`;
    const body = firstItem.passage;

    const glosses = {
      id: firstItem.id,
      passage: firstItem.passage,
      question: firstItem.question,
      options: firstItem.options,
      answer: firstItem.answer,
      explanation: firstItem.explanation_ko || firstItem.explanation || null,
      language: 'japanese'
    };

    await prisma.reading.create({
      data: {
        title: title,
        body: body,
        levelCEFR: 'N3',
        glosses: glosses
      }
    });

    console.log('✅ N3-1번 문제 추가 완료!');

    // 확인
    const result = await prisma.reading.count({
      where: {
        levelCEFR: 'N3',
        glosses: {
          path: '$.language',
          equals: 'japanese'
        }
      }
    });

    console.log(`📊 N3 총 문제 수: ${result}개`);

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixN3Missing();