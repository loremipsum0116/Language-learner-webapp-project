// src/screens/DictionaryScreen.tsx
// 사전 검색 화면 (React Native 버전) - Web Dict.jsx 기반 리팩토링

import React, { useEffect, useRef, useState } from 'react';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../services/apiClient';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Dictionary'>;

interface DictionaryEntry {
  id?: number;
  lemma: string;
  pos?: string;
  ipa?: string;
  audio?: string;
  license?: string;
  attribution?: string;
  examples?: Array<{
    kind?: 'gloss' | 'example' | 'usage';
    de?: string;
    ko?: string;
    cefr?: string;
  }>;
}

interface AudioPlayerProps {
  src?: string;
  license?: string;
  attribution?: string;
}

// 오디오 플레이어 컴포넌트 (웹 버전과 동일)
const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, license, attribution }) => {
  const [sound, setSound] = useState<Audio.Sound>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRate] = useState(1.0);

  const playSound = async () => {
    if (!src) return;
    
    try {
      if (sound) {
        await sound.unloadAsync();
      }
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: src },
        { shouldPlay: true, rate }
      );
      
      setSound(newSound);
      setIsPlaying(true);
      
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  const changeRate = async (newRate: number) => {
    setRate(newRate);
    if (sound) {
      await sound.setRateAsync(newRate, true);
    }
  };

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  if (!src) return null;

  return (
    <View style={styles.audioPlayer}>
      <TouchableOpacity style={styles.playButton} onPress={playSound}>
        <Icon 
          name={isPlaying ? "pause" : "play"} 
          size={20} 
          color="#007AFF" 
        />
      </TouchableOpacity>
      
      <View style={styles.speedControls}>
        <Text style={styles.speedLabel}>Speed</Text>
        {[0.75, 1.0, 1.25].map((r) => (
          <TouchableOpacity
            key={r}
            style={[
              styles.speedButton,
              rate === r && styles.speedButtonActive
            ]}
            onPress={() => changeRate(r)}
          >
            <Text style={[
              styles.speedButtonText,
              rate === r && styles.speedButtonTextActive
            ]}>
              {r.toFixed(2)}×
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

export default function DictionaryScreen({ navigation }: Props) {
  const { user } = useAuth(); // 로그인 여부(단어장 추가 버튼 노출 용도)

  const [q, setQ] = useState('');
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [err, setErr] = useState<any>(null);
  const inputRef = useRef<TextInput>(null);

  // 처음 열 때 검색창 포커스
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // /dict/search API만 직접 호출하도록 로직을 단순화합니다.
  const search = async () => {
    if (!q.trim()) return;

    setLoading(true);
    setErr(null);
    setLat(null);
    setEntries([]); // 이전 검색 결과 초기화

    try {
      const response = await apiClient.get(`/dict/search?q=${encodeURIComponent(q.trim())}`);
      setEntries(response?.data?.entries || response?.entries || []);
      setLat(response._latencyMs);
    } catch (error) {
      setErr(error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  // 단어장 북마크 → SRSCard 생성
  async function bookmark(vocabId: number) {
    try {
      await apiClient.post(`/vocab/${vocabId}/bookmark`);
      Alert.alert('성공', '내 단어장에 추가되었습니다.');
    } catch (e: any) {
      if (e.status === 401) Alert.alert('오류', '로그인이 필요합니다.');
      else Alert.alert('오류', '추가 실패: ' + (e.message || ''));
    }
  }

  const renderEntry = ({ item, index }: { item: DictionaryEntry; index: number }) => (
    <View key={item.id ?? index} style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <Text style={styles.lemmaText}>{item.lemma}</Text>
        <View style={styles.entryMeta}>
          <Text style={styles.posText}>{item.pos}</Text>
          {/* /vocab/search 결과에는 id가 있으므로 버튼 노출. /dict/search 폴백 결과에는 보통 id가 없어 숨김 */}
          {user && item.id && (
            <TouchableOpacity
              style={styles.bookmarkButton}
              onPress={() => bookmark(item.id!)}
            >
              <Text style={styles.bookmarkButtonText}>단어장 추가</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {item.ipa && (
        <Text style={styles.ipaText}>/{item.ipa}/</Text>
      )}

      <AudioPlayer 
        src={item.audio} 
        license={item.license} 
        attribution={item.attribution} 
      />

      {/* KO gloss 한 줄 표시 */}
      {(() => {
        const koGloss = Array.isArray(item.examples)
          ? item.examples.find(ex => ex && (ex.kind === 'gloss' || (!ex.de && ex.ko)))?.ko
          : null;
        return koGloss ? (
          <View style={styles.glossContainer}>
            <Text style={styles.glossLabel}>뜻: </Text>
            <Text style={styles.glossText}>{koGloss}</Text>
          </View>
        ) : null;
      })()}

      {Array.isArray(item.examples) && item.examples.length > 0 && (
        <View style={styles.examplesContainer}>
          {item.examples.map((ex, idx) => (
            <View key={idx} style={styles.exampleItem}>
              <Text style={styles.exampleEn}>{ex.de}</Text>
              {ex.ko ? <Text style={styles.exampleKo}> — {ex.ko}</Text> : null}
              {ex.cefr ? <Text style={styles.cefrLabel}> ({ex.cefr})</Text> : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* 제목 */}
        <View style={styles.header}>
          <Text style={styles.title}>사전</Text>
        </View>

        {/* 검색 입력 */}
        <View style={styles.searchContainer}>
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="영어 단어 또는 한국어 뜻을 입력하세요"
            value={q}
            onChangeText={setQ}
            onSubmitEditing={search}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          <TouchableOpacity 
            style={styles.searchButton} 
            onPress={search}
            disabled={loading}
          >
            <Text style={styles.searchButtonText}>
              {loading ? '검색 중…' : '검색'}
            </Text>
          </TouchableOpacity>
        </View>

        {lat !== null && (
          <Text style={styles.latencyText}>API {lat}ms</Text>
        )}
        
        {err && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              {err.status === 401 ? (
                '로그인이 필요합니다. 상단에서 로그인 후 다시 시도하세요.'
              ) : (
                '오류: ' + String(err.message || err)
              )}
            </Text>
          </View>
        )}

        {/* 검색 결과 */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>검색 중...</Text>
          </View>
        ) : (
          <FlatList
            data={entries}
            renderItem={renderEntry}
            keyExtractor={(item, index) => item.id?.toString() || index.toString()}
            style={styles.resultsContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              entries.length === 0 && !loading ? (
                <Text style={styles.emptyText}>검색 결과가 없습니다.</Text>
              ) : null
            }
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  searchButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  latencyText: {
    fontSize: 12,
    color: '#666',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  errorContainer: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  errorText: {
    color: '#721c24',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 40,
  },
  entryCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  lemmaText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  entryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  posText: {
    fontSize: 14,
    color: '#666',
  },
  bookmarkButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  bookmarkButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  ipaText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  audioPlayer: {
    marginVertical: 8,
  },
  playButton: {
    alignSelf: 'flex-start',
    padding: 4,
  },
  speedControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  speedLabel: {
    fontSize: 12,
    color: '#666',
  },
  speedButton: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  speedButtonActive: {
    backgroundColor: '#007AFF',
  },
  speedButtonText: {
    fontSize: 12,
    color: '#007AFF',
  },
  speedButtonTextActive: {
    color: 'white',
  },
  attribution: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
  glossContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  glossLabel: {
    fontWeight: 'bold',
    color: '#333',
  },
  glossText: {
    color: '#333',
    flex: 1,
  },
  examplesContainer: {
    marginTop: 8,
  },
  exampleItem: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  exampleEn: {
    color: '#333',
  },
  exampleKo: {
    color: '#666',
  },
  cefrLabel: {
    color: '#999',
    fontSize: 12,
  },
});