// src/components/VocabCard.tsx
// 마스터 별 표시가 포함된 단어 카드 컴포넌트 (React Native 버전)

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { TouchFeedback } from './animations';
import RainbowStar from './RainbowStar';
import Pron from './Pron';
import { VocabCardProps } from '../types';
import { useThemedStyles, useColors } from '../context/ThemeContext';
import { Theme } from '../theme';

const VocabCard: React.FC<VocabCardProps> = ({ 
  vocab, 
  card = null,
  onPress, 
  style = {},
  showProgress = true,
  size = 'medium',
  onPlayAudio = null,
  playingAudio = null
}) => {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  
  const isCardMastered = card?.isMastered;
  const masterCycles = card?.masterCycles || 0;
  
  // Check if this is an idiom or phrasal verb
  const isIdiomOrPhrasal = vocab.source === 'idiom_migration';
  // Check if this is a Japanese vocabulary (JLPT or has Japanese audio)
  const isJapaneseVocab = vocab.source?.includes('jlpt') ||
                          vocab.source?.includes('japanese') ||
                          vocab.levelJLPT ||
                          (vocab.audio_local && typeof vocab.audio_local === 'string' && vocab.audio_local.includes('japanese'));
  const isPlaying = playingAudio?.type === 'vocab' && playingAudio?.id === vocab.id;
  
  const getStageInfo = () => {
    if (isCardMastered) {
      return {
        text: '마스터 완료',
        color: colors.mastery,
        bgColor: colors.successLight
      };
    }
    
    if (!card) {
      return {
        text: '미학습',
        color: colors.textSecondary,
        bgColor: colors.backgroundTertiary
      };
    }
    
    const stage = card.stage || 0;
    const stageLabels = ['새 단어', 'Stage 1', 'Stage 2', 'Stage 3', 'Stage 4', 'Stage 5', 'Stage 6'];
    const stageColors = [
      { color: colors.textSecondary, bgColor: colors.backgroundTertiary }, // gray
      { color: colors.info, bgColor: colors.infoLight }, // blue
      { color: colors.success, bgColor: colors.successLight }, // green
      { color: colors.warning, bgColor: colors.warningLight }, // yellow
      { color: colors.warning, bgColor: colors.warningLight }, // orange
      { color: colors.error, bgColor: colors.errorLight }, // red
      { color: colors.mastery, bgColor: colors.successLight }  // purple
    ];
    
    return {
      text: stageLabels[stage] || `Stage ${stage}`,
      color: stageColors[stage]?.color || colors.textSecondary,
      bgColor: stageColors[stage]?.bgColor || colors.backgroundTertiary
    };
  };

  const getOverdueStatus = () => {
    if (!card || isCardMastered) return null;
    
    const now = new Date();
    
    // 동결 상태 체크 (최우선)
    if (card.frozenUntil) {
      const frozenUntil = new Date(card.frozenUntil);
      if (now < frozenUntil) {
        return {
          text: '동결됨',
          color: colors.info,
          bgColor: colors.infoLight,
          urgent: false,
          frozen: true
        };
      }
    }
    
    if (card.isOverdue && card.overdueDeadline) {
      const deadline = new Date(card.overdueDeadline);
      if (now < deadline) {
        return {
          text: '복습 필요',
          color: colors.warning,
          bgColor: colors.warningLight,
          urgent: true
        };
      }
    }
    
    if (card.waitingUntil) {
      const waitingUntil = new Date(card.waitingUntil);
      if (now < waitingUntil) {
        const isWrongAnswerWait = card.isFromWrongAnswer;
        return {
          text: isWrongAnswerWait ? '오답 대기' : '정답 대기',
          color: isWrongAnswerWait ? colors.error : colors.success,
          bgColor: isWrongAnswerWait ? colors.errorLight : colors.successLight,
          urgent: false
        };
      }
    }
    
    return null;
  };

  const stageInfo = getStageInfo();
  const overdueStatus = getOverdueStatus();

  // 카드 배경색 결정
  const getCardBackgroundColor = () => {
    if (isCardMastered) {
      return styles.masteredCard;
    }
    
    if (!card) return styles.defaultCard;
    
    if (overdueStatus?.frozen) {
      return styles.frozenCard;
    }
    
    if (card.isOverdue) {
      return styles.overdueCard;
    }
    
    if (card.waitingUntil) {
      const now = new Date();
      if (now < new Date(card.waitingUntil)) {
        if (card.isFromWrongAnswer) {
          return styles.wrongWaitCard;
        } else {
          return styles.correctWaitCard;
        }
      }
    }
    
    return styles.defaultCard;
  };

  const cardSizeStyle = size === 'large' ? styles.largeCard : styles.mediumCard;

  return (
    <TouchFeedback
      onPress={onPress}
      style={[styles.card, getCardBackgroundColor(), cardSizeStyle, style]}
    >
      {/* 마스터 별 표시 */}
      {isCardMastered && (
        <View style={styles.starContainer}>
          <RainbowStar 
            size={size === 'large' ? 'large' : 'medium'} 
            cycles={masterCycles} 
            animated={true}
          />
        </View>
      )}
      
      {/* 동결 상태 표시 */}
      {overdueStatus?.frozen && (
        <View style={styles.statusBadgeContainer}>
          <View style={[styles.statusBadge, { backgroundColor: overdueStatus.bgColor }]}>
            <Text style={[styles.statusBadgeText, { color: overdueStatus.color }]}>
              🧊 동결됨
            </Text>
          </View>
        </View>
      )}
      
      {/* 긴급 복습 표시 */}
      {overdueStatus?.urgent && !overdueStatus?.frozen && (
        <View style={styles.statusBadgeContainer}>
          <View style={[styles.statusBadge, styles.urgentBadge, { backgroundColor: overdueStatus.bgColor }]}>
            <Text style={[styles.statusBadgeText, { color: overdueStatus.color }]}>
              ⚠️ 복습 필요
            </Text>
          </View>
        </View>
      )}
      
      {/* 단어 헤더 */}
      <View style={styles.header}>
        <View style={styles.wordInfo}>
          <Text style={[
            styles.lemma, 
            size === 'large' ? styles.largeLemma : styles.mediumLemma,
            isCardMastered && styles.masteredLemma
          ]}>
            {vocab.lemma}
          </Text>
          
          <View style={styles.metaInfo}>
            <Text style={styles.pos}>{vocab.pos}</Text>
            {vocab.levelCEFR && (
              <View style={styles.cefrBadge}>
                <Text style={styles.cefrText}>{vocab.levelCEFR}</Text>
              </View>
            )}
          </View>
        </View>
        
        {/* Play button for idioms, phrasal verbs, and Japanese vocabulary */}
        {(isIdiomOrPhrasal || isJapaneseVocab) && onPlayAudio && (
          <TouchableOpacity
            style={styles.playButton}
            onPress={() => onPlayAudio(vocab)}
            activeOpacity={0.7}
          >
            <Text style={styles.playIcon}>
              {isPlaying ? '⏸️' : '▶️'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* 발음 표시 */}
      {vocab.dictMeta?.ipa && (
        <View style={styles.pronContainer}>
          <Pron ipa={vocab.dictMeta.ipa} />
        </View>
      )}
      
      {/* 진행 상태 표시 */}
      {showProgress && (
        <View style={styles.progressContainer}>
          {/* Stage 표시 */}
          <View style={[styles.badge, { backgroundColor: stageInfo.bgColor }]}>
            <Text style={[styles.badgeText, { color: stageInfo.color }]}>
              {stageInfo.text}
            </Text>
          </View>
          
          {/* 상태 표시 */}
          {overdueStatus && (
            <View style={[styles.badge, { backgroundColor: overdueStatus.bgColor }]}>
              <Text style={[styles.badgeText, { color: overdueStatus.color }]}>
                {overdueStatus.text}
              </Text>
            </View>
          )}
          
          {/* 마스터 사이클 표시 */}
          {isCardMastered && masterCycles > 1 && (
            <View style={[styles.badge, styles.masterCycleBadge]}>
              <Text style={styles.masterCycleText}>
                {masterCycles}회 마스터
              </Text>
            </View>
          )}
        </View>
      )}
      
      {/* 학습 통계 */}
      {card && (card.correctTotal > 0 || card.wrongTotal > 0) && (
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>
            정답 {card.correctTotal} / 오답 {card.wrongTotal}
          </Text>
          
          {!isCardMastered && card.correctTotal + card.wrongTotal > 0 && (
            <Text style={styles.accuracyText}>
              {((card.correctTotal / (card.correctTotal + card.wrongTotal)) * 100).toFixed(0)}%
            </Text>
          )}
        </View>
      )}
      
      {/* 마스터 완료 시각 */}
      {isCardMastered && card.masteredAt && (
        <Text style={styles.masteredAtText}>
          🏆 {new Date(card.masteredAt).toLocaleDateString('ko-KR')} 마스터 완료
        </Text>
      )}
    </TouchFeedback>
  );
};

const createStyles = (theme: Theme) => {
  const { colors, typography, spacing, variants } = theme;
  const cardVariant = variants.card.specialCards.vocabCard;

  return {
    card: {
      ...cardVariant,
      marginBottom: spacing.md,
      position: 'relative' as const,
    },
    mediumCard: {
      minHeight: spacing.learning.vocabCard.minHeight,
    },
    largeCard: {
      minHeight: spacing.learning.vocabCard.minHeight + spacing.xl,
    },
    defaultCard: {
      backgroundColor: colors.surface,
    },
    masteredCard: {
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.mastery,
    },
    frozenCard: {
      backgroundColor: colors.infoLight,
    },
    overdueCard: {
      backgroundColor: colors.warningLight,
    },
    wrongWaitCard: {
      backgroundColor: colors.errorLight,
    },
    correctWaitCard: {
      backgroundColor: colors.successLight,
    },
    starContainer: {
      position: 'absolute' as const,
      top: spacing.sm,
      right: spacing.sm,
      zIndex: 10,
    },
    statusBadgeContainer: {
      position: 'absolute' as const,
      top: spacing.sm,
      left: spacing.sm,
      zIndex: 10,
    },
    statusBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: spacing.md,
    },
    urgentBadge: {
      // Add any urgent-specific styling
    },
    statusBadgeText: {
      ...typography.xs,
      fontWeight: typography.fontWeight.bold,
    },
    header: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'flex-start' as const,
      marginBottom: spacing.md,
    },
    wordInfo: {
      flex: 1,
    },
    lemma: {
      ...typography.vocab,
      color: colors.text,
      marginBottom: spacing.xs,
    },
    mediumLemma: {
      fontSize: typography.lg.fontSize,
    },
    largeLemma: {
      fontSize: typography.xl.fontSize,
    },
    masteredLemma: {
      color: colors.mastery,
    },
    metaInfo: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.sm,
    },
    pos: {
      ...typography.body2,
      color: colors.textSecondary,
    },
    cefrBadge: {
      backgroundColor: colors.infoLight,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs / 2,
      borderRadius: spacing.xs,
    },
    cefrText: {
      ...typography.caption,
      color: colors.info,
    },
    playButton: {
      width: spacing.xl,
      height: spacing.xl,
      borderRadius: spacing.md,
      backgroundColor: colors.infoLight,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    playIcon: {
      fontSize: typography.md.fontSize,
      color: colors.info,
    },
    pronContainer: {
      marginBottom: spacing.sm,
    },
    progressContainer: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    badge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: spacing.md,
    },
    badgeText: {
      ...typography.caption,
      fontWeight: typography.fontWeight.medium,
    },
    masterCycleBadge: {
      backgroundColor: colors.successLight,
    },
    masterCycleText: {
      ...typography.caption,
      fontWeight: typography.fontWeight.bold,
      color: colors.mastery,
    },
    statsContainer: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    statsText: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    accuracyText: {
      ...typography.caption,
      fontWeight: typography.fontWeight.medium,
      color: colors.success,
    },
    masteredAtText: {
      ...typography.caption,
      fontWeight: typography.fontWeight.medium,
      color: colors.mastery,
      marginTop: spacing.sm,
    },
  };
};

export default VocabCard;