// src/__tests__/utils/lazyLoad.test.tsx
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { withLazyLoad, preloadScreen } from '../../utils/lazyLoad';

// Mock component for testing
const TestComponent = ({ testProp }: { testProp: string }) => (
  <View testID="test-component">
    <Text>{testProp}</Text>
  </View>
);

// Mock dynamic import
const mockImport = jest.fn();

describe('LazyLoad Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('withLazyLoad', () => {
    it('컴포넌트를 lazy로 로드해야 함', async () => {
      mockImport.mockResolvedValue({ default: TestComponent });
      
      const LazyTestComponent = withLazyLoad(() => mockImport(), {
        fallback: <Text testID="loading">로딩중...</Text>
      });

      const { getByTestId, queryByTestId } = render(
        <LazyTestComponent testProp="테스트" />
      );

      // 처음에는 로딩 표시
      expect(getByTestId('loading')).toBeTruthy();
      expect(queryByTestId('test-component')).toBeNull();

      // 컴포넌트 로드 완료 대기
      await waitFor(() => {
        expect(getByTestId('test-component')).toBeTruthy();
      });

      expect(queryByTestId('loading')).toBeNull();
    });

    it('로드 에러를 적절히 처리해야 함', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      mockImport.mockRejectedValue(new Error('로드 실패'));

      const LazyTestComponent = withLazyLoad(() => mockImport(), {
        fallback: <Text testID="loading">로딩중...</Text>
      });

      const { getByTestId } = render(<LazyTestComponent testProp="테스트" />);

      expect(getByTestId('loading')).toBeTruthy();

      // 에러 발생 확인
      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          '컴포넌트 로딩 실패:',
          expect.any(Error)
        );
      });

      consoleError.mockRestore();
    });

    it('커스텀 fallback이 표시되어야 함', () => {
      mockImport.mockImplementation(() => new Promise(() => {})); // 무한 대기
      
      const customFallback = <Text testID="custom-loading">커스텀 로딩</Text>;
      const LazyTestComponent = withLazyLoad(() => mockImport(), {
        fallback: customFallback
      });

      const { getByTestId } = render(<LazyTestComponent testProp="테스트" />);

      expect(getByTestId('custom-loading')).toBeTruthy();
    });
  });

  describe('preloadScreen', () => {
    it('스크린을 미리 로드해야 함', async () => {
      mockImport.mockResolvedValue({ default: TestComponent });

      await preloadScreen(() => mockImport());

      expect(mockImport).toHaveBeenCalledTimes(1);
    });

    it('프리로드 에러를 적절히 처리해야 함', async () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
      mockImport.mockRejectedValue(new Error('프리로드 실패'));

      await preloadScreen(() => mockImport());

      expect(consoleWarn).toHaveBeenCalledWith(
        '스크린 프리로드 실패:',
        expect.any(Error)
      );

      consoleWarn.mockRestore();
    });

    it('중복 프리로드를 방지해야 함', async () => {
      mockImport.mockResolvedValue({ default: TestComponent });

      // 같은 함수를 여러 번 호출
      await Promise.all([
        preloadScreen(() => mockImport()),
        preloadScreen(() => mockImport()),
        preloadScreen(() => mockImport())
      ]);

      // 실제로는 한 번만 호출되어야 함 (캐싱)
      expect(mockImport).toHaveBeenCalledTimes(1);
    });
  });

  describe('성능 테스트', () => {
    it('lazy 로딩이 성능을 향상시켜야 함', async () => {
      const startTime = Date.now();
      
      // Lazy component 생성 (실제 로드는 안 됨)
      const LazyTestComponent = withLazyLoad(() => mockImport());
      
      const createTime = Date.now() - startTime;
      
      // Lazy 컴포넌트 생성은 매우 빨라야 함
      expect(createTime).toBeLessThan(10);
    });
  });
});