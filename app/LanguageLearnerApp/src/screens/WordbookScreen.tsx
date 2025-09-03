import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { useColors } from '@/theme';
import { apiClient } from '@/services/apiClient';
import { Wordbook, WordbookEntry } from '@/types';
import { AlertBanner } from '@/components/common/AlertBanner';
import { Button } from '@/components/common/Button';

export const WordbookScreen: React.FC = () => {
  const colors = useColors();
  const [wordbooks, setWordbooks] = useState<Wordbook[]>([]);
  const [selectedWordbook, setSelectedWordbook] = useState<Wordbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newWordbookName, setNewWordbookName] = useState('');
  const [newWordbookDescription, setNewWordbookDescription] = useState('');

  useEffect(() => {
    loadWordbooks();
  }, []);

  const loadWordbooks = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.wordbook.getAll();
      setWordbooks(response.data || []);
    } catch (err) {
      console.error('Failed to load wordbooks:', err);
      setError('Failed to load wordbooks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadWordbookDetails = async (wordbookId: number) => {
    try {
      setLoading(true);
      const response = await apiClient.wordbook.getById(wordbookId);
      setSelectedWordbook(response.data);
    } catch (err) {
      console.error('Failed to load wordbook details:', err);
      setError('Failed to load wordbook details.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWordbook = async () => {
    if (!newWordbookName.trim()) {
      Alert.alert('Error', 'Please enter a wordbook name');
      return;
    }

    try {
      await apiClient.wordbook.create(newWordbookName, newWordbookDescription);
      setCreateModalVisible(false);
      setNewWordbookName('');
      setNewWordbookDescription('');
      loadWordbooks();
    } catch (err) {
      console.error('Failed to create wordbook:', err);
      Alert.alert('Error', 'Failed to create wordbook');
    }
  };

  const handleDeleteWordbook = (wordbook: Wordbook) => {
    Alert.alert(
      'Delete Wordbook',
      `Are you sure you want to delete "${wordbook.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.wordbook.delete(wordbook.id);
              loadWordbooks();
              if (selectedWordbook?.id === wordbook.id) {
                setSelectedWordbook(null);
              }
            } catch (err) {
              Alert.alert('Error', 'Failed to delete wordbook');
            }
          }
        }
      ]
    );
  };

  const handleRemoveWord = (wordId: number) => {
    if (!selectedWordbook) return;

    Alert.alert(
      'Remove Word',
      'Are you sure you want to remove this word from your wordbook?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.wordbook.removeWord(selectedWordbook.id, wordId);
              loadWordbookDetails(selectedWordbook.id);
            } catch (err) {
              Alert.alert('Error', 'Failed to remove word');
            }
          }
        }
      ]
    );
  };

  const renderWordbook = ({ item }: { item: Wordbook }) => (
    <TouchableOpacity
      style={[styles.wordbookItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => {
        setSelectedWordbook(item);
        loadWordbookDetails(item.id);
      }}
    >
      <View style={styles.wordbookHeader}>
        <Text style={[styles.wordbookName, { color: colors.text }]}>{item.name}</Text>
        <TouchableOpacity
          onPress={() => handleDeleteWordbook(item)}
          style={styles.deleteButton}
        >
          <Text style={[styles.deleteButtonText, { color: colors.error }]}>🗑️</Text>
        </TouchableOpacity>
      </View>
      
      {item.description && (
        <Text style={[styles.wordbookDescription, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.description}
        </Text>
      )}

      <View style={styles.wordbookMeta}>
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
          {item.words.length} words
        </Text>
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
          {item.isPublic ? 'Public' : 'Private'}
        </Text>
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderWordEntry = ({ item }: { item: WordbookEntry }) => (
    <View style={[styles.wordItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.wordHeader}>
        <Text style={[styles.word, { color: colors.text }]}>{item.vocab.lemma}</Text>
        <TouchableOpacity
          onPress={() => handleRemoveWord(item.id)}
          style={styles.removeButton}
        >
          <Text style={[styles.removeButtonText, { color: colors.error }]}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.partOfSpeech, { color: colors.textSecondary }]}>
        {item.vocab.pos}
      </Text>

      {item.vocab.ko_gloss && (
        <Text style={[styles.translation, { color: colors.text }]}>
          {item.vocab.ko_gloss}
        </Text>
      )}

      {item.notes && (
        <Text style={[styles.notes, { color: colors.textSecondary }]}>
          Note: {item.notes}
        </Text>
      )}

      <View style={styles.wordMeta}>
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
          Added: {new Date(item.addedAt).toLocaleDateString()}
        </Text>
        {item.mastered && (
          <Text style={[styles.masteredText, { color: colors.success }]}>✓ Mastered</Text>
        )}
      </View>
    </View>
  );

  if (selectedWordbook) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={() => setSelectedWordbook(null)} style={styles.backButton}>
            <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{selectedWordbook.name}</Text>
          {selectedWordbook.description && (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {selectedWordbook.description}
            </Text>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading words...
            </Text>
          </View>
        ) : (
          <FlatList
            data={selectedWordbook.words}
            renderItem={renderWordEntry}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No words in this wordbook yet
                </Text>
              </View>
            }
          />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]}>My Wordbooks</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Create and manage your personal vocabulary collections
        </Text>
        
        <Button
          title="Create New Wordbook"
          onPress={() => setCreateModalVisible(true)}
          variant="primary"
          style={styles.createButton}
        />
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
            Loading wordbooks...
          </Text>
        </View>
      ) : (
        <FlatList
          data={wordbooks}
          renderItem={renderWordbook}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>📚</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No wordbooks yet. Create your first wordbook to start collecting vocabulary!
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Create New Wordbook</Text>
            
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              value={newWordbookName}
              onChangeText={setNewWordbookName}
              placeholder="Wordbook name"
              placeholderTextColor={colors.textSecondary}
            />
            
            <TextInput
              style={[styles.textInput, styles.descriptionInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              value={newWordbookDescription}
              onChangeText={setNewWordbookDescription}
              placeholder="Description (optional)"
              placeholderTextColor={colors.textSecondary}
              multiline
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setCreateModalVisible(false)}
                variant="secondary"
                style={styles.modalButton}
              />
              <Button
                title="Create"
                onPress={handleCreateWordbook}
                variant="primary"
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
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
    marginBottom: 16,
  },
  createButton: {
    alignSelf: 'flex-start',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 300,
  },
  emptyTitle: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  wordbookItem: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  wordbookHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  wordbookName: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  deleteButton: {
    padding: 4,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  wordbookDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  wordbookMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  wordItem: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  wordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  word: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  removeButton: {
    padding: 4,
  },
  removeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  partOfSpeech: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  translation: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
  },
  notes: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  wordMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  masteredText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    padding: 20,
    borderRadius: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  descriptionInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 8,
  },
});