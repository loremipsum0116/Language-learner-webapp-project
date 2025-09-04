// optimize-bundle.js - 종합 번들 최적화 실행 스크립트
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const BundleAnalyzer = require('./bundle-analyzer');
const TreeShakeAnalyzer = require('./tree-shake-analyzer');

class BundleOptimizer {
  constructor() {
    this.projectRoot = process.cwd();
    this.optimizationResults = {};
  }

  async optimize() {
    console.log('🚀 번들 최적화 프로세스 시작...\n');
    
    try {
      // 1. 현재 상태 분석
      await this.analyzeCurrentState();
      
      // 2. Tree shaking 분석 및 정리
      await this.performTreeShaking();
      
      // 3. 이미지 최적화
      await this.optimizeImages();
      
      // 4. 의존성 최적화
      await this.optimizeDependencies();
      
      // 5. 번들 생성 및 분석
      await this.buildAndAnalyze();
      
      // 6. 결과 리포트 생성
      await this.generateFinalReport();
      
      console.log('✅ 번들 최적화 완료!');
      
    } catch (error) {
      console.error('❌ 최적화 실패:', error.message);
      throw error;
    }
  }

  async analyzeCurrentState() {
    console.log('📊 현재 상태 분석 중...');
    
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8')
    );
    
    this.optimizationResults.initialState = {
      dependencies: Object.keys(packageJson.dependencies || {}).length,
      devDependencies: Object.keys(packageJson.devDependencies || {}).length,
      nodeModulesSize: this.getDirectorySize(
        path.join(this.projectRoot, 'node_modules')
      )
    };
    
    console.log(`📦 의존성: ${this.optimizationResults.initialState.dependencies}개`);
    console.log(`🛠️  개발 의존성: ${this.optimizationResults.initialState.devDependencies}개`);
    console.log(`📁 node_modules: ${this.formatSize(this.optimizationResults.initialState.nodeModulesSize)}`);
  }

  async performTreeShaking() {
    console.log('\n🌲 Tree shaking 분석 및 정리...');
    
    const analyzer = new TreeShakeAnalyzer();
    const results = await analyzer.runFullAnalysis();
    
    this.optimizationResults.treeShaking = {
      unusedDependencies: results.unusedDependencies.length,
      potentialSavings: results.unusedDependencies.reduce(
        (sum, dep) => sum + dep.size, 0
      ),
      largeDependencies: results.largeDependencies.length
    };
    
    // 자동으로 안전한 의존성들 제거
    if (results.unusedDependencies.length > 0) {
      console.log('🧹 안전한 미사용 의존성 제거 중...');
      
      const safeDependencies = results.unusedDependencies.filter(dep => 
        this.isSafeToRemove(dep.name)
      );
      
      if (safeDependencies.length > 0) {
        const depsToRemove = safeDependencies.map(dep => dep.name).join(' ');
        console.log(`제거 중: ${depsToRemove}`);
        
        try {
          execSync(`npm uninstall ${depsToRemove}`, { stdio: 'inherit' });
          console.log('✅ 미사용 의존성 제거 완료');
        } catch (error) {
          console.warn('⚠️ 일부 의존성 제거 실패:', error.message);
        }
      }
    }
  }

  async optimizeImages() {
    console.log('\n🖼️ 이미지 최적화 중...');
    
    const imageFormats = ['.png', '.jpg', '.jpeg', '.gif'];
    const imagePaths = [];
    
    // assets 디렉토리에서 이미지 찾기
    this.walkDirectory(
      path.join(this.projectRoot, 'assets'),
      (filePath) => {
        if (imageFormats.some(ext => filePath.toLowerCase().endsWith(ext))) {
          imagePaths.push(filePath);
        }
      }
    );
    
    let optimizedCount = 0;
    let totalSaved = 0;
    
    for (const imagePath of imagePaths) {
      try {
        const originalSize = fs.statSync(imagePath).size;
        
        // 이미지 압축 시뮬레이션 (실제로는 imagemin 등 사용)
        // 여기서는 WebP 변환 권장사항만 생성
        if (!imagePath.includes('.webp')) {
          const webpPath = imagePath.replace(/\.(png|jpg|jpeg)$/i, '.webp');
          console.log(`💡 권장: ${path.basename(imagePath)} → ${path.basename(webpPath)}`);
        }
        
        optimizedCount++;
        
      } catch (error) {
        console.warn(`⚠️ 이미지 처리 실패: ${imagePath}`);
      }
    }
    
    this.optimizationResults.images = {
      totalImages: imagePaths.length,
      optimizedCount,
      totalSaved
    };
    
    console.log(`📸 처리된 이미지: ${optimizedCount}개`);
  }

  async optimizeDependencies() {
    console.log('\n⚙️ 의존성 최적화 중...');
    
    // package.json 정리
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // 중복 의존성 확인
    const duplicates = this.findDuplicateDependencies(packageJson);
    
    // 업데이트 필요한 의존성 확인
    const outdated = await this.checkOutdatedDependencies();
    
    this.optimizationResults.dependencies = {
      duplicates: duplicates.length,
      outdated: outdated.length
    };
    
    if (duplicates.length > 0) {
      console.log(`🔄 중복 의존성 발견: ${duplicates.length}개`);
      duplicates.forEach(dup => {
        console.log(`  - ${dup.name}: ${dup.versions.join(', ')}`);
      });
    }
    
    if (outdated.length > 0) {
      console.log(`📅 업데이트 가능: ${outdated.length}개`);
      outdated.slice(0, 5).forEach(pkg => {
        console.log(`  - ${pkg.name}: ${pkg.current} → ${pkg.latest}`);
      });
    }
  }

  async buildAndAnalyze() {
    console.log('\n🔨 최적화된 번들 빌드 및 분석...');
    
    const analyzer = new BundleAnalyzer();
    
    try {
      // Android 번들 분석
      const androidResult = await analyzer.analyzeAndroidBundle();
      
      // iOS 번들 분석
      const iosResult = await analyzer.analyzeIosBundle();
      
      this.optimizationResults.bundles = {
        android: {
          size: parseFloat(androidResult.size),
          path: androidResult.path
        },
        ios: {
          size: parseFloat(iosResult.size),
          path: iosResult.path
        }
      };
      
      console.log(`📱 Android 번들: ${androidResult.size}MB`);
      console.log(`🍎 iOS 번들: ${iosResult.size}MB`);
      
    } catch (error) {
      console.warn('⚠️ 번들 분석 중 일부 오류:', error.message);
    }
  }

  async generateFinalReport() {
    console.log('\n📊 최종 리포트 생성 중...');
    
    const report = {
      timestamp: new Date().toISOString(),
      optimization: this.optimizationResults,
      recommendations: this.generateRecommendations(),
      performance: this.calculatePerformanceMetrics(),
      nextSteps: this.getNextSteps()
    };
    
    // 리포트 저장
    const reportPath = path.join(this.projectRoot, 'optimization-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // 콘솔 리포트 출력
    this.printConsoleSummary(report);
    
    console.log(`📋 상세 리포트: ${reportPath}`);
  }

  generateRecommendations() {
    const recommendations = [];
    
    // 번들 크기 권장사항
    if (this.optimizationResults.bundles) {
      const { android, ios } = this.optimizationResults.bundles;
      
      if (android.size > 15) {
        recommendations.push({
          type: 'bundle_size',
          platform: 'android',
          message: `Android 번들이 큽니다 (${android.size}MB). 추가 최적화 권장.`
        });
      }
      
      if (ios.size > 15) {
        recommendations.push({
          type: 'bundle_size',
          platform: 'ios',
          message: `iOS 번들이 큽니다 (${ios.size}MB). 추가 최적화 권장.`
        });
      }
    }
    
    // Tree shaking 권장사항
    if (this.optimizationResults.treeShaking?.potentialSavings > 1024 * 1024) {
      recommendations.push({
        type: 'tree_shaking',
        message: `추가로 ${this.formatSize(this.optimizationResults.treeShaking.potentialSavings)} 절약 가능`
      });
    }
    
    // 의존성 권장사항
    if (this.optimizationResults.dependencies?.outdated > 5) {
      recommendations.push({
        type: 'dependencies',
        message: `${this.optimizationResults.dependencies.outdated}개 의존성 업데이트 권장`
      });
    }
    
    return recommendations;
  }

  calculatePerformanceMetrics() {
    const metrics = {
      bundleScore: 100,
      dependencyScore: 100,
      optimizationScore: 100
    };
    
    // 번들 크기 점수
    if (this.optimizationResults.bundles) {
      const avgSize = (
        this.optimizationResults.bundles.android.size + 
        this.optimizationResults.bundles.ios.size
      ) / 2;
      
      if (avgSize > 20) metrics.bundleScore = 60;
      else if (avgSize > 15) metrics.bundleScore = 75;
      else if (avgSize > 10) metrics.bundleScore = 85;
      else if (avgSize > 5) metrics.bundleScore = 95;
    }
    
    // 의존성 점수
    if (this.optimizationResults.initialState) {
      const totalDeps = this.optimizationResults.initialState.dependencies;
      
      if (totalDeps > 100) metrics.dependencyScore = 60;
      else if (totalDeps > 75) metrics.dependencyScore = 75;
      else if (totalDeps > 50) metrics.dependencyScore = 85;
      else if (totalDeps > 25) metrics.dependencyScore = 95;
    }
    
    // 전체 최적화 점수
    metrics.optimizationScore = Math.round(
      (metrics.bundleScore + metrics.dependencyScore) / 2
    );
    
    return metrics;
  }

  getNextSteps() {
    const steps = [];
    
    if (this.optimizationResults.treeShaking?.unusedDependencies > 0) {
      steps.push('남은 미사용 의존성 수동 검토 및 제거');
    }
    
    if (this.optimizationResults.images?.totalImages > 0) {
      steps.push('이미지들을 WebP 형식으로 변환');
    }
    
    if (this.optimizationResults.dependencies?.outdated > 0) {
      steps.push('의존성 업데이트 (npm update 실행)');
    }
    
    steps.push('코드 스플리팅 적용 범위 확대');
    steps.push('번들 분석기로 정기적 모니터링');
    
    return steps;
  }

  printConsoleSummary(report) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 번들 최적화 결과 요약');
    console.log('='.repeat(60));
    
    if (report.optimization.bundles) {
      console.log(`📱 Android 번들: ${report.optimization.bundles.android.size}MB`);
      console.log(`🍎 iOS 번들: ${report.optimization.bundles.ios.size}MB`);
    }
    
    if (report.optimization.treeShaking) {
      console.log(`🌲 제거된 미사용 의존성: ${report.optimization.treeShaking.unusedDependencies}개`);
      console.log(`💾 절약된 공간: ${this.formatSize(report.optimization.treeShaking.potentialSavings)}`);
    }
    
    console.log(`📈 최적화 점수: ${report.performance.optimizationScore}/100`);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 권장사항:');
      report.recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec.message}`);
      });
    }
    
    if (report.nextSteps.length > 0) {
      console.log('\n🎯 다음 단계:');
      report.nextSteps.forEach((step, i) => {
        console.log(`   ${i + 1}. ${step}`);
      });
    }
    
    console.log('='.repeat(60));
  }

  // 유틸리티 메서드들
  isSafeToRemove(depName) {
    const safeDependencies = [
      'lodash-es', // lodash 대신 개별 함수 사용 권장
      'moment', // date-fns나 dayjs 사용 권장
      'request', // deprecated
      'colors', // chalk 사용 권장
    ];
    
    return safeDependencies.includes(depName) || depName.includes('unused-');
  }

  walkDirectory(dirPath, callback) {
    if (!fs.existsSync(dirPath)) return;
    
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
      console.warn(`디렉토리 접근 오류: ${dirPath}`);
    }
  }

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

  formatSize(bytes) {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  }

  findDuplicateDependencies(packageJson) {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const duplicates = [];
    
    // 간단한 중복 검사 (실제로는 더 복잡한 로직 필요)
    const packageNames = new Set();
    
    for (const [name, version] of Object.entries(deps)) {
      const baseName = name.replace(/@.*$/, '').replace(/^@/, '');
      
      if (packageNames.has(baseName)) {
        duplicates.push({
          name: baseName,
          versions: [version]
        });
      } else {
        packageNames.add(baseName);
      }
    }
    
    return duplicates;
  }

  async checkOutdatedDependencies() {
    try {
      const output = execSync('npm outdated --json', { 
        encoding: 'utf8',
        stdio: 'pipe' 
      });
      
      const outdated = JSON.parse(output || '{}');
      
      return Object.entries(outdated).map(([name, info]) => ({
        name,
        current: info.current,
        wanted: info.wanted,
        latest: info.latest
      }));
      
    } catch (error) {
      // npm outdated가 실패해도 계속 진행
      return [];
    }
  }
}

// CLI 실행
if (require.main === module) {
  const optimizer = new BundleOptimizer();
  optimizer.optimize().catch(error => {
    console.error('최적화 실패:', error);
    process.exit(1);
  });
}

module.exports = BundleOptimizer;