// src/utils/performance.js - Performance optimization utilities
import { memo } from 'react';

// Higher-order component for React.memo with custom comparison
export const withMemoization = (Component, customCompare) => {
  return memo(Component, customCompare);
};

// Memoization for expensive calculations
export const memoize = (fn, getKey = (...args) => JSON.stringify(args)) => {
  const cache = new Map();
  
  return (...args) => {
    const key = getKey(...args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn(...args);
    cache.set(key, result);
    
    // Clean up cache if it gets too large
    if (cache.size > 100) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    return result;
  };
};

// Debounce function for search and API calls
export const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

// Throttle function for scroll events
export const throttle = (func, limit) => {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Virtual scrolling utility
export const getVisibleItems = (items, containerHeight, itemHeight, scrollTop) => {
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    startIndex + Math.ceil(containerHeight / itemHeight) + 1,
    items.length - 1
  );
  
  return {
    startIndex: Math.max(0, startIndex),
    endIndex,
    visibleItems: items.slice(startIndex, endIndex + 1)
  };
};

// Image lazy loading utility
export const createImageObserver = (callback) => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          callback(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );
  
  return observer;
};

// Bundle analysis utility
export const logBundleSize = () => {
  if (process.env.NODE_ENV === 'development') {
    const scripts = document.querySelectorAll('script[src]');
    const styles = document.querySelectorAll('link[rel="stylesheet"]');
    
    let totalSize = 0;
    
    scripts.forEach(script => {
      fetch(script.src, { method: 'HEAD' })
        .then(response => {
          const size = parseInt(response.headers.get('content-length')) || 0;
          totalSize += size;
          console.log(`Script: ${script.src.split('/').pop()} - ${(size / 1024).toFixed(2)}KB`);
        })
        .catch(() => {}); // Ignore CORS errors
    });
    
    console.log(`Scripts found: ${scripts.length}`);
    console.log(`Stylesheets found: ${styles.length}`);
  }
};

// Performance monitoring
export const markPerformance = (name) => {
  if (window.performance && window.performance.mark) {
    window.performance.mark(name);
  }
};

export const measurePerformance = (name, startMark, endMark) => {
  if (window.performance && window.performance.measure) {
    window.performance.measure(name, startMark, endMark);
    
    const measure = window.performance.getEntriesByName(name)[0];
    if (measure) {
      console.log(`[Performance] ${name}: ${measure.duration.toFixed(2)}ms`);
    }
  }
};