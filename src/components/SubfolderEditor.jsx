// src/components/SubfolderEditor.jsx
import React, { useState } from 'react';
import { SrsApi } from '../api/srs';
import SrsFolderPickerModal from './SrsFolderPickerModal';

/**
 * Props:
 *  - folder: {
 *      id, name, total, completed, incorrect,
 *      items: [{
 *        id, learned, wrongCount, cardId,
 *        vocab: { lemma, levelCEFR, pos }
 *      }]
 *    }
 *  - onUpdate?: () => void  // 상위 목록 재로딩 트리거
 */
export default function SubfolderEditor({ folder, onUpdate }) {
    const items = Array.isArray(folder?.items) ? folder.items : [];
    const [busyId, setBusyId] = useState(null);

    // 이동(편집) 모달
    const [showPicker, setShowPicker] = useState(false);
    const [movingItem, setMovingItem] = useState(null);

    const openMove = (item) => {
        setMovingItem(item);
        setShowPicker(true);
    };

    const handlePick = async (pickedFolder) => {
        setShowPicker(false);
        if (!pickedFolder) {
            setMovingItem(null);
            return;
        }
        const targetId = pickedFolder?.id ?? pickedFolder;
        if (targetId === folder.id) {
            alert('같은 폴더로는 이동할 수 없습니다.');
            setMovingItem(null);
            return;
        }
        try {
            setBusyId(movingItem.id);
            await SrsApi.moveItems(folder.id, targetId, { cardIds: [movingItem.cardId] });
            onUpdate && onUpdate();
        } catch (e) {
            alert(e?.message || '이동 중 오류가 발생했습니다.');
        } finally {
            setMovingItem(null);
            setBusyId(null);
        }
    };

    const toggleLearned = async (item) => {
        try {
            setBusyId(item.id);
            await SrsApi.markLearned(folder.id, { cardIds: [item.cardId], learned: !item.learned });
            onUpdate && onUpdate();
        } catch (e) {
            alert(e?.message || '학습 상태 변경 실패');
        } finally {
            setBusyId(null);
        }
    };

    const resetWrong = async (item) => {
        if (!window.confirm('이 항목의 오답 누적을 0으로 초기화할까요?')) return;
        try {
            setBusyId(item.id);
            await SrsApi.resetWrongCount(folder.id, { cardIds: [item.cardId] });
            onUpdate && onUpdate();
        } catch (e) {
            alert(e?.message || '오답 초기화 실패');
        } finally {
            setBusyId(null);
        }
    };

    const removeItem = async (item) => {
        if (!window.confirm('이 폴더에서 이 항목을 삭제할까요? (SRS 카드 자체는 유지됩니다)')) return;
        try {
            setBusyId(item.id);
            await SrsApi.removeItems(folder.id, { cardIds: [item.cardId] });
            onUpdate && onUpdate();
        } catch (e) {
            alert(e?.message || '삭제 실패');
        } finally {
            setBusyId(null);
        }
    };

    if (items.length === 0) {
        return <div className="text-muted">이 폴더에 카드가 없습니다.</div>;
    }

    return (
        <>
            <ul className="list-group">
                {items.map((item) => {
                    const lemma = item?.vocab?.lemma || '(단어 없음)';
                    const wrong = Number(item?.wrongCount || 0);
                    const learned = !!item?.learned;
                    const loading = busyId === item.id;

                    return (
                        <li
                            key={item.id}
                            className="list-group-item d-flex justify-content-between align-items-center"
                        >
                            {/* 왼쪽: 단어/메타 */}
                            <div className="me-3">
                                <div className="fw-semibold" lang="en">
                                    {lemma}{' '}
                                    {learned ? (
                                        <span className="text-success" aria-label="학습 완료" title="학습 완료">✔️</span>
                                    ) : (
                                        <span className="text-muted" aria-label="미학습" title="미학습">—</span>
                                    )}
                                </div>
                                <div className="small text-muted">
                                    {item?.vocab?.levelCEFR && (
                                        <span className="badge bg-secondary me-1">{item.vocab.levelCEFR}</span>
                                    )}
                                    {/* 품사 배지(복수 가능) */}
                                    {item?.vocab?.pos &&
                                        String(item.vocab.pos)
                                            .split(',')
                                            .map((p) => p.trim())
                                            .filter(Boolean)
                                            .map((p) => (
                                                <span
                                                    key={p}
                                                    className="badge bg-light text-dark border me-1 fst-italic"
                                                    title="품사"
                                                >
                                                    {p}
                                                </span>
                                            ))}
                                    {wrong > 0 && (
                                        <span className="badge bg-danger ms-1">오답 {wrong}</span>
                                    )}
                                </div>
                            </div>

                            {/* 오른쪽: 액션 버튼들 */}
                            <div className="btn-group ms-auto" role="group" aria-label="actions">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary"
                                    disabled={loading}
                                    onClick={() => openMove(item)}
                                    title="폴더 이동(편집)"
                                >
                                    {loading && movingItem?.id === item.id ? '이동중…' : '편집'}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-success"
                                    disabled={loading}
                                    onClick={() => toggleLearned(item)}
                                    title="학습표시 토글"
                                >
                                    {learned ? '학습 해제' : '학습 표시'}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary"
                                    disabled={loading || wrong === 0}
                                    onClick={() => resetWrong(item)}
                                    title="오답 누적 초기화"
                                >
                                    오답0
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    disabled={loading}
                                    onClick={() => removeItem(item)}
                                    title="폴더에서 삭제"
                                >
                                    삭제
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>

            {/* 폴더 선택 모달 (편집=이동) */}
            {showPicker && (
                <SrsFolderPickerModal
                    show={showPicker}
                    onClose={() => {
                        setShowPicker(false);
                        setMovingItem(null);
                    }}
                    onPick={handlePick}
                />
            )}
        </>
    );
}
