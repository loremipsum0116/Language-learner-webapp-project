# 성공한 시딩 스크립트 모음

이 폴더에는 성공적으로 작동하는 시딩 스크립트들이 있습니다.

## 파일 목록

### 1. seed-cefr-fixed.js
- **용도**: CEFR 단어 시딩 (기본 어휘)
- **데이터 소스**: cefr_vocabs.json
- **테이블**: vocab, VocabTranslation, dictentry, Language
- **특징**: 한국어 번역을 VocabTranslation 테이블에 올바르게 저장

### 2. seed-exam-categories.js
- **용도**: 시험별 필수 단어 시딩
- **데이터 소스**: cefr_vocabs.json의 categories 필드
- **테이블**: exam_categories, vocab_exam_categories
- **생성 카테고리**: TOEIC, TOEFL, IELTS, 수능
- **특징**: 카테고리별 단어 연결 및 개수 자동 업데이트

### 3. seed-idioms-vocab.js
- **용도**: 숙어·구동사 시딩
- **데이터 소스**: idiom.json
- **테이블**: vocab, VocabTranslation, dictentry, Language
- **특징**:
  - vocab 테이블에 source='idiom_migration'으로 저장
  - **오디오 경로 기반 자동 분류** (2025-09-17 수정)
    - `idiom/` 폴더: pos='idiom' (숙어)
    - `phrasal_verb/` 폴더: pos='phrasal verb' (구동사)
    - **핵심 수정**: `idiom.audio.word` 경로 체크 (기존: `idiom.audio` 문자열 체크)
  - **CEFR 레벨 자동 매핑** (2025-09-17 수정)
    - 기초 → A2, 중급 → B1, 중상급 → B2, 고급 → C1
    - category 필드 분석하여 자동 설정
  - 한국어 번역을 VocabTranslation 테이블에 저장
  - 예문과 사용법을 dictentry 테이블에 저장
- **주요 코드 수정**:
  ```javascript
  // 수정 전 (문제 코드)
  if (idiom.audio && typeof idiom.audio === 'string') {
    if (idiom.audio.startsWith('phrasal_verb/')) {
      posType = 'phrasal verb';
    }
  }

  // 수정 후 (올바른 코드)
  if (idiom.audio && idiom.audio.word) {
    if (idiom.audio.word.startsWith('phrasal_verb/')) {
      posType = 'phrasal verb';
    }
  }
  ```

### 4. make_jlpt_audio.py
- **용도**: JLPT 일본어 단어 오디오 생성
- **데이터 소스**: jlpt_n5_vocabs.json
- **출력**: jlpt/n5/{romaji}/ 폴더에 word.mp3, gloss.mp3, example.mp3
- **특징** (2025-09-17 수정):
  - **일본어**: ja-JP-Chirp3-HD 보이스 사용
  - **한국어**: ko-KR-Neural2 보이스 사용 (기존 Chirp3에서 변경)
  - **gloss.mp3**: 일본어 → 1초 대기 → 한국어 뜻 (괄호 완전 제거)
  - **성별 순환**: 남성/여성 보이스 교대로 사용
  - **품사 표시 자동 제거**: exp., v., n., adj. 등 제거
- **주요 코드 변경**:
  ```python
  # 한국어 보이스 변경 (라인 47-49)
  KO_MALE = os.getenv("KO_MALE", "ko-KR-Neural2-C")
  KO_FEMALE = os.getenv("KO_FEMALE", "ko-KR-Neural2-B")

  # 괄호 완전 제거 로직 (라인 121-122)
  s = re.sub(r"[（(][^）)]*[）)]", "", s)  # 기존: 내용 유지 → 변경: 완전 제거

  # 품사 표시 제거에 exp 추가 (라인 125)
  s = re.sub(r"\b(?:exp|pron|n|v|adj|adv|...)\.\s*", "", s, flags=re.I)
  ```

### 5. remake_jlpt_gloss_only.py
- **용도**: 기존 JLPT gloss.mp3 파일만 재생성
- **특징**:
  - 기존 word.mp3 재사용하여 gloss.mp3만 교체
  - 새로운 음성 설정(Neural2) 적용
  - 괄호 및 품사 표시 완전 제거
  - 특정 단어들만 선별적으로 재생성 가능
- **핵심 함수**:
  ```python
  def clean_ko_gloss_strict(text: str) -> str:
      # 품사 표시 제거 (먼저 처리)
      s = re.sub(r"\b(?:exp|pron|n|v|adj|adv|...)\.\s*", "", s, flags=re.I)

      # 괄호 및 내용 완전 제거 (모든 종류)
      s = re.sub(r"[（(【\[]([^）)】\]]*)[）)】\]]", "", s)
      s = re.sub(r"[（(][^）)]*[）)]", "", s)

      return normalize_spaces(s).strip(" ;,·")
  ```
- **사용법**: `python remake_jlpt_gloss_only.py test_words.json`

### 6. jlpt_n5_vocabs.json
- **용도**: JLPT N5 일본어 단어 데이터
- **데이터 형식**: JSON 배열 (502개 항목)
- **포함 정보**:
  - 일본어 단어 (lemma)
  - 가나 읽기 (kana)
  - 로마자 (romaji)
  - 품사 (pos)
  - 한국어 번역 (koGloss)
  - 예문 (example, koExample)
  - 오디오 정보 (audio)
- **시딩 스크립트**: web/apps/backend/seed-jlpt-vocabs.js
- **주요 수정사항** (2025-09-17):
  ```javascript
  // 두 가지 프론트엔드 구조 모두 지원: SRS 폴더용 + 상세페이지용
  // 기존: examples: [{ ja: item.example, ko: item.koExample }]
  // 수정: 하이브리드 구조로 양쪽 모두 호환

  if (item.example && item.koExample) {
    // 1. 상세페이지용 배열 구조 (VocabDetailModal.jsx 호환)
    examplesData.push({
      kind: 'example',
      ja: item.example,        // 일본어 예문
      ko: item.koExample,      // 한국어 해석
      en: item.example,        // SRS 폴더 호환용 (en 필드에도 저장)
      source: 'jlpt_vocabs'
    });

    // 2. SRS 폴더용 객체 구조 (SrsFolderDetail.jsx 호환)
    examplesData.definitions = [
      {
        examples: [
          {
            en: item.example,        // 일본어 예문을 en 필드에 저장
            ko: item.koExample,      // 한국어 해석
            ja: item.example,        // 일본어 원문도 별도 보관
            kind: 'example',
            source: 'jlpt_vocabs'
          }
        ]
      }
    ];
  }
  ```

## 실행 순서

### 🚀 전체 DB 리셋 및 시딩 프로세스 (2025-09-17 수정)

#### 1단계: DB 스키마 준비
```bash
cd web/apps/backend
# VocabTranslation.definition 필드를 TEXT 타입으로 변경
npx prisma db push
```

#### 2단계: DB 완전 리셋
```bash
# 모든 데이터 삭제 및 스키마 재생성
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="네!" npx prisma db push --force-reset
```

#### 3단계: 순차적 시딩 실행

1. **CEFR 기본 어휘 시딩** (9,814개 단어)
   ```bash
   cd web/apps/backend
   node seed-cefr-fixed.js
   ```
   - ✅ 2025-09-17: definition 길이 제한 문제 해결 (TEXT 타입 적용)
   - ✅ 모든 9,814개 단어 완전 시딩 확인

2. **시험별 단어 시딩** (카테고리 분류)
   ```bash
   cd web/apps/backend
   node seed-exam-categories.js
   ```
   - TOEIC: 5,007개 단어
   - TOEFL: 4,016개 단어
   - IELTS: 4,933개 단어
   - 수능: 6,079개 단어

3. **숙어·구동사 시딩** (1,001개 표현)
   ```bash
   cd web/apps/backend
   node seed-idioms-vocab.js
   ```
   - ✅ 2025-09-17: 오디오 경로 기반 자동 분류 구현
   - ✅ 2025-09-17: CEFR 레벨 자동 매핑 구현

4. **JLPT N5 일본어 단어 시딩** (502개 단어)
   ```bash
   cd web/apps/backend
   node seed-jlpt-vocabs.js
   ```
   - ✅ 2025-09-17: 프론트엔드 호환 예문 구조로 수정
   - ✅ SRS 폴더 카드에서 예문 정상 표시 가능

### ⚠️ 중요 사항

- **실행 환경**: 반드시 `web/apps/backend` 디렉토리에서 실행
- **실행 순서 준수**: 위 순서대로 실행해야 데이터 무결성 보장
- **데이터 백업**: 리셋 전 중요 데이터 백업 필수
- **권한 확인**: DB 리셋 시 사용자 동의 필요 (`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` 환경변수)

## 참고사항

- 모든 스크립트는 web/apps/backend 디렉토리에서 실행해야 합니다
- 필요한 JSON 파일들(cefr_vocabs.json, idiom.json)이 같은 디렉토리에 있어야 합니다
- JLPT 시딩을 위해서는 succeed-seeding-file/jlpt_n5_vocabs.json 파일이 필요합니다
- 시딩 전 기존 데이터는 자동으로 삭제됩니다
- Prisma 클라이언트와 MySQL 데이터베이스 연결이 필요합니다

## 시딩 결과 (2025-09-17 최종 확인)

### 📊 완료된 시딩 데이터

- **CEFR 어휘**: **9,814개** 영어 단어 (완전 시딩 확인)
  - A1: 905개 단어
  - A2: 1,557개 단어
  - B1: 2,214개 단어
  - B2: 2,452개 단어
  - C1: 2,686개 단어
  - ✅ **definition 길이 제한 문제 해결**: 모든 단어 완전 시딩

- **시험별 단어**: **21,255개** 카테고리 연결
  - TOEIC: 5,007개 단어
  - TOEFL: 4,016개 단어
  - IELTS: 4,933개 단어
  - 수능: 6,079개 단어

- **숙어·구동사**: **1,001개** 영어 표현
  - ✅ **오디오 경로 기반 자동 분류 적용**:
    - 숙어 (idiom): `idiom/` 경로 기반 분류
    - 구동사 (phrasal verb): `phrasal_verb/` 경로 기반 분류
  - ✅ **CEFR 레벨 자동 매핑**: 기초(A2), 중급(B1), 중상급(B2), 고급(C1)
  - 한국어 번역 및 예문 포함

- **JLPT N5 일본어**: **502개** 일본어 단어
  - 가나 읽기, 로마자 표기 포함
  - 한국어 번역 및 예문 완비
  - 오디오 정보 연결

### 🔧 해결된 주요 문제들 (2025-09-17)

1. **VocabTranslation.definition 길이 제한**: VARCHAR(191) → TEXT 타입으로 변경
2. **숙어/구동사 분류 오류**: 오디오 경로 기반 자동 분류 로직 구현
   - **문제**: `idiom.audio`를 문자열로 체크했으나 실제로는 객체 타입
   - **해결**: `idiom.audio.word` 경로를 체크하도록 수정
   - **결과**: 숙어 424개, 구동사 577개로 올바르게 분류
3. **CEFR 레벨 매핑**: category 필드 분석을 통한 자동 레벨 설정
4. **시딩 데이터 완전성**: 9,814개 모든 CEFR 단어 완전 시딩 확인
5. **일본어 예문 표시 문제**: 프론트엔드 호환성 문제 해결 (2025-09-17 추가)
   - **문제 1**: SRS 폴더 카드에서 일본어 단어 예문이 "예문이 없습니다"로 표시
   - **문제 2**: 일본어 단어 상세페이지에서 예문 및 해석, 예문 오디오 버튼 누락
   - **원인**: 두 페이지가 서로 다른 예문 구조를 기대함
     - SRS 폴더: `definitions[].examples[].en` 구조
     - 상세페이지: `[{ kind: 'example', ja: ..., ko: ... }]` 배열 구조
   - **해결**: 하이브리드 구조로 양쪽 모두 지원하도록 일본어 시딩 수정
   - **결과**: SRS 폴더와 상세페이지 양쪽에서 예문이 정상 표시됨
6. **일본어 스펠링 퀴즈 예문 표시 문제**: 시딩 구조 변경으로 예문이 표시되지 않는 문제 해결 (2025-09-17 추가)
   - **문제**: 일본어 스펠링 퀴즈에서 예문이 나타나지 않고 한국어 뜻만 표시되는 문제
   - **원인**: 시딩 스크립트 수정으로 예문 구조가 변경되었으나 백엔드 퀴즈 서비스가 구 구조를 기대함
   - **해결**: `generateJapaneseFillInBlankQuiz` 함수에서 새로운 하이브리드 구조 지원
     - 배열 구조: `[{ kind: 'example', ja: ..., ko: ... }]`
     - 객체 구조: `definitions[].examples[]` (SRS 폴더용)
     - 기존 구조: `{ example: ..., koExample: ... }` (호환성 유지)
   - **결과**: 일본어 스펠링 퀴즈에서 예문과 한국어 해석이 정상 표시됨

## 일본어 구현 상태 (2025-09-17)

### ✅ 완료된 기능

#### 1. 데이터베이스 시딩
- **JLPT N5 단어 502개 시딩 완료**
- 기존 중복 데이터(jlpt 소스 499개) 정리 완료
- 현재 깨끗한 502개 단어만 유지
- 데이터 구조:
  - `vocab` 테이블: lemma, pos, levelJLPT, source='jlpt_vocabs'
  - `dictentry` 테이블: ipa(가나), ipaKo(로마자), examples(JSON 배열), audioLocal
  - `VocabTranslation` 테이블: 한국어 번역

#### 2. 웹 프론트엔드 표시
- **카드 표면 (JapaneseVocabCard.jsx)**:
  - 일본어 단어 전체 표시 (예: "お先に失礼します")
  - 한자 부분에만 후리가나 표시 (예: お<ruby>先<rt>さき</rt></ruby>에<ruby>失礼<rt>しつれい</rt></ruby>します)
  - 특별 케이스 "お先に失礼します" 수동 매핑 적용
  - 히라가나/가타카나 부분은 후리가나 없이 표시
  - **오디오 재생 버튼 footer에 추가 (2025-09-17)**

- **상세보기 (VocabDetailModal.jsx)**:
  - 제목에서 한자 부분에만 후리가나 표시
  - 예문 및 한국어 해석 표시 (dictentry.examples 배열 파싱)
  - 예문 오디오 버튼 기능 (audioLocal 데이터 파싱)
  - 특별 케이스 "お先に失礼します" 수동 매핑 적용

#### 3. 오디오 기능 (2025-09-17 수정)
- JLPT 단어 오디오 경로 수정 완료
- 경로 형식: `/jlpt/{레벨}/{로마자}/word.mp3`
  - 레벨: 소문자 변환 (N5 → n5)
  - 폴더명: romaji 필드 사용 (없으면 lemma 사용)
  - 예: `/jlpt/n5/asatte/word.mp3`
- playVocabAudio 함수에 일본어 단어 전용 처리 로직 추가
- JapaneseVocabCard에 오디오 재생 버튼 추가 (footer 위치)

### 🔧 해결된 주요 문제들

1. **중복 데이터 문제**: 기존 jlpt 소스와 jlpt_vocabs 소스 중복 → 정리 완료
2. **예문 표시 누락**: dictentry.examples 배열 구조 파싱 로직 추가
3. **후리가나 표시 문제**: 전체 텍스트에 후리가나 → 한자에만 표시
4. **텍스트 누락 문제**: "お先に失礼します" → "お先にします" 축약 → 특별 처리로 해결
5. **오디오 재생 문제**: audioLocal JSON 파싱 로직 구현
6. **오디오 경로 문제** (2025-09-17): URL 인코딩 문제 → romaji 사용으로 해결
7. **오디오 버튼 누락** (2025-09-17): JapaneseVocabCard에 재생 버튼 추가
8. **구동사 탭 빈 결과 문제** (2025-09-17): 백엔드 API pos 매핑 오류 → 수정 완료
9. **CEFR 레벨 Unknown 문제** (2025-09-17): 시딩 스크립트에서 category 기반 자동 매핑 구현
10. **일본어 단어 상세보기 뜻 누락** (2025-09-17): 백엔드와 프론트엔드 필드명 불일치 해결
    - **문제**: 백엔드 `ko_gloss` vs 프론트엔드 `koGloss` 필드명 차이
    - **백엔드**: `web/apps/backend/routes/vocab.js:666` - `ko_gloss: vocabTranslation?.translation || null`
    - **프론트엔드 수정**: `web/apps/frontend/src/components/VocabDetailModal.jsx:656,660`
      ```jsx
      // 수정 전
      {(vocab.koGloss || glossExample?.ko) && (
        <strong>{vocab.koGloss || glossExample?.ko}</strong>

      // 수정 후
      {(vocab.koGloss || vocab.ko_gloss || glossExample?.ko) && (
        <strong>{vocab.koGloss || vocab.ko_gloss || glossExample?.ko}</strong>
      ```
11. **일본어 SRS 퀴즈 후리가나 표시 문제** (2025-09-17): SRS 퀴즈에서 한자 위에 후리가나가 표시되지 않는 문제 해결
    - **문제**: SRS 퀴즈에서 일본어 단어를 보여줄 때 후리가나가 표시되지 않음
    - **원인 1**: `SrsQuiz.jsx`에서 질문 표시 시 `current?.question`을 직접 텍스트로 표시
    - **원인 2**: `generateMcqQuizItems` 함수에서 일본어 히라가나 정보를 `pron` 필드에 포함하지 않음
    - **원인 3**: 히라가나 데이터가 `dictentry.ipa`에 저장되어 있는데 `dictentry.examples`에서 찾고 있었음
    - **해결**:
      ```javascript
      // 프론트엔드 수정 (SrsQuiz.jsx:526-535)
      {quizLanguage === 'ja' ? (
          <div className="display-5 mb-2">
              <FuriganaDisplay
                  kanji={current?.question}
                  kana={current?.pron?.hiragana || current?.pron?.kana}
              />
          </div>
      ) : (
          <h2 className="display-5 mb-2" lang={quizLanguage}>{current?.question ?? '—'}</h2>
      )}

      // 백엔드 수정 (quizService.js:132-140)
      if (isJapanese && vocab.dictentry) {
          // 히라가나는 dictentry.ipa에 저장됨 (seed-jlpt-vocabs.js:151)
          hiragana = vocab.dictentry.ipa;
          // 로마자는 dictentry.ipaKo에 저장됨 (seed-jlpt-vocabs.js:152)
          romaji = vocab.dictentry.ipaKo;
      }
      ```
    - **결과**: 일본어 SRS 퀴즈에서 한자 위에 후리가나가 올바르게 표시됨
12. **일본어 퀴즈 후리가나 표시 문제** (2025-09-17): JapaneseQuiz.jsx에서도 후리가나가 표시되지 않는 문제 해결
    - **문제**: 일반 일본어 퀴즈에서도 한자 위에 후리가나가 표시되지 않음
    - **원인**: `JapaneseQuiz.jsx`에서 일본어 질문을 직접 텍스트로 표시
    - **해결**:
      ```javascript
      // JapaneseQuiz.jsx에 FuriganaDisplay 컴포넌트 추가 (라인 7-116)
      function FuriganaDisplay({ kanji, kana }) {
        // 복잡한 파싱 로직으로 한자 부분에만 후리가나 표시
      }

      // 일본어 질문 표시 로직 수정 (라인 470-485)
      <div className="display-6 mb-3">
          <FuriganaDisplay
              kanji={currentQuiz.question}
              kana={currentQuiz.pron?.hiragana || currentQuiz.pron?.kana}
          />
      </div>
      ```
    - **결과**: 모든 일본어 퀴즈(SRS/일반)에서 한자 위에 후리가나가 올바르게 표시됨
13. **일본어 퀴즈 API 후리가나 데이터 누락 문제** (2025-09-17): generateJapaneseToKoreanQuiz에서 pron 필드에 히라가나 누락
    - **문제**: 일본어 퀴즈 API에서 `pron.hiragana`가 `null`로 전달됨
    - **원인**: `generateJapaneseToKoreanQuiz` 함수에서 `dictentry.ipa`를 로마자 패턴으로만 체크
    - **실제 데이터**: `ipa` 필드에 히라가나(`'おにいさん'`), `ipaKo` 필드에 로마자(`'oniisan'`) 저장
    - **해결**:
      ```javascript
      // quizService.js의 generateJapaneseToKoreanQuiz 함수 수정 (라인 295-306)
      if (!hiragana && vocab.dictentry?.ipa) {
          // ipa 필드에 히라가나가 저장됨 (seed-jlpt-vocabs.js:151)
          hiragana = vocab.dictentry.ipa;
      }

      if (!romaji && vocab.dictentry?.ipaKo) {
          // ipaKo 필드에 로마자가 저장됨 (seed-jlpt-vocabs.js:152)
          romaji = vocab.dictentry.ipaKo;
      }
      ```
    - **결과**: 일본어 퀴즈에서 `pron.hiragana`에 올바른 히라가나 데이터 전달, 후리가나 표시 가능

### 📂 관련 파일들

**백엔드:**
- `web/apps/backend/seed-jlpt-vocabs.js` (시딩 스크립트)
- `succeed-seeding-file/jlpt_n5_vocabs.json` (데이터 파일)

**웹 프론트엔드:**
- `web/apps/frontend/src/components/JapaneseVocabCard.jsx` (카드 표면)
- `web/apps/frontend/src/components/VocabDetailModal.jsx` (상세보기)
- `web/apps/frontend/src/pages/VocabList.jsx` (오디오 재생 로직)

### 🎯 특별 처리 케이스

**"お先に失礼します"** 단어는 복잡한 파싱 로직에서 문제가 발생하여 수동 매핑 적용:
- 카드 표면: お<ruby>先<rt>さき</rt></ruby>に<ruby>失礼<rt>しつれい</rt></ruby>します
- 상세보기: 동일한 형태로 표시
- 전체 텍스트 보존 및 정확한 후리가나 위치

## 📌 최신 업데이트 (2025-09-23)

### 🔥 주요 변경사항

#### 1. 회원가입 승인 시스템 구현
- **15분 자동 로그아웃 제거**: JWT 토큰 만료시간 15분 → 7일로 변경
- **관리자 승인 시스템**: 일반 사용자 회원가입 시 승인 대기 상태
- **super@root.com 특별 권한**: 자동 승인 및 관리자 권한 부여
- **관리자 대시보드 기능 추가**:
  - 승인 대기 중인 사용자 목록 표시
  - 승인/거부 기능 (거부 시 계정 삭제)
  - 실시간 통계 업데이트

#### 2. JLPT 일본어 단어 완전 재시딩 (N1~N5)
- **기존 데이터 완전 삭제**: 502개 구 일본어 단어 삭제
- **신규 시딩 완료**: **총 8,404개** 일본어 단어 시딩
  - **N1**: 3,463개 단어
  - **N2**: 1,834개 단어
  - **N3**: 1,797개 단어
  - **N4**: 636개 단어
  - **N5**: 674개 단어
- **신규 시딩 스크립트**: `seed-jlpt-vocabs-total.js` 생성
- **데이터 소스**: `succeed-seeding-file/jlpt/N*_fixed.json` 활용

#### 3. JLPT 오디오 파일 서빙 수정
- **오디오 파일 복사**: `succeed-seeding-file/jlpt/jlpt/` → `web/apps/backend/public/jlpt/`
- **서버 설정 수정**: Express 정적 파일 경로 수정
- **오디오 재생 정상화**: N1~N5 모든 레벨 오디오 파일 접근 가능

### 📊 현재 일본어 데이터 현황 (2025-09-23)

#### ✅ 완료된 시딩 데이터
- **JLPT 일본어**: **8,404개** 일본어 단어 (N1~N5 전체)
  - 가나 읽기, 로마자 표기 포함
  - 한국어 번역 및 예문 완비
  - 오디오 정보 연결 완료
- **오디오 파일**: 총 **8,404개** 단어별 오디오 세트
  - 각 단어당 3개 파일: `word.mp3`, `gloss.mp3`, `example.mp3`
  - 서버에서 정상 서빙 확인

#### 🔧 해결된 주요 문제들 (2025-09-23)

1. **JWT 토큰 만료 문제**: 15분 자동 로그아웃 → 7일 세션으로 연장
2. **회원가입 보안 강화**: 관리자 승인 시스템으로 무분별한 가입 방지
3. **일본어 데이터 정리**: 기존 중복/불완전 데이터 → 체계적인 8,404개 단어로 정리
4. **오디오 재생 문제**: 서버 경로 오류 → 정적 파일 서빙 정상화
5. **대용량 시딩 최적화**: 배치 처리로 안정적인 대용량 데이터 시딩

### 🚀 신규 시딩 프로세스 (2025-09-23 업데이트)

#### JLPT 전체 레벨 시딩 방법
```bash
cd web/apps/backend

# 1. 기존 일본어 단어 삭제 (선택사항)
node delete-japanese-words.js

# 2. N1~N5 전체 시딩 실행
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="네, 시딩하겠습니다." npx dotenv -e .env -- node seed-jlpt-vocabs-total.js
```

#### 시딩 결과 확인
- **성공 메시지**: "Successfully seeded 8404 Japanese vocabulary items and 8404 translations!"
- **레벨별 통계**: 각 레벨별 시딩된 단어 수 표시
- **오디오 확인**: `http://localhost:4000/jlpt/{레벨}/{romaji}/word.mp3` 접근 가능

### 📁 관련 파일들 (2025-09-23 업데이트)

**백엔드:**
- `web/apps/backend/seed-jlpt-vocabs-total.js` (신규 전체 시딩 스크립트)
- `web/apps/backend/delete-japanese-words.js` (일본어 단어 삭제 스크립트)
- `web/apps/backend/routes/auth.js` (회원가입 승인 시스템)
- `web/apps/backend/services/jwtService.js` (JWT 토큰 만료시간 수정)
- `web/apps/backend/index.js` (JLPT 오디오 정적 파일 서빙 수정)

**프론트엔드:**
- `web/apps/frontend/src/pages/AdminDashboard.jsx` (회원가입 승인 관리 UI)

**데이터 소스:**
- `succeed-seeding-file/jlpt/N1_fixed.json ~ N5_fixed.json` (JLPT 단어 데이터)
- `succeed-seeding-file/jlpt/jlpt/n1/ ~ n5/` (오디오 파일)

## 📌 개발 방향 (2025-09-23 업데이트)

**웹 개발에 집중**
- 모바일 앱 개발 일시 중단
- 웹 프론트엔드 기능 완성도 향상에 집중
- **일본어 학습 기능 완전 구현**: N1~N5 전 레벨 학습 가능
- **사용자 관리 시스템 강화**: 승인 기반 회원가입으로 보안 향상