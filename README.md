# Deutsch Learner (CEFR A1–C1)
> 어휘 SRS · 문법 클로즈 · 리딩 클릭 글로스 + LangChain 기반 AI 독일어 튜터 + 사전 API(오디오·예문)

[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-informational)](./.github/workflows)
[![Node](https://img.shields.io/badge/Node-18%2B%20%7C%2020%2B-blue)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Status](https://img.shields.io/badge/Status-M1%20MVP-in_progress-orange)]()

## TL;DR
- 학습자 기능: 어휘 SRS(Leitner/SM-2 변형), 문법 클로즈, 리딩 클릭 글로스, AI 튜터 대화/교정, 사전 검색(오디오·예문)
- 관리자 기능: CSV/JSON 업로드·검증, 라이선스 메타 관리, 로그/비용 리포트
- 핵심 비기능: p95 < 400ms, JWT HttpOnly, GDPR 유사 데이터 권리, 관측성(토큰/비용 대시보드)

---

## 기능(Features)

### 학습자
- 어휘 SRS: 1/3/7/16/35일 간격, 카드 유형(뜻→형태, 오디오→철자, 콜로케이션 등)
- 문법(클로즈): V2, 종속절 V-final, 전치사 지배(3/4격), 형용사 어미, 분리/비분리동사
- 리딩(클릭 글로스): 토큰 클릭 시 lemma/품사/한국어 의미/예문
- AI 튜터(랭체인): 페르소나(톤/호칭/난이도), 자유대화·역할극·교정, RAG 우선, 각주로 상위 어휘 표기
- 사전 API: lemma/활용형, IPA, 오디오(스트리밍/캐시), CEFR 라벨 예문

### 관리자
- 업로드/검증: CSV(어휘), JSON(문법/클로즈/리딩), 필수 필드·중복·라이선스 체크
- 리포트: 정답률/난이도, 오답 Top, 튜터 토큰·비용·에러

### 수용 기준(샘플)
- 튜터: 어순 규칙 위반율 < 5%, 요청 레벨 외 어휘 ≤ 10%(각주), 근거 제시율 ≥ 90%
- 사전: 상위 1,000 lemma 오디오·IPA·예문 확보, 95p < 300ms(캐시 기준)

---

## 아키텍처

```mermaid
flowchart LR
  subgraph Client[React (Vite)]
    UI[Routes/Components]
    TutorChat
    DictPanel
    SrsSession
  end

  subgraph Server[Node.js Express]
    API[/REST API/]
    TutorGW[LangChain Gateway]
    RAG[Retriever (dict/kb)]
  end

  subgraph Data[DB & Cache]
    MySQL[(MySQL/PlanetScale)]
    Redis[(Redis Cache)]
    Storage[(Audio Cache)]
  end

  Client <-->|HTTPS| API
  API --> MySQL
  API --> Redis
  API --> Storage
  TutorGW --> RAG
  RAG --> MySQL
