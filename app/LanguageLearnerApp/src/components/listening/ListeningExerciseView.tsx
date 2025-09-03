import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { ListeningExercise, ListeningAnswer } from '@/types';
import { useColors } from '@/theme';
import { Button } from '@/components/common/Button';
import { AlertBanner } from '@/components/common/AlertBanner';

interface ListeningExerciseViewProps {
  exercise: ListeningExercise;
  onComplete: (answers: ListeningAnswer[]) => void;
  onClose: () => void;
}

export const ListeningExerciseView: React.FC<ListeningExerciseViewProps> = ({
  exercise,
  onComplete,
  onClose
}) => {
  const colors = useColors();
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [currentStep, setCurrentStep] = useState<'listening' | 'questions'>('listening');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<ListeningAnswer[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  
  const currentQuestion = exercise.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === exercise.questions.length - 1;

  React.useEffect(() => {
    loadAudio();
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const loadAudio = async () => {
    try {
      const { sound: newSound } = await Audio.createAsync(
        { uri: exercise.audioUrl },
        { shouldPlay: false },
        onPlaybackStatusUpdate
      );
      setSound(newSound);
    } catch (error) {
      console.error('Failed to load audio:', error);
      Alert.alert('Error', 'Failed to load audio file');
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setCurrentPosition(status.positionMillis || 0);
      setDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);
    }
  };

  const togglePlayback = async () => {
    if (!sound) return;

    try {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } catch (error) {
      console.error('Playback error:', error);
    }
  };

  const seekToPosition = async (position: number) => {
    if (!sound) return;
    
    try {
      await sound.setPositionAsync(position);
    } catch (error) {
      console.error('Seek error:', error);
    }
  };

  const formatTime = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleStartQuestions = () => {
    setCurrentStep('questions');
  };

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswer(answer);
  };

  const handleNext = () => {
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

    const newAnswer: ListeningAnswer = {
      questionId: currentQuestion.id,
      userAnswer: selectedAnswer,
      isCorrect,
    };

    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);

    if (isLastQuestion) {
      onComplete(updatedAnswers);
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer('');
    }
  };

  const renderQuestionContent = () => {
    switch (currentQuestion.type) {
      case 'multiple-choice':
        return (
          <View style={styles.optionsContainer}>
            {currentQuestion.options?.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor: selectedAnswer === option 
                      ? colors.primary + '20' 
                      : colors.background,
                    borderColor: selectedAnswer === option 
                      ? colors.primary 
                      : colors.border,
                  }
                ]}
                onPress={() => handleAnswerSelect(option)}
              >
                <Text style={[
                  styles.optionText,
                  {
                    color: selectedAnswer === option ? colors.primary : colors.text,
                    fontWeight: selectedAnswer === option ? '600' : '400',
                  }
                ]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'true-false':
        return (
          <View style={styles.optionsContainer}>
            {['True', 'False'].map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor: selectedAnswer === option 
                      ? colors.primary + '20' 
                      : colors.background,
                    borderColor: selectedAnswer === option 
                      ? colors.primary 
                      : colors.border,
                  }
                ]}
                onPress={() => handleAnswerSelect(option)}
              >
                <Text style={[
                  styles.optionText,
                  {
                    color: selectedAnswer === option ? colors.primary : colors.text,
                    fontWeight: selectedAnswer === option ? '600' : '400',
                  }
                ]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      default:
        return (
          <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
            Answer format not supported yet
          </Text>
        );
    }
  };

  if (currentStep === 'listening') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <View style={styles.headerContent}>
            <Text style={[styles.title, { color: colors.text }]}>{exercise.title}</Text>
            {exercise.description && (
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {exercise.description}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: colors.error }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.metaContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            Level: {exercise.level} • {formatTime(exercise.duration * 1000)} • {exercise.category}
          </Text>
        </View>

        <ScrollView style={styles.contentContainer}>
          <View style={[styles.audioContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.audioControls}>
              <TouchableOpacity
                style={[styles.playButton, { backgroundColor: colors.primary }]}
                onPress={togglePlayback}
              >
                <Text style={[styles.playButtonText, { color: colors.background }]}>
                  {isPlaying ? '⏸️' : '▶️'}
                </Text>
              </TouchableOpacity>

              <View style={styles.progressContainer}>
                <Text style={[styles.timeText, { color: colors.textSecondary }]}>
                  {formatTime(currentPosition)}
                </Text>
                <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        backgroundColor: colors.primary,
                        width: duration > 0 ? `${(currentPosition / duration) * 100}%` : '0%'
                      }
                    ]} 
                  />
                </View>
                <Text style={[styles.timeText, { color: colors.textSecondary }]}>
                  {formatTime(duration)}
                </Text>
              </View>
            </View>

            {exercise.transcript && (
              <View style={styles.transcriptContainer}>
                <TouchableOpacity
                  style={[styles.transcriptToggle, { borderColor: colors.border }]}
                  onPress={() => setShowTranscript(!showTranscript)}
                >
                  <Text style={[styles.transcriptToggleText, { color: colors.primary }]}>
                    {showTranscript ? 'Hide' : 'Show'} Transcript
                  </Text>
                </TouchableOpacity>

                {showTranscript && (
                  <View style={[styles.transcriptContent, { backgroundColor: colors.background }]}>
                    <Text style={[styles.transcriptText, { color: colors.text }]}>
                      {exercise.transcript}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          <AlertBanner
            type="info"
            message="Listen to the audio as many times as you need, then start the questions when ready."
            style={styles.instruction}
          />
        </ScrollView>

        <View style={[styles.footerContainer, { backgroundColor: colors.surface }]}>
          <Button
            title="Start Questions"
            onPress={handleStartQuestions}
            variant="primary"
            style={styles.startButton}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]}>{exercise.title}</Text>
        <Text style={[styles.progress, { color: colors.textSecondary }]}>
          Question {currentQuestionIndex + 1} / {exercise.questions.length}
        </Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={[styles.closeText, { color: colors.error }]}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.contentContainer}>
        <View style={[styles.questionContainer, { backgroundColor: colors.surface }]}>
          {currentQuestion.timestamp && (
            <TouchableOpacity
              style={[styles.timestampButton, { backgroundColor: colors.primary + '20' }]}
              onPress={() => seekToPosition(currentQuestion.timestamp! * 1000)}
            >
              <Text style={[styles.timestampText, { color: colors.primary }]}>
                🎧 Listen to relevant part ({formatTime(currentQuestion.timestamp * 1000)})
              </Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.question, { color: colors.text }]}>
            {currentQuestion.question}
          </Text>

          {renderQuestionContent()}

          {currentQuestion.explanation && (
            <AlertBanner
              type="info"
              message={currentQuestion.explanation}
              style={styles.explanation}
            />
          )}
        </View>
      </ScrollView>

      <View style={[styles.footerContainer, { backgroundColor: colors.surface }]}>
        <Button
          title={isLastQuestion ? "Complete" : "Next"}
          onPress={handleNext}
          disabled={!selectedAnswer}
          variant="primary"
          style={styles.nextButton}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
  },
  progress: {
    fontSize: 14,
    marginHorizontal: 16,
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  metaContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  metaText: {
    fontSize: 12,
    textAlign: 'center',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  audioContainer: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  audioControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  playButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  playButtonText: {
    fontSize: 20,
  },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    minWidth: 40,
    textAlign: 'center',
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  transcriptContainer: {
    marginTop: 16,
  },
  transcriptToggle: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
  transcriptToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  transcriptContent: {
    marginTop: 12,
    padding: 16,
    borderRadius: 8,
  },
  transcriptText: {
    fontSize: 14,
    lineHeight: 20,
  },
  instruction: {
    marginBottom: 16,
  },
  questionContainer: {
    padding: 20,
    borderRadius: 12,
  },
  timestampButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  timestampText: {
    fontSize: 14,
    fontWeight: '600',
  },
  question: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    fontWeight: '500',
  },
  optionsContainer: {
    marginBottom: 24,
  },
  optionButton: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 12,
  },
  optionText: {
    fontSize: 16,
    textAlign: 'left',
  },
  instructionText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  explanation: {
    marginBottom: 16,
  },
  footerContainer: {
    padding: 16,
  },
  startButton: {
    width: '100%',
  },
  nextButton: {
    width: '100%',
  },
});