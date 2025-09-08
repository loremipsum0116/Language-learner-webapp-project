import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Switch,
  Alert,
  BackHandler,
} from 'react-native';
import {useTheme} from '../context/ThemeContext';
import {useNavigation} from '@react-navigation/native';
import SwipeLearningSession, {LearningSessionConfig, StudyCard} from '../components/SwipeLearningSession';

interface GestureBasedLearningScreenProps {
  route: {
    params: {
      vocabList?: any[];
      folderId?: string;
      selectedItems?: string[];
      mode?: 'flash' | 'srs' | 'review';
    };
  };
}

const GestureBasedLearningScreen: React.FC<GestureBasedLearningScreenProps> = ({route}) => {
  const {colors} = useTheme();
  const navigation = useNavigation();
  const {vocabList = [], folderId, selectedItems, mode = 'flash'} = route.params || {};

  const [sessionStarted, setSessionStarted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [studyCards, setStudyCards] = useState<StudyCard[]>([]);
  const [sessionConfig, setSessionConfig] = useState<LearningSessionConfig>({
    autoMode: false,
    autoInterval: 5000, // 5초
    shuffleCards: true,
    showProgress: true,
    enableAudio: true,
    maxAudioPlays: 2,
    flipInterval: 3000, // 3초 후 자동 뒤집기
    enableSurpriseQuiz: true,
    batchSize: 20,
  });

  const [statistics, setStatistics] = useState({
    totalStudied: 0,
    knownCards: 0,
    unknownCards: 0,
    skippedCards: 0,
    averageTimePerCard: 0,
  });

  useEffect(() => {
    initializeCards();
  }, [vocabList]);

  useEffect(() => {
    // 뒤로가기 버튼 처리
    const backAction = () => {
      if (sessionStarted) {
        Alert.alert(
          '학습 종료',
          '정말로 학습을 종료하시겠습니까?',
          [
            {text: '취소', style: 'cancel'},
            {text: '종료', onPress: () => navigation.goBack()},
          ]
        );
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [sessionStarted, navigation]);

  const initializeCards = () => {
    const cards: StudyCard[] = vocabList.map((vocab, index) => ({
      id: `${vocab.id || index}`,
      vocab,
      card: vocab.card,
      isStudied: false,
    }));

    if (sessionConfig.shuffleCards) {
      // Fisher-Yates 셔플 알고리즘
      for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
      }
    }

    // 배치 크기로 제한
    const limitedCards = cards.slice(0, sessionConfig.batchSize);
    setStudyCards(limitedCards);
  };

  const startLearningSession = () => {
    if (studyCards.length === 0) {
      Alert.alert('알림', '학습할 카드가 없습니다.');
      return;
    }
    setSessionStarted(true);
  };

  const handleSessionComplete = (results: StudyCard[]) => {
    const knownCards = results.filter(card => card.studyResult === 'known').length;
    const unknownCards = results.filter(card => card.studyResult === 'unknown').length;
    const skippedCards = results.filter(card => card.studyResult === 'skipped').length;

    setStatistics({
      totalStudied: results.length,
      knownCards,
      unknownCards,
      skippedCards,
      averageTimePerCard: 0, // TODO: 실제 시간 계산
    });

    setSessionStarted(false);
    showCompletionModal();
  };

  const showCompletionModal = () => {
    Alert.alert(
      '🎉 학습 완료!',
      `총 ${statistics.totalStudied}장 학습\n\n` +
      `✅ 알고 있음: ${statistics.knownCards}장\n` +
      `❌ 모르겠음: ${statistics.unknownCards}장\n` +
      `⏭️ 넘어감: ${statistics.skippedCards}장`,
      [
        {
          text: '다시 학습',
          onPress: () => {
            initializeCards();
            startLearningSession();
          },
        },
        {
          text: '완료',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  const handleCardStudied = (card: StudyCard, result: 'known' | 'unknown' | 'skipped') => {
    // TODO: 서버에 학습 결과 저장
    console.log('Card studied:', card.vocab.lemma, result);
  };

  const handleProgress = (currentIndex: number, totalCount: number, studiedCount: number) => {
    // TODO: 진행률 저장 및 분석
    console.log(`Progress: ${studiedCount}/${totalCount} (${Math.round(studiedCount/totalCount*100)}%)`);
  };

  const handleExit = () => {
    setSessionStarted(false);
    navigation.goBack();
  };

  const updateConfig = (key: keyof LearningSessionConfig, value: any) => {
    setSessionConfig(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const renderModeInfo = () => {
    const modeInfo = {
      flash: {
        title: '플래시카드 학습',
        description: '카드를 넘기며 단어를 익히는 기본 학습 모드',
        icon: '📚',
        color: colors.primary,
      },
      srs: {
        title: 'SRS 복습',
        description: '간격 반복 학습법으로 장기 기억에 도움',
        icon: '🔄',
        color: colors.success,
      },
      review: {
        title: '복습 모드',
        description: '틀렸던 문제들을 다시 학습',
        icon: '📝',
        color: colors.warning,
      },
    };

    const info = modeInfo[mode] || modeInfo.flash;

    return (
      <View style={[styles.modeInfo, {borderColor: info.color}]}>
        <Text style={styles.modeIcon}>{info.icon}</Text>
        <View style={styles.modeTextContainer}>
          <Text style={[styles.modeTitle, {color: info.color}]}>{info.title}</Text>
          <Text style={styles.modeDescription}>{info.description}</Text>
        </View>
      </View>
    );
  };

  const renderSettings = () => (
    <Modal
      visible={showSettings}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowSettings(false)}
    >
      <View style={styles.settingsContainer}>
        <View style={styles.settingsHeader}>
          <Text style={styles.settingsTitle}>학습 설정</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowSettings(false)}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.settingsContent}>
          {/* 자동 모드 설정 */}
          <View style={styles.settingSection}>
            <Text style={styles.sectionTitle}>⚡ 자동 학습 모드</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>자동 진행</Text>
                <Text style={styles.settingDescription}>
                  설정된 시간 후 자동으로 다음 카드로 이동
                </Text>
              </View>
              <Switch
                value={sessionConfig.autoMode}
                onValueChange={(value) => updateConfig('autoMode', value)}
                trackColor={{false: colors.disabled, true: colors.primary + '50'}}
                thumbColor={sessionConfig.autoMode ? colors.primary : colors.textSecondary}
              />
            </View>

            {sessionConfig.autoMode && (
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>자동 진행 간격</Text>
                <View style={styles.intervalOptions}>
                  {[3000, 5000, 8000, 10000].map(interval => (
                    <TouchableOpacity
                      key={interval}
                      style={[
                        styles.intervalOption,
                        sessionConfig.autoInterval === interval && styles.intervalOptionActive,
                      ]}
                      onPress={() => updateConfig('autoInterval', interval)}
                    >
                      <Text style={[
                        styles.intervalOptionText,
                        sessionConfig.autoInterval === interval && styles.intervalOptionTextActive,
                      ]}>
                        {interval / 1000}초
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* 카드 설정 */}
          <View style={styles.settingSection}>
            <Text style={styles.sectionTitle}>🎴 카드 설정</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>카드 섞기</Text>
                <Text style={styles.settingDescription}>
                  카드 순서를 무작위로 섞어서 학습
                </Text>
              </View>
              <Switch
                value={sessionConfig.shuffleCards}
                onValueChange={(value) => {
                  updateConfig('shuffleCards', value);
                  // 설정 변경 시 카드 재초기화
                  if (!sessionStarted) {
                    setTimeout(() => initializeCards(), 100);
                  }
                }}
                trackColor={{false: colors.disabled, true: colors.primary + '50'}}
                thumbColor={sessionConfig.shuffleCards ? colors.primary : colors.textSecondary}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>자동 뒤집기</Text>
                <Text style={styles.settingDescription}>
                  설정된 시간 후 자동으로 카드 뒷면 표시
                </Text>
              </View>
              <Switch
                value={sessionConfig.flipInterval !== undefined}
                onValueChange={(value) => 
                  updateConfig('flipInterval', value ? 3000 : undefined)
                }
                trackColor={{false: colors.disabled, true: colors.primary + '50'}}
                thumbColor={sessionConfig.flipInterval ? colors.primary : colors.textSecondary}
              />
            </View>

            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>배치 크기</Text>
              <View style={styles.batchOptions}>
                {[10, 20, 30, 50].map(size => (
                  <TouchableOpacity
                    key={size}
                    style={[
                      styles.batchOption,
                      sessionConfig.batchSize === size && styles.batchOptionActive,
                    ]}
                    onPress={() => {
                      updateConfig('batchSize', size);
                      if (!sessionStarted) {
                        setTimeout(() => initializeCards(), 100);
                      }
                    }}
                  >
                    <Text style={[
                      styles.batchOptionText,
                      sessionConfig.batchSize === size && styles.batchOptionTextActive,
                    ]}>
                      {size}장
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* 오디오 설정 */}
          <View style={styles.settingSection}>
            <Text style={styles.sectionTitle}>🔊 오디오 설정</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>오디오 재생</Text>
                <Text style={styles.settingDescription}>
                  단어 발음 자동 재생
                </Text>
              </View>
              <Switch
                value={sessionConfig.enableAudio}
                onValueChange={(value) => updateConfig('enableAudio', value)}
                trackColor={{false: colors.disabled, true: colors.primary + '50'}}
                thumbColor={sessionConfig.enableAudio ? colors.primary : colors.textSecondary}
              />
            </View>

            {sessionConfig.enableAudio && (
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>최대 재생 횟수</Text>
                <View style={styles.playCountOptions}>
                  {[1, 2, 3, 5].map(count => (
                    <TouchableOpacity
                      key={count}
                      style={[
                        styles.playCountOption,
                        sessionConfig.maxAudioPlays === count && styles.playCountOptionActive,
                      ]}
                      onPress={() => updateConfig('maxAudioPlays', count)}
                    >
                      <Text style={[
                        styles.playCountOptionText,
                        sessionConfig.maxAudioPlays === count && styles.playCountOptionTextActive,
                      ]}>
                        {count}회
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* 기타 설정 */}
          <View style={styles.settingSection}>
            <Text style={styles.sectionTitle}>🎯 학습 기능</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>깜짝 퀴즈</Text>
                <Text style={styles.settingDescription}>
                  10장마다 복습 퀴즈 출제
                </Text>
              </View>
              <Switch
                value={sessionConfig.enableSurpriseQuiz}
                onValueChange={(value) => updateConfig('enableSurpriseQuiz', value)}
                trackColor={{false: colors.disabled, true: colors.primary + '50'}}
                thumbColor={sessionConfig.enableSurpriseQuiz ? colors.primary : colors.textSecondary}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>진행률 표시</Text>
                <Text style={styles.settingDescription}>
                  학습 진행 상황 시각화
                </Text>
              </View>
              <Switch
                value={sessionConfig.showProgress}
                onValueChange={(value) => updateConfig('showProgress', value)}
                trackColor={{false: colors.disabled, true: colors.primary + '50'}}
                thumbColor={sessionConfig.showProgress ? colors.primary : colors.textSecondary}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  if (sessionStarted) {
    return (
      <SwipeLearningSession
        cards={studyCards}
        config={sessionConfig}
        onComplete={handleSessionComplete}
        onCardStudied={handleCardStudied}
        onProgress={handleProgress}
        onExit={handleExit}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.title}>📱 제스처 기반 학습</Text>
          <Text style={styles.subtitle}>스와이프로 쉽고 빠른 단어 학습</Text>
        </View>

        {/* 모드 정보 */}
        {renderModeInfo()}

        {/* 학습 정보 */}
        <View style={styles.learningInfo}>
          <View style={styles.infoCard}>
            <Text style={styles.infoNumber}>{studyCards.length}</Text>
            <Text style={styles.infoLabel}>학습할 단어</Text>
          </View>
          
          <View style={styles.infoCard}>
            <Text style={styles.infoNumber}>
              {sessionConfig.autoMode ? `${sessionConfig.autoInterval! / 1000}초` : '수동'}
            </Text>
            <Text style={styles.infoLabel}>진행 방식</Text>
          </View>
          
          <View style={styles.infoCard}>
            <Text style={styles.infoNumber}>
              {sessionConfig.shuffleCards ? '섞음' : '순서'}
            </Text>
            <Text style={styles.infoLabel}>카드 순서</Text>
          </View>
        </View>

        {/* 제스처 가이드 */}
        <View style={styles.gestureGuide}>
          <Text style={styles.guideTitle}>📚 제스처 가이드</Text>
          
          <View style={styles.gestureList}>
            <View style={styles.gestureItem}>
              <Text style={styles.gestureIcon}>←</Text>
              <Text style={styles.gestureText}>왼쪽 스와이프: 이전 카드</Text>
            </View>
            
            <View style={styles.gestureItem}>
              <Text style={styles.gestureIcon}>→</Text>
              <Text style={styles.gestureText}>오른쪽 스와이프: 다음 카드</Text>
            </View>
            
            <View style={styles.gestureItem}>
              <Text style={styles.gestureIcon}>↑</Text>
              <Text style={styles.gestureText}>위쪽 스와이프: 알고 있음</Text>
            </View>
            
            <View style={styles.gestureItem}>
              <Text style={styles.gestureIcon}>↓</Text>
              <Text style={styles.gestureText}>아래쪽 스와이프: 모르겠음</Text>
            </View>
            
            <View style={styles.gestureItem}>
              <Text style={styles.gestureIcon}>👆</Text>
              <Text style={styles.gestureText}>탭: 카드 뒤집기</Text>
            </View>
          </View>
        </View>

        {/* 컨트롤 버튼 */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setShowSettings(true)}
          >
            <Text style={styles.settingsButtonIcon}>⚙️</Text>
            <Text style={styles.settingsButtonText}>학습 설정</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.startButton, studyCards.length === 0 && styles.startButtonDisabled]}
            onPress={startLearningSession}
            disabled={studyCards.length === 0}
          >
            <Text style={styles.startButtonText}>🚀 학습 시작</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 설정 모달 */}
      {renderSettings()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  modeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  modeIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  modeTextContainer: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modeDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  learningInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  gestureGuide: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  guideTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  gestureList: {
    gap: 12,
  },
  gestureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  gestureIcon: {
    fontSize: 20,
    marginRight: 16,
    minWidth: 30,
    textAlign: 'center',
  },
  gestureText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  controls: {
    gap: 16,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  settingsButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  settingsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  startButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  startButtonDisabled: {
    backgroundColor: '#ccc',
    elevation: 0,
    shadowOpacity: 0,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  // 설정 모달 스타일
  settingsContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#666',
  },
  settingsContent: {
    flex: 1,
    padding: 20,
  },
  settingSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  intervalOptions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  intervalOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  intervalOptionActive: {
    backgroundColor: '#007AFF',
  },
  intervalOptionText: {
    fontSize: 12,
    color: '#333',
  },
  intervalOptionTextActive: {
    color: '#fff',
  },
  batchOptions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  batchOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  batchOptionActive: {
    backgroundColor: '#007AFF',
  },
  batchOptionText: {
    fontSize: 12,
    color: '#333',
  },
  batchOptionTextActive: {
    color: '#fff',
  },
  playCountOptions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  playCountOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  playCountOptionActive: {
    backgroundColor: '#007AFF',
  },
  playCountOptionText: {
    fontSize: 12,
    color: '#333',
  },
  playCountOptionTextActive: {
    color: '#fff',
  },
});

export default GestureBasedLearningScreen;