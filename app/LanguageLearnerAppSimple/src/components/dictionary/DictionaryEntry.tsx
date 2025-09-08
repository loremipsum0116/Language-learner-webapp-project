import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Audio } from 'expo-av';
import { DictionaryEntry as DictionaryEntryType } from '@/types';
import { useColors } from '@/theme';
import { Button } from '@/components/common/Button';

interface DictionaryEntryProps {
  entry: DictionaryEntryType;
  onAddToWordbook?: (entry: DictionaryEntryType) => void;
  showAddButton?: boolean;
}

export const DictionaryEntry: React.FC<DictionaryEntryProps> = ({
  entry,
  onAddToWordbook,
  showAddButton = true
}) => {
  const colors = useColors();
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const playAudio = async () => {
    if (!entry.audioUrl) return;

    try {
      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.createAsync(
        { uri: entry.audioUrl },
        { shouldPlay: true }
      );
      
      setSound(newSound);
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && !status.isPlaying) {
          setIsPlaying(false);
        }
      });
    } catch (error) {
      console.error('Audio playback error:', error);
      setIsPlaying(false);
    }
  };

  React.useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const getPartOfSpeechColor = (pos: string) => {
    const colorMap: { [key: string]: string } = {
      'noun': colors.primary,
      'verb': colors.success,
      'adjective': colors.warning,
      'adverb': colors.info,
      'preposition': colors.textSecondary,
      'conjunction': colors.textSecondary,
      'pronoun': colors.textSecondary,
    };
    return colorMap[pos.toLowerCase()] || colors.textSecondary;
  };

  const getFrequencyColor = (frequency: number) => {
    if (frequency >= 8) return colors.success;
    if (frequency >= 6) return colors.warning;
    if (frequency >= 4) return colors.error;
    return colors.textSecondary;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={styles.wordInfo}>
          <Text style={[styles.word, { color: colors.text }]}>{entry.word}</Text>
          
          <View style={styles.wordMeta}>
            {entry.phonetic && (
              <Text style={[styles.phonetic, { color: colors.textSecondary }]}>
                /{entry.phonetic}/
              </Text>
            )}
            
            {entry.pronunciation && (
              <Text style={[styles.pronunciation, { color: colors.textSecondary }]}>
                {entry.pronunciation}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.headerActions}>
          {entry.audioUrl && (
            <TouchableOpacity 
              style={[styles.audioButton, { backgroundColor: colors.primary + '20' }]}
              onPress={playAudio}
              disabled={isPlaying}
            >
              <Text style={[styles.audioButtonText, { color: colors.primary }]}>
                {isPlaying ? '🔊' : '🔈'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.badges}>
        <View style={[styles.posBadge, { backgroundColor: getPartOfSpeechColor(entry.partOfSpeech) + '20' }]}>
          <Text style={[styles.posText, { color: getPartOfSpeechColor(entry.partOfSpeech) }]}>
            {entry.partOfSpeech}
          </Text>
        </View>

        {entry.level && (
          <View style={[styles.levelBadge, { backgroundColor: colors.info + '20' }]}>
            <Text style={[styles.levelText, { color: colors.info }]}>
              {entry.level}
            </Text>
          </View>
        )}

        {entry.frequency && (
          <View style={[styles.frequencyBadge, { backgroundColor: getFrequencyColor(entry.frequency) + '20' }]}>
            <Text style={[styles.frequencyText, { color: getFrequencyColor(entry.frequency) }]}>
              Freq: {entry.frequency}/10
            </Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.definitionsContainer}>
        {entry.definitions.map((definition, index) => (
          <View key={definition.id || index} style={styles.definition}>
            <Text style={[styles.definitionNumber, { color: colors.primary }]}>
              {index + 1}.
            </Text>
            
            <View style={styles.definitionContent}>
              <Text style={[styles.meaning, { color: colors.text }]}>
                {definition.meaning}
              </Text>

              {definition.translation && (
                <Text style={[styles.translation, { color: colors.textSecondary }]}>
                  {definition.translation}
                </Text>
              )}

              {definition.usage && (
                <Text style={[styles.usage, { color: colors.textSecondary }]}>
                  Usage: {definition.usage}
                </Text>
              )}

              {definition.synonyms && definition.synonyms.length > 0 && (
                <Text style={[styles.synonyms, { color: colors.success }]}>
                  Synonyms: {definition.synonyms.join(', ')}
                </Text>
              )}

              {definition.antonyms && definition.antonyms.length > 0 && (
                <Text style={[styles.antonyms, { color: colors.error }]}>
                  Antonyms: {definition.antonyms.join(', ')}
                </Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {entry.examples.length > 0 && (
        <View style={styles.examplesContainer}>
          <Text style={[styles.examplesTitle, { color: colors.text }]}>Examples:</Text>
          {entry.examples.slice(0, 3).map((example, index) => (
            <Text key={index} style={[styles.example, { color: colors.textSecondary }]}>
              • {example}
            </Text>
          ))}
        </View>
      )}

      {showAddButton && onAddToWordbook && (
        <View style={styles.actions}>
          <Button
            title="Add to Wordbook"
            onPress={() => onAddToWordbook(entry)}
            variant="primary"
            size="small"
            style={styles.addButton}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  wordInfo: {
    flex: 1,
  },
  word: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  wordMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  phonetic: {
    fontSize: 16,
    fontStyle: 'italic',
    marginRight: 12,
  },
  pronunciation: {
    fontSize: 14,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  audioButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioButtonText: {
    fontSize: 18,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  posBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 4,
  },
  posText: {
    fontSize: 12,
    fontWeight: '600',
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 4,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  frequencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 4,
  },
  frequencyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  definitionsContainer: {
    maxHeight: 200,
    marginBottom: 12,
  },
  definition: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  definitionNumber: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
    marginTop: 2,
  },
  definitionContent: {
    flex: 1,
  },
  meaning: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 4,
  },
  translation: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  usage: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 4,
  },
  synonyms: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 2,
  },
  antonyms: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 2,
  },
  examplesContainer: {
    marginBottom: 12,
  },
  examplesTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  example: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
    paddingLeft: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  addButton: {
    minWidth: 120,
  },
});