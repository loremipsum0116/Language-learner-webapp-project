const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function seedReadingData() {
  try {
    console.log('📚 영어 리딩 데이터 시딩 시작...');

    // 기존 reading 테이블 구조 확인
    console.log('📋 기존 reading 테이블 구조를 확인합니다...');

    const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];
    let totalCount = 0;

    for (const level of levels) {
      console.log(`\n📖 ${level} 레벨 리딩 데이터 처리 중...`);

      // JSON 파일 경로 설정
      let jsonPath;
      if (level === 'C1') {
        jsonPath = path.join(__dirname, level, `${level}_Reading`, `${level}_reading.json`);
      } else {
        jsonPath = path.join(__dirname, level, `${level}_reading`, `${level}_reading.json`);
      }

      // 파일 존재 확인
      if (!fs.existsSync(jsonPath)) {
        console.log(`⚠️ ${level} 리딩 파일을 찾을 수 없습니다: ${jsonPath}`);
        continue;
      }

      // JSON 파일 읽기
      const rawData = fs.readFileSync(jsonPath, 'utf8');
      const readingData = JSON.parse(rawData);

      console.log(`📄 ${level} 파일에서 ${readingData.length}개 문제 발견`);

      // 기존 reading 테이블 구조에 맞게 데이터 삽입
      for (let i = 0; i < readingData.length; i++) {
        const item = readingData[i];
        try {
          // reading 테이블에 맞는 구조로 데이터 생성
          // title: 문제 제목 (passage의 첫 부분 사용)
          // body: passage + 문제 + 옵션들을 JSON으로 저장
          // levelCEFR: 레벨
          // glosses: 문제 데이터를 JSON으로 저장

          const title = `${level} Reading Question ${item.id}`;
          const body = item.passage; // 이제 LongText로 전체 passage 저장 가능

          const glosses = {
            id: item.id,
            passage: item.passage,
            question: item.question,
            options: item.options,
            answer: item.answer,
            explanation: item.explanation_ko || item.explanation || null
          };

          await prisma.reading.create({
            data: {
              title: title,
              body: body,
              levelCEFR: level,
              glosses: glosses
            }
          });
          totalCount++;

          console.log(`  ✅ ${level}-${item.id} 문제 추가 완료`);
        } catch (error) {
          console.error(`❌ ${level} 문제 ${item.id} 삽입 실패:`, error.message);
        }
      }

      console.log(`✅ ${level} 레벨 완료`);
    }

    console.log(`\n🎉 영어 리딩 데이터 시딩 완료!`);
    console.log(`📊 총 ${totalCount}개 문제가 데이터베이스에 추가되었습니다.`);

    // 결과 확인
    const result = await prisma.reading.findMany({
      select: {
        id: true,
        title: true,
        levelCEFR: true
      }
    });

    console.log('\n📋 시딩된 데이터 요약:');
    const levelCounts = {};
    result.forEach(item => {
      levelCounts[item.levelCEFR] = (levelCounts[item.levelCEFR] || 0) + 1;
    });

    Object.entries(levelCounts).forEach(([level, count]) => {
      console.log(`  📖 ${level}: ${count}개 문제`);
    });

  } catch (error) {
    console.error('❌ 시딩 중 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 스크립트 실행
seedReadingData();