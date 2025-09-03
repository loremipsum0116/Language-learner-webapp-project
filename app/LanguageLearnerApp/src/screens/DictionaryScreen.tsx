import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert } from 'react-native';
import { useColors } from '@/theme';
import { apiClient } from '@/services/apiClient';
import { DictionaryEntry as DictionaryEntryType, DictionarySearchResult } from '@/types';
import { DictionarySearchBar } from '@/components/dictionary/DictionarySearchBar';
import { DictionaryEntry } from '@/components/dictionary/DictionaryEntry';
import { AlertBanner } from '@/components/common/AlertBanner';
import { Button } from '@/components/common/Button';

export const DictionaryScreen: React.FC = () => {
  const colors = useColors();
  const [searchResults, setSearchResults] = useState<DictionaryEntryType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [totalFound, setTotalFound] = useState(0);

  const handleSearch = async (query: string) => {
    try {
      setLoading(true);
      setError(null);
      setLastQuery(query);

      const response: DictionarySearchResult = await apiClient.dictionary.search(query, {
        limit: 20,
      });

      setSearchResults(response.entries || []);
      setSuggestions(response.suggestions || []);
      setTotalFound(response.totalFound || 0);
    } catch (err) {
      console.error('Dictionary search failed:', err);
      setError('Failed to search dictionary. Please try again.');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToWordbook = async (entry: DictionaryEntryType) => {
    try {
      // This would need to integrate with wordbook API
      // For now, we'll show a placeholder alert
      Alert.alert(
        'Add to Wordbook',
        `Would you like to add "${entry.word}" to your wordbook?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Add', 
            onPress: () => {
              // TODO: Implement actual wordbook addition
              console.log('Adding to wordbook:', entry.word);
              Alert.alert('Success', `"${entry.word}" added to your wordbook!`);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Failed to add to wordbook:', error);
      Alert.alert('Error', 'Failed to add word to wordbook');
    }
  };

  const handleRetry = () => {
    if (lastQuery) {
      handleSearch(lastQuery);
    }
  };

  const renderSearchResult = ({ item }: { item: DictionaryEntryType }) => (
    <DictionaryEntry 
      entry={item} 
      onAddToWordbook={handleAddToWordbook}
    />
  );

  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Searching...
          </Text>
        </View>
      );
    }

    if (lastQuery && searchResults.length === 0 && !error) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No results found for "{lastQuery}"
          </Text>
          
          {suggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={[styles.suggestionsTitle, { color: colors.text }]}>
                Did you mean:
              </Text>
              {suggestions.slice(0, 3).map((suggestion, index) => (
                <Button
                  key={index}
                  title={suggestion}
                  onPress={() => handleSearch(suggestion)}
                  variant="secondary"
                  size="small"
                  style={styles.suggestionButton}
                />
              ))}
            </View>
          )}
        </View>
      );
    }

    if (!lastQuery) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={[styles.welcomeTitle, { color: colors.text }]}>
            📖 Dictionary
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Search for words to see definitions, pronunciation, and examples
          </Text>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]}>Dictionary</Text>
        <DictionarySearchBar 
          onSearch={handleSearch}
          placeholder="Search for words..."
          style={styles.searchBar}
        />
        
        {lastQuery && totalFound > 0 && (
          <Text style={[styles.resultsInfo, { color: colors.textSecondary }]}>
            Found {totalFound} results for "{lastQuery}"
          </Text>
        )}
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
        <FlatList
          data={searchResults}
          renderItem={renderSearchResult}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={renderEmptyState}
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
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  searchBar: {
    marginBottom: 12,
  },
  resultsInfo: {
    fontSize: 14,
    textAlign: 'center',
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
  listContainer: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 300,
  },
  welcomeTitle: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  suggestionsContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  suggestionButton: {
    marginBottom: 8,
    minWidth: 120,
  },
});