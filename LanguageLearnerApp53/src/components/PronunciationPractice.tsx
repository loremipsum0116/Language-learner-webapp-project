import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import {useTheme} from '../context/ThemeContext';
import VoiceRecordingService, {
  RecordingProgress,
  PlaybackProgress,
  RecordingResult,
} from '../services/VoiceRecordingService';
import WaveformVisualization from './WaveformVisualization';

interface PronunciationPracticeProps {
  text: string;
  targetLanguage: 'english' | 'korean' | 'japanese' | 'chinese';
  onComplete?: (result: PronunciationResult) => void;
  showWaveform?: boolean;
  maxRecordingTime?: number; // in milliseconds
}

export interface PronunciationResult {
  recordingUri: string;
  duration: number;
  quality: 'poor' | 'fair' | 'good' | 'excellent';
  score: number;
  feedback: string[];
  amplitudeData: number[];
}

export const PronunciationPractice: React.FC<PronunciationPracticeProps> = ({
  text,
  targetLanguage,
  onComplete,
  showWaveform = true,
  maxRecordingTime = 30000, // 30 seconds default
}) => {
  const {colors} = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [currentRecording, setCurrentRecording] = useState<RecordingResult | null>(null);
  const [amplitudeData, setAmplitudeData] = useState<number[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const recordButtonScale = useRef(new Animated.Value(1)).current;
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    return () => {
      // Cleanup on unmount
      VoiceRecordingService.cleanup();
      if (recordingTimer.current) {
        clearTimeout(recordingTimer.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setIsRecording(true);
      setRecordingTime(0);
      setAmplitudeData([]);

      // Animate record button
      Animated.spring(recordButtonScale, {
        toValue: 1.2,
        useNativeDriver: true,
      }).start();

      await VoiceRecordingService.startRecording((progress: RecordingProgress) => {
        setRecordingTime(progress.currentPosition);
        
        // Update amplitude data for waveform
        if (progress.currentMetering !== undefined) {
          setAmplitudeData(prev => [...prev, progress.currentMetering!]);
        }
      });

      // Auto-stop after max time
      recordingTimer.current = setTimeout(() => {
        if (isRecording) {
          stopRecording();
        }
      }, maxRecordingTime);

    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);
      Alert.alert('녹음 오류', '녹음을 시작할 수 없습니다. 마이크 권한을 확인해주세요.');
    }
  };

  const stopRecording = async () => {
    try {
      if (recordingTimer.current) {
        clearTimeout(recordingTimer.current);
        recordingTimer.current = null;
      }

      const result = await VoiceRecordingService.stopRecording();
      setCurrentRecording(result);
      setIsRecording(false);

      // Reset button animation
      Animated.spring(recordButtonScale, {
        toValue: 1,
        useNativeDriver: true,
      }).start();

      // Get final amplitude data
      const finalAmplitudeData = VoiceRecordingService.getAmplitudeData();
      setAmplitudeData(finalAmplitudeData);

      // Auto-analyze if callback provided
      if (onComplete) {
        await analyzeRecording(result, finalAmplitudeData);
      }

    } catch (error) {
      console.error('Failed to stop recording:', error);
      setIsRecording(false);
      Alert.alert('녹음 오류', '녹음을 중지하는데 실패했습니다.');
    }
  };

  const playRecording = async () => {
    if (!currentRecording) return;

    try {
      setIsPlaying(true);
      await VoiceRecordingService.startPlayback(
        currentRecording.uri,
        (progress: PlaybackProgress) => {
          setPlaybackTime(progress.currentPosition);
          setPlaybackDuration(progress.duration);
        }
      );
    } catch (error) {
      console.error('Failed to play recording:', error);
      setIsPlaying(false);
      Alert.alert('재생 오류', '녹음을 재생할 수 없습니다.');
    }
  };

  const stopPlayback = async () => {
    try {
      await VoiceRecordingService.stopPlayback();
      setIsPlaying(false);
      setPlaybackTime(0);
    } catch (error) {
      console.error('Failed to stop playback:', error);
    }
  };

  const analyzeRecording = async (recording: RecordingResult, amplitudes: number[]) => {
    if (!onComplete) return;

    setIsAnalyzing(true);
    
    try {
      const quality = await VoiceRecordingService.getRecordingQuality(recording.uri);
      const analysis = await VoiceRecordingService.analyzeVoice(recording.uri);

      // Generate feedback based on analysis
      const feedback = generateFeedback(quality, analysis, targetLanguage);

      const result: PronunciationResult = {
        recordingUri: recording.uri,
        duration: recording.duration,
        quality: quality.quality,
        score: quality.score,
        feedback,
        amplitudeData: amplitudes,
      };

      onComplete(result);
    } catch (error) {
      console.error('Failed to analyze recording:', error);
      Alert.alert('분석 오류', '발음 분석에 실패했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateFeedback = (
    quality: any,
    analysis: any,
    language: string
  ): string[] => {
    const feedback: string[] = [];

    // Quality-based feedback
    if (quality.quality === 'poor') {
      feedback.push('음질이 좋지 않습니다. 마이크에 더 가까이 말해보세요.');
    } else if (quality.quality === 'excellent') {
      feedback.push('훌륭한 음질입니다!');
    }

    // Volume-based feedback
    if (analysis.volume < 0.3) {
      feedback.push('더 크게 말해보세요.');
    } else if (analysis.volume > 0.8) {
      feedback.push('조금 더 부드럽게 말해보세요.');
    }

    // Language-specific feedback
    switch (language) {
      case 'english':
        feedback.push('영어 발음 연습 완료! 자연스러운 억양으로 말해보세요.');
        break;
      case 'korean':
        feedback.push('한국어 발음이 좋습니다. 받침 발음에 주의해보세요.');
        break;
      case 'japanese':
        feedback.push('일본어 발음 연습 완료! 장단음에 주의해보세요.');
        break;
      case 'chinese':
        feedback.push('중국어 성조에 주의하며 다시 연습해보세요.');
        break;
    }

    return feedback;
  };

  const deleteRecording = async () => {
    if (!currentRecording) return;

    try {
      await VoiceRecordingService.deleteRecording(currentRecording.uri);
      setCurrentRecording(null);
      setAmplitudeData([]);
      setPlaybackTime(0);
      setPlaybackDuration(0);
    } catch (error) {
      console.error('Failed to delete recording:', error);
    }
  };

  const getLanguageFlag = (language: string): string => {
    const flags = {
      english: '🇺🇸',
      korean: '🇰🇷',
      japanese: '🇯🇵',
      chinese: '🇨🇳',
    };
    return flags[language as keyof typeof flags] || '🌍';
  };

  const formatTime = (milliseconds: number): string => {
    return VoiceRecordingService.formatTime(milliseconds);
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
    textContainer: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    practiceText: {
      fontSize: 16,
      lineHeight: 24,
      color: colors.text,
      textAlign: 'center',
    },
    controlsContainer: {
      alignItems: 'center',
      marginBottom: showWaveform ? 20 : 0,
    },
    recordButton: {
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
    recordButtonRecording: {
      backgroundColor: colors.error,
    },
    recordButtonNormal: {
      backgroundColor: colors.primary,
    },
    recordButtonIcon: {
      fontSize: 32,
    },
    timer: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    playbackControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
    },
    controlButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.secondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    controlButtonText: {
      fontSize: 20,
    },
    playbackTime: {
      fontSize: 14,
      color: colors.secondaryText,
      minWidth: 80,
      textAlign: 'center',
    },
    analysisContainer: {
      marginTop: 16,
      padding: 16,
      backgroundColor: colors.info + '10',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.info + '30',
    },
    analysisText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    waveformContainer: {
      marginTop: 16,
      height: 80,
      backgroundColor: colors.background,
      borderRadius: 8,
      overflow: 'hidden',
    },
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 16,
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
    deleteButton: {
      backgroundColor: colors.error,
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.onPrimary,
    },
    maxTimeWarning: {
      fontSize: 12,
      color: colors.warning,
      textAlign: 'center',
      marginTop: 8,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.languageFlag}>
          {getLanguageFlag(targetLanguage)}
        </Text>
        <Text style={styles.title}>발음 연습</Text>
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.practiceText}>{text}</Text>
      </View>

      <View style={styles.controlsContainer}>
        <Animated.View style={{transform: [{scale: recordButtonScale}]}}>
          <TouchableOpacity
            style={[
              styles.recordButton,
              isRecording ? styles.recordButtonRecording : styles.recordButtonNormal,
            ]}
            onPress={isRecording ? stopRecording : startRecording}
            disabled={isAnalyzing}>
            <Text style={styles.recordButtonIcon}>
              {isRecording ? '⏹️' : '🎤'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.timer}>
          {formatTime(isRecording ? recordingTime : playbackTime)}
          {playbackDuration > 0 && ` / ${formatTime(playbackDuration)}`}
        </Text>

        {!isRecording && recordingTime < maxRecordingTime * 0.9 && (
          <Text style={styles.maxTimeWarning}>
            최대 녹음 시간: {formatTime(maxRecordingTime)}
          </Text>
        )}

        {currentRecording && (
          <View style={styles.playbackControls}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={isPlaying ? stopPlayback : playRecording}>
              <Text style={styles.controlButtonText}>
                {isPlaying ? '⏹️' : '▶️'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {showWaveform && amplitudeData.length > 0 && (
        <View style={styles.waveformContainer}>
          <WaveformVisualization
            data={amplitudeData}
            color={colors.primary}
            isRecording={isRecording}
          />
        </View>
      )}

      {isAnalyzing && (
        <View style={styles.analysisContainer}>
          <Text style={styles.analysisText}>🔍 발음 분석 중...</Text>
        </View>
      )}

      {currentRecording && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.retryButton]}
            onPress={() => {
              deleteRecording();
              startRecording();
            }}>
            <Text style={styles.actionButtonText}>다시 녹음</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={deleteRecording}>
            <Text style={styles.actionButtonText}>삭제</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};