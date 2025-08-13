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

  const getCardStatus = () => {
    if (!card || isCardMastered) return null;
    
    // 실제 현재 시간 사용 (동결 상태는 타임머신과 관계없이 실시간으로 해제됨)
    const now = new Date();
    
    // 동결 상태 확인 (최우선)
    if (card.isFrozen && card.frozenUntil) {
      const frozenUntil = new Date(card.frozenUntil);
      if (now < frozenUntil) {
        return {
          text: '동결 중',
          color: 'text-blue-800 bg-blue-200',
          urgent: false,
          type: 'frozen'
        };
      } else {
        // 동결 해제된 경우 - 즉시 overdue 상태로 표시 (명세: 동결 만료 후 Overdue로 복귀)
        return {
          text: '복습 필요',
          color: 'text-yellow-700 bg-yellow-200',
          urgent: true,
          type: 'overdue'
        };
      }
    }
    
    // Overdue 상태 (노란색)
    if (card.isOverdue && card.overdueDeadline) {
      const deadline = new Date(card.overdueDeadline);
      if (now < deadline) {
        return {
          text: '복습 필요',
          color: 'text-yellow-700 bg-yellow-200',
          urgent: true,
          type: 'overdue'
        };
      }
    }
    
    // 오답 대기 중 (빨간색)
    if (card.isFromWrongAnswer && card.waitingUntil) {
      const waitingUntil = new Date(card.waitingUntil);
      if (now < waitingUntil) {
        return {
          text: '오답 대기',
          color: 'text-red-700 bg-red-200',
          urgent: false,
          type: 'wrongWaiting'
        };
      }
    }
    
    // 정답 대기 중 (초록색)
    if (card.waitingUntil && !card.isFromWrongAnswer) {
      const waitingUntil = new Date(card.waitingUntil);
      if (now < waitingUntil) {
        return {
          text: '정답 대기',
          color: 'text-green-700 bg-green-200',
          urgent: false,
          type: 'correctWaiting'
        };
      }
    }
    
    return null;
  };

  const stageInfo = getStageInfo();
  const cardStatus = getCardStatus();

  const getCardBgClass = () => {
    if (isCardMastered) {
      return 'ring-2 ring-purple-300 bg-gradient-to-br from-white to-purple-50';
    }
    
    if (cardStatus?.type === 'frozen') {
      return 'ring-2 ring-blue-400 bg-gradient-to-br from-white to-blue-50';
    }
    
    if (cardStatus?.type === 'overdue') {
      return 'ring-1 ring-yellow-300 bg-gradient-to-br from-white to-yellow-50';
    }
    
    if (cardStatus?.type === 'wrongWaiting') {
      return 'ring-1 ring-red-300 bg-gradient-to-br from-white to-red-50';
    }
    
    if (cardStatus?.type === 'correctWaiting') {
      return 'ring-1 ring-green-300 bg-gradient-to-br from-white to-green-50';
    }
    
    return 'bg-white';
  };

  return (
    <div 
      className={`vocab-card relative rounded-lg shadow-md hover:shadow-lg transition-all duration-200 p-4 cursor-pointer ${className} ${getCardBgClass()}`}
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
      {cardStatus?.urgent && (
        <div className="absolute top-2 left-2 z-10">
          <span className="inline-flex items-center px-2 py-1 text-xs font-bold text-yellow-700 bg-yellow-200 rounded-full animate-pulse">
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
          {cardStatus && (
            <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${cardStatus.color} ${
              cardStatus.type === 'frozen' ? 'border-2 border-blue-400' : ''
            }`}>
              {cardStatus.type === 'frozen' ? '🧊 ' : ''}
              {cardStatus.text}
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