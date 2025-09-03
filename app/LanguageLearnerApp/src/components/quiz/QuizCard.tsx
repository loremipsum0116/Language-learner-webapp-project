import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Quiz, QuizQuestion, QuizAnswer } from '@/types';
import { useColors } from '@/theme';
import { Button } from '@/components/common/Button';
import { AlertBanner } from '@/components/common/AlertBanner';

interface QuizCardProps {
  quiz: Quiz;
  onComplete: (results: QuizAnswer[]) => void;
  onClose: () => void;
}

export const QuizCard: React.FC<QuizCardProps> = ({ quiz, onComplete, onClose }) => {
  const colors = useColors();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [showResult, setShowResult] = useState(false);
  const [startTime] = useState(Date.now());
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === quiz.questions.length - 1;

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswer(answer);
  };

  const handleNext = () => {
    const timeSpent = Date.now() - questionStartTime;
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

    const newAnswer: QuizAnswer = {
      questionId: currentQuestion.id,
      userAnswer: selectedAnswer,
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect,
      timeSpent,
    };

    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);

    if (isLastQuestion) {
      setShowResult(true);
      setTimeout(() => {
        onComplete(updatedAnswers);
      }, 2000);
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer('');
      setQuestionStartTime(Date.now());
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return colors.success;
    if (score >= 60) return colors.warning;
    return colors.error;
  };

  if (showResult) {
    const correctCount = answers.filter(a => a.isCorrect).length;
    const score = Math.round((correctCount / quiz.questions.length) * 100);

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.resultContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.resultTitle, { color: colors.text }]}>
            Quiz Complete!
          </Text>
          <Text style={[styles.scoreText, { color: getScoreColor(score) }]}>
            {score}%
          </Text>
          <Text style={[styles.resultDetails, { color: colors.textSecondary }]}>
            {correctCount} out of {quiz.questions.length} correct
          </Text>
          <Button
            title="Close"
            onPress={onClose}
            variant="primary"
            style={styles.closeButton}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]}>{quiz.title}</Text>
        <Text style={[styles.progress, { color: colors.textSecondary }]}>
          {currentQuestionIndex + 1} / {quiz.questions.length}
        </Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={[styles.closeText, { color: colors.error }]}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.questionContainer, { backgroundColor: colors.surface }]}>
        <Text style={[styles.question, { color: colors.text }]}>
          {currentQuestion.question}
        </Text>

        <View style={styles.optionsContainer}>
          {currentQuestion.options.map((option, index) => (
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

        {currentQuestion.explanation && (
          <AlertBanner
            type="info"
            message={currentQuestion.explanation}
            style={styles.explanation}
          />
        )}

        <Button
          title={isLastQuestion ? "Finish Quiz" : "Next"}
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
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
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
  questionContainer: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
  },
  question: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'center',
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
    textAlign: 'center',
  },
  explanation: {
    marginBottom: 16,
  },
  nextButton: {
    marginTop: 'auto',
  },
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    borderRadius: 12,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  scoreText: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  resultDetails: {
    fontSize: 16,
    marginBottom: 32,
  },
});