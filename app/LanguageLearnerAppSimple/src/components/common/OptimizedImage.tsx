// OptimizedImage.tsx - 성능 최적화된 이미지 컴포넌트
import React, { memo, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import FastImage, { FastImageProps, ResizeMode } from 'react-native-fast-image';

interface OptimizedImageProps extends Omit<FastImageProps, 'source'> {
  source: string | { uri: string };
  width?: number;
  height?: number;
  resizeMode?: ResizeMode;
  placeholder?: React.ReactNode;
  fallback?: React.ReactNode;
  lazy?: boolean;
  cache?: 'web' | 'cacheOnly' | 'immutable';
  containerStyle?: ViewStyle;
  onLoadStart?: () => void;
  onLoad?: () => void;
  onError?: (error: any) => void;
}

const OptimizedImage = memo<OptimizedImageProps>(({
  source,
  width,
  height,
  resizeMode = FastImage.resizeMode.cover,
  placeholder,
  fallback,
  lazy = false,
  cache = 'immutable',
  containerStyle,
  onLoadStart,
  onLoad,
  onError,
  style,
  ...props
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const imageSource = typeof source === 'string' 
    ? { uri: convertToWebP(source) } 
    : { uri: convertToWebP(source.uri) };

  const handleLoadStart = () => {
    setLoading(true);
    setError(false);
    onLoadStart?.();
  };

  const handleLoad = () => {
    setLoading(false);
    onLoad?.();
  };

  const handleError = (err: any) => {
    setLoading(false);
    setError(true);
    onError?.(err);
  };

  const imageStyle = [
    styles.image,
    { width, height },
    style
  ];

  if (error && fallback) {
    return (
      <View style={[styles.container, containerStyle]}>
        {fallback}
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      <FastImage
        {...props}
        source={imageSource}
        style={imageStyle}
        resizeMode={resizeMode}
        priority={lazy ? FastImage.priority.normal : FastImage.priority.high}
        cache={FastImage.cacheControl[cache]}
        onLoadStart={handleLoadStart}
        onLoad={handleLoad}
        onError={handleError}
      />
      
      {loading && (
        <View style={styles.loadingOverlay}>
          {placeholder || (
            <ActivityIndicator 
              size="small" 
              color="#4A90E2" 
            />
          )}
        </View>
      )}
    </View>
  );
});

// WebP 변환 함수
const convertToWebP = (url: string): string => {
  // 이미 WebP인 경우 그대로 반환
  if (url.includes('.webp')) {
    return url;
  }
  
  // 외부 이미지 서비스 사용 시 WebP 변환
  if (url.includes('http')) {
    // 예: Cloudinary, ImageKit 등의 WebP 변환 파라미터 추가
    if (url.includes('cloudinary.com')) {
      return url.replace('/upload/', '/upload/f_webp,q_auto/');
    }
    
    // 기본적으로 WebP 확장자로 변환 시도
    return url.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  }
  
  return url;
};

const styles = StyleSheet.create({
  container: {
    position: 'relative'
  },
  image: {
    backgroundColor: '#f5f5f5'
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5'
  }
});

OptimizedImage.displayName = 'OptimizedImage';

export default OptimizedImage;

// 사전 로딩 함수
export const preloadImages = (urls: string[]) => {
  const sources = urls.map(url => ({
    uri: convertToWebP(url),
    priority: FastImage.priority.high,
    cache: FastImage.cacheControl.immutable
  }));
  
  FastImage.preload(sources);
};

// 캐시 관리 함수
export const clearImageCache = () => {
  FastImage.clearMemoryCache();
  FastImage.clearDiskCache();
};