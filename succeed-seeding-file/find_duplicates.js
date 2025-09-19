// Node.js의 파일 시스템 모듈을 가져옵니다.
const fs = require('fs').promises;

// 출력 파일의 이름을 지정합니다.
const outputFile = 'dup2.txt';
// 분석할 파일 목록입니다.
const inputFiles = ['N5words.txt', 'N4words.txt', 'N3words.txt', 'N2words.txt', 'N1words.txt'];

/**
 * 여러 단어 목록 파일 간의 중복을 찾아 파일에 저장하는 비동기 함수
 */
async function findDuplicatesAcrossFiles() {
    try {
        const wordSets = new Map();
        let finalOutput = ''; // 최종 출력 내용을 저장할 변수

        // 1. 각 파일을 읽어 단어 Set을 생성합니다.
        for (const file of inputFiles) {
            try {
                const data = await fs.readFile(file, 'utf8');
                const lines = data.split(/\r?\n/);

                // 각 줄에서 '번호. 단어' 형식을 처리하여 순수 단어만 추출합니다.
                const words = lines
                    .map(line => line.replace(/^\d+\.\s*/, '').trim()) // 번호, 점, 공백을 제거하고 양쪽 공백도 제거
                    .filter(word => word !== ''); // 처리 후 남은 빈 줄은 제외

                const level = file.match(/N\d/)[0]; // 파일 이름에서 'N5', 'N4' 등 레벨 추출
                wordSets.set(level, new Set(words));
            } catch (error) {
                // 파일이 없는 경우 건너뛰고 콘솔에 메시지를 출력합니다.
                console.warn(`${file} 파일을 찾을 수 없어 건너뜁니다.`);
            }
        }

        const levels = Array.from(wordSets.keys());

        // 2. 모든 파일 쌍(pair)에 대해 중복 단어를 비교하고 찾습니다.
        for (let i = 0; i < levels.length; i++) {
            for (let j = i + 1; j < levels.length; j++) {
                const level1 = levels[i];
                const level2 = levels[j];

                const set1 = wordSets.get(level1);
                const set2 = wordSets.get(level2);

                const duplicates = [];
                // 한쪽 Set을 기준으로 다른쪽에 해당 단어가 있는지 확인하여 중복을 찾습니다.
                for (const word of set1) {
                    if (set2.has(word)) {
                        duplicates.push(word);
                    }
                }

                // 중복 단어가 있는 경우에만 결과 문자열에 추가합니다.
                if (duplicates.length > 0) {
                    finalOutput += `${level1}words.txt 와 ${level2}words.txt 의 중복 단어 (총 ${duplicates.length}개)\n`;
                    finalOutput += `----------------------------------------\n`;
                    finalOutput += duplicates.join('\n');
                    finalOutput += `\n\n`; // 섹션 구분을 위해 두 줄 띄웁니다.
                }
            }
        }

        // 3. 최종 결과를 파일에 씁니다.
        if (finalOutput) {
            await fs.writeFile(outputFile, finalOutput.trim(), 'utf8');
            console.log(`파일 간 중복 단어 분석을 완료하여 ${outputFile} 파일에 저장했습니다.`);
        } else {
            console.log('어떤 파일 간에도 중복된 단어를 찾지 못했습니다.');
        }

    } catch (error) {
        console.error('스크립트 실행 중 오류가 발생했습니다:', error.message);
    }
}

// 스크립트 실행
findDuplicatesAcrossFiles();

