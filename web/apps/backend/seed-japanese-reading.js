const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function seedJapaneseReadingData() {
  try {
    console.log('📚 일본어 리딩 데이터 시딩 시작...');

    // 기존 일본어 리딩 데이터 삭제
    await prisma.reading.deleteMany({
      where: {
        levelCEFR: { startsWith: 'N' }
      }
    });
    console.log('✅ 기존 일본어 리딩 데이터 삭제 완료');

    let globalId = 6000; // 전역 ID 카운터

    const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];
    let totalCount = 0;

    for (const level of levels) {
      console.log(`\n📖 ${level} 레벨 일본어 리딩 데이터 처리 중...`);

      // JSON 파일 경로 설정
      const possiblePaths = [
        path.join(__dirname, level, `${level}_Reading`, `${level.toLowerCase()}_reading.json`),
        path.join(__dirname, level, `${level}_Reading`, `${level}_reading.json`),
        path.join(__dirname, level, `${level}_Reading`, `${level}_Reading.json`)
      ];

      let jsonPath = null;
      for (const tryPath of possiblePaths) {
        if (fs.existsSync(tryPath)) {
          jsonPath = tryPath;
          break;
        }
      }

      if (!jsonPath) {
        console.log(`⚠️ ${level} 리딩 파일을 찾을 수 없습니다`);
        continue;
      }

      // JSON 파일 읽기
      const rawData = fs.readFileSync(jsonPath, 'utf8');
      const readingData = JSON.parse(rawData);

      // N 레벨들의 경우 passage.txt에서 슬래시 포함된 지문 읽기
      let passageData = {};
      if (level.startsWith('N')) {
        const possiblePassagePaths = [
          path.join(__dirname, level, `${level}_Reading`, `${level}_passage.txt`),
          path.join(__dirname, level, `${level}_Reaidng`, `${level}_passage.txt`) // N2의 경우 오타가 있는 폴더명
        ];

        let passagePath = null;
        for (const tryPath of possiblePassagePaths) {
          if (fs.existsSync(tryPath)) {
            passagePath = tryPath;
            break;
          }
        }

        if (passagePath) {
          const passageContent = fs.readFileSync(passagePath, 'utf8');
          const passageEntries = passageContent.split('\n\n').filter(entry => entry.trim());

          passageEntries.forEach(entry => {
            const lines = entry.trim().split('\n');
            const idLine = lines.find(line => line.startsWith('ID:'));
            const passageLine = lines.find(line => line.startsWith('Passage:'));

            if (idLine && passageLine) {
              const id = parseInt(idLine.replace('ID:', '').trim());
              const passage = passageLine.replace('Passage:', '').trim();
              passageData[id] = passage;
            }
          });

          console.log(`📄 ${level} passage.txt에서 ${Object.keys(passageData).length}개 지문 로드`);
        }
      }

      console.log(`📄 ${level} 파일에서 ${readingData.length}개 항목 발견`);

      // 각 항목 처리
      for (const item of readingData) {
        try {
          // 복수 질문 구조 확인 (N1, N2 후반부)
          const hasMultipleQuestions = item.question1 !== undefined;

          if (hasMultipleQuestions) {
            // 복수 질문 구조 처리
            let questionCount = 1;
            while (item[`question${questionCount}`]) {
              globalId++; // 전역 ID 증가

              const glosses = {
                question: item[`question${questionCount}`],
                options: item[`options${questionCount}`],
                correctAnswer: item[`answer${questionCount}`],
                explanation: item[`explanation${questionCount}`] || item[`explanation_ko${questionCount}`]
              };

              // passage.txt가 있는 경우 해당 데이터 사용, 없으면 JSON의 passage 사용
              const passageText = (level.startsWith('N') && passageData[item.id])
                ? passageData[item.id]
                : item.passage;

              await prisma.reading.create({
                data: {
                  id: globalId,
                  title: `${level} Reading Q${questionCount}`,
                  body: passageText,
                  levelCEFR: level,
                  glosses: glosses
                }
              });

              totalCount++;
              console.log(`  ✅ ${level}-${item.id}-Q${questionCount} 문제 추가 완료 (ID: ${globalId})`);
              questionCount++;
            }
          } else {
            // 단일 질문 구조 처리 (N5, N4, N3, N2 전반부)
            globalId++; // 전역 ID 증가

            const glosses = {
              question: item.question,
              options: item.options,
              correctAnswer: item.answer,
              explanation: item.explanation_ko || item.explanation
            };

            // passage.txt가 있는 경우 해당 데이터 사용, 없으면 JSON의 passage 사용
            const passageText = (level.startsWith('N') && passageData[item.id])
              ? passageData[item.id]
              : item.passage;

            await prisma.reading.create({
              data: {
                id: globalId,
                title: `${level} Reading`,
                body: passageText,
                levelCEFR: level,
                glosses: glosses
              }
            });

            totalCount++;
            console.log(`  ✅ ${level}-${item.id} 문제 추가 완료 (ID: ${globalId})`);
          }
        } catch (error) {
          console.error(`❌ ${level} 항목 ${item.id} 처리 실패:`, error.message);
        }
      }

      console.log(`✅ ${level} 레벨 완료`);
    }

    console.log(`\n🎉 일본어 리딩 데이터 시딩 완료!`);
    console.log(`📊 총 ${totalCount}개 문제가 데이터베이스에 추가되었습니다.`);

    // 결과 확인
    const result = await prisma.reading.findMany({
      select: {
        id: true,
        levelCEFR: true
      },
      where: {
        levelCEFR: { startsWith: 'N' }
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