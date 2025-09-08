/*
  LearnStartScreen.tsx — React Native 버전
  ------------------------------------------------------------
  웹 LearnStart.jsx를 모바일 앱에 맞게 리팩토링
*/

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { apiClient } from '../services/apiClient';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'LearnStart'>;

export default function LearnStartScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartSession = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 1. 백엔드에 새로운 학습 세션 배치를 생성하도록 요청합니다.
      await apiClient.post('/learn/flash/start');
      
      // 2. 성공하면 실제 학습 화면으로 이동합니다.
      navigation.navigate('LearnVocab', { mode: 'batch' });
      
    } catch (e: any) {
      console.error("학습 세션 시작 실패:", e);
      const errorMessage = e.message || '학습 세션을 시작하지 못했습니다. 다시 시도해 주세요.';
      setError(errorMessage);
      Alert.alert('오류', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFromWordbook = () => {
    navigation.navigate('MyWordbook');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>SRS 학습 시작</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          {/* Error Alert */}
          {error && (
            <View style={styles.errorContainer}>
              <View style={styles.errorAlert}>
                <Icon name="warning" size={20} color="#dc3545" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            </View>
          )}

          {/* Info Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoIconContainer}>
              <Icon name="school" size={48} color="#007AFF" />
            </View>
            
            <Text style={styles.infoTitle}>스마트 학습 시작</Text>
            <Text style={styles.infoDescription}>
              오늘 학습할 단어들을 10개 단위로 나누어{'\n'}
              플래시카드와 퀴즈를 진행합니다.
            </Text>

            {/* Learning Benefits */}
            <View style={styles.benefitsList}>
              <View style={styles.benefitItem}>
                <Icon name="checkmark-circle" size={20} color="#10b981" />
                <Text style={styles.benefitText}>적응형 학습 알고리즘</Text>
              </View>
              <View style={styles.benefitItem}>
                <Icon name="checkmark-circle" size={20} color="#10b981" />
                <Text style={styles.benefitText}>개인별 맞춤 진도 조절</Text>
              </View>
              <View style={styles.benefitItem}>
                <Icon name="checkmark-circle" size={20} color="#10b981" />
                <Text style={styles.benefitText}>과학적인 간격 반복</Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.primaryButton]}
              onPress={handleStartSession}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="white" />
                  <Text style={styles.primaryButtonText}>준비 중...</Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <Icon name="play-circle" size={24} color="white" />
                  <Text style={styles.primaryButtonText}>자동 학습 시작</Text>
                </View>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={handleSelectFromWordbook}
              disabled={loading}
              activeOpacity={0.8}
            >
              <View style={styles.buttonContent}>
                <Icon name="book" size={24} color="#007AFF" />
                <Text style={styles.secondaryButtonText}>
                  내 단어장에서 선택하여 학습
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Additional Options */}
          <View style={styles.additionalOptions}>
            <TouchableOpacity 
              style={styles.optionButton}
              onPress={() => navigation.navigate('SrsDashboard')}
              activeOpacity={0.7}
            >
              <Icon name="analytics" size={20} color="#666" />
              <Text style={styles.optionButtonText}>학습 통계 보기</Text>
              <Icon name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.optionButton}
              onPress={() => navigation.navigate('WrongAnswers')}
              activeOpacity={0.7}
            >
              <Icon name="refresh-circle" size={20} color="#666" />
              <Text style={styles.optionButtonText}>오답노트 복습</Text>
              <Icon name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerRight: {
    width: 32,
  },
  mainContent: {
    flex: 1,
    padding: 20,
  },
  errorContainer: {
    marginBottom: 20,
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
  },
  errorText: {
    color: '#721c24',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 24,
  },
  infoIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f9ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  infoDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  benefitsList: {
    alignSelf: 'stretch',
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  benefitText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  actionButtons: {
    gap: 16,
    marginBottom: 32,
  },
  actionButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
    textAlign: 'center',
    flex: 1,
  },
  additionalOptions: {
    gap: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  optionButtonText: {
    color: '#666',
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
});