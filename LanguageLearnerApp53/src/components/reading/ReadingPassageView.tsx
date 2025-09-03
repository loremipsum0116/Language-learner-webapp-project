import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ReadingPassage, ReadingQuestion, ReadingAnswer } from '@/types';
import { useColors } from '@/theme';
import { Button } from '@/components/common/Button';
import { AlertBanner } from '@/components/common/AlertBanner';

interface ReadingPassageViewProps {
  passage: ReadingPassage;
  onComplete: (answers: ReadingAnswer[]) => void;
  onClose: () => void;
}

export const ReadingPassageView: React.FC<ReadingPassageViewProps> = ({ 
  passage, 
  onComplete, 
  onClose 
}) => {
  const colors = useColors();
  const [currentStep, setCurrentStep] = useState<'reading' | 'questions'>('reading');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<ReadingAnswer[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [startTime] = useState(Date.now());
  const [readingStartTime] = useState(Date.now());

  const currentQuestion = passage.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === passage.questions.length - 1;

  const handleStartQuestions = () => {
    setCurrentStep('questions');
  };

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswer(answer);
  };

  const handleNext = () => {
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

    const newAnswer: ReadingAnswer = {
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

  const renderQuestionContent = (question: ReadingQuestion) => {
    switch (question.type) {
      case 'multiple-choice':
        return (
          <View style={styles.optionsContainer}>
            {question.options?.map((option, index) => (
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

  if (currentStep === 'reading') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <View style={styles.headerContent}>
            <Text style={[styles.title, { color: colors.text }]}>{passage.title}</Text>
            {passage.author && (
              <Text style={[styles.author, { color: colors.textSecondary }]}>
                by {passage.author}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: colors.error }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.metaContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            Level: {passage.level} • {passage.wordCount} words • ~{passage.estimatedTime} min
          </Text>
        </View>

        <ScrollView style={styles.contentContainer}>
          <View style={[styles.passageContainer, { backgroundColor: colors.surface }]}>
            <Text style={[styles.passageText, { color: colors.text }]}>
              {passage.content}
            </Text>
          </View>
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
        <Text style={[styles.title, { color: colors.text }]}>{passage.title}</Text>
        <Text style={[styles.progress, { color: colors.textSecondary }]}>
          Question {currentQuestionIndex + 1} / {passage.questions.length}
        </Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={[styles.closeText, { color: colors.error }]}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.contentContainer}>
        <View style={[styles.questionContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.question, { color: colors.text }]}>
            {currentQuestion.question}
          </Text>

          {renderQuestionContent(currentQuestion)}

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
  author: {
    fontSize: 14,
    fontStyle: 'italic',
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
  passageContainer: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  passageText: {
    fontSize: 16,
    lineHeight: 28,
    textAlign: 'justify',
  },
  questionContainer: {
    padding: 20,
    borderRadius: 12,
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