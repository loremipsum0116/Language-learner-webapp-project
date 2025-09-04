/*
  LandingPageScreen.tsx — React Native 버전
  ------------------------------------------------------------
  웹 LandingPage.jsx를 모바일 앱에 맞게 리팩토링
*/

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useAuth } from '../hooks/useAuth';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'LandingPage'>;

const { width, height } = Dimensions.get('window');

interface FeatureCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  subtitle: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description, subtitle }) => (
  <View style={styles.featureCard}>
    <View style={styles.featureIconContainer}>
      <Ionicons name={icon} size={48} color="#007AFF" />
    </View>
    <Text style={styles.featureTitle}>{title}</Text>
    <Text style={styles.featureDescription}>{description}</Text>
    <Text style={styles.featureSubtitle}>{subtitle}</Text>
  </View>
);

export default function LandingPageScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [videoStatus, setVideoStatus] = useState<any>({});

  useEffect(() => {
    // Auto-navigation after delay (optional)
    const timer = setTimeout(() => {
      handleSkip();
    }, 60000); // Auto skip after 60 seconds

    return () => clearTimeout(timer);
  }, []);

  const handleGetStarted = () => {
    if (user) {
      navigation.navigate('Home');
    } else {
      navigation.navigate('Login');
    }
  };

  const handleSkip = () => {
    navigation.navigate('Home');
  };

  const handleVideoPress = () => {
    // Toggle video mute/unmute or play/pause
    if (videoStatus.isPlaying) {
      // Video controls will be handled by expo-av
      console.log('Video is playing');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Image 
            source={require('../../assets/danmoosae.png')} 
            style={styles.heroImage}
            resizeMode="contain"
          />
          <Text style={styles.heroTitle}>
            단무새와 함께하는{'\n'}English Learning
          </Text>
          <Text style={styles.heroSubtitle}>
            과학적인 간격 반복 학습으로{'\n'}영어를 완벽하게 마스터하세요
          </Text>
          <Text style={styles.heroSubtitleEn}>
            Scientific spaced repetition system{'\n'}for mastering English
          </Text>
          
          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.primaryButton]}
              onPress={handleGetStarted}
              activeOpacity={0.8}
            >
              <Ionicons name="rocket" size={20} color="white" style={styles.buttonIcon} />
              <Text style={styles.primaryButtonText}>Start Learning</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={handleSkip}
              activeOpacity={0.8}
            >
              <Ionicons name="eye" size={20} color="#007AFF" style={styles.buttonIcon} />
              <Text style={styles.secondaryButtonText}>Explore Demo</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Video Section */}
        <View style={styles.videoSection}>
          <View style={styles.videoContainer}>
            <Video
              style={styles.video}
              source={{
                uri: 'http://localhost:4000/api/video/final_23sec_video.mp4',
              }}
              shouldPlay={false}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              isLooping={false}
              onPlaybackStatusUpdate={(status) => setVideoStatus(status)}
              onError={(error) => {
                console.log('Video error:', error);
                Alert.alert('비디오 오류', '비디오를 불러올 수 없습니다.');
              }}
            />
            <TouchableOpacity 
              style={styles.videoOverlay} 
              onPress={handleVideoPress}
              activeOpacity={0.7}
            >
              {!videoStatus.isPlaying && (
                <View style={styles.playButton}>
                  <Ionicons name="play" size={40} color="white" />
                </View>
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.videoDescription}>
            단무새 학습 시스템을 미리 체험해보세요!
          </Text>
        </View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>주요 기능</Text>
          
          <FeatureCard
            icon="person"
            title="Personalized Learning"
            description="Adaptive curriculum based on your progress"
            subtitle="당신의 진도에 맞춘 맞춤형 커리큘럼"
          />
          
          <FeatureCard
            icon="refresh"
            title="SRS Memory System"
            description="Scientific spaced repetition for long-term retention"
            subtitle="과학적인 간격 반복으로 장기 기억 향상"
          />
          
          <FeatureCard
            icon="game-controller"
            title="Interactive Quizzes"
            description="Engaging quizzes in various formats for fun learning"
            subtitle="다양한 형태의 퀴즈로 재미있는 학습"
          />
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomSection}>
          <TouchableOpacity 
            style={styles.skipButton}
            onPress={handleSkip}
            activeOpacity={0.7}
          >
            <Text style={styles.skipButtonText}>Skip Intro</Text>
            <Ionicons name="arrow-forward" size={16} color="#666" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 40,
    backgroundColor: 'white',
  },
  heroImage: {
    width: 100,
    height: 100,
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 36,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  heroSubtitleEn: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 32,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  actionButtons: {
    width: '100%',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  buttonIcon: {
    marginRight: 8,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 18,
    fontWeight: '600',
  },
  videoSection: {
    paddingHorizontal: 20,
    paddingVertical: 32,
    alignItems: 'center',
  },
  videoContainer: {
    position: 'relative',
    width: '100%',
    height: Math.min(width * 0.6, 300),
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
  featuresSection: {
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  featuresTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 32,
  },
  featureCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  featureIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f9ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  featureSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  bottomSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipButtonText: {
    fontSize: 16,
    color: '#666',
  },
});