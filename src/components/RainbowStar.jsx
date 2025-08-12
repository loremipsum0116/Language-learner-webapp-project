// src/components/RainbowStar.jsx
// 120일 마스터 완료 단어에 표시할 무지개 별 컴포넌트

import React from 'react';
import './RainbowStar.css';

const RainbowStar = ({ 
  size = 'medium', 
  cycles = 1, 
  className = '',
  animated = true,
  tooltip = true
}) => {
  const sizeClasses = {
    small: 'rainbow-star--small',
    medium: 'rainbow-star--medium', 
    large: 'rainbow-star--large',
    xl: 'rainbow-star--xl'
  };

  const StarIcon = ({ className: iconClass }) => (
    <svg 
      className={iconClass}
      viewBox="0 0 24 24" 
      fill="currentColor"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );

  const getTooltipText = () => {
    if (cycles === 1) {
      return '🌟 120일 마스터 완료!';
    } else {
      return `🌟 ${cycles}회 마스터 완료!`;
    }
  };

  return (
    <div 
      className={`rainbow-star ${sizeClasses[size]} ${animated ? 'rainbow-star--animated' : ''} ${className}`}
      title={tooltip ? getTooltipText() : ''}
    >
      <div className="rainbow-star__container">
        {/* 메인 별 */}
        <StarIcon className="rainbow-star__main" />
        
        {/* 글로우 효과 */}
        <StarIcon className="rainbow-star__glow" />
        
        {/* 여러 사이클 완료 시 추가 별들 */}
        {cycles > 1 && (
          <div className="rainbow-star__multiples">
            {Array.from({ length: Math.min(cycles - 1, 2) }).map((_, index) => (
              <StarIcon 
                key={index} 
                className={`rainbow-star__multiple rainbow-star__multiple--${index + 1}`} 
              />
            ))}
            {cycles > 3 && (
              <div className="rainbow-star__count">+{cycles - 1}</div>
            )}
          </div>
        )}
        
        {/* 반짝임 효과 */}
        {animated && (
          <>
            <div className="rainbow-star__sparkle rainbow-star__sparkle--1"></div>
            <div className="rainbow-star__sparkle rainbow-star__sparkle--2"></div>
            <div className="rainbow-star__sparkle rainbow-star__sparkle--3"></div>
          </>
        )}
      </div>
    </div>
  );
};

export default RainbowStar;