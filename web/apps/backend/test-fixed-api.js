const fetch = require('node-fetch');

async function testFixedAPI() {
  console.log('=== 수정된 API 테스트 ===');

  try {
    // 1. 숙어 테스트
    console.log('\n1. 숙어 테스트:');
    const idiomResponse = await fetch('http://localhost:4000/api/simple-vocab?pos=idiom&limit=5');
    const idiomData = await idiomResponse.json();
    console.log(`   결과: ${idiomData.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   개수: ${idiomData.data?.length || 0}개`);
    if (idiomData.data?.length > 0) {
      console.log(`   예시: "${idiomData.data[0].lemma}"`);
    }

    // 2. 구동사 테스트
    console.log('\n2. 구동사 테스트:');
    const phrasalResponse = await fetch('http://localhost:4000/api/simple-vocab?pos=phrasal%20verb&limit=5');
    const phrasalData = await phrasalResponse.json();
    console.log(`   결과: ${phrasalData.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   개수: ${phrasalData.data?.length || 0}개`);
    if (phrasalData.data?.length > 0) {
      console.log(`   예시: "${phrasalData.data[0].lemma}"`);
    }

    // 3. 전체 개수 테스트
    console.log('\n3. 전체 개수 테스트:');
    const fullIdiomResponse = await fetch('http://localhost:4000/api/simple-vocab?pos=idiom&limit=1000');
    const fullIdiomData = await fullIdiomResponse.json();
    console.log(`   전체 숙어: ${fullIdiomData.data?.length || 0}개`);

    const fullPhrasalResponse = await fetch('http://localhost:4000/api/simple-vocab?pos=phrasal%20verb&limit=1000');
    const fullPhrasalData = await fullPhrasalResponse.json();
    console.log(`   전체 구동사: ${fullPhrasalData.data?.length || 0}개`);

    console.log('\n=== 테스트 완료 ===');
  } catch (error) {
    console.error('API 테스트 중 오류:', error.message);
  }
}

testFixedAPI();