// Placeholder Screen for features in development
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';

interface PlaceholderScreenProps {
  title: string;
  subtitle: string;
  icon: string;
  navigation?: any;
}

const PlaceholderScreen: React.FC<PlaceholderScreenProps> = ({
  title,
  subtitle,
  icon,
  navigation,
}) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Text style={styles.description}>
          이 기능은 현재 개발 중입니다.{'\n'}
          곧 업데이트될 예정입니다!
        </Text>
        
        {navigation && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>돌아가기</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  icon: {
    fontSize: 64,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  backButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

// Pre-configured screens
export const ReadingPlaceholder = ({ navigation }: any) => (
  <PlaceholderScreen
    title="리딩 연습"
    subtitle="독해 실력 향상"
    icon="📖"
    navigation={navigation}
  />
);

export const ListeningPlaceholder = ({ navigation }: any) => (
  <PlaceholderScreen
    title="리스닝 연습"
    subtitle="듣기 실력 향상"
    icon="🎧"
    navigation={navigation}
  />
);

export const QuizPlaceholder = ({ navigation }: any) => (
  <PlaceholderScreen
    title="퀴즈"
    subtitle="문법 및 어휘 테스트"
    icon="🧠"
    navigation={navigation}
  />
);

export const SrsPlaceholder = ({ navigation }: any) => (
  <PlaceholderScreen
    title="SRS 학습"
    subtitle="간격 반복 시스템"
    icon="🎯"
    navigation={navigation}
  />
);

export default PlaceholderScreen;