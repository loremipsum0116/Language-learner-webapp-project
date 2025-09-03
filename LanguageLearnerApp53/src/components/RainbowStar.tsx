// src/components/RainbowStar.tsx
// 60일 마스터 완료 단어에 표시할 무지개 별 컴포넌트 (React Native 버전)

import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { RainbowStarProps } from '../types';

const RainbowStar: React.FC<RainbowStarProps> = ({ 
  size = 'medium', 
  cycles = 1, 
  style = {},
  animated = true,
  tooltip = true
}) => {
  // 별 아이콘을 텍스트로 표현 (React Native에서는 SVG 대신 이모지 사용)
  const StarIcon = ({ textStyle }: { textStyle: any }) => (
    <Text style={[styles.starIcon, textStyle]}>⭐</Text>
  );

  const getTooltipText = () => {
    if (cycles === 1) {
      return '🌟 마스터 완료!';
    } else {
      return `🌟 ${cycles}회 마스터 완료!`;
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return styles.smallStar;
      case 'medium':
        return styles.mediumStar;
      case 'large':
        return styles.largeStar;
      case 'xl':
        return styles.xlStar;
      default:
        return styles.mediumStar;
    }
  };

  return (
    <View style={[styles.container, getSizeStyle(), style]}>
      <View style={styles.starContainer}>
        {/* 메인 별 */}
        <StarIcon textStyle={styles.mainStar} />
        
        {/* 글로우 효과 (React Native에서는 shadow로 구현) */}
        <StarIcon textStyle={[styles.glowStar, getSizeStyle()]} />
        
        {/* 여러 사이클 완료 시 추가 별들 */}
        {cycles > 1 && (
          <View style={styles.multiplesContainer}>
            {Array.from({ length: Math.min(cycles - 1, 2) }).map((_, index) => (
              <StarIcon 
                key={index} 
                textStyle={[
                  styles.multipleStar,
                  index === 0 ? styles.multiple1 : styles.multiple2
                ]}
              />
            ))}
            {cycles > 3 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>+{cycles - 1}</Text>
              </View>
            )}
          </View>
        )}
        
        {/* 반짝임 효과 */}
        {animated && (
          <>
            <View style={[styles.sparkle, styles.sparkle1]} />
            <View style={[styles.sparkle, styles.sparkle2]} />
            <View style={[styles.sparkle, styles.sparkle3]} />
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallStar: {
    width: 16,
    height: 16,
  },
  mediumStar: {
    width: 20,
    height: 20,
  },
  largeStar: {
    width: 28,
    height: 28,
  },
  xlStar: {
    width: 36,
    height: 36,
  },
  starContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  starIcon: {
    textAlign: 'center',
  },
  mainStar: {
    fontSize: 20,
    color: '#ffd700', // Gold color
    textShadowColor: 'rgba(255, 215, 0, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
    zIndex: 2,
  },
  glowStar: {
    position: 'absolute',
    fontSize: 20,
    color: '#ffd700',
    opacity: 0.6,
    zIndex: 1,
  },
  multiplesContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  multipleStar: {
    position: 'absolute',
    fontSize: 12,
    color: '#ffed4e',
    opacity: 0.7,
  },
  multiple1: {
    top: -8,
    right: -8,
  },
  multiple2: {
    bottom: -8,
    left: -8,
  },
  countBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#e91e63',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  countText: {
    color: 'white',
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  sparkle: {
    position: 'absolute',
    width: 4,
    height: 4,
    backgroundColor: 'white',
    borderRadius: 2,
    opacity: 0.8,
  },
  sparkle1: {
    top: '10%',
    right: '10%',
  },
  sparkle2: {
    bottom: '20%',
    left: '15%',
  },
  sparkle3: {
    top: '60%',
    right: '70%',
  },
});

export default RainbowStar;