const fs = require('fs');
const path = require('path');

// 파일 경로 설정
const basePath = 'C:\\Users\\sst70\\OneDrive\\바탕 화면\\Language-learner\\succeed-seeding-file';
const files = [
    { level: 'N5', path: path.join(basePath, 'N5_고유_lemma.txt') },
    { level: 'N4', path: path.join(basePath, 'N4_고유_신규_lemma.txt') },
    { level: 'N3', path: path.join(basePath, 'N3words.txt') },
    { level: 'N2', path: path.join(basePath, 'N2words.txt') },
    { level: 'N1', path: path.join(basePath, 'N1words.txt') }
];

function extractWords(content, hasHeader = false) {
    const lines = content.split('\n');
    const words = [];

    let startIndex = 0;
    if (hasHeader) {
        // 헤더 부분 건너뛰기 (== 라인까지)
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('==') || lines[i].trim() === '') {
                continue;
            } else {
                startIndex = i;
                break;
            }
        }
    }

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '' || line.startsWith('#') || line.includes('==') || line.startsWith('※')) {
            continue;
        }

        // 번호가 있는 형식인지 확인 (N5, N4용)
        const numberedMatch = line.match(/^\s*\d+\.\s*(.+)$/);
        if (numberedMatch) {
            words.push({
                word: numberedMatch[1].trim(),
                originalLine: line,
                lineNumber: i + 1
            });
        } else if (line.trim()) {
            // 번호가 없는 형식 (N3, N2, N1용)
            words.push({
                word: line.trim(),
                originalLine: line,
                lineNumber: i + 1
            });
        }
    }

    return words;
}

function processFiles() {
    console.log('JLPT 레벨별 중복 단어 제거 작업 시작...\n');

    // 모든 파일의 단어를 읽어오기
    const allData = {};
    const wordToFiles = {}; // 단어별로 어떤 파일에 있는지 추적

    for (const file of files) {
        if (!fs.existsSync(file.path)) {
            console.log(`파일을 찾을 수 없습니다: ${file.path}`);
            continue;
        }

        const content = fs.readFileSync(file.path, 'utf8');
        const hasHeader = file.level === 'N5' || file.level === 'N4';
        const words = extractWords(content, hasHeader);

        allData[file.level] = {
            path: file.path,
            content: content,
            words: words,
            hasHeader: hasHeader
        };

        console.log(`${file.level}: ${words.length}개 단어 발견`);

        // 단어별 파일 추적
        words.forEach(wordData => {
            const word = wordData.word;
            if (!wordToFiles[word]) {
                wordToFiles[word] = [];
            }
            wordToFiles[word].push({
                level: file.level,
                lineNumber: wordData.lineNumber,
                originalLine: wordData.originalLine
            });
        });
    }

    // 중복 단어 찾기
    const duplicates = {};
    const duplicateList = [];

    for (const [word, locations] of Object.entries(wordToFiles)) {
        if (locations.length > 1) {
            duplicates[word] = locations;
            duplicateList.push({
                word: word,
                locations: locations
            });
        }
    }

    console.log(`\n중복 단어 ${duplicateList.length}개 발견\n`);

    // duplicate_jlpt.txt 파일 생성
    let duplicateReport = `JLPT 레벨별 중복 단어 목록\n`;
    duplicateReport += `=====================================\n`;
    duplicateReport += `총 중복 단어 수: ${duplicateList.length}개\n\n`;

    duplicateList.forEach((item, index) => {
        const levelList = item.locations.map(loc => loc.level).join(', ');
        duplicateReport += `${index + 1}. "${item.word}" - 발견 레벨: ${levelList}\n`;
        item.locations.forEach(loc => {
            duplicateReport += `   ${loc.level}: 라인 ${loc.lineNumber}\n`;
        });
        duplicateReport += '\n';
    });

    fs.writeFileSync(path.join(basePath, 'duplicate_jlpt.txt'), duplicateReport, 'utf8');
    console.log('duplicate_jlpt.txt 파일이 생성되었습니다.\n');

    // 중복 제거 작업 (높은 N숫자에서 제거, 낮은 N숫자에 유지)
    const removalLog = {};

    for (const [word, locations] of Object.entries(duplicates)) {
        // N숫자로 정렬 (N5 < N4 < N3 < N2 < N1)
        locations.sort((a, b) => {
            const levelOrder = { 'N5': 1, 'N4': 2, 'N3': 3, 'N2': 4, 'N1': 5 };
            return levelOrder[a.level] - levelOrder[b.level];
        });

        // 가장 낮은 레벨(첫 번째)을 제외하고 나머지에서 제거
        for (let i = 1; i < locations.length; i++) {
            const levelToRemove = locations[i].level;
            if (!removalLog[levelToRemove]) {
                removalLog[levelToRemove] = [];
            }
            removalLog[levelToRemove].push({
                word: word,
                lineNumber: locations[i].lineNumber,
                keptIn: locations[0].level
            });
        }
    }

    // 파일별로 중복 단어 제거 및 수정
    for (const [level, removals] of Object.entries(removalLog)) {
        const fileData = allData[level];
        if (!fileData) continue;

        console.log(`${level}에서 ${removals.length}개 중복 단어 제거 중...`);

        const lines = fileData.content.split('\n');
        const wordsToRemove = new Set(removals.map(r => r.word));
        const newLines = [];
        const removedWords = [];

        // 헤더 부분 유지
        if (fileData.hasHeader) {
            let headerEnd = 0;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('==') || lines[i].trim() === '' || lines[i].startsWith('※')) {
                    newLines.push(lines[i]);
                    headerEnd = i;
                } else {
                    break;
                }
            }
        }

        // 단어 부분 처리
        for (let i = fileData.hasHeader ? newLines.length : 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            if (trimmedLine === '' || trimmedLine.startsWith('#')) {
                newLines.push(line);
                continue;
            }

            let wordToCheck = '';
            const numberedMatch = trimmedLine.match(/^\s*\d+\.\s*(.+)$/);
            if (numberedMatch) {
                wordToCheck = numberedMatch[1].trim();
            } else {
                wordToCheck = trimmedLine;
            }

            if (wordsToRemove.has(wordToCheck)) {
                const removal = removals.find(r => r.word === wordToCheck);
                removedWords.push(`"${wordToCheck}" (원래 ${removal.keptIn}에 유지)`);
            } else {
                newLines.push(line);
            }
        }

        // 제거된 단어 목록을 파일 끝에 추가
        if (removedWords.length > 0) {
            newLines.push('');
            newLines.push('=====================================');
            newLines.push(`제거된 중복 단어 목록 (${removedWords.length}개):`);
            newLines.push('=====================================');
            removedWords.forEach((word, index) => {
                newLines.push(`${index + 1}. ${word}`);
            });
        }

        // 파일 저장
        const newContent = newLines.join('\n');
        fs.writeFileSync(fileData.path, newContent, 'utf8');

        console.log(`${level}: ${removedWords.length}개 단어 제거 완료`);
    }

    console.log('\n모든 중복 제거 작업이 완료되었습니다!');
    console.log('각 파일 하단에 제거된 단어 목록이 추가되었습니다.');
}

// 실행
try {
    processFiles();
} catch (error) {
    console.error('오류 발생:', error.message);
}