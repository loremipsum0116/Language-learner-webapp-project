import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  Animated,
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  State,
  Dimensions,
  StyleSheet,
} from 'react-native';
import {useTheme} from '../context/ThemeContext';
import VocabCard from './VocabCard';
import { useHapticFeedback, HapticType } from '../services/HapticFeedbackService';

const {width: screenWidth, height: screenHeight} = Dimensions.get('window');

export interface SwipeAction {
  direction: 'left' | 'right' | 'up' | 'down';
  label: string;
  color: string;
  icon: string;
  action: () => void;
}

interface SwipeableVocabCardProps {
  vocab: any;
  card?: any;
  swipeActions?: SwipeAction[];
  onSwipe?: (direction: 'left' | 'right' | 'up' | 'down', vocab: any) => void;
  onFlip?: () => void;
  isFlipped?: boolean;
  showSwipeHints?: boolean;
  enableSwipeToNext?: boolean;
  enableSwipeToPrevious?: boolean;
  enableSwipeToKnown?: boolean;
  enableSwipeToUnknown?: boolean;
  style?: any;
}

export const SwipeableVocabCard: React.FC<SwipeableVocabCardProps> = ({
  vocab,
  card,
  swipeActions = [],
  onSwipe,
  onFlip,
  isFlipped = false,
  showSwipeHints = true,
  enableSwipeToNext = true,
  enableSwipeToPrevious = true,
  enableSwipeToKnown = true,
  enableSwipeToUnknown = true,
  style,
}) => {
  const {colors} = useTheme();
  const { cardSwipe, correctAnswer, wrongAnswer } = useHapticFeedback();
  const [isSwipeHintVisible, setIsSwipeHintVisible] = useState(false);
  
  // 애니메이션 값들
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const rotateZ = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  // 스와이프 힌트 애니메이션
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const hintScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // 카드가 처음 나타날 때 스와이프 힌트 표시
    if (showSwipeHints) {
      showSwipeHint();
    }
  }, [vocab.id]);

  const showSwipeHint = () => {
    setIsSwipeHintVisible(true);
    
    Animated.parallel([
      Animated.timing(hintOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(hintScale, {
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();

    // 3초 후 자동으로 숨김
    setTimeout(() => {
      hideSwipeHint();
    }, 3000);
  };

  const hideSwipeHint = () => {
    Animated.parallel([
      Animated.timing(hintOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(hintScale, {
        toValue: 0.8,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsSwipeHintVisible(false);
    });
  };

  // 기본 스와이프 액션 정의
  const getDefaultSwipeActions = (): SwipeAction[] => {
    const actions: SwipeAction[] = [];

    if (enableSwipeToNext) {
      actions.push({
        direction: 'right',
        label: '다음 카드',
        color: colors.primary,
        icon: '→',
        action: () => onSwipe?.('right', vocab),
      });
    }

    if (enableSwipeToPrevious) {
      actions.push({
        direction: 'left',
        label: '이전 카드',
        color: colors.secondary,
        icon: '←',
        action: () => onSwipe?.('left', vocab),
      });
    }

    if (enableSwipeToKnown) {
      actions.push({
        direction: 'up',
        label: '알고 있음',
        color: colors.success,
        icon: '✓',
        action: () => onSwipe?.('up', vocab),
      });
    }

    if (enableSwipeToUnknown) {
      actions.push({
        direction: 'down',
        label: '모르겠음',
        color: colors.error,
        icon: '✗',
        action: () => onSwipe?.('down', vocab),
      });
    }

    return actions;
  };

  const allSwipeActions = [...getDefaultSwipeActions(), ...swipeActions];

  const onGestureEvent = Animated.event(
    [
      {
        nativeEvent: {
          translationX: translateX,
          translationY: translateY,
        },
      },
    ],
    {useNativeDriver: true}
  );

  const onHandlerStateChange = (event: PanGestureHandlerGestureEvent) => {
    if (event.nativeEvent.state === State.BEGAN) {
      // 제스처 시작 시 힌트 숨김
      if (isSwipeHintVisible) {
        hideSwipeHint();
      }
    }

    if (event.nativeEvent.state === State.END) {
      const {translationX: dx, translationY: dy, velocityX, velocityY} = event.nativeEvent;
      
      // 스와이프 임계값 설정
      const swipeThreshold = screenWidth * 0.25;
      const velocityThreshold = 1000;

      let swipeDirection: 'left' | 'right' | 'up' | 'down' | null = null;

      // 수평 스와이프 감지
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > swipeThreshold || velocityX > velocityThreshold) {
          swipeDirection = 'right';
        } else if (dx < -swipeThreshold || velocityX < -velocityThreshold) {
          swipeDirection = 'left';
        }
      } 
      // 수직 스와이프 감지
      else {
        if (dy < -swipeThreshold || velocityY < -velocityThreshold) {
          swipeDirection = 'up';
        } else if (dy > swipeThreshold || velocityY > velocityThreshold) {
          swipeDirection = 'down';
        }
      }

      if (swipeDirection) {
        // 스와이프 애니메이션 실행
        executeSwipeAnimation(swipeDirection, dx, dy);
      } else {
        // 원래 위치로 되돌리기
        resetCardPosition();
      }
    }
  };

  const executeSwipeAnimation = (direction: 'left' | 'right' | 'up' | 'down', dx: number, dy: number) => {
    let endX = 0, endY = 0, rotation = 0;

    // 햅틱 피드백 실행
    switch (direction) {
      case 'right':
        endX = screenWidth + 100;
        rotation = 15;
        cardSwipe(); // 기본 스와이프 피드백
        break;
      case 'left':
        endX = -screenWidth - 100;
        rotation = -15;
        cardSwipe(); // 기본 스와이프 피드백
        break;
      case 'up':
        endY = -screenHeight - 100;
        correctAnswer(); // 알고 있음 = 정답
        break;
      case 'down':
        endY = screenHeight + 100;
        wrongAnswer(); // 모름 = 오답
        break;
    }

    // 카드를 화면 밖으로 애니메이션
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: endX,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: endY,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(rotateZ, {
        toValue: rotation,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // 애니메이션 완료 후 해당 액션 실행
      const action = allSwipeActions.find(a => a.direction === direction);
      if (action) {
        action.action();
      } else {
        onSwipe?.(direction, vocab);
      }

      // 카드 위치 리셋 (새 카드를 위해)
      translateX.setValue(0);
      translateY.setValue(0);
      rotateZ.setValue(0);
      opacity.setValue(1);
    });
  };

  const resetCardPosition = () => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.spring(rotateZ, {
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // 스와이프 방향에 따른 배경색 계산
  const getSwipeBackgroundColor = () => {
    return translateX.interpolate({
      inputRange: [-screenWidth, 0, screenWidth],
      outputRange: [colors.secondary + '20', 'transparent', colors.primary + '20'],
      extrapolate: 'clamp',
    });
  };

  // 스와이프 인디케이터 렌더링
  const renderSwipeIndicator = (direction: 'left' | 'right' | 'up' | 'down') => {
    const action = allSwipeActions.find(a => a.direction === direction);
    if (!action) return null;

    let style, textStyle;
    switch (direction) {
      case 'left':
        style = styles.leftIndicator;
        textStyle = {
          opacity: translateX.interpolate({
            inputRange: [-100, 0],
            outputRange: [1, 0],
            extrapolate: 'clamp',
          }),
        };
        break;
      case 'right':
        style = styles.rightIndicator;
        textStyle = {
          opacity: translateX.interpolate({
            inputRange: [0, 100],
            outputRange: [0, 1],
            extrapolate: 'clamp',
          }),
        };
        break;
      case 'up':
        style = styles.upIndicator;
        textStyle = {
          opacity: translateY.interpolate({
            inputRange: [-100, 0],
            outputRange: [1, 0],
            extrapolate: 'clamp',
          }),
        };
        break;
      case 'down':
        style = styles.downIndicator;
        textStyle = {
          opacity: translateY.interpolate({
            inputRange: [0, 100],
            outputRange: [0, 1],
            extrapolate: 'clamp',
          }),
        };
        break;
    }

    return (
      <Animated.View style={[style, textStyle]}>
        <View style={[styles.indicator, {backgroundColor: action.color}]}>
          <Text style={styles.indicatorIcon}>{action.icon}</Text>
          <Text style={styles.indicatorLabel}>{action.label}</Text>
        </View>
      </Animated.View>
    );
  };

  // 스와이프 힌트 렌더링
  const renderSwipeHints = () => {
    if (!isSwipeHintVisible || !showSwipeHints) return null;

    return (
      <Animated.View 
        style={[
          styles.hintsContainer, 
          {
            opacity: hintOpacity,
            transform: [{scale: hintScale}]
          }
        ]}
        pointerEvents="none"
      >
        {allSwipeActions.map((action, index) => {
          let hintStyle;
          switch (action.direction) {
            case 'left':
              hintStyle = styles.leftHint;
              break;
            case 'right':
              hintStyle = styles.rightHint;
              break;
            case 'up':
              hintStyle = styles.upHint;
              break;
            case 'down':
              hintStyle = styles.downHint;
              break;
          }

          return (
            <View key={index} style={[styles.hint, hintStyle, {backgroundColor: action.color}]}>
              <Text style={styles.hintIcon}>{action.icon}</Text>
              <Text style={styles.hintLabel}>{action.label}</Text>
            </View>
          );
        })}
      </Animated.View>
    );
  };

  const cardTransform = [
    {
      translateX: translateX,
    },
    {
      translateY: translateY,
    },
    {
      rotateZ: rotateZ.interpolate({
        inputRange: [-1, 1],
        outputRange: ['-1deg', '1deg'],
      }),
    },
    {
      scale: scale,
    },
  ];

  return (
    <View style={[styles.container, style]}>
      {/* 스와이프 인디케이터들 */}
      {renderSwipeIndicator('left')}
      {renderSwipeIndicator('right')}
      {renderSwipeIndicator('up')}
      {renderSwipeIndicator('down')}

      {/* 메인 카드 */}
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <Animated.View
          style={[
            styles.cardWrapper,
            {
              transform: cardTransform,
              opacity: opacity,
              backgroundColor: getSwipeBackgroundColor(),
            },
          ]}
        >
          <VocabCard
            vocab={vocab}
            card={card}
            onPress={onFlip}
            style={styles.card}
          />
          
          {/* 카드 뒷면 (뒤집혔을 때) */}
          {isFlipped && (
            <View style={styles.cardBack}>
              <Text style={styles.backTitle}>의미</Text>
              <Text style={styles.backContent}>
                {vocab.dictMeta?.gloss || vocab.gloss || '의미를 불러오는 중...'}
              </Text>
              
              {vocab.dictMeta?.example && (
                <View style={styles.exampleContainer}>
                  <Text style={styles.exampleTitle}>예문</Text>
                  <Text style={styles.exampleText}>{vocab.dictMeta.example}</Text>
                </View>
              )}
            </View>
          )}
        </Animated.View>
      </PanGestureHandler>

      {/* 스와이프 힌트 */}
      {renderSwipeHints()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cardWrapper: {
    width: screenWidth - 40,
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  card: {
    margin: 0,
    borderRadius: 16,
  },
  cardBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    justifyContent: 'center',
  },
  backTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  backContent: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 20,
  },
  exampleContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
  },
  exampleTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  // 스와이프 인디케이터 스타일
  leftIndicator: {
    position: 'absolute',
    left: 20,
    top: '50%',
    marginTop: -30,
  },
  rightIndicator: {
    position: 'absolute',
    right: 20,
    top: '50%',
    marginTop: -30,
  },
  upIndicator: {
    position: 'absolute',
    top: 40,
    left: '50%',
    marginLeft: -50,
  },
  downIndicator: {
    position: 'absolute',
    bottom: 40,
    left: '50%',
    marginLeft: -50,
  },
  indicator: {
    padding: 12,
    borderRadius: 30,
    alignItems: 'center',
    minWidth: 100,
  },
  indicatorIcon: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 4,
  },
  indicatorLabel: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  // 스와이프 힌트 스타일
  hintsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  hint: {
    position: 'absolute',
    padding: 8,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 80,
  },
  leftHint: {
    left: -10,
    top: '50%',
    marginTop: -20,
  },
  rightHint: {
    right: -10,
    top: '50%',
    marginTop: -20,
  },
  upHint: {
    top: -10,
    left: '50%',
    marginLeft: -40,
  },
  downHint: {
    bottom: -10,
    left: '50%',
    marginLeft: -40,
  },
  hintIcon: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 2,
  },
  hintLabel: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default SwipeableVocabCard;