// src/pages/MyWordbook.jsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { fetchJSON, withCreds } from '../api/client';
import Pron from '../components/Pron';

/** 상세 모달 */
function VocabDetailModal({ vocab, onClose }) {
    const isOpen = Boolean(vocab);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, isOpen]);

    if (!vocab) return null;

    const koGloss =
        vocab?.dictMeta?.examples?.find?.(ex => ex && ex.kind === 'gloss')?.ko || null;
    const examples = Array.isArray(vocab?.dictMeta?.examples)
        ? vocab.dictMeta.examples.filter(ex => ex && ex.kind !== 'gloss')
        : [];

    return (
        <div
            className="modal show"
            style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={onClose}
        >
            <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title" lang="de">{vocab.lemma}</h5>
                        <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
                    </div>
                    <div className="modal-body">
                        <Pron ipa={vocab?.dictMeta?.ipa} ipaKo={vocab?.dictMeta?.ipaKo} />
                        {koGloss && <div className="mt-2"><strong>뜻</strong>: {koGloss}</div>}
                        {examples.length > 0 && (
                            <ul className="mt-2 mb-0">
                                {examples.map((ex, i) => (
                                    <li key={i}>
                                        <span lang="de">{ex.de}</span>{ex.ko ? <span> — {ex.ko}</span> : null}
                                    </li>
                                ))}
                            </ul>
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

/** 새 폴더 생성 폼 */
function NewCategoryForm({ onCreated }) {
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        const n = name.trim();
        if (!n) return;
        try {
            setBusy(true);
            await fetchJSON('/categories', withCreds({
                method: 'POST',
                body: JSON.stringify({ name: n })
            }));
            setName('');
            onCreated && (await onCreated());
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className="mt-3 d-flex gap-2" onSubmit={submit}>
            <input
                className="form-control form-control-sm"
                placeholder="새 폴더 이름"
                value={name}
                onChange={(e) => setName(e.target.value)}
            />
            <button className="btn btn-sm btn-outline-primary" disabled={busy || !name.trim()}>
                추가
            </button>
        </form>
    );
}

/** 메인 페이지 */
export default function MyWordbook() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [categories, setCategories] = useState([]);
    const [uncategorized, setUncategorized] = useState(0);
    const [words, setWords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [moveTarget, setMoveTarget] = useState('none');
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const readFilterFromURL = useCallback(() => {
        const v = searchParams.get('cat');
        if (v === 'none') return 'none';
        if (!v || v === 'all') return 'all';
        const n = Number(v);
        return Number.isFinite(n) ? n : 'all';
    }, [searchParams]);

    const [filter, setFilter] = useState(readFilterFromURL);

    const loadCategories = useCallback(async () => {
        const { data } = await fetchJSON('/categories', withCreds());
        setCategories(data?.categories || []);
        setUncategorized(data?.uncategorized || 0);
    }, []);

    const loadWordbook = useCallback(async (f) => {
        setLoading(true);
        try {
            let url = '/my-wordbook';
            if (f === 'none') url += '?categoryId=none';
            else if (typeof f === 'number') url += `?categoryId=${f}`;
            const { data } = await fetchJSON(url, withCreds());
            setWords(Array.isArray(data) ? data : []);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        (async () => {
            await loadCategories();
            const init = readFilterFromURL();
            setFilter(init);
            await loadWordbook(init);
        })();
    }, []);

    const filteredWords = useMemo(() => {
        const needle = searchTerm.trim().toLowerCase();
        if (!needle) return words;
        return words.filter(word => {
            const gloss = Array.isArray(word?.dictMeta?.examples)
                ? word.dictMeta.examples.find(ex => ex && ex.kind === 'gloss')?.ko
                : null;
            return (
                word.lemma.toLowerCase().includes(needle) ||
                (gloss && gloss.toLowerCase().includes(needle))
            );
        });
    }, [words, searchTerm]);

    const onClickFolder = async (f) => {
        setFilter(f);
        setSelectedIds(new Set());
        if (f === 'all') setSearchParams({});
        else if (f === 'none') setSearchParams({ cat: 'none' });
        else setSearchParams({ cat: String(f) });
        await loadWordbook(f);
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
    };

    const selectAll = () => setSelectedIds(new Set(filteredWords.map(w => w.id)));
    const unselectAll = () => setSelectedIds(new Set());

    const onMoveClick = async () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) { alert('이동할 단어를 선택하세요.'); return; }

        try {
            await fetchJSON('/my-wordbook/assign', withCreds({
                method: 'PATCH',
                body: JSON.stringify({
                    vocabIds: ids,
                    categoryId: moveTarget === 'none' ? 'none' : Number(moveTarget),
                }),
            }));
            await loadCategories();
            await loadWordbook(filter);
            unselectAll();
            alert('이동 완료');
        } catch (e) {
            console.error(e);
            alert('이동 실패');
        }
    };

    const openDetail = async (id, e) => {
        e?.preventDefault?.();
        e?.stopPropagation?.();
        try {
            setDetailLoading(true);
            const { data } = await fetchJSON(`/vocab/${id}`, withCreds(), 15000);
            setDetail(data);
        } catch (err) {
            console.error(err);
            alert('상세 정보를 불러오지 못했습니다.');
        } finally {
            setDetailLoading(false);
        }
    };

    const handleAddSelectedToSRS = async () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) {
            alert('SRS에 추가할 단어를 선택하세요.');
            return;
        }
        try {
            const result = await fetchJSON('/srs/create-many', withCreds({
                method: 'POST',
                body: JSON.stringify({ vocabIds: ids }),
            }));
            const count = result?.data?.count ?? result?.count ?? 0;
            if (count > 0) {
                alert(`${count}개의 단어를 SRS에 새로 추가했습니다.`);
            } else {
                alert('선택된 단어들은 이미 SRS에 모두 존재합니다.');
            }
            unselectAll();
        } catch (e) {
            console.error('SRS 추가 실패:', e);
            alert('SRS에 단어를 추가하는 데 실패했습니다.');
        }
    };

    const handleDeleteSelected = async () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) {
            alert('삭제할 단어를 선택하세요.');
            return;
        }

        if (window.confirm(`${ids.length}개의 단어를 내 단어장에서 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
            try {
                await fetchJSON('/my-wordbook/remove-many', {
                    method: 'POST',
                    body: JSON.stringify({ vocabIds: ids }),
                    ...withCreds(),
                });
                alert(`${ids.length}개의 단어를 삭제했습니다.`);
                await loadWordbook(filter);
                unselectAll();
            } catch (e) {
                console.error('단어 삭제 실패:', e);
                alert('단어 삭제에 실패했습니다.');
            }
        }
    };

    const isActive = (f) =>
        (f === 'all' && filter === 'all') ||
        (f === 'none' && filter === 'none') ||
        (typeof f === 'number' && filter === f);

    return (
        <main className="container py-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h2 className="m-0">내 단어장</h2>
                <div className="d-flex gap-2">
                    <Link to="/vocab" className="btn btn-info">단어 추가하기</Link>
                    <Link to="/learn/vocab" className="btn btn-primary">SRS 학습 시작 →</Link>
                    <Link to="/odat-note" className="btn btn-outline-danger">오답노트</Link>
                </div>
            </div>

            <div className="row">
                <aside className="col-12 col-md-3 mb-3">
                    <div className="list-group">
                        <button
                            className={`list-group-item list-group-item-action ${isActive('all') ? 'active' : ''}`}
                            onClick={() => onClickFolder('all')}
                        >
                            전체
                        </button>
                        <button
                            className={`list-group-item list-group-item-action d-flex justify-content-between ${isActive('none') ? 'active' : ''}`}
                            onClick={() => onClickFolder('none')}
                        >
                            <span>미분류</span>
                            <span className="badge text-bg-secondary">{uncategorized}</span>
                        </button>
                        {categories.map((c) => (
                            <button
                                key={c.id}
                                className={`list-group-item list-group-item-action d-flex justify-content-between ${isActive(c.id) ? 'active' : ''}`}
                                onClick={() => onClickFolder(c.id)}
                            >
                                <span>{c.name}</span>
                                <span className="badge text-bg-secondary">{c.count ?? 0}</span>
                            </button>
                        ))}
                    </div>
                    <NewCategoryForm onCreated={loadCategories} />
                </aside>

                <section className="col-12 col-md-9">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <div className="small text-muted">
                            {loading ? '로딩 중...' : `${filteredWords.length}개 항목`}
                            {selectedIds.size > 0 ? ` / 선택됨 ${selectedIds.size}` : ''}
                        </div>
                        <div className="d-flex gap-2 align-items-center">
                            <button
                                className="btn btn-sm btn-outline-secondary"
                                onClick={selectAll}
                                disabled={loading || filteredWords.length === 0}
                            >
                                전체 선택
                            </button>
                            <button
                                className="btn btn-sm btn-outline-secondary"
                                onClick={unselectAll}
                                disabled={selectedIds.size === 0}
                            >
                                선택 해제
                            </button>

                            <select
                                className="form-select form-select-sm"
                                style={{ width: 150 }}
                                value={String(moveTarget)}
                                onChange={(e) =>
                                    setMoveTarget(e.target.value === 'none' ? 'none' : Number(e.target.value))
                                }
                            >
                                <option value="none">미분류로 이동</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            <button
                                className="btn btn-sm btn-primary"
                                onClick={onMoveClick}
                                disabled={selectedIds.size === 0}
                            >
                                이동
                            </button>
                            <button
                                className="btn btn-sm btn-success"
                                onClick={handleAddSelectedToSRS}
                                disabled={selectedIds.size === 0}
                            >
                                SRS에 추가
                            </button>
                            <button
                                className="btn btn-sm btn-danger"
                                onClick={handleDeleteSelected}
                                disabled={selectedIds.size === 0}
                            >
                                삭제
                            </button>
                        </div>
                    </div>

                    <div className="mb-3">
                        <input
                            type="search"
                            className="form-control"
                            placeholder="내 단어장에서 검색 (단어 또는 뜻)"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="list-group">
                        {filteredWords.map((v) => {
                            const gloss = Array.isArray(v?.dictMeta?.examples)
                                ? v.dictMeta.examples.find((ex) => ex && ex.kind === 'gloss')?.ko
                                : null;
                            const checked = selectedIds.has(v.id);

                            return (
                                <div
                                    key={v.id}
                                    className="list-group-item d-flex justify-content-between align-items-center"
                                    onClick={(e) => openDetail(v.id, e)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="d-flex align-items-center gap-2">
                                        <input
                                            type="checkbox"
                                            className="form-check-input"
                                            checked={checked}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={() => toggleSelect(v.id)}
                                        />
                                        <div>
                                            <div className="fw-semibold" lang="de">{v.lemma}</div>
                                            <Pron ipa={v.dictMeta?.ipa} ipaKo={v.dictMeta?.ipaKo} />
                                            <div className="text-muted small">{gloss || '뜻 정보 없음'}</div>
                                        </div>
                                    </div>

                                    <div className="d-flex gap-2">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-secondary"
                                            onClick={(e) => openDetail(v.id, e)}
                                        >
                                            상세
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {!loading && filteredWords.length === 0 && (
                            <div className="alert alert-light mb-0">
                                {searchTerm
                                    ? '해당 단어가 없습니다.'
                                    : '이 폴더에 단어가 없습니다.'}
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {(detailLoading || detail) && (
                <VocabDetailModal vocab={detail} onClose={() => setDetail(null)} />
            )}
        </main>
    );
}
