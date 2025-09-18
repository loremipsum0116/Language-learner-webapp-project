const fs = require('fs');
const path = require('path');

function checkB2Duplicates() {
  try {
    console.log('🔍 B2 JSON 파일 중복 및 누락 상세 조사...');

    // B2 JSON 파일 읽기
    const jsonPath = path.join(__dirname, 'B2', 'B2_reading', 'B2_reading.json');
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const b2Data = JSON.parse(rawData);

    console.log(`📄 총 데이터 개수: ${b2Data.length}개`);

    // ID별로 그룹화
    const idGroups = {};
    b2Data.forEach((item, index) => {
      const id = item.id;
      if (!idGroups[id]) {
        idGroups[id] = [];
      }
      idGroups[id].push({
        index,
        question: item.question ? item.question.substring(0, 50) + '...' : 'NO QUESTION',
        passage: item.passage ? item.passage.substring(0, 50) + '...' : 'NO PASSAGE'
      });
    });

    // 중복된 ID들 확인
    console.log('\n🔍 중복된 ID들:');
    Object.entries(idGroups).forEach(([id, items]) => {
      if (items.length > 1) {
        console.log(`\nID ${id} (${items.length}개):`);
        items.forEach((item, i) => {
          console.log(`  [${i+1}] Index ${item.index}: ${item.question}`);
        });
      }
    });

    // 누락된 ID들 확인
    const existingIds = Object.keys(idGroups).map(id => parseInt(id)).sort((a, b) => a - b);
    const missingIds = [];
    for (let i = 1; i <= 300; i++) {
      if (!existingIds.includes(i)) {
        missingIds.push(i);
      }
    }

    console.log(`\n❌ 누락된 ID들 (${missingIds.length}개):`, missingIds);

    // ID 30, 31, 32 주변 확인
    console.log('\n🔍 ID 30-32 주변 데이터 확인:');
    [30, 31, 32].forEach(id => {
      const found = b2Data.find(item => item.id === id);
      if (found) {
        console.log(`✅ ID ${id}: ${found.question.substring(0, 50)}...`);
      } else {
        console.log(`❌ ID ${id}: 누락됨`);
      }
    });

    // ID 200, 201, 202 주변 확인
    console.log('\n🔍 ID 200-202 주변 데이터 확인:');
    [200, 201, 202].forEach(id => {
      const found = b2Data.filter(item => item.id === id);
      if (found.length > 0) {
        found.forEach((item, i) => {
          console.log(`${found.length > 1 ? '⚠️' : '✅'} ID ${id}${found.length > 1 ? ` [${i+1}]` : ''}: ${item.question.substring(0, 50)}...`);
        });
      } else {
        console.log(`❌ ID ${id}: 누락됨`);
      }
    });

  } catch (error) {
    console.error('❌ 검사 중 오류:', error);
  }
}

checkB2Duplicates();