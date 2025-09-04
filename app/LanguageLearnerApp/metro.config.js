// metro.config.js - Metro 번들러 최적화 설정
const { getDefaultConfig } = require('expo/metro-config');
const { mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

// 번들 크기 최적화를 위한 설정
const optimizedConfig = {
  resolver: {
    // Tree shaking을 위한 플랫폼별 확장자 순서
    platforms: ['native', 'android', 'ios', 'web'],
    
    // 불필요한 파일들 제외
    blockList: [
      // 테스트 파일들
      /.*\/__tests__\/.*$/,
      /.*\.test\.(js|jsx|ts|tsx)$/,
      /.*\.spec\.(js|jsx|ts|tsx)$/,
      
      // 스토리북 파일들
      /.*\.stories\.(js|jsx|ts|tsx)$/,
      /.*\.story\.(js|jsx|ts|tsx)$/,
      
      // 개발용 파일들
      /.*\/dev\/.*$/,
      /.*\/debug\/.*$/,
      /.*\.dev\.(js|jsx|ts|tsx)$/,
      
      // 문서 파일들
      /.*\/docs\/.*$/,
      /.*\.md$/,
      /.*\.markdown$/,
      
      // 설정 파일들 (번들에 불필요)
      /.*\.config\.(js|json)$/,
      /.*rc\.(js|json)$/,
      
      // 임시 파일들
      /.*\/tmp\/.*$/,
      /.*\/temp\/.*$/,
      /.*\.tmp$/,
      /.*\.temp$/,
      
      // IDE 파일들
      /.*\/\.vscode\/.*$/,
      /.*\/\.idea\/.*$/,
      /.*\.swp$/,
      
      // OS 파일들
      /.*\/\.DS_Store$/,
      /.*\/Thumbs\.db$/,
    ],
    
    // 소스맵 확장자
    sourceExts: [
      'expo.ts',
      'expo.tsx',
      'expo.js',
      'expo.jsx',
      'ts',
      'tsx',
      'js',
      'jsx',
      'json',
      'wasm',
      'svg'
    ],
    
    // 에셋 확장자 (이미지 최적화)
    assetExts: [
      // 최적화된 이미지 형식 우선
      'webp',
      'avif',
      'png',
      'jpg',
      'jpeg',
      'gif',
      'bmp',
      'tiff',
      'svg',
      
      // 폰트
      'ttf',
      'otf',
      'woff',
      'woff2',
      
      // 오디오
      'mp3',
      'wav',
      'aac',
      'm4a',
      'ogg',
      
      // 비디오
      'mp4',
      'mov',
      'avi',
      'mkv',
      
      // 기타
      'pdf',
      'zip',
      'bin'
    ],
    
    // 노드 모듈 해결 개선
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules')
    ],
    
    // 중복 의존성 해결
    alias: {
      // 중복되기 쉬운 라이브러리들의 별칭 설정
      'react-native$': path.resolve(__dirname, 'node_modules/react-native'),
      'react$': path.resolve(__dirname, 'node_modules/react'),
    },
  },
  
  transformer: {
    // 바벨 설정 최적화
    babelTransformerPath: require.resolve('metro-react-native-babel-transformer'),
    
    // 인라인 source maps 비활성화 (프로덕션에서 크기 감소)
    enableBabelRCLookup: false,
    
    // Hermes 최적화
    hermesParser: true,
    
    // SVG 변환 설정
    svgAssetPlugin: {
      hermesParser: true,
      unstable_allowRequireContext: false
    },
    
    // 실험적 기능들
    experimentalImportSupport: true,
    inlineRequires: true,
    
    // 미니파이 설정
    minifierPath: require.resolve('metro-minify-terser'),
    minifierConfig: {
      // Terser 최적화 옵션
      ecma: 2018,
      keep_fnames: false,
      keep_classnames: false,
      mangle: {
        keep_fnames: false,
        keep_classnames: false,
        reserved: ['__DEV__', '__METRO_GLOBAL_PREFIX__']
      },
      compress: {
        drop_console: process.env.NODE_ENV === 'production', // 프로덕션에서 콘솔 제거
        drop_debugger: true,
        pure_getters: true,
        unsafe: false,
        unsafe_comps: false,
        warnings: false,
        sequences: true,
        dead_code: true,
        conditionals: true,
        booleans: true,
        unused: true,
        if_return: true,
        join_vars: true,
        cascade: true,
        collapse_vars: true,
        reduce_vars: true,
        pure_funcs: process.env.NODE_ENV === 'production' ? [
          'console.log',
          'console.info',
          'console.debug',
          'console.warn'
        ] : []
      },
      output: {
        comments: false,
        beautify: false
      }
    },
  },
  
  serializer: {
    // 번들 분할 설정
    createModuleIdFactory: () => {
      // 안정적인 모듈 ID 생성 (캐싱에 유리)
      const moduleIds = new Map();
      let nextId = 0;
      
      return (path) => {
        if (!moduleIds.has(path)) {
          moduleIds.set(path, nextId++);
        }
        return moduleIds.get(path);
      };
    },
    
    // 모듈 병합 최적화
    processModuleFilter: (modules) => {
      // 개발 전용 모듈 제외
      if (process.env.NODE_ENV === 'production') {
        return modules.filter(module => {
          return !module.path.includes('__DEV__') &&
                 !module.path.includes('.dev.') &&
                 !module.path.includes('/dev/') &&
                 !module.path.includes('react-devtools');
        });
      }
      return modules;
    },
    
    // 소스맵 최적화
    getModulesRunBeforeMainModule: () => [
      require.resolve('react-native/Libraries/Core/InitializeCore'),
    ],
    
    // 실험적 직렬화 최적화
    experimentalSerializerHook: (graph, delta) => {
      // 중복 모듈 제거 로직
      return graph;
    }
  },
  
  server: {
    // 개발 서버 최적화
    port: 8082,
    
    // 정적 자원 캐싱
    enhanceMiddleware: (middleware, metroServer) => {
      return (req, res, next) => {
        // 이미지 캐싱 헤더 설정
        if (req.url.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1년
        }
        
        // 폰트 캐싱
        if (req.url.match(/\.(ttf|otf|woff|woff2)$/)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1년
        }
        
        // JS 번들 캐싱 (개발 중에는 짧게)
        if (req.url.match(/\.bundle$/)) {
          const maxAge = process.env.NODE_ENV === 'production' ? 86400 : 0; // 1일 vs 캐시 없음
          res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
        }
        
        return middleware(req, res, next);
      };
    }
  },
  
  // 캐시 설정
  cacheStores: [
    // 파일 시스템 캐시
    {
      type: 'FileStore',
      root: path.join(__dirname, 'node_modules/.cache/metro')
    }
  ],
  
  // 워커 설정 (병렬 처리)
  maxWorkers: Math.max(1, Math.floor(require('os').cpus().length / 2)),
  
  // 실험적 기능들
  unstable_allowRequireContext: false,
  
  // 감시 설정 (개발 시 성능)
  watchFolders: [
    path.resolve(__dirname, 'src'),
    path.resolve(__dirname, 'assets')
  ],
  
  // 심볼릭 링크 처리
  resolver: {
    ...defaultConfig.resolver,
    symlinks: false,
  }
};

// 환경별 추가 설정
if (process.env.NODE_ENV === 'production') {
  // 프로덕션 전용 최적화
  optimizedConfig.transformer.minifierConfig.compress.drop_console = true;
  optimizedConfig.transformer.minifierConfig.compress.drop_debugger = true;
  
  // 소스맵 비활성화 (번들 크기 감소)
  optimizedConfig.transformer.enableBabelRuntime = false;
} else {
  // 개발 모드 최적화
  optimizedConfig.resolver.blockList = [
    ...optimizedConfig.resolver.blockList,
    // 개발 모드에서만 추가 제외
    /.*\/release\/.*$/
  ];
}

// 플랫폼별 특별 설정
const platformConfig = {
  android: {
    // Android 특별 최적화
    transformer: {
      ...optimizedConfig.transformer,
      // Android용 추가 압축
      minifierConfig: {
        ...optimizedConfig.transformer.minifierConfig,
        compress: {
          ...optimizedConfig.transformer.minifierConfig.compress,
          // Android WebView 호환성
          ecma: 2017
        }
      }
    }
  },
  ios: {
    // iOS 특별 최적화
    transformer: {
      ...optimizedConfig.transformer,
      // iOS JavaScriptCore 최적화
      minifierConfig: {
        ...optimizedConfig.transformer.minifierConfig,
        compress: {
          ...optimizedConfig.transformer.minifierConfig.compress,
          ecma: 2018
        }
      }
    }
  }
};

// 현재 플랫폼에 따른 설정 병합
const platform = process.env.REACT_NATIVE_PLATFORM || 'android';
const finalConfig = {
  ...optimizedConfig,
  ...(platformConfig[platform] || {})
};

module.exports = mergeConfig(defaultConfig, finalConfig);

// 번들 크기 리포팅 (개발 모드)
if (__DEV__) {
  console.log('📦 Metro 최적화 설정 로드됨');
  console.log(`🎯 타겟 플랫폼: ${platform}`);
  console.log(`⚡ 워커 수: ${finalConfig.maxWorkers}`);
  console.log(`🗂️  제외된 파일 패턴: ${finalConfig.resolver.blockList.length}개`);
}