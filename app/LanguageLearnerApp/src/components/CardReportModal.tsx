// src/components/CardReportModal.tsx
// 카드 신고 모달 컴포넌트 (React Native 버전)

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { CardReportModalProps, ReportType, SeverityLevel } from '../types';

const CardReportModal: React.FC<CardReportModalProps> = ({ 
  isOpen, 
  onClose, 
  vocabId, 
  vocabLemma, 
  onReportSubmitted 
}) => {
  const [reportData, setReportData] = useState({
    reportType: '',
    description: '',
    severity: 'MEDIUM' as SeverityLevel
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reportTypes: ReportType[] = [
    { value: 'AUDIO_QUALITY', label: '🔊 음성 품질 문제', description: '발음이 부정확하거나 음질이 나쁨' },
    { value: 'WRONG_TRANSLATION', label: '📝 번역 오류', description: '번역이 틀렸거나 부적절함' },
    { value: 'INAPPROPRIATE', label: '⚠️ 부적절한 내용', description: '불쾌하거나 부적절한 예문/내용' },
    { value: 'MISSING_INFO', label: '❓ 정보 부족', description: '예문이나 설명이 부족함' },
    { value: 'TECHNICAL_ISSUE', label: '🔧 기술적 문제', description: '카드가 제대로 작동하지 않음' },
    { value: 'OTHER', label: '💬 기타', description: '위에 해당하지 않는 문제' }
  ];

  const severityLevels = [
    { value: 'LOW' as SeverityLevel, label: '낮음', color: '#16a34a', description: '사소한 문제' },
    { value: 'MEDIUM' as SeverityLevel, label: '보통', color: '#ca8a04', description: '일반적인 문제' },
    { value: 'HIGH' as SeverityLevel, label: '높음', color: '#dc2626', description: '심각한 문제' },
    { value: 'CRITICAL' as SeverityLevel, label: '긴급', color: '#dc2626', description: '즉시 수정 필요' }
  ];

  const handleSubmit = async () => {
    if (!reportData.reportType) {
      Alert.alert('오류', '신고 유형을 선택해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      // TODO: React Native용 API 호출 구현 필요
      const response = await fetch('/api/cards/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // TODO: React Native AsyncStorage에서 토큰 가져오기
          // 'Authorization': `Bearer ${await AsyncStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          vocabId: vocabId,
          reportType: reportData.reportType,
          description: reportData.description,
          severity: reportData.severity
        })
      });

      if (response.ok) {
        Alert.alert('완료', '신고가 접수되었습니다. 검토 후 조치하겠습니다.');
        setReportData({ reportType: '', description: '', severity: 'MEDIUM' });
        if (onReportSubmitted) onReportSubmitted();
        onClose();
      } else {
        const error = await response.json();
        Alert.alert('오류', error.message || '신고 접수 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Report submission error:', error);
      Alert.alert('오류', '네트워크 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
        <View style={styles.header}>
          <Text style={styles.title}>📋 카드 신고하기</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            disabled={isSubmitting}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.targetInfo}>
              <Text style={styles.targetLabel}>신고 대상: </Text>
              <Text style={styles.targetVocab}>{vocabLemma}</Text>
              <Text style={styles.targetDescription}>
                문제가 있는 카드를 신고해주시면 품질 개선에 도움이 됩니다.
              </Text>
            </View>

            {/* 문제 유형 선택 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>문제 유형 *</Text>
              <View style={styles.reportTypesContainer}>
                {reportTypes.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.reportTypeCard,
                      reportData.reportType === type.value && styles.selectedReportType
                    ]}
                    onPress={() => setReportData({...reportData, reportType: type.value})}
                    activeOpacity={0.7}
                  >
                    <View style={styles.reportTypeContent}>
                      <Text style={styles.reportTypeLabel}>{type.label}</Text>
                      <Text style={styles.reportTypeDescription}>{type.description}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 심각도 선택 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>심각도</Text>
              <View style={styles.severityContainer}>
                {severityLevels.map((level) => (
                  <TouchableOpacity
                    key={level.value}
                    style={[
                      styles.severityButton,
                      reportData.severity === level.value && [
                        styles.selectedSeverity,
                        { borderColor: level.color }
                      ]
                    ]}
                    onPress={() => setReportData({...reportData, severity: level.value})}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.severityText,
                      reportData.severity === level.value && { color: level.color }
                    ]}>
                      {level.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 상세 설명 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                상세 설명 <Text style={styles.optional}>(선택사항)</Text>
              </Text>
              <TextInput
                style={styles.textArea}
                multiline={true}
                numberOfLines={4}
                placeholder="문제에 대한 자세한 설명을 입력해주세요. (예: 어떤 부분이 틀렸는지, 언제 발생했는지 등)"
                placeholderTextColor="#9ca3af"
                value={reportData.description}
                onChangeText={(text) => setReportData({...reportData, description: text})}
                textAlignVertical="top"
              />
              <Text style={styles.helpText}>
                구체적인 설명일수록 더 빠르게 문제를 해결할 수 있습니다.
              </Text>
            </View>

            {/* 안내 메시지 */}
            <View style={styles.infoAlert}>
              <Text style={styles.infoText}>
                💡 신고해주신 내용은 검토 후 24-48시간 내에 처리됩니다.
                동일한 문제가 여러 번 신고되면 우선적으로 처리됩니다.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onClose}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>취소</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.button, 
              styles.submitButton,
              (!reportData.reportType || isSubmitting) && styles.disabledButton
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting || !reportData.reportType}
            activeOpacity={0.7}
          >
            {isSubmitting ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="white" />
                <Text style={styles.submitButtonText}>신고 접수 중...</Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>신고하기</Text>
            )}
          </TouchableOpacity>
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'white',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#6b7280',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  targetInfo: {
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 20,
  },
  targetLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  targetVocab: {
    fontSize: 16,
    color: '#1f2937',
    marginBottom: 8,
  },
  targetDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  optional: {
    fontWeight: 'normal',
    color: '#6b7280',
  },
  reportTypesContainer: {
    gap: 8,
  },
  reportTypeCard: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
  },
  selectedReportType: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  reportTypeContent: {
    gap: 4,
  },
  reportTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  reportTypeDescription: {
    fontSize: 12,
    color: '#6b7280',
  },
  severityContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  severityButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    alignItems: 'center',
  },
  selectedSeverity: {
    borderWidth: 2,
    backgroundColor: '#f8fafc',
  },
  severityText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1f2937',
    minHeight: 100,
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    color: '#6b7280',
  },
  infoAlert: {
    padding: 16,
    backgroundColor: '#dbeafe',
    borderRadius: 8,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#6b7280',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#dc2626',
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

export default CardReportModal;