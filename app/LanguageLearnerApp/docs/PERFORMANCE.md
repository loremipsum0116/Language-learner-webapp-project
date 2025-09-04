# React Native 성능 최적화 가이드

## 개요
이 문서는 Language Learner 앱의 React Native 성능 최적화 전략과 구현된 최적화 기법들을 설명합니다.

## 구현된 최적화 기법

### 1. 이미지 최적화

#### OptimizedImage 컴포넌트
- **WebP 형식 자동 변환**: 더 작은 파일 크기로 빠른 로딩
- **FastImage 사용**: 네이티브 이미지 캐싱 및 최적화
- **지연 로딩**: 화면에 필요할 때만 이미지 로드
- **캐시 관리**: 메모리 및 디스크 캐시 최적화

```typescript
<OptimizedImage
  source="https://example.com/image.jpg"
  width={100}
  height={100}
  lazy={true}
  cache="immutable"
/>
```

#### 이미지 최적화 팁
- 적절한 해상도 사용 (2x, 3x)
- WebP 또는 AVIF 형식 선호
- 이미지 사전 로딩으로 UX 개선

### 2. 메모리 관리

#### React.memo 사용
```typescript
const MyComponent = memo(({ data }) => {
  return <View>{/* 컴포넌트 내용 */}</View>;
});
```

#### 커스텀 훅 활용
- **useSafeState**: 메모리 누수 방지
- **useDebounce**: 불필요한 업데이트 방지  
- **useThrottle**: 함수 호출 빈도 제한

```typescript
const [value, setValue] = useSafeState('initial');
const debouncedValue = useDebounce(value, 500);
const throttledCallback = useThrottle(callback, 100);
```

### 3. 리스트 가상화

#### FlashList 사용
- 대용량 리스트 렌더링 최적화
- 메모리 사용량 최소화
- 부드러운 스크롤 성능

```typescript
<VirtualizedList
  data={items}
  estimatedItemSize={80}
  onItemPress={handlePress}
  numColumns={1}
/>
```

#### FlatList vs FlashList 성능 비교
- **메모리 사용량**: 최대 10배 감소
- **스크롤 성능**: 60fps 유지
- **초기 렌더링**: 3-5배 빠른 속도

### 4. 성능 모니터링

#### 성능 메트릭 수집
- 렌더링 시간 측정
- 네비게이션 성능 추적
- 메모리 사용량 모니터링

```typescript
const { generateReport } = usePerformanceMonitor('MyComponent');

// 성능 리포트 확인
const report = generateReport();
console.log('평균 렌더링 시간:', report.averageRenderTime);
```

## 성능 최적화 체크리스트

### ✅ 이미지 최적화
- [ ] WebP/AVIF 형식 사용
- [ ] 적절한 해상도 적용
- [ ] 이미지 캐싱 구현
- [ ] 지연 로딩 적용

### ✅ 컴포넌트 최적화
- [ ] React.memo 적용
- [ ] 불필요한 리렌더링 방지
- [ ] Props 안정성 확보
- [ ] 콜백 메모이제이션

### ✅ 리스트 최적화
- [ ] FlashList 사용
- [ ] 적절한 estimatedItemSize 설정
- [ ] 키 추출기 최적화
- [ ] 아이템 컴포넌트 메모이제이션

### ✅ 메모리 관리
- [ ] 메모리 누수 방지
- [ ] 타이머/인터벌 정리
- [ ] 이벤트 리스너 해제
- [ ] 비동기 작업 취소

## 성능 측정 도구

### 1. 성능 모니터
```typescript
// 컴포넌트별 렌더링 시간 측정
usePerformanceMonitor('ComponentName');

// 성능 리포트 생성
const report = performanceMonitor.generateReport();
```

### 2. 메모리 모니터링
```typescript
// 메모리 사용량 추적 (개발 모드)
useMemoryMonitoring();
```

### 3. FPS 모니터링
```typescript
// FPS 측정 시작
const stopFPSMonitoring = performanceMonitor.startFPSMonitoring();

// 측정 중지
stopFPSMonitoring?.();
```

## 성능 테스트

### 자동 테스트 실행
```bash
npm test -- performance.test.ts
```

### 수동 성능 테스트
1. PerformanceTestScreen 실행
2. 다양한 아이템 수로 테스트
3. 가상화 on/off 비교
4. 성능 리포트 확인

## 성능 목표

### 렌더링 성능
- **컴포넌트 렌더링**: < 50ms
- **화면 전환**: < 300ms
- **리스트 스크롤**: 60fps 유지

### 메모리 사용량
- **앱 시작**: < 100MB
- **일반 사용**: < 200MB
- **대용량 리스트**: < 250MB

### 네트워크 최적화
- **이미지 로딩**: < 2초
- **API 응답**: < 1초
- **캐시 히트율**: > 80%

## 문제 해결

### 일반적인 성능 문제

#### 1. 느린 리스트 스크롤
**원인**: 복잡한 아이템 컴포넌트, 이미지 최적화 부족
**해결책**: 
- FlashList 사용
- 아이템 컴포넌트 메모이제이션
- 이미지 지연 로딩

#### 2. 메모리 누수
**원인**: 정리되지 않은 타이머, 이벤트 리스너
**해결책**:
- useEffect cleanup 함수 활용
- useSafeState 사용
- 컴포넌트 언마운트 시 리소스 정리

#### 3. 과도한 리렌더링
**원인**: 불안정한 props, 인라인 함수
**해결책**:
- useCallback, useMemo 활용
- Props 안정화
- React.memo 적용

### 성능 디버깅

#### 1. 렌더링 성능 확인
```typescript
// Flipper React DevTools 사용
// 또는 성능 모니터링 훅 활용
usePerformanceMonitor('ComponentName');
```

#### 2. 메모리 사용량 분석
```typescript
// iOS에서만 지원
const memoryUsage = await performanceMonitor.measureMemoryUsage();
```

#### 3. 번들 크기 분석
```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output ios-release.bundle --analyze
```

## 권장사항

### 개발 시 고려사항
1. **작은 컴포넌트 단위로 개발**: 재사용성과 최적화 용이
2. **Props 안정성 유지**: 불필요한 리렌더링 방지
3. **비동기 작업 적절히 관리**: 메모리 누수 방지
4. **정기적 성능 테스트**: CI/CD에 성능 테스트 포함

### 프로덕션 배포 전 체크
1. **번들 크기 최적화**: 불필요한 의존성 제거
2. **이미지 최적화**: 압축 및 형식 최적화
3. **성능 메트릭 확인**: 목표 성능 달성 여부
4. **메모리 누수 테스트**: 장시간 사용 시나리오 테스트

## 추가 리소스

- [React Native Performance Guide](https://reactnative.dev/docs/performance)
- [Flipper Performance Plugin](https://fbflipper.com/)
- [React DevTools Profiler](https://reactjs.org/blog/2018/09/10/introducing-the-react-profiler.html)
- [FlashList Documentation](https://shopify.github.io/flash-list/)