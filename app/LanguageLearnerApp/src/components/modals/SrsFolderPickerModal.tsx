/*
  SrsFolderPickerModal.tsx — React Native 버전
  ------------------------------------------------------------
  웹 SrsFolderPickerModal.jsx를 모바일 앱에 맞게 리팩토링
*/

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { apiClient } from '../../services/apiClient';

interface Folder {
  id: number;
  name: string;
  createdDate?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (folder: Folder) => void;
}

export default function SrsFolderPickerModal({ visible, onClose, onPick }: Props) {
  const [loading, setLoading] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const loadFolders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/srs/picker');
      
      if (response.success) {
        const folderList = Array.isArray(response.data) ? response.data : [];
        setFolders(folderList);
      }
    } catch (error: any) {
      console.error('picker() failed:', error);
      Alert.alert('오류', '폴더 목록을 불러오지 못했습니다.', [
        { text: '확인', onPress: onClose }
      ]);
    } finally {
      setLoading(false);
    }
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      loadFolders();
    } else {
      // 모달이 닫힐 때 상태 초기화
      setSelectedId(null);
      setSearchQuery('');
      setNewName('');
    }
  }, [visible, loadFolders]);

  const filteredFolders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return folders;
    return folders.filter(folder => 
      String(folder.name || '').toLowerCase().includes(query)
    );
  }, [folders, searchQuery]);

  const handleClose = () => {
    setSelectedId(null);
    setSearchQuery('');
    setNewName('');
    onClose();
  };

  const handleConfirmPick = () => {
    const selectedFolder = folders.find(folder => folder.id === selectedId);
    if (!selectedFolder) {
      Alert.alert('알림', '폴더를 선택하세요.');
      return;
    }
    onPick(selectedFolder);
    handleClose();
  };

  const handleQuickCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    
    try {
      setCreating(true);
      
      const response = await apiClient.post('/srs/quick-create', { name });
      
      if (response.success) {
        onPick(response.data);
        handleClose();
      }
    } catch (error: any) {
      Alert.alert('오류', error?.message || '폴더 생성 실패');
    } finally {
      setCreating(false);
    }
  };

  const renderFolderItem = ({ item: folder }: { item: Folder }) => (
    <TouchableOpacity
      style={[
        styles.folderItem,
        selectedId === folder.id && styles.folderItemSelected
      ]}
      onPress={() => setSelectedId(folder.id)}
      activeOpacity={0.8}
    >
      <View style={styles.folderItemHeader}>
        <View style={styles.radioContainer}>
          <View style={[
            styles.radioOuter,
            selectedId === folder.id && styles.radioOuterSelected
          ]}>
            {selectedId === folder.id && (
              <View style={styles.radioInner} />
            )}
          </View>
        </View>
        
        <View style={styles.folderInfo}>
          <Text style={styles.folderName}>{folder.name}</Text>
          <Text style={styles.folderMeta}>
            id: {folder.id}
            {folder.createdDate && (
              <Text> | {new Date(folder.createdDate).toISOString().slice(0, 10)}</Text>
            )}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>SRS 폴더 선택</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                activeOpacity={0.8}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.modalContent}>
              {/* 새 폴더 생성 */}
              <View style={styles.createSection}>
                <Text style={styles.sectionLabel}>새 폴더 이름</Text>
                <View style={styles.createForm}>
                  <TextInput
                    style={[
                      styles.createInput,
                      creating && styles.inputDisabled
                    ]}
                    placeholder="예: 오늘 추가"
                    placeholderTextColor="#9ca3af"
                    value={newName}
                    onChangeText={setNewName}
                    editable={!creating}
                    returnKeyType="done"
                    onSubmitEditing={handleQuickCreate}
                  />
                  <TouchableOpacity
                    style={[
                      styles.createButton,
                      (!newName.trim() || creating) && styles.createButtonDisabled
                    ]}
                    onPress={handleQuickCreate}
                    disabled={creating || !newName.trim()}
                    activeOpacity={0.8}
                  >
                    {creating ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={styles.createButtonText}>추가</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* 폴더 검색 */}
              <View style={styles.searchSection}>
                <TextInput
                  style={[styles.searchInput, loading && styles.inputDisabled]}
                  placeholder="폴더 검색"
                  placeholderTextColor="#9ca3af"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  editable={!loading}
                />
              </View>

              {/* 폴더 목록 */}
              <View style={styles.folderListContainer}>
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text style={styles.loadingText}>불러오는 중…</Text>
                  </View>
                ) : filteredFolders.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyIcon}>📁</Text>
                    <Text style={styles.emptyText}>폴더가 없습니다.</Text>
                  </View>
                ) : (
                  <FlatList
                    data={filteredFolders}
                    renderItem={renderFolderItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.folderList}
                    showsVerticalScrollIndicator={false}
                  />
                )}
              </View>
            </View>

            {/* Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleClose}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>취소</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  !selectedId && styles.confirmButtonDisabled
                ]}
                onPress={handleConfirmPick}
                disabled={!selectedId}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.confirmButtonText,
                  !selectedId && styles.confirmButtonTextDisabled
                ]}>
                  선택
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flex: 1,
  },
  createSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2937',
  },
  inputDisabled: {
    backgroundColor: '#f9fafb',
    color: '#9ca3af',
  },
  createButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  createButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  createButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  searchSection: {
    marginBottom: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2937',
  },
  folderListContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
  },
  folderList: {
    paddingVertical: 4,
  },
  folderItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  folderItemSelected: {
    backgroundColor: '#eff6ff',
  },
  folderItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioContainer: {
    marginRight: 12,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: '#3b82f6',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  folderMeta: {
    fontSize: 12,
    color: '#6b7280',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  confirmButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  confirmButtonTextDisabled: {
    color: '#d1d5db',
  },
});