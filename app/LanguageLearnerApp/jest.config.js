// jest.config.js - Jest 설정
module.exports = {
  preset: 'react-native',
  
  // 모듈 파일 확장자
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // TypeScript 변환 설정
  transform: {
    '^.+\\.(ts|tsx)$': 'babel-jest',
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  
  // 테스트 파일 패턴 (e2e 제외)
  testMatch: [
    '**/__tests__/**/*.(ts|tsx|js)',
    '**/*.(test|spec).(ts|tsx|js)'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/android/',
    '/ios/',
    '<rootDir>/e2e/',
  ],
  
  // 커버리지 설정
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/*.stories.tsx',
    '!src/**/*.test.tsx',
    '!src/tests/**',
  ],
  
  // 커버리지 임계값
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  
  // 커버리지 리포터
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Setup 파일
  setupFilesAfterEnv: [
    '<rootDir>/src/tests/setup.ts'
  ],
  
  // Mock 설정
  moduleNameMapper: {
    // 이미지 파일 mock
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/src/tests/mocks/fileMock.js',
    
    // CSS/Style mock
    '\\.(css|less|scss)$': 'identity-obj-proxy',
    
    // 절대 경로 매핑
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@screens/(.*)$': '<rootDir>/src/screens/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@navigation/(.*)$': '<rootDir>/src/navigation/$1',
  },
  
  
  // 변환 무시 패턴 (React Native 라이브러리들)
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-.*|@expo|expo-.*|@react-navigation|react-navigation|@shopify/flash-list)/)'
  ],
  
  // 테스트 환경
  testEnvironment: 'node',
  
  // 모듈 디렉토리
  moduleDirectories: ['node_modules', 'src'],
  
  // Mock 모듈들
  setupFiles: ['<rootDir>/src/tests/setup-mocks.ts'],
  
  // 테스트 타임아웃
  testTimeout: 10000,
  
  // 병렬 실행 설정
  maxWorkers: '50%',
  
  // 캐시 디렉토리
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',
  
  // 상세 출력
  verbose: true,
  
  // 글로벌 변수
  globals: {
    __DEV__: true,
  },
};