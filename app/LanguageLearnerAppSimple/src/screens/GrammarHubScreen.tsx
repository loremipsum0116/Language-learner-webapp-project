/*
  GrammarHubScreen.tsx — React Native 버전
  ------------------------------------------------------------
  웹 GrammarHub.jsx를 모바일 앱에 맞게 리팩토링
*/

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'GrammarHub'>;

// Mock grammar topics data
const grammarTopics = [
  {
    id: 1,
    title: 'Present Simple',
    description: '현재 시제의 기본 형태와 사용법을 배웁니다.',
    level: 'A1',
  },
  {
    id: 2,
    title: 'Present Continuous',
    description: '현재 진행형의 형태와 용법을 학습합니다.',
    level: 'A1',
  },
  {
    id: 3,
    title: 'Past Simple',
    description: '과거 시제의 기본 형태와 불규칙 동사를 배웁니다.',
    level: 'A2',
  },
  {
    id: 4,
    title: 'Present Perfect',
    description: '현재 완료 시제의 개념과 용법을 익힙니다.',
    level: 'B1',
  },
  {
    id: 5,
    title: 'Conditional Sentences',
    description: '조건문의 종류와 각각의 사용법을 학습합니다.',
    level: 'B2',
  },
  {
    id: 6,
    title: 'Passive Voice',
    description: '수동태의 형태와 능동태에서 수동태로의 변환을 배웁니다.',
    level: 'B1',
  },
];

interface GrammarTopic {
  id: number;
  title: string;
  description: string;
  level: string;
}

interface LevelSectionProps {
  level: string;
  topics: GrammarTopic[];
  navigation: any;
}

const LevelSection: React.FC<LevelSectionProps> = ({ level, topics, navigation }) => {
  const renderTopicItem = ({ item }: { item: GrammarTopic }) => (
    <TouchableOpacity
      style={styles.topicCard}
      onPress={() => navigation.navigate('GrammarLesson', { topicId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.topicContent}>
        <Text style={styles.topicTitle}>{item.title}</Text>
        <Text style={styles.topicDescription}>{item.description}</Text>
        <View style={styles.topicFooter}>
          <Text style={styles.startButtonText}>학습 시작</Text>
          <Icon name="arrow-forward" size={16} color="#007AFF" />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.levelSection}>
      <View style={styles.levelHeader}>
        <View style={styles.levelIndicator} />
        <Text style={styles.levelTitle}>CEFR {level}</Text>
      </View>
      <FlatList
        data={topics}
        renderItem={renderTopicItem}
        keyExtractor={(item) => item.id.toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.topicsList}
        ItemSeparatorComponent={() => <View style={styles.topicSeparator} />}
      />
    </View>
  );
};

export default function GrammarHubScreen({ navigation }: Props) {
  // Group topics by level
  const topicsByLevel = grammarTopics.reduce((acc, topic) => {
    if (!acc[topic.level]) {
      acc[topic.level] = [];
    }
    acc[topic.level].push(topic);
    return acc;
  }, {} as Record<string, GrammarTopic[]>);

  // Sort levels by difficulty
  const levelOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const sortedLevels = Object.keys(topicsByLevel).sort((a, b) => {
    const aIndex = levelOrder.indexOf(a);
    const bIndex = levelOrder.indexOf(b);
    return aIndex - bIndex;
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>문법 학습</Text>
          <Text style={styles.headerDescription}>
            영어 문법의 기초를 다져보세요. 학습하고 싶은 주제를 선택하세요.
          </Text>
        </View>

        {/* Grammar Topics by Level */}
        {sortedLevels.map((level) => (
          <LevelSection
            key={level}
            level={level}
            topics={topicsByLevel[level]}
            navigation={navigation}
          />
        ))}

        {/* Empty State or Additional Info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            💡 각 레벨별로 단계적으로 학습하시면 더욱 효과적입니다!
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  headerDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  levelSection: {
    marginBottom: 24,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 12,
  },
  levelIndicator: {
    width: 4,
    height: 24,
    backgroundColor: '#007AFF',
    marginRight: 12,
  },
  levelTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  topicsList: {
    paddingHorizontal: 20,
  },
  topicSeparator: {
    width: 12,
  },
  topicCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    width: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  topicContent: {
    flex: 1,
  },
  topicTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  topicDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
    minHeight: 40,
  },
  topicFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f3f5',
  },
  startButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});