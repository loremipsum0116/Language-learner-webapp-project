// src/components/AddLearnedToFolderModal.jsx (수정된 최종 코드)
import React, { useEffect, useState, useCallback } from 'react';
import { fetchJSON, withCreds, isAbortError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

export default function AddLearnedToFolderModal({ show, onClose, vocabIds }) {
    const [rootFolderId, setRootFolderId] = useState(null);
    const [subfolders, setSubfolders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newFolderName, setNewFolderName] = useState('');
    const [busy, setBusy] = useState(false);
    const { refreshSrsIds } = useAuth();
    const navigate = useNavigate();

    const loadSubfolders = useCallback(async (signal) => {
        setLoading(true);
        try {
            const rootRes = await fetchJSON('/srs/folders/quick-create', withCreds({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kind: 'review', enableAlarm: true }),
                signal
            }));
            const rId = rootRes?.data?.id ?? rootRes?.id;
            if (!rId) throw new Error("오늘의 루트 폴더를 가져올 수 없습니다.");
            setRootFolderId(rId);

            const childrenRes = await fetchJSON(`/srs/folders/${rId}/children-lite`, withCreds({ signal }));
            setSubfolders(childrenRes?.data ?? []);
        } catch (e) {
            if (!isAbortError(e)) {
                console.error("하위 폴더 로딩 실패:", e);
                toast.error("폴더 목록을 불러오는 데 실패했습니다.");
            }
        } finally {
            if (!signal.aborted) setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (show) {
            const ac = new AbortController();
            loadSubfolders(ac.signal);
            return () => ac.abort();
        }
    }, [show, loadSubfolders]);

    const handleAddToFolder = async (folderId) => {
        if (busy) return;
        setBusy(true);
        try {
            const res = await fetchJSON(`/srs/folders/${folderId}/items`, withCreds({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vocabIds }),
            }));
            const addedCount = res?.data?.added ?? 0;
            const duplicateCount = res?.data?.duplicateIds?.length ?? 0;
            toast.success(`단어 ${addedCount}개를 추가했습니다. (중복: ${duplicateCount}개)`);
            await refreshSrsIds();
            onClose();
            navigate(`/srs/folder/${rootFolderId}`);
        } catch (e) {
            toast.error(`단어 추가 실패: ${e.message}`);
            setBusy(false);
        }
    };

    const handleCreateAndAdd = async (e) => {
        e.preventDefault();
        if (!newFolderName.trim() || !rootFolderId || busy) return;
        setBusy(true);
        try {
            const createRes = await fetchJSON(`/srs/folders/${rootFolderId}/subfolders`, withCreds({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newFolderName.trim() })
            }));
            const newFolderId = createRes?.data?.id;
            if (!newFolderId) throw new Error("하위 폴더 생성에 실패했습니다.");
            await handleAddToFolder(newFolderId);
        } catch (e) {
            toast.error(`작업 실패: ${e.message}`);
            setBusy(false);
        }
    };

    if (!show) return null;

    return (
        <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">학습 단어 저장 위치 선택</h5>
                        <button type="button" className="btn-close" onClick={onClose} disabled={busy} aria-label="Close"></button>
                    </div>
                    <div className="modal-body">
                        {loading ? (
                            <div className="text-center p-4">
                                <div className="spinner-border spinner-border-sm" role="status" />
                                <span className="ms-2">폴더 목록 로딩 중...</span>
                            </div>
                        ) : (
                            <>
                                <p className="text-muted small">학습한 {vocabIds.length}개의 단어를 추가할 오늘 날짜의 하위 폴더를 선택하거나 새로 만드세요.</p>
                                {subfolders.length > 0 && (
                                    <div className="list-group mb-3">
                                        {subfolders.map(folder => (
                                            <button key={folder.id} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center" onClick={() => handleAddToFolder(folder.id)} disabled={busy}>
                                                {folder.name}
                                                <span className="badge bg-secondary rounded-pill">미학습 {folder.dueCount ?? 0}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <form onSubmit={handleCreateAndAdd}>
                                    <label htmlFor="new-folder-name" className="form-label fw-bold">{subfolders.length > 0 ? '또는, 새 하위 폴더 만들기:' : '새 하위 폴더 만들기:'}</label>
                                    <div className="input-group">
                                        <input
                                            id="new-folder-name"
                                            className="form-control"
                                            placeholder="새 하위 폴더 이름"
                                            value={newFolderName}
                                            onChange={e => setNewFolderName(e.target.value)}
                                            disabled={busy}
                                        />
                                        <button className="btn btn-primary" type="submit" disabled={!newFolderName.trim() || busy}>
                                            {busy ? "처리 중..." : "만들고 추가"}
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