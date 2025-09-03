import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Quiz } from '@/types';
import { useColors } from '@/theme';

interface QuizListProps {
  quizzes: Quiz[];
  onSelectQuiz: (quiz: Quiz) => void;
  loading?: boolean;
}

interface QuizItemProps {
  quiz: Quiz;
  onPress: () => void;
}

const QuizItem: React.FC<QuizItemProps> = ({ quiz, onPress }) => {
  const colors = useColors();

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return colors.success;
      case 'medium': return colors.warning;
      case 'hard': return colors.error;
      default: return colors.textSecondary;
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.quizItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
    >
      <View style={styles.quizHeader}>
        <Text style={[styles.quizTitle, { color: colors.text }]}>{quiz.title}</Text>
        <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(quiz.difficulty) + '20' }]}>
          <Text style={[styles.difficultyText, { color: getDifficultyColor(quiz.difficulty) }]}>
            {quiz.difficulty.toUpperCase()}
          </Text>
        </View>
      </View>

      {quiz.description && (
        <Text style={[styles.quizDescription, { color: colors.textSecondary }]}>
          {quiz.description}
        </Text>
      )}

      <View style={styles.quizMeta}>
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
          {quiz.questions.length} questions
        </Text>
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
          {quiz.category}
        </Text>
        {quiz.timeLimit && (
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {Math.round(quiz.timeLimit / 60)}min
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

export const QuizList: React.FC<QuizListProps> = ({ quizzes, onSelectQuiz, loading }) => {
  const colors = useColors();

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading quizzes...
        </Text>
      </View>
    );
  }

  if (quizzes.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No quizzes available
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={quizzes}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
        <QuizItem 
          quiz={item} 
          onPress={() => onSelectQuiz(item)} 
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
  quizItem: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  quizHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  quizTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  quizDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  quizMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaText: {
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