// LazyScreens.ts - 화면별 코드 스플리팅 정의
import { createLazyScreen, bundleSplitManager } from '../utils/lazyLoad';

// =====  AUTH SCREENS =====
export const LoginScreen = createLazyScreen(
  () => import('../screens/auth/LoginScreen'),
  '로그인'
);

export const LogoutScreen = createLazyScreen(
  () => import('../screens/auth/LogoutScreen'),
  '로그아웃'
);

// ===== MAIN SCREENS =====
export const HomeScreen = createLazyScreen(
  () => import('../screens/HomeScreen'),
  '홈'
);

export const LandingPageScreen = createLazyScreen(
  () => import('../screens/LandingPageScreen'),
  '랜딩 페이지'
);

// ===== LEARNING SCREENS =====
export const LearnVocabScreen = createLazyScreen(
  () => import('../screens/LearnVocabScreen'),
  '단어 학습'
);

export const LearnStartScreen = createLazyScreen(
  () => import('../screens/LearnStartScreen'),
  '학습 시작'
);

export const GrammarHubScreen = createLazyScreen(
  () => import('../screens/GrammarHubScreen'),
  '문법 허브'
);

export const GrammarQuizScreen = createLazyScreen(
  () => import('../screens/GrammarQuizScreen'),
  '문법 퀴즈'
);

// ===== QUIZ SCREENS =====
export const MiniQuizScreen = createLazyScreen(
  () => import('../screens/MiniQuizScreen'),
  '미니 퀴즈'
);

// ===== LISTENING SCREENS =====
export const ListeningListScreen = createLazyScreen(
  () => import('../screens/ListeningListScreen'),
  '리스닝 목록'
);

export const ListeningPracticeScreen = createLazyScreen(
  () => import('../screens/ListeningPracticeScreen'),
  '리스닝 연습'
);

// ===== READING SCREENS =====
export const ReadingListScreen = createLazyScreen(
  () => import('../screens/reading/ReadingListScreen'),
  '읽기 목록'
);

export const ReadingReviewScreen = createLazyScreen(
  () => import('../screens/reading/ReadingReviewScreen'),
  '읽기 복습'
);

// ===== SRS SCREENS =====
export const SrsParentFolderScreen = createLazyScreen(
  () => import('../screens/srs/SrsParentFolderScreen'),
  'SRS 폴더'
);

export const SrsQuizScreen = createLazyScreen(
  () => import('../screens/srs/SrsQuizScreen'),
  'SRS 퀴즈'
);

export const WrongAnswerQuizScreen = createLazyScreen(
  () => import('../screens/srs/WrongAnswerQuizScreen'),
  '오답 퀴즈'
);

// ===== ADMIN SCREENS =====
export const AdminScreen = createLazyScreen(
  () => import('../screens/admin/AdminScreen'),
  '관리자'
);

export const AdminDashboardScreen = createLazyScreen(
  () => import('../screens/admin/AdminDashboardScreen'),
  '관리자 대시보드'
);

export const AdminNewScreen = createLazyScreen(
  () => import('../screens/admin/AdminNewScreen'),
  '관리자 신규'
);

export const SuperAdminDashboardScreen = createLazyScreen(
  () => import('../screens/admin/SuperAdminDashboardScreen'),
  '슈퍼 관리자'
);

// ===== PERFORMANCE SCREENS =====
export const PerformanceTestScreen = createLazyScreen(
  () => import('../screens/PerformanceTestScreen'),
  '성능 테스트'
);

export const MasteredWordsScreen = createLazyScreen(
  () => import('../screens/MasteredWordsScreen'),
  '마스터한 단어'
);

// ===== 사전 로딩 전략 =====
export const setupPreloadStrategy = () => {
  // 앱 시작 후 주요 화면들 사전 로딩
  setTimeout(() => {
    // 높은 우선순위 - 자주 사용되는 화면
    bundleSplitManager.schedulePreload(
      'home',
      () => import('../screens/HomeScreen'),
      'high'
    );
    
    bundleSplitManager.schedulePreload(
      'learn-vocab',
      () => import('../screens/LearnVocabScreen'),
      'high'
    );

    // 중간 우선순위 - 일반적으로 사용되는 화면
    bundleSplitManager.schedulePreload(
      'mini-quiz',
      () => import('../screens/MiniQuizScreen'),
      'medium'
    );

    bundleSplitManager.schedulePreload(
      'grammar-hub',
      () => import('../screens/GrammarHubScreen'),
      'medium'
    );

    // 낮은 우선순위 - 가끔 사용되는 화면
    bundleSplitManager.schedulePreload(
      'admin',
      () => import('../screens/admin/AdminScreen'),
      'low'
    );

    bundleSplitManager.schedulePreload(
      'performance-test',
      () => import('../screens/PerformanceTestScreen'),
      'low'
    );

  }, 2000); // 앱 시작 후 2초 대기
};

// ===== 조건부 로딩 =====
export const getConditionalScreens = () => {
  const isAdmin = false; // 실제로는 사용자 권한 체크
  const isDevelopment = __DEV__;

  const screens: Record<string, any> = {};

  // 관리자 화면은 관리자만 로딩
  if (isAdmin) {
    screens.AdminScreen = AdminScreen;
    screens.AdminDashboardScreen = AdminDashboardScreen;
    screens.SuperAdminDashboardScreen = SuperAdminDashboardScreen;
  }

  // 개발 모드에서만 성능 테스트 화면 로딩
  if (isDevelopment) {
    screens.PerformanceTestScreen = PerformanceTestScreen;
  }

  return screens;
};

// ===== 번들 크기 최적화를 위한 동적 import 래퍼 =====
export class DynamicImportManager {
  private static importCache = new Map<string, Promise<any>>();

  static async importWithCache<T>(
    key: string,
    importFunc: () => Promise<T>
  ): Promise<T> {
    if (this.importCache.has(key)) {
      return this.importCache.get(key)!;
    }

    const importPromise = importFunc();
    this.importCache.set(key, importPromise);

    try {
      const result = await importPromise;
      return result;
    } catch (error) {
      // 실패 시 캐시에서 제거
      this.importCache.delete(key);
      throw error;
    }
  }

  static clearCache() {
    this.importCache.clear();
  }

  static getCacheStats() {
    return {
      cachedImports: this.importCache.size,
      cacheKeys: Array.from(this.importCache.keys())
    };
  }
}

// ===== 청크별 크기 추정 =====
export const CHUNK_SIZES = {
  // 주요 화면들 (KB 단위 추정)
  'auth': 50,        // 로그인/로그아웃
  'home': 80,        // 홈 화면
  'learn-vocab': 150, // 단어 학습 (가장 큰 화면)
  'quiz': 100,       // 퀴즈 화면들
  'admin': 120,      // 관리자 화면들
  'reading': 90,     // 읽기 화면들
  'listening': 85,   // 리스닝 화면들
  'srs': 110,        // SRS 화면들
  'performance': 60  // 성능 테스트
};

// ===== 번들 최적화 리포트 =====
export const getBundleOptimizationReport = () => {
  const totalEstimatedSize = Object.values(CHUNK_SIZES).reduce((a, b) => a + b, 0);
  const cacheStats = DynamicImportManager.getCacheStats();
  const bundleStats = bundleSplitManager.getStats();

  return {
    totalEstimatedChunkSize: `${totalEstimatedSize}KB`,
    chunksCount: Object.keys(CHUNK_SIZES).length,
    cachedImports: cacheStats.cachedImports,
    loadedChunks: bundleStats.loadedChunks,
    pendingPreloads: bundleStats.pendingPreloads,
    optimization: {
      splitScreens: Object.keys(CHUNK_SIZES).length,
      cacheHitRate: cacheStats.cachedImports > 0 
        ? `${((cacheStats.cachedImports / Object.keys(CHUNK_SIZES).length) * 100).toFixed(1)}%`
        : '0%'
    }
  };
};