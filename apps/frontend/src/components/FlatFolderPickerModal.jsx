// src/components/FlatFolderPickerModal.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { SrsApi } from '../api/srs';

export default function FlatFolderPickerModal({ show, onClose, onPick }) {
  const [loading, setLoading] = useState(false);
  const [folders, setFolders] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!show) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const list = await SrsApi.picker(); // 평탄화 목록
        if (alive) setFolders(Array.isArray(list) ? list : []);
      } catch (e) {
        alert('폴더 목록을 불러오지 못했습니다.');
        onClose?.();
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [show, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter(f => String(f.name || '').toLowerCase().includes(q));
  }, [folders, query]);

  const quickCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      setCreating(true);
      const folder = await SrsApi.quickCreate(name);
      onPick?.(folder);
      onClose?.();
    } catch (e) {
      alert(e?.message || '폴더 생성 실패');
    } finally { setCreating(false); }
  };

  const confirmPick = () => {
    const f = folders.find(x => x.id === selectedId);
    if (!f) { alert('폴더를 선택하세요.'); return; }
    onPick?.(f);
    onClose?.();
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">SRS 폴더 선택</h5>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>

          <div className="modal-body">
            <div className="mb-3">
              <label className="form-label">새 폴더 이름</label>
              <div className="input-group">
                <input className="form-control" placeholder="예: 오늘 추가"
                       value={newName} onChange={(e) => setNewName(e.target.value)} disabled={creating}/>
                <button className="btn btn-outline-primary" onClick={quickCreate} disabled={creating || !newName.trim()}>
                  {creating ? '생성 중…' : '추가'}
                </button>
              </div>
            </div>

            <input className="form-control mb-2" placeholder="폴더 검색"
                   value={query} onChange={(e) => setQuery(e.target.value)} disabled={loading}/>

            <div className="list-group" style={{ maxHeight: 300, overflowY: 'auto' }}>
              {loading ? (
                <div className="list-group-item text-muted">불러오는 중…</div>
              ) : filtered.length === 0 ? (
                <div className="list-group-item text-muted">폴더가 없습니다.</div>
              ) : filtered.map(f => (
                <label key={f.id} className="list-group-item list-group-item-action d-flex align-items-center">
                  <input type="radio" name="pick" className="form-check-input me-2"
                         checked={selectedId === f.id} onChange={() => setSelectedId(f.id)}/>
                  <div className="flex-grow-1">
                    <div className="fw-semibold">{f.name}</div>
                    <div className="small text-muted">
                      id: {f.id}{' '}
                      {f.createdDate && <span className="ms-2">{new Date(f.createdDate).toISOString().slice(0,10)}</span>}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>취소</button>
            <button type="button" className="btn btn-primary" onClick={confirmPick} disabled={!selectedId}>선택</button>
          </div>
        </div>
      </div>
    </div>
  );
}
