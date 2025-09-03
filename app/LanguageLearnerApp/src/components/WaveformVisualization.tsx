import React, {useEffect, useRef, useState} from 'react';
import {View, Animated, Dimensions, StyleSheet} from 'react-native';
import Svg, {Rect, Path, G} from 'react-native-svg';

interface WaveformVisualizationProps {
  data: number[];
  color?: string;
  backgroundColor?: string;
  height?: number;
  isRecording?: boolean;
  showPlayhead?: boolean;
  playheadPosition?: number; // 0-1
  barWidth?: number;
  barSpacing?: number;
  animated?: boolean;
}

export const WaveformVisualization: React.FC<WaveformVisualizationProps> = ({
  data,
  color = '#3b82f6',
  backgroundColor = 'transparent',
  height = 80,
  isRecording = false,
  showPlayhead = false,
  playheadPosition = 0,
  barWidth = 2,
  barSpacing = 1,
  animated = true,
}) => {
  const {width: screenWidth} = Dimensions.get('window');
  const containerWidth = screenWidth - 64; // Account for padding
  const animatedValues = useRef<Animated.Value[]>([]).current;
  const recordingAnimation = useRef(new Animated.Value(0)).current;
  const [processedData, setProcessedData] = useState<number[]>([]);

  // Calculate how many bars we can fit
  const maxBars = Math.floor(containerWidth / (barWidth + barSpacing));
  
  useEffect(() => {
    processWaveformData();
  }, [data, maxBars]);

  useEffect(() => {
    if (isRecording && animated) {
      startRecordingAnimation();
    } else {
      stopRecordingAnimation();
    }
  }, [isRecording, animated]);

  const processWaveformData = () => {
    if (data.length === 0) {
      setProcessedData([]);
      return;
    }

    let processedData: number[];

    if (data.length <= maxBars) {
      // If we have fewer data points than bars, pad with zeros
      processedData = [...data, ...Array(maxBars - data.length).fill(0)];
    } else {
      // If we have more data points than bars, downsample
      const chunkSize = Math.ceil(data.length / maxBars);
      processedData = [];
      
      for (let i = 0; i < maxBars; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, data.length);
        const chunk = data.slice(start, end);
        
        // Use RMS (Root Mean Square) for better representation
        const rms = Math.sqrt(
          chunk.reduce((sum, value) => sum + value * value, 0) / chunk.length
        );
        processedData.push(rms);
      }
    }

    // Normalize data to 0-1 range
    const maxValue = Math.max(...processedData, 0.1);
    processedData = processedData.map(value => Math.max(0.05, value / maxValue));

    setProcessedData(processedData);
    initializeAnimatedValues(processedData);
  };

  const initializeAnimatedValues = (data: number[]) => {
    // Reset animated values
    animatedValues.length = 0;
    
    data.forEach((value, index) => {
      const animatedValue = new Animated.Value(0);
      animatedValues.push(animatedValue);

      if (animated) {
        Animated.timing(animatedValue, {
          toValue: value,
          duration: 300,
          delay: index * 20,
          useNativeDriver: false,
        }).start();
      } else {
        animatedValue.setValue(value);
      }
    });
  };

  const startRecordingAnimation = () => {
    const animate = () => {
      Animated.sequence([
        Animated.timing(recordingAnimation, {
          toValue: 1,
          duration: 500,
          useNativeDriver: false,
        }),
        Animated.timing(recordingAnimation, {
          toValue: 0,
          duration: 500,
          useNativeDriver: false,
        }),
      ]).start(() => {
        if (isRecording) {
          animate();
        }
      });
    };
    animate();
  };

  const stopRecordingAnimation = () => {
    recordingAnimation.stopAnimation();
    recordingAnimation.setValue(0);
  };

  const renderStaticWaveform = () => {
    if (processedData.length === 0) {
      return renderEmptyState();
    }

    const bars = processedData.map((value, index) => {
      const barHeight = Math.max(2, value * (height - 10));
      const x = index * (barWidth + barSpacing);
      const y = (height - barHeight) / 2;

      // Add subtle recording pulse effect
      let barColor = color;
      if (isRecording) {
        const pulseIntensity = 0.3 + 0.7 * recordingAnimation._value;
        barColor = `${color}${Math.round(pulseIntensity * 255).toString(16).padStart(2, '0')}`;
      }

      return (
        <Rect
          key={index}
          x={x}
          y={y}
          width={barWidth}
          height={barHeight}
          fill={barColor}
          rx={barWidth / 2}
        />
      );
    });

    return (
      <Svg width={containerWidth} height={height} style={styles.svg}>
        <G>
          {bars}
          {showPlayhead && renderPlayhead()}
        </G>
      </Svg>
    );
  };

  const renderAnimatedWaveform = () => {
    if (processedData.length === 0 || animatedValues.length === 0) {
      return renderEmptyState();
    }

    return (
      <View style={[styles.container, {height, backgroundColor}]}>
        {animatedValues.map((animatedValue, index) => (
          <Animated.View
            key={index}
            style={[
              styles.bar,
              {
                width: barWidth,
                marginRight: barSpacing,
                backgroundColor: color,
                height: animatedValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [2, height - 10],
                  extrapolate: 'clamp',
                }),
                opacity: isRecording
                  ? recordingAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.4, 1],
                    })
                  : 1,
              },
            ]}
          />
        ))}
        {showPlayhead && renderPlayhead()}
      </View>
    );
  };

  const renderPlayhead = () => {
    if (!showPlayhead || playheadPosition < 0 || playheadPosition > 1) {
      return null;
    }

    const x = playheadPosition * containerWidth;

    return (
      <View
        style={[
          styles.playhead,
          {
            left: x,
            height: height,
          },
        ]}
      />
    );
  };

  const renderEmptyState = () => {
    const emptyBars = Array.from({length: Math.min(maxBars, 20)}, (_, index) => (
      <Rect
        key={index}
        x={index * (barWidth + barSpacing)}
        y={height / 2 - 1}
        width={barWidth}
        height={2}
        fill={`${color}40`}
        rx={barWidth / 2}
      />
    ));

    return (
      <Svg width={containerWidth} height={height} style={styles.svg}>
        <G>{emptyBars}</G>
      </Svg>
    );
  };

  return (
    <View style={[styles.container, {height, backgroundColor}]}>
      {animated ? renderAnimatedWaveform() : renderStaticWaveform()}
    </View>
  );
};

// Static waveform component for performance-critical scenarios
export const StaticWaveform: React.FC<Omit<WaveformVisualizationProps, 'animated'>> = (props) => {
  return <WaveformVisualization {...props} animated={false} />;
};

// Frequency spectrum visualization for advanced analysis
export const FrequencySpectrum: React.FC<{
  frequencyData: number[];
  color?: string;
  height?: number;
}> = ({frequencyData, color = '#10b981', height = 120}) => {
  const {width: screenWidth} = Dimensions.get('window');
  const containerWidth = screenWidth - 64;
  const barWidth = 3;
  const barSpacing = 1;
  const maxBars = Math.floor(containerWidth / (barWidth + barSpacing));

  if (frequencyData.length === 0) {
    return (
      <View style={[styles.container, {height}]}>
        <Svg width={containerWidth} height={height}>
          <G>
            {Array.from({length: maxBars}, (_, index) => (
              <Rect
                key={index}
                x={index * (barWidth + barSpacing)}
                y={height - 5}
                width={barWidth}
                height={5}
                fill={`${color}40`}
                rx={1}
              />
            ))}
          </G>
        </Svg>
      </View>
    );
  }

  // Process frequency data
  const processedData = frequencyData.slice(0, maxBars);
  const maxValue = Math.max(...processedData, 1);
  const normalizedData = processedData.map(value => value / maxValue);

  const bars = normalizedData.map((value, index) => {
    const barHeight = Math.max(3, value * (height - 10));
    const x = index * (barWidth + barSpacing);
    const y = height - barHeight - 5;

    // Create gradient effect for frequency spectrum
    const opacity = 0.6 + (value * 0.4);

    return (
      <Rect
        key={index}
        x={x}
        y={y}
        width={barWidth}
        height={barHeight}
        fill={color}
        opacity={opacity}
        rx={1}
      />
    );
  });

  return (
    <View style={[styles.container, {height}]}>
      <Svg width={containerWidth} height={height}>
        <G>{bars}</G>
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  svg: {
    flex: 1,
  },
  bar: {
    borderRadius: 2,
    alignSelf: 'center',
  },
  playhead: {
    position: 'absolute',
    width: 2,
    backgroundColor: '#ef4444',
    borderRadius: 1,
    top: 0,
  },
});

export default WaveformVisualization;