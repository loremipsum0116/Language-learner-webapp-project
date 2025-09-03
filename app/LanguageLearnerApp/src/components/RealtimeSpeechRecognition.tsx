import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  ScrollView,
  Switch,
} from 'react-native';
import {useTheme} from '../context/ThemeContext';
import VoiceRecognitionService, {
  RecognitionResult,
  RecognitionError,
  RecognitionProgress,
} from '../services/VoiceRecognitionService';

interface RealtimeSpeechRecognitionProps {
  targetLanguage: string;
  onTranscription?: (text: string, confidence: number) => void;
  onComplete?: (finalText: string) => void;
  showConfidence?: boolean;
  autoStop?: boolean;
  maxDuration?: number;
}

export const RealtimeSpeechRecognition: React.FC<RealtimeSpeechRecognitionProps> = ({
  targetLanguage,
  onTranscription,
  onComplete,
  showConfidence = true,
  autoStop = false,
  maxDuration = 60000, // 1 minute default
}) => {
  const {colors} = useTheme();
  const [isListening, setIsListening] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [partialText, setPartialText] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [volume, setVolume] = useState(0);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [transcriptionHistory, setTranscriptionHistory] = useState<
    Array<{text: string; timestamp: number; confidence: number}>
  >([]);
  const [continuousMode, setContinuousMode] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const microphoneAnimation = useRef(new Animated.Value(1)).current;
  const confidenceAnimation = useRef(new Animated.Value(0)).current;
  const sessionTimer = useRef<NodeJS.Timeout | null>(null);
  const durationTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (isActive) {
      startSessionTimer();
    } else {
      stopSessionTimer();
    }
  }, [isActive]);

  useEffect(() => {
    if (isListening && volume > 0) {
      Animated.sequence([
        Animated.timing(microphoneAnimation, {
          toValue: 1 + (volume * 0.5),
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(microphoneAnimation, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [volume, isListening]);

  useEffect(() => {
    Animated.timing(confidenceAnimation, {
      toValue: confidence / 100,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [confidence]);

  const startSessionTimer = () => {
    durationTimer.current = setInterval(() => {
      setSessionDuration(prev => prev + 1000);
    }, 1000);

    if (autoStop && maxDuration > 0) {
      sessionTimer.current = setTimeout(() => {
        stopSession();
      }, maxDuration);
    }
  };

  const stopSessionTimer = () => {
    if (durationTimer.current) {
      clearInterval(durationTimer.current);
      durationTimer.current = null;
    }
    if (sessionTimer.current) {
      clearTimeout(sessionTimer.current);
      sessionTimer.current = null;
    }
  };

  const startSession = async () => {
    try {
      const hasPermission = await VoiceRecognitionService.requestPermissions();
      if (!hasPermission) {
        Alert.alert('권한 필요', '음성 인식을 위해 마이크 권한이 필요합니다.');
        return;
      }

      setIsActive(true);
      setSessionDuration(0);
      setTranscriptionHistory([]);
      setCurrentText('');
      setWordCount(0);
      startListening();

    } catch (error) {
      console.error('Failed to start session:', error);
      Alert.alert('오류', '음성 인식 세션을 시작할 수 없습니다.');
    }
  };

  const stopSession = async () => {
    setIsActive(false);
    await stopListening();
    
    if (onComplete && currentText) {
      onComplete(currentText);
    }
  };

  const startListening = async () => {
    if (isListening) return;

    try {
      setIsListening(true);
      setIsProcessing(true);

      await VoiceRecognitionService.startListening(
        getLanguageCode(targetLanguage),
        {
          onResult: handleRecognitionResult,
          onError: handleRecognitionError,
          onProgress: handleRecognitionProgress,
          onSpeechStart: handleSpeechStart,
          onSpeechEnd: handleSpeechEnd,
          continuous: continuousMode,
          partialResults: true,
        }
      );
    } catch (error) {
      console.error('Failed to start listening:', error);
      setIsListening(false);
      setIsProcessing(false);
    }
  };

  const stopListening = async () => {
    if (!isListening) return;

    try {
      await VoiceRecognitionService.stopListening();
      setIsListening(false);
      setPartialText('');
      setVolume(0);
    } catch (error) {
      console.error('Failed to stop listening:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSpeechStart = () => {
    setIsProcessing(false);
  };

  const handleSpeechEnd = () => {
    setIsListening(false);
    setPartialText('');
    
    if (isActive && continuousMode) {
      // Automatically restart listening in continuous mode
      setTimeout(() => {
        if (isActive) {
          startListening();
        }
      }, 500);
    }
  };

  const handleRecognitionResult = (result: RecognitionResult) => {
    const newText = result.transcription.trim();
    if (newText) {
      const timestamp = Date.now();
      
      // Add to history
      setTranscriptionHistory(prev => [
        ...prev,
        {text: newText, timestamp, confidence: result.confidence},
      ]);

      // Update current text
      const updatedText = currentText + (currentText ? ' ' : '') + newText;
      setCurrentText(updatedText);
      setConfidence(result.confidence * 100);
      setWordCount(updatedText.split(/\s+/).filter(word => word.length > 0).length);

      if (onTranscription) {
        onTranscription(updatedText, result.confidence);
      }
    }
    
    setPartialText('');
  };

  const handleRecognitionError = (error: RecognitionError) => {
    console.error('Recognition error:', error);
    setIsListening(false);
    setIsProcessing(false);
    
    if (isActive && continuousMode) {
      // Try to restart in continuous mode
      setTimeout(() => {
        if (isActive) {
          startListening();
        }
      }, 1000);
    }
  };

  const handleRecognitionProgress = (progress: RecognitionProgress) => {
    if (progress.partialResults.length > 0) {
      setPartialText(progress.partialResults[0]);
    }
    
    if (progress.volume !== undefined) {
      setVolume(progress.volume);
    }
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
    return flags[language as keyof typeof flags] || '🌍';
  };

  const formatDuration = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 80) return colors.success;
    if (confidence >= 60) return colors.warning;
    return colors.error;
  };

  const clearTranscription = () => {
    setCurrentText('');
    setPartialText('');
    setTranscriptionHistory([]);
    setWordCount(0);
    setConfidence(0);
  };

  const cleanup = () => {
    stopSessionTimer();
    VoiceRecognitionService.cleanup();
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
    sessionInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
    },
    sessionStat: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.primary,
    },
    statLabel: {
      fontSize: 12,
      color: colors.secondaryText,
      marginTop: 2,
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
    microphoneButtonActive: {
      backgroundColor: colors.error,
    },
    microphoneButtonInactive: {
      backgroundColor: colors.primary,
    },
    microphoneIcon: {
      fontSize: 32,
    },
    statusContainer: {
      alignItems: 'center',
      marginBottom: 12,
    },
    statusText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
      textAlign: 'center',
    },
    processingText: {
      fontSize: 12,
      color: colors.secondaryText,
      marginTop: 4,
    },
    partialTextContainer: {
      minHeight: 24,
      justifyContent: 'center',
    },
    partialText: {
      fontSize: 14,
      color: colors.secondaryText,
      textAlign: 'center',
      fontStyle: 'italic',
    },
    confidenceContainer: {
      marginBottom: 16,
    },
    confidenceHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    confidenceLabel: {
      fontSize: 12,
      color: colors.secondaryText,
    },
    confidenceValue: {
      fontSize: 12,
      fontWeight: 'bold',
    },
    confidenceBar: {
      height: 4,
      backgroundColor: colors.disabled,
      borderRadius: 2,
      overflow: 'hidden',
    },
    confidenceFill: {
      height: '100%',
      borderRadius: 2,
    },
    transcriptionContainer: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      minHeight: 120,
      maxHeight: 200,
    },
    transcriptionText: {
      fontSize: 16,
      color: colors.text,
      lineHeight: 24,
    },
    transcriptionPlaceholder: {
      fontSize: 14,
      color: colors.secondaryText,
      textAlign: 'center',
      fontStyle: 'italic',
      marginTop: 40,
    },
    optionsContainer: {
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
    },
    optionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    optionLabel: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
    optionDescription: {
      fontSize: 12,
      color: colors.secondaryText,
      marginTop: 2,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    actionButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignItems: 'center',
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    secondaryButton: {
      backgroundColor: colors.secondary,
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.onPrimary,
    },
    historyContainer: {
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      maxHeight: 150,
    },
    historyTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    historyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.disabled + '30',
    },
    historyText: {
      flex: 1,
      fontSize: 12,
      color: colors.text,
    },
    historyConfidence: {
      fontSize: 10,
      fontWeight: 'bold',
      marginLeft: 8,
      minWidth: 30,
    },
  });

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.languageFlag}>
          {getLanguageFlag(targetLanguage)}
        </Text>
        <Text style={styles.title}>실시간 음성 인식</Text>
      </View>

      <View style={styles.sessionInfo}>
        <View style={styles.sessionStat}>
          <Text style={styles.statValue}>{formatDuration(sessionDuration)}</Text>
          <Text style={styles.statLabel}>세션 시간</Text>
        </View>
        <View style={styles.sessionStat}>
          <Text style={styles.statValue}>{wordCount}</Text>
          <Text style={styles.statLabel}>단어 수</Text>
        </View>
        <View style={styles.sessionStat}>
          <Text style={styles.statValue}>{transcriptionHistory.length}</Text>
          <Text style={styles.statLabel}>인식 횟수</Text>
        </View>
      </View>

      <View style={styles.controlsContainer}>
        <Animated.View style={{transform: [{scale: microphoneAnimation}]}}>
          <TouchableOpacity
            style={[
              styles.microphoneButton,
              isActive ? styles.microphoneButtonActive : styles.microphoneButtonInactive,
            ]}
            onPress={isActive ? stopSession : startSession}>
            <Text style={styles.microphoneIcon}>
              {isProcessing ? '⏳' : isActive ? '⏹️' : '🎤'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            {isProcessing
              ? '준비 중...'
              : isListening
              ? '듣고 있습니다...'
              : isActive
              ? '대기 중...'
              : '시작하려면 마이크를 누르세요'}
          </Text>
          {isActive && (
            <Text style={styles.processingText}>
              {continuousMode ? '연속 모드 활성화' : '단발 모드'}
            </Text>
          )}
        </View>

        <View style={styles.partialTextContainer}>
          <Text style={styles.partialText}>
            {partialText || (isListening ? '...' : ' ')}
          </Text>
        </View>
      </View>

      {showConfidence && confidence > 0 && (
        <View style={styles.confidenceContainer}>
          <View style={styles.confidenceHeader}>
            <Text style={styles.confidenceLabel}>신뢰도</Text>
            <Text
              style={[
                styles.confidenceValue,
                {color: getConfidenceColor(confidence)},
              ]}>
              {Math.round(confidence)}%
            </Text>
          </View>
          <View style={styles.confidenceBar}>
            <Animated.View
              style={[
                styles.confidenceFill,
                {
                  backgroundColor: getConfidenceColor(confidence),
                  width: confidenceAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </View>
      )}

      <ScrollView style={styles.transcriptionContainer} showsVerticalScrollIndicator={false}>
        {currentText ? (
          <Text style={styles.transcriptionText}>{currentText}</Text>
        ) : (
          <Text style={styles.transcriptionPlaceholder}>
            음성 인식 결과가 여기에 표시됩니다
          </Text>
        )}
      </ScrollView>

      <View style={styles.optionsContainer}>
        <View style={styles.optionRow}>
          <View style={{flex: 1}}>
            <Text style={styles.optionLabel}>연속 인식 모드</Text>
            <Text style={styles.optionDescription}>
              음성 인식을 자동으로 재시작합니다
            </Text>
          </View>
          <Switch
            value={continuousMode}
            onValueChange={setContinuousMode}
            trackColor={{false: colors.disabled, true: colors.primary + '50'}}
            thumbColor={continuousMode ? colors.primary : colors.secondaryText}
          />
        </View>
      </View>

      {transcriptionHistory.length > 0 && (
        <ScrollView style={styles.historyContainer} showsVerticalScrollIndicator={false}>
          <Text style={styles.historyTitle}>인식 기록</Text>
          {transcriptionHistory.slice(-5).reverse().map((item, index) => (
            <View key={index} style={styles.historyItem}>
              <Text style={styles.historyText}>{item.text}</Text>
              <Text
                style={[
                  styles.historyConfidence,
                  {color: getConfidenceColor(item.confidence * 100)},
                ]}>
                {Math.round(item.confidence * 100)}%
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={clearTranscription}>
          <Text style={styles.actionButtonText}>텍스트 지우기</Text>
        </TouchableOpacity>
        
        {currentText && (
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={() => {
              if (onComplete) {
                onComplete(currentText);
              }
            }}>
            <Text style={styles.actionButtonText}>완료</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

export default RealtimeSpeechRecognition;