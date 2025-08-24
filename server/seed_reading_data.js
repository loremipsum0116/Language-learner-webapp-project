// server/seed_reading_data.js
// 리딩 데이터를 데이터베이스에 import

const { prisma } = require('./lib/prismaClient');
const fs = require('fs');
const path = require('path');

async function seedReadingData() {
    try {
        // 기존 리딩 데이터 삭제
        await prisma.reading.deleteMany();
        console.log('✅ 기존 리딩 데이터 삭제 완료');

        const levels = ['A1', 'A2', 'B1', 'B2', 'C2']; // C1 제외, C2 추가
        let totalImported = 0;

        for (const level of levels) {
            const filePath = path.join(__dirname, level, `${level}_reading`, `${level}_reading.json`);
            
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                console.log(`📖 ${level} 리딩 데이터 ${data.length}개 발견`);

                for (const item of data) {
                    try {
                        // body 필드를 매우 짧게 잘라서 저장 (전체 내용은 glosses.fullPassage에 저장)
                        const truncatedBody = item.passage && item.passage.length > 100 
                            ? item.passage.substring(0, 100) + '...' 
                            : item.passage;

                        await prisma.reading.create({
                            data: {
                                levelCEFR: level,
                                title: `${level} Reading ${item.id}`,
                                body: truncatedBody || 'No content',
                                glosses: {
                                    question: item.question,
                                    options: item.options,
                                    correctAnswer: item.answer,
                                    explanation: item.explanation_ko,
                                    fullPassage: item.passage // 전체 지문은 glosses에 저장
                                }
                            }
                        });
                        totalImported++;
                    } catch (error) {
                        console.error(`❌ ${level} 문제 ${item.id} import 실패:`, error.message);
                    }
                }

                console.log(`✅ ${level} 레벨 완료`);
            } else {
                console.log(`⚠️ ${level} 리딩 파일을 찾을 수 없습니다: ${filePath}`);
            }
        }

        console.log(`🎉 리딩 데이터 import 완료: 총 ${totalImported}개`);
    } catch (error) {
        console.error('❌ 리딩 데이터 import 실패:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// 직접 실행된 경우
if (require.main === module) {
    seedReadingData();
}

module.exports = seedReadingData;