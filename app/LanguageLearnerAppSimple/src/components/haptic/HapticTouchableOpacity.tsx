// src/components/haptic/HapticTouchableOpacity.tsx
// 햅틱 피드백이 통합된 TouchableOpacity 컴포넌트

import React from 'react';
import { TouchableOpacity, TouchableOpacityProps } from 'react-native';
import { useHapticFeedback, HapticType } from '../../services/HapticFeedbackService';

interface HapticTouchableOpacityProps extends TouchableOpacityProps {
  hapticType?: HapticType;
  enableHaptic?: boolean;
  hapticDelay?: number;
  onPress?: () => void;
}

export const HapticTouchableOpacity: React.FC<HapticTouchableOpacityProps> = ({
  hapticType = HapticType.BUTTON_PRESS,
  enableHaptic = true,
  hapticDelay = 0,
  onPress,
  children,
  ...props
}) => {
  const { trigger } = useHapticFeedback();

  const handlePress = () => {
    if (enableHaptic) {
      if (hapticDelay > 0) {
        setTimeout(() => {
          trigger(hapticType);
        }, hapticDelay);
      } else {
        trigger(hapticType);
      }
    }
    onPress?.();
  };

  return (
    <TouchableOpacity {...props} onPress={handlePress}>
      {children}
    </TouchableOpacity>
  );
};

export default HapticTouchableOpacity;