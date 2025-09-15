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

## 참고사항

- 모든 스크립트는 web/apps/backend 디렉토리에서 실행해야 합니다
- 필요한 JSON 파일들(cefr_vocabs.json, idiom.json)이 같은 디렉토리에 있어야 합니다
- 시딩 전 기존 데이터는 자동으로 삭제됩니다
- Prisma 클라이언트와 MySQL 데이터베이스 연결이 필요합니다

## 시딩 결과

- **CEFR 어휘**: 약 12,000개 단어
- **시험별 단어**: TOEIC, TOEFL, IELTS, 수능 카테고리별 분류
- **숙어·구동사**: 1,001개 표현
- **한국어 번역**: 모든 항목에 대해 제공