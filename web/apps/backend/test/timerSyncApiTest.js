// test/timerSyncApiTest.js
// 타이머 동일화 API 테스트 스크립트

const request = require('supertest');
const express = require('express');

/**
 * API 테스트용 예시 함수
 * 실제 서버에서 테스트할 때 사용
 */
async function testTimerSyncAPI() {
    console.log('\n=== 타이머 동일화 API 테스트 ===\n');

    // 실제 서버 URL (로컬 개발 환경)
    const baseURL = 'http://localhost:3001';
    const subfolderId = 123; // 실제 존재하는 하위 폴더 ID로 변경 필요

    try {
        console.log('1. 타이머 동일화 미리보기 API 테스트');
        console.log(`GET ${baseURL}/srs/timer-sync/preview/${subfolderId}`);

        // 실제 API 호출 코드 (인증 토큰 필요)
        /*
        const previewResponse = await fetch(`${baseURL}/srs/timer-sync/preview/${subfolderId}`, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer YOUR_JWT_TOKEN',
                'Content-Type': 'application/json'
            }
        });

        const previewData = await previewResponse.json();
        console.log('미리보기 결과:', previewData);
        */

        console.log('\n2. 타이머 동일화 실행 API 테스트');
        console.log(`POST ${baseURL}/srs/timer-sync/subfolder/${subfolderId}`);

        // 실제 API 호출 코드 (인증 토큰 필요)
        /*
        const syncResponse = await fetch(`${baseURL}/srs/timer-sync/subfolder/${subfolderId}`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer YOUR_JWT_TOKEN',
                'Content-Type': 'application/json'
            }
        });

        const syncData = await syncResponse.json();
        console.log('동일화 실행 결과:', syncData);
        */

        console.log('\n📝 API 테스트를 위해서는:');
        console.log('1. 서버가 실행 중이어야 합니다 (npm start)');
        console.log('2. 유효한 JWT 토큰이 필요합니다');
        console.log('3. 실제 존재하는 하위 폴더 ID를 사용해야 합니다');
        console.log('4. 주석 처리된 코드를 해제하고 토큰을 입력하세요');

    } catch (error) {
        console.error('❌ API 테스트 실패:', error);
    }
}

/**
 * Postman/Insomnia 등에서 사용할 수 있는 API 요청 예시
 */
function generateAPIExamples() {
    console.log('\n=== API 요청 예시 ===\n');

    const examples = {
        "preview": {
            "method": "GET",
            "url": "/srs/timer-sync/preview/:subfolderId",
            "headers": {
                "Authorization": "Bearer YOUR_JWT_TOKEN",
                "Content-Type": "application/json"
            },
            "description": "타이머 동일화 가능한 카드 그룹들을 미리 확인"
        },
        "execute": {
            "method": "POST",
            "url": "/srs/timer-sync/subfolder/:subfolderId",
            "headers": {
                "Authorization": "Bearer YOUR_JWT_TOKEN",
                "Content-Type": "application/json"
            },
            "description": "실제 타이머 동일화 실행"
        }
    };

    console.log('=== Postman/Insomnia용 요청 예시 ===');
    console.log(JSON.stringify(examples, null, 2));

    console.log('\n=== cURL 명령어 예시 ===');
    console.log(`
# 미리보기 API
curl -X GET "http://localhost:3001/srs/timer-sync/preview/123" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json"

# 동일화 실행 API
curl -X POST "http://localhost:3001/srs/timer-sync/subfolder/123" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json"
    `);
}

/**
 * 예상 응답 형식 예시
 */
function showExpectedResponses() {
    console.log('\n=== 예상 API 응답 예시 ===\n');

    const previewResponse = {
        "success": true,
        "subfolderId": 123,
        "subfolderName": "영어 기초 단어",
        "totalCards": 30,
        "groups": [
            {
                "stage": 1,
                "state": "waiting_correct",
                "cards": [
                    {
                        "id": 456,
                        "stage": 1,
                        "state": "waiting_correct",
                        "waitingUntil": "2025-01-15T10:30:00.000Z",
                        "word": "apple"
                    },
                    {
                        "id": 457,
                        "stage": 1,
                        "state": "waiting_correct",
                        "waitingUntil": "2025-01-15T10:45:00.000Z",
                        "word": "banana"
                    }
                ],
                "canSync": true,
                "timeDifferenceMs": 900000,
                "minTime": "2025-01-15T10:30:00.000Z",
                "maxTime": "2025-01-15T10:45:00.000Z",
                "syncToTime": "2025-01-15T10:30:00.000Z"
            }
        ],
        "syncableGroups": 1,
        "totalSyncableCards": 2,
        "message": "1개 그룹의 2개 카드가 동일화 가능합니다."
    };

    const executeResponse = {
        "success": true,
        "message": "Synchronized 1 groups with 2 total cards",
        "syncedGroups": 1,
        "totalSyncedCards": 2,
        "totalCards": 30,
        "subfolderId": 123,
        "subfolderName": "영어 기초 단어"
    };

    console.log('미리보기 API 응답:');
    console.log(JSON.stringify(previewResponse, null, 2));

    console.log('\n실행 API 응답:');
    console.log(JSON.stringify(executeResponse, null, 2));
}

// 스크립트 직접 실행 시
if (require.main === module) {
    testTimerSyncAPI();
    generateAPIExamples();
    showExpectedResponses();
}

module.exports = {
    testTimerSyncAPI,
    generateAPIExamples,
    showExpectedResponses
};