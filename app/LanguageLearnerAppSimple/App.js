import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Language Learner</Text>
        <Text style={styles.headerSubtitle}>오늘도 새로운 언어를 배워보세요!</Text>
      </View>

      {/* Main Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Learning Progress */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📈 학습 진도</Text>
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>오늘 학습한 단어: 15개</Text>
            <Text style={styles.progressText}>연속 학습일: 7일</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⚡ 빠른 학습</Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.buttonText}>📚 단어 학습</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.buttonText}>🎧 듣기 연습</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.buttonText}>✍️ 문법 퀴즈</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.buttonText}>📖 단어장</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Daily Challenge */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🎯 오늘의 도전</Text>
          <View style={styles.challengeContainer}>
            <Text style={styles.challengeText}>새로운 단어 10개 학습하기</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '60%' }]} />
            </View>
            <Text style={styles.progressLabel}>6/10 완료</Text>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🕒 최근 활동</Text>
          <View style={styles.activityItem}>
            <Text style={styles.activityText}>• "Apple" - 사과 (5분 전)</Text>
          </View>
          <View style={styles.activityItem}>
            <Text style={styles.activityText}>• 문법 퀴즈 완료 (1시간 전)</Text>
          </View>
          <View style={styles.activityItem}>
            <Text style={styles.activityText}>• 듣기 연습 (어제)</Text>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#4f46e5',
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#e0e7ff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#1f2937',
  },
  progressContainer: {
    gap: 8,
  },
  progressText: {
    fontSize: 16,
    color: '#6b7280',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#4f46e5',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  challengeContainer: {
    gap: 10,
  },
  challengeText: {
    fontSize: 16,
    color: '#374151',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'right',
  },
  activityItem: {
    paddingVertical: 8,
  },
  activityText: {
    fontSize: 15,
    color: '#4b5563',
  },
});
