import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { Audio } from 'expo-av';
import { useColors } from '@/theme';
import { apiClient } from '@/services/apiClient';
import { Idiom, PhrasalVerb } from '@/types';
import { AlertBanner } from '@/components/common/AlertBanner';
import { Button } from '@/components/common/Button';

type TabType = 'idioms' | 'phrasal';

export const IdiomsScreen: React.FC = () => {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<TabType>('idioms');
  const [idioms, setIdioms] = useState<Idiom[]>([]);
  const [phrasalVerbs, setPhrasalVerbs] = useState<PhrasalVerb[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === 'idioms') {
        const response = await apiClient.idioms.getAll({ limit: 50 });
        setIdioms(response.data || []);
      } else {
        // For now, we'll use the idioms endpoint for phrasal verbs too
        // In a real app, there would be a separate phrasal verbs endpoint
        const response = await apiClient.idioms.getAll({ 
          category: 'phrasal-verb',
          limit: 50 
        });
        // Convert to phrasal verb format for display
        const mockPhrasalVerbs: PhrasalVerb[] = (response.data || []).map((item: any) => ({
          id: item.id,
          verb: item.phrase.split(' ')[0] || '',
          particle: item.phrase.split(' ').slice(1).join(' ') || '',
          meaning: item.meaning,
          translation: item.translation,
          type: 'separable',
          examples: item.examples || [],
          audioUrl: item.audioUrl,
          difficulty: item.difficulty,
        }));
        setPhrasalVerbs(mockPhrasalVerbs);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      setError(`Failed to load ${activeTab}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadData();
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.idioms.search(searchQuery);
      
      if (activeTab === 'idioms') {
        setIdioms(response.data || []);
      } else {
        const mockPhrasalVerbs: PhrasalVerb[] = (response.data || []).map((item: any) => ({
          id: item.id,
          verb: item.phrase.split(' ')[0] || '',
          particle: item.phrase.split(' ').slice(1).join(' ') || '',
          meaning: item.meaning,
          translation: item.translation,
          type: 'separable',
          examples: item.examples || [],
          audioUrl: item.audioUrl,
          difficulty: item.difficulty,
        }));
        setPhrasalVerbs(mockPhrasalVerbs);
      }
    } catch (err) {
      console.error('Search failed:', err);
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const playAudio = async (audioUrl?: string) => {
    if (!audioUrl) return;

    try {
      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );
      
      setSound(newSound);
    } catch (error) {
      console.error('Audio playback error:', error);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return colors.success;
      case 'medium': return colors.warning;
      case 'hard': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const renderIdiom = ({ item }: { item: Idiom }) => (
    <View style={[styles.itemContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.itemHeader}>
        <Text style={[styles.phrase, { color: colors.text }]}>{item.phrase}</Text>
        <View style={styles.headerActions}>
          {item.audioUrl && (
            <TouchableOpacity
              style={[styles.audioButton, { backgroundColor: colors.primary + '20' }]}
              onPress={() => playAudio(item.audioUrl)}
            >
              <Text style={[styles.audioButtonText, { color: colors.primary }]}>🔊</Text>
            </TouchableOpacity>
          )}
          <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(item.difficulty) + '20' }]}>
            <Text style={[styles.difficultyText, { color: getDifficultyColor(item.difficulty) }]}>
              {item.difficulty.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <Text style={[styles.meaning, { color: colors.text }]}>{item.meaning}</Text>
      
      {item.translation && (
        <Text style={[styles.translation, { color: colors.textSecondary }]}>{item.translation}</Text>
      )}

      <Text style={[styles.category, { color: colors.primary }]}>{item.category}</Text>

      {item.usage && (
        <Text style={[styles.usage, { color: colors.textSecondary }]}>{item.usage}</Text>
      )}

      {item.examples.length > 0 && (
        <View style={styles.examplesContainer}>
          <Text style={[styles.examplesTitle, { color: colors.text }]}>Examples:</Text>
          {item.examples.slice(0, 2).map((example, index) => (
            <Text key={index} style={[styles.example, { color: colors.textSecondary }]}>
              • {example}
            </Text>
          ))}
        </View>
      )}
    </View>
  );

  const renderPhrasalVerb = ({ item }: { item: PhrasalVerb }) => (
    <View style={[styles.itemContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.itemHeader}>
        <View style={styles.phrasalVerbHeader}>
          <Text style={[styles.verb, { color: colors.primary }]}>{item.verb}</Text>
          <Text style={[styles.particle, { color: colors.text }]}> {item.particle}</Text>
        </View>
        <View style={styles.headerActions}>
          {item.audioUrl && (
            <TouchableOpacity
              style={[styles.audioButton, { backgroundColor: colors.primary + '20' }]}
              onPress={() => playAudio(item.audioUrl)}
            >
              <Text style={[styles.audioButtonText, { color: colors.primary }]}>🔊</Text>
            </TouchableOpacity>
          )}
          <View style={[styles.typeBadge, { backgroundColor: colors.info + '20' }]}>
            <Text style={[styles.typeText, { color: colors.info }]}>
              {item.type.toUpperCase()}
            </Text>
          </View>
          <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(item.difficulty) + '20' }]}>
            <Text style={[styles.difficultyText, { color: getDifficultyColor(item.difficulty) }]}>
              {item.difficulty.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <Text style={[styles.meaning, { color: colors.text }]}>{item.meaning}</Text>
      
      {item.translation && (
        <Text style={[styles.translation, { color: colors.textSecondary }]}>{item.translation}</Text>
      )}

      {item.examples.length > 0 && (
        <View style={styles.examplesContainer}>
          <Text style={[styles.examplesTitle, { color: colors.text }]}>Examples:</Text>
          {item.examples.slice(0, 2).map((example, index) => (
            <Text key={index} style={[styles.example, { color: colors.textSecondary }]}>
              • {example}
            </Text>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]}>Idioms & Phrasal Verbs</Text>
        
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              { 
                backgroundColor: activeTab === 'idioms' ? colors.primary : 'transparent',
                borderColor: colors.primary 
              }
            ]}
            onPress={() => setActiveTab('idioms')}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === 'idioms' ? colors.background : colors.primary }
            ]}>
              Idioms
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.tab,
              { 
                backgroundColor: activeTab === 'phrasal' ? colors.primary : 'transparent',
                borderColor: colors.primary 
              }
            ]}
            onPress={() => setActiveTab('phrasal')}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === 'phrasal' ? colors.background : colors.primary }
            ]}>
              Phrasal Verbs
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.searchContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={`Search ${activeTab}...`}
            placeholderTextColor={colors.textSecondary}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity onPress={handleSearch} style={[styles.searchButton, { backgroundColor: colors.primary }]}>
            <Text style={[styles.searchButtonText, { color: colors.background }]}>🔍</Text>
          </TouchableOpacity>
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
            Loading {activeTab}...
          </Text>
        </View>
      ) : (
        <FlatList
          data={activeTab === 'idioms' ? idioms : phrasalVerbs}
          renderItem={activeTab === 'idioms' ? renderIdiom : renderPhrasalVerb}
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
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  searchButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: 16,
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
    paddingTop: 8,
    paddingBottom: 32,
  },
  itemContainer: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  phrase: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 12,
  },
  phrasalVerbHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  verb: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  particle: {
    fontSize: 20,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  audioButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  audioButtonText: {
    fontSize: 14,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 4,
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: '600',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 4,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  meaning: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
  },
  translation: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  category: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  usage: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 8,
  },
  examplesContainer: {
    marginTop: 8,
  },
  examplesTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  example: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 2,
  },
});