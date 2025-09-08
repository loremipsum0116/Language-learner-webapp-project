// lazyLoad.tsx - 코드 스플리팅을 위한 지연 로딩 유틸리티
import React, { lazy, Suspense, ComponentType } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';

// 로딩 컴포넌트
interface LoadingProps {
  message?: string;
}

const DefaultLoadingComponent = ({ message = '로딩 중...' }: LoadingProps) => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#4A90E2" />
    <Text style={styles.loadingText}>{message}</Text>
  </View>
);

// 에러 바운더리 컴포넌트
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class LazyLoadErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: ComponentType<{ error?: Error }> },
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy load error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error} />;
    }

    return this.props.children;
  }
}

// 기본 에러 컴포넌트
const DefaultErrorFallback = ({ error }: { error?: Error }) => (
  <View style={styles.errorContainer}>
    <Text style={styles.errorTitle}>로딩 실패</Text>
    <Text style={styles.errorMessage}>
      {error?.message || '컴포넌트를 불러올 수 없습니다.'}
    </Text>
  </View>
);

// 지연 로딩 HOC
interface LazyLoadOptions {
  fallback?: ComponentType<LoadingProps>;
  errorFallback?: ComponentType<{ error?: Error }>;
  loadingMessage?: string;
  preload?: boolean;
}

export function withLazyLoad<P extends object>(
  importFunc: () => Promise<{ default: ComponentType<P> }>,
  options: LazyLoadOptions = {}
) {
  const LazyComponent = lazy(importFunc);
  const FallbackComponent = options.fallback || DefaultLoadingComponent;

  const WrappedComponent = (props: P) => (
    <LazyLoadErrorBoundary fallback={options.errorFallback}>
      <Suspense 
        fallback={<FallbackComponent message={options.loadingMessage} />}
      >
        <LazyComponent {...props} />
      </Suspense>
    </LazyLoadErrorBoundary>
  );

  // 사전 로딩
  if (options.preload) {
    // 앱 시작 시 컴포넌트 사전 로딩
    setTimeout(() => {
      importFunc().catch(console.error);
    }, 1000);
  }

  return WrappedComponent;
}

// 화면별 지연 로딩 컴포넌트 생성 함수
export const createLazyScreen = <P extends object>(
  importFunc: () => Promise<{ default: ComponentType<P> }>,
  screenName: string
) => {
  return withLazyLoad(importFunc, {
    loadingMessage: `${screenName} 로딩 중...`,
    preload: false
  });
};

// 조건부 지연 로딩 (특정 조건에서만 로딩)
export function createConditionalLazyLoad<P extends object>(
  importFunc: () => Promise<{ default: ComponentType<P> }>,
  condition: () => boolean,
  fallbackComponent: ComponentType<P>
) {
  const LazyComponent = lazy(importFunc);

  return (props: P) => {
    if (!condition()) {
      return <fallbackComponent {...props} />;
    }

    return (
      <LazyLoadErrorBoundary>
        <Suspense fallback={<DefaultLoadingComponent />}>
          <LazyComponent {...props} />
        </Suspense>
      </LazyLoadErrorBoundary>
    );
  };
}

// 번들 분할 매니저
class BundleSplitManager {
  private loadedChunks: Set<string> = new Set();
  private preloadQueue: Array<() => Promise<any>> = [];

  // 청크 로딩 상태 확인
  isChunkLoaded(chunkName: string): boolean {
    return this.loadedChunks.has(chunkName);
  }

  // 청크 사전 로딩
  async preloadChunk(
    chunkName: string,
    importFunc: () => Promise<any>
  ): Promise<void> {
    if (this.loadedChunks.has(chunkName)) {
      return;
    }

    try {
      await importFunc();
      this.loadedChunks.add(chunkName);
      console.log(`✅ Chunk preloaded: ${chunkName}`);
    } catch (error) {
      console.error(`❌ Failed to preload chunk: ${chunkName}`, error);
    }
  }

  // 우선순위 기반 사전 로딩
  schedulePreload(
    chunkName: string,
    importFunc: () => Promise<any>,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ) {
    const preloadFunc = () => this.preloadChunk(chunkName, importFunc);
    
    // 우선순위에 따라 큐에 추가
    if (priority === 'high') {
      this.preloadQueue.unshift(preloadFunc);
    } else {
      this.preloadQueue.push(preloadFunc);
    }

    // 아이들 상태에서 실행
    this.processPreloadQueue();
  }

  private async processPreloadQueue() {
    if (this.preloadQueue.length === 0) return;

    // 인터랙션 완료 후 실행
    setTimeout(async () => {
      const preloadFunc = this.preloadQueue.shift();
      if (preloadFunc) {
        try {
          await preloadFunc();
        } catch (error) {
          console.error('Preload failed:', error);
        }
        
        // 다음 청크 처리
        this.processPreloadQueue();
      }
    }, 100);
  }

  // 전체 사전 로딩 통계
  getStats() {
    return {
      loadedChunks: this.loadedChunks.size,
      pendingPreloads: this.preloadQueue.length
    };
  }
}

export const bundleSplitManager = new BundleSplitManager();

// 스타일
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5'
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center'
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF5252',
    marginBottom: 8
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20
  }
});

// React.lazy를 위한 타입 정의
export type LazyComponentType<P = {}> = React.LazyExoticComponent<
  React.ComponentType<P>
>;