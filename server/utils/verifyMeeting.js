// server/utils/verifyMeeting.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyMeetingWord() {
    try {
        const vocab = await prisma.$queryRaw`
            SELECT v.id, v.lemma, d.examples
            FROM vocab v 
            LEFT JOIN dictentry d ON v.id = d.vocabId 
            WHERE v.lemma = 'Meeting'
        `;
        
        if (vocab.length > 0) {
            console.log('Meeting 단어 최종 상태:');
            console.log('ID:', vocab[0].id);
            console.log('Examples count:', vocab[0].examples ? vocab[0].examples.length : 0);
            console.log('Ko_def:', vocab[0].examples?.[0]?.definitions?.[0]?.ko_def || 'NONE');
            console.log('Examples structure:');
            console.log(JSON.stringify(vocab[0].examples, null, 2));
        } else {
            console.log('Meeting 단어를 찾을 수 없습니다.');
        }
        
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

// 직접 실행
if (require.main === module) {
    verifyMeetingWord();
}

module.exports = verifyMeetingWord;