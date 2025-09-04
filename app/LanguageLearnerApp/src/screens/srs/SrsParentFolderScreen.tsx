/*
  SrsParentFolderScreen.tsx — React Native 버전
  ------------------------------------------------------------
  웹 SrsParentFolder.jsx를 모바일 앱에 맞게 리팩토링
*/

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  FlatList,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import { apiClient } from '../../services/apiClient';
import { AppHeader } from '../../components/common/AppHeader';
import { RootStackParamList } from '../../navigation/types';

dayjs.locale('ko');

type Props = NativeStackScreenProps<RootStackParamList, 'SrsParentFolder'>;

interface ParentFolder {
  id: number;
  name: string;
  createdDate: string;
  isFolderMastered?: boolean;
  folderMasteredAt?: string;
}

interface ChildFolder {
  id: number;
  name: string;
  createdDate: string;
  learningCurveType: 'short' | 'long' | 'free';
  total: number;
  reviewWaiting?: number;
  learningWaiting?: number;
  wrongAnswers?: number;
  frozen?: number;
  mastered?: number;
  correctWords?: number;
  isFolderMastered?: boolean;
}

function formatDate(dateString?: string) {
  if (!dateString) return '-';
  return dayjs(dateString).format('YYYY.MM.DD (ddd)');
}

export default function SrsParentFolderScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [parentFolder, setParentFolder] = useState<ParentFolder | null>(null);
  const [children, setChildren] = useState<ChildFolder[]>([]);
  const [newSubFolderName, setNewSubFolderName] = useState('');
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const response = await apiClient.get(`/srs/folders/${id}/children`);
      
      if (response.success && response.data) {
        setParentFolder(response.data.parentFolder);
        
        // 각 하위 폴더의 통계 정보 로드
        const childrenWithStats = await Promise.all(
          (response.data.children || []).map(async (child: any) => {
            if (child.learningCurveType === 'free') {
              try {
                const folderResponse = await apiClient.get(`/srs/folders/${child.id}/items`);
                
                if (folderResponse.success) {
                  const items = folderResponse.data?.quizItems ?? folderResponse.data?.items ?? [];
                  
                  // 통계 계산
                  const correctWords = items.filter((item: any) => {
                    if (!item.lastReviewedAt) return false;
                    if (!item.lastWrongAt) return true;
                    return new Date(item.lastReviewedAt) > new Date(item.lastWrongAt);
                  }).length;
                  
                  const wrongAnswers = items.filter((item: any) => {
                    if (!item.lastWrongAt) return false;
                    if (!item.lastReviewedAt) return true;
                    return new Date(item.lastWrongAt) >= new Date(item.lastReviewedAt);
                  }).length;
                  
                  const learningWaiting = items.filter((item: any) => 
                    !item.lastReviewedAt && !item.lastWrongAt
                  ).length;
                  
                  return {
                    ...child,
                    correctWords,
                    wrongAnswers,
                    learningWaiting
                  };
                }
              } catch (error) {
                console.error(`Failed to load items for folder ${child.id}:`, error);
              }
            }
            return child;
          })
        );
        
        setChildren(childrenWithStats);
      }
    } catch (error: any) {
      console.error('Failed to load parent folder:', error);
      Alert.alert('오류', '폴더를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleCreateSubFolder = async () => {
    const name = newSubFolderName.trim();
    if (!name) {
      Alert.alert('알림', '하위 폴더 이름을 입력하세요.');
      return;
    }
    
    try {
      setCreating(true);
      
      await apiClient.post('/srs/folders', {
        name,
        parentId: parseInt(id)
      });
      
      setNewSubFolderName('');
      await loadData();
      
      Alert.alert('성공', '하위 폴더가 생성되었습니다.');
    } catch (error: any) {
      Alert.alert('오류', `하위 폴더 생성 실패: ${error.message || 'Unknown error'}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSubFolder = (childId: number, childName: string) => {
    Alert.alert(
      '폴더 삭제 확인',
      `"${childName}" 하위 폴더를 삭제하시겠습니까? (포함된 카드도 함께 삭제됩니다)`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/srs/folders/${childId}`);
              await loadData();
              Alert.alert('성공', '폴더가 삭제되었습니다.');
            } catch (error: any) {
              Alert.alert('오류', `폴더 삭제 실패: ${error.message || 'Unknown error'}`);
            }
          }
        }
      ]
    );
  };

  const renderQuickCreateButton = (name: string) => (
    <TouchableOpacity
      key={name}
      style={styles.quickCreateButton}
      onPress={() => setNewSubFolderName(name)}
      activeOpacity={0.7}
    >
      <Text style={styles.quickCreateButtonText}>+ {name}</Text>
    </TouchableOpacity>
  );

  const renderChildFolder = ({ item: child }: { item: ChildFolder }) => {
    const isSpecial = child.isFolderMastered;
    
    return (
      <TouchableOpacity
        style={[
          styles.childFolderCard,
          isSpecial && styles.childFolderCardMastered
        ]}
        onPress={() => navigation.navigate('SrsFolderDetail', { id: child.id.toString() })}
        activeOpacity={0.8}
      >
        <View style={styles.childFolderHeader}>
          <View style={styles.childFolderTitleContainer}>
            <Text style={styles.childFolderTitle}>
              {child.learningCurveType === 'short' ? '🐰' : 
               child.learningCurveType === 'free' ? '🎯' : '🐢'} {child.name}
            </Text>
            <Text style={styles.childFolderDate}>
              생성일: {formatDate(child.createdDate)} | 단어 {child.total}개
            </Text>
          </View>
          
          <View style={styles.childFolderActions}>
            <TouchableOpacity
              style={styles.manageButton}
              onPress={() => navigation.navigate('SrsFolderDetail', { id: child.id.toString() })}
              activeOpacity={0.7}
            >
              <Text style={styles.manageButtonText}>관리</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteSubFolder(child.id, child.name)}
              activeOpacity={0.7}
            >
              <Text style={styles.deleteButtonText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.childFolderStats}>
          {child.learningCurveType === 'free' ? (
            // 자율모드 통계
            <>
              <Text style={styles.statItem}>정답한 단어 {child.correctWords}개</Text>
              <Text style={styles.statSeparator}>|</Text>
              <Text style={styles.statItem}>오답한 단어 {child.wrongAnswers}개</Text>
              <Text style={styles.statSeparator}>|</Text>
              <Text style={styles.statItem}>미학습 {child.learningWaiting}개</Text>
            </>
          ) : (
            // 일반 SRS 모드 통계
            <>
              <Text style={[styles.statItem, styles.statWarning]}>복습 {child.reviewWaiting}개</Text>
              <Text style={styles.statSeparator}>|</Text>
              <Text style={[styles.statItem, styles.statInfo]}>미학습 {child.learningWaiting}개</Text>
              <Text style={styles.statSeparator}>|</Text>
              <Text style={[styles.statItem, styles.statDanger]}>오답 {child.wrongAnswers}개</Text>
              <Text style={styles.statSeparator}>|</Text>
              <Text style={[styles.statItem, styles.statSecondary]}>동결 {child.frozen}개</Text>
              <Text style={styles.statSeparator}>|</Text>
              <Text style={[styles.statItem, styles.statSuccess]}>마스터 {child.mastered || 0}개</Text>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader 
          title="상위 폴더"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>폴더를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!parentFolder) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader 
          title="상위 폴더"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>📁</Text>
          <Text style={styles.errorTitle}>상위 폴더를 찾을 수 없습니다</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => navigation.navigate('SrsDashboard')}
            activeOpacity={0.8}
          >
            <Text style={styles.errorButtonText}>← SRS 대시보드로 돌아가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader 
        title={`${parentFolder.isFolderMastered ? '🌟' : '📁'} ${parentFolder.name}`}
        onBack={() => navigation.goBack()}
        subtitle={parentFolder.isFolderMastered ? '✨ 완전 정복! ✨' : undefined}
      />
      
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#3b82f6']}
            tintColor="#3b82f6"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 헤더 정보 */}
        <View style={[
          styles.headerCard,
          parentFolder.isFolderMastered && styles.headerCardMastered
        ]}>
          <Text style={styles.headerInfo}>
            생성일: {formatDate(parentFolder.createdDate)} | 하위 폴더 {children.length}개
          </Text>
          {parentFolder.isFolderMastered && parentFolder.folderMasteredAt && (
            <Text style={styles.masteredInfo}>
              완료일: {formatDate(parentFolder.folderMasteredAt)}
            </Text>
          )}
        </View>

        {/* 안내 메시지 */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>📌 3단계 구조 안내</Text>
          <Text style={styles.infoText}>
            이 상위 폴더에는 직접 카드를 추가할 수 없습니다. 
            아래에서 하위 폴더를 만든 후, 각 하위 폴더에 카드를 추가해 주세요.
          </Text>
        </View>

        {/* 하위 폴더 생성 폼 */}
        <View style={styles.createCard}>
          <Text style={styles.createTitle}>🆕 새 하위 폴더 만들기</Text>
          
          <View style={styles.createForm}>
            <TextInput
              style={styles.createInput}
              placeholder="하위 폴더 이름 (예: 명사, 동사, 형용사...)"
              placeholderTextColor="#9ca3af"
              value={newSubFolderName}
              onChangeText={setNewSubFolderName}
              editable={!creating}
              returnKeyType="done"
              onSubmitEditing={handleCreateSubFolder}
            />
            <TouchableOpacity
              style={[
                styles.createButton,
                (!newSubFolderName.trim() || creating) && styles.createButtonDisabled
              ]}
              onPress={handleCreateSubFolder}
              disabled={!newSubFolderName.trim() || creating}
              activeOpacity={0.8}
            >
              {creating ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.createButtonText}>만들기</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* 하위 폴더 목록 */}
        <View style={styles.foldersCard}>
          <Text style={styles.foldersTitle}>📂 하위 폴더 목록</Text>
          
          {children.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyTitle}>아직 하위 폴더가 없습니다.</Text>
              <Text style={styles.emptySubtitle}>위에서 새 하위 폴더를 만들어 시작해보세요!</Text>
            </View>
          ) : (
            <FlatList
              data={children}
              renderItem={renderChildFolder}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.foldersList}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
            />
          )}
        </View>

        {/* 빠른 하위 폴더 생성 버튼들 */}
        {children.length === 0 && (
          <View style={styles.quickCreateContainer}>
            <Text style={styles.quickCreateTitle}>💡 빠른 생성 (예시)</Text>
            <View style={styles.quickCreateButtons}>
              {['명사', '동사', '형용사', '부사', '회화', '문법'].map(renderQuickCreateButton)}
            </View>
          </View>
        )}
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
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorButton: {
    backgroundColor: '#6b7280',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  headerCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerCardMastered: {
    backgroundColor: '#e3f2fd',
    borderWidth: 3,
    borderColor: '#2196f3',
    shadowColor: '#2196f3',
    shadowOpacity: 0.3,
  },
  headerInfo: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  masteredInfo: {
    fontSize: 12,
    color: '#1976d2',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#dbeafe',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  createCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  createTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  createForm: {
    flexDirection: 'row',
    gap: 8,
  },
  createInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#f9fafb',
  },
  createButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  createButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  foldersCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  foldersTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  foldersList: {
    gap: 12,
  },
  childFolderCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    backgroundColor: 'white',
  },
  childFolderCardMastered: {
    backgroundColor: '#fff3cd',
    borderWidth: 2,
    borderColor: '#ffc107',
    shadowColor: '#ffc107',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  childFolderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  childFolderTitleContainer: {
    flex: 1,
  },
  childFolderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  childFolderDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  childFolderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  manageButton: {
    backgroundColor: '#3b82f6',
    borderWidth: 1,
    borderColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  manageButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#dc2626',
    borderWidth: 1,
    borderColor: '#dc2626',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteButtonText: {
    fontSize: 12,
  },
  childFolderStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  statItem: {
    fontSize: 12,
    color: '#374151',
  },
  statSeparator: {
    fontSize: 12,
    color: '#9ca3af',
    marginHorizontal: 8,
  },
  statWarning: {
    color: '#f59e0b',
  },
  statInfo: {
    color: '#3b82f6',
  },
  statDanger: {
    color: '#ef4444',
  },
  statSecondary: {
    color: '#6b7280',
  },
  statSuccess: {
    color: '#10b981',
  },
  quickCreateContainer: {
    marginBottom: 16,
  },
  quickCreateTitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 12,
  },
  quickCreateButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickCreateButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  quickCreateButtonText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
});