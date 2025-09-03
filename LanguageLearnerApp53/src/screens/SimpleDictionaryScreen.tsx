// Simple Dictionary Screen for Expo Go compatibility
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../context/SimpleAuthContext';
import { apiClient } from '../services/SimpleApiClient';

interface DictionaryEntry {
  id: number;
  lemma: string;
  pos?: string;
  ipa?: string;
  examples?: Array<{
    kind?: string;
    ko?: string;
    en?: string;
  }>;
  ko_gloss?: string;
}

const SimpleDictionaryScreen: React.FC = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const response = await apiClient.dictionary.search(searchQuery.trim());
      setEntries(response.data?.entries || []);
    } catch (error) {
      Alert.alert('오류', '검색에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const renderEntry = ({ item }: { item: DictionaryEntry }) => {
    const koGloss = item.examples?.find(ex => ex.kind === 'gloss')?.ko || item.ko_gloss;
    
    return (
      <View style={styles.entryCard}>
        <Text style={styles.entryWord}>{item.lemma}</Text>
        {item.pos && <Text style={styles.entryPos}>{item.pos}</Text>}
        {item.ipa && <Text style={styles.entryIpa}>/{item.ipa}/</Text>}
        {koGloss && <Text style={styles.entryGloss}>{koGloss}</Text>}
        
        {item.examples?.map((ex, idx) => (
          ex.en && (
            <View key={idx} style={styles.exampleContainer}>
              <Text style={styles.exampleEn}>{ex.en}</Text>
              {ex.ko && <Text style={styles.exampleKo}>{ex.ko}</Text>}
            </View>
          )
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="영어 단어를 입력하세요"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSearch}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.searchButtonText}>검색</Text>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={entries}
        renderItem={renderEntry}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  searchButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 20,
  },
  entryCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  entryWord: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  entryPos: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  entryIpa: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  entryGloss: {
    fontSize: 16,
    color: '#1f2937',
    marginBottom: 8,
  },
  exampleContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  exampleEn: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  exampleKo: {
    fontSize: 14,
    color: '#6b7280',
  },
});

export default SimpleDictionaryScreen;