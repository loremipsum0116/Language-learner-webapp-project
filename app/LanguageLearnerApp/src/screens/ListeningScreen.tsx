import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/theme';
import { apiClient } from '@/services/apiClient';
import { ListeningExercise, ListeningAnswer, ListeningProgress } from '@/types';
import { ListeningList } from '@/components/listening/ListeningList';
import { ListeningExerciseView } from '@/components/listening/ListeningExerciseView';
import { AlertBanner } from '@/components/common/AlertBanner';
import { Button } from '@/components/common/Button';

export const ListeningScreen: React.FC = () => {
  const colors = useColors();
  const [exercises, setExercises] = useState<ListeningExercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<ListeningExercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    level: '',
    category: '',
  });

  useEffect(() => {
    loadExercises();
  }, [filters]);

  const loadExercises = async () => {
    try {
      setLoading(true);
      setError(null);

      const filterParams = {
        ...(filters.level && { level: filters.level }),
        ...(filters.category && { category: filters.category }),
        limit: 50,
      };

      const response = await apiClient.listening.getAll(filterParams);
      setExercises(response.data || []);
    } catch (err) {
      console.error('Failed to load listening exercises:', err);
      setError('Failed to load listening exercises. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExerciseComplete = async (answers: ListeningAnswer[]) => {
    if (!selectedExercise) return;

    try {
      const result = await apiClient.listening.submit(selectedExercise.id, answers);
      console.log('Listening completed:', result);
      
      setSelectedExercise(null);
      loadExercises();
    } catch (err) {
      console.error('Failed to submit listening answers:', err);
      setError('Failed to submit listening answers. Please try again.');
    }
  };

  const handleCloseExercise = () => {
    setSelectedExercise(null);
  };

  const handleRetry = () => {
    setError(null);
    loadExercises();
  };

  if (selectedExercise) {
    return (
      <ListeningExerciseView
        exercise={selectedExercise}
        onComplete={handleExerciseComplete}
        onClose={handleCloseExercise}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]}>Listening Comprehension</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Enhance your listening skills with audio exercises
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
        <ListeningList
          exercises={exercises}
          onSelectExercise={setSelectedExercise}
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