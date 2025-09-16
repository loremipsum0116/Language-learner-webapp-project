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
  - 한국어 번역을 VocabTranslation 테이블에 저장
  - 예문과 사용법을 dictentry 테이블에 저장

### 4. jlpt_n5_vocabs.json
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

## 실행 순서

1. **CEFR 기본 어휘 시딩**
   ```bash
   cd web/apps/backend
   node seed-cefr-fixed.js
   ```

2. **시험별 단어 시딩**
   ```bash
   cd web/apps/backend
   node seed-exam-categories.js
   ```

3. **숙어·구동사 시딩**
   ```bash
   cd web/apps/backend
   node seed-idioms-vocab.js
   ```

4. **JLPT N5 일본어 단어 시딩**
   ```bash
   cd web/apps/backend
   node seed-jlpt-vocabs.js
   ```

## 참고사항

- 모든 스크립트는 web/apps/backend 디렉토리에서 실행해야 합니다
- 필요한 JSON 파일들(cefr_vocabs.json, idiom.json)이 같은 디렉토리에 있어야 합니다
- JLPT 시딩을 위해서는 succeed-seeding-file/jlpt_n5_vocabs.json 파일이 필요합니다
- 시딩 전 기존 데이터는 자동으로 삭제됩니다
- Prisma 클라이언트와 MySQL 데이터베이스 연결이 필요합니다

## 시딩 결과

- **CEFR 어휘**: 약 12,000개 영어 단어
- **시험별 단어**: TOEIC, TOEFL, IELTS, 수능 카테고리별 분류
- **숙어·구동사**: 1,001개 영어 표현
- **JLPT N5 일본어**: 502개 일본어 단어 (가나, 한국어 번역, 예문 포함)
- **한국어 번역**: 모든 항목에 대해 제공

## 일본어 구현 상태 (2025-09-16)

### ✅ 완료된 기능

#### 1. 데이터베이스 시딩
- **JLPT N5 단어 502개 시딩 완료**
- 기존 중복 데이터(jlpt 소스 499개) 정리 완료
- 현재 깨끗한 502개 단어만 유지
- 데이터 구조:
  - `vocab` 테이블: lemma, pos, levelJLPT, source='jlpt_vocabs'
  - `dictentry` 테이블: ipa(가나), ipaKo(로마자), examples(JSON 배열), audioLocal
  - `VocabTranslation` 테이블: 한국어 번역

#### 2. 프론트엔드 표시
- **카드 표면 (JapaneseVocabCard.jsx)**:
  - 일본어 단어 전체 표시 (예: "お先に失礼します")
  - 한자 부분에만 후리가나 표시 (예: お<ruby>先<rt>さき</rt></ruby>에<ruby>失礼<rt>しつれい</rt></ruby>します)
  - 특별 케이스 "お先に失礼します" 수동 매핑 적용
  - 히라가나/가타카나 부분은 후리가나 없이 표시

- **상세보기 (VocabDetailModal.jsx)**:
  - 제목에서 한자 부분에만 후리가나 표시
  - 예문 및 한국어 해석 표시 (dictentry.examples 배열 파싱)
  - 예문 오디오 버튼 기능 (audioLocal 데이터 파싱)
  - 특별 케이스 "お先に失礼します" 수동 매핑 적용

#### 3. 오디오 기능
- JLPT 단어 오디오 경로 파싱 (audioLocal JSON 데이터)
- 단어 발음(word), 뜻(gloss), 예문(example) 오디오 지원
- 상세보기에서 예문 오디오 재생 버튼 표시

### 🔧 해결된 주요 문제들

1. **중복 데이터 문제**: 기존 jlpt 소스와 jlpt_vocabs 소스 중복 → 정리 완료
2. **예문 표시 누락**: dictentry.examples 배열 구조 파싱 로직 추가
3. **후리가나 표시 문제**: 전체 텍스트에 후리가나 → 한자에만 표시
4. **텍스트 누락 문제**: "お先に失礼します" → "お先にします" 축약 → 특별 처리로 해결
5. **오디오 재생 문제**: audioLocal JSON 파싱 로직 구현

### 📂 관련 파일들

**백엔드:**
- `web/apps/backend/seed-jlpt-vocabs.js` (시딩 스크립트)
- `succeed-seeding-file/jlpt_n5_vocabs.json` (데이터 파일)

**프론트엔드:**
- `web/apps/frontend/src/components/JapaneseVocabCard.jsx` (카드 표면)
- `web/apps/frontend/src/components/VocabDetailModal.jsx` (상세보기)

### 🎯 특별 처리 케이스

**"お先に失礼します"** 단어는 복잡한 파싱 로직에서 문제가 발생하여 수동 매핑 적용:
- 카드 표면: お<ruby>先<rt>さき</rt></ruby>に<ruby>失礼<rt>しつれい</rt></ruby>します
- 상세보기: 동일한 형태로 표시
- 전체 텍스트 보존 및 정확한 후리가나 위치