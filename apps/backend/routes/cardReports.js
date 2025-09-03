const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// 카드 신고하기
router.post('/report', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { vocabId, reportType, description, severity } = req.body;

    // 유효성 검사
    const validReportTypes = ['AUDIO_QUALITY', 'WRONG_TRANSLATION', 'INAPPROPRIATE', 'MISSING_INFO', 'TECHNICAL_ISSUE', 'OTHER'];
    const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

    if (!vocabId || !reportType) {
      return res.status(400).json({ 
        error: 'MISSING_REQUIRED_FIELDS',
        message: '단어 ID와 신고 유형은 필수입니다.' 
      });
    }

    if (!validReportTypes.includes(reportType)) {
      return res.status(400).json({ 
        error: 'INVALID_REPORT_TYPE',
        message: '유효하지 않은 신고 유형입니다.' 
      });
    }

    if (severity && !validSeverities.includes(severity)) {
      return res.status(400).json({ 
        error: 'INVALID_SEVERITY',
        message: '유효하지 않은 심각도입니다.' 
      });
    }

    // 단어 존재 확인
    const vocab = await prisma.vocab.findUnique({
      where: { id: vocabId }
    });

    if (!vocab) {
      return res.status(404).json({ 
        error: 'VOCAB_NOT_FOUND',
        message: '해당 단어를 찾을 수 없습니다.' 
      });
    }

    // 중복 신고 확인 (같은 사용자가 같은 카드를 24시간 내에 같은 유형으로 신고)
    const existingReport = await prisma.cardReport.findFirst({
      where: {
        userId,
        vocabId,
        reportType,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24시간 전
        }
      }
    });

    if (existingReport) {
      return res.status(409).json({ 
        error: 'DUPLICATE_REPORT',
        message: '이미 같은 내용으로 신고하신 카드입니다. 24시간 후에 다시 시도해주세요.' 
      });
    }

    // 기존 신고 업데이트 또는 새 신고 생성
    const existingReportAny = await prisma.cardReport.findFirst({
      where: {
        vocabId,
        reportType,
        status: { in: ['PENDING', 'INVESTIGATING'] }
      }
    });

    let report;
    if (existingReportAny) {
      // 기존 신고의 빈도 증가
      report = await prisma.cardReport.update({
        where: { id: existingReportAny.id },
        data: {
          frequency: { increment: 1 },
          updatedAt: new Date(),
          // 더 높은 심각도로 업데이트
          severity: severity && ['HIGH', 'CRITICAL'].includes(severity) ? severity : existingReportAny.severity,
          // 새로운 설명 추가
          metadata: {
            ...existingReportAny.metadata,
            additionalReports: [
              ...(existingReportAny.metadata?.additionalReports || []),
              {
                userId,
                description,
                reportedAt: new Date().toISOString()
              }
            ]
          }
        }
      });
    } else {
      // 새 신고 생성
      report = await prisma.cardReport.create({
        data: {
          userId,
          vocabId,
          reportType,
          description: description || '',
          severity: severity || 'MEDIUM',
          frequency: 1,
          metadata: {
            userAgent: req.headers['user-agent'],
            ip: req.ip,
            firstReportedBy: userId
          }
        }
      });
    }

    // 신고 통계 업데이트 (관리자 대시보드용)
    await updateReportStatistics(reportType, severity);

    res.json({ 
      success: true,
      message: '신고가 성공적으로 접수되었습니다.',
      reportId: report.id,
      isNewReport: !existingReportAny
    });

  } catch (error) {
    console.error('Card report error:', error);
    res.status(500).json({ 
      error: 'INTERNAL_SERVER_ERROR',
      message: '신고 처리 중 오류가 발생했습니다.' 
    });
  }
});

// 사용자의 신고 내역 조회
router.get('/my-reports', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;

    const where = { userId };
    if (status) where.status = status;

    const reports = await prisma.cardReport.findMany({
      where,
      include: {
        vocab: {
          select: { lemma: true, pos: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: parseInt(skip),
      take: parseInt(limit)
    });

    const total = await prisma.cardReport.count({ where });

    res.json({
      reports: reports.map(report => ({
        id: report.id,
        vocab: report.vocab,
        reportType: report.reportType,
        severity: report.severity,
        status: report.status,
        description: report.description,
        frequency: report.frequency,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        resolvedAt: report.resolvedAt
      })),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get my reports error:', error);
    res.status(500).json({ 
      error: 'INTERNAL_SERVER_ERROR',
      message: '신고 내역 조회 중 오류가 발생했습니다.' 
    });
  }
});

// 관리자용: 모든 신고 조회
router.get('/admin/all', requireAdmin, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      status, 
      reportType, 
      severity,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const skip = (page - 1) * limit;
    const where = {};

    if (status) where.status = status;
    if (reportType) where.reportType = reportType;
    if (severity) where.severity = severity;

    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    const reports = await prisma.cardReport.findMany({
      where,
      include: {
        vocab: {
          select: { id: true, lemma: true, pos: true, source: true }
        },
        user: {
          select: { id: true, email: true }
        }
      },
      orderBy,
      skip: parseInt(skip),
      take: parseInt(limit)
    });

    const total = await prisma.cardReport.count({ where });

    // 신고 통계
    const stats = await getReportStatistics();

    res.json({
      reports,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      },
      statistics: stats
    });

  } catch (error) {
    console.error('Get all reports error:', error);
    res.status(500).json({ 
      error: 'INTERNAL_SERVER_ERROR',
      message: '신고 목록 조회 중 오류가 발생했습니다.' 
    });
  }
});

// 관리자용: 신고 상태 업데이트
router.patch('/admin/:reportId/status', requireAdmin, async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, resolution } = req.body;
    const adminId = req.user.id;

    const validStatuses = ['PENDING', 'INVESTIGATING', 'RESOLVED', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'INVALID_STATUS',
        message: '유효하지 않은 상태입니다.' 
      });
    }

    const updateData = {
      status,
      updatedAt: new Date()
    };

    if (status === 'RESOLVED' || status === 'REJECTED') {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = adminId;
      if (resolution) updateData.resolution = resolution;
    }

    const report = await prisma.cardReport.update({
      where: { id: parseInt(reportId) },
      data: updateData,
      include: {
        vocab: { select: { lemma: true } },
        user: { select: { email: true } }
      }
    });

    // 자동 수정 작업 트리거 (해당하는 경우)
    if (status === 'RESOLVED' && report.reportType === 'AUDIO_QUALITY') {
      await triggerAudioQualityFix(report.vocabId);
    }

    res.json({ 
      success: true,
      message: '신고 상태가 업데이트되었습니다.',
      report 
    });

  } catch (error) {
    console.error('Update report status error:', error);
    res.status(500).json({ 
      error: 'INTERNAL_SERVER_ERROR',
      message: '신고 상태 업데이트 중 오류가 발생했습니다.' 
    });
  }
});

// 신고 통계 업데이트
async function updateReportStatistics(reportType, severity) {
  // 간단한 통계 로깅 (실제로는 별도 통계 테이블 사용 가능)
  console.log(`[REPORT STATS] Type: ${reportType}, Severity: ${severity}, Time: ${new Date().toISOString()}`);
}

// 신고 통계 조회
async function getReportStatistics() {
  const now = new Date();
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalReports,
    pendingReports,
    resolvedReports,
    last7DaysReports,
    last30DaysReports,
    reportsByType,
    reportsBySeverity,
    topReportedCards
  ] = await Promise.all([
    prisma.cardReport.count(),
    prisma.cardReport.count({ where: { status: 'PENDING' } }),
    prisma.cardReport.count({ where: { status: 'RESOLVED' } }),
    prisma.cardReport.count({ where: { createdAt: { gte: last7Days } } }),
    prisma.cardReport.count({ where: { createdAt: { gte: last30Days } } }),
    prisma.cardReport.groupBy({
      by: ['reportType'],
      _count: true
    }),
    prisma.cardReport.groupBy({
      by: ['severity'],
      _count: true
    }),
    prisma.cardReport.findMany({
      where: { status: { in: ['PENDING', 'INVESTIGATING'] } },
      include: { vocab: { select: { lemma: true } } },
      orderBy: { frequency: 'desc' },
      take: 10
    })
  ]);

  return {
    overview: {
      total: totalReports,
      pending: pendingReports,
      resolved: resolvedReports,
      resolutionRate: totalReports > 0 ? Math.round((resolvedReports / totalReports) * 100) : 0
    },
    trends: {
      last7Days: last7DaysReports,
      last30Days: last30DaysReports,
      weeklyGrowthRate: last7DaysReports > 0 ? Math.round(((last7DaysReports * 4 - last30DaysReports) / last30DaysReports) * 100) : 0
    },
    breakdown: {
      byType: Object.fromEntries(reportsByType.map(r => [r.reportType, r._count])),
      bySeverity: Object.fromEntries(reportsBySeverity.map(r => [r.severity, r._count]))
    },
    topReported: topReportedCards.map(r => ({
      vocabId: r.vocabId,
      lemma: r.vocab.lemma,
      frequency: r.frequency,
      reportType: r.reportType,
      severity: r.severity
    }))
  };
}

// 음성 품질 자동 수정 트리거
async function triggerAudioQualityFix(vocabId) {
  try {
    // 실제로는 음성 생성 서비스에 요청을 보내거나
    // 작업 큐에 수정 작업을 추가
    console.log(`[AUDIO FIX] Triggered automatic audio quality fix for vocab ${vocabId}`);
    
    // 예시: 기존 음성을 비활성화하고 새로 생성 요청
    await prisma.dictentry.updateMany({
      where: { vocabId },
      data: {
        audioUrl: null, // 문제있는 음성 제거
        retrievedAt: null // 재생성 표시
      }
    });
    
  } catch (error) {
    console.error(`Failed to trigger audio fix for vocab ${vocabId}:`, error);
  }
}

module.exports = router;