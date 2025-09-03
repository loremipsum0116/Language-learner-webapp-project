// src/components/animations/TouchFeedback.tsx
// 터치 피드백 애니메이션 컴포넌트

import React, { useRef } from 'react';
import { Animated, TouchableWithoutFeedback, ViewStyle } from 'react-native';
import { useHapticFeedback, HapticType } from '../../services/HapticFeedbackService';

interface TouchFeedbackProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: ViewStyle;
  disabled?: boolean;
  scaleValue?: number;
  duration?: number;
  hapticType?: HapticType;
  enableHaptic?: boolean;
  hapticOnLongPress?: HapticType;
}

const TouchFeedback: React.FC<TouchFeedbackProps> = ({
  children,
  onPress,
  onLongPress,
  style,
  disabled = false,
  scaleValue = 0.95,
  duration = 100,
  hapticType = HapticType.BUTTON_PRESS,
  enableHaptic = true,
  hapticOnLongPress = HapticType.LONG_PRESS,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const { trigger } = useHapticFeedback();

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: scaleValue,
      duration,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      duration,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    if (enableHaptic && !disabled) {
      trigger(hapticType);
    }
    onPress?.();
  };

  const handleLongPress = () => {
    if (enableHaptic && !disabled) {
      trigger(hapticOnLongPress);
    }
    onLongPress?.();
  };

  return (
    <TouchableWithoutFeedback
      onPress={handlePress}
      onLongPress={handleLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Animated.View
        style={[
          style,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

export default TouchFeedback;