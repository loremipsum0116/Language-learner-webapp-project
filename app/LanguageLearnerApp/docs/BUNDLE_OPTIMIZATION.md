# 번들 크기 최적화 가이드

## 개요
이 문서는 Language Learner React Native 앱의 번들 크기 최적화 전략과 구현된 최적화 기법들을 설명합니다.

## 🎯 최적화 목표
- **Android APK**: < 25MB
- **iOS IPA**: < 30MB  
- **JavaScript Bundle**: < 10MB
- **초기 로딩 시간**: < 3초

## 📊 현재 상태 분석

### 번들 분석 실행
```bash
# 전체 번들 분석
npm run analyze:bundle

# Tree shaking 분석  
npm run analyze:tree

# 종합 최적화 실행
npm run optimize

# 번들 시각화
npm run bundle:visualize
```

## 🔧 구현된 최적화 기법

### 1. 코드 스플리팅 (Code Splitting)

#### React.lazy를 통한 동적 import
```typescript
// LazyScreens.ts에서 화면별 지연 로딩
export const HomeScreen = createLazyScreen(
  () => import('../screens/HomeScreen'),
  '홈'
);

// 사용법
import { HomeScreen } from '../navigation/LazyScreens';
```

#### 번들 분할 전략
- **핵심 기능**: 즉시 로딩
- **부가 기능**: 지연 로딩
- **관리자 기능**: 조건부 로딩
- **개발 도구**: 개발 모드에서만 로딩

```typescript
// 우선순위 기반 사전 로딩
bundleSplitManager.schedulePreload(
  'home',
  () => import('../screens/HomeScreen'),
  'high' // high, medium, low
);
```

### 2. Tree Shaking 최적화

#### 자동 미사용 코드 제거
```bash
# Tree shaking 분석 및 정리
npm run analyze:tree

# 생성된 최적화 스크립트 실행
./optimize-dependencies.sh
```

#### Metro 설정 최적화
```javascript
// metro.config.js
module.exports = {
  resolver: {
    // 불필요한 파일 제외
    blockList: [
      /.*\/__tests__\/.*$/,
      /.*\.test\.(js|jsx|ts|tsx)$/,
      /.*\.spec\.(js|jsx|ts|tsx)$/,
      // ... 더 많은 패턴들
    ]
  },
  
  transformer: {
    // 프로덕션에서 콘솔 제거
    minifierConfig: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production'
      }
    }
  }
};
```

### 3. ProGuard/R8 최적화 (Android)

#### 활성화 설정
```gradle
// android/app/build.gradle
def enableProguardInReleaseBuilds = true

buildTypes {
    release {
        minifyEnabled enableProguardInReleaseBuilds
        shrinkResources enableProguardInReleaseBuilds
        proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"
    }
}
```

#### 최적화 옵션
- **Code Shrinking**: 사용되지 않는 코드 제거
- **Resource Shrinking**: 사용되지 않는 리소스 제거  
- **Code Obfuscation**: 코드 난독화 (선택사항)
- **Optimization**: 바이트코드 최적화

### 4. 이미지 최적화

#### WebP 형식 자동 변환
```typescript
// OptimizedImage 컴포넌트 사용
<OptimizedImage
  source="https://example.com/image.jpg" // 자동으로 WebP 변환
  width={100}
  height={100}
  lazy={true}
/>
```

#### 이미지 압축 권장사항
- **WebP/AVIF 형식 사용**: 30-50% 크기 감소
- **적절한 해상도**: @2x, @3x 대응
- **지연 로딩**: 뷰포트 진입 시 로딩

### 5. 의존성 최적화

#### 큰 라이브러리 대체
```javascript
// Before: moment.js (67KB)
import moment from 'moment';

// After: date-fns (13KB - tree-shakable)
import { format, addDays } from 'date-fns';
```

#### 부분 import 사용
```javascript
// ❌ 전체 라이브러리 import
import _ from 'lodash';

// ✅ 필요한 함수만 import
import debounce from 'lodash/debounce';
import throttle from 'lodash/throttle';
```

## 📈 성능 측정 및 모니터링

### 번들 분석 리포트
```bash
npm run bundle:report
```

생성되는 리포트:
- `bundle-analysis-summary.json`: 종합 분석 결과
- `tree-shake-analysis.json`: Tree shaking 결과
- `dependencies-analysis.json`: 의존성 분석
- HTML 리포트: 시각적 번들 구성

### 성능 메트릭
- **번들 크기 추이**: 시간별 변화 추적
- **로딩 시간**: 실제 기기에서 측정
- **메모리 사용량**: 런타임 모니터링

## 🛠️ 최적화 도구

### 1. 번들 분석기 (Bundle Analyzer)
```javascript
// scripts/bundle-analyzer.js
const analyzer = new BundleAnalyzer();
await analyzer.runFullAnalysis();
```

**기능**:
- Android/iOS 번들 크기 분석
- 모듈별 크기 측정
- 의존성 트리 시각화
- 최적화 권장사항 제공

### 2. Tree Shake 분석기
```javascript
// scripts/tree-shake-analyzer.js  
const analyzer = new TreeShakeAnalyzer();
await analyzer.runFullAnalysis();
```

**기능**:
- 미사용 의존성 식별
- 중복 의존성 검사
- 큰 의존성 대체 제안
- 자동 정리 스크립트 생성

### 3. 종합 최적화 도구
```javascript
// scripts/optimize-bundle.js
const optimizer = new BundleOptimizer();
await optimizer.optimize();
```

**기능**:
- 전체 최적화 프로세스 자동화
- 이미지 최적화 제안
- 성능 점수 계산
- 상세 리포트 생성

## 📋 최적화 체크리스트

### ✅ 코드 레벨 최적화
- [ ] React.lazy로 화면별 코드 스플리팅
- [ ] 컴포넌트 메모이제이션 (React.memo)
- [ ] 불필요한 import 제거
- [ ] 인라인 함수 최적화
- [ ] 콘솔 로그 제거 (프로덕션)

### ✅ 번들러 최적화  
- [ ] Metro 설정 최적화
- [ ] Tree shaking 활성화
- [ ] 불필요한 파일 제외 패턴 설정
- [ ] 압축/난독화 활성화

### ✅ 의존성 최적화
- [ ] 미사용 의존성 제거
- [ ] 큰 라이브러리 대체
- [ ] 중복 의존성 해결
- [ ] 부분 import 사용

### ✅ 에셋 최적화
- [ ] 이미지 WebP 변환
- [ ] 폰트 서브셋팅
- [ ] 오디오/비디오 압축
- [ ] 지연 로딩 적용

### ✅ 플랫폼 최적화
- [ ] Android ProGuard/R8 설정
- [ ] iOS bitcode 최적화
- [ ] ABI 필터링
- [ ] 리소스 압축

## 🎯 최적화 결과 예상 효과

### 번들 크기 감소
- **코드 스플리팅**: 30-50% 초기 번들 감소
- **Tree shaking**: 10-20% 미사용 코드 제거  
- **ProGuard/R8**: 15-25% Android APK 감소
- **이미지 최적화**: 20-40% 에셋 크기 감소

### 성능 개선
- **초기 로딩 시간**: 2-4초 단축
- **메모리 사용량**: 20-30% 감소
- **배터리 효율성**: 향상
- **사용자 경험**: 크게 개선

## 🚨 주의사항

### 최적화 시 고려사항
1. **기능 테스트**: 최적화 후 모든 기능 동작 확인
2. **크래시 모니터링**: ProGuard 설정으로 인한 크래시 체크
3. **성능 회귀**: 실제 기기에서 성능 측정
4. **점진적 적용**: 한 번에 모든 최적화를 적용하지 말고 단계별로

### 롤백 계획
- 최적화 전 백업 생성
- 버전 관리로 변경사항 추적
- 문제 발생 시 빠른 롤백 가능하도록 준비

## 📚 추가 리소스

### 공식 문서
- [Metro 번들러 최적화](https://metrobundler.dev/docs/optimization)
- [React Native 성능 가이드](https://reactnative.dev/docs/performance)
- [Android App Bundle](https://developer.android.com/platform/technology/app-bundle)

### 도구 및 라이브러리
- [React Native Bundle Visualizer](https://github.com/IjzerenHein/react-native-bundle-visualizer)
- [webpack-bundle-analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer)
- [source-map-explorer](https://github.com/danvk/source-map-explorer)

## 🔄 정기 모니터링

### 월간 체크
```bash
# 번들 크기 추세 확인
npm run bundle:report

# 의존성 업데이트 확인
npm outdated

# 보안 취약점 스캔
npm audit
```

### CI/CD 통합
```yaml
# .github/workflows/bundle-size.yml
- name: Bundle Size Check
  run: |
    npm run build:android
    npm run analyze:bundle
    # 번들 크기 임계값 체크
```

이러한 최적화를 통해 앱의 다운로드 크기를 줄이고, 초기 로딩 속도를 개선하며, 전반적인 사용자 경험을 향상시킬 수 있습니다.