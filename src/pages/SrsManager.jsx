// src/pages/SrsManager.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchJSON, withCreds } from '../api/client';
import Pron from '../components/Pron';

const isAbort = (e) => e?.name === 'AbortError';

export default function SrsManager() {
    const [cards, setCards] = useState([]); // { cardId, vocabId, lemma, ko_gloss, nextReviewAt }
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set()); // vocabId를 저장

    const loadCards = async (ac) => {
        try {
            setLoading(true);
            setErr(null);
            const { data } = await fetchJSON('/srs/all-cards', withCreds({ signal: ac?.signal }));
            setCards(Array.isArray(data) ? data : []);
            setSelectedIds(new Set());
        } catch (e) {
            if (!isAbort(e)) setErr(e);
        } finally {
            if (!ac || !ac.signal.aborted) setLoading(false);
        }
    };

    useEffect(() => {
        const ac = new AbortController();
        loadCards(ac);
        return () => ac.abort();
    }, []);

    const toggleSelect = (vocabId) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(vocabId)) next.delete(vocabId);
            else next.add(vocabId);
            return next;
        });
    };

    const allSelected = useMemo(() => {
        if (cards.length === 0) return false;
        return cards.every(c => selectedIds.has(c.vocabId));
    }, [cards, selectedIds]);

    const handleSelectAll = () => {
        if (allSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(cards.map(c => c.vocabId)));
        }
    };

    const handleRemoveSelected = async () => {
        const idsToRemove = Array.from(selectedIds);
        if (idsToRemove.length === 0) return;
        if (!window.confirm(`${idsToRemove.length}개의 단어를 SRS 학습 목록에서 제거하시겠습니까?`)) return;

        try {
            await fetchJSON('/srs/remove-many', withCreds({
                method: 'POST',
                body: JSON.stringify({ vocabIds: idsToRemove }),
            }));
            // 성공 시 목록 다시 불러오기
            await loadCards();
        } catch (e) {
            alert('제거 중 오류가 발생했습니다.');
            console.error(e);
        }
    };

    return (
        <main className="container py-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h2 className="m-0">SRS 퀴즈 편집</h2>
                <div className="d-flex gap-2">
                    <Link to="/my-wordbook" className="btn btn-sm btn-outline-primary">
                        내 단어장에서 추가
                    </Link>
                    <Link to="/vocab" className="btn btn-sm btn-outline-success">
                        전체 단어에서 추가
                    </Link>
                    <Link to="/learn/vocab" className="btn btn-sm btn-primary">
                        학습 시작 →
                    </Link>
                </div>
            </div>

            <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="text-muted small">
                    총 {cards.length}개 / {selectedIds.size}개 선택됨
                </div>
                <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-outline-secondary" onClick={handleSelectAll}>
                        {allSelected ? '전체 해제' : '전체 선택'}
                    </button>
                    <button
                        className="btn btn-sm btn-danger"
                        disabled={selectedIds.size === 0}
                        onClick={handleRemoveSelected}
                    >
                        선택 항목 제거
                    </button>
                </div>
            </div>

            {loading && <p>로딩 중...</p>}
            {err && <div className="alert alert-danger">목록을 불러오는 데 실패했습니다.</div>}

            <div className="list-group">
                {cards.map(card => (
                    <div key={card.cardId} className="list-group-item d-flex align-items-center gap-3">
                        <input
                            type="checkbox"
                            className="form-check-input"
                            checked={selectedIds.has(card.vocabId)}
                            onChange={() => toggleSelect(card.vocabId)}
                        />
                        <div className="flex-grow-1">
                            <h5 className="mb-1">{card.lemma}</h5>
                            <Pron ipa={card.ipa} ipaKo={card.ipaKo} />
                            <div className="text-muted small">{card.ko_gloss || '뜻 정보 없음'}</div>
                        </div>
                        <div className="text-muted small text-end" style={{ minWidth: '120px' }}>
                            <div>다음 복습</div>
                            <div>{new Date(card.nextReviewAt).toLocaleDateString()}</div>
                        </div>
                    </div>
                ))}
            </div>
        </main>
    );
}
