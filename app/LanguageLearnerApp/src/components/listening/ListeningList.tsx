import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { ListeningExercise } from '@/types';
import { useColors } from '@/theme';

interface ListeningListProps {
  exercises: ListeningExercise[];
  onSelectExercise: (exercise: ListeningExercise) => void;
  loading?: boolean;
}

interface ExerciseItemProps {
  exercise: ListeningExercise;
  onPress: () => void;
}

const ExerciseItem: React.FC<ExerciseItemProps> = ({ exercise, onPress }) => {
  const colors = useColors();

  const getLevelColor = (level: string) => {
    const levelMap: { [key: string]: string } = {
      'A1': colors.success,
      'A2': colors.success,
      'B1': colors.warning,
      'B2': colors.warning,
      'C1': colors.error,
      'C2': colors.error,
    };
    return levelMap[level] || colors.textSecondary;
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <TouchableOpacity 
      style={[styles.exerciseItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
    >
      <View style={styles.exerciseHeader}>
        <Text style={[styles.exerciseTitle, { color: colors.text }]} numberOfLines={2}>
          {exercise.title}
        </Text>
        <View style={[styles.levelBadge, { backgroundColor: getLevelColor(exercise.level) + '20' }]}>
          <Text style={[styles.levelText, { color: getLevelColor(exercise.level) }]}>
            {exercise.level}
          </Text>
        </View>
      </View>

      {exercise.description && (
        <Text style={[styles.exerciseDescription, { color: colors.textSecondary }]} numberOfLines={2}>
          {exercise.description}
        </Text>
      )}

      <View style={styles.exerciseMeta}>
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
          🎧 {formatDuration(exercise.duration)}
        </Text>
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
          {exercise.questions.length} questions
        </Text>
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
          {exercise.category}
        </Text>
      </View>

      <View style={styles.progressIndicator}>
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View 
            style={[
              styles.progressFill, 
              { backgroundColor: colors.primary, width: '0%' }
            ]} 
          />
        </View>
        <Text style={[styles.progressText, { color: colors.textSecondary }]}>
          Not started
        </Text>
      </View>

      {exercise.transcript && (
        <View style={styles.featureIndicator}>
          <Text style={[styles.featureText, { color: colors.primary }]}>
            📝 Transcript available
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export const ListeningList: React.FC<ListeningListProps> = ({ exercises, onSelectExercise, loading }) => {
  const colors = useColors();

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading listening exercises...
        </Text>
      </View>
    );
  }

  if (exercises.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No listening exercises available
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={exercises}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
        <ExerciseItem 
          exercise={item} 
          onPress={() => onSelectExercise(item)} 
        />
      )}
      contentContainerStyle={styles.listContainer}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  exerciseItem: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  exerciseTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
    lineHeight: 22,
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  exerciseDescription: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 12,
  },
  exerciseMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginRight: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
  },
  featureIndicator: {
    alignItems: 'flex-end',
  },
  featureText: {
    fontSize: 12,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
  },
});