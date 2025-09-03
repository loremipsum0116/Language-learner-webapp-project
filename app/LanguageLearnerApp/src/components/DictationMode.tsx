import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {useTheme} from '../context/ThemeContext';
import VoiceRecognitionService, {
  RecognitionResult,
  RecognitionError,
  RecognitionProgress,
} from '../services/VoiceRecognitionService';

interface DictationModeProps {
  targetText: string;
  targetLanguage: string;
  onComplete?: (result: DictationResult) => void;
  showRealTimeProgress?: boolean;
  timeout?: number;
}

export interface DictationResult {
  transcription: string;
  accuracy: number;
  errors: string[];
  completionTime: number;
  attempts: number;
}

export const DictationMode: React.FC<DictationModeProps> = ({
  targetText,
  targetLanguage,
  onComplete,
  showRealTimeProgress = true,
  timeout = 30000,
}) => {
  const {colors} = useTheme();
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [partialTranscription, setPartialTranscription] = useState('');
  const [accuracy, setAccuracy] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [volume, setVolume] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  const microphoneScale = useRef(new Animated.Value(1)).current;
  const accuracyAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return () => {
      VoiceRecognitionService.cleanup();
    };
  }, []);

  useEffect(() => {
    if (isListening && volume > 0) {
      Animated.sequence([
        Animated.timing(microphoneScale, {
          toValue: 1 + (volume * 0.3),
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(microphoneScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [volume, isListening]);

  useEffect(() => {
    Animated.timing(accuracyAnimation, {
      toValue: accuracy / 100,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [accuracy]);

  const startDictation = async () => {
    if (isListening) return;

    try {
      setIsLoading(true);
      const hasPermission = await VoiceRecognitionService.requestPermissions();
      if (!hasPermission) {
        Alert.alert('권한 필요', '음성 인식을 위해 마이크 권한이 필요합니다.');
        return;
      }

      setIsListening(true);
      setCurrentTranscription('');
      setPartialTranscription('');
      setErrors([]);
      setAccuracy(0);
      setAttempts(prev => prev + 1);
      setIsCompleted(false);

      await VoiceRecognitionService.startListening(
        getLanguageCode(targetLanguage),
        {
          onResult: handleRecognitionResult,
          onError: handleRecognitionError,
          onProgress: handleRecognitionProgress,
          onSpeechStart: handleSpeechStart,
          onSpeechEnd: handleSpeechEnd,
          continuous: false,
          partialResults: true,
        }
      );

    } catch (error) {
      console.error('Failed to start dictation:', error);
      Alert.alert('오류', '음성 인식을 시작할 수 없습니다.');
      setIsListening(false);
    } finally {
      setIsLoading(false);
    }
  };

  const stopDictation = async () => {
    if (!isListening) return;

    try {
      await VoiceRecognitionService.stopListening();
    } catch (error) {
      console.error('Failed to stop dictation:', error);
    }
  };

  const handleSpeechStart = () => {
    console.log('Speech started');
  };

  const handleSpeechEnd = () => {
    setIsListening(false);
    setPartialTranscription('');
  };

  const handleRecognitionResult = (result: RecognitionResult) => {
    setCurrentTranscription(result.transcription);
    setPartialTranscription('');
    
    const calculatedAccuracy = calculateAccuracy(targetText, result.transcription);
    const detectedErrors = detectErrors(targetText, result.transcription);
    
    setAccuracy(calculatedAccuracy);
    setErrors(detectedErrors);
    setIsCompleted(true);

    if (onComplete) {
      onComplete({
        transcription: result.transcription,
        accuracy: calculatedAccuracy,
        errors: detectedErrors,
        completionTime: 0, // This would be calculated properly in a real implementation
        attempts,
      });
    }
  };

  const handleRecognitionError = (error: RecognitionError) => {
    setIsListening(false);
    setPartialTranscription('');
    
    Alert.alert('음성 인식 오류', error.message);
  };

  const handleRecognitionProgress = (progress: RecognitionProgress) => {
    if (progress.partialResults.length > 0) {
      setPartialTranscription(progress.partialResults[0]);
    }
    
    if (progress.volume !== undefined) {
      setVolume(progress.volume);
    }
  };

  const calculateAccuracy = (target: string, transcription: string): number => {
    if (!target || !transcription) return 0;

    const targetWords = target.toLowerCase().trim().split(/\s+/);
    const transcribedWords = transcription.toLowerCase().trim().split(/\s+/);

    const maxLength = Math.max(targetWords.length, transcribedWords.length);
    if (maxLength === 0) return 100;

    let matches = 0;
    const minLength = Math.min(targetWords.length, transcribedWords.length);

    for (let i = 0; i < minLength; i++) {
      if (targetWords[i] === transcribedWords[i]) {
        matches++;
      }
    }

    return Math.round((matches / maxLength) * 100);
  };

  const detectErrors = (target: string, transcription: string): string[] => {
    const errors: string[] = [];
    const targetWords = target.toLowerCase().trim().split(/\s+/);
    const transcribedWords = transcription.toLowerCase().trim().split(/\s+/);

    if (transcribedWords.length > targetWords.length) {
      errors.push('추가된 단어가 있습니다');
    } else if (transcribedWords.length < targetWords.length) {
      errors.push('누락된 단어가 있습니다');
    }

    const minLength = Math.min(targetWords.length, transcribedWords.length);
    for (let i = 0; i < minLength; i++) {
      if (targetWords[i] !== transcribedWords[i]) {
        errors.push(`"${targetWords[i]}" → "${transcribedWords[i]}"`);
      }
    }

    return errors;
  };

  const getLanguageCode = (language: string): string => {
    const languageCodes: { [key: string]: string } = {
      'korean': 'ko-KR',
      'english': 'en-US',
      'japanese': 'ja-JP',
      'chinese': 'zh-CN',
    };
    return languageCodes[language] || 'ko-KR';
  };

  const getLanguageFlag = (language: string): string => {
    const flags = {
      korean: '🇰🇷',
      english: '🇺🇸',
      japanese: '🇯🇵',
      chinese: '🇨🇳',
    };
    return flags[language as keyof typeof flags] || '🎯';
  };

  const getAccuracyColor = (accuracy: number): string => {
    if (accuracy >= 90) return colors.success;
    if (accuracy >= 70) return colors.warning;
    return colors.error;
  };

  const getAccuracyMessage = (accuracy: number): string => {
    if (accuracy >= 95) return '완벽합니다! 🎉';
    if (accuracy >= 85) return '훌륭해요! 👏';
    if (accuracy >= 70) return '좋아요! 👍';
    if (accuracy >= 50) return '조금 더 연습해보세요 📚';
    return '다시 한번 시도해보세요 💪';
  };

  const renderTranscriptionComparison = () => {
    if (!currentTranscription) return null;

    const targetWords = targetText.split(' ');
    const transcribedWords = currentTranscription.split(' ');
    const maxLength = Math.max(targetWords.length, transcribedWords.length);

    return (
      <View style={styles.comparisonContainer}>
        <Text style={styles.comparisonTitle}>비교 결과</Text>
        
        <View style={styles.comparisonRow}>
          <Text style={styles.comparisonLabel}>원문:</Text>
          <View style={styles.wordsContainer}>
            {targetWords.map((word, index) => (
              <Text
                key={index}
                style={[
                  styles.word,
                  styles.targetWord,
                  transcribedWords[index] === word && styles.correctWord,
                ]}>
                {word}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.comparisonRow}>
          <Text style={styles.comparisonLabel}>인식:</Text>
          <View style={styles.wordsContainer}>
            {transcribedWords.map((word, index) => (
              <Text
                key={index}
                style={[
                  styles.word,
                  styles.transcribedWord,
                  targetWords[index] === word ? styles.correctWord : styles.incorrectWord,
                ]}>
                {word}
              </Text>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      margin: 16,
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 5,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    languageFlag: {
      fontSize: 24,
      marginRight: 12,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    attemptsText: {
      fontSize: 14,
      color: colors.secondaryText,
    },
    targetTextContainer: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    targetText: {
      fontSize: 16,
      lineHeight: 24,
      color: colors.text,
      textAlign: 'center',
    },
    controlsContainer: {
      alignItems: 'center',
      marginBottom: 20,
    },
    microphoneButton: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    microphoneButtonListening: {
      backgroundColor: colors.error,
    },
    microphoneButtonNormal: {
      backgroundColor: colors.primary,
    },
    microphoneButtonDisabled: {
      backgroundColor: colors.disabled,
    },
    microphoneIcon: {
      fontSize: 32,
    },
    statusText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    partialText: {
      fontSize: 14,
      color: colors.secondaryText,
      textAlign: 'center',
      minHeight: 20,
      fontStyle: 'italic',
    },
    transcriptionContainer: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      minHeight: 60,
    },
    transcriptionText: {
      fontSize: 16,
      color: colors.text,
      textAlign: 'center',
      lineHeight: 24,
    },
    accuracyContainer: {
      marginBottom: 16,
    },
    accuracyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    accuracyLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    accuracyValue: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    accuracyBar: {
      height: 8,
      backgroundColor: colors.disabled,
      borderRadius: 4,
      overflow: 'hidden',
    },
    accuracyFill: {
      height: '100%',
      borderRadius: 4,
    },
    accuracyMessage: {
      fontSize: 14,
      textAlign: 'center',
      marginTop: 8,
      fontWeight: '500',
    },
    errorsContainer: {
      backgroundColor: colors.error + '10',
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
    },
    errorsTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.error,
      marginBottom: 8,
    },
    errorItem: {
      fontSize: 13,
      color: colors.text,
      marginBottom: 4,
    },
    comparisonContainer: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    comparisonTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    comparisonRow: {
      marginBottom: 12,
    },
    comparisonLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.secondaryText,
      marginBottom: 4,
    },
    wordsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    word: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      fontSize: 14,
      margin: 2,
    },
    targetWord: {
      backgroundColor: colors.secondary + '30',
      color: colors.text,
    },
    transcribedWord: {
      backgroundColor: colors.info + '30',
      color: colors.text,
    },
    correctWord: {
      backgroundColor: colors.success + '30',
      color: colors.success,
      fontWeight: '600',
    },
    incorrectWord: {
      backgroundColor: colors.error + '30',
      color: colors.error,
      fontWeight: '600',
    },
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    actionButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignItems: 'center',
    },
    retryButton: {
      backgroundColor: colors.warning,
    },
    clearButton: {
      backgroundColor: colors.secondary,
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.onPrimary,
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    loadingText: {
      marginLeft: 8,
      fontSize: 14,
      color: colors.secondaryText,
    },
  });

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.languageFlag}>
          {getLanguageFlag(targetLanguage)}
        </Text>
        <Text style={styles.title}>받아쓰기 모드</Text>
        <Text style={styles.attemptsText}>
          시도: {attempts}회
        </Text>
      </View>

      <View style={styles.targetTextContainer}>
        <Text style={styles.targetText}>{targetText}</Text>
      </View>

      <View style={styles.controlsContainer}>
        <Animated.View style={{transform: [{scale: microphoneScale}]}}>
          <TouchableOpacity
            style={[
              styles.microphoneButton,
              isListening
                ? styles.microphoneButtonListening
                : isLoading
                ? styles.microphoneButtonDisabled
                : styles.microphoneButtonNormal,
            ]}
            onPress={isListening ? stopDictation : startDictation}
            disabled={isLoading}>
            <Text style={styles.microphoneIcon}>
              {isLoading ? '⏳' : isListening ? '⏹️' : '🎤'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.statusText}>
          {isLoading
            ? '준비 중...'
            : isListening
            ? '듣고 있습니다...'
            : isCompleted
            ? '완료!'
            : '마이크를 눌러서 시작하세요'}
        </Text>

        {showRealTimeProgress && (
          <Text style={styles.partialText}>
            {partialTranscription || ' '}
          </Text>
        )}

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>음성 인식 준비 중...</Text>
          </View>
        )}
      </View>

      {currentTranscription && (
        <View style={styles.transcriptionContainer}>
          <Text style={styles.transcriptionText}>
            "{currentTranscription}"
          </Text>
        </View>
      )}

      {isCompleted && (
        <View style={styles.accuracyContainer}>
          <View style={styles.accuracyHeader}>
            <Text style={styles.accuracyLabel}>정확도</Text>
            <Text
              style={[
                styles.accuracyValue,
                {color: getAccuracyColor(accuracy)},
              ]}>
              {accuracy}%
            </Text>
          </View>
          
          <View style={styles.accuracyBar}>
            <Animated.View
              style={[
                styles.accuracyFill,
                {
                  backgroundColor: getAccuracyColor(accuracy),
                  width: accuracyAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
          
          <Text
            style={[
              styles.accuracyMessage,
              {color: getAccuracyColor(accuracy)},
            ]}>
            {getAccuracyMessage(accuracy)}
          </Text>
        </View>
      )}

      {errors.length > 0 && (
        <View style={styles.errorsContainer}>
          <Text style={styles.errorsTitle}>개선점</Text>
          {errors.map((error, index) => (
            <Text key={index} style={styles.errorItem}>
              • {error}
            </Text>
          ))}
        </View>
      )}

      {renderTranscriptionComparison()}

      {currentTranscription && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.retryButton]}
            onPress={() => {
              setCurrentTranscription('');
              setPartialTranscription('');
              setAccuracy(0);
              setErrors([]);
              setIsCompleted(false);
              startDictation();
            }}>
            <Text style={styles.actionButtonText}>다시 시도</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.clearButton]}
            onPress={() => {
              setCurrentTranscription('');
              setPartialTranscription('');
              setAccuracy(0);
              setErrors([]);
              setIsCompleted(false);
              setAttempts(0);
            }}>
            <Text style={styles.actionButtonText}>초기화</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

export default DictationMode;