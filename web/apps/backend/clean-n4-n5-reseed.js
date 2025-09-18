const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function cleanAndReseedN4N5() {
  try {
    console.log('🧹 N4, N5 일본어 리딩 데이터 정리 및 재시딩 시작...');

    // 각 레벨 처리
    const levels = ['N5', 'N4'];

    for (const level of levels) {
      console.log(`\n📖 ${level} 레벨 처리 중...`);

      // 1. 기존 데이터 삭제
      console.log(`🗑️ 기존 ${level} 데이터 삭제 중...`);
      const deleteResult = await prisma.reading.deleteMany({
        where: {
          levelCEFR: level,
          glosses: {
            path: '$.language',
            equals: 'japanese'
          }
        }
      });
      console.log(`🗑️ ${deleteResult.count}개 기존 ${level} 데이터 삭제 완료`);

      // 2. JSON 파일 경로 설정
      let jsonPath;
      if (level === 'N5') {
        jsonPath = path.join(__dirname, level, `${level}_Reading`, `${level}_reading.json`);
      } else {
        jsonPath = path.join(__dirname, level, `${level}_Reading`, `${level}_Reading.json`);
      }

      // 3. 파일 존재 확인
      if (!fs.existsSync(jsonPath)) {
        console.log(`⚠️ ${level} 리딩 파일을 찾을 수 없습니다: ${jsonPath}`);
        continue;
      }

      // 4. JSON 파일 읽기
      console.log(`📖 ${level} JSON 파일 읽기 중...`);
      const rawData = fs.readFileSync(jsonPath, 'utf8');
      const readingData = JSON.parse(rawData);
      console.log(`📄 JSON 파일에서 ${readingData.length}개 문제 발견`);

      // 5. 데이터 시딩
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < readingData.length; i++) {
        const item = readingData[i];
        try {
          const title = `${level} Japanese Reading Question ${item.id}`;
          const body = item.passage;

          if (!body) {
            console.log(`⚠️ ${level}-${item.id} 문제의 passage가 없습니다.`);
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
              levelCEFR: level,
              glosses: glosses
            }
          });

          successCount++;

          if (successCount % 50 === 0) {
            console.log(`  ✅ ${successCount}개 처리 완료...`);
          }
        } catch (error) {
          console.error(`❌ ${level}-${item.id} 문제 삽입 실패:`, error.message);
          failCount++;
        }
      }

      console.log(`\n🎉 ${level} 데이터 재시딩 완료!`);
      console.log(`✅ 성공: ${successCount}개`);
      console.log(`❌ 실패: ${failCount}개`);

      // 6. 최종 확인
      const finalCount = await prisma.reading.count({
        where: {
          levelCEFR: level,
          glosses: {
            path: '$.language',
            equals: 'japanese'
          }
        }
      });
      console.log(`📊 최종 ${level} 문제 수: ${finalCount}개`);
    }

    // 전체 현황 확인
    console.log('\n📋 전체 일본어 리딩 데이터 현황:');
    for (const level of ['N5', 'N4', 'N3', 'N2', 'N1']) {
      const count = await prisma.reading.count({
        where: {
          levelCEFR: level,
          glosses: {
            path: '$.language',
            equals: 'japanese'
          }
        }
      });
      console.log(`  📖 ${level}: ${count}개 문제`);
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanAndReseedN4N5();