# Language Learner Mobile App

## 프로젝트 구조

```
src/
├── components/          # 재사용 가능한 UI 컴포넌트
│   ├── common/         # 공통 컴포넌트 (Button, Input 등)
│   ├── forms/          # 폼 관련 컴포넌트
│   └── ui/            # UI 컴포넌트 라이브러리
├── screens/            # 화면 컴포넌트
│   ├── auth/          # 인증 관련 화면 (로그인, 회원가입)
│   ├── home/          # 홈 화면
│   ├── vocabulary/    # 단어장 관련 화면
│   ├── quiz/          # 퀴즈 관련 화면
│   └── profile/       # 프로필 관련 화면
├── navigation/         # 네비게이션 설정
├── services/          # API 서비스 및 외부 서비스
├── store/             # Redux 상태 관리
│   ├── slices/        # Redux 슬라이스
│   └── middleware/    # 커스텀 미들웨어
├── utils/             # 유틸리티 함수
├── hooks/             # 커스텀 훅
├── assets/            # 정적 자산
│   ├── images/        # 이미지 파일
│   ├── fonts/         # 폰트 파일
│   └── icons/         # 아이콘 파일
└── types/             # TypeScript 타입 정의
```

## 주요 기능

- **인증 시스템**: JWT 기반 로그인/회원가입
- **단어장**: 개인화된 단어 학습 및 관리
- **퀴즈**: 단어 학습을 위한 퀴즈 시스템
- **프로필**: 사용자 설정 및 학습 통계
- **오프라인 지원**: 로컬 저장소를 활용한 오프라인 기능
- **오디오 재생**: 단어 발음 및 압축된 오디오 스트리밍

## 기술 스택

- **React Native**: 크로스 플랫폼 모바일 앱 프레임워크
- **TypeScript**: 정적 타입 검사
- **Redux Toolkit**: 상태 관리
- **RTK Query**: API 상태 관리 및 캐싱
- **React Navigation**: 네비게이션 라이브러리
- **React Native Vector Icons**: 아이콘 라이브러리
- **AsyncStorage**: 로컬 저장소

## 개발 가이드

### 컴포넌트 작성 규칙
1. 모든 컴포넌트는 TypeScript로 작성
2. Props에 대한 타입 정의 필수
3. 스타일은 StyleSheet.create() 사용
4. 재사용 가능한 컴포넌트는 components/ 폴더에 배치

### 상태 관리
1. Redux Toolkit을 사용한 전역 상태 관리
2. 로컬 상태는 useState 훅 사용
3. API 호출은 RTK Query 사용
4. 인증 상태는 authSlice에서 관리

### 네비게이션
1. React Navigation v6 사용
2. 타입 안전한 네비게이션을 위한 ParamList 정의
3. 인증 상태에 따른 조건부 네비게이션

### API 통합
1. web/apps/backend와 연동
2. 모바일 전용 엔드포인트 활용 (/api/mobile/*)
3. 오프라인 지원을 위한 로컬 캐싱
4. 자동 토큰 갱신 및 인증 처리