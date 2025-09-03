import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useColors } from '@/theme';
import { apiClient } from '@/services/apiClient';
import { Quiz, QuizAnswer, QuizResult } from '@/types';
import { QuizList } from '@/components/quiz/QuizList';
import { QuizCard } from '@/components/quiz/QuizCard';
import { AlertBanner } from '@/components/common/AlertBanner';
import { Button } from '@/components/common/Button';

export const QuizScreen: React.FC = () => {
  const colors = useColors();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    category: '',
    difficulty: '',
  });

  useEffect(() => {
    loadQuizzes();
  }, [filters]);

  const loadQuizzes = async () => {
    try {
      setLoading(true);
      setError(null);

      const filterParams = {
        ...(filters.category && { category: filters.category }),
        ...(filters.difficulty && { difficulty: filters.difficulty }),
        limit: 50,
      };

      const response = await apiClient.quiz.getAll(filterParams);
      setQuizzes(response.data || []);
    } catch (err) {
      console.error('Failed to load quizzes:', err);
      setError('Failed to load quizzes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuizComplete = async (answers: QuizAnswer[]) => {
    if (!selectedQuiz) return;

    try {
      const result = await apiClient.quiz.submit(selectedQuiz.id, answers);
      console.log('Quiz completed:', result);
      
      setSelectedQuiz(null);
      loadQuizzes();
    } catch (err) {
      console.error('Failed to submit quiz:', err);
      setError('Failed to submit quiz results. Please try again.');
    }
  };

  const handleCloseQuiz = () => {
    setSelectedQuiz(null);
  };

  const handleRetry = () => {
    setError(null);
    loadQuizzes();
  };

  if (selectedQuiz) {
    return (
      <QuizCard
        quiz={selectedQuiz}
        onComplete={handleQuizComplete}
        onClose={handleCloseQuiz}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]}>Quizzes</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Test your knowledge with interactive quizzes
        </Text>
      </View>

      {error && (
        <AlertBanner
          type="error"
          message={error}
          onClose={() => setError(null)}
          style={styles.errorBanner}
        />
      )}

      {error && (
        <View style={styles.retryContainer}>
          <Button
            title="Retry"
            onPress={handleRetry}
            variant="primary"
          />
        </View>
      )}

      {!error && (
        <QuizList
          quizzes={quizzes}
          onSelectQuiz={setSelectedQuiz}
          loading={loading}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  errorBanner: {
    margin: 16,
  },
  retryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
});