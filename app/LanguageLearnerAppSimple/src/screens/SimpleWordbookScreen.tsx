// Simple Wordbook Screen for Expo Go compatibility
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/SimpleAuthContext';
import { apiClient } from '../services/SimpleApiClient';

interface WordbookItem {
  id: number;
  lemma: string;
  category?: {
    id: number;
    name: string;
  };
  createdAt: string;
}

const SimpleWordbookScreen: React.FC = () => {
  const { user } = useAuth();
  const [words, setWords] = useState<WordbookItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadWordbook();
  }, []);

  const loadWordbook = async () => {
    setLoading(true);
    try {
      const response = await apiClient.request('/my-wordbook');
      setWords(response.data?.words || []);
    } catch (error) {
      console.error('Failed to load wordbook:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderWord = ({ item }: { item: WordbookItem }) => (
    <View style={styles.wordCard}>
      <Text style={styles.wordText}>{item.lemma}</Text>
      {item.category && (
        <Text style={styles.categoryText}>{item.category.name}</Text>
      )}
      <Text style={styles.dateText}>
        {new Date(item.createdAt).toLocaleDateString('ko-KR')}
      </Text>
    </View>
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loginPrompt}>
          <Text style={styles.loginText}>로그인이 필요합니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>내 단어장</Text>
        <Text style={styles.subtitle}>{words.length}개의 단어</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={words}
          renderItem={renderWord}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>저장된 단어가 없습니다.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 20,
  },
  wordCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  categoryText: {
    fontSize: 12,
    color: '#3b82f6',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginHorizontal: 8,
  },
  dateText: {
    fontSize: 12,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
  },
  loginPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 18,
    color: '#6b7280',
  },
});

export default SimpleWordbookScreen;