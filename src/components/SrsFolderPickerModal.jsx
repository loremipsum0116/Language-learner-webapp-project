// src/components/SrsFolderPickerModal.jsx
import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { SrsApi } from '../api/srs';
import { fetchJSON, withCreds } from '../api/client';

export default function SrsFolderPickerModal({ show, onClose, onPick }) {
  const [roots, setRoots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});        // { [rootId]: boolean }
  const [childrenMap, setChildrenMap] = useState({});  // { [rootId]: Child[] }
  const [fetchingChild, setFetchingChild] = useState(null);

  useEffect(() => {
    if (!show) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        // 루트/자식이 섞여 오므로 parentId === null 만 루트로 필터
        const data = await SrsApi.picker(); // GET /srs/folders/picker
        const all = Array.isArray(data) ? data : [];
        const rootsOnly = all.filter(f => f.parentId == null);
        if (alive) setRoots(rootsOnly);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [show]);

  const toggleRoot = async (rootId) => {
    setExpanded(prev => ({ ...prev, [rootId]: !prev[rootId] }));
    if (!childrenMap[rootId]) {
      try {
        setFetchingChild(rootId);
        // children API에서 { ok, data: { root, children: [...] } } 형태라고 가정
        const { data } = await fetchJSON(`/srs/folders/${rootId}/children`, withCreds());
        const kids = Array.isArray(data?.children) ? data.children : [];
        setChildrenMap(m => ({ ...m, [rootId]: kids }));
      } finally {
        setFetchingChild(null);
      }
    }
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.25)' }}>
      <div className="modal-dialog">
        <div className="modal-content">

          <div className="modal-header">
            <h5 className="modal-title">SRS 폴더 선택</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>

          <div className="modal-body">
            {loading ? (
              <div>불러오는 중…</div>
            ) : roots.length === 0 ? (
              <div className="text-muted">날짜(루트) 폴더가 없습니다. 먼저 날짜 폴더를 만드세요.</div>
            ) : (
              <div className="list-group">
                {roots.map(r => {
                  const isOpen = !!expanded[r.id];
                  const label = dayjs(r.date).format('YYYY-MM-DD');
                  const children = childrenMap[r.id] || [];

                  return (
                    <div key={r.id} className="list-group-item">
                      <div className="d-flex justify-content-between align-items-center">
                        <button
                          className="btn btn-sm btn-outline-secondary me-2"
                          onClick={() => toggleRoot(r.id)}
                          title={isOpen ? '접기' : '펼치기'}
                        >
                          {isOpen ? '▾' : '▸'}
                        </button>
                        <div className="flex-fill">
                          <strong>{r.name || label}</strong>
                          <small className="text-muted ms-2">{label}</small>
                        </div>
                        {/* ❌ 루트 선택 금지 — 버튼 제거 */}
                      </div>

                      {isOpen && (
                        <div className="mt-2 ms-4">
                          {fetchingChild === r.id ? (
                            <div className="text-muted">하위 폴더 로딩…</div>
                          ) : children.length === 0 ? (
                            <div className="text-muted">하위 폴더가 없습니다. 루트 폴더 화면에서 하위 폴더를 먼저 만드세요.</div>
                          ) : (
                            children.map(c => (
                              <div key={c.id} className="d-flex justify-content-between align-items-center py-1">
                                <span>{c.name}</span>
                                <button className="btn btn-sm btn-primary" onClick={() => onPick(c.id)}>
                                  선택
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>닫기</button>
          </div>

        </div>
      </div>
    </div>
  );
}
