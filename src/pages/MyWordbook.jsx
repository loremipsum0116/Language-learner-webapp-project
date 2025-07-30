// src/pages/MyWordbook.jsx
import React, { useEffect, useState, useCallback } from 'react';
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

    // 좌측 폴더
    const [categories, setCategories] = useState([]); // [{id,name,count,...}]
    const [uncategorized, setUncategorized] = useState(0);

    // 우측 단어 리스트
    const [words, setWords] = useState([]);
    const [loading, setLoading] = useState(true);

    // 선택/이동
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [moveTarget, setMoveTarget] = useState('none'); // 'none' | number

    // 상세 모달
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // URL → 초기 필터
    const readFilterFromURL = useCallback(() => {
        const v = searchParams.get('cat'); // 'all' | 'none' | '<number>'
        if (v === 'none') return 'none';
        if (!v || v === 'all') return 'all';
        const n = Number(v);
        return Number.isFinite(n) ? n : 'all';
    }, [searchParams]);

    // filter: 'all' | 'none' | number
    const [filter, setFilter] = useState(readFilterFromURL);

    /** 카테고리 목록/카운트 */
    const loadCategories = useCallback(async () => {
        const { data } = await fetchJSON('/categories', withCreds());
        setCategories(data?.categories || []);
        setUncategorized(data?.uncategorized || 0);
    }, []);

    /** 단어장 로드(필터 반영) */
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

    /** 최초 로드: URL 기준 */
    useEffect(() => {
        (async () => {
            await loadCategories();
            const init = readFilterFromURL();
            setFilter(init);
            await loadWordbook(init);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** 폴더 클릭 */
    const onClickFolder = async (f) => {
        setFilter(f);
        setSelectedIds(new Set());
        if (f === 'all') setSearchParams({});
        else if (f === 'none') setSearchParams({ cat: 'none' });
        else setSearchParams({ cat: String(f) });
        await loadWordbook(f);
    };

    /** 체크 선택 */
    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
    };
    const clearSelection = () => setSelectedIds(new Set());
    const selectAll = () => setSelectedIds(new Set(words.map(w => w.id)));
    const unselectAll = () => clearSelection();

    /** 선택 이동 */
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
            clearSelection();
            alert('이동 완료');
        } catch (e) {
            console.error(e);
            alert('이동 실패');
        }
    };

    /** 상세 모달 열기 */
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

    /** 선택 단어로 퀴즈 시작 */
    const startSelectedQuiz = () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return alert('퀴즈로 풀 단어를 선택하세요.');
        navigate(`/learn/vocab?ids=${ids.join(',')}`);
    };

    const startSelectedFlashAuto = () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return alert('자동학습할 단어를 선택하세요.');
        navigate(`/learn/vocab?ids=${ids.join(',')}&mode=flash&auto=1`);
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
                    <Link to="/learn/vocab" className="btn btn-primary">SRS 학습 시작 →</Link>
                    <Link to="/learn/vocab?mode=odat" className="btn btn-outline-danger">오답노트</Link>
                    <button className="btn btn-outline-primary" onClick={startSelectedQuiz}>
                        선택 단어로 퀴즈 시작
                    </button>
                    <button className="btn btn-success" onClick={startSelectedFlashAuto}>
                        선택 자동학습(3초)
                    </button>
                </div>
            </div>

            <div className="row">
                {/* Left: 폴더/카테고리 */}
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

                {/* Right: 단어 목록 + 이동 컨트롤 */}
                <section className="col-12 col-md-9">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <div className="small text-muted">
                            {loading ? '로딩 중...' : `${words.length}개 항목`}
                            {selectedIds.size > 0 ? ` / 선택됨 ${selectedIds.size}` : ''}
                        </div>
                        <div className="d-flex gap-2">
                            <button
                                className="btn btn-sm btn-outline-secondary"
                                onClick={selectAll}
                                disabled={loading || words.length === 0}
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

                            {/* 이동 대상 */}
                            <select
                                className="form-select form-select-sm"
                                style={{ width: 180 }}
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
                                선택항목 이동
                            </button>
                        </div>
                    </div>

                    <div className="list-group">
                        {words.map((v) => {
                            const gloss = Array.isArray(v?.dictMeta?.examples)
                                ? v.dictMeta.examples.find((ex) => ex && ex.kind === 'gloss')?.ko
                                : null;
                            const checked = selectedIds.has(v.id);

                            return (
                                <div
                                    key={v.id}
                                    className="list-group-item d-flex justify-content-between align-items-center"
                                    onClick={(e) => openDetail(v.id, e)} // 행 클릭 = 모달
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="d-flex align-items-center gap-2">
                                        <input
                                            type="checkbox"
                                            className="form-check-input"
                                            checked={checked}
                                            onClick={(e) => e.stopPropagation()} // 모달 열림 전파 방지
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
                        {!loading && words.length === 0 && (
                            <div className="alert alert-light mb-0">이 폴더에 단어가 없습니다.</div>
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
