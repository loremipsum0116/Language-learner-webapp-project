// src/utils/bundleOptimization.js - Bundle size optimization utilities
import { lazy } from 'react';

// Lazy loading for heavy libraries
export const loadChartLibrary = () => import('recharts');
export const loadDateLibrary = () => import('dayjs');
export const loadMarkdownLibrary = () => import('react-markdown');

// Tree-shakable library imports
export const loadLodashFunctions = async (functions) => {
  const promises = functions.map(func => import(`lodash/${func}`));
  const modules = await Promise.all(promises);
  return modules.reduce((acc, module, index) => {
    acc[functions[index]] = module.default;
    return acc;
  }, {});
};

// Dynamic import helper
export const dynamicImport = (importPath) => {
  return lazy(() => import(importPath));
};

// Preload critical resources
export const preloadCriticalResources = () => {
  // Preload critical CSS
  const criticalCSS = [
    '/static/css/bootstrap.min.css',
    '/static/css/main.css'
  ];

  criticalCSS.forEach(href => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = href;
    link.onload = () => {
      link.rel = 'stylesheet';
    };
    document.head.appendChild(link);
  });

  // Preload critical fonts
  const criticalFonts = [
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
  ];

  criticalFonts.forEach(href => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = href;
    document.head.appendChild(link);
  });
};

// Service Worker registration for caching
export const registerServiceWorker = () => {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    });
  }
};

// Resource hints for better loading performance
export const addResourceHints = () => {
  // DNS prefetch for external domains
  const externalDomains = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'api.example.com' // Replace with actual API domain
  ];

  externalDomains.forEach(domain => {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = `//${domain}`;
    document.head.appendChild(link);
  });

  // Preconnect to critical origins
  const criticalOrigins = [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com'
  ];

  criticalOrigins.forEach(origin => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
};

// Remove unused CSS classes (to be run at build time)
export const removeUnusedCSS = (css, usedClasses) => {
  const rules = css.split('}');
  return rules.filter(rule => {
    const selector = rule.split('{')[0].trim();
    return usedClasses.some(className => 
      selector.includes(`.${className}`) || 
      selector.includes('#') || 
      selector.includes('*') ||
      selector.includes('::') ||
      selector.includes(':')
    );
  }).join('}');
};

// Optimize images for better loading
export const optimizeImages = () => {
  const images = document.querySelectorAll('img[data-src]');
  
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.classList.remove('lazy');
        observer.unobserve(img);
      }
    });
  });

  images.forEach(img => imageObserver.observe(img));
};

// Critical path CSS inlining
export const inlineCriticalCSS = (criticalCSS) => {
  const style = document.createElement('style');
  style.textContent = criticalCSS;
  document.head.appendChild(style);
};

// Bundle splitting configuration
export const bundleSplittingConfig = {
  chunks: {
    vendor: {
      test: /[\\/]node_modules[\\/]/,
      name: 'vendors',
      chunks: 'all',
      priority: 10,
      enforce: true
    },
    common: {
      name: 'common',
      minChunks: 2,
      chunks: 'all',
      priority: 5,
      reuseExistingChunk: true,
      enforce: true
    },
    react: {
      test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/,
      name: 'react',
      chunks: 'all',
      priority: 20
    },
    ui: {
      test: /[\\/]node_modules[\\/](bootstrap|@fortawesome)[\\/]/,
      name: 'ui',
      chunks: 'all',
      priority: 15
    }
  }
};

// Performance monitoring for bundle loading
export const monitorBundlePerformance = () => {
  if (window.performance && window.performance.getEntriesByType) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const resources = window.performance.getEntriesByType('resource');
        const scripts = resources.filter(resource => resource.name.includes('.js'));
        const styles = resources.filter(resource => resource.name.includes('.css'));
        
        console.group('[Bundle Performance]');
        console.log(`Scripts loaded: ${scripts.length}`);
        console.log(`Styles loaded: ${styles.length}`);
        
        const totalScriptSize = scripts.reduce((total, script) => {
          return total + (script.transferSize || 0);
        }, 0);
        
        const totalStyleSize = styles.reduce((total, style) => {
          return total + (style.transferSize || 0);
        }, 0);
        
        console.log(`Total script size: ${(totalScriptSize / 1024).toFixed(2)}KB`);
        console.log(`Total style size: ${(totalStyleSize / 1024).toFixed(2)}KB`);
        console.groupEnd();
      }, 1000);
    });
  }
};