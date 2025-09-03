// src/components/common/LoadingSpinner.tsx
// 공통 로딩 스피너 컴포넌트

import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { LoadingSpinnerProps } from '../../types';

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  color = '#3b82f6',
  style
}) => {
  const getSize = () => {
    switch (size) {
      case 'small':
        return 20;
      case 'medium':
        return 36;
      case 'large':
        return 48;
      default:
        return 36;
    }
  };

  const containerStyle = [
    styles.container,
    { width: getSize(), height: getSize() },
    style
  ];

  return (
    <View style={containerStyle}>
      <ActivityIndicator size={size === 'large' ? 'large' : 'small'} color={color} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default LoadingSpinner;