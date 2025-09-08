import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  State,
} from 'react-native';
import {useTheme} from '../context/ThemeContext';
import AudioOptimizationService, {VolumeStatus, HeadphoneStatus} from '../services/AudioOptimizationService';
import HeadphoneDetection, {HeadphoneInfo} from '../utils/HeadphoneDetection';

interface VolumeControlProps {
  onVolumeChange?: (volume: number) => void;
  onMuteToggle?: (isMuted: boolean) => void;
  showHeadphoneStatus?: boolean;
  showVolumeBar?: boolean;
  showQuickActions?: boolean;
  orientation?: 'horizontal' | 'vertical';
  size?: 'small' | 'medium' | 'large';
  style?: any;
}

export const VolumeControl: React.FC<VolumeControlProps> = ({
  onVolumeChange,
  onMuteToggle,
  showHeadphoneStatus = true,
  showVolumeBar = true,
  showQuickActions = true,
  orientation = 'horizontal',
  size = 'medium',
  style,
}) => {
  const {colors} = useTheme();
  const [volumeStatus, setVolumeStatus] = useState<VolumeStatus>({
    current: 0.7,
    max: 1.0,
    isMuted: false,
    canChange: true,
  });
  const [headphoneInfo, setHeadphoneInfo] = useState<HeadphoneInfo>({
    isConnected: false,
    type: 'none',
  });
  const [isDragging, setIsDragging] = useState(false);
  const [showVolumeIndicator, setShowVolumeIndicator] = useState(false);

  const volumeAnimation = useRef(new Animated.Value(0.7)).current;
  const indicatorAnimation = useRef(new Animated.Value(0)).current;
  const headphoneAnimation = useRef(new Animated.Value(0)).current;
  const quickActionScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    initializeVolumeControl();
    setupListeners();

    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    // Animate volume bar
    Animated.timing(volumeAnimation, {
      toValue: volumeStatus.current,
      duration: 200,
      useNativeDriver: false,
    }).start();

    // Animate headphone connection
    if (headphoneInfo.isConnected) {
      Animated.spring(headphoneAnimation, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.spring(headphoneAnimation, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  }, [volumeStatus.current, headphoneInfo.isConnected]);

  const initializeVolumeControl = async () => {
    try {
      const initialVolume = await AudioOptimizationService.getVolumeStatus();
      setVolumeStatus(initialVolume);

      await HeadphoneDetection.startListening();
      const initialHeadphones = HeadphoneDetection.getCurrentHeadphoneInfo();
      setHeadphoneInfo(initialHeadphones);
    } catch (error) {
      console.error('Failed to initialize volume control:', error);
    }
  };

  const setupListeners = () => {
    // Listen for volume changes
    AudioOptimizationService.setVolumeChangeListener((volume) => {
      setVolumeStatus(volume);
      if (onVolumeChange) {
        onVolumeChange(volume.current);
      }
    });

    // Listen for headphone changes
    const unsubscribeHeadphones = HeadphoneDetection.addListener((info) => {
      setHeadphoneInfo(info);
      showTemporaryIndicator();
    });

    return unsubscribeHeadphones;
  };

  const cleanup = () => {
    HeadphoneDetection.cleanup();
  };

  const showTemporaryIndicator = () => {
    setShowVolumeIndicator(true);
    
    Animated.sequence([
      Animated.timing(indicatorAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(indicatorAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowVolumeIndicator(false);
    });
  };

  const handleVolumeChange = async (newVolume: number) => {
    try {
      await AudioOptimizationService.setVolume(newVolume);
      if (onVolumeChange) {
        onVolumeChange(newVolume);
      }
    } catch (error) {
      console.error('Failed to change volume:', error);
    }
  };

  const handleMuteToggle = async () => {
    try {
      await AudioOptimizationService.toggleMute();
      const newStatus = await AudioOptimizationService.getVolumeStatus();
      setVolumeStatus(newStatus);
      
      if (onMuteToggle) {
        onMuteToggle(newStatus.isMuted);
      }

      // Animate quick action button
      Animated.sequence([
        Animated.timing(quickActionScale, {
          toValue: 0.8,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(quickActionScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      showTemporaryIndicator();
    } catch (error) {
      console.error('Failed to toggle mute:', error);
    }
  };

  const handleVolumeUp = async () => {
    await handleVolumeChange(Math.min(1, volumeStatus.current + 0.1));
    showTemporaryIndicator();
  };

  const handleVolumeDown = async () => {
    await handleVolumeChange(Math.max(0, volumeStatus.current - 0.1));
    showTemporaryIndicator();
  };

  const handlePanGesture = (event: PanGestureHandlerGestureEvent) => {
    const {translationX, translationY, state} = event.nativeEvent;

    if (state === State.BEGAN) {
      setIsDragging(true);
    } else if (state === State.ACTIVE) {
      let newVolume: number;
      
      if (orientation === 'horizontal') {
        const barWidth = getBarWidth();
        const volumeChange = translationX / barWidth;
        newVolume = Math.max(0, Math.min(1, volumeStatus.current + volumeChange));
      } else {
        const barHeight = getBarHeight();
        const volumeChange = -translationY / barHeight; // Invert for vertical
        newVolume = Math.max(0, Math.min(1, volumeStatus.current + volumeChange));
      }

      handleVolumeChange(newVolume);
    } else if (state === State.END) {
      setIsDragging(false);
    }
  };

  const getBarWidth = (): number => {
    switch (size) {
      case 'small': return 100;
      case 'large': return 200;
      default: return 150;
    }
  };

  const getBarHeight = (): number => {
    switch (size) {
      case 'small': return 100;
      case 'large': return 200;
      default: return 150;
    }
  };

  const getVolumeIcon = (): string => {
    if (volumeStatus.isMuted) return '🔇';
    if (volumeStatus.current === 0) return '🔇';
    if (volumeStatus.current < 0.3) return '🔈';
    if (volumeStatus.current < 0.7) return '🔉';
    return '🔊';
  };

  const getHeadphoneIcon = (): string => {
    if (!headphoneInfo.isConnected) return '';
    
    switch (headphoneInfo.type) {
      case 'bluetooth': return '🎧';
      case 'wired': return '🎧';
      case 'usbc': return '🎧';
      case 'lightning': return '🎧';
      default: return '🎧';
    }
  };

  const getVolumeColor = (): string => {
    if (volumeStatus.isMuted) return colors.error;
    if (volumeStatus.current < 0.3) return colors.warning;
    return colors.primary;
  };

  const renderHorizontalVolumeBar = () => (
    <View style={styles.horizontalContainer}>
      <TouchableOpacity
        style={styles.volumeButton}
        onPress={handleMuteToggle}>
        <Text style={[styles.volumeIcon, {color: getVolumeColor()}]}>
          {getVolumeIcon()}
        </Text>
      </TouchableOpacity>

      <View style={styles.volumeBarContainer}>
        <PanGestureHandler onGestureEvent={handlePanGesture}>
          <Animated.View style={[styles.volumeBar, {width: getBarWidth()}]}>
            <View style={[styles.volumeTrack, {backgroundColor: colors.disabled + '40'}]} />
            <Animated.View
              style={[
                styles.volumeFill,
                {
                  backgroundColor: getVolumeColor(),
                  width: volumeAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.volumeThumb,
                {
                  backgroundColor: getVolumeColor(),
                  left: volumeAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, getBarWidth() - 20],
                  }),
                  transform: [{scale: isDragging ? 1.2 : 1}],
                },
              ]}
            />
          </Animated.View>
        </PanGestureHandler>
      </View>

      <Text style={styles.volumeText}>
        {Math.round(volumeStatus.current * 100)}%
      </Text>
    </View>
  );

  const renderVerticalVolumeBar = () => (
    <View style={styles.verticalContainer}>
      <Text style={styles.volumeText}>
        {Math.round(volumeStatus.current * 100)}%
      </Text>

      <View style={styles.volumeBarContainer}>
        <PanGestureHandler onGestureEvent={handlePanGesture}>
          <Animated.View style={[styles.volumeBarVertical, {height: getBarHeight()}]}>
            <View style={[styles.volumeTrackVertical, {backgroundColor: colors.disabled + '40'}]} />
            <Animated.View
              style={[
                styles.volumeFillVertical,
                {
                  backgroundColor: getVolumeColor(),
                  height: volumeAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.volumeThumbVertical,
                {
                  backgroundColor: getVolumeColor(),
                  bottom: volumeAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, getBarHeight() - 20],
                  }),
                  transform: [{scale: isDragging ? 1.2 : 1}],
                },
              ]}
            />
          </Animated.View>
        </PanGestureHandler>
      </View>

      <TouchableOpacity
        style={styles.volumeButton}
        onPress={handleMuteToggle}>
        <Text style={[styles.volumeIcon, {color: getVolumeColor()}]}>
          {getVolumeIcon()}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderQuickActions = () => {
    if (!showQuickActions) return null;

    return (
      <View style={styles.quickActions}>
        <Animated.View style={{transform: [{scale: quickActionScale}]}}>
          <TouchableOpacity
            style={[styles.quickActionButton, styles.volumeDownButton]}
            onPress={handleVolumeDown}
            disabled={volumeStatus.current <= 0}>
            <Text style={styles.quickActionText}>-</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={{transform: [{scale: quickActionScale}]}}>
          <TouchableOpacity
            style={[styles.quickActionButton, styles.muteButton]}
            onPress={handleMuteToggle}>
            <Text style={styles.quickActionText}>
              {volumeStatus.isMuted ? '🔇' : '🔊'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={{transform: [{scale: quickActionScale}]}}>
          <TouchableOpacity
            style={[styles.quickActionButton, styles.volumeUpButton]}
            onPress={handleVolumeUp}
            disabled={volumeStatus.current >= 1}>
            <Text style={styles.quickActionText}>+</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  const renderHeadphoneStatus = () => {
    if (!showHeadphoneStatus) return null;

    return (
      <Animated.View
        style={[
          styles.headphoneStatus,
          {
            opacity: headphoneAnimation,
            transform: [{
              scale: headphoneAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              }),
            }],
          },
        ]}>
        <Text style={styles.headphoneIcon}>
          {getHeadphoneIcon()}
        </Text>
        <Text style={styles.headphoneText}>
          {headphoneInfo.deviceName || headphoneInfo.type}
        </Text>
        {headphoneInfo.batteryLevel && (
          <Text style={styles.batteryText}>
            🔋 {headphoneInfo.batteryLevel}%
          </Text>
        )}
      </Animated.View>
    );
  };

  const renderVolumeIndicator = () => {
    if (!showVolumeIndicator) return null;

    return (
      <Animated.View
        style={[
          styles.volumeIndicator,
          {
            opacity: indicatorAnimation,
            transform: [{
              scale: indicatorAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              }),
            }],
          },
        ]}>
        <Text style={styles.indicatorIcon}>{getVolumeIcon()}</Text>
        <View style={styles.indicatorBar}>
          <View style={[styles.indicatorTrack, {backgroundColor: colors.disabled}]} />
          <View
            style={[
              styles.indicatorFill,
              {
                backgroundColor: getVolumeColor(),
                width: `${volumeStatus.current * 100}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.indicatorText}>
          {Math.round(volumeStatus.current * 100)}%
        </Text>
      </Animated.View>
    );
  };

  const getContainerStyle = () => {
    const baseStyle = [styles.container, style];
    
    switch (size) {
      case 'small':
        return [...baseStyle, styles.containerSmall];
      case 'large':
        return [...baseStyle, styles.containerLarge];
      default:
        return baseStyle;
    }
  };

  const styles = StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    },
    containerSmall: {
      padding: 8,
    },
    containerLarge: {
      padding: 24,
    },
    horizontalContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
    },
    verticalContainer: {
      flexDirection: 'column',
      alignItems: 'center',
      height: '100%',
    },
    volumeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: 8,
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    volumeIcon: {
      fontSize: 18,
    },
    volumeBarContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    volumeBar: {
      height: 6,
      borderRadius: 3,
      position: 'relative',
    },
    volumeBarVertical: {
      width: 6,
      borderRadius: 3,
      position: 'relative',
    },
    volumeTrack: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 3,
    },
    volumeTrackVertical: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 3,
    },
    volumeFill: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      borderRadius: 3,
    },
    volumeFillVertical: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      borderRadius: 3,
    },
    volumeThumb: {
      position: 'absolute',
      top: -7,
      width: 20,
      height: 20,
      borderRadius: 10,
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    volumeThumbVertical: {
      position: 'absolute',
      left: -7,
      width: 20,
      height: 20,
      borderRadius: 10,
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    volumeText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      minWidth: 40,
      textAlign: 'center',
      marginHorizontal: 8,
    },
    quickActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 16,
      gap: 12,
    },
    quickActionButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 1,
    },
    volumeDownButton: {
      backgroundColor: colors.warning + '20',
    },
    muteButton: {
      backgroundColor: colors.error + '20',
    },
    volumeUpButton: {
      backgroundColor: colors.success + '20',
    },
    quickActionText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
    },
    headphoneStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginTop: 8,
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    headphoneIcon: {
      fontSize: 16,
      marginRight: 6,
    },
    headphoneText: {
      fontSize: 12,
      color: colors.text,
      marginRight: 8,
    },
    batteryText: {
      fontSize: 10,
      color: colors.success,
    },
    volumeIndicator: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
      transform: [{translateX: -50}, {translateY: -50}],
    },
    indicatorIcon: {
      fontSize: 20,
      marginRight: 8,
    },
    indicatorBar: {
      width: 60,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.disabled,
      marginRight: 8,
      overflow: 'hidden',
    },
    indicatorTrack: {
      width: '100%',
      height: '100%',
    },
    indicatorFill: {
      position: 'absolute',
      top: 0,
      left: 0,
      height: '100%',
    },
    indicatorText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: colors.text,
      minWidth: 30,
    },
  });

  return (
    <View style={getContainerStyle()}>
      {showVolumeBar && (
        orientation === 'horizontal' ? renderHorizontalVolumeBar() : renderVerticalVolumeBar()
      )}
      {renderQuickActions()}
      {renderHeadphoneStatus()}
      {renderVolumeIndicator()}
    </View>
  );
};

export default VolumeControl;