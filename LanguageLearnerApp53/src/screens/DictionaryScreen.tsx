// src/screens/DictionaryScreen.tsx
// 사전 검색 화면 (React Native 버전) - Dict.jsx 기능 구현

import React, { useState, useCallback, useRef, useEffect } from 'react';
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
  Keyboard,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Sound from 'react-native-sound';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../services/apiClient';
import { MainStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'Dictionary'>;

interface DictionaryEntry {
  id?: number;
  lemma: string;
  pos?: string;
  levelCEFR?: string;
  ipa?: string;
  audio?: string;
  license?: string;
  attribution?: string;
  examples?: Array<{
    kind?: 'gloss' | 'example' | 'usage';
    de?: string;
    en?: string;
    ko?: string;
    cefr?: string;
    chirpScript?: string;
  }>;
  ko_gloss?: string;
}

interface AudioPlayerProps {
  src?: string;
  license?: string;
  attribution?: string;
}

// Audio Player Component
const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, license, attribution }) => {
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<Sound | null>(null);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.stop();
        soundRef.current.release();
      }
    };
  }, []);

  const playAudio = useCallback(() => {
    if (!src) return;

    if (soundRef.current) {
      soundRef.current.stop();
      soundRef.current.release();
    }

    const sound = new Sound(src, '', (error) => {
      if (error) {
        console.error('Failed to load sound', error);
        Alert.alert('오류', '오디오를 재생할 수 없습니다.');
        return;
      }

      sound.setSpeed(playbackRate);
      sound.play((success) => {
        if (success) {
          setIsPlaying(false);
        }
      });
      setIsPlaying(true);
    });

    soundRef.current = sound;
  }, [src, playbackRate]);

  if (!src) return null;

  return (
    <View style={styles.audioContainer}>
      <View style={styles.audioControls}>
        <TouchableOpacity
          style={[styles.playButton, isPlaying && styles.playButtonActive]}
          onPress={playAudio}
        >
          <Text style={styles.playButtonText}>{isPlaying ? '⏸' : '▶️'} 발음 듣기</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.speedControls}>
        <Text style={styles.speedLabel}>속도:</Text>
        {[0.75, 1.0, 1.25].map((rate) => (
          <TouchableOpacity
            key={rate}
            style={[
              styles.speedButton,
              playbackRate === rate && styles.speedButtonActive,
            ]}
            onPress={() => setPlaybackRate(rate)}
          >
            <Text
              style={[
                styles.speedButtonText,
                playbackRate === rate && styles.speedButtonTextActive,
              ]}
            >
              {rate.toFixed(2)}×
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {(license || attribution) && (
        <Text style={styles.attribution}>
          {license} {attribution ? ` | © ${attribution}` : ''}
        </Text>
      )}
    </View>
  );
};

const DictionaryScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    setLatency(null);
    setEntries([]);
    Keyboard.dismiss();

    try {
      const startTime = Date.now();
      
      // Call dict/search API
      const response = await apiClient.dictionary.search(searchQuery.trim());
      
      const endTime = Date.now();
      setLatency(endTime - startTime);
      
      const entriesData = (response as any)?.data?.entries || 
                         (response as any)?.entries || 
                         [];
      setEntries(entriesData);
      
      if (entriesData.length === 0) {
        setError('검색 결과가 없습니다.');
      }
    } catch (err: any) {
      console.error('Search failed:', err);
      setError(err?.status === 401 
        ? '로그인이 필요합니다.' 
        : `검색 실패: ${err?.message || '알 수 없는 오류'}`);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  const handleBookmark = async (vocabId: number) => {
    try {
      await apiClient.request(`/vocab/${vocabId}/bookmark`, {
        method: 'POST',
      });
      Alert.alert('성공', '내 단어장에 추가되었습니다.');
    } catch (err: any) {
      if (err?.status === 401) {
        Alert.alert('로그인 필요', '로그인이 필요합니다.');
      } else {
        Alert.alert('오류', `추가 실패: ${err?.message || ''}`);
      }
    }
  };

  const renderEntry = ({ item }: { item: DictionaryEntry }) => {
    // Extract Korean gloss from examples
    const koGloss = Array.isArray(item.examples)
      ? item.examples.find(ex => ex && (ex.kind === 'gloss' || (!ex.de && ex.ko)))?.ko
      : item.ko_gloss;

    return (
      <View style={styles.entryCard}>
        <View style={styles.entryHeader}>
          <View style={styles.entryTitleRow}>
            <Text style={styles.entryWord}>{item.lemma}</Text>
            {item.pos && <Text style={styles.entryPos}>{item.pos}</Text>}
          </View>
          {user && item.id && (
            <TouchableOpacity
              style={styles.bookmarkButton}
              onPress={() => handleBookmark(item.id!)}
            >
              <Text style={styles.bookmarkButtonText}>단어장 추가</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {item.ipa && (
          <Text style={styles.entryPronunciation}>/{item.ipa}/</Text>
        )}
        
        <AudioPlayer 
          src={item.audio} 
          license={item.license} 
          attribution={item.attribution} 
        />
        
        {koGloss && (
          <View style={styles.glossContainer}>
            <Text style={styles.glossLabel}>뜻:</Text>
            <Text style={styles.glossText}>{koGloss}</Text>
          </View>
        )}
        
        {Array.isArray(item.examples) && item.examples.length > 0 && (
          <View style={styles.examplesContainer}>
            {item.examples.map((ex, idx) => (
              ex.de || ex.en ? (
                <View key={idx} style={styles.exampleItem}>
                  <Text style={styles.exampleText}>
                    • {ex.de || ex.en}
                    {ex.ko && <Text style={styles.exampleKo}> — {ex.ko}</Text>}
                  </Text>
                  {ex.cefr && (
                    <Text style={styles.exampleCefr}>({ex.cefr})</Text>
                  )}
                </View>
              ) : null
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Text style={styles.title}>사전</Text>
        </View>

        <View style={styles.searchContainer}>
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="영어 단어 또는 한국어 뜻을 입력하세요"
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearch}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.searchButtonText}>검색</Text>
            )}
          </TouchableOpacity>
        </View>

        {latency !== null && (
          <Text style={styles.latencyText}>API {latency}ms</Text>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <FlatList
          data={entries}
          renderItem={renderEntry}
          keyExtractor={(item, index) => item.id?.toString() || index.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            !loading && searchQuery && !error ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>검색 결과가 없습니다.</Text>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
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
    color: '#1f2937',
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
  latencyText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
  },
  errorContainer: {
    margin: 20,
    padding: 15,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 14,
    lineHeight: 20,
  },
  listContent: {
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 16,
  },
  entryCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  entryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  entryWord: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  entryPos: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  bookmarkButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  bookmarkButtonText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '500',
  },
  entryPronunciation: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  audioContainer: {
    marginVertical: 10,
  },
  audioControls: {
    marginBottom: 8,
  },
  playButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  playButtonActive: {
    backgroundColor: '#1e40af',
  },
  playButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  speedControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  speedLabel: {
    fontSize: 14,
    color: '#4b5563',
    marginRight: 4,
  },
  speedButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#3b82f6',
    backgroundColor: 'white',
  },
  speedButtonActive: {
    backgroundColor: '#3b82f6',
  },
  speedButtonText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '500',
  },
  speedButtonTextActive: {
    color: 'white',
  },
  attribution: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
  glossContainer: {
    flexDirection: 'row',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  glossLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
    marginRight: 8,
  },
  glossText: {
    fontSize: 14,
    color: '#1f2937',
    flex: 1,
  },
  examplesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  exampleItem: {
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  exampleKo: {
    color: '#4b5563',
  },
  exampleCefr: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
});

export default DictionaryScreen;