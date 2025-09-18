const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function addMissingB231() {
  try {
    console.log('🔧 B2 ID 31 문제 데이터베이스에 추가 시작...');

    // B2 JSON 파일에서 ID 31 문제 찾기
    const jsonPath = path.join(__dirname, 'B2', 'B2_reading', 'B2_reading.json');
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const b2Data = JSON.parse(rawData);

    const id31Question = b2Data.find(item => item.id === 31);

    if (!id31Question) {
      console.error('❌ JSON에서 ID 31을 찾을 수 없습니다!');
      return;
    }

    console.log('✅ JSON에서 ID 31 문제 발견:');
    console.log(`📝 Question: ${id31Question.question.substring(0, 80)}...`);
    console.log(`📄 Passage: ${id31Question.passage.substring(0, 80)}...`);

    // 데이터베이스에 이미 있는지 확인
    const existingRecord = await prisma.reading.findFirst({
      where: {
        levelCEFR: 'B2',
        title: 'B2 Reading Question 31'
      }
    });

    if (existingRecord) {
      console.log('⚠️ 데이터베이스에 이미 B2 Question 31이 존재합니다.');
      return;
    }

    // 새 레코드 생성
    const title = `B2 Reading Question ${id31Question.id}`;
    const body = id31Question.passage;

    const glosses = {
      id: id31Question.id,
      passage: id31Question.passage,
      question: id31Question.question,
      options: id31Question.options,
      answer: id31Question.answer,
      explanation: id31Question.explanation_ko || id31Question.explanation || null
    };

    const newRecord = await prisma.reading.create({
      data: {
        title: title,
        body: body,
        levelCEFR: 'B2',
        glosses: glosses
      }
    });

    console.log(`✅ 성공적으로 추가됨: ID ${newRecord.id}, Title: ${title}`);

    // 확인
    const b2Count = await prisma.reading.count({
      where: { levelCEFR: 'B2' }
    });

    console.log(`📊 현재 B2 레코드 총 개수: ${b2Count}개`);

  } catch (error) {
    console.error('❌ 추가 중 오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addMissingB231();