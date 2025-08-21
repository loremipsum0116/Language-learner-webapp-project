// src/components/AutoFolderModal.jsx
import React, { useState, useEffect } from 'react';
import { fetchJSON, withCreds } from '../api/client';
import HierarchicalFolderPickerModal from './HierarchicalFolderPickerModal';

const AutoFolderModal = ({ isOpen, onClose, selectedVocabIds, examCategory, cefrLevel, examCategories = [], onSuccess }) => {
    // 단계 관리: 'folder-picker' -> 'auto-folder-config'
    const [step, setStep] = useState('folder-picker');
    
    // 선택된 폴더 정보
    const [selectedFolder, setSelectedFolder] = useState(null);
    
    // 자동 폴더 설정 관련
    const [dailyWordCount, setDailyWordCount] = useState(20);
    const [folderPrefix, setFolderPrefix] = useState('DAY');
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);

    // 모달 열릴 때 초기화
    useEffect(() => {
        if (!isOpen) return;
        
        // 상태 초기화
        setStep('folder-picker');
        setSelectedFolder(null);
        setPreview(null);
        setLoading(false);
        setCreating(false);
    }, [isOpen]);

    // 미리보기 로드
    useEffect(() => {
        console.log('[AutoFolder] Preview useEffect triggered:', {
            isOpen,
            step,
            examCategory,
            cefrLevel,
            dailyWordCount
        });
        
        if (!isOpen || step !== 'auto-folder-config') {
            console.log('[AutoFolder] Preview conditions not met, returning');
            return;
        }

        // 내 단어장에서는 selectedVocabIds가 있어야 하고, 다른 경우에는 examCategory나 cefrLevel이 있어야 함
        if (examCategory === 'mywordbook' && selectedVocabIds.length === 0) {
            console.log('[AutoFolder] MyWordbook but no selected vocab IDs');
            return;
        }
        
        if (!examCategory && !cefrLevel && selectedVocabIds.length === 0) {
            console.log('[AutoFolder] No exam category, CEFR level, or selected vocab IDs');
            return;
        }
        
        const loadPreview = async () => {
            try {
                setLoading(true);
                
                let url = `/auto-folder/preview?dailyWordCount=${dailyWordCount}`;
                if (examCategory && examCategory !== 'mywordbook') {
                    url += `&examCategory=${examCategory}`;
                } else if (cefrLevel) {
                    url += `&cefrLevel=${cefrLevel}`;
                } else if (selectedVocabIds.length > 0) {
                    // 내 단어장에서 선택된 단어들로 자동 폴더 생성
                    url += `&selectedVocabIds=${selectedVocabIds.join(',')}`;
                }
                
                console.log('[AutoFolder] Making preview API call to:', url);
                const response = await fetchJSON(url, withCreds());
                console.log('[AutoFolder] Preview API response:', response);
                setPreview(response.data);
            } catch (error) {
                console.error('Failed to load preview:', error);
                setPreview(null);
            } finally {
                setLoading(false);
            }
        };
        
        const debounceTimer = setTimeout(loadPreview, 300);
        return () => clearTimeout(debounceTimer);
    }, [isOpen, step, examCategory, cefrLevel, dailyWordCount, selectedVocabIds]);

    const handleFolderSelected = (folder) => {
        setSelectedFolder(folder);
        setStep('auto-folder-config');
    };

    const handleCreate = async () => {
        try {
            setCreating(true);
            
            const requestData = {
                dailyWordCount: parseInt(dailyWordCount),
                parentFolderId: selectedFolder?.id || null,
                folderNamePrefix: folderPrefix,
                includeOnlyNew: false
            };

            console.log('[AutoFolder] Creating folders with params:', {
                examCategory,
                cefrLevel,
                selectedVocabIds: selectedVocabIds.length,
                selectedVocabIdsArray: selectedVocabIds
            });

            if (examCategory && examCategory !== 'mywordbook') {
                requestData.examCategory = examCategory;
            } else if (cefrLevel && examCategory !== 'mywordbook') {
                requestData.cefrLevel = cefrLevel;
            } else if (selectedVocabIds.length > 0) {
                // 내 단어장에서 선택된 단어들로 자동 폴더 생성
                requestData.selectedVocabIds = selectedVocabIds;
            }

            console.log('[AutoFolder] Final request data:', requestData);
            
            const response = await fetchJSON('/auto-folder/generate', withCreds({
                method: 'POST',
                body: JSON.stringify(requestData)
            }));
            
            if (response.data?.success) {
                alert(`✅ ${response.data.totalFolders}개의 폴더가 성공적으로 생성되었습니다!`);
                onSuccess && onSuccess(response.data);
                onClose();
            } else {
                throw new Error(response.data?.message || 'Unknown error');
            }
            
        } catch (error) {
            console.error('Failed to create folders:', error);
            alert(`❌ 폴더 생성에 실패했습니다: ${error.message}`);
        } finally {
            setCreating(false);
        }
    };

    if (!isOpen) return null;

    const hasSourceData = examCategory || cefrLevel || selectedVocabIds.length > 0;
    const sourceDisplayName = examCategory && examCategory !== 'mywordbook'
        ? (examCategories.find(e => e.name === examCategory)?.displayName || examCategory)
        : cefrLevel 
        ? cefrLevel
        : selectedVocabIds.length > 0 
        ? `선택된 ${selectedVocabIds.length}개 단어`
        : null;

    return (
        <>
            {step === 'folder-picker' ? (
                // 1단계: 기존 HierarchicalFolderPickerModal을 상위폴더 선택용으로 사용
                <HierarchicalFolderPickerModal
                    show={isOpen}
                    onClose={onClose}
                    onPick={handleFolderSelected}
                    parentOnlyMode={true}
                    customHeader={
                        <div className="alert alert-info mb-3">
                            <h6 className="mb-2">📁 자동 폴더 생성 - {sourceDisplayName}</h6>
                            <small>
                                📌 <strong>3단계 구조:</strong> 상위폴더 → 하위폴더 → 카드<br />
                                <strong>{sourceDisplayName}</strong> {examCategory ? '시험' : '레벨'}의 단어들로 하위폴더(DAY1, DAY2...)를 자동 생성할 상위폴더를 선택하세요.
                            </small>
                        </div>
                    }
                />
            ) : (
                // 2단계: 자동 폴더 설정
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">📁 자동 폴더 생성 - {sourceDisplayName}</h5>
                                <button type="button" className="btn-close" onClick={onClose}></button>
                            </div>
                            
                            <div className="modal-body">
                                <div className="alert alert-success">
                                    선택된 상위 폴더: <strong>📁 {selectedFolder?.name || '루트 폴더'}</strong>
                                    <br /><strong>{sourceDisplayName}</strong> {examCategory ? '시험' : '레벨'}의 단어들로 하위 폴더를 자동 생성합니다.
                                </div>

                                <div className="row">
                                    <div className="col-md-6">
                                        <div className="mb-3">
                                            <label className="form-label">하루 학습 단어 수</label>
                                            <input
                                                type="number"
                                                className="form-control"
                                                value={dailyWordCount}
                                                onChange={(e) => setDailyWordCount(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
                                                min="1"
                                                max="500"
                                            />
                                            <div className="form-text">1~500개 사이로 설정하세요</div>
                                        </div>
                                    </div>
                                    
                                    <div className="col-md-6">
                                        <div className="mb-3">
                                            <label className="form-label">폴더 이름 접두사</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={folderPrefix}
                                                onChange={(e) => setFolderPrefix(e.target.value.slice(0, 10))}
                                                placeholder="DAY"
                                            />
                                            <div className="form-text">예: DAY1, DAY2, ...</div>
                                        </div>
                                    </div>
                                </div>

                                {/* 미리보기 */}
                                {loading ? (
                                    <div className="text-center p-3">
                                        <div className="spinner-border text-primary" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                    </div>
                                ) : preview ? (
                                    <div className="alert alert-success">
                                        <h6>📋 생성 예상 결과</h6>
                                        <ul className="mb-0">
                                            <li>총 단어 수: <strong>{preview.totalWords}개</strong></li>
                                            <li>생성될 폴더 수: <strong>{preview.estimatedFolders}개</strong></li>
                                            <li>폴더 이름: <strong>{preview.preview.firstFolderName} ~ {preview.preview.lastFolderName}</strong></li>
                                            <li>마지막 폴더 단어 수: <strong>{preview.preview.lastFolderWordCount}개</strong></li>
                                        </ul>
                                    </div>
                                ) : null}

                                {!hasSourceData && (
                                    <div className="alert alert-warning">
                                        단어 카테고리가 선택되지 않았습니다. CEFR 레벨 또는 시험별 단어 탭에서 사용해주세요.
                                    </div>
                                )}
                            </div>
                            
                            <div className="modal-footer">
                                <button 
                                    type="button" 
                                    className="btn btn-outline-secondary" 
                                    onClick={() => setStep('folder-picker')}
                                >
                                    이전 단계
                                </button>
                                <button type="button" className="btn btn-secondary" onClick={onClose}>
                                    취소
                                </button>
                                <button 
                                    type="button" 
                                    className={`btn btn-primary ${(!preview || loading) ? 'opacity-50' : ''}`}
                                    onClick={handleCreate}
                                    disabled={creating || loading || !preview || !hasSourceData}
                                >
                                    {creating ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                            폴더 생성 중...
                                        </>
                                    ) : preview ? (
                                        `${preview.estimatedFolders}개 폴더 생성하기`
                                    ) : (
                                        '미리보기 로딩 중...'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AutoFolderModal;