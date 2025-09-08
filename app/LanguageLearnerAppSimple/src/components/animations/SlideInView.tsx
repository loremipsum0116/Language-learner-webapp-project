// src/components/animations/SlideInView.tsx
// 슬라이드 인 애니메이션 컴포넌트

import React, { useRef, useEffect } from 'react';
import { Animated, ViewStyle, Dimensions } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type SlideDirection = 'left' | 'right' | 'up' | 'down';

interface SlideInViewProps {
  children: React.ReactNode;
  direction?: SlideDirection;
  duration?: number;
  delay?: number;
  distance?: number;
  style?: ViewStyle;
}

const SlideInView: React.FC<SlideInViewProps> = ({
  children,
  direction = 'right',
  duration = 300,
  delay = 0,
  distance,
  style,
}) => {
  const slideAnim = useRef(new Animated.Value(0)).current;

  const getInitialPosition = () => {
    const defaultDistance = direction === 'left' || direction === 'right' 
      ? screenWidth * 0.5 
      : screenHeight * 0.5;
    
    const slideDistance = distance || defaultDistance;
    
    switch (direction) {
      case 'left':
        return -slideDistance;
      case 'right':
        return slideDistance;
      case 'up':
        return -slideDistance;
      case 'down':
        return slideDistance;
      default:
        return slideDistance;
    }
  };

  const getTransformStyle = () => {
    const initialPosition = getInitialPosition();
    
    if (direction === 'left' || direction === 'right') {
      return {
        transform: [
          {
            translateX: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [initialPosition, 0],
            }),
          },
        ],
      };
    } else {
      return {
        transform: [
          {
            translateY: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [initialPosition, 0],
            }),
          },
        ],
      };
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.spring(slideAnim, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [slideAnim, duration, delay]);

  return (
    <Animated.View
      style={[
        style,
        getTransformStyle(),
      ]}
    >
      {children}
    </Animated.View>
  );
};

export default SlideInView;