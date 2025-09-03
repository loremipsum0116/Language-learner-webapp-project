import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/theme';
import { apiClient } from '@/services/apiClient';
import { ReadingPassage, ReadingAnswer, ReadingProgress } from '@/types';
import { ReadingList } from '@/components/reading/ReadingList';
import { ReadingPassageView } from '@/components/reading/ReadingPassageView';
import { AlertBanner } from '@/components/common/AlertBanner';
import { Button } from '@/components/common/Button';

export const ReadingScreen: React.FC = () => {
  const colors = useColors();
  const [passages, setPassages] = useState<ReadingPassage[]>([]);
  const [selectedPassage, setSelectedPassage] = useState<ReadingPassage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    level: '',
    category: '',
  });

  useEffect(() => {
    loadPassages();
  }, [filters]);

  const loadPassages = async () => {
    try {
      setLoading(true);
      setError(null);

      const filterParams = {
        ...(filters.level && { level: filters.level }),
        ...(filters.category && { category: filters.category }),
        limit: 50,
      };

      const response = await apiClient.reading.getAll(filterParams);
      setPassages(response.data || []);
    } catch (err) {
      console.error('Failed to load reading passages:', err);
      setError('Failed to load reading passages. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePassageComplete = async (answers: ReadingAnswer[]) => {
    if (!selectedPassage) return;

    try {
      const result = await apiClient.reading.submit(selectedPassage.id, answers);
      console.log('Reading completed:', result);
      
      setSelectedPassage(null);
      loadPassages();
    } catch (err) {
      console.error('Failed to submit reading answers:', err);
      setError('Failed to submit reading answers. Please try again.');
    }
  };

  const handleCloseReading = () => {
    setSelectedPassage(null);
  };

  const handleRetry = () => {
    setError(null);
    loadPassages();
  };

  if (selectedPassage) {
    return (
      <ReadingPassageView
        passage={selectedPassage}
        onComplete={handlePassageComplete}
        onClose={handleCloseReading}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]}>Reading Comprehension</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Improve your reading skills with engaging passages
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
        <ReadingList
          passages={passages}
          onSelectPassage={setSelectedPassage}
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