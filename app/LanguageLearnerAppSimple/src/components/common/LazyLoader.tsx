// LazyLoader.tsx - 지연 로딩 컴포넌트
import React, { memo, useState, useEffect, useRef } from 'react';
import { View, ViewStyle, Dimensions } from 'react-native';

interface LazyLoaderProps {
  children: React.ReactNode;
  placeholder?: React.ReactNode;
  threshold?: number;
  style?: ViewStyle;
  onVisible?: () => void;
}

const LazyLoader = memo<LazyLoaderProps>(({
  children,
  placeholder,
  threshold = 100,
  style,
  onVisible
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const viewRef = useRef<View>(null);

  useEffect(() => {
    const checkVisibility = () => {
      if (viewRef.current && !hasBeenVisible) {
        viewRef.current.measure((x, y, width, height, pageX, pageY) => {
          const screenHeight = Dimensions.get('window').height;
          const elementTop = pageY;
          const elementBottom = pageY + height;
          
          const isInViewport = (
            elementTop < screenHeight + threshold &&
            elementBottom > -threshold
          );
          
          if (isInViewport) {
            setIsVisible(true);
            setHasBeenVisible(true);
            onVisible?.();
          }
        });
      }
    };

    // 초기 체크
    const timer = setTimeout(checkVisibility, 100);
    
    return () => clearTimeout(timer);
  }, [hasBeenVisible, threshold, onVisible]);

  return (
    <View ref={viewRef} style={style}>
      {(isVisible || hasBeenVisible) ? children : placeholder}
    </View>
  );
});

LazyLoader.displayName = 'LazyLoader';

export default LazyLoader;