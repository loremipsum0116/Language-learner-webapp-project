const mysql = require('mysql2/promise');
require('dotenv').config();

// 변경된 51개 항목의 ID들을 저장할 배열 (로그에서 추출된 단어들)
const changedWords = [
  '×', 'あ', 'ああ', 'あいかわらず', 'アイスクリーム', 'アイデア', 'アイデア',
  'あいにく', 'あいまい', 'アイロン', 'アウト', 'あかちゃん', 'あきれる',
  'アクセサリー', 'アクセル', 'アクセント', 'あくどい', 'あくび', 'あげる',
  'あげる', 'あさって', 'あざ笑う', 'アジア', 'あした', 'あそこ', 'あたりまえ',
  'あちこち', 'あちらこちら', 'あっ', 'あっさり', 'あっち', 'アップ', 'あてはまる',
  'あてはめる', 'あと', 'アナウンサー', 'あなた', 'あの', 'アパート', 'あひる',
  'アフリカ', 'あぶる', 'あふれる', 'アプローチ', 'あべこべ', 'アマチュア',
  'あまり', 'アメリカ', 'あやふや'
];

async function rollbackAudioPaths() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'tlagustjr!23',
    database: 'deutsch_learner'
  });

  try {
    console.log('🔄 잘못 변경된 오디오 경로 롤백 시작...\n');

    let rollbackCount = 0;

    for (const lemma of changedWords) {
      console.log(`🔄 처리 중: ${lemma}`);

      try {
        const [rows] = await connection.execute(
          'SELECT d.id, d.audioLocal FROM dictentry d JOIN vocab v ON d.vocabId = v.id WHERE v.lemma = ?',
          [lemma]
        );

        for (const row of rows) {
          const audioLocal = JSON.parse(row.audioLocal);
          let needsRollback = false;
          const newAudioLocal = { ...audioLocal };

          // /jlpt/로 시작하는 경로를 public/jlpt/로 되돌리기
          for (const [type, path] of Object.entries(audioLocal)) {
            if (path && path.startsWith('/jlpt/')) {
              newAudioLocal[type] = `public${path}`;
              needsRollback = true;
            }
          }

          if (needsRollback) {
            await connection.execute(
              'UPDATE dictentry SET audioLocal = ? WHERE id = ?',
              [JSON.stringify(newAudioLocal), row.id]
            );
            console.log(`  ✅ 롤백 완료`);
            rollbackCount++;
          }
        }

      } catch (error) {
        console.error(`  ❌ 에러: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 롤백 결과:');
    console.log(`  ✅ 롤백된 항목: ${rollbackCount}개`);

  } finally {
    await connection.end();
  }
}

rollbackAudioPaths()
  .then(() => {
    console.log('\n🎉 롤백 완료!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  });