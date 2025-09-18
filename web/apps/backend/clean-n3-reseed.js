const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function cleanAndReseedN3() {
  try {
    console.log('🧹 N3 일본어 리딩 데이터 정리 및 재시딩 시작...');

    // 1. 기존 N3 일본어 데이터 삭제
    console.log('🗑️ 기존 N3 데이터 삭제 중...');
    const deleteResult = await prisma.reading.deleteMany({
      where: {
        levelCEFR: 'N3',
        glosses: {
          path: '$.language',
          equals: 'japanese'
        }
      }
    });
    console.log(`🗑️ ${deleteResult.count}개 기존 N3 데이터 삭제 완료`);

    // 2. N3 JSON 파일 읽기
    console.log('📖 N3 JSON 파일 읽기 중...');
    const jsonPath = path.join(__dirname, '..', '..', 'N3', 'N3_Reading', 'N3_Reading.json');
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const readingData = JSON.parse(rawData);
    console.log(`📄 JSON 파일에서 ${readingData.length}개 문제 발견`);

    // 3. 데이터 시딩
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < readingData.length; i++) {
      const item = readingData[i];
      try {
        const title = `N3 Japanese Reading Question ${item.id}`;
        const body = item.passage;

        if (!body) {
          console.log(`⚠️ N3-${item.id} 문제의 passage가 없습니다.`);
          failCount++;
          continue;
        }

        const glosses = {
          id: item.id,
          passage: item.passage,
          question: item.question,
          options: item.options,
          answer: item.answer,
          explanation: item.explanation_ko || item.explanation || null,
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

        successCount++;

        if (successCount % 50 === 0) {
          console.log(`  ✅ ${successCount}개 처리 완료...`);
        }
      } catch (error) {
        console.error(`❌ N3-${item.id} 문제 삽입 실패:`, error.message);
        failCount++;
      }
    }

    console.log(`\n🎉 N3 데이터 재시딩 완료!`);
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${failCount}개`);

    // 4. 최종 확인
    const finalCount = await prisma.reading.count({
      where: {
        levelCEFR: 'N3',
        glosses: {
          path: '$.language',
          equals: 'japanese'
        }
      }
    });
    console.log(`📊 최종 N3 문제 수: ${finalCount}개`);

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanAndReseedN3();