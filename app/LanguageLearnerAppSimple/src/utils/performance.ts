// performance.ts - 성능 최적화 유틸리티
import { useCallback, useMemo, useRef, useEffect } from 'react';
import { InteractionManager, Platform } from 'react-native';

// 디바운스 훅
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// 스로틀 훅
export const useThrottle = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const lastRun = useRef(Date.now());

  return useCallback((...args: Parameters<T>) => {
    if (Date.now() - lastRun.current >= delay) {
      callback(...args);
      lastRun.current = Date.now();
    }
  }, [callback, delay]) as T;
};

// 메모이제이션 훅
export const useMemoization = <T>(
  factory: () => T,
  deps: React.DependencyList
): T => {
  return useMemo(factory, deps);
};

// 안전한 setState 훅 (메모리 누수 방지)
export const useSafeState = <T>(
  initialState: T
): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [state, setState] = useState(initialState);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const safeSetState: React.Dispatch<React.SetStateAction<T>> = useCallback(
    (action) => {
      if (isMounted.current) {
        setState(action);
      }
    },
    []
  );

  return [state, safeSetState];
};

// 인터랙션 완료 후 실행 훅
export const useInteractionComplete = (callback: () => void) => {
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      callback();
    });

    return () => task.cancel();
  }, [callback]);
};

// 렌더링 성능 측정
export const useRenderPerformance = (componentName: string) => {
  const renderStart = useRef<number>(0);
  
  useEffect(() => {
    renderStart.current = Date.now();
    
    return () => {
      const renderTime = Date.now() - renderStart.current;
      if (__DEV__) {
        console.log(`[Performance] ${componentName} render time: ${renderTime}ms`);
      }
    };
  });
};

// 메모리 사용량 모니터링 (개발 모드)
export const useMemoryMonitoring = () => {
  useEffect(() => {
    if (__DEV__ && Platform.OS === 'ios') {
      const interval = setInterval(() => {
        // iOS에서만 메모리 정보 출력
        console.log('[Memory] Monitoring memory usage...');
      }, 10000);

      return () => clearInterval(interval);
    }
  }, []);
};

// 비동기 작업 최적화
export const useAsyncOperation = <T>(
  operation: () => Promise<T>,
  deps: React.DependencyList
) => {
  const [data, setData] = useSafeState<T | null>(null);
  const [loading, setLoading] = useSafeState(false);
  const [error, setError] = useSafeState<Error | null>(null);
  const cancelRef = useRef<boolean>(false);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    cancelRef.current = false;

    try {
      const result = await operation();
      if (!cancelRef.current) {
        setData(result);
      }
    } catch (err) {
      if (!cancelRef.current) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      }
    } finally {
      if (!cancelRef.current) {
        setLoading(false);
      }
    }
  }, deps);

  useEffect(() => {
    execute();

    return () => {
      cancelRef.current = true;
    };
  }, [execute]);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  return { data, loading, error, execute, cancel };
};

// 이미지 캐시 관리
export const useImageCache = () => {
  const cache = useRef<Map<string, string>>(new Map());

  const getCachedImage = useCallback((url: string): string | undefined => {
    return cache.current.get(url);
  }, []);

  const setCachedImage = useCallback((url: string, cachedUrl: string) => {
    cache.current.set(url, cachedUrl);
    
    // 캐시 크기 제한 (최대 100개)
    if (cache.current.size > 100) {
      const firstKey = cache.current.keys().next().value;
      cache.current.delete(firstKey);
    }
  }, []);

  const clearCache = useCallback(() => {
    cache.current.clear();
  }, []);

  return {
    getCachedImage,
    setCachedImage,
    clearCache
  };
};

// 가상화 리스트 최적화
export const useVirtualizedList = <T>(
  data: T[],
  itemHeight: number,
  containerHeight: number
) => {
  const [scrollOffset, setScrollOffset] = useState(0);

  const visibleRange = useMemo(() => {
    const startIndex = Math.floor(scrollOffset / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      data.length
    );

    return { startIndex, endIndex };
  }, [scrollOffset, itemHeight, containerHeight, data.length]);

  const visibleItems = useMemo(() => {
    return data.slice(visibleRange.startIndex, visibleRange.endIndex);
  }, [data, visibleRange]);

  const onScroll = useThrottle((event: any) => {
    setScrollOffset(event.nativeEvent.contentOffset.y);
  }, 16); // 60fps

  return {
    visibleItems,
    visibleRange,
    onScroll
  };
};

// useState import 추가
import { useState } from 'react';