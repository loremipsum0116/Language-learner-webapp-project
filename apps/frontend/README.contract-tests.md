# Contract Testing with Pact.js

이 프로젝트는 Pact.js를 사용한 컨트랙트 테스팅을 구현하여 클라이언트와 서버 간의 API 계약을 검증합니다.

## 🎯 개요

컨트랙트 테스팅은 마이크로서비스 및 API 기반 애플리케이션에서 서비스 간의 상호작용을 안정적으로 테스트하는 방법입니다. 이 프로젝트에서는 React 클라이언트와 Express 서버 간의 API 계약을 검증합니다.

## 📁 프로젝트 구조

```
web/
├── src/tests/contracts/              # Consumer contract tests
│   ├── auth.consumer.test.js         # Authentication API contracts
│   ├── vocab.consumer.test.js        # Vocabulary API contracts
│   └── srs.consumer.test.js          # SRS API contracts
├── src/tests/setup/
│   └── contracts.js                  # Consumer test setup
├── server/tests/contracts/           # Provider contract tests
│   ├── auth.pact.test.js            # Authentication provider verification
│   ├── vocab.pact.test.js           # Vocabulary provider verification
│   └── srs.pact.test.js             # SRS provider verification
├── server/tests/setup/
│   ├── contracts.js                 # Provider test setup
│   └── pact-env.js                  # Environment configuration
├── pacts/                           # Generated contract files
├── jest.config.contracts.js         # Client contract test config
├── server/jest.config.contracts.js  # Server contract test config
└── .github/workflows/contract-tests.yml # CI/CD pipeline
```

## 🚀 설치 및 설정

### 1. 의존성 설치

```bash
# Client dependencies
cd web
npm install --save-dev @pact-foundation/pact

# Server dependencies
cd web/server
npm install --save-dev @pact-foundation/pact @pact-foundation/pact-node
```

### 2. 환경 변수 설정

`.env.test` 파일에 다음 환경 변수를 추가:

```env
# Pact Broker Configuration (옵션)
PACT_BROKER_BASE_URL=http://localhost:9292
PACT_BROKER_TOKEN=your_broker_token

# Test Database
TEST_DATABASE_URL=postgresql://localhost:5432/language_learner_test

# JWT Secrets for testing
JWT_SECRET=test_jwt_secret
JWT_REFRESH_SECRET=test_refresh_secret
```

## 🧪 테스트 실행

### Consumer Contract Tests (클라이언트)

```bash
cd web
npm run test:contract:consumer
```

### Provider Contract Tests (서버)

```bash
cd web/server
npm run test:contract:provider
```

### 모든 Contract Tests

```bash
# Client
cd web
npm run test:contract:all

# Server
cd web/server
npm run test:contract:all
```

## 📋 구현된 Contract Tests

### 1. Authentication API
- **Consumer Tests**: `src/tests/contracts/auth.consumer.test.js`
- **Provider Tests**: `server/tests/contracts/auth.pact.test.js`

**테스트 시나리오:**
- ✅ 유효한 자격 증명으로 로그인
- ❌ 잘못된 자격 증명으로 로그인 실패
- ✅ 새 사용자 등록
- ❌ 기존 이메일로 등록 실패
- ✅ 유효한 리프레시 토큰으로 토큰 갱신
- ❌ 잘못된 리프레시 토큰으로 갱신 실패

### 2. Vocabulary API
- **Consumer Tests**: `src/tests/contracts/vocab.consumer.test.js`
- **Provider Tests**: `server/tests/contracts/vocab.pact.test.js`

**테스트 시나리오:**
- ✅ 단어장 목록 조회
- ✅ 레벨별 단어 필터링
- ✅ 새 단어 추가
- ❌ 인증 없이 단어 추가 실패
- ✅ 기존 단어 수정
- ❌ 존재하지 않는 단어 수정 실패
- ✅ 단어 삭제
- ❌ 존재하지 않는 단어 삭제 실패

### 3. SRS (Spaced Repetition System) API
- **Consumer Tests**: `src/tests/contracts/srs.consumer.test.js`
- **Provider Tests**: `server/tests/contracts/srs.pact.test.js`

**테스트 시나리오:**
- ✅ 복습할 단어 목록 조회
- ✅ 복습할 단어가 없는 경우
- ✅ 정답으로 복습 결과 제출
- ✅ 오답으로 복습 결과 제출
- ✅ 사용자 학습 통계 조회
- ✅ SRS 아이템 초기화
- ❌ 존재하지 않는 아이템 초기화 실패

## 🔄 CI/CD 통합

GitHub Actions를 통해 자동화된 컨트랙트 테스트가 실행됩니다:

1. **Consumer Tests**: React 클라이언트의 컨트랙트 테스트 실행
2. **Contract Generation**: Pact 파일 생성 및 아티팩트 업로드
3. **Provider Tests**: Express 서버의 컨트랙트 검증
4. **Can I Deploy**: 배포 가능 여부 확인 (Pact Broker 사용 시)
5. **Deployment Recording**: 배포 기록 (Pact Broker 사용 시)

## 📊 Pact Broker 통합

Pact Broker를 사용하면 다음과 같은 추가 기능을 활용할 수 있습니다:

- 컨트랙트 버전 관리
- 배포 가능 여부 확인
- 컨트랙트 변경 추적
- 웹 UI를 통한 컨트랙트 시각화

## 🛠️ 개발 가이드

### 새로운 API 엔드포인트 추가 시

1. **Consumer Test 작성**:
   ```javascript
   // src/tests/contracts/new-api.consumer.test.js
   describe('New API Consumer Tests', () => {
     it('should handle new endpoint', async () => {
       await provider.addInteraction({
         state: 'some initial state',
         uponReceiving: 'a request to new endpoint',
         withRequest: { /* request specification */ },
         willRespondWith: { /* expected response */ }
       });
       
       const result = await NewAPI.callEndpoint();
       expect(result).toMatchExpectedFormat();
     });
   });
   ```

2. **Provider Test 작성**:
   ```javascript
   // server/tests/contracts/new-api.pact.test.js
   const opts = {
     stateHandlers: {
       'some initial state': () => {
         return Promise.resolve(setupTestData());
       }
     }
   };
   ```

### Provider State 관리

Provider 테스트에서는 각 상태에 대해 적절한 테스트 데이터를 설정해야 합니다:

```javascript
stateHandlers: {
  'user exists with valid credentials': async () => {
    // 테스트 사용자 생성
    await createTestUser();
  },
  'no data exists': async () => {
    // 데이터 정리
    await clearTestData();
  }
}
```

## 🔍 디버깅

### 테스트 실패 시 확인사항

1. **Contract 파일 확인**: `pacts/` 디렉토리의 JSON 파일
2. **로그 확인**: `logs/` 디렉토리의 로그 파일
3. **Provider State**: 올바른 테스트 데이터가 설정되었는지 확인
4. **Request/Response Format**: API 스펙과 일치하는지 확인

### 유용한 명령어

```bash
# Pact 파일 수동 검증
npx pact verify --pact-urls ./pacts/contract.json --provider-base-url http://localhost:3001

# 상세 로그와 함께 테스트 실행
DEBUG=pact* npm run test:contract:provider
```

## 📚 참고 자료

- [Pact.js Documentation](https://docs.pact.io/implementation_guides/javascript/)
- [Contract Testing Best Practices](https://docs.pact.io/best_practices/)
- [Pact Broker Documentation](https://docs.pact.io/pact_broker/)

## 🤝 기여하기

새로운 API 엔드포인트를 추가하거나 기존 테스트를 개선할 때는:

1. Consumer 테스트를 먼저 작성
2. Provider 테스트와 State Handler 추가
3. CI/CD 파이프라인에서 테스트 확인
4. 문서 업데이트