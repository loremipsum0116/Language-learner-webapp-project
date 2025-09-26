# 📚 Language Learner Web Project / 言語学習ウェブプロジェクト

[日本語](#japanese) | [한국어](#korean)

---

<a id="japanese"></a>

## 🌟 プロジェクト概要

高度な**フルスタック言語学習プラットフォーム**で、英語・日本語学習をサポートする包括的な教育テクノロジーシステムです。間隔反復学習アルゴリズム（SRS）、マルチプラットフォーム対応、音声統合機能を備えたエンタープライズ級のウェブアプリケーションとして開発されました。

> 💡 **実用的な学習プラットフォーム**: このアプリケーションは開発者自身がJLPT試験対策に毎日活用している**実際に使用中**の学習ツールです。リアルユーザーとしての観点から継続的に改善・最適化を行っています。

### 🎯 主要特徴

- **🧠 高度な間隔反復システム（SRS）**: カスタム学習アルゴリズムによる効率的な記憶定着
- **📱 マルチプラットフォーム対応**: Web、React (Native、Expo対応モバイルアプリ >> still hasn't developed!!)
- **🗣️ 音声統合システム**: Google Cloud Storage + Text-to-Speech API統合
- **📊 学習分析**: 詳細な進捗追跡と適応学習システム
- **🌍 多言語サポート**: 英語（CEFR）・日本語（JLPT）完全対応
- **📚 JLPT対応**: [JLPT-VOCAB-API](https://github.com/wkei/jlpt-vocab-api)ベース + 生成AI活用による独自JLPT語彙システム
- **☁️ クラウドファースト**: Google Cloud、Vercel、Railway対応デプロイ

---

## 🏗️ アーキテクチャ

### システム構成

```
language-learner-web-project/
├── web/                          # Webアプリケーション（メイン）
│   ├── apps/
│   │   ├── backend/              # Express.js API サーバー
│   │   ├── frontend/             # React SPA
│   │   └── mobile/               # React Native アプリ
│   └── packages/
│       └── core/                 # 共有ビジネスロジック（TypeScript）
├── app/                          # Expo モバイルアプリ
│   └── LanguageLearnerAppSimple/ # Expo SDK統合
└── docs/                         # プロジェクトドキュメント
```

### 技術スタック

#### 🖥️ バックエンド
- **ランタイム**: Node.js 18+ + Express.js 4.21
- **データベース**: MySQL + Prisma ORM 5.22.0
- **認証**: JWT + Refresh Token + bcrypt
- **クラウド**: Google Cloud Storage（音声ファイル）
- **キャッシュ**: Redis + node-cache（多層キャッシング）
- **キュー**: BullMQ（バックグラウンド処理）
- **API**: RESTful設計 + Swagger文書化

#### 🎨 フロントエンド
- **フレームワーク**: React 19.1.1 + TypeScript
- **ルーティング**: React Router DOM v7
- **UI**: Bootstrap 5.3.7 + Bootstrap Icons
- **状態管理**: React Context API + カスタムフック
- **通知**: React Toastify
- **ビルド**: Webpack + Bundle Analyzer

#### 📱 モバイル
1. **React Native**（/web/apps/mobile）
   - React Native 0.75.4
   - クロスプラットフォーム（iOS/Android）

2. **Expo**（/app/LanguageLearnerAppSimple）
   - Expo SDK ~53 + React Native 0.79.6
   - 音声再生（expo-av）+ 音声合成（expo-speech）
   - ハプティックフィードバック + オフラインストレージ

#### 🔧 共有パッケージ
- **アーキテクチャ**: Clean Architecture + Domain-Driven Design
- **検証**: Zod スキーマバリデーション
- **型安全性**: TypeScript strict mode

---

## 🗄️ データベース設計

### コアエンティティ（Prisma Schema）

```prisma
// ユーザー管理
model User {
  id          Int     @id @default(autoincrement())
  email       String  @unique
  password    String
  name        String?
  // ... その他のフィールド
}

// 間隔反復システム
model SrsCard {
  id            Int      @id @default(autoincrement())
  userId        Int
  stage         Int      @default(0)
  nextReviewAt  DateTime
  folderId      Int?
  // ... 学習アルゴリズム関連
}

// 語彙管理
model Vocab {
  id         Int     @id @default(autoincrement())
  lemma      String  // 見出し語
  pos        String? // 品詞
  levelCEFR  String? // CEFR レベル（英語）
  levelJLPT  String? // JLPT レベル（日本語）
  languageId Int
  // ... 関連データ
}
```

### 主要機能
- **学習進捗**: `DailyStudyStat`, `StudySession`で詳細トラッキング
- **コンテンツ管理**: `reading`, `readingRecord`, `listeningRecord`で構造化学習
- **多言語対応**: `Language`, `VocabTranslation`で完全国際化
- **品質管理**: `CardReport`, `WrongAnswer`でコンテンツ改善
- **4技能統合**: 読解·聴解·語彙·文法の総合学習システム

---

## 🚀 主要機能

### 📖 学習システム
- **間隔反復学習**: 科学的根拠に基づく復習スケジューリング
- **JLPT対策語彙**: [JLPT-VOCAB-API](https://github.com/wkei/jlpt-vocab-api)のN5-N1語彙JSONをベースに、生成AI活用で韓国語翻訳・音声・例文を独自拡張
- **語彙管理**: 個人単語帳 + カテゴリ分類
- **実用性重視**: 開発者自身のJLPT学習経験をもとにした機能設計

#### 📚 読解練習 (Reading Comprehension)
- **CEFR準拠**: A1-C2レベル別構造化テキスト
- **JLPT対応**: N5-N1レベル専用日本語読解問題
- **進捗管理**: 個別問題解答記録・統計分析
- **理解度測定**: 文章内容把握・語彙理解・文法適用テスト

#### 🎧 聴解練習 (Listening Comprehension)
- **多段階システム**: 基礎リスニング → JLPT聴解対策
- **音声統合**: GCS連携高品質音声ファイル配信
- **スクリプト提供**: 音声-文字同期学習支援
- **誤答分析**: リスニング弱点パターン自動判別
- **録音・再生**: 発音練習機能統合

#### 🔧 文法演習
- **構造化学習**: 段階別文法項目体系화
- **実践応用**: 文脈内文法使用練習
- **誤答ノート**: 문법별 약점 집중 복습 시스템

### 🎯 アセスメント
- **クイズシステム**: 選択式・記述式問題
- **適応学習**: パフォーマンスベースコンテンツ調整
- **進捗分析**: 学習曲線・弱点分析
- **マスタリー追跡**: 習熟度レベル管理

### 🔊 音声機能
- **マルチソース音声**: Google TTS + フォールバック
- **ストリーミング最適化**: GCS Redirect Middleware
- **品質管理**: 自動音声ファイル検証
- **オフライン対応**: モバイルアプリでのローカル再生

---

## 🛠️ 開発・運用

### セットアップ

```bash
# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env

# データベースセットアップ
npm run db:migrate
npm run db:seed

# 開発サーバー起動
npm run dev
```

### デプロイメント
- **フロントエンド**: Vercel（SPA Configuration）
- **バックエンド**: Railway + Heroku互換
- **データベース**: MySQL（接続プーリング）
- **ファイルストレージ**: Google Cloud Storage + CDN

### パフォーマンス最適化
- **圧縮**: Brotli + gzip multi-layer compression
- **キャッシング**: Redis + in-memory caching
- **バンドル最適化**: Webpack code splitting
- **CDN統合**: Global asset delivery

---

## 📊 技術的ハイライト

### 🧮 カスタム学習アルゴリズム - 3段階差別化システム

#### 📈 長期記憶定着型 (Long-term Learning Curve)
**対象**: JLPT試験対策、体系的語彙学習
```javascript
// Stage 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7(マスター)
const STAGE_WAITING_HOURS = [1, 24, 72, 168, 312, 696, 1440]; // 時間単位
// 約48時間 → 3日 → 1週間 → 2週間 → 1ヶ月 → 2ヶ月の科学的間隔
```
- **7段階システム**: 認知心理学基盤の望まれた忘却曲線適用
- **最大60日間隔**: 長期記憶への完全定着保証
- **マスター完了**: 120日サイクル完了で永久定着判定

#### ⚡ 短期集中型 (Short-term Sprint Curve)
**対象**: 試験直前対策、集中復習期間
```javascript
// Stage 0 → 1 → ... → 9(マスター)
const SHORT_CURVE_WAITING_HOURS = [1, 24, 48, 48, 48, 48, 48, 48, 48, 48];
// 1時間 → 1日 → 2日間隔の高頻度反復
```
- **10段階システム**: より細分化された段階別学習
- **短期集中**: 主に48時間間隔での高頻度復習
- **素早いマスター**: 集中学習期間での効率的定着

#### 🎯 自律学習型 (Free Learning Mode)
**対象**: 自由復習、弱点補強、追加学習
```javascript
// タイマー制約なし - いつでも復習可能
if (learningCurveType === 'free') {
    waitingUntil = null;
    nextReviewAt = null; // 即時復習許可
}
```
- **制約なし**: 待機時間なしでいつでも学習可能
- **統計管理**: 初回学習のみ統計反映、復習は統計外
- **柔軟性**: 個人ペースに合わせた自由な学習スケジュール

#### 🤖 AI統合最適化
- **時間加速システム**: 開発・テスト用の学習サイクル短縮機能
- **適応的調整**: ユーザー成績による間隔動的調整
- **統計分析**: リアルタイム学習効果測定と改善提案

### 🔐 セキュリティ実装
- **JWT認証**: Refresh Token Rotation
- **パスワード暗号化**: bcrypt + salt rounds
- **入力検証**: Zod schema validation
- **CORS設定**: 厳密なオリジン検証

### 📈 監視・分析
- **エラー追跡**: 包括的ログシステム
- **パフォーマンス監視**: レスポンス時間計測
- **学習分析**: エンゲージメント指標
- **品質管理**: ユーザー報告システム

---

## 🎓 学習目標・成果

このプロジェクトを通じて習得した技術スキル：

### フルスタック開発
- ✅ モダンReact + Node.js アーキテクチャ
- ✅ RESTful API設計 + データベース最適化
- ✅ 認証・認可システム実装
- ✅ クラウド統合（GCP）+ CI/CD

### エデュテック特有技術
- ✅ 学習アルゴリズム設計・実装
- ✅ マルチメディア（音声）統合
- ✅ 学習進捗分析・可視化
- ✅ 適応学習システム
- ✅ 外部API統合（JLPT-VOCAB-API活用）

### 品質・運用
- ✅ TypeScript による型安全性
- ✅ 自動テスト（Jest + React Testing Library）
- ✅ パフォーマンス最適化
- ✅ セキュリティベストプラクティス

### 実践的学習体験
- 🎌 **JLPT学習者としての実体験**: 毎日のJLPT対策学習を通じたUX/UI改善
- 📊 **データエンジニアリング**: [JLPT-VOCAB-API](https://github.com/wkei/jlpt-vocab-api)の基礎データを生成AI活用で韓国語翻訳・音声・例文付き学習コンテンツに変換
- 🤖 **AI活用開発**: 大規模語彙データの多言語化・構造化処理
- 🔄 **継続的改善**: 実際の学習ニーズに基づく機能追加・最適化

---

## 📞 連絡先

プロジェクトに関するご質問やフィードバックがございましたら、お気軽にお声がけください。

**大学生・ジュニア開発者として学習・成長過程のプロジェクトですが、実用的な言語学習プラットフォームとしてご活用いただけます。**

---

## 🙏 謝辞

### データソース
- **JLPT語彙データ**: [JLPT-VOCAB-API](https://github.com/wkei/jlpt-vocab-api) by @wkei
  - N5-N1レベル別日本語語彙のベースJSONデータ提供
  - 韓国語翻訳・音声・例文等の拡張は生成AI活用により独自開発
  - オープンソース教育リソースの素晴らしい基盤として活用

### オープンソースコミュニティ
日本語学習ツール開発に貢献してくださったすべてのオープンソース開発者の皆様に感謝いたします。

---

<a id="korean"></a>

## 🌟 프로젝트 개요

고도화된 **풀스택 언어학습 플랫폼**으로 영어·일본어 학습을 지원하는 포괄적인 교육 테크놀로지 시스템입니다. 간격반복학습 알고리즘(SRS), 멀티플랫폼 대응, 음성 통합 기능을 갖춘 엔터프라이즈급 웹 애플리케이션으로 개발되었습니다.

> 💡 **실용적인 학습플랫폼**: 이 애플리케이션은 개발자 자신이 JLPT 시험 대비를 위해 매일 활용하고 있는 **실제 사용 중**인 학습 도구입니다. 실사용자 관점에서 지속적으로 개선·최적화를 진행하고 있습니다.

### 🎯 주요 특징

- **🧠 고도화된 간격반복시스템(SRS)**: 커스텀 학습 알고리즘을 통한 효율적 기억 정착
- **📱 멀티플랫폼 지원**: Web, (React Native, Expo 대응 모바일 앱 >> still hasn't developed!!)
- **🗣️ 음성통합 시스템**: Google Cloud Storage + Text-to-Speech API 통합
- **📊 학습분석**: 상세한 진도 추적과 적응학습 시스템
- **🌍 다국어 지원**: 영어(CEFR)·일본어(JLPT) 완전 지원
- **📚 JLPT 대응**: [JLPT-VOCAB-API](https://github.com/wkei/jlpt-vocab-api) 기반 + 생성AI 활용한 독자적 JLPT 어휘시스템
- **☁️ 클라우드 퍼스트**: Google Cloud, Vercel, Railway 지원 배포

---

## 🏗️ 아키텍처

### 시스템 구성

```
language-learner-web-project/
├── web/                          # 웹 애플리케이션 (메인)
│   ├── apps/
│   │   ├── backend/              # Express.js API 서버
│   │   ├── frontend/             # React SPA
│   │   └── mobile/               # React Native 앱
│   └── packages/
│       └── core/                 # 공유 비즈니스 로직 (TypeScript)
├── app/                          # Expo 모바일 앱
│   └── LanguageLearnerAppSimple/ # Expo SDK 통합
└── docs/                         # 프로젝트 문서
```

### 기술 스택

#### 🖥️ 백엔드
- **런타임**: Node.js 18+ + Express.js 4.21
- **데이터베이스**: MySQL + Prisma ORM 5.22.0
- **인증**: JWT + Refresh Token + bcrypt
- **클라우드**: Google Cloud Storage (음성 파일)
- **캐시**: Redis + node-cache (다중 계층 캐싱)
- **큐**: BullMQ (백그라운드 처리)
- **API**: RESTful 설계 + Swagger 문서화

#### 🎨 프론트엔드
- **프레임워크**: React 19.1.1 + TypeScript
- **라우팅**: React Router DOM v7
- **UI**: Bootstrap 5.3.7 + Bootstrap Icons
- **상태관리**: React Context API + 커스텀 훅
- **알림**: React Toastify
- **빌드**: Webpack + Bundle Analyzer

#### 📱 모바일
1. **React Native** (/web/apps/mobile)
   - React Native 0.75.4
   - 크로스 플랫폼 (iOS/Android)

2. **Expo** (/app/LanguageLearnerAppSimple)
   - Expo SDK ~53 + React Native 0.79.6
   - 음성재생 (expo-av) + 음성합성 (expo-speech)
   - 햅틱 피드백 + 오프라인 스토리지

#### 🔧 공유 패키지
- **아키텍처**: Clean Architecture + Domain-Driven Design
- **검증**: Zod 스키마 밸리데이션
- **타입 안전성**: TypeScript strict mode

---

## 🗄️ 데이터베이스 설계

### 핵심 엔터티 (Prisma Schema)

```prisma
// 사용자 관리
model User {
  id          Int     @id @default(autoincrement())
  email       String  @unique
  password    String
  name        String?
  // ... 기타 필드
}

// 간격반복 시스템
model SrsCard {
  id            Int      @id @default(autoincrement())
  userId        Int
  stage         Int      @default(0)
  nextReviewAt  DateTime
  folderId      Int?
  // ... 학습 알고리즘 관련
}

// 어휘 관리
model Vocab {
  id         Int     @id @default(autoincrement())
  lemma      String  // 표제어
  pos        String? // 품사
  levelCEFR  String? // CEFR 레벨 (영어)
  levelJLPT  String? // JLPT 레벨 (일본어)
  languageId Int
  // ... 관련 데이터
}
```

### 주요 기능
- **학습진도**: `DailyStudyStat`, `StudySession`으로 상세 트래킹
- **콘텐츠 관리**: `reading`, `readingRecord`, `listeningRecord`로 구조화 학습
- **다국어 지원**: `Language`, `VocabTranslation`으로 완전 국제화
- **품질 관리**: `CardReport`, `WrongAnswer`로 콘텐츠 개선
- **4기능 통합**: 독해·청해·어휘·문법의 종합 학습 시스템

---

## 🚀 주요 기능

### 📖 학습 시스템
- **간격반복 학습**: 과학적 근거 기반 복습 스케줄링
- **JLPT 대책 어휘**: [JLPT-VOCAB-API](https://github.com/wkei/jlpt-vocab-api)의 N5-N1 어휘 JSON을 기반으로, 생성AI 활용해 한국어 번역·음성·예문을 독자적 확장
- **어휘 관리**: 개인 단어장 + 카테고리 분류
- **실용성 중시**: 개발자 자신의 JLPT 학습 경험을 바탕으로 한 기능 설계

#### 📚 독해 연습 (Reading Comprehension)
- **CEFR 준수**: A1-C2 레벨별 구조화 텍스트
- **JLPT 대응**: N5-N1 레벨 전용 일본어 독해 문제
- **진도 관리**: 개별 문제 해답 기록·통계 분석
- **이해도 측정**: 문장 내용 파악·어휘 이해·문법 적용 테스트

#### 🎧 청해 연습 (Listening Comprehension)
- **다단계 시스템**: 기초 리스닝 → JLPT 청해 대책
- **음성 통합**: GCS 연계 고품질 음성 파일 배신
- **스크립트 제공**: 음성-문자 동기 학습 지원
- **오답 분석**: 리스닝 약점 패턴 자동 판별
- **녹음·재생**: 발음 연습 기능 통합

#### 🔧 문법 연습
- **구조화 학습**: 단계별 문법 항목 체계화
- **실천 응용**: 문맥 내 문법 사용 연습
- **오답 노트**: 문법별 약점 집중 복습 시스템

### 🎯 평가
- **퀴즈 시스템**: 선택식·서술식 문제
- **적응학습**: 성과 기반 콘텐츠 조정
- **진도 분석**: 학습곡선·약점 분석
- **마스터리 추적**: 숙련도 레벨 관리

### 🔊 음성 기능
- **멀티소스 음성**: Google TTS + 폴백
- **스트리밍 최적화**: GCS Redirect Middleware
- **품질 관리**: 자동 음성 파일 검증
- **오프라인 지원**: 모바일 앱에서 로컬 재생

---

## 🛠️ 개발·운영

### 셋업

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env

# 데이터베이스 셋업
npm run db:migrate
npm run db:seed

# 개발 서버 시작
npm run dev
```

### 배포
- **프론트엔드**: Vercel (SPA Configuration)
- **백엔드**: Railway + Heroku 호환
- **데이터베이스**: MySQL (연결 풀링)
- **파일 스토리지**: Google Cloud Storage + CDN

### 성능 최적화
- **압축**: Brotli + gzip 다중 계층 압축
- **캐싱**: Redis + 인메모리 캐싱
- **번들 최적화**: Webpack 코드 스플리팅
- **CDN 통합**: 글로벌 에셋 전송

---

## 📊 기술적 하이라이트

### 🧮 커스텀 학습 알고리즘 - 3단계 차별화 시스템

#### 📈 장기 기억정착형 (Long-term Learning Curve)
**대상**: JLPT 시험 대비, 체계적 어휘학습
```javascript
// Stage 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7(마스터)
const STAGE_WAITING_HOURS = [1, 24, 72, 168, 312, 696, 1440]; // 시간 단위
// 약 48시간 → 3일 → 1주 → 2주 → 1개월 → 2개월의 과학적 간격
```
- **7단계 시스템**: 인지심리학 기반 최적 망각곡선 적용
- **최대 60일 간격**: 장기기억으로의 완전한 정착 보장
- **마스터 완료**: 120일 사이클 완료로 영구 정착 판정

#### ⚡ 단기 집중형 (Short-term Sprint Curve)
**대상**: 시험 직전 대비, 집중 복습 기간
```javascript
// Stage 0 → 1 → ... → 9(마스터)
const SHORT_CURVE_WAITING_HOURS = [1, 24, 48, 48, 48, 48, 48, 48, 48, 48];
// 1시간 → 1일 → 2일 간격의 고빈도 반복
```
- **10단계 시스템**: 더욱 세분화된 단계별 학습
- **단기 집중**: 주로 48시간 간격의 고빈도 복습
- **빠른 마스터**: 집중 학습 기간에서의 효율적 정착

#### 🎯 자율 학습형 (Free Learning Mode)
**대상**: 자유 복습, 약점 보강, 추가 학습
```javascript
// 타이머 제약 없음 - 언제든 복습 가능
if (learningCurveType === 'free') {
    waitingUntil = null;
    nextReviewAt = null; // 즉시 복습 허용
}
```
- **제약 없음**: 대기시간 없이 언제든 학습 가능
- **통계 관리**: 첫 학습만 통계 반영, 복습은 통계 외
- **유연성**: 개인 페이스에 맞춘 자유로운 학습 스케줄

#### 🤖 AI 통합 최적화
- **시간 가속 시스템**: 개발·테스트용 학습 사이클 단축 기능
- **적응적 조정**: 사용자 성과에 따른 간격 동적 조정
- **통계 분석**: 실시간 학습 효과 측정 및 개선 제안

### 🔐 보안 구현
- **JWT 인증**: Refresh Token Rotation
- **패스워드 암호화**: bcrypt + salt rounds
- **입력 검증**: Zod 스키마 밸리데이션
- **CORS 설정**: 엄격한 오리진 검증

### 📈 모니터링·분석
- **에러 추적**: 포괄적 로그 시스템
- **성능 모니터링**: 응답시간 계측
- **학습 분석**: 참여도 지표
- **품질 관리**: 사용자 리포트 시스템

---

## 🎓 학습 목표·성과

이 프로젝트를 통해 습득한 기술 스킬:

### 풀스택 개발
- ✅ 모던 React + Node.js 아키텍처
- ✅ RESTful API 설계 + 데이터베이스 최적화
- ✅ 인증·인가 시스템 구현
- ✅ 클라우드 통합 (GCP) + CI/CD

### 에듀테크 특화 기술
- ✅ 학습 알고리즘 설계·구현
- ✅ 멀티미디어 (음성) 통합
- ✅ 학습진도 분석·시각화
- ✅ 적응학습 시스템
- ✅ 외부 API 통합 (JLPT-VOCAB-API 기반 데이터 확장)

### 품질·운영
- ✅ TypeScript를 통한 타입 안전성
- ✅ 자동 테스트 (Jest + React Testing Library)
- ✅ 성능 최적화
- ✅ 보안 베스트 프랙티스

### 실천적 학습체험
- 🎌 **JLPT 학습자로서의 실체험**: 매일의 JLPT 대책 학습을 통한 UX/UI 개선
- 📊 **데이터 엔지니어링**: [JLPT-VOCAB-API](https://github.com/wkei/jlpt-vocab-api)의 기초 데이터를 생성AI 활용해 한국어 번역·음성·예문 포함 학습 콘텐츠로 변환
- 🤖 **AI 활용 개발**: 대규모 어휘 데이터의 다국어화·구조화 처리
- 🔄 **지속적 개선**: 실제 학습 니즈에 기반한 기능 추가·최적화

---

## 📞 연락처

프로젝트에 관한 문의사항이나 피드백이 있으시면 언제든 연락 부탁드립니다.

**대학생·주니어 개발자로서 학습·성장 과정의 프로젝트이지만, 실용적인 언어학습 플랫폼으로 활용해 주실 수 있습니다.**

---

## 📄 라이선스

이 프로젝트는 교육 목적으로 개발된 포트폴리오 프로젝트입니다.

---

**개발자**: 대학생 주니어 개발자
**개발기간**: 지속적 개발 및 개선 중
**목적**: 풀스택 웹 개발 역량 증명 및 실용적 언어학습 도구 제공

---

## 🙏 감사의 말

### 데이터 소스
- **JLPT 어휘 데이터**: [JLPT-VOCAB-API](https://github.com/wkei/jlpt-vocab-api) by @wkei
  - N5-N1 레벨별 일본어 어휘의 베이스 JSON 데이터 제공
  - 한국어 번역·음성·예문 등의 확장은 생성AI 활용으로 독자 개발
  - 오픈소스 교육 리소스의 훌륭한 기반으로 활용

### 오픈소스 커뮤니티
일본어 학습 도구 개발에 기여해주신 모든 오픈소스 개발자들께 감사드립니다.