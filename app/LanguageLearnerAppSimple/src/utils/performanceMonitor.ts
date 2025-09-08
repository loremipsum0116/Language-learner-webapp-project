// performanceMonitor.ts - 성능 모니터링 유틸리티
import { Platform, InteractionManager, AppState, Dimensions } from 'react-native';

interface PerformanceMetrics {
  renderTime: number;
  componentName: string;
  timestamp: number;
  memoryUsage?: number;
  screenSize: { width: number; height: number };
}

interface NavigationMetrics {
  screenName: string;
  loadTime: number;
  timestamp: number;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private renderMetrics: PerformanceMetrics[] = [];
  private navigationMetrics: NavigationMetrics[] = [];
  private startTimes: Map<string, number> = new Map();
  private maxMetricsCount = 100; // 최대 저장할 메트릭스 수

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // 렌더링 성능 측정 시작
  startRender(componentName: string): void {
    if (__DEV__) {
      this.startTimes.set(componentName, Date.now());
    }
  }

  // 렌더링 성능 측정 종료
  endRender(componentName: string): void {
    if (__DEV__) {
      const startTime = this.startTimes.get(componentName);
      if (startTime) {
        const renderTime = Date.now() - startTime;
        const screenSize = Dimensions.get('window');
        
        const metric: PerformanceMetrics = {
          renderTime,
          componentName,
          timestamp: Date.now(),
          screenSize
        };

        this.addRenderMetric(metric);
        this.startTimes.delete(componentName);

        // 성능 경고 (50ms 이상)
        if (renderTime > 50) {
          console.warn(`[Performance Warning] ${componentName} took ${renderTime}ms to render`);
        }
      }
    }
  }

  // 화면 전환 성능 측정 시작
  startNavigation(screenName: string): void {
    if (__DEV__) {
      this.startTimes.set(`nav_${screenName}`, Date.now());
    }
  }

  // 화면 전환 성능 측정 종료
  endNavigation(screenName: string): void {
    if (__DEV__) {
      const startTime = this.startTimes.get(`nav_${screenName}`);
      if (startTime) {
        const loadTime = Date.now() - startTime;
        
        const metric: NavigationMetrics = {
          screenName,
          loadTime,
          timestamp: Date.now()
        };

        this.addNavigationMetric(metric);
        this.startTimes.delete(`nav_${screenName}`);

        console.log(`[Navigation] ${screenName} loaded in ${loadTime}ms`);
      }
    }
  }

  // 메트릭 추가 (순환 버퍼)
  private addRenderMetric(metric: PerformanceMetrics): void {
    this.renderMetrics.push(metric);
    
    if (this.renderMetrics.length > this.maxMetricsCount) {
      this.renderMetrics.shift();
    }
  }

  private addNavigationMetric(metric: NavigationMetrics): void {
    this.navigationMetrics.push(metric);
    
    if (this.navigationMetrics.length > this.maxMetricsCount) {
      this.navigationMetrics.shift();
    }
  }

  // 성능 리포트 생성
  generateReport(): {
    renderMetrics: PerformanceMetrics[];
    navigationMetrics: NavigationMetrics[];
    averageRenderTime: number;
    averageNavigationTime: number;
    slowComponents: string[];
  } {
    const avgRenderTime = this.renderMetrics.length > 0
      ? this.renderMetrics.reduce((sum, m) => sum + m.renderTime, 0) / this.renderMetrics.length
      : 0;

    const avgNavigationTime = this.navigationMetrics.length > 0
      ? this.navigationMetrics.reduce((sum, m) => sum + m.loadTime, 0) / this.navigationMetrics.length
      : 0;

    // 느린 컴포넌트 식별 (평균보다 2배 이상 느린)
    const slowComponents = this.renderMetrics
      .filter(m => m.renderTime > avgRenderTime * 2)
      .map(m => m.componentName)
      .filter((value, index, self) => self.indexOf(value) === index);

    return {
      renderMetrics: [...this.renderMetrics],
      navigationMetrics: [...this.navigationMetrics],
      averageRenderTime: avgRenderTime,
      averageNavigationTime: avgNavigationTime,
      slowComponents
    };
  }

  // 메트릭 초기화
  clearMetrics(): void {
    this.renderMetrics = [];
    this.navigationMetrics = [];
    this.startTimes.clear();
  }

  // 메모리 사용량 측정 (iOS만 지원)
  measureMemoryUsage(): Promise<number | null> {
    return new Promise((resolve) => {
      if (Platform.OS === 'ios' && __DEV__) {
        // React Native에서는 직접적인 메모리 측정이 어려우므로
        // 네이티브 모듈이나 서드파티 라이브러리가 필요
        resolve(null);
      } else {
        resolve(null);
      }
    });
  }

  // 인터랙션 지연 측정
  measureInteractionDelay(action: string, callback: () => void): void {
    if (__DEV__) {
      const startTime = Date.now();
      
      InteractionManager.runAfterInteractions(() => {
        const delay = Date.now() - startTime;
        console.log(`[Interaction Delay] ${action}: ${delay}ms`);
        callback();
      });
    } else {
      callback();
    }
  }

  // FPS 측정 (개발 모드에서만)
  startFPSMonitoring(): (() => void) | null {
    if (__DEV__) {
      let frameCount = 0;
      let startTime = Date.now();
      let animationId: number;

      const measureFPS = () => {
        frameCount++;
        const currentTime = Date.now();
        
        if (currentTime - startTime >= 1000) {
          const fps = frameCount;
          console.log(`[FPS] Current FPS: ${fps}`);
          
          if (fps < 50) {
            console.warn(`[Performance Warning] Low FPS detected: ${fps}`);
          }
          
          frameCount = 0;
          startTime = currentTime;
        }
        
        animationId = requestAnimationFrame(measureFPS);
      };

      measureFPS();

      return () => {
        cancelAnimationFrame(animationId);
      };
    }
    
    return null;
  }
}

// 싱글톤 인스턴스
export const performanceMonitor = PerformanceMonitor.getInstance();

// React Hook
export const usePerformanceMonitor = (componentName: string) => {
  React.useEffect(() => {
    performanceMonitor.startRender(componentName);
    
    return () => {
      performanceMonitor.endRender(componentName);
    };
  });

  return {
    startNavigation: performanceMonitor.startNavigation.bind(performanceMonitor),
    endNavigation: performanceMonitor.endNavigation.bind(performanceMonitor),
    generateReport: performanceMonitor.generateReport.bind(performanceMonitor),
    measureInteractionDelay: performanceMonitor.measureInteractionDelay.bind(performanceMonitor)
  };
};

// Navigation Performance HOC
export const withPerformanceTracking = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  screenName: string
) => {
  return React.memo((props: P) => {
    React.useEffect(() => {
      performanceMonitor.startNavigation(screenName);
      
      const timeout = setTimeout(() => {
        performanceMonitor.endNavigation(screenName);
      }, 0);

      return () => clearTimeout(timeout);
    }, []);

    return <WrappedComponent {...props} />;
  });
};

// React import 추가
import React from 'react';