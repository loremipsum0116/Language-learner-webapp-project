// src/components/SrsFolderPickerModal.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { SrsApi } from '../api/srs';

/**
 * 폴더 선택 + 빠른 생성 모달
 *
 * Props:
 *  - show: boolean
 *  - onClose: () => void
 *  - onPick: (folder) => void
 *  - rootId: number  // 루트(날짜) 폴더 ID (parentId = null)
 */
export default function SrsFolderPickerModal({ show, onClose, onPick, rootId }) {
  const [loading, setLoading] = useState(false);
  const [folders, setFolders] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!show || !rootId) return;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        // API에 맞춤: children-lite 사용
        const list = await SrsApi.listChildrenLite(rootId);
        setFolders(Array.isArray(list) ? list : (list?.data ?? []));
      } catch (e) {
        setErr(e?.message || '하위 폴더 목록을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [show, rootId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => String(f.name || '').toLowerCase().includes(q));
  }, [folders, query]);

  const close = () => {
    setSelectedId(null);
    setQuery('');
    setNewName('');
    setErr('');
    onClose && onClose();
  };

  const confirmPick = () => {
    const f = folders.find((x) => x.id === selectedId);
    if (!f) {
      alert('폴더를 선택하세요.');
      return;
    }
    onPick && onPick(f);
    close();
  };

  const quickCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      setCreating(true);
      // API에 맞춤: createChild 사용 (scheduledOffset 자동 할당 라우트)
      const created = await SrsApi.createChild(rootId, name);
      const child = created?.data ?? created;
      onPick && onPick(child);
      close();
    } catch (e) {
      alert(e?.message || '폴더 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog-centered" role="document">
        <div className="modal-content">

          <div className="modal-header">
            <h5 className="modal-title">SRS 폴더 선택</h5>
            <button type="button" className="btn-close" aria-label="Close" onClick={close} />
          </div>

          <div className="modal-body">
            {/* 빠른 생성 */}
            <div className="mb-3">
              <label className="form-label">새 폴더 이름</label>
              <div className="input-group">
                <input
                  type="text"
                  className="form-control"
                  placeholder="예: 자동학습 / 오늘 추가"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  disabled={creating}
                />
                <button
                  className="btn btn-outline-primary"
                  onClick={quickCreate}
                  disabled={creating || !newName.trim()}
                  title="이 루트 날짜 밑에 하위 폴더 생성"
                >
                  {creating ? '생성 중…' : '추가'}
                </button>
              </div>
              <div className="form-text">
                같은 날짜에 여러 폴더를 만들 수 있습니다. <code>scheduledOffset</code>은 자동 증가합니다.
              </div>
            </div>

            <hr />

            {/* 검색 */}
            <div className="mb-2">
              <input
                type="search"
                className="form-control"
                placeholder="폴더 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* 목록 */}
            {err && <div className="alert alert-danger">{err}</div>}
            <div className="list-group" style={{ maxHeight: 300, overflowY: 'auto' }}>
              {loading ? (
                <div className="list-group-item text-muted">불러오는 중…</div>
              ) : filtered.length === 0 ? (
                <div className="list-group-item text-muted">하위 폴더가 없습니다.</div>
              ) : (
                filtered.map((f) => (
                  <label key={f.id} className="list-group-item list-group-item-action d-flex align-items-center">
                    <input
                      type="radio"
                      name="pick"
                      className="form-check-input me-2"
                      checked={selectedId === f.id}
                      onChange={() => setSelectedId(f.id)}
                    />
                    <div className="flex-grow-1">
                      <div className="fw-semibold">{f.name}</div>
                      <div className="small text-muted">
                        id: {f.id}
                        {typeof f.scheduledOffset === 'number' && (
                          <span className="ms-2">offset: {f.scheduledOffset}</span>
                        )}
                      </div>
                    </div>
                    {/* 🔔 조건: dueCount>0 또는 nextAlarmAt 존재 */}
                    {(f.dueCount > 0 || !!f.nextAlarmAt) && (
                      <span className="badge text-bg-warning" title={`미학습 ${f.dueCount}개`}>
                        🔔 {f.dueCount}
                      </span>
                    )}
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={close}>
              취소
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={confirmPick}
              disabled={!selectedId}
            >
              선택
            </button>
          </div>

        </div>
      </div>

      <div className="modal-backdrop fade show" />
    </div>
  );
}
