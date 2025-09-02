import React, { useState } from 'react';
import { toast } from 'react-toastify';

const CardReportModal = ({ 
  isOpen, 
  onClose, 
  vocabId, 
  vocabLemma, 
  onReportSubmitted 
}) => {
  const [reportData, setReportData] = useState({
    reportType: '',
    description: '',
    severity: 'MEDIUM'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reportTypes = [
    { value: 'AUDIO_QUALITY', label: '🔊 음성 품질 문제', description: '발음이 부정확하거나 음질이 나쁨' },
    { value: 'WRONG_TRANSLATION', label: '📝 번역 오류', description: '번역이 틀렸거나 부적절함' },
    { value: 'INAPPROPRIATE', label: '⚠️ 부적절한 내용', description: '불쾌하거나 부적절한 예문/내용' },
    { value: 'MISSING_INFO', label: '❓ 정보 부족', description: '예문이나 설명이 부족함' },
    { value: 'TECHNICAL_ISSUE', label: '🔧 기술적 문제', description: '카드가 제대로 작동하지 않음' },
    { value: 'OTHER', label: '💬 기타', description: '위에 해당하지 않는 문제' }
  ];

  const severityLevels = [
    { value: 'LOW', label: '낮음', color: 'text-success', description: '사소한 문제' },
    { value: 'MEDIUM', label: '보통', color: 'text-warning', description: '일반적인 문제' },
    { value: 'HIGH', label: '높음', color: 'text-danger', description: '심각한 문제' },
    { value: 'CRITICAL', label: '긴급', color: 'text-danger fw-bold', description: '즉시 수정 필요' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!reportData.reportType) {
      toast.error('신고 유형을 선택해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/cards/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          vocabId: vocabId,
          reportType: reportData.reportType,
          description: reportData.description,
          severity: reportData.severity
        })
      });

      if (response.ok) {
        toast.success('신고가 접수되었습니다. 검토 후 조치하겠습니다.');
        setReportData({ reportType: '', description: '', severity: 'MEDIUM' });
        if (onReportSubmitted) onReportSubmitted();
        onClose();
      } else {
        const error = await response.json();
        toast.error(error.message || '신고 접수 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Report submission error:', error);
      toast.error('네트워크 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              📋 카드 신고하기
            </h5>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose}
              disabled={isSubmitting}
            ></button>
          </div>
          
          <div className="modal-body">
            <div className="mb-3 p-3 bg-light rounded">
              <strong>신고 대상:</strong> {vocabLemma}
              <div className="text-muted small mt-1">
                문제가 있는 카드를 신고해주시면 품질 개선에 도움이 됩니다.
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label fw-bold">문제 유형 *</label>
                <div className="row">
                  {reportTypes.map((type) => (
                    <div key={type.value} className="col-md-6 mb-2">
                      <div 
                        className={`card h-100 cursor-pointer ${reportData.reportType === type.value ? 'border-primary bg-primary-subtle' : 'border-secondary-subtle'}`}
                        onClick={() => setReportData({...reportData, reportType: type.value})}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="card-body p-2">
                          <div className="form-check">
                            <input 
                              className="form-check-input" 
                              type="radio" 
                              name="reportType"
                              value={type.value}
                              checked={reportData.reportType === type.value}
                              onChange={(e) => setReportData({...reportData, reportType: e.target.value})}
                            />
                            <label className="form-check-label small">
                              <strong>{type.label}</strong><br/>
                              <span className="text-muted">{type.description}</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold">심각도</label>
                <div className="btn-group w-100" role="group">
                  {severityLevels.map((level) => (
                    <input
                      key={level.value}
                      type="radio"
                      className="btn-check"
                      name="severity"
                      id={`severity-${level.value}`}
                      value={level.value}
                      checked={reportData.severity === level.value}
                      onChange={(e) => setReportData({...reportData, severity: e.target.value})}
                    />
                  ))}
                  {severityLevels.map((level) => (
                    <label
                      key={`label-${level.value}`}
                      className={`btn btn-outline-secondary ${level.color}`}
                      htmlFor={`severity-${level.value}`}
                      title={level.description}
                    >
                      {level.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <label htmlFor="description" className="form-label fw-bold">
                  상세 설명 
                  <span className="text-muted fw-normal">(선택사항)</span>
                </label>
                <textarea
                  id="description"
                  className="form-control"
                  rows="4"
                  placeholder="문제에 대한 자세한 설명을 입력해주세요. (예: 어떤 부분이 틀렸는지, 언제 발생했는지 등)"
                  value={reportData.description}
                  onChange={(e) => setReportData({...reportData, description: e.target.value})}
                />
                <div className="form-text">
                  구체적인 설명일수록 더 빠르게 문제를 해결할 수 있습니다.
                </div>
              </div>

              <div className="alert alert-info">
                <i className="bi bi-info-circle me-2"></i>
                신고해주신 내용은 검토 후 24-48시간 내에 처리됩니다.
                동일한 문제가 여러 번 신고되면 우선적으로 처리됩니다.
              </div>
            </form>
          </div>

          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onClose}
              disabled={isSubmitting}
            >
              취소
            </button>
            <button 
              type="submit" 
              className="btn btn-danger"
              onClick={handleSubmit}
              disabled={isSubmitting || !reportData.reportType}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  신고 접수 중...
                </>
              ) : (
                '신고하기'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardReportModal;