const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function debugB2Missing() {
  try {
    console.log('🔍 B2 리딩 데이터 누락 문제 조사 시작...');

    // 1. B2 JSON 파일 읽기
    const jsonPath = path.join(__dirname, 'B2', 'B2_reading', 'B2_reading.json');
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const b2Data = JSON.parse(rawData);

    console.log(`📄 B2 JSON 파일 총 문제 수: ${b2Data.length}개`);

    // 2. JSON 파일의 ID들 확인
    const jsonIds = b2Data.map(item => item.id).sort((a, b) => a - b);
    console.log(`📋 JSON ID 범위: ${Math.min(...jsonIds)} ~ ${Math.max(...jsonIds)}`);
    console.log(`📋 JSON 중복 ID 확인...`);

    // ID 중복 체크
    const duplicateIds = jsonIds.filter((id, index) => jsonIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      console.log(`⚠️ 중복된 ID들:`, duplicateIds);
    } else {
      console.log(`✅ JSON에서 중복 ID 없음`);
    }

    // 누락된 ID들 찾기
    const missingIds = [];
    for (let i = 1; i <= 300; i++) {
      if (!jsonIds.includes(i)) {
        missingIds.push(i);
      }
    }

    if (missingIds.length > 0) {
      console.log(`❌ JSON에서 누락된 ID들 (${missingIds.length}개):`, missingIds);
    } else {
      console.log(`✅ JSON에서 1-300까지 모든 ID 존재`);
    }

    // 3. 데이터베이스의 B2 데이터 확인
    const dbB2Records = await prisma.reading.findMany({
      where: { levelCEFR: 'B2' },
      select: { id: true, title: true },
      orderBy: { id: 'asc' }
    });

    console.log(`\n🗄️ 데이터베이스 B2 레코드 수: ${dbB2Records.length}개`);

    // 데이터베이스에서 문제 번호 추출 (title에서)
    const dbQuestionNumbers = dbB2Records.map(record => {
      const match = record.title.match(/B2 Reading Question (\d+)/);
      return match ? parseInt(match[1]) : null;
    }).filter(num => num !== null).sort((a, b) => a - b);

    console.log(`📋 DB 문제 번호 범위: ${Math.min(...dbQuestionNumbers)} ~ ${Math.max(...dbQuestionNumbers)}`);

    // 데이터베이스에서 누락된 문제 번호들 찾기
    const missingInDb = [];
    for (let i = 1; i <= 300; i++) {
      if (!dbQuestionNumbers.includes(i)) {
        missingInDb.push(i);
      }
    }

    if (missingInDb.length > 0) {
      console.log(`❌ 데이터베이스에서 누락된 문제 번호들 (${missingInDb.length}개):`, missingInDb);

      // 누락된 문제들이 JSON에는 있는지 확인
      const missingButInJson = missingInDb.filter(num => jsonIds.includes(num));
      if (missingButInJson.length > 0) {
        console.log(`🔄 JSON에는 있지만 DB에는 없는 문제들 (${missingButInJson.length}개):`, missingButInJson);

        // 첫 번째 누락된 문제의 JSON 데이터 확인
        const firstMissing = missingButInJson[0];
        const missingQuestion = b2Data.find(item => item.id === firstMissing);
        if (missingQuestion) {
          console.log(`\n📝 누락된 문제 ${firstMissing} 샘플:`, {
            id: missingQuestion.id,
            passage: missingQuestion.passage ? missingQuestion.passage.substring(0, 100) + '...' : 'NO PASSAGE',
            question: missingQuestion.question || 'NO QUESTION',
            hasOptions: !!missingQuestion.options,
            hasAnswer: !!missingQuestion.answer
          });
        }
      }
    } else {
      console.log(`✅ 데이터베이스에서 1-300까지 모든 문제 존재`);
    }

    // 4. 중복 확인 (제목 기준)
    const duplicateTitles = await prisma.reading.groupBy({
      by: ['title'],
      where: { levelCEFR: 'B2' },
      having: {
        id: {
          _count: {
            gt: 1
          }
        }
      },
      _count: {
        id: true
      }
    });

    if (duplicateTitles.length > 0) {
      console.log(`\n⚠️ DB에서 중복된 제목들 (${duplicateTitles.length}개):`);
      duplicateTitles.forEach(dup => {
        console.log(`  "${dup.title}": ${dup._count.id}개`);
      });
    } else {
      console.log(`\n✅ DB에서 중복 제목 없음`);
    }

  } catch (error) {
    console.error('❌ 디버깅 중 오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugB2Missing();