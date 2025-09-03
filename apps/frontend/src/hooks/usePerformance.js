// src/hooks/usePerformance.js - Performance monitoring hooks
import { useEffect, useRef, useCallback, useState } from 'react';

// Hook to measure component render time
export const useRenderTime = (componentName) => {
  const renderTimeRef = useRef();

  useEffect(() => {
    const startTime = performance.now();
    renderTimeRef.current = startTime;

    return () => {
      const endTime = performance.now();
      const renderTime = endTime - renderTimeRef.current;
      
      if (renderTime > 16) { // > 1 frame at 60fps
        console.warn(`[Performance] ${componentName} render took ${renderTime.toFixed(2)}ms`);
      }
    };
  });
};

// Hook to debounce expensive operations
export const useDebounce = (value, delay) => {
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

// Hook to throttle function calls
export const useThrottle = (callback, delay) => {
  const lastRun = useRef(Date.now());

  return useCallback((...args) => {
    if (Date.now() - lastRun.current >= delay) {
      callback(...args);
      lastRun.current = Date.now();
    }
  }, [callback, delay]);
};

// Hook to monitor memory usage
export const useMemoryMonitor = () => {
  useEffect(() => {
    if (performance.memory) {
      const logMemoryUsage = () => {
        const memory = performance.memory;
        const usedMB = (memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
        const totalMB = (memory.totalJSHeapSize / 1024 / 1024).toFixed(2);
        
        console.log(`[Memory] Used: ${usedMB}MB, Total: ${totalMB}MB`);
      };

      const interval = setInterval(logMemoryUsage, 30000); // Every 30 seconds
      return () => clearInterval(interval);
    }
  }, []);
};

// Hook for intersection observer (lazy loading)
export const useIntersectionObserver = (options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef();

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      { threshold: 0.1, ...options }
    );

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [options]);

  return [ref, isIntersecting];
};