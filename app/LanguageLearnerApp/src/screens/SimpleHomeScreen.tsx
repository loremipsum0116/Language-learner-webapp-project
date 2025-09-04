import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

type RootStackParamList = {
  Home: undefined;
  Dictionary: undefined;
  VocabList: undefined;
  LearnVocab: undefined;
  GrammarHub: undefined;
  ListeningList: undefined;
  Login: undefined;
  [key: string]: undefined | object;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function SimpleHomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>
            🐥 Language Learner App
          </Text>
          <Text style={styles.heroSubtitle}>
            Welcome to your language learning journey!
          </Text>
        </View>

        {/* Navigation Grid */}
        <View style={styles.navigationGrid}>
          <TouchableOpacity
            style={styles.navCard}
            onPress={() => navigation.navigate('Dictionary')}
          >
            <Text style={styles.navCardIcon}>📚</Text>
            <Text style={styles.navCardTitle}>Dictionary</Text>
            <Text style={styles.navCardDescription}>Search words and pronunciation</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navCard}
            onPress={() => navigation.navigate('VocabList')}
          >
            <Text style={styles.navCardIcon}>📖</Text>
            <Text style={styles.navCardTitle}>Vocabulary</Text>
            <Text style={styles.navCardDescription}>Learn new words</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navCard}
            onPress={() => navigation.navigate('GrammarHub')}
          >
            <Text style={styles.navCardIcon}>📝</Text>
            <Text style={styles.navCardTitle}>Grammar</Text>
            <Text style={styles.navCardDescription}>Practice grammar rules</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navCard}
            onPress={() => navigation.navigate('ListeningList')}
          >
            <Text style={styles.navCardIcon}>🎧</Text>
            <Text style={styles.navCardTitle}>Listening</Text>
            <Text style={styles.navCardDescription}>Improve listening skills</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navCard}
            onPress={() => navigation.navigate('LearnVocab')}
          >
            <Text style={styles.navCardIcon}>🎯</Text>
            <Text style={styles.navCardTitle}>Learn</Text>
            <Text style={styles.navCardDescription}>Start learning session</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navCard}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.navCardIcon}>🔑</Text>
            <Text style={styles.navCardTitle}>Login</Text>
            <Text style={styles.navCardDescription}>Sign in to your account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Test Version - Black Screen Fixed! 🎉</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  heroSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  navigationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  navCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '47%',
    minHeight: 120,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  navCardIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  navCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  navCardDescription: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  footer: {
    marginTop: 32,
    padding: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: 'bold',
  },
});