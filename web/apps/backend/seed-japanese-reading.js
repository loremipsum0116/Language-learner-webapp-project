const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function seedJapaneseReadingData() {
  try {
    console.log('📚 일본어 리딩 데이터 시딩 시작...');

    // 기존 Japanese reading 테이블 구조 확인
    console.log('📋 기존 Japanese reading 테이블 구조를 확인합니다...');

    const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];
    let totalCount = 0;

    for (const level of levels) {
      console.log(`\n📖 ${level} 레벨 일본어 리딩 데이터 처리 중...`);

      // JSON 파일 경로 설정 (web 디렉토리에서 검색)
      let jsonPath;
      if (level === 'N5') {
        jsonPath = path.join(__dirname, level, `${level}_Reading`, `${level}_reading.json`);
      } else if (level === 'N3') {
        jsonPath = path.join(__dirname, '..', '..', level, `${level}_Reading`, `${level}_Reading.json`);
      } else {
        jsonPath = path.join(__dirname, level, `${level}_Reading`, `${level}_Reading.json`);
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

      // 기존 Reading 테이블에 일본어 데이터 삽입 (levelCEFR 필드에 JLPT 레벨 저장)
      for (let i = 0; i < readingData.length; i++) {
        const item = readingData[i];
        try {
          // Reading 테이블에 맞는 구조로 데이터 생성
          const title = `${level} Japanese Reading Question ${item.id}`;
          const body = item.passage; // 지문 내용

          const glosses = {
            id: item.id,
            passage: item.passage,
            question: item.question,
            options: item.options,
            answer: item.answer,
            explanation: item.explanation_ko || item.explanation || null,
            language: 'japanese' // 일본어 구분용
          };

          // Reading 테이블에 저장 (levelCEFR에 JLPT 레벨 저장)
          await prisma.reading.create({
            data: {
              title: title,
              body: body,
              levelCEFR: level, // N1, N2, N3를 levelCEFR 필드에 저장
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

    console.log(`\n🎉 일본어 리딩 데이터 시딩 완료!`);
    console.log(`📊 총 ${totalCount}개 문제가 데이터베이스에 추가되었습니다.`);

    // 결과 확인 (일본어 데이터만 조회)
    const result = await prisma.reading.findMany({
      select: {
        id: true,
        title: true,
        levelCEFR: true,
        glosses: true
      },
      where: {
        glosses: {
          path: '$.language',
          equals: 'japanese'
        }
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
seedJapaneseReadingData();