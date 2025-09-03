// src/components/gestures/LongPressMenu.tsx
// 길게 눌러서 옵션 메뉴 컴포넌트

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  Vibration,
  Platform,
} from 'react-native';
import { useThemedStyles, useColors } from '../../context/ThemeContext';
import { Theme } from '../../theme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface MenuOption {
  id: string;
  title: string;
  icon?: string;
  color?: string;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

interface LongPressMenuProps {
  children: React.ReactNode;
  options: MenuOption[];
  longPressDuration?: number;
  disabled?: boolean;
  hapticFeedback?: boolean;
  onLongPressStart?: () => void;
  onLongPressEnd?: () => void;
  onPress?: () => void;
}

interface MenuPosition {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export const LongPressMenu: React.FC<LongPressMenuProps> = ({
  children,
  options,
  longPressDuration = 500,
  disabled = false,
  hapticFeedback = true,
  onLongPressStart,
  onLongPressEnd,
  onPress,
}) => {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ x: 0, y: 0 });
  const [longPressProgress, setLongPressProgress] = useState(0);
  
  const containerRef = useRef<View>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const menuAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  
  // 메뉴 표시
  const showMenu = useCallback((gestureX: number, gestureY: number) => {
    if (disabled) return;
    
    containerRef.current?.measure((x, y, width, height, pageX, pageY) => {
      // 메뉴 위치 계산 (화면 경계 고려)
      const menuWidth = 200;
      const menuHeight = options.length * 50 + 20;
      
      let menuX = gestureX;
      let menuY = gestureY;
      
      // 화면 오른쪽 경계 체크
      if (menuX + menuWidth > screenWidth) {
        menuX = screenWidth - menuWidth - 20;
      }
      
      // 화면 아래쪽 경계 체크
      if (menuY + menuHeight > screenHeight) {
        menuY = gestureY - menuHeight - 20;
      }
      
      setMenuPosition({ x: menuX, y: menuY, width: menuWidth, height: menuHeight });
      setMenuVisible(true);
      
      // 햅틱 피드백
      if (hapticFeedback) {
        if (Platform.OS === 'ios') {
          Vibration.vibrate();
        } else {
          Vibration.vibrate(50);
        }
      }
      
      // 메뉴 애니메이션
      Animated.parallel([
        Animated.spring(menuAnimation, {
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnimation, {
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();
      
      onLongPressStart?.();
    });
  }, [disabled, options.length, hapticFeedback, onLongPressStart]);

  // 메뉴 숨기기
  const hideMenu = useCallback(() => {
    Animated.parallel([
      Animated.timing(menuAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnimation, {
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMenuVisible(false);
      setLongPressProgress(0);
      progressAnimation.setValue(0);
      onLongPressEnd?.();
    });
  }, [onLongPressEnd]);

  // 길게 누르기 시작
  const startLongPress = useCallback((gestureX: number, gestureY: number) => {
    if (disabled) return;
    
    // 진행률 애니메이션
    Animated.timing(progressAnimation, {
      toValue: 1,
      duration: longPressDuration,
      useNativeDriver: false,
    }).start();
    
    // 스케일 애니메이션
    Animated.timing(scaleAnimation, {
      toValue: 0.95,
      duration: longPressDuration,
      useNativeDriver: true,
    }).start();
    
    // 타이머 설정
    longPressTimer.current = setTimeout(() => {
      showMenu(gestureX, gestureY);
    }, longPressDuration);
  }, [disabled, longPressDuration, showMenu]);

  // 길게 누르기 취소
  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    
    // 애니메이션 초기화
    Animated.parallel([
      Animated.timing(progressAnimation, {
        toValue: 0,
        duration: 100,
        useNativeDriver: false,
      }),
      Animated.spring(scaleAnimation, {
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setLongPressProgress(0);
    });
  }, []);

  // PanResponder 설정
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => false,

    onPanResponderGrant: (evt) => {
      const { pageX, pageY } = evt.nativeEvent;
      startLongPress(pageX, pageY);
    },

    onPanResponderMove: (evt, gestureState) => {
      // 움직임이 너무 크면 취소
      if (Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10) {
        cancelLongPress();
      }
    },

    onPanResponderRelease: () => {
      if (longPressTimer.current) {
        // 길게 누르기가 완료되지 않았으면 일반 터치로 처리
        cancelLongPress();
        onPress?.();
      }
    },

    onPanResponderTerminate: () => {
      cancelLongPress();
    },
  });

  // 진행률 애니메이션 리스너
  useEffect(() => {
    const listener = progressAnimation.addListener(({ value }) => {
      setLongPressProgress(value);
    });

    return () => {
      progressAnimation.removeListener(listener);
    };
  }, []);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  // 메뉴 옵션 선택 처리
  const handleOptionPress = useCallback((option: MenuOption) => {
    hideMenu();
    setTimeout(() => {
      option.onPress();
    }, 100);
  }, [hideMenu]);

  return (
    <>
      <Animated.View
        ref={containerRef}
        style={[{ transform: [{ scale: scaleAnimation }] }]}
        {...panResponder.panHandlers}
      >
        {children}
        
        {/* 길게 누르기 진행률 인디케이터 */}
        {longPressProgress > 0 && (
          <Animated.View
            style={[
              styles.progressOverlay,
              {
                opacity: progressAnimation.interpolate({
                  inputRange: [0, 0.3, 1],
                  outputRange: [0, 1, 1],
                }),
              },
            ]}
          >
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: progressAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </Animated.View>
        )}
      </Animated.View>

      {/* 메뉴 모달 */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        onRequestClose={hideMenu}
      >
        <Pressable style={styles.modalOverlay} onPress={hideMenu}>
          <Animated.View
            style={[
              styles.menuContainer,
              {
                left: menuPosition.x,
                top: menuPosition.y,
                transform: [
                  {
                    scale: menuAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
                opacity: menuAnimation,
              },
            ]}
          >
            {options.map((option, index) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.menuOption,
                  option.disabled && styles.disabledOption,
                  index === options.length - 1 && styles.lastOption,
                ]}
                onPress={() => !option.disabled && handleOptionPress(option)}
                disabled={option.disabled}
              >
                <View style={styles.optionContent}>
                  {option.icon && (
                    <Text
                      style={[
                        styles.optionIcon,
                        option.destructive && styles.destructiveText,
                        option.disabled && styles.disabledText,
                        option.color && { color: option.color },
                      ]}
                    >
                      {option.icon}
                    </Text>
                  )}
                  <Text
                    style={[
                      styles.optionText,
                      option.destructive && styles.destructiveText,
                      option.disabled && styles.disabledText,
                      option.color && { color: option.color },
                    ]}
                  >
                    {option.title}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
};

// 컨텍스트 메뉴 훅
export const useLongPressMenu = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ x: 0, y: 0 });

  const show = useCallback((x: number, y: number) => {
    setPosition({ x, y });
    setIsVisible(true);
  }, []);

  const hide = useCallback(() => {
    setIsVisible(false);
  }, []);

  return {
    isVisible,
    position,
    show,
    hide,
  };
};

// 빠른 액션 버튼 컴포넌트
export const QuickActionButton: React.FC<{
  title: string;
  icon: string;
  onPress: () => void;
  color?: string;
  size?: 'small' | 'medium' | 'large';
}> = ({ title, icon, onPress, color, size = 'medium' }) => {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  
  const sizeStyles = {
    small: { width: 60, height: 60, fontSize: 16 },
    medium: { width: 80, height: 80, fontSize: 20 },
    large: { width: 100, height: 100, fontSize: 24 },
  };

  return (
    <TouchableOpacity
      style={[styles.quickActionButton, { 
        width: sizeStyles[size].width,
        height: sizeStyles[size].height,
      }]}
      onPress={onPress}
    >
      <Text style={[
        styles.quickActionIcon,
        { fontSize: sizeStyles[size].fontSize, color: color || colors.primary }
      ]}>
        {icon}
      </Text>
      <Text style={[styles.quickActionText, { color: color || colors.text }]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme) => ({
  progressOverlay: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: theme.colors.surface,
    borderRadius: 1.5,
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 1.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  menuContainer: {
    position: 'absolute' as const,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    minWidth: 200,
    maxWidth: 280,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  menuOption: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  lastOption: {
    borderBottomWidth: 0,
  },
  disabledOption: {
    opacity: 0.5,
  },
  optionContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  optionIcon: {
    fontSize: 18,
    marginRight: theme.spacing.sm,
    color: theme.colors.text,
  },
  optionText: {
    ...theme.typography.body1,
    color: theme.colors.text,
    flex: 1,
  },
  destructiveText: {
    color: theme.colors.error,
  },
  disabledText: {
    color: theme.colors.textDisabled,
  },
  quickActionButton: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.md,
    marginHorizontal: theme.spacing.xs,
    marginVertical: theme.spacing.xs,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionIcon: {
    marginBottom: theme.spacing.xs,
  },
  quickActionText: {
    ...theme.typography.caption,
    textAlign: 'center' as const,
  },
});

export default LongPressMenu;