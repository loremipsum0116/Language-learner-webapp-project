// server/create_vocab/seed_all_b1_ielts.js
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const B1_DIR = path.resolve(__dirname, '..', 'B1');

console.log(`Looking for IELTS files in: ${B1_DIR}`);

if (!fs.existsSync(B1_DIR)) {
    console.error('B1 directory not found:', B1_DIR);
    process.exit(1);
}

// B1 디렉토리의 모든 하위 폴더를 검사
const subDirs = fs.readdirSync(B1_DIR).filter(name => {
    const fullPath = path.join(B1_DIR, name);
    return fs.statSync(fullPath).isDirectory();
});

console.log(`Found ${subDirs.length} subdirectories in B1:`, subDirs);

async function processFile(filePath) {
    return new Promise((resolve, reject) => {
        const relativePath = path.relative(path.resolve(__dirname, '..'), filePath);
        console.log(`\n🔄 Processing: ${relativePath}`);
        
        const child = spawn('node', [
            'server/create_vocab/seed_b1_from_json.js',
            relativePath
        ], {
            stdio: 'inherit',
            cwd: path.resolve(__dirname, '..', '..')
        });

        child.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ Successfully processed: ${path.basename(filePath)}`);
                resolve();
            } else {
                console.error(`❌ Failed to process: ${path.basename(filePath)} (exit code: ${code})`);
                reject(new Error(`Process failed with exit code ${code}`));
            }
        });

        child.on('error', (err) => {
            console.error(`❌ Error spawning process for: ${path.basename(filePath)}`, err);
            reject(err);
        });
    });
}

(async () => {
    const allFiles = [];
    
    // 각 하위 디렉토리에서 ielts_*.json 파일 찾기
    for (const subDir of subDirs) {
        const subDirPath = path.join(B1_DIR, subDir);
        const files = fs.readdirSync(subDirPath).filter(file => 
            file.startsWith('ielts_b1_') && file.endsWith('.json')
        );
        
        for (const file of files) {
            allFiles.push(path.join(subDirPath, file));
        }
    }

    console.log(`\n📋 Found ${allFiles.length} IELTS B1 JSON files to process:`);
    allFiles.forEach((file, index) => {
        console.log(`   ${index + 1}. ${path.basename(file)}`);
    });

    if (allFiles.length === 0) {
        console.log('No IELTS B1 JSON files found to process.');
        return;
    }

    console.log(`\n🚀 Starting batch processing of ${allFiles.length} files...\n`);
    
    let processed = 0;
    let failed = 0;

    for (const file of allFiles) {
        try {
            await processFile(file);
            processed++;
        } catch (error) {
            failed++;
            console.error(`Failed to process ${path.basename(file)}:`, error.message);
        }
    }

    console.log(`\n📊 BATCH PROCESSING COMPLETE:`);
    console.log(`   ✅ Successfully processed: ${processed} files`);
    console.log(`   ❌ Failed: ${failed} files`);
    console.log(`   📁 Total files: ${allFiles.length}`);
    
    if (failed > 0) {
        console.log(`\n⚠️  ${failed} files failed to process. Check the logs above for details.`);
        process.exit(1);
    } else {
        console.log(`\n🎉 All B1 IELTS files have been successfully processed!`);
    }
})().catch(error => {
    console.error('Fatal error during batch processing:', error);
    process.exit(1);
});