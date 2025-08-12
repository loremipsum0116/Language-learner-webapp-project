// src/components/VocabCard.jsx
// 마스터 별 표시가 포함된 단어 카드 컴포넌트

import React from 'react';
import RainbowStar from './RainbowStar';
import Pron from './Pron';

const VocabCard = ({ 
  vocab, 
  card = null,
  onClick, 
  className = '',
  showProgress = true,
  size = 'medium'
}) => {
  const isCardMastered = card?.isMastered;
  const masterCycles = card?.masterCycles || 0;
  
  const getStageInfo = () => {
    if (isCardMastered) {
      return {
        text: '마스터 완료',
        color: 'text-purple-600',
        bgColor: 'bg-purple-100'
      };
    }
    
    if (!card) {
      return {
        text: '미학습',
        color: 'text-gray-600',
        bgColor: 'bg-gray-100'
      };
    }
    
    const stage = card.stage || 0;
    const stageLabels = ['새 단어', 'Stage 1', 'Stage 2', 'Stage 3', 'Stage 4', 'Stage 5', 'Stage 6'];
    const stageColors = [
      'text-gray-600 bg-gray-100',
      'text-blue-600 bg-blue-100',
      'text-green-600 bg-green-100', 
      'text-yellow-600 bg-yellow-100',
      'text-orange-600 bg-orange-100',
      'text-red-600 bg-red-100',
      'text-purple-600 bg-purple-100'
    ];
    
    return {
      text: stageLabels[stage] || `Stage ${stage}`,
      colorClass: stageColors[stage] || 'text-gray-600 bg-gray-100'
    };
  };

  const getOverdueStatus = () => {
    if (!card || isCardMastered) return null;
    
    const now = new Date();
    
    if (card.isOverdue && card.overdueDeadline) {
      const deadline = new Date(card.overdueDeadline);
      if (now < deadline) {
        return {
          text: '복습 필요',
          color: 'text-red-600 bg-red-100',
          urgent: true
        };
      }
    }
    
    if (card.waitingUntil) {
      const waitingUntil = new Date(card.waitingUntil);
      if (now < waitingUntil) {
        return {
          text: '대기 중',
          color: 'text-blue-600 bg-blue-100',
          urgent: false
        };
      }
    }
    
    return null;
  };

  const stageInfo = getStageInfo();
  const overdueStatus = getOverdueStatus();

  return (
    <div 
      className={`vocab-card relative bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 p-4 cursor-pointer ${className} ${
        isCardMastered ? 'ring-2 ring-purple-300 bg-gradient-to-br from-white to-purple-50' : ''
      }`}
      onClick={onClick}
    >
      {/* 마스터 별 표시 */}
      {isCardMastered && (
        <RainbowStar 
          size={size === 'large' ? 'large' : 'medium'} 
          cycles={masterCycles} 
          animated={true}
          className="absolute top-2 right-2 z-10"
        />
      )}
      
      {/* 긴급 복습 표시 */}
      {overdueStatus?.urgent && (
        <div className="absolute top-2 left-2 z-10">
          <span className="inline-flex items-center px-2 py-1 text-xs font-bold text-red-600 bg-red-100 rounded-full animate-pulse">
            ⚠️ 복습 필요
          </span>
        </div>
      )}
      
      {/* 단어 헤더 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className={`font-bold ${
            size === 'large' ? 'text-xl' : 'text-lg'
          } text-gray-800 ${isCardMastered ? 'text-purple-800' : ''}`}>
            {vocab.lemma}
          </h3>
          
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-gray-600">{vocab.pos}</span>
            {vocab.levelCEFR && (
              <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded">
                {vocab.levelCEFR}
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* 발음 표시 */}
      {vocab.dictMeta?.ipa && (
        <div className="mb-2">
          <Pron ipa={vocab.dictMeta.ipa} />
        </div>
      )}
      
      {/* 진행 상태 표시 */}
      {showProgress && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {/* Stage 표시 */}
          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
            stageInfo.colorClass || `${stageInfo.color} ${stageInfo.bgColor}`
          }`}>
            {stageInfo.text}
          </span>
          
          {/* 상태 표시 */}
          {overdueStatus && (
            <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${overdueStatus.color}`}>
              {overdueStatus.text}
            </span>
          )}
          
          {/* 마스터 사이클 표시 */}
          {isCardMastered && masterCycles > 1 && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-bold text-purple-600 bg-purple-100 rounded-full">
              {masterCycles}회 마스터
            </span>
          )}
        </div>
      )}
      
      {/* 학습 통계 */}
      {card && (card.correctTotal > 0 || card.wrongTotal > 0) && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
          <div className="text-xs text-gray-600">
            정답 {card.correctTotal} / 오답 {card.wrongTotal}
          </div>
          
          {!isCardMastered && card.correctTotal + card.wrongTotal > 0 && (
            <div className="text-xs font-medium text-green-600">
              {((card.correctTotal / (card.correctTotal + card.wrongTotal)) * 100).toFixed(0)}%
            </div>
          )}
        </div>
      )}
      
      {/* 마스터 완료 시각 */}
      {isCardMastered && card.masteredAt && (
        <div className="mt-2 text-xs text-purple-600 font-medium">
          🏆 {new Date(card.masteredAt).toLocaleDateString('ko-KR')} 마스터 완료
        </div>
      )}
    </div>
  );
};

export default VocabCard;