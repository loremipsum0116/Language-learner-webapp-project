// src/components/SubfolderEditor.jsx

import React, { useState, useMemo } from 'react';
import { fetchJSON, withCreds } from '../api/client';
import { toast } from 'react-toastify';

export default function SubfolderEditor({ folder, onUpdate }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState(new Set());

    const filteredItems = useMemo(() => {
        const needle = searchTerm.trim().toLowerCase();
        if (!needle) return folder.items || [];
        return (folder.items || []).filter(item =>
            item.vocab?.lemma.toLowerCase().includes(needle)
        );
    }, [folder.items, searchTerm]);

    const handleToggleAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(new Set(filteredItems.map(item => item.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleToggleOne = (itemId) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(itemId)) next.delete(itemId);
            else next.add(itemId);
            return next;
        });
    };

    /**
     * [FIX] 선택한 단어를 영구적으로 삭제하는 핸들러
     */
    const handleDeleteSelected = async () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;

        // ✅ 사용자에게 되돌릴 수 없는 작업임을 명확히 알리고 확인받습니다.
        if (!window.confirm(`선택한 ${ids.length}개의 단어를 SRS 시스템에서 영구적으로 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
            return;
        }

        try {
            const res = await fetchJSON(`/srs/folders/${folder.id}/items/bulk-delete`, withCreds({
                method: 'POST',
                body: JSON.stringify({
                    itemIds: ids,
                    permanent: true, // ✅ 항상 영구 삭제 옵션으로 API 호출
                }),
            }));
            toast.success(`${res.count}개의 단어를 영구 삭제했습니다.`);
            setSelectedIds(new Set());
            onUpdate(); // 부모 컴포넌트(SrsFolderDetail)의 목록을 새로고침
        } catch (e) {
            toast.error('삭제 실패: ' + e.message);
        }
    };

    const isAllSelected = filteredItems.length > 0 && selectedIds.size === filteredItems.length;

    return (
        <details className="mt-2">
            <summary className="small text-primary" style={{ cursor: 'pointer' }}>
                카드 목록 관리 ({folder.total}개)
            </summary>
            <div className="p-2 border-top border-bottom">
                <input
                    type="search"
                    className="form-control form-control-sm mb-2"
                    placeholder="단어 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="d-flex justify-content-between align-items-center">
                    <div className="form-check">
                        <input
                            className="form-check-input"
                            type="checkbox"
                            id={`select-all-${folder.id}`}
                            checked={isAllSelected}
                            onChange={handleToggleAll}
                        />
                        <label className="form-check-label small" htmlFor={`select-all-${folder.id}`}>
                            전체 선택 ({selectedIds.size})
                        </label>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={handleDeleteSelected} disabled={selectedIds.size === 0}>
                        선택 영구 삭제
                    </button>
                </div>
            </div>
            <ul className="list-group list-group-flush small mt-1" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {filteredItems.map(item => (
                    <li key={item.id} className="list-group-item px-1 py-1 d-flex align-items-center">
                        <input
                            type="checkbox"
                            className="form-check-input me-2"
                            checked={selectedIds.has(item.id)}
                            onChange={() => handleToggleOne(item.id)}
                        />
                        {item.learned && <span className="me-2" title="학습 완료">✅</span>}
                        {item.vocab?.lemma ?? `(ID: ${item.card?.itemId})`}
                    </li>
                ))}
            </ul>
        </details>
    );
}
