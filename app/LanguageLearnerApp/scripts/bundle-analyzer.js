// bundle-analyzer.js - 번들 크기 분석 스크립트
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

// 번들 크기 분석 클래스
class BundleAnalyzer {
  constructor() {
    this.projectRoot = process.cwd();
    this.bundleDir = path.join(this.projectRoot, 'bundle-analysis');
    this.setupDirectories();
  }

  setupDirectories() {
    if (!fs.existsSync(this.bundleDir)) {
      fs.mkdirSync(this.bundleDir, { recursive: true });
    }
  }

  // Android 번들 생성 및 분석
  async analyzeAndroidBundle() {
    console.log('📦 Android 번들 분석 중...');
    
    try {
      // Android 릴리스 번들 생성
      const bundlePath = path.join(this.bundleDir, 'android-release.bundle');
      const mapPath = path.join(this.bundleDir, 'android-release.bundle.map');
      
      execSync(`npx react-native bundle \\
        --platform android \\
        --dev false \\
        --entry-file index.js \\
        --bundle-output ${bundlePath} \\
        --sourcemap-output ${mapPath} \\
        --assets-dest ${this.bundleDir}/android-assets`, 
        { stdio: 'inherit' }
      );

      // 번들 크기 측정
      const stats = fs.statSync(bundlePath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      
      console.log(`✅ Android 번들 크기: ${sizeInMB}MB`);
      
      // 상세 분석
      await this.generateBundleReport(bundlePath, 'android');
      
      return {
        platform: 'android',
        size: sizeInMB,
        path: bundlePath
      };
    } catch (error) {
      console.error('❌ Android 번들 분석 실패:', error.message);
      throw error;
    }
  }

  // iOS 번들 생성 및 분석  
  async analyzeIosBundle() {
    console.log('📦 iOS 번들 분석 중...');
    
    try {
      // iOS 릴리스 번들 생성
      const bundlePath = path.join(this.bundleDir, 'ios-release.bundle');
      const mapPath = path.join(this.bundleDir, 'ios-release.bundle.map');
      
      execSync(`npx react-native bundle \\
        --platform ios \\
        --dev false \\
        --entry-file index.js \\
        --bundle-output ${bundlePath} \\
        --sourcemap-output ${mapPath} \\
        --assets-dest ${this.bundleDir}/ios-assets`, 
        { stdio: 'inherit' }
      );

      // 번들 크기 측정
      const stats = fs.statSync(bundlePath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      
      console.log(`✅ iOS 번들 크기: ${sizeInMB}MB`);
      
      // 상세 분석
      await this.generateBundleReport(bundlePath, 'ios');
      
      return {
        platform: 'ios',
        size: sizeInMB,
        path: bundlePath
      };
    } catch (error) {
      console.error('❌ iOS 번들 분석 실패:', error.message);
      throw error;
    }
  }

  // 번들 상세 리포트 생성
  async generateBundleReport(bundlePath, platform) {
    console.log(`📊 ${platform} 번들 상세 분석 생성 중...`);
    
    try {
      // Metro visualizer 실행
      const reportPath = path.join(this.bundleDir, `${platform}-bundle-report.html`);
      
      // 번들 내용 분석을 위한 메타데이터 생성
      const bundleContent = fs.readFileSync(bundlePath, 'utf8');
      const modules = this.extractModules(bundleContent);
      
      // HTML 리포트 생성
      const reportHtml = this.generateHtmlReport(modules, platform);
      fs.writeFileSync(reportPath, reportHtml);
      
      console.log(`📋 리포트 생성 완료: ${reportPath}`);
      
      // 큰 모듈들 식별
      const largeModules = modules
        .filter(m => m.size > 50000) // 50KB 이상
        .sort((a, b) => b.size - a.size)
        .slice(0, 10);
      
      if (largeModules.length > 0) {
        console.log('🔍 큰 모듈들:');
        largeModules.forEach(module => {
          const sizeKB = (module.size / 1024).toFixed(1);
          console.log(`  - ${module.name}: ${sizeKB}KB`);
        });
      }
      
    } catch (error) {
      console.error('❌ 번들 리포트 생성 실패:', error.message);
    }
  }

  // 번들에서 모듈 정보 추출
  extractModules(bundleContent) {
    const modules = [];
    
    // 간단한 모듈 파싱 (실제로는 더 복잡한 파싱이 필요)
    const moduleRegex = /__d\(function\([\s\S]*?\),(\d+),\[([^\]]*)\],"([^"]+)"/g;
    let match;
    
    while ((match = moduleRegex.exec(bundleContent)) !== null) {
      const moduleCode = match[0];
      const moduleId = match[1];
      const dependencies = match[2];
      const moduleName = match[3];
      
      modules.push({
        id: moduleId,
        name: moduleName,
        size: moduleCode.length,
        dependencies: dependencies.split(',').filter(dep => dep.trim())
      });
    }
    
    return modules.sort((a, b) => b.size - a.size);
  }

  // HTML 리포트 생성
  generateHtmlReport(modules, platform) {
    const totalSize = modules.reduce((sum, m) => sum + m.size, 0);
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>${platform.toUpperCase()} Bundle Analysis</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #4A90E2; color: white; padding: 20px; border-radius: 8px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin: 20px 0; }
        .stat-card { background: #f5f5f5; padding: 16px; border-radius: 8px; text-align: center; }
        .modules-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .modules-table th, .modules-table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        .modules-table th { background: #4A90E2; color: white; }
        .size-bar { height: 20px; background: #e0e0e0; border-radius: 10px; overflow: hidden; }
        .size-fill { height: 100%; background: linear-gradient(90deg, #4CAF50, #FFC107, #FF5722); }
    </style>
</head>
<body>
    <div class="header">
        <h1>${platform.toUpperCase()} Bundle Analysis Report</h1>
        <p>Generated on ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="stats">
        <div class="stat-card">
            <h3>Total Bundle Size</h3>
            <p>${(totalSize / (1024 * 1024)).toFixed(2)} MB</p>
        </div>
        <div class="stat-card">
            <h3>Total Modules</h3>
            <p>${modules.length}</p>
        </div>
        <div class="stat-card">
            <h3>Largest Module</h3>
            <p>${modules[0] ? (modules[0].size / 1024).toFixed(1) + 'KB' : 'N/A'}</p>
        </div>
        <div class="stat-card">
            <h3>Average Module Size</h3>
            <p>${modules.length ? (totalSize / modules.length / 1024).toFixed(1) + 'KB' : 'N/A'}</p>
        </div>
    </div>
    
    <h2>Top Modules by Size</h2>
    <table class="modules-table">
        <thead>
            <tr>
                <th>Module Name</th>
                <th>Size (KB)</th>
                <th>Size Visualization</th>
                <th>Dependencies</th>
            </tr>
        </thead>
        <tbody>
            ${modules.slice(0, 20).map(module => {
              const sizeKB = (module.size / 1024).toFixed(1);
              const percentage = (module.size / totalSize * 100).toFixed(1);
              
              return `
                <tr>
                    <td>${module.name}</td>
                    <td>${sizeKB}</td>
                    <td>
                        <div class="size-bar">
                            <div class="size-fill" style="width: ${percentage}%"></div>
                        </div>
                        ${percentage}%
                    </td>
                    <td>${module.dependencies.length}</td>
                </tr>
              `;
            }).join('')}
        </tbody>
    </table>
</body>
</html>
    `;
  }

  // 의존성 분석
  async analyzeDependencies() {
    console.log('🔍 의존성 분석 중...');
    
    try {
      // package.json 읽기
      const packagePath = path.join(this.projectRoot, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };
      
      // 각 의존성의 크기 추정
      const dependencyAnalysis = [];
      
      for (const [name, version] of Object.entries(dependencies)) {
        try {
          const modulePath = path.join(this.projectRoot, 'node_modules', name);
          const modulePackagePath = path.join(modulePath, 'package.json');
          
          if (fs.existsSync(modulePackagePath)) {
            const modulePackage = JSON.parse(fs.readFileSync(modulePackagePath, 'utf8'));
            const moduleSize = this.getDirectorySize(modulePath);
            
            dependencyAnalysis.push({
              name,
              version: version,
              actualVersion: modulePackage.version,
              size: moduleSize,
              description: modulePackage.description || ''
            });
          }
        } catch (error) {
          console.warn(`⚠️ ${name} 분석 실패:`, error.message);
        }
      }
      
      // 크기 순으로 정렬
      dependencyAnalysis.sort((a, b) => b.size - a.size);
      
      // 큰 의존성들 출력
      console.log('📦 큰 의존성들 (상위 10개):');
      dependencyAnalysis.slice(0, 10).forEach((dep, index) => {
        const sizeMB = (dep.size / (1024 * 1024)).toFixed(2);
        console.log(`  ${index + 1}. ${dep.name}: ${sizeMB}MB`);
      });
      
      // 리포트 저장
      const reportPath = path.join(this.bundleDir, 'dependencies-analysis.json');
      fs.writeFileSync(reportPath, JSON.stringify(dependencyAnalysis, null, 2));
      
      return dependencyAnalysis;
      
    } catch (error) {
      console.error('❌ 의존성 분석 실패:', error.message);
      throw error;
    }
  }

  // 디렉토리 크기 계산
  getDirectorySize(dirPath) {
    let totalSize = 0;
    
    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        
        if (item.isDirectory()) {
          totalSize += this.getDirectorySize(itemPath);
        } else if (item.isFile()) {
          const stats = fs.statSync(itemPath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      // 접근 권한 없는 디렉토리 등은 무시
    }
    
    return totalSize;
  }

  // 전체 분석 실행
  async runFullAnalysis() {
    console.log('🚀 전체 번들 분석 시작...\n');
    
    try {
      // 의존성 분석
      const dependencies = await this.analyzeDependencies();
      
      // Android 번들 분석
      const androidResult = await this.analyzeAndroidBundle();
      
      // iOS 번들 분석  
      const iosResult = await this.analyzeIosBundle();
      
      // 종합 리포트
      const summary = {
        timestamp: new Date().toISOString(),
        bundles: [androidResult, iosResult],
        dependencies: dependencies.slice(0, 20),
        recommendations: this.generateRecommendations(dependencies, [androidResult, iosResult])
      };
      
      // 종합 리포트 저장
      const summaryPath = path.join(this.bundleDir, 'bundle-analysis-summary.json');
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
      
      console.log('\\n📊 분석 완료!');
      console.log(`📁 결과 저장: ${this.bundleDir}`);
      
      return summary;
      
    } catch (error) {
      console.error('❌ 번들 분석 실패:', error.message);
      throw error;
    }
  }

  // 최적화 권장사항 생성
  generateRecommendations(dependencies, bundles) {
    const recommendations = [];
    
    // 큰 의존성 식별
    const largeDependencies = dependencies.filter(dep => dep.size > 5 * 1024 * 1024); // 5MB 이상
    
    if (largeDependencies.length > 0) {
      recommendations.push({
        type: 'large_dependencies',
        title: '큰 의존성 최적화',
        description: '다음 의존성들이 번들 크기를 크게 증가시킵니다:',
        items: largeDependencies.map(dep => `${dep.name} (${(dep.size / 1024 / 1024).toFixed(2)}MB)`)
      });
    }
    
    // 번들 크기 경고
    const largeBundles = bundles.filter(bundle => parseFloat(bundle.size) > 10); // 10MB 이상
    
    if (largeBundles.length > 0) {
      recommendations.push({
        type: 'large_bundle',
        title: '번들 크기 최적화 필요',
        description: '번들 크기가 권장 크기를 초과합니다:',
        items: largeBundles.map(bundle => `${bundle.platform}: ${bundle.size}MB`)
      });
    }
    
    // 일반적인 최적화 권장사항
    recommendations.push({
      type: 'general_optimization',
      title: '일반적인 최적화 방법',
      description: '번들 크기를 줄이기 위한 권장사항:',
      items: [
        'Tree shaking 활성화',
        'Code splitting 적용',
        'Unused imports 제거',
        'ProGuard/R8 설정 최적화',
        '이미지 압축 및 WebP 사용',
        'Metro bundler 설정 최적화'
      ]
    });
    
    return recommendations;
  }
}

// CLI 실행
if (require.main === module) {
  const analyzer = new BundleAnalyzer();
  analyzer.runFullAnalysis().catch(console.error);
}

module.exports = BundleAnalyzer;