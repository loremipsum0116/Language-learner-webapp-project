// src/components/gestures/ScreenTransitionWrapper.tsx
// 화면 전환 애니메이션을 위한 래퍼 컴포넌트

import React, { useRef, useEffect } from 'react';
import { Animated, Dimensions, PanResponder } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useThemedStyles } from '../../context/ThemeContext';
import { Theme } from '../../theme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ScreenTransitionWrapperProps {
  children: React.ReactNode;
  enableSwipeBack?: boolean;
  swipeBackThreshold?: number;
  animationDuration?: number;
  onSwipeStart?: () => void;
  onSwipeEnd?: (completed: boolean) => void;
}

export const ScreenTransitionWrapper: React.FC<ScreenTransitionWrapperProps> = ({
  children,
  enableSwipeBack = true,
  swipeBackThreshold = screenWidth * 0.3,
  animationDuration = 250,
  onSwipeStart,
  onSwipeEnd,
}) => {
  const navigation = useNavigation();
  const styles = useThemedStyles(createStyles);
  
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  // 스와이프 백 제스처 핸들러
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // 화면 왼쪽 가장자리에서 시작하는 스와이프만 감지
      const { pageX, moveX } = evt.nativeEvent;
      const { dx } = gestureState;
      
      if (!enableSwipeBack || !navigation.canGoBack()) {
        return false;
      }
      
      // 왼쪽 가장자리에서 시작하고 오른쪽으로 스와이프할 때만
      return pageX < 20 && dx > 0 && Math.abs(gestureState.dy) < 50;
    },

    onPanResponderGrant: () => {
      onSwipeStart?.();
    },

    onPanResponderMove: (evt, gestureState) => {
      const { dx } = gestureState;
      
      if (dx >= 0) {
        // 진행률에 따른 변환 계산
        const progress = Math.min(dx / screenWidth, 1);
        const translateValue = dx;
        const opacityValue = 1 - (progress * 0.3);
        const scaleValue = 1 - (progress * 0.05);

        translateX.setValue(translateValue);
        opacity.setValue(opacityValue);
        scale.setValue(scaleValue);
      }
    },

    onPanResponderRelease: (evt, gestureState) => {
      const { dx, vx } = gestureState;
      const shouldComplete = dx > swipeBackThreshold || vx > 0.5;

      if (shouldComplete && navigation.canGoBack()) {
        // 완료 애니메이션
        Animated.parallel([
          Animated.timing(translateX, {
            toValue: screenWidth,
            duration: animationDuration,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: animationDuration,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.8,
            duration: animationDuration,
            useNativeDriver: true,
          }),
        ]).start(() => {
          navigation.goBack();
          resetAnimation();
          onSwipeEnd?.(true);
        });
      } else {
        // 취소 애니메이션
        Animated.parallel([
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }),
          Animated.spring(opacity, {
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onSwipeEnd?.(false);
        });
      }
    },

    onPanResponderTerminate: () => {
      // 제스처가 중단된 경우 원래 상태로 복원
      resetAnimation();
      onSwipeEnd?.(false);
    },
  });

  const resetAnimation = () => {
    translateX.setValue(0);
    opacity.setValue(1);
    scale.setValue(1);
  };

  // 화면 포커스 시 애니메이션 초기화
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      resetAnimation();
    });

    return unsubscribe;
  }, [navigation]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            { translateX },
            { scale },
          ],
          opacity,
        },
      ]}
      {...panResponder.panHandlers}
    >
      {children}
    </Animated.View>
  );
};

// 입장/퇴장 애니메이션을 위한 훅
export const useScreenTransition = (type: 'enter' | 'exit' = 'enter') => {
  const animation = useRef(new Animated.Value(type === 'enter' ? 0 : 1)).current;
  
  useEffect(() => {
    if (type === 'enter') {
      Animated.timing(animation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, []);

  const exitAnimation = (callback?: () => void) => {
    Animated.timing(animation, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(callback);
  };

  return { animation, exitAnimation };
};

// 페이드 애니메이션 컴포넌트
export const FadeTransition: React.FC<{
  children: React.ReactNode;
  visible: boolean;
  duration?: number;
}> = ({ children, visible, duration = 200 }) => {
  const fadeAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration,
      useNativeDriver: true,
    }).start();
  }, [visible, duration, fadeAnim]);

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      {children}
    </Animated.View>
  );
};

// 슬라이드 애니메이션 컴포넌트
export const SlideTransition: React.FC<{
  children: React.ReactNode;
  visible: boolean;
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
  duration?: number;
}> = ({ 
  children, 
  visible, 
  direction = 'up', 
  distance = 50, 
  duration = 300 
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    const getInitialOffset = () => {
      switch (direction) {
        case 'up': return { x: 0, y: distance };
        case 'down': return { x: 0, y: -distance };
        case 'left': return { x: distance, y: 0 };
        case 'right': return { x: -distance, y: 0 };
        default: return { x: 0, y: distance };
      }
    };

    const offset = getInitialOffset();
    
    if (!visible) {
      translateX.setValue(offset.x);
      translateY.setValue(offset.y);
    }

    Animated.parallel([
      Animated.timing(translateX, {
        toValue: visible ? 0 : offset.x,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: visible ? 0 : offset.y,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, direction, distance, duration]);

  return (
    <Animated.View
      style={{
        transform: [{ translateX }, { translateY }],
        opacity,
      }}
    >
      {children}
    </Animated.View>
  );
};

// 스케일 애니메이션 컴포넌트
export const ScaleTransition: React.FC<{
  children: React.ReactNode;
  visible: boolean;
  initialScale?: number;
  duration?: number;
}> = ({ children, visible, initialScale = 0.8, duration = 250 }) => {
  const scale = useRef(new Animated.Value(visible ? 1 : initialScale)).current;
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: visible ? 1 : initialScale,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, initialScale, duration]);

  return (
    <Animated.View
      style={{
        transform: [{ scale }],
        opacity,
      }}
    >
      {children}
    </Animated.View>
  );
};

const createStyles = (theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});

export default ScreenTransitionWrapper;