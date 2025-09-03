import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  Switch,
  ActivityIndicator,
} from 'react-native';
import {useTheme} from '../context/ThemeContext';
import {PronunciationPractice, PronunciationResult} from '../components/PronunciationPractice';
import DictationMode, {DictationResult} from '../components/DictationMode';
import RealtimeSpeechRecognition from '../components/RealtimeSpeechRecognition';
import PronunciationEvaluationService, {
  PronunciationEvaluation,
} from '../services/PronunciationEvaluationService';

interface PracticeItem {
  id: string;
  text: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  targetLanguage: 'korean' | 'english' | 'japanese' | 'chinese';
}

type PracticeMode = 'pronunciation' | 'dictation' | 'realtime';

const PronunciationPracticeScreen: React.FC = () => {
  const {colors} = useTheme();
  const [currentMode, setCurrentMode] = useState<PracticeMode>('pronunciation');
  const [selectedItem, setSelectedItem] = useState<PracticeItem | null>(null);
  const [practiceItems, setPracticeItems] = useState<PracticeItem[]>([]);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [currentResult, setCurrentResult] = useState<PronunciationResult | DictationResult | null>(null);
  const [evaluation, setEvaluation] = useState<PronunciationEvaluation | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    showWaveform: true,
    autoEvaluate: true,
    continuousMode: false,
    maxRecordingTime: 30000,
    useServerEvaluation: false,
  });

  useEffect(() => {
    loadPracticeItems();
  }, []);

  const loadPracticeItems = () => {
    // Load practice items - in a real app, this would come from a database or API
    const items: PracticeItem[] = [
      {
        id: '1',
        text: '안녕하세요. 만나서 반갑습니다.',
        difficulty: 'beginner',
        category: '인사',
        targetLanguage: 'korean',
      },
      {
        id: '2',
        text: 'Hello, nice to meet you. How are you today?',
        difficulty: 'intermediate',
        category: 'Greeting',
        targetLanguage: 'english',
      },
      {
        id: '3',
        text: '오늘 날씨가 정말 좋네요. 산책하기 딱 좋은 날씨입니다.',
        difficulty: 'intermediate',
        category: '일상 대화',
        targetLanguage: 'korean',
      },
      {
        id: '4',
        text: 'The weather is absolutely beautiful today. Perfect for a walk in the park.',
        difficulty: 'advanced',
        category: 'Daily Conversation',
        targetLanguage: 'english',
      },
      {
        id: '5',
        text: 'こんにちは。今日はとても良い天気ですね。',
        difficulty: 'intermediate',
        category: 'あいさつ',
        targetLanguage: 'japanese',
      },
    ];

    setPracticeItems(items);
    if (items.length > 0) {
      setSelectedItem(items[0]);
    }
  };

  const handlePronunciationResult = async (result: PronunciationResult) => {
    setCurrentResult(result);
    setShowResults(true);

    if (settings.autoEvaluate) {
      await evaluatePronunciation(result);
    }
  };

  const handleDictationResult = (result: DictationResult) => {
    setCurrentResult(result);
    setShowResults(true);
  };

  const handleRealtimeComplete = (text: string) => {
    const result: DictationResult = {
      transcription: text,
      accuracy: 0,
      errors: [],
      completionTime: 0,
      attempts: 1,
    };
    setCurrentResult(result);
    setShowResults(true);
  };

  const evaluatePronunciation = async (result: PronunciationResult) => {
    if (!selectedItem) return;

    setIsEvaluating(true);
    try {
      const evaluation = await PronunciationEvaluationService.evaluatePronunciation(
        result.recordingUri,
        selectedItem.text,
        selectedItem.targetLanguage,
        {
          mode: 'sentence',
          useServer: settings.useServerEvaluation,
        }
      );
      setEvaluation(evaluation);
    } catch (error) {
      console.error('Evaluation failed:', error);
      Alert.alert('평가 오류', '발음 평가에 실패했습니다.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const nextItem = () => {
    const nextIndex = (currentItemIndex + 1) % practiceItems.length;
    setCurrentItemIndex(nextIndex);
    setSelectedItem(practiceItems[nextIndex]);
    setShowResults(false);
    setCurrentResult(null);
    setEvaluation(null);
  };

  const previousItem = () => {
    const prevIndex = currentItemIndex === 0 ? practiceItems.length - 1 : currentItemIndex - 1;
    setCurrentItemIndex(prevIndex);
    setSelectedItem(practiceItems[prevIndex]);
    setShowResults(false);
    setCurrentResult(null);
    setEvaluation(null);
  };

  const getDifficultyColor = (difficulty: string): string => {
    switch (difficulty) {
      case 'beginner': return colors.success;
      case 'intermediate': return colors.warning;
      case 'advanced': return colors.error;
      default: return colors.secondary;
    }
  };

  const getDifficultyText = (difficulty: string): string => {
    switch (difficulty) {
      case 'beginner': return '초급';
      case 'intermediate': return '중급';
      case 'advanced': return '고급';
      default: return '기타';
    }
  };

  const getLanguageFlag = (language: string): string => {
    const flags = {
      korean: '🇰🇷',
      english: '🇺🇸',
      japanese: '🇯🇵',
      chinese: '🇨🇳',
    };
    return flags[language as keyof typeof flags] || '🌍';
  };

  const renderModeSelector = () => (
    <View style={styles.modeSelector}>
      <TouchableOpacity
        style={[
          styles.modeButton,
          currentMode === 'pronunciation' && styles.modeButtonActive,
        ]}
        onPress={() => setCurrentMode('pronunciation')}>
        <Text style={[
          styles.modeButtonText,
          currentMode === 'pronunciation' && styles.modeButtonTextActive,
        ]}>
          🎤 발음 연습
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.modeButton,
          currentMode === 'dictation' && styles.modeButtonActive,
        ]}
        onPress={() => setCurrentMode('dictation')}>
        <Text style={[
          styles.modeButtonText,
          currentMode === 'dictation' && styles.modeButtonTextActive,
        ]}>
          📝 받아쓰기
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.modeButton,
          currentMode === 'realtime' && styles.modeButtonActive,
        ]}
        onPress={() => setCurrentMode('realtime')}>
        <Text style={[
          styles.modeButtonText,
          currentMode === 'realtime' && styles.modeButtonTextActive,
        ]}>
          🗣️ 실시간
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderItemInfo = () => {
    if (!selectedItem) return null;

    return (
      <View style={styles.itemInfo}>
        <View style={styles.itemHeader}>
          <Text style={styles.languageFlag}>
            {getLanguageFlag(selectedItem.targetLanguage)}
          </Text>
          <View style={styles.itemDetails}>
            <Text style={styles.itemCategory}>{selectedItem.category}</Text>
            <View style={styles.itemMeta}>
              <View style={[
                styles.difficultyBadge,
                {backgroundColor: getDifficultyColor(selectedItem.difficulty) + '20'},
              ]}>
                <Text style={[
                  styles.difficultyText,
                  {color: getDifficultyColor(selectedItem.difficulty)},
                ]}>
                  {getDifficultyText(selectedItem.difficulty)}
                </Text>
              </View>
              <Text style={styles.itemIndex}>
                {currentItemIndex + 1} / {practiceItems.length}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderNavigation = () => (
    <View style={styles.navigation}>
      <TouchableOpacity
        style={styles.navButton}
        onPress={previousItem}
        disabled={practiceItems.length <= 1}>
        <Text style={styles.navButtonText}>◀ 이전</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.settingsButton}
        onPress={() => setShowSettings(true)}>
        <Text style={styles.settingsButtonText}>⚙️</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navButton}
        onPress={nextItem}
        disabled={practiceItems.length <= 1}>
        <Text style={styles.navButtonText}>다음 ▶</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPracticeComponent = () => {
    if (!selectedItem) {
      return (
        <View style={styles.noItemContainer}>
          <Text style={styles.noItemText}>연습할 항목이 없습니다.</Text>
        </View>
      );
    }

    switch (currentMode) {
      case 'pronunciation':
        return (
          <PronunciationPractice
            text={selectedItem.text}
            targetLanguage={selectedItem.targetLanguage}
            onComplete={handlePronunciationResult}
            showWaveform={settings.showWaveform}
            maxRecordingTime={settings.maxRecordingTime}
          />
        );

      case 'dictation':
        return (
          <DictationMode
            targetText={selectedItem.text}
            targetLanguage={selectedItem.targetLanguage}
            onComplete={handleDictationResult}
            timeout={settings.maxRecordingTime}
          />
        );

      case 'realtime':
        return (
          <RealtimeSpeechRecognition
            targetLanguage={selectedItem.targetLanguage}
            onComplete={handleRealtimeComplete}
            showConfidence={true}
            autoStop={!settings.continuousMode}
            maxDuration={settings.maxRecordingTime * 2}
          />
        );

      default:
        return null;
    }
  };

  const renderResults = () => {
    if (!showResults || !currentResult) return null;

    return (
      <Modal
        visible={showResults}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowResults(false)}>
        <View style={styles.resultsContainer}>
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>결과</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowResults(false)}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.resultsContent} showsVerticalScrollIndicator={false}>
            {'accuracy' in currentResult && (
              <View style={styles.resultSection}>
                <Text style={styles.resultSectionTitle}>받아쓰기 결과</Text>
                <Text style={styles.transcriptionText}>
                  "{currentResult.transcription}"
                </Text>
                <Text style={styles.accuracyText}>
                  정확도: {currentResult.accuracy}%
                </Text>
                {currentResult.errors.length > 0 && (
                  <View style={styles.errorsContainer}>
                    <Text style={styles.errorsTitle}>오류:</Text>
                    {currentResult.errors.map((error, index) => (
                      <Text key={index} style={styles.errorText}>• {error}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {'recordingUri' in currentResult && (
              <View style={styles.resultSection}>
                <Text style={styles.resultSectionTitle}>발음 연습 결과</Text>
                <Text style={styles.qualityText}>
                  음질: {currentResult.quality}
                </Text>
                <Text style={styles.scoreText}>
                  점수: {currentResult.score}/100
                </Text>
                {currentResult.feedback.length > 0 && (
                  <View style={styles.feedbackContainer}>
                    <Text style={styles.feedbackTitle}>피드백:</Text>
                    {currentResult.feedback.map((feedback, index) => (
                      <Text key={index} style={styles.feedbackText}>• {feedback}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {isEvaluating && (
              <View style={styles.evaluatingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.evaluatingText}>AI 평가 중...</Text>
              </View>
            )}

            {evaluation && (
              <View style={styles.resultSection}>
                <Text style={styles.resultSectionTitle}>AI 평가 결과</Text>
                <View style={styles.scoresGrid}>
                  <View style={styles.scoreItem}>
                    <Text style={styles.scoreLabel}>전체</Text>
                    <Text style={styles.scoreValue}>{evaluation.overallScore}</Text>
                  </View>
                  <View style={styles.scoreItem}>
                    <Text style={styles.scoreLabel}>정확도</Text>
                    <Text style={styles.scoreValue}>{evaluation.accuracyScore}</Text>
                  </View>
                  <View style={styles.scoreItem}>
                    <Text style={styles.scoreLabel}>유창성</Text>
                    <Text style={styles.scoreValue}>{evaluation.fluencyScore}</Text>
                  </View>
                  <View style={styles.scoreItem}>
                    <Text style={styles.scoreLabel}>억양</Text>
                    <Text style={styles.scoreValue}>{evaluation.prosodyScore}</Text>
                  </View>
                </View>

                {evaluation.recommendations.length > 0 && (
                  <View style={styles.recommendationsContainer}>
                    <Text style={styles.recommendationsTitle}>추천사항:</Text>
                    {evaluation.recommendations.map((rec, index) => (
                      <Text key={index} style={styles.recommendationText}>
                        {index + 1}. {rec}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          <View style={styles.resultsActions}>
            <TouchableOpacity
              style={styles.tryAgainButton}
              onPress={() => setShowResults(false)}>
              <Text style={styles.tryAgainButtonText}>다시 시도</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.nextItemButton}
              onPress={() => {
                setShowResults(false);
                nextItem();
              }}>
              <Text style={styles.nextItemButtonText}>다음 문제</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const renderSettings = () => (
    <Modal
      visible={showSettings}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowSettings(false)}>
      <View style={styles.settingsContainer}>
        <View style={styles.settingsHeader}>
          <Text style={styles.settingsTitle}>설정</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowSettings(false)}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.settingsContent}>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>파형 시각화 표시</Text>
              <Text style={styles.settingDescription}>
                음성 녹음 중 파형을 표시합니다
              </Text>
            </View>
            <Switch
              value={settings.showWaveform}
              onValueChange={(value) =>
                setSettings(prev => ({...prev, showWaveform: value}))
              }
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>자동 평가</Text>
              <Text style={styles.settingDescription}>
                녹음 완료 후 자동으로 발음을 평가합니다
              </Text>
            </View>
            <Switch
              value={settings.autoEvaluate}
              onValueChange={(value) =>
                setSettings(prev => ({...prev, autoEvaluate: value}))
              }
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>연속 모드</Text>
              <Text style={styles.settingDescription}>
                실시간 음성 인식에서 연속으로 인식합니다
              </Text>
            </View>
            <Switch
              value={settings.continuousMode}
              onValueChange={(value) =>
                setSettings(prev => ({...prev, continuousMode: value}))
              }
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>서버 평가 사용</Text>
              <Text style={styles.settingDescription}>
                서버를 통한 고급 발음 평가를 사용합니다
              </Text>
            </View>
            <Switch
              value={settings.useServerEvaluation}
              onValueChange={(value) =>
                setSettings(prev => ({...prev, useServerEvaluation: value}))
              }
            />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>최대 녹음 시간</Text>
            <View style={styles.timeOptions}>
              {[15000, 30000, 60000, 120000].map(time => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.timeOption,
                    settings.maxRecordingTime === time && styles.timeOptionActive,
                  ]}
                  onPress={() =>
                    setSettings(prev => ({...prev, maxRecordingTime: time}))
                  }>
                  <Text style={[
                    styles.timeOptionText,
                    settings.maxRecordingTime === time && styles.timeOptionTextActive,
                  ]}>
                    {time / 1000}초
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    modeSelector: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      margin: 16,
      borderRadius: 12,
      padding: 4,
    },
    modeButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignItems: 'center',
    },
    modeButtonActive: {
      backgroundColor: colors.primary,
    },
    modeButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    modeButtonTextActive: {
      color: colors.onPrimary,
    },
    itemInfo: {
      backgroundColor: colors.surface,
      margin: 16,
      marginTop: 0,
      borderRadius: 12,
      padding: 16,
    },
    itemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    languageFlag: {
      fontSize: 32,
      marginRight: 16,
    },
    itemDetails: {
      flex: 1,
    },
    itemCategory: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    itemMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    difficultyBadge: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    difficultyText: {
      fontSize: 12,
      fontWeight: '600',
    },
    itemIndex: {
      fontSize: 14,
      color: colors.secondaryText,
    },
    navigation: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    navButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: colors.secondary,
    },
    navButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.onSecondary,
    },
    settingsButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    settingsButtonText: {
      fontSize: 18,
    },
    noItemContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    noItemText: {
      fontSize: 16,
      color: colors.secondaryText,
      textAlign: 'center',
    },
    resultsContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    resultsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.disabled + '30',
    },
    resultsTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.disabled + '30',
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeButtonText: {
      fontSize: 16,
      color: colors.text,
    },
    resultsContent: {
      flex: 1,
      padding: 16,
    },
    resultSection: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    resultSectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 12,
    },
    transcriptionText: {
      fontSize: 16,
      color: colors.text,
      marginBottom: 8,
      padding: 12,
      backgroundColor: colors.background,
      borderRadius: 8,
    },
    accuracyText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 8,
    },
    qualityText: {
      fontSize: 14,
      color: colors.text,
      marginBottom: 4,
    },
    scoreText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 8,
    },
    errorsContainer: {
      marginTop: 8,
    },
    errorsTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.error,
      marginBottom: 4,
    },
    errorText: {
      fontSize: 13,
      color: colors.text,
      marginBottom: 2,
    },
    feedbackContainer: {
      marginTop: 8,
    },
    feedbackTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.info,
      marginBottom: 4,
    },
    feedbackText: {
      fontSize: 13,
      color: colors.text,
      marginBottom: 2,
    },
    evaluatingContainer: {
      alignItems: 'center',
      padding: 20,
    },
    evaluatingText: {
      marginTop: 8,
      fontSize: 16,
      color: colors.text,
    },
    scoresGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 16,
    },
    scoreItem: {
      flex: 1,
      minWidth: 80,
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 12,
      alignItems: 'center',
    },
    scoreLabel: {
      fontSize: 12,
      color: colors.secondaryText,
      marginBottom: 4,
    },
    scoreValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.primary,
    },
    recommendationsContainer: {
      marginTop: 8,
    },
    recommendationsTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.success,
      marginBottom: 8,
    },
    recommendationText: {
      fontSize: 13,
      color: colors.text,
      marginBottom: 4,
      lineHeight: 18,
    },
    resultsActions: {
      flexDirection: 'row',
      padding: 16,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: colors.disabled + '30',
    },
    tryAgainButton: {
      flex: 1,
      paddingVertical: 12,
      backgroundColor: colors.secondary,
      borderRadius: 8,
      alignItems: 'center',
    },
    tryAgainButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.onSecondary,
    },
    nextItemButton: {
      flex: 1,
      paddingVertical: 12,
      backgroundColor: colors.primary,
      borderRadius: 8,
      alignItems: 'center',
    },
    nextItemButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.onPrimary,
    },
    settingsContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    settingsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.disabled + '30',
    },
    settingsTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    settingsContent: {
      flex: 1,
      padding: 16,
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.disabled + '20',
    },
    settingInfo: {
      flex: 1,
      marginRight: 16,
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    settingDescription: {
      fontSize: 14,
      color: colors.secondaryText,
    },
    timeOptions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    timeOption: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: colors.disabled + '30',
    },
    timeOptionActive: {
      backgroundColor: colors.primary,
    },
    timeOptionText: {
      fontSize: 12,
      color: colors.text,
    },
    timeOptionTextActive: {
      color: colors.onPrimary,
    },
  });

  return (
    <View style={styles.container}>
      {renderModeSelector()}
      {renderItemInfo()}
      {renderNavigation()}
      {renderPracticeComponent()}
      {renderResults()}
      {renderSettings()}
    </View>
  );
};

export default PronunciationPracticeScreen;