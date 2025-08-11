// src/components/AddLearnedToFolderModal.jsx
import React, { useEffect, useState } from 'react';
import { SrsApi } from '../api/srs';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

export default function AddLearnedToFolderModal({ show, onClose, vocabIds }) {
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!show) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const list = await SrsApi.picker();
        if (alive) setFolders(Array.isArray(list) ? list : []);
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [show]);

  const addTo = async (folderId) => {
    try {
      const res = await SrsApi.addItems(folderId, { vocabIds });
      const added = res?.added ?? res?.addedCount ?? 0;
      const dup = res?.duplicateIds?.length ?? 0;
      toast.success(`단어 ${added}개 추가됨${dup ? `, 중복 ${dup}개` : ''}`);
      onClose?.();
      navigate(`/srs/folder/${folderId}`);
    } catch (e) {
      toast.error(`추가 실패: ${e?.message || '서버 오류'}`);
    }
  };

  const createAndAdd = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    try {
      setCreating(true);
      const folder = await SrsApi.quickCreate(name);
      await addTo(folder.id);
    } finally { setCreating(false); }
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">학습 단어 저장 위치 선택</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
          </div>
          <div className="modal-body">
            {loading ? (
              <div className="text-center p-4">
                <div className="spinner-border spinner-border-sm" role="status" />
                <span className="ms-2">폴더 목록 로딩 중...</span>
              </div>
            ) : (
              <>
                <p className="text-muted small">학습한 {vocabIds.length}개의 단어를 추가할 폴더를 선택하세요.</p>
                {folders.length > 0 && (
                  <div className="list-group mb-3">
                    {folders.map(f => (
                      <button key={f.id} className="list-group-item list-group-item-action" onClick={() => addTo(f.id)}>
                        {f.name}
                      </button>
                    ))}
                  </div>
                )}
                <form onSubmit={createAndAdd}>
                  <label className="form-label fw-bold">또는, 새 폴더 만들기:</label>
                  <div className="input-group">
                    <input className="form-control" placeholder="새 폴더 이름" value={newName} onChange={(e) => setNewName(e.target.value)} disabled={creating} />
                    <button className="btn btn-primary" type="submit" disabled={!newName.trim() || creating}>
                      {creating ? "처리 중..." : "만들고 추가"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
