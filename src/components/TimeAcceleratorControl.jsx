// src/components/TimeAcceleratorControl.jsx
// 시간 가속 컨트롤 컴포넌트

import React, { useState, useEffect } from 'react';
import { fetchJSON, withCreds } from '../api/client';
import { toast } from 'react-toastify';

const TimeAcceleratorControl = ({ className = '' }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [customFactor, setCustomFactor] = useState('');

  // 현재 가속 상태 조회
  const loadStatus = async () => {
    try {
      const response = await fetchJSON('/time-accelerator/status');
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to load acceleration status:', error);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  // 프리셋 적용
  const applyPreset = async (preset) => {
    setLoading(true);
    try {
      const response = await fetchJSON('/time-accelerator/preset', withCreds({
        method: 'POST',
        body: JSON.stringify({ preset })
      }));
      
      setStatus(response.data);
      toast.success(`가속 프리셋 '${preset}' 적용 완료!`);
    } catch (error) {
      toast.error(`프리셋 적용 실패: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 커스텀 팩터 적용
  const applyCustomFactor = async () => {
    const factor = parseFloat(customFactor);
    
    if (isNaN(factor) || factor < 1) {
      toast.error('가속 팩터는 1 이상의 숫자여야 합니다');
      return;
    }

    setLoading(true);
    try {
      const response = await fetchJSON('/time-accelerator/set', withCreds({
        method: 'POST',
        body: JSON.stringify({ factor })
      }));
      
      setStatus(response.data);
      toast.success(`커스텀 가속 ${factor}x 적용 완료!`);
      setCustomFactor('');
    } catch (error) {
      toast.error(`커스텀 가속 적용 실패: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!status) {
    return (
      <div className={`p-4 bg-gray-100 rounded-lg ${className}`}>
        <div className="animate-pulse">가속 상태 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className={`p-4 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg border border-blue-200 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">⚡</span>
        <h3 className="text-lg font-bold text-gray-800">시간 가속 컨트롤</h3>
        {status.isActive && (
          <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-full animate-pulse">
            {status.accelerationFactor}x 활성
          </span>
        )}
      </div>

      {/* 현재 상태 표시 */}
      <div className="mb-4 p-3 bg-white rounded border border-blue-200">
        <div className="text-sm text-gray-600 mb-2">현재 가속 상태:</div>
        <div className="font-bold text-blue-600">
          {status.accelerationFactor}x {status.isActive ? '(활성)' : '(실시간)'}
        </div>
        
        {status.examples && (
          <div className="mt-2 text-xs text-gray-500">
            <div className="mb-2">
              <strong>장기 곡선:</strong>
              <div>• Stage 1: {status.examples.longCurve?.stage1?.original} → {status.examples.longCurve?.stage1?.accelerated}</div>
              <div>• Stage 2: {status.examples.longCurve?.stage2?.original} → {status.examples.longCurve?.stage2?.accelerated}</div>
              <div>• Stage 3: {status.examples.longCurve?.stage3?.original} → {status.examples.longCurve?.stage3?.accelerated}</div>
            </div>
            <div className="mb-2">
              <strong>단기 곡선:</strong>
              <div>• Stage 1: {status.examples.shortCurve?.stage1?.original} → {status.examples.shortCurve?.stage1?.accelerated}</div>
              <div>• Stage 3: {status.examples.shortCurve?.stage3?.original} → {status.examples.shortCurve?.stage3?.accelerated}</div>
            </div>
            <div>
              <strong>오답/동결:</strong>
              <div>• 오답 Stage0: {status.examples.wrongAnswer?.stage0?.original} → {status.examples.wrongAnswer?.stage0?.accelerated}</div>
              <div>• 동결/overdue: {status.examples.overdue?.original} → {status.examples.overdue?.accelerated}</div>
            </div>
          </div>
        )}
        
        {status.stats && (
          <div className="mt-3 p-2 bg-gray-50 rounded text-xs">
            <div className="text-sm font-medium text-gray-700 mb-1">현재 카드 상태:</div>
            <div className="grid grid-cols-2 gap-1">
              <div>• 총 카드: {status.stats.totalCards}</div>
              <div>• 대기중: {status.stats.waitingCards}</div>
              <div>• 복습가능: {status.stats.overdueCards}</div>
              <div>• 동결중: {status.stats.frozenCards}</div>
              <div>• 마스터: {status.stats.masteredCards}</div>
            </div>
          </div>
        )}
      </div>

      {/* 프리셋 버튼들 */}
      <div className="mb-4">
        <div className="text-sm font-medium text-gray-700 mb-2">빠른 설정:</div>
        <div className="grid grid-cols-2 gap-2">
          {status.presets && Object.entries(status.presets).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => applyPreset(key)}
              disabled={loading}
              className={`px-3 py-2 text-sm font-medium rounded border transition-colors ${
                status.accelerationFactor === preset.factor
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="font-bold">{preset.factor}x</div>
              <div className="text-xs opacity-75">{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 커스텀 팩터 입력 */}
      <div className="border-t border-blue-200 pt-3">
        <div className="text-sm font-medium text-gray-700 mb-2">커스텀 가속:</div>
        <div className="flex gap-2">
          <input
            type="number"
            min="1"
            max="10080"
            step="1"
            value={customFactor}
            onChange={(e) => setCustomFactor(e.target.value)}
            placeholder="1-10080"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
            disabled={loading}
          />
          <button
            onClick={applyCustomFactor}
            disabled={loading || !customFactor}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            적용
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          1x = 실시간, 60x = 1일이 24분, 1440x = 1일이 1분
        </div>
      </div>

      {/* 주의사항 */}
      <div className="mt-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
        ⚠️ 가속 모드는 테스트용입니다. 모든 SRS 타이머가 가속됩니다.
      </div>
    </div>
  );
};

export default TimeAcceleratorControl;