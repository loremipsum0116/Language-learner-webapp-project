// middleware/mobile.ts
import { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import { DeviceInfo } from '../types';

// 모바일 디바이스 감지 미들웨어
export const detectDevice = (req: Request, res: Response, next: NextFunction): Response | void => {
  const userAgent = req.headers['user-agent'] || '';
  const mobileAppHeader = req.headers['x-mobile-app'] as string;
  const appVersion = req.headers['x-app-version'] as string;
  const platform = req.headers['x-platform'] as string; // ios, android
  
  // 디바이스 정보 추출
  req.deviceInfo = {
    platform: platform || 'unknown',
    appVersion: appVersion || '1.0.0',
    userAgent: userAgent,
    lastLoginAt: new Date()
  };

  // 모바일 앱에서만 접근 가능하도록 제한 (선택사항)
  if (process.env.MOBILE_API_STRICT && !mobileAppHeader) {
    return res.status(403).json({
      success: false,
      error: 'Mobile app access required'
    });
  }

  next();
};

// 모바일 헤더 검증 미들웨어
export const validateMobileHeaders = (req: Request, res: Response, next: NextFunction): Response | void => {
  // 개발 환경에서는 헤더 검증 생략
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  
  // 필수 모바일 헤더 검증 (프로덕션만)
  const requiredHeaders = ['x-platform'];
  
  for (const header of requiredHeaders) {
    if (!req.headers[header]) {
      return res.status(400).json({
        success: false,
        error: `Missing required header: ${header}`
      });
    }
  }

  // 지원하는 플랫폼 검증
  const supportedPlatforms = ['ios', 'android', 'unknown'];
  const platform = req.headers['x-platform'] as string;
  
  if (platform && !supportedPlatforms.includes(platform)) {
    return res.status(400).json({
      success: false,
      error: `Unsupported platform: ${platform}`
    });
  }

  next();
};

// 모바일 최적화 압축 미들웨어
export const compressionOptimization = compression({
  // 모바일에서 더 적극적인 압축
  level: 6,
  threshold: 1024, // 1KB 이상만 압축
  filter: (req: Request, res: Response) => {
    // 이미 압축된 파일이나 이미지는 제외
    if (req.headers['x-no-compression']) return false;
    if (res.getHeader('Content-Type')?.toString().includes('image/')) return false;
    if (res.getHeader('Content-Type')?.toString().includes('audio/')) return false;
    
    return compression.filter(req, res);
  }
});

// 모바일 특화 캐시 헤더 설정
export const setCacheHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // 정적 리소스에 대한 모바일 친화적 캐시 설정
  if (req.path.includes('/audio/') || req.path.includes('/image/')) {
    // 오디오/이미지는 긴 캐시
    res.set('Cache-Control', 'public, max-age=86400'); // 24시간
  } else if (req.path.includes('/sync/') || req.path.includes('/learning/')) {
    // 동적 콘텐츠는 짧은 캐시
    res.set('Cache-Control', 'private, max-age=300'); // 5분
  }

  // 모바일 앱용 ETag 설정
  res.set('ETag', `"mobile-${Date.now()}"`);
  
  next();
};

// 배치 요청 처리 미들웨어
export const batchRequestHandler = (req: Request, res: Response, next: NextFunction): Response | void => {
  // POST /batch 엔드포인트에서 여러 요청을 한 번에 처리
  if (req.path === '/batch' && req.method === 'POST') {
    const { requests } = req.body;
    
    if (!Array.isArray(requests)) {
      return res.status(400).json({
        success: false,
        error: 'Requests must be an array'
      });
    }

    if (requests.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10 requests per batch'
      });
    }

    // 배치 요청 처리 로직은 각 라우터에서 구현
    req.isBatchRequest = true;
    req.batchRequests = requests;
  }

  next();
};

// 오프라인 지원을 위한 응답 헤더
export const offlineSupportHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // 오프라인 캐시 가능한 리소스 표시
  const offlineCacheableEndpoints = [
    '/learning/vocab',
    '/srs/cards',
    '/learning/categories',
    '/learning/levels'
  ];

  const isOfflineCacheable = offlineCacheableEndpoints.some(endpoint => 
    req.path.includes(endpoint)
  );

  if (isOfflineCacheable) {
    res.set('X-Offline-Cacheable', 'true');
    res.set('X-Cache-Strategy', 'cache-first');
  }

  next();
};

// 네트워크 상태 감지
export const networkOptimization = (req: Request, res: Response, next: NextFunction): void => {
  const networkHint = req.headers['x-network-type'] as string; // slow-2g, 2g, 3g, 4g, wifi
  
  if (networkHint) {
    req.networkType = networkHint;
    
    // 느린 네트워크에서는 응답 크기 최적화
    if (['slow-2g', '2g'].includes(networkHint)) {
      req.optimizeForSlowNetwork = true;
      // 응답에서 불필요한 필드 제거를 위한 플래그
      res.set('X-Optimized-Response', 'true');
    }
  }

  next();
};

export default {
  detectDevice,
  validateMobileHeaders,
  compressionOptimization,
  setCacheHeaders,
  batchRequestHandler,
  offlineSupportHeaders,
  networkOptimization
};