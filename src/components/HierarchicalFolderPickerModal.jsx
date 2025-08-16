// src/components/HierarchicalFolderPickerModal.jsx
import React, { useEffect, useState } from 'react';
import { fetchJSON, withCreds } from '../api/client';

export default function HierarchicalFolderPickerModal({ show, onClose, onPick }) {
  const [loading, setLoading] = useState(false);
  const [parentFolders, setParentFolders] = useState([]);
  const [selectedParentId, setSelectedParentId] = useState(null);
  const [childFolders, setChildFolders] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [loadingChildren, setLoadingChildren] = useState(false);
  
  const [newParentName, setNewParentName] = useState('');
  const [newChildName, setNewChildName] = useState('');
  const [creating, setCreating] = useState(false);

  // 상위폴더 목록 로드
  useEffect(() => {
    if (!show) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        console.log('[HierarchicalPicker] 상위폴더 목록 로드 시작');
        const { data } = await fetchJSON('/srs/dashboard', withCreds());
        console.log('[HierarchicalPicker] 대시보드 응답:', data);
        
        if (alive) {
          // 모든 폴더를 상위폴더로 처리 (parentId가 null이거나 없는 것들)
          const parents = Array.isArray(data) ? data.filter(f => f.parentId === null || f.parentId === undefined) : [];
          console.log('[HierarchicalPicker] 필터링된 상위폴더들:', parents);
          setParentFolders(parents);
        }
      } catch (e) {
        console.error('[HierarchicalPicker] 상위폴더 목록 로드 실패:', e);
        if (alive) {
          alert(`폴더 목록을 불러오지 못했습니다: ${e.message || '알 수 없는 오류'}`);
          setParentFolders([]); // 빈 배열로 초기화
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [show]);

  // 하위폴더 목록 로드
  useEffect(() => {
    if (!selectedParentId) {
      setChildFolders([]);
      setSelectedChildId(null);
      return;
    }

    let alive = true;
    (async () => {
      setLoadingChildren(true);
      try {
        console.log(`[HierarchicalPicker] 하위폴더 로드 시작: ${selectedParentId}`);
        const { data } = await fetchJSON(`/srs/folders/${selectedParentId}/children`, withCreds());
        console.log('[HierarchicalPicker] 하위폴더 응답:', data);
        
        if (alive) {
          setChildFolders(data.children || []);
          setSelectedChildId(null);
        }
      } catch (e) {
        console.error('[HierarchicalPicker] 하위폴더 목록 로드 실패:', e);
        if (alive) {
          alert(`하위폴더를 불러오지 못했습니다: ${e.message || '알 수 없는 오류'}`);
          setChildFolders([]);
          setSelectedChildId(null);
        }
      } finally {
        if (alive) setLoadingChildren(false);
      }
    })();
    return () => { alive = false; };
  }, [selectedParentId]);

  const createParentFolder = async () => {
    const name = newParentName.trim();
    if (!name) return;
    
    try {
      setCreating(true);
      const { data } = await fetchJSON('/srs/folders', withCreds({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId: null })
      }));
      
      // 새로 생성된 상위폴더를 목록에 추가
      setParentFolders(prev => [...prev, { ...data, type: 'parent' }]);
      setNewParentName('');
      alert('상위폴더가 생성되었습니다.');
    } catch (e) {
      alert(`상위폴더 생성 실패: ${e.message || 'Unknown error'}`);
    } finally {
      setCreating(false);
    }
  };

  const createChildFolder = async () => {
    const name = newChildName.trim();
    if (!name || !selectedParentId) return;
    
    try {
      setCreating(true);
      const { data } = await fetchJSON('/srs/folders', withCreds({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId: selectedParentId })
      }));
      
      // 새로 생성된 하위폴더를 목록에 추가
      setChildFolders(prev => [...prev, data]);
      setNewChildName('');
      alert('하위폴더가 생성되었습니다.');
    } catch (e) {
      alert(`하위폴더 생성 실패: ${e.message || 'Unknown error'}`);
    } finally {
      setCreating(false);
    }
  };

  const confirmPick = () => {
    if (!selectedChildId) {
      alert('하위폴더를 선택하세요. 상위폴더에는 직접 카드를 추가할 수 없습니다.');
      return;
    }
    
    const selectedChild = childFolders.find(f => f.id === selectedChildId);
    if (!selectedChild) {
      alert('선택된 하위폴더를 찾을 수 없습니다.');
      return;
    }
    
    onPick?.(selectedChild);
    onClose?.();
  };

  const resetAndClose = () => {
    setSelectedParentId(null);
    setSelectedChildId(null);
    setChildFolders([]);
    setNewParentName('');
    setNewChildName('');
    onClose?.();
  };

  console.log('[HierarchicalPicker] 렌더링:', { show, loading, parentFolders: parentFolders.length });
  
  if (!show) return null;

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">SRS 폴더 선택 (3단계 구조)</h5>
            <button type="button" className="btn-close" aria-label="Close" onClick={resetAndClose} />
          </div>

          <div className="modal-body">
            {/* 안내 메시지 */}
            <div className="alert alert-info mb-3">
              <small>
                <strong>📌 3단계 구조:</strong> 상위폴더 → 하위폴더 → 카드<br/>
                단어는 하위폴더에만 추가할 수 있습니다.
              </small>
            </div>

            <div className="row">
              {/* 상위폴더 선택 */}
              <div className="col-md-6">
                <h6>1️⃣ 상위폴더 선택</h6>
                
                {/* 상위폴더 생성 */}
                <div className="mb-3">
                  <div className="input-group input-group-sm">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="새 상위폴더 이름"
                      value={newParentName}
                      onChange={(e) => setNewParentName(e.target.value)}
                      disabled={creating}
                    />
                    <button
                      className="btn btn-outline-primary"
                      onClick={createParentFolder}
                      disabled={creating || !newParentName.trim()}
                    >
                      생성
                    </button>
                  </div>
                </div>

                {/* 상위폴더 목록 */}
                <div className="list-group" style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {loading ? (
                    <div className="list-group-item text-muted text-center">
                      <div className="spinner-border spinner-border-sm me-2" />
                      로딩 중...
                    </div>
                  ) : parentFolders.length === 0 ? (
                    <div className="list-group-item text-muted text-center">
                      상위폴더가 없습니다.
                    </div>
                  ) : (
                    parentFolders.map(folder => (
                      <label key={folder.id} className="list-group-item list-group-item-action d-flex align-items-center">
                        <input
                          type="radio"
                          name="parentFolder"
                          className="form-check-input me-2"
                          checked={selectedParentId === folder.id}
                          onChange={() => setSelectedParentId(folder.id)}
                        />
                        <div className="flex-grow-1">
                          <div className="fw-semibold">📁 {folder.name}</div>
                          <small className="text-muted">
                            하위폴더 {folder.childrenCount || 0}개 | 총 카드 {folder.total || 0}개
                          </small>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* 하위폴더 선택 */}
              <div className="col-md-6">
                <h6>2️⃣ 하위폴더 선택</h6>
                
                {!selectedParentId ? (
                  <div className="text-muted text-center p-3">
                    먼저 상위폴더를 선택하세요
                  </div>
                ) : (
                  <>
                    {/* 하위폴더 생성 */}
                    <div className="mb-3">
                      <div className="input-group input-group-sm">
                        <input
                          type="text"
                          className="form-control"
                          placeholder="새 하위폴더 이름"
                          value={newChildName}
                          onChange={(e) => setNewChildName(e.target.value)}
                          disabled={creating}
                        />
                        <button
                          className="btn btn-outline-success"
                          onClick={createChildFolder}
                          disabled={creating || !newChildName.trim()}
                        >
                          생성
                        </button>
                      </div>
                    </div>

                    {/* 하위폴더 목록 */}
                    <div className="list-group" style={{ maxHeight: 200, overflowY: 'auto' }}>
                      {loadingChildren ? (
                        <div className="list-group-item text-muted text-center">
                          <div className="spinner-border spinner-border-sm me-2" />
                          로딩 중...
                        </div>
                      ) : childFolders.length === 0 ? (
                        <div className="list-group-item text-muted text-center">
                          하위폴더가 없습니다.<br/>
                          <small>위에서 새 하위폴더를 만들어보세요.</small>
                        </div>
                      ) : (
                        childFolders.map(folder => (
                          <label key={folder.id} className="list-group-item list-group-item-action d-flex align-items-center">
                            <input
                              type="radio"
                              name="childFolder"
                              className="form-check-input me-2"
                              checked={selectedChildId === folder.id}
                              onChange={() => setSelectedChildId(folder.id)}
                            />
                            <div className="flex-grow-1">
                              <div className="fw-semibold">📄 {folder.name}</div>
                              <small className="text-muted">
                                카드 {folder.total || 0}개 | Stage {folder.stage}
                              </small>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={resetAndClose}>
              취소
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={confirmPick}
              disabled={!selectedChildId}
            >
              {selectedChildId ? '하위폴더에 추가' : '하위폴더를 선택하세요'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}