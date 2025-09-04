// tree-shake-analyzer.js - 불필요한 코드 및 라이브러리 분석
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class TreeShakeAnalyzer {
  constructor() {
    this.projectRoot = process.cwd();
    this.srcDir = path.join(this.projectRoot, 'src');
    this.nodeModulesDir = path.join(this.projectRoot, 'node_modules');
    this.packageJsonPath = path.join(this.projectRoot, 'package.json');
    this.usedImports = new Set();
    this.unusedImports = new Set();
    this.largeDependencies = [];
  }

  // package.json 분석
  analyzePackageJson() {
    console.log('📦 package.json 분석 중...');
    
    const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    return {
      totalDependencies: Object.keys(dependencies).length,
      dependencies: dependencies,
      scripts: packageJson.scripts || {}
    };
  }

  // 소스 코드에서 import 분석
  analyzeImports() {
    console.log('🔍 Import 구문 분석 중...');
    
    const importPattern = /^import\s+(?:[\w*\s{},]*\s+from\s+)?['"]([@\w\-./]+)['"]/gm;
    const requirePattern = /require\s*\(\s*['"]([@\w\-./]+)['"]\s*\)/g;
    
    this.walkDirectory(this.srcDir, (filePath) => {
      if (this.isSourceFile(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // import 구문 찾기
        let match;
        while ((match = importPattern.exec(content)) !== null) {
          const importPath = match[1];
          if (this.isNodeModule(importPath)) {
            this.usedImports.add(this.getPackageName(importPath));
          }
        }
        
        // require 구문 찾기
        importPattern.lastIndex = 0;
        while ((match = requirePattern.exec(content)) !== null) {
          const importPath = match[1];
          if (this.isNodeModule(importPath)) {
            this.usedImports.add(this.getPackageName(importPath));
          }
        }
      }
    });
    
    console.log(`✅ 사용된 패키지: ${this.usedImports.size}개`);
    return Array.from(this.usedImports);
  }

  // 사용되지 않는 의존성 찾기
  findUnusedDependencies() {
    console.log('🧹 사용되지 않는 의존성 분석 중...');
    
    const packageJson = this.analyzePackageJson();
    const usedPackages = this.analyzeImports();
    
    const allDependencies = Object.keys(packageJson.dependencies);
    const unusedDependencies = [];
    
    for (const dep of allDependencies) {
      if (!usedPackages.includes(dep) && !this.isEssentialPackage(dep)) {
        // 의존성 크기 확인
        const depSize = this.getDependencySize(dep);
        unusedDependencies.push({
          name: dep,
          size: depSize,
          sizeFormatted: this.formatSize(depSize)
        });
      }
    }
    
    // 크기 순으로 정렬
    unusedDependencies.sort((a, b) => b.size - a.size);
    
    console.log(`🗑️  사용되지 않는 의존성: ${unusedDependencies.length}개`);
    
    if (unusedDependencies.length > 0) {
      console.log('제거 가능한 패키지들:');
      unusedDependencies.forEach(dep => {
        console.log(`  - ${dep.name}: ${dep.sizeFormatted}`);
      });
    }
    
    return unusedDependencies;
  }

  // 큰 의존성 분석
  analyzeLargeDependencies() {
    console.log('📏 큰 의존성들 분석 중...');
    
    const packageJson = this.analyzePackageJson();
    const largeDeps = [];
    
    for (const depName of Object.keys(packageJson.dependencies)) {
      const depSize = this.getDependencySize(depName);
      
      // 1MB 이상인 의존성들
      if (depSize > 1024 * 1024) {
        const alternatives = this.suggestAlternatives(depName, depSize);
        
        largeDeps.push({
          name: depName,
          size: depSize,
          sizeFormatted: this.formatSize(depSize),
          alternatives: alternatives
        });
      }
    }
    
    largeDeps.sort((a, b) => b.size - a.size);
    
    if (largeDeps.length > 0) {
      console.log('🔍 큰 의존성들:');
      largeDeps.forEach(dep => {
        console.log(`  - ${dep.name}: ${dep.sizeFormatted}`);
        if (dep.alternatives.length > 0) {
          console.log(`    대안: ${dep.alternatives.join(', ')}`);
        }
      });
    }
    
    return largeDeps;
  }

  // 중복 의존성 분석
  analyzeDuplicateDependencies() {
    console.log('🔄 중복 의존성 분석 중...');
    
    try {
      // npm ls로 의존성 트리 확인
      const output = execSync('npm ls --depth=0 --json', { 
        encoding: 'utf8',
        cwd: this.projectRoot 
      });
      
      const depsTree = JSON.parse(output);
      const duplicates = [];
      
      // 버전 충돌 확인
      for (const [name, info] of Object.entries(depsTree.dependencies || {})) {
        if (info.problems && info.problems.length > 0) {
          duplicates.push({
            name,
            problems: info.problems,
            version: info.version
          });
        }
      }
      
      if (duplicates.length > 0) {
        console.log('⚠️  중복/충돌 의존성:');
        duplicates.forEach(dup => {
          console.log(`  - ${dup.name}@${dup.version}: ${dup.problems.join(', ')}`);
        });
      }
      
      return duplicates;
      
    } catch (error) {
      console.warn('npm ls 실행 실패:', error.message);
      return [];
    }
  }

  // Metro 설정 최적화 분석
  analyzeMetroConfig() {
    console.log('⚙️ Metro 설정 분석 중...');
    
    const metroConfigPath = path.join(this.projectRoot, 'metro.config.js');
    
    if (!fs.existsSync(metroConfigPath)) {
      return {
        exists: false,
        recommendations: [
          'metro.config.js 파일을 생성하여 번들링 최적화',
          'Tree shaking 활성화',
          '불필요한 모듈 제외 설정'
        ]
      };
    }
    
    const configContent = fs.readFileSync(metroConfigPath, 'utf8');
    const analysis = {
      exists: true,
      hasTreeShaking: configContent.includes('resolver') && configContent.includes('platforms'),
      hasExclusions: configContent.includes('blockList') || configContent.includes('blacklistRE'),
      recommendations: []
    };
    
    if (!analysis.hasTreeShaking) {
      analysis.recommendations.push('Tree shaking을 위한 resolver 설정 추가');
    }
    
    if (!analysis.hasExclusions) {
      analysis.recommendations.push('불필요한 파일들을 제외하는 blockList 설정 추가');
    }
    
    return analysis;
  }

  // 필수 패키지인지 확인
  isEssentialPackage(packageName) {
    const essentialPackages = [
      'react',
      'react-native',
      '@react-navigation/native',
      'expo',
      'typescript',
      '@babel/core'
    ];
    
    return essentialPackages.some(essential => 
      packageName.startsWith(essential)
    );
  }

  // 의존성 크기 계산
  getDependencySize(packageName) {
    try {
      const packagePath = path.join(this.nodeModulesDir, packageName);
      return this.getDirectorySize(packagePath);
    } catch (error) {
      return 0;
    }
  }

  // 디렉토리 크기 계산
  getDirectorySize(dirPath) {
    let totalSize = 0;
    
    if (!fs.existsSync(dirPath)) return 0;
    
    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        
        try {
          if (item.isDirectory()) {
            totalSize += this.getDirectorySize(itemPath);
          } else if (item.isFile()) {
            const stats = fs.statSync(itemPath);
            totalSize += stats.size;
          }
        } catch (error) {
          // 권한 오류 등 무시
        }
      }
    } catch (error) {
      // 접근 오류 무시
    }
    
    return totalSize;
  }

  // 대안 패키지 제안
  suggestAlternatives(packageName, size) {
    const alternatives = {
      'lodash': ['ramda (더 작음)', 'native JS methods'],
      'moment': ['date-fns (더 작음)', 'dayjs (더 작음)'],
      'axios': ['fetch API (내장)', '@react-native-async-storage/async-storage'],
      'react-native-vector-icons': ['@expo/vector-icons (이미 포함)'],
      'react-native-svg': ['react-native-svg-lite']
    };
    
    return alternatives[packageName] || [];
  }

  // 파일 크기 포맷
  formatSize(bytes) {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  }

  // 소스 파일 판별
  isSourceFile(filePath) {
    return /\.(js|jsx|ts|tsx)$/.test(filePath);
  }

  // node_modules 패키지인지 판별
  isNodeModule(importPath) {
    return !importPath.startsWith('.') && !importPath.startsWith('/');
  }

  // 패키지명 추출
  getPackageName(importPath) {
    if (importPath.startsWith('@')) {
      const parts = importPath.split('/');
      return `${parts[0]}/${parts[1]}`;
    }
    return importPath.split('/')[0];
  }

  // 디렉토리 순회
  walkDirectory(dirPath, callback) {
    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        
        if (item.isDirectory() && !item.name.startsWith('.')) {
          this.walkDirectory(itemPath, callback);
        } else if (item.isFile()) {
          callback(itemPath);
        }
      }
    } catch (error) {
      console.warn(`디렉토리 접근 오류: ${dirPath}`, error.message);
    }
  }

  // 최적화 스크립트 생성
  generateOptimizationScript(unusedDeps) {
    const scriptLines = [
      '#!/bin/bash',
      '# 자동 생성된 의존성 정리 스크립트',
      '# 실행 전 백업을 권장합니다',
      '',
      'echo "🧹 불필요한 의존성 제거 중..."',
      ''
    ];
    
    if (unusedDeps.length > 0) {
      scriptLines.push('# 사용되지 않는 의존성 제거');
      unusedDeps.forEach(dep => {
        scriptLines.push(`npm uninstall ${dep.name} # ${dep.sizeFormatted} 절약`);
      });
      scriptLines.push('');
    }
    
    scriptLines.push(
      '# 캐시 정리',
      'npm cache clean --force',
      '',
      '# 의존성 재설치 (최적화된 버전)',
      'npm install',
      '',
      'echo "✅ 최적화 완료!"'
    );
    
    const scriptPath = path.join(this.projectRoot, 'optimize-dependencies.sh');
    fs.writeFileSync(scriptPath, scriptLines.join('\n'));
    
    // 실행 권한 부여 (Unix 시스템)
    try {
      execSync(`chmod +x ${scriptPath}`);
    } catch (error) {
      // Windows에서는 무시
    }
    
    return scriptPath;
  }

  // 전체 분석 실행
  async runFullAnalysis() {
    console.log('🚀 Tree Shaking 분석 시작...\n');
    
    const results = {
      timestamp: new Date().toISOString(),
      packageInfo: this.analyzePackageJson(),
      usedImports: this.analyzeImports(),
      unusedDependencies: this.findUnusedDependencies(),
      largeDependencies: this.analyzeLargeDependencies(),
      duplicateDependencies: this.analyzeDuplicateDependencies(),
      metroConfig: this.analyzeMetroConfig()
    };
    
    // 절약 가능한 크기 계산
    const totalSavings = results.unusedDependencies.reduce((sum, dep) => sum + dep.size, 0);
    
    console.log('\n📊 분석 결과 요약:');
    console.log(`전체 의존성: ${results.packageInfo.totalDependencies}개`);
    console.log(`사용된 패키지: ${results.usedImports.length}개`);
    console.log(`제거 가능: ${results.unusedDependencies.length}개`);
    console.log(`절약 가능 크기: ${this.formatSize(totalSavings)}`);
    
    // 최적화 스크립트 생성
    if (results.unusedDependencies.length > 0) {
      const scriptPath = this.generateOptimizationScript(results.unusedDependencies);
      console.log(`\n📝 최적화 스크립트 생성: ${scriptPath}`);
    }
    
    // 결과 저장
    const reportPath = path.join(this.projectRoot, 'tree-shake-analysis.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`📋 상세 리포트 저장: ${reportPath}`);
    
    return results;
  }
}

// CLI 실행
if (require.main === module) {
  const analyzer = new TreeShakeAnalyzer();
  analyzer.runFullAnalysis().catch(console.error);
}

module.exports = TreeShakeAnalyzer;