import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { ReadingPassage } from '@/types';
import { useColors } from '@/theme';

interface ReadingListProps {
  passages: ReadingPassage[];
  onSelectPassage: (passage: ReadingPassage) => void;
  loading?: boolean;
}

interface PassageItemProps {
  passage: ReadingPassage;
  onPress: () => void;
}

const PassageItem: React.FC<PassageItemProps> = ({ passage, onPress }) => {
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

  return (
    <TouchableOpacity 
      style={[styles.passageItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
    >
      <View style={styles.passageHeader}>
        <Text style={[styles.passageTitle, { color: colors.text }]} numberOfLines={2}>
          {passage.title}
        </Text>
        <View style={[styles.levelBadge, { backgroundColor: getLevelColor(passage.level) + '20' }]}>
          <Text style={[styles.levelText, { color: getLevelColor(passage.level) }]}>
            {passage.level}
          </Text>
        </View>
      </View>

      {passage.author && (
        <Text style={[styles.passageAuthor, { color: colors.textSecondary }]}>
          by {passage.author}
        </Text>
      )}

      <View style={styles.passageMeta}>
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
          {passage.wordCount} words
        </Text>
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
          ~{passage.estimatedTime} min
        </Text>
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
          {passage.questions.length} questions
        </Text>
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
          {passage.category}
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
    </TouchableOpacity>
  );
};

export const ReadingList: React.FC<ReadingListProps> = ({ passages, onSelectPassage, loading }) => {
  const colors = useColors();

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading reading passages...
        </Text>
      </View>
    );
  }

  if (passages.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No reading passages available
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={passages}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
        <PassageItem 
          passage={item} 
          onPress={() => onSelectPassage(item)} 
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
  passageItem: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  passageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  passageTitle: {
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
  passageAuthor: {
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  passageMeta: {
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