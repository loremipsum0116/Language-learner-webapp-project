const fs = require('fs');

function findDuplicates(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        const wordCounts = {};
        const duplicates = [];

        console.log(`총 라인 수: ${lines.length}`);

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (trimmedLine === '' || trimmedLine.startsWith('#')) {
                return; // 빈 줄이나 주석 건너뛰기
            }

            // 번호와 단어 분리 (예: "1. 悪化" -> "悪化")
            const match = trimmedLine.match(/^\d+\.\s*(.+)$/);
            if (match) {
                const word = match[1].trim();

                if (wordCounts[word]) {
                    wordCounts[word].count++;
                    wordCounts[word].lines.push(index + 1);
                } else {
                    wordCounts[word] = {
                        count: 1,
                        lines: [index + 1]
                    };
                }
            }
        });

        // 중복 단어 찾기
        for (const [word, data] of Object.entries(wordCounts)) {
            if (data.count > 1) {
                duplicates.push({
                    word: word,
                    count: data.count,
                    lines: data.lines
                });
            }
        }

        // 중복 횟수로 정렬
        duplicates.sort((a, b) => b.count - a.count);

        console.log(`\n=== 중복 단어 분석 결과 ===`);
        console.log(`총 단어 수: ${Object.keys(wordCounts).length}`);
        console.log(`중복 단어 수: ${duplicates.length}`);

        if (duplicates.length > 0) {
            console.log(`\n=== 중복 단어 목록 ===`);
            duplicates.forEach((item, index) => {
                console.log(`${index + 1}. "${item.word}" - ${item.count}회 (라인: ${item.lines.join(', ')})`);
            });

            // 중복 단어만 따로 파일로 저장
            const duplicateWordsOnly = duplicates.map(item => `${item.word} (${item.count}회)`).join('\n');
            fs.writeFileSync('C:\\Users\\sst70\\OneDrive\\바탕 화면\\Language-learner\\duplicate_words.txt', duplicateWordsOnly, 'utf8');
            console.log(`\n중복 단어 목록이 duplicate_words.txt 파일로 저장되었습니다.`);
        } else {
            console.log('\n중복 단어가 없습니다.');
        }

    } catch (error) {
        console.error('파일 읽기 오류:', error.message);
    }
}

// 실행
const filePath = 'C:\\Users\\sst70\\OneDrive\\바탕 화면\\Language-learner\\succeed-seeding-file\\JLPTtotal.txt';
findDuplicates(filePath);