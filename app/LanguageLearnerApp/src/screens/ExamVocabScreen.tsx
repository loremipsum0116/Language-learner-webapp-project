import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useColors } from '@/theme';
import { apiClient } from '@/services/apiClient';
import { ExamCategory, ExamVocab } from '@/types';
import { AlertBanner } from '@/components/common/AlertBanner';
import { Button } from '@/components/common/Button';

export const ExamVocabScreen: React.FC = () => {
  const colors = useColors();
  const [categories, setCategories] = useState<ExamCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ExamCategory | null>(null);
  const [vocabularies, setVocabularies] = useState<ExamVocab[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.examVocab.getCategories();
      setCategories(response.data || []);
    } catch (err) {
      console.error('Failed to load exam categories:', err);
      setError('Failed to load exam categories. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadCategoryVocabulary = async (categoryId: number) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.examVocab.getByCategory(categoryId, { limit: 50 });
      setVocabularies(response.data || []);
    } catch (err) {
      console.error('Failed to load category vocabulary:', err);
      setError('Failed to load vocabulary. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (category: ExamCategory) => {
    setSelectedCategory(category);
    loadCategoryVocabulary(category.id);
  };

  const handleBack = () => {
    setSelectedCategory(null);
    setVocabularies([]);
  };

  const getExamTypeColor = (examType: string) => {
    const colorMap: { [key: string]: string } = {
      'TOEFL': colors.primary,
      'IELTS': colors.success,
      'SAT': colors.warning,
      'GRE': colors.error,
      'TOEIC': colors.info,
    };
    return colorMap[examType] || colors.textSecondary;
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty >= 8) return colors.error;
    if (difficulty >= 6) return colors.warning;
    if (difficulty >= 4) return colors.info;
    return colors.success;
  };

  const renderCategory = ({ item }: { item: ExamCategory }) => (
    <TouchableOpacity
      style={[styles.categoryItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => handleCategorySelect(item)}
    >
      <View style={styles.categoryHeader}>
        <Text style={[styles.categoryName, { color: colors.text }]}>{item.name}</Text>
        <View style={[styles.examTypeBadge, { backgroundColor: getExamTypeColor(item.examType) + '20' }]}>
          <Text style={[styles.examTypeText, { color: getExamTypeColor(item.examType) }]}>
            {item.examType}
          </Text>
        </View>
      </View>
      
      {item.description && (
        <Text style={[styles.categoryDescription, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.description}
        </Text>
      )}
      
      {item.level && (
        <Text style={[styles.categoryLevel, { color: colors.textSecondary }]}>
          Level: {item.level}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderVocabulary = ({ item }: { item: ExamVocab }) => (
    <View style={[styles.vocabItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.vocabHeader}>
        <Text style={[styles.vocabWord, { color: colors.text }]}>{item.word}</Text>
        <View style={styles.vocabBadges}>
          <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(item.difficulty) + '20' }]}>
            <Text style={[styles.difficultyText, { color: getDifficultyColor(item.difficulty) }]}>
              {item.difficulty}/10
            </Text>
          </View>
          <View style={[styles.frequencyBadge, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.frequencyText, { color: colors.primary }]}>
              Freq: {item.frequency}
            </Text>
          </View>
        </View>
      </View>

      <Text style={[styles.partOfSpeech, { color: colors.textSecondary }]}>
        {item.partOfSpeech}
      </Text>

      <Text style={[styles.definition, { color: colors.text }]} numberOfLines={2}>
        {item.definition}
      </Text>

      {item.pronunciation && (
        <Text style={[styles.pronunciation, { color: colors.textSecondary }]}>
          /{item.pronunciation}/
        </Text>
      )}

      {item.examples.length > 0 && (
        <Text style={[styles.example, { color: colors.textSecondary }]} numberOfLines={1}>
          Example: {item.examples[0]}
        </Text>
      )}
    </View>
  );

  if (selectedCategory) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{selectedCategory.name}</Text>
          <View style={[styles.examTypeBadge, { backgroundColor: getExamTypeColor(selectedCategory.examType) + '20' }]}>
            <Text style={[styles.examTypeText, { color: getExamTypeColor(selectedCategory.examType) }]}>
              {selectedCategory.examType}
            </Text>
          </View>
        </View>

        {error && (
          <AlertBanner
            type="error"
            message={error}
            onClose={() => setError(null)}
            style={styles.errorBanner}
          />
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading vocabulary...
            </Text>
          </View>
        ) : (
          <FlatList
            data={vocabularies}
            renderItem={renderVocabulary}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]}>Exam Vocabulary</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Study vocabulary for standardized tests
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

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading categories...
          </Text>
        </View>
      ) : (
        <FlatList
          data={categories}
          renderItem={renderCategory}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
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
  backButton: {
    marginBottom: 16,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorBanner: {
    margin: 16,
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
  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  categoryItem: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  examTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  examTypeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  categoryLevel: {
    fontSize: 12,
    fontWeight: '500',
  },
  vocabItem: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  vocabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  vocabWord: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  vocabBadges: {
    flexDirection: 'row',
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  frequencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  frequencyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  partOfSpeech: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  definition: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
  },
  pronunciation: {
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  example: {
    fontSize: 14,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});