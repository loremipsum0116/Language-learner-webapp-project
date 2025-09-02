// src/components/LazyComponents.jsx - Lazy loading components for performance
import React, { lazy } from 'react';

// Lazy load heavy pages
export const LazyHome = lazy(() => import('../pages/Home'));
export const LazyVocabList = lazy(() => import('../pages/VocabList'));
export const LazyMyWordbook = lazy(() => import('../pages/MyWordbook'));
export const LazySrsDashboard = lazy(() => import('../pages/SrsDashboard'));
export const LazyLearnVocab = lazy(() => import('../pages/LearnVocab'));
export const LazyReading = lazy(() => import('../pages/Reading'));
export const LazyListening = lazy(() => import('../pages/Listening'));
export const LazyAdminNew = lazy(() => import('../pages/AdminNew'));

// Lazy load heavy components
export const LazyVocabDetailModal = lazy(() => import('./VocabDetailModal'));
export const LazyReviewTimer = lazy(() => import('./ReviewTimer'));
export const LazyMiniQuiz = lazy(() => import('./MiniQuiz'));

// Custom Suspense wrapper with fallback
export const LazyWrapper = ({ children, fallback }) => (
  <React.Suspense fallback={fallback || <div className="d-flex justify-content-center p-4"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div></div>}>
    {children}
  </React.Suspense>
);