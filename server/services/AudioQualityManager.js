const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * AI 기반 음성 품질 분석 시스템
 * 기존 음성 파일들의 품질을 분석하고 리포트를 생성 (자동 교체 없음)
 */
class AudioQualityManager {
  constructor() {
    this.qualityThresholds = {
      MINIMUM_DURATION: 0.5, // 최소 0.5초
      MAXIMUM_DURATION: 10.0, // 최대 10초
      MINIMUM_CLARITY_SCORE: 0.7, // 명료도 점수 (0-1)
      MAXIMUM_BACKGROUND_NOISE: 0.3, // 배경소음 허용 수준
      PRONUNCIATION_ACCURACY: 0.8 // 발음 정확도 (0-1)
    };

    // 품질 등급 분류
    this.qualityGrades = {
      EXCELLENT: { min: 0.9, label: '최고', color: '#28a745' },
      GOOD: { min: 0.75, label: '양호', color: '#17a2b8' },
      ACCEPTABLE: { min: 0.6, label: '보통', color: '#ffc107' },
      POOR: { min: 0.4, label: '나쁨', color: '#fd7e14' },
      CRITICAL: { min: 0.0, label: '심각', color: '#dc3545' }
    };
  }

  /**
   * 음성 파일의 품질을 AI로 분석
   */
  async analyzeAudioQuality(audioBuffer, vocabText, languageCode) {
    try {
      const analysis = {
        id: `analysis_${Date.now()}`,
        vocabText,
        languageCode,
        timestamp: new Date(),
        metrics: {},
        issues: [],
        overallScore: 0,
        recommendation: ''
      };

      // 1. 기본 음성 속성 분석
      const basicMetrics = await this.analyzeBasicProperties(audioBuffer);
      analysis.metrics.basic = basicMetrics;

      // 2. 음성 명료도 분석
      const clarityScore = await this.analyzeSpeechClarity(audioBuffer);
      analysis.metrics.clarity = clarityScore;

      // 3. 발음 정확도 분석
      const pronunciationScore = await this.analyzePronunciation(audioBuffer, vocabText, languageCode);
      analysis.metrics.pronunciation = pronunciationScore;

      // 4. 배경소음 분석
      const noiseLevel = await this.analyzeBackgroundNoise(audioBuffer);
      analysis.metrics.noise = noiseLevel;

      // 5. 종합 점수 계산
      analysis.overallScore = this.calculateOverallScore(analysis.metrics);

      // 6. 문제점 식별
      analysis.issues = this.identifyIssues(analysis.metrics);

      // 7. 개선 권장사항
      analysis.recommendation = this.generateRecommendation(analysis);

      return analysis;

    } catch (error) {
      console.error('Audio quality analysis failed:', error);
      return {
        id: `error_${Date.now()}`,
        error: error.message,
        overallScore: 0,
        issues: ['ANALYSIS_FAILED'],
        recommendation: 'REGENERATE_REQUIRED'
      };
    }
  }

  /**
   * 기본 음성 속성 분석 (길이, 볼륨, 주파수 등)
   */
  async analyzeBasicProperties(audioBuffer) {
    // 실제 구현에서는 Web Audio API 또는 외부 라이브러리 사용
    return {
      duration: this.estimateDuration(audioBuffer),
      averageVolume: this.calculateAverageVolume(audioBuffer),
      peakVolume: this.calculatePeakVolume(audioBuffer),
      frequencyRange: this.analyzeFrequencyRange(audioBuffer),
      silenceRatio: this.calculateSilenceRatio(audioBuffer)
    };
  }

  /**
   * 음성 명료도 분석
   */
  async analyzeSpeechClarity(audioBuffer) {
    // AI 모델을 사용한 명료도 분석
    // 실제로는 Google Speech-to-Text, Azure Cognitive Services 등 활용
    const mockClarity = Math.random() * 0.3 + 0.7; // 0.7-1.0 범위
    
    return {
      score: mockClarity,
      confidence: 0.85,
      details: {
        articulation: mockClarity + 0.05,
        rhythm: mockClarity - 0.02,
        intonation: mockClarity + 0.01
      }
    };
  }

  /**
   * 발음 정확도 분석
   */
  async analyzePronunciation(audioBuffer, expectedText, languageCode) {
    // 음성 인식을 통한 발음 정확도 측정
    const mockAccuracy = Math.random() * 0.2 + 0.8; // 0.8-1.0 범위

    return {
      accuracy: mockAccuracy,
      confidence: 0.90,
      transcribed: expectedText, // 실제로는 STT 결과
      phonemeAccuracy: this.mockPhonemeAnalysis(expectedText, languageCode),
      commonMistakes: this.identifyCommonMistakes(languageCode)
    };
  }

  /**
   * 배경소음 분석
   */
  async analyzeBackgroundNoise(audioBuffer) {
    return {
      level: Math.random() * 0.4, // 0-0.4 범위
      type: this.detectNoiseType(audioBuffer),
      frequency: this.analyzeNoiseFrequency(audioBuffer),
      consistency: Math.random() * 0.3 + 0.7 // 일관성
    };
  }

  /**
   * 종합 품질 점수 계산
   */
  calculateOverallScore(metrics) {
    const weights = {
      duration: 0.15,
      clarity: 0.35,
      pronunciation: 0.35,
      noise: 0.15
    };

    let score = 0;
    
    // 길이 점수
    const durationScore = this.scoreDuration(metrics.basic.duration);
    score += durationScore * weights.duration;

    // 명료도 점수
    score += metrics.clarity.score * weights.clarity;

    // 발음 정확도 점수
    score += metrics.pronunciation.accuracy * weights.pronunciation;

    // 소음 점수 (낮을수록 좋음)
    const noiseScore = Math.max(0, 1 - metrics.noise.level);
    score += noiseScore * weights.noise;

    return Math.round(score * 100) / 100; // 소수점 둘째 자리까지
  }

  /**
   * 문제점 식별
   */
  identifyIssues(metrics) {
    const issues = [];

    // 길이 문제
    if (metrics.basic.duration < this.qualityThresholds.MINIMUM_DURATION) {
      issues.push('TOO_SHORT');
    }
    if (metrics.basic.duration > this.qualityThresholds.MAXIMUM_DURATION) {
      issues.push('TOO_LONG');
    }

    // 명료도 문제
    if (metrics.clarity.score < this.qualityThresholds.MINIMUM_CLARITY_SCORE) {
      issues.push('LOW_CLARITY');
    }

    // 발음 문제
    if (metrics.pronunciation.accuracy < this.qualityThresholds.PRONUNCIATION_ACCURACY) {
      issues.push('POOR_PRONUNCIATION');
    }

    // 소음 문제
    if (metrics.noise.level > this.qualityThresholds.MAXIMUM_BACKGROUND_NOISE) {
      issues.push('HIGH_BACKGROUND_NOISE');
    }

    // 볼륨 문제
    if (metrics.basic.averageVolume < 0.2) {
      issues.push('TOO_QUIET');
    }
    if (metrics.basic.averageVolume > 0.9) {
      issues.push('TOO_LOUD');
    }

    // 침묵 비율 문제
    if (metrics.basic.silenceRatio > 0.4) {
      issues.push('TOO_MUCH_SILENCE');
    }

    return issues;
  }

  /**
   * 개선 권장사항 생성
   */
  generateRecommendation(analysis) {
    if (analysis.overallScore >= 0.9) {
      return 'EXCELLENT_QUALITY';
    }
    
    if (analysis.overallScore >= 0.8) {
      return 'GOOD_QUALITY';
    }

    if (analysis.issues.includes('LOW_CLARITY') || analysis.issues.includes('POOR_PRONUNCIATION')) {
      return 'REGENERATE_WITH_BETTER_TTS';
    }

    if (analysis.issues.includes('HIGH_BACKGROUND_NOISE')) {
      return 'APPLY_NOISE_REDUCTION';
    }

    if (analysis.issues.includes('TOO_QUIET') || analysis.issues.includes('TOO_LOUD')) {
      return 'NORMALIZE_VOLUME';
    }

    return 'REGENERATE_REQUIRED';
  }

  /**
   * 품질 분석 리포트 생성
   */
  async generateQualityReport(vocabId, analysis) {
    try {
      const vocab = await prisma.vocab.findUnique({
        where: { id: vocabId },
        include: { 
          language: true,
          dictentry: true 
        }
      });

      if (!vocab) {
        throw new Error(`Vocab ${vocabId} not found`);
      }

      // 품질 등급 결정
      const grade = this.determineQualityGrade(analysis.overallScore);

      // 리포트 데이터 구성
      const report = {
        vocabId: vocab.id,
        lemma: vocab.lemma,
        language: vocab.language?.name || 'Unknown',
        audioUrl: vocab.dictentry?.audioUrl,
        analysisTimestamp: new Date(),
        qualityScore: analysis.overallScore,
        grade: grade,
        issues: analysis.issues,
        metrics: {
          duration: analysis.metrics.basic?.duration,
          clarity: analysis.metrics.clarity?.score,
          pronunciation: analysis.metrics.pronunciation?.accuracy,
          noiseLevel: analysis.metrics.noise?.level,
          averageVolume: analysis.metrics.basic?.averageVolume
        },
        recommendation: analysis.recommendation,
        priority: this.calculatePriority(analysis.issues, analysis.overallScore),
        needsAttention: analysis.overallScore < 0.6 || analysis.issues.length > 2
      };

      // 리포트를 데이터베이스에 저장 (로깅 목적)
      await this.saveQualityReport(report);

      return report;

    } catch (error) {
      console.error(`Failed to generate quality report for vocab ${vocabId}:`, error);
      return {
        error: error.message,
        vocabId,
        analysisTimestamp: new Date(),
        qualityScore: 0,
        needsAttention: true
      };
    }
  }

  /**
   * 품질 등급 결정
   */
  determineQualityGrade(score) {
    for (const [grade, config] of Object.entries(this.qualityGrades)) {
      if (score >= config.min) {
        return {
          grade,
          label: config.label,
          color: config.color,
          score: score
        };
      }
    }
    return {
      grade: 'CRITICAL',
      label: '심각',
      color: '#dc3545',
      score: score
    };
  }

  /**
   * 우선순위 계산 (1-10, 10이 가장 높음)
   */
  calculatePriority(issues, score) {
    let priority = 1;

    // 점수 기반 우선순위
    if (score < 0.3) priority += 5;        // 심각
    else if (score < 0.5) priority += 4;   // 높음
    else if (score < 0.7) priority += 2;   // 보통
    else if (score < 0.9) priority += 1;   // 낮음

    // 이슈 유형별 가중치
    const criticalIssues = ['POOR_PRONUNCIATION', 'LOW_CLARITY'];
    const highIssues = ['HIGH_BACKGROUND_NOISE', 'TOO_QUIET', 'TOO_LOUD'];
    
    if (issues.some(issue => criticalIssues.includes(issue))) priority += 3;
    if (issues.some(issue => highIssues.includes(issue))) priority += 2;
    if (issues.length > 3) priority += 1; // 다중 문제

    return Math.min(10, priority);
  }

  /**
   * 사용자 신고 기반 품질 분석
   */
  async handleUserReport(report) {
    try {
      const { vocabId, reportType, severity, frequency } = report;

      // 음성 관련 신고 시 품질 분석 수행
      if (reportType === 'AUDIO_QUALITY') {
        const vocab = await prisma.vocab.findUnique({
          where: { id: vocabId },
          include: { 
            dictentry: true,
            language: true
          }
        });

        if (vocab?.dictentry?.audioUrl) {
          // 현재 음성 다운로드 및 분석
          const audioBuffer = await this.downloadAudio(vocab.dictentry.audioUrl);
          const analysis = await this.analyzeAudioQuality(
            audioBuffer, 
            vocab.lemma, 
            vocab.language?.code || 'en'
          );

          // 품질 리포트 생성
          const qualityReport = await this.generateQualityReport(vocabId, analysis);

          // 사용자 신고 정보와 연결
          qualityReport.userReportInfo = {
            reportFrequency: frequency,
            reportSeverity: severity,
            reportedIssues: [reportType],
            reportTimestamp: new Date()
          };

          // 관리자에게 알림용 리포트 큐에 추가
          await this.addToAdminReviewQueue(qualityReport);

          return { 
            success: true, 
            analysisPerformed: true,
            qualityReport 
          };
        }
      }

      return { success: true, analysisPerformed: false };

    } catch (error) {
      console.error('Handle user report failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 배치 품질 분석 및 리포트 생성
   */
  async runBatchQualityAnalysis(limit = 100) {
    try {
      const vocabs = await prisma.vocab.findMany({
        include: { dictentry: true, language: true },
        where: {
          dictentry: {
            audioUrl: { not: null }
          }
        },
        take: limit,
        orderBy: { id: 'asc' }
      });

      const analysisResults = [];
      const summaryStats = {
        total: 0,
        excellent: 0,
        good: 0,
        acceptable: 0,
        poor: 0,
        critical: 0,
        needsAttention: 0
      };

      for (const vocab of vocabs) {
        try {
          const audioBuffer = await this.downloadAudio(vocab.dictentry.audioUrl);
          const analysis = await this.analyzeAudioQuality(
            audioBuffer,
            vocab.lemma,
            vocab.language.code
          );

          // 품질 리포트 생성
          const qualityReport = await this.generateQualityReport(vocab.id, analysis);
          analysisResults.push(qualityReport);

          // 통계 업데이트
          summaryStats.total++;
          const grade = qualityReport.grade.grade.toLowerCase();
          if (summaryStats[grade] !== undefined) {
            summaryStats[grade]++;
          }
          if (qualityReport.needsAttention) {
            summaryStats.needsAttention++;
          }

        } catch (error) {
          console.error(`Quality analysis failed for vocab ${vocab.id}:`, error);
          // 실패한 경우도 기록
          analysisResults.push({
            vocabId: vocab.id,
            lemma: vocab.lemma,
            error: error.message,
            needsAttention: true,
            analysisTimestamp: new Date()
          });
          summaryStats.total++;
          summaryStats.needsAttention++;
        }
      }

      // 전체 분석 리포트 생성
      const finalReport = {
        analysisTimestamp: new Date(),
        totalAnalyzed: summaryStats.total,
        summary: {
          averageScore: this.calculateAverageScore(analysisResults),
          distribution: {
            excellent: { count: summaryStats.excellent, percentage: Math.round((summaryStats.excellent / summaryStats.total) * 100) },
            good: { count: summaryStats.good, percentage: Math.round((summaryStats.good / summaryStats.total) * 100) },
            acceptable: { count: summaryStats.acceptable, percentage: Math.round((summaryStats.acceptable / summaryStats.total) * 100) },
            poor: { count: summaryStats.poor, percentage: Math.round((summaryStats.poor / summaryStats.total) * 100) },
            critical: { count: summaryStats.critical, percentage: Math.round((summaryStats.critical / summaryStats.total) * 100) }
          },
          needsAttention: summaryStats.needsAttention,
          recommendedActions: this.generateRecommendedActions(analysisResults)
        },
        detailedResults: analysisResults.sort((a, b) => (b.priority || 0) - (a.priority || 0)) // 우선순위순 정렬
      };

      // 최종 리포트 저장
      await this.saveBatchAnalysisReport(finalReport);

      return finalReport;

    } catch (error) {
      console.error('Batch quality analysis failed:', error);
      throw error;
    }
  }

  // 헬퍼 메서드들
  estimateDuration(buffer) {
    return Math.random() * 4 + 1; // 1-5초 범위
  }

  calculateAverageVolume(buffer) {
    return Math.random() * 0.6 + 0.2; // 0.2-0.8 범위
  }

  calculatePeakVolume(buffer) {
    return Math.random() * 0.3 + 0.7; // 0.7-1.0 범위
  }

  analyzeFrequencyRange(buffer) {
    return { min: 80, max: 8000 }; // Hz
  }

  calculateSilenceRatio(buffer) {
    return Math.random() * 0.3; // 0-0.3 범위
  }

  scoreDuration(duration) {
    if (duration < this.qualityThresholds.MINIMUM_DURATION) return 0.3;
    if (duration > this.qualityThresholds.MAXIMUM_DURATION) return 0.5;
    return 1.0;
  }

  mockPhonemeAnalysis(text, languageCode) {
    return { accuracy: Math.random() * 0.2 + 0.8 };
  }

  identifyCommonMistakes(languageCode) {
    const mistakes = {
      'en': ['th-sounds', 'r-l-confusion'],
      'ja': ['long-vowels', 'pitch-accent'],
      'de': ['umlauts', 'consonant-clusters']
    };
    return mistakes[languageCode] || [];
  }

  detectNoiseType(buffer) {
    const types = ['white_noise', 'hum', 'clicks', 'echo', 'none'];
    return types[Math.floor(Math.random() * types.length)];
  }

  analyzeNoiseFrequency(buffer) {
    return { peak: Math.random() * 1000 + 50 }; // 50-1050 Hz
  }

  async downloadAudio(url) {
    // 실제로는 fetch로 음성 파일 다운로드
    return Buffer.alloc(1024); // 모크 버퍼
  }

  /**
   * 평균 점수 계산
   */
  calculateAverageScore(results) {
    const validResults = results.filter(r => r.qualityScore !== undefined && !r.error);
    if (validResults.length === 0) return 0;
    
    const totalScore = validResults.reduce((sum, r) => sum + r.qualityScore, 0);
    return Math.round((totalScore / validResults.length) * 100) / 100;
  }

  /**
   * 권장 조치사항 생성
   */
  generateRecommendedActions(results) {
    const criticalIssues = results.filter(r => r.grade?.grade === 'CRITICAL').length;
    const poorQuality = results.filter(r => ['POOR', 'CRITICAL'].includes(r.grade?.grade)).length;
    const commonIssues = this.identifyCommonIssues(results);
    
    const actions = [];
    
    if (criticalIssues > 0) {
      actions.push(`🚨 ${criticalIssues}개의 심각한 품질 문제가 발견되었습니다. 즉시 확인이 필요합니다.`);
    }
    
    if (poorQuality > results.length * 0.2) {
      actions.push(`⚠️ 전체의 ${Math.round((poorQuality / results.length) * 100)}%가 낮은 품질입니다. 전반적인 음성 품질 검토가 필요합니다.`);
    }
    
    if (commonIssues.length > 0) {
      actions.push(`🔍 공통 문제점: ${commonIssues.join(', ')}`);
    }
    
    if (actions.length === 0) {
      actions.push('✅ 전반적으로 양호한 음성 품질을 유지하고 있습니다.');
    }
    
    return actions;
  }

  /**
   * 공통 이슈 식별
   */
  identifyCommonIssues(results) {
    const issueCount = {};
    
    results.forEach(result => {
      if (result.issues) {
        result.issues.forEach(issue => {
          issueCount[issue] = (issueCount[issue] || 0) + 1;
        });
      }
    });
    
    const threshold = Math.max(2, results.length * 0.1); // 최소 2개 또는 10% 이상
    return Object.entries(issueCount)
      .filter(([_, count]) => count >= threshold)
      .sort((a, b) => b[1] - a[1])
      .map(([issue, _]) => issue)
      .slice(0, 5); // 상위 5개
  }

  /**
   * 품질 리포트 저장
   */
  async saveQualityReport(report) {
    try {
      // 간단한 로그 저장 (실제로는 별도 테이블 사용 가능)
      console.log(`[AUDIO QUALITY REPORT] ${report.lemma}: ${report.qualityScore} (${report.grade.label})`);
      // 필요시 파일 시스템이나 별도 DB 테이블에 저장
    } catch (error) {
      console.error('Failed to save quality report:', error);
    }
  }

  /**
   * 관리자 검토 큐에 추가
   */
  async addToAdminReviewQueue(qualityReport) {
    try {
      // 우선순위가 높은 경우 관리자 알림 큐에 추가
      if (qualityReport.priority >= 7 || qualityReport.grade.grade === 'CRITICAL') {
        console.log(`[ADMIN ALERT] High priority audio quality issue: ${qualityReport.lemma} (Priority: ${qualityReport.priority})`);
        // 실제로는 알림 시스템, 이메일, 슬랙 등으로 전송
      }
    } catch (error) {
      console.error('Failed to add to admin review queue:', error);
    }
  }

  /**
   * 배치 분석 리포트 저장
   */
  async saveBatchAnalysisReport(report) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `audio-quality-report-${timestamp}.json`;
      
      console.log(`[BATCH ANALYSIS COMPLETE] ${report.totalAnalyzed} files analyzed`);
      console.log(`[QUALITY DISTRIBUTION] Excellent: ${report.summary.distribution.excellent.count}, Good: ${report.summary.distribution.good.count}, Needs Attention: ${report.summary.needsAttention}`);
      
      // 실제로는 파일 저장이나 데이터베이스에 리포트 저장
      // fs.writeFileSync(`./reports/${filename}`, JSON.stringify(report, null, 2));
      
    } catch (error) {
      console.error('Failed to save batch analysis report:', error);
    }
  }
}

  /**
   * 관리자용 리포트 조회
   */
  async getAdminQualityDashboard() {
    try {
      // 최근 분석 결과 요약 제공
      const totalAudioFiles = await prisma.dictentry.count({
        where: { audioUrl: { not: null } }
      });
      
      return {
        totalAudioFiles,
        lastAnalysis: new Date(), // 실제로는 마지막 분석 시간 조회
        quickStats: {
          needsReview: 0, // 실제 구현에서는 DB에서 조회
          criticalIssues: 0,
          averageQuality: 0.75
        },
        availableActions: [
          'runBatchQualityAnalysis', 
          'getDetailedReport',
          'exportQualityReport'
        ]
      };
    } catch (error) {
      console.error('Failed to get admin quality dashboard:', error);
      throw error;
    }
  }
}

module.exports = AudioQualityManager;