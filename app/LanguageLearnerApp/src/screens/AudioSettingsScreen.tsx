import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {useTheme} from '../context/ThemeContext';
import VolumeControl from '../components/VolumeControl';
import AudioOptimizationService, {
  AudioOptimizationSettings,
  VolumeStatus,
  HeadphoneStatus,
} from '../services/AudioOptimizationService';
import HeadphoneDetection, {HeadphoneInfo} from '../utils/HeadphoneDetection';
import VoiceRecordingService from '../services/VoiceRecordingService';

const AudioSettingsScreen: React.FC = () => {
  const {colors} = useTheme();
  const [settings, setSettings] = useState<AudioOptimizationSettings>({
    enableBackgroundPlayback: true,
    enableHeadphoneOptimization: true,
    enableVolumeControl: true,
    automaticGainControl: true,
    noiseSuppression: true,
    echoCancellation: true,
    preferredOutputRoute: 'default',
    backgroundMixing: false,
  });
  const [headphoneInfo, setHeadphoneInfo] = useState<HeadphoneInfo>({
    isConnected: false,
    type: 'none',
  });
  const [volumeStatus, setVolumeStatus] = useState<VolumeStatus>({
    current: 0.7,
    max: 1.0,
    isMuted: false,
    canChange: true,
  });
  const [isTestingAudio, setIsTestingAudio] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [audioEnvironment, setAudioEnvironment] = useState<any>(null);

  useEffect(() => {
    initializeSettings();
    setupListeners();

    return () => {
      cleanup();
    };
  }, []);

  const initializeSettings = async () => {
    try {
      const currentSettings = AudioOptimizationService.getSettings();
      setSettings(currentSettings);

      const initialHeadphones = HeadphoneDetection.getCurrentHeadphoneInfo();
      setHeadphoneInfo(initialHeadphones);

      const initialVolume = await AudioOptimizationService.getVolumeStatus();
      setVolumeStatus(initialVolume);

      await analyzeAudioEnvironment();
    } catch (error) {
      console.error('Failed to initialize settings:', error);
    }
  };

  const setupListeners = () => {
    // Listen for headphone changes
    const unsubscribeHeadphones = HeadphoneDetection.addListener((info) => {
      setHeadphoneInfo(info);
    });

    // Listen for volume changes
    AudioOptimizationService.setVolumeChangeListener((volume) => {
      setVolumeStatus(volume);
    });

    return unsubscribeHeadphones;
  };

  const cleanup = () => {
    // Cleanup is handled by services
  };

  const updateSetting = (key: keyof AudioOptimizationSettings, value: any) => {
    const newSettings = {...settings, [key]: value};
    setSettings(newSettings);
    AudioOptimizationService.updateSettings({[key]: value});
  };

  const handleOutputRouteChange = async (route: 'speaker' | 'headphones' | 'default') => {
    try {
      await AudioOptimizationService.switchOutputRoute(route);
      updateSetting('preferredOutputRoute', route);
    } catch (error) {
      Alert.alert('오류', '오디오 출력 경로를 변경할 수 없습니다.');
      console.error('Failed to switch output route:', error);
    }
  };

  const performAudioTest = async () => {
    setIsTestingAudio(true);
    try {
      const results = await VoiceRecordingService.performAudioTest();
      setTestResults(results);
      
      Alert.alert(
        '오디오 테스트 결과',
        `녹음: ${results.recording ? '✅' : '❌'}\n` +
        `재생: ${results.playback ? '✅' : '❌'}\n` +
        `헤드폰: ${results.headphones ? '✅' : '❌'}\n` +
        `볼륨 제어: ${results.volume ? '✅' : '❌'}\n` +
        `백그라운드: ${results.background ? '✅' : '❌'}\n` +
        `지연시간: ${results.latency}ms`
      );
    } catch (error) {
      Alert.alert('테스트 실패', '오디오 테스트 중 오류가 발생했습니다.');
      console.error('Audio test failed:', error);
    } finally {
      setIsTestingAudio(false);
    }
  };

  const analyzeAudioEnvironment = async () => {
    try {
      const environment = await VoiceRecordingService.analyzeRecordingEnvironment();
      setAudioEnvironment(environment);
    } catch (error) {
      console.error('Failed to analyze audio environment:', error);
    }
  };

  const getHeadphoneIcon = (): string => {
    if (!headphoneInfo.isConnected) return '🔇';
    
    switch (headphoneInfo.type) {
      case 'bluetooth': return '🎧';
      case 'wired': return '🎧';
      case 'usbc': return '🎧';
      case 'lightning': return '🎧';
      default: return '🎧';
    }
  };

  const getConnectionQuality = (): {color: string; text: string} => {
    if (!headphoneInfo.isConnected) {
      return {color: colors.error, text: '연결 없음'};
    }
    
    switch (headphoneInfo.type) {
      case 'wired':
        return {color: colors.success, text: '최고 품질'};
      case 'bluetooth':
        return {color: colors.warning, text: '양호한 품질'};
      default:
        return {color: colors.info, text: '보통 품질'};
    }
  };

  const renderSettingSection = (title: string, children: React.ReactNode) => (
    <View style={styles.settingSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  const renderSettingItem = (
    label: string,
    description: string,
    value: boolean,
    onToggle: (value: boolean) => void,
    disabled: boolean = false
  ) => (
    <View style={styles.settingItem}>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingLabel, disabled && {color: colors.disabled}]}>
          {label}
        </Text>
        <Text style={styles.settingDescription}>
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{false: colors.disabled, true: colors.primary + '50'}}
        thumbColor={value ? colors.primary : colors.secondaryText}
      />
    </View>
  );

  const renderOutputRouteSelector = () => (
    <View style={styles.routeSelector}>
      <Text style={styles.routeSelectorTitle}>오디오 출력 경로</Text>
      <View style={styles.routeButtons}>
        {[
          {key: 'default', label: '기본', icon: '🔊'},
          {key: 'speaker', label: '스피커', icon: '📢'},
          {key: 'headphones', label: '헤드폰', icon: '🎧', disabled: !headphoneInfo.isConnected},
        ].map(route => (
          <TouchableOpacity
            key={route.key}
            style={[
              styles.routeButton,
              settings.preferredOutputRoute === route.key && styles.routeButtonActive,
              route.disabled && styles.routeButtonDisabled,
            ]}
            onPress={() => handleOutputRouteChange(route.key as any)}
            disabled={route.disabled}>
            <Text style={styles.routeButtonIcon}>{route.icon}</Text>
            <Text style={[
              styles.routeButtonText,
              settings.preferredOutputRoute === route.key && styles.routeButtonTextActive,
              route.disabled && {color: colors.disabled},
            ]}>
              {route.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderHeadphoneStatus = () => (
    <View style={styles.headphoneStatusCard}>
      <View style={styles.headphoneHeader}>
        <Text style={styles.headphoneIcon}>{getHeadphoneIcon()}</Text>
        <View style={styles.headphoneDetails}>
          <Text style={styles.headphoneTitle}>
            {headphoneInfo.isConnected ? headphoneInfo.deviceName || '헤드폰 연결됨' : '헤드폰 연결 안됨'}
          </Text>
          <Text style={[styles.headphoneSubtitle, {color: getConnectionQuality().color}]}>
            {getConnectionQuality().text}
          </Text>
        </View>
      </View>
      
      {headphoneInfo.isConnected && (
        <View style={styles.headphoneInfo}>
          {headphoneInfo.supportsMicrophone && (
            <View style={styles.headphoneFeature}>
              <Text style={styles.featureIcon}>🎤</Text>
              <Text style={styles.featureText}>마이크 지원</Text>
            </View>
          )}
          {headphoneInfo.batteryLevel && (
            <View style={styles.headphoneFeature}>
              <Text style={styles.featureIcon}>🔋</Text>
              <Text style={styles.featureText}>{headphoneInfo.batteryLevel}%</Text>
            </View>
          )}
          <View style={styles.headphoneFeature}>
            <Text style={styles.featureIcon}>📊</Text>
            <Text style={styles.featureText}>
              {headphoneInfo.type === 'bluetooth' ? '무선' : '유선'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderEnvironmentAnalysis = () => {
    if (!audioEnvironment) return null;

    return (
      <View style={styles.environmentCard}>
        <Text style={styles.environmentTitle}>🌍 오디오 환경 분석</Text>
        <View style={styles.environmentStats}>
          <View style={styles.environmentStat}>
            <Text style={styles.statLabel}>소음 수준</Text>
            <Text style={styles.statValue}>
              {Math.round(audioEnvironment.noiseLevel * 100)}%
            </Text>
          </View>
          <View style={styles.environmentStat}>
            <Text style={styles.statLabel}>권장 게인</Text>
            <Text style={styles.statValue}>
              {Math.round(audioEnvironment.recommendedGain * 100)}%
            </Text>
          </View>
        </View>
        
        <View style={styles.recommendations}>
          <Text style={styles.recommendationsTitle}>최적 설정</Text>
          <View style={styles.recommendationItems}>
            {[
              {key: 'echoCancellation', label: '에코 제거', value: audioEnvironment.optimalSettings.echoCancellation},
              {key: 'noiseSuppression', label: '노이즈 억제', value: audioEnvironment.optimalSettings.noiseSuppression},
              {key: 'automaticGainControl', label: '자동 게인', value: audioEnvironment.optimalSettings.automaticGainControl},
            ].map(item => (
              <View key={item.key} style={styles.recommendationItem}>
                <Text style={styles.recommendationIcon}>
                  {item.value ? '✅' : '❌'}
                </Text>
                <Text style={styles.recommendationText}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContainer: {
      paddingBottom: 100,
    },
    header: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.disabled + '30',
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
    },
    headerSubtitle: {
      fontSize: 14,
      color: colors.secondaryText,
      textAlign: 'center',
      marginTop: 4,
    },
    volumeControlContainer: {
      margin: 20,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
    },
    volumeControlTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    settingSection: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      margin: 16,
      marginBottom: 8,
      padding: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.disabled + '20',
    },
    settingInfo: {
      flex: 1,
      marginRight: 16,
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 4,
    },
    settingDescription: {
      fontSize: 14,
      color: colors.secondaryText,
      lineHeight: 18,
    },
    routeSelector: {
      marginTop: 8,
    },
    routeSelectorTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 12,
    },
    routeButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    routeButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 8,
      backgroundColor: colors.disabled + '20',
      alignItems: 'center',
    },
    routeButtonActive: {
      backgroundColor: colors.primary + '20',
    },
    routeButtonDisabled: {
      opacity: 0.5,
    },
    routeButtonIcon: {
      fontSize: 20,
      marginBottom: 4,
    },
    routeButtonText: {
      fontSize: 12,
      color: colors.text,
    },
    routeButtonTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    headphoneStatusCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      margin: 16,
      marginBottom: 8,
      padding: 16,
    },
    headphoneHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    headphoneIcon: {
      fontSize: 32,
      marginRight: 16,
    },
    headphoneDetails: {
      flex: 1,
    },
    headphoneTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    headphoneSubtitle: {
      fontSize: 14,
      marginTop: 2,
    },
    headphoneInfo: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    headphoneFeature: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    featureIcon: {
      fontSize: 14,
      marginRight: 6,
    },
    featureText: {
      fontSize: 12,
      color: colors.text,
    },
    environmentCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      margin: 16,
      marginBottom: 8,
      padding: 16,
    },
    environmentTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    environmentStats: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 16,
    },
    environmentStat: {
      alignItems: 'center',
    },
    statLabel: {
      fontSize: 12,
      color: colors.secondaryText,
      marginBottom: 4,
    },
    statValue: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.primary,
    },
    recommendations: {
      borderTopWidth: 1,
      borderTopColor: colors.disabled + '20',
      paddingTop: 16,
    },
    recommendationsTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 12,
    },
    recommendationItems: {
      gap: 8,
    },
    recommendationItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    recommendationIcon: {
      fontSize: 16,
      marginRight: 8,
    },
    recommendationText: {
      fontSize: 14,
      color: colors.text,
    },
    testButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      margin: 16,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
    },
    testButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.onPrimary,
      marginLeft: 8,
    },
    testResults: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      margin: 16,
      marginTop: 8,
      padding: 16,
    },
    testResultsTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    testResultItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.disabled + '20',
    },
    testResultLabel: {
      fontSize: 14,
      color: colors.text,
    },
    testResultValue: {
      fontSize: 14,
      fontWeight: '600',
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContainer}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🎵 오디오 최적화</Text>
        <Text style={styles.headerSubtitle}>
          최적의 음성 학습 환경을 위한 오디오 설정
        </Text>
      </View>

      {renderHeadphoneStatus()}

      <View style={styles.volumeControlContainer}>
        <Text style={styles.volumeControlTitle}>볼륨 제어</Text>
        <VolumeControl
          onVolumeChange={(volume) => console.log('Volume changed:', volume)}
          showHeadphoneStatus={false}
          showQuickActions={true}
          size="medium"
        />
      </View>

      {renderEnvironmentAnalysis()}

      {renderSettingSection(
        '🎯 기본 설정',
        <>
          {renderSettingItem(
            '백그라운드 재생',
            '앱이 백그라운드에 있을 때도 오디오를 계속 재생합니다',
            settings.enableBackgroundPlayback,
            (value) => updateSetting('enableBackgroundPlayback', value)
          )}
          
          {renderSettingItem(
            '헤드폰 최적화',
            '헤드폰 연결 시 자동으로 오디오 설정을 최적화합니다',
            settings.enableHeadphoneOptimization,
            (value) => updateSetting('enableHeadphoneOptimization', value)
          )}
          
          {renderSettingItem(
            '볼륨 제어',
            '앱 내에서 시스템 볼륨을 직접 제어할 수 있습니다',
            settings.enableVolumeControl,
            (value) => updateSetting('enableVolumeControl', value)
          )}
          
          {renderOutputRouteSelector()}
        </>
      )}

      {renderSettingSection(
        '🎙️ 녹음 최적화',
        <>
          {renderSettingItem(
            '자동 게인 제어',
            '마이크 입력 레벨을 자동으로 조정합니다',
            settings.automaticGainControl,
            (value) => updateSetting('automaticGainControl', value)
          )}
          
          {renderSettingItem(
            '노이즈 억제',
            '배경 소음을 줄여 더 깨끗한 녹음을 제공합니다',
            settings.noiseSuppression,
            (value) => updateSetting('noiseSuppression', value)
          )}
          
          {renderSettingItem(
            '에코 제거',
            '스피커에서 나오는 소리가 마이크로 들어가는 것을 방지합니다',
            settings.echoCancellation,
            (value) => updateSetting('echoCancellation', value)
          )}
          
          {renderSettingItem(
            '백그라운드 믹싱',
            '다른 앱의 오디오와 함께 재생됩니다',
            settings.backgroundMixing,
            (value) => updateSetting('backgroundMixing', value)
          )}
        </>
      )}

      <TouchableOpacity
        style={styles.testButton}
        onPress={performAudioTest}
        disabled={isTestingAudio}>
        {isTestingAudio && <ActivityIndicator size="small" color={colors.onPrimary} />}
        <Text style={styles.testButtonText}>
          {isTestingAudio ? '테스트 중...' : '🔍 오디오 테스트 실행'}
        </Text>
      </TouchableOpacity>

      {testResults && (
        <View style={styles.testResults}>
          <Text style={styles.testResultsTitle}>테스트 결과</Text>
          {[
            {label: '녹음 기능', value: testResults.recording ? '✅ 정상' : '❌ 오류'},
            {label: '재생 기능', value: testResults.playback ? '✅ 정상' : '❌ 오류'},
            {label: '헤드폰 연결', value: testResults.headphones ? '✅ 연결됨' : '❌ 연결 안됨'},
            {label: '볼륨 제어', value: testResults.volume ? '✅ 사용 가능' : '❌ 제한됨'},
            {label: '백그라운드 모드', value: testResults.background ? '✅ 지원됨' : '❌ 미지원'},
            {label: '오디오 지연시간', value: `${testResults.latency}ms`},
          ].map((item, index) => (
            <View key={index} style={styles.testResultItem}>
              <Text style={styles.testResultLabel}>{item.label}</Text>
              <Text style={[
                styles.testResultValue,
                {color: item.value.includes('✅') ? colors.success : 
                       item.value.includes('❌') ? colors.error : colors.text}
              ]}>
                {item.value}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

export default AudioSettingsScreen;