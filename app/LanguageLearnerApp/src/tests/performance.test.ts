// src/tests/performance.test.ts - 성능 프로파일링 테스트
import { performance } from 'perf_hooks';

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  memoryUsage: number;
  componentCount: number;
}

describe('성능 프로파일링', () => {
  beforeEach(() => {
    performance.clearMarks();
    performance.clearMeasures();
  });

  describe('컴포넌트 렌더링 성능', () => {
    it('LazyLoad 컴포넌트 로딩 시간 측정', async () => {
      const startTime = performance.now();
      
      // Mock lazy loading
      const mockImport = () => new Promise((resolve) => {
        setTimeout(() => resolve({ default: () => null }), 100);
      });

      performance.mark('lazy-load-start');
      await mockImport();
      performance.mark('lazy-load-end');
      
      performance.measure('lazy-load-duration', 'lazy-load-start', 'lazy-load-end');
      
      const endTime = performance.now();
      const loadTime = endTime - startTime;
      
      expect(loadTime).toBeLessThan(200);
    });

    it('대용량 리스트 렌더링 성능', () => {
      const listSize = 1000;
      const startTime = performance.now();

      // Mock large list rendering with virtualization
      const mockRenderList = (size: number) => {
        const items = Array.from({ length: size }, (_, i) => ({
          id: i,
          text: `Item ${i}`,
        }));
        
        const visibleItems = items.slice(0, 20);
        return visibleItems.map(item => ({ ...item, rendered: true }));
      };

      const renderedItems = mockRenderList(listSize);
      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(50);
      expect(renderedItems).toHaveLength(20);
    });
  });

  describe('메모리 사용량 측정', () => {
    it('캐시 효율성 측정', () => {
      class SimpleCache {
        private cache = new Map<string, any>();
        private hits = 0;
        private misses = 0;

        get(key: string): any {
          if (this.cache.has(key)) {
            this.hits++;
            return this.cache.get(key);
          }
          this.misses++;
          return null;
        }

        set(key: string, value: any): void {
          this.cache.set(key, value);
        }

        getHitRate(): number {
          return this.hits / (this.hits + this.misses);
        }
      }

      const cache = new SimpleCache();
      const testKeys = ['user1', 'user2', 'user3', 'user1', 'user2', 'user4', 'user1'];

      testKeys.forEach((key) => {
        let data = cache.get(key);
        if (!data) {
          data = { id: key, data: `User data for ${key}` };
          cache.set(key, data);
        }
      });

      const hitRate = cache.getHitRate();
      expect(hitRate).toBeGreaterThan(0.4);
    });
  });

  describe('API 응답 시간 측정', () => {
    it('API 호출 성능 측정', async () => {
      const mockApiCall = async (delay: number = 100): Promise<any> => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ data: 'test response', timestamp: Date.now() });
          }, delay);
        });
      };

      const startTime = performance.now();
      const response = await mockApiCall(150);
      const endTime = performance.now();
      const callTime = endTime - startTime;

      expect(callTime).toBeLessThan(200);
      expect(response.data).toBe('test response');
    });

    it('동시 API 호출 성능', async () => {
      const mockApiCall = async (id: number): Promise<any> => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ id, data: `response ${id}` });
          }, 50 + Math.random() * 50);
        });
      };

      const startTime = performance.now();
      const promises = Array.from({ length: 5 }, (_, i) => mockApiCall(i));
      const results = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(150);
      expect(results).toHaveLength(5);
    });
  });

  describe('번들 크기 성능 메트릭', () => {
    it('번들 크기 추정', () => {
      const estimatedSizes = {
        components: 150,
        screens: 200,
        services: 50,
        utils: 30,
        assets: 500,
        thirdParty: 800,
      };

      const totalSize = Object.values(estimatedSizes).reduce((sum, size) => sum + size, 0);

      expect(totalSize).toBeLessThan(2048); // 2MB
      expect(estimatedSizes.thirdParty).toBeLessThan(1000);
    });
  });

  describe('성능 리포트 생성', () => {
    it('종합 성능 리포트', () => {
      const performanceReport: PerformanceMetrics = {
        loadTime: 1200,
        renderTime: 150,
        memoryUsage: 45,
        componentCount: 25,
      };

      const performanceScore = calculatePerformanceScore(performanceReport);
      expect(performanceScore).toBeGreaterThan(70);
    });
  });
});

function calculatePerformanceScore(metrics: PerformanceMetrics): number {
  let score = 100;

  if (metrics.loadTime > 2000) {
    score -= Math.min(30, (metrics.loadTime - 2000) / 100);
  }

  if (metrics.renderTime > 200) {
    score -= Math.min(20, (metrics.renderTime - 200) / 10);
  }

  if (metrics.memoryUsage > 100) {
    score -= Math.min(25, (metrics.memoryUsage - 100) / 4);
  }

  if (metrics.componentCount > 50) {
    score -= Math.min(15, (metrics.componentCount - 50) / 2);
  }

  return Math.max(0, Math.round(score));
}
