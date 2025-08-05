// src/pages/MyWordbook.jsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { fetchJSON, withCreds, API_BASE } from '../api/client';
import Pron from '../components/Pron';
import VocabDetailModal from '../components/VocabDetailModal.jsx';

// ★ 시작: 품사별 색상을 위한 헬퍼 함수 추가
const getPosBadgeColor = (pos) => {
    if (!pos) return 'bg-secondary';
    switch (pos.toLowerCase().trim()) {
        case 'noun':
            return 'bg-primary';
        case 'verb':
            return 'bg-success';
        case 'adjective':
            return 'bg-warning text-dark';
        case 'adverb':
            return 'bg-info text-dark';
        case 'preposition':
            return 'bg-danger';
        default:
            return 'bg-secondary';
    }
};
// ★ 종료: 헬퍼 함수

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
    const audioRef = useRef(null);
    const [playingAudio, setPlayingAudio] = useState(null);
    const [enrichingId, setEnrichingId] = useState(null);

    const handleFlashSelected = () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) { alert('학습할 단어를 선택하세요.'); return; }
        navigate(`/learn/vocab?ids=${ids.join(',')}&mode=flash&auto=1`);
    };

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
    }, [loadCategories, loadWordbook, readFilterFromURL]);

    const filteredWords = useMemo(() => {
        if (!Array.isArray(words)) return [];
        const validWords = words.filter(word => word && word.vocab && word.vocab.lemma);
        const needle = searchTerm.trim().toLowerCase();
        if (!needle) return validWords;
        return validWords.filter(word => {
            return (
                word.vocab.lemma.toLowerCase().includes(needle) ||
                (word.vocab.ko_gloss && word.vocab.ko_gloss.toLowerCase().includes(needle))
            );
        });
    }, [words, searchTerm]);

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
        }
        setPlayingAudio(null);
    };

    const playUrl = (url, type, id) => {
        if (!url) return;
        if (playingAudio && playingAudio.id === id) {
            stopAudio();
            return;
        }
        stopAudio();
        const fullUrl = url.startsWith('/') ? `${API_BASE}${url}` : url;
        const newAudio = new Audio(fullUrl);
        newAudio.onended = () => setPlayingAudio(null);
        newAudio.play().then(() => {
            audioRef.current = newAudio;
            setPlayingAudio({ type, id });
        }).catch(e => {
            console.error("오디오 재생 실패:", e, fullUrl);
            setPlayingAudio(null);
        });
    };

    const playVocabAudio = async (vocabData) => {
        const vocab = vocabData.vocab || vocabData;
        const targetUrl = vocab.audioUrl || vocab.dictMeta?.audioUrl || vocab.audio;
        if (targetUrl) {
            playUrl(targetUrl, 'vocab', vocab.id);
            return;
        }
        try {
            setEnrichingId(vocab.id);
            const { data: updatedVocab } = await fetchJSON(`/vocab/${vocab.id}/enrich`, withCreds({ method: 'POST' }));
            setWords(prevWords => prevWords.map(w => {
                if (w.vocabId === updatedVocab.id) {
                    return { ...w, vocab: { ...w.vocab, ...updatedVocab } };
                }
                return w;
            }));
             const enrichedUrl = updatedVocab.audio || updatedVocab.dictMeta?.audioUrl;
            if (enrichedUrl) {
                playUrl(enrichedUrl, 'vocab', vocab.id);
            } else {
                alert(`'${vocab.lemma}'에 대한 음성 파일을 찾을 수 없습니다.`);
            }
        } catch (e) {
            console.error("Enrichment failed:", e);
            alert("음성 정보를 가져오는 데 실패했습니다.");
        } finally {
            setEnrichingId(null);
        }
    };
    
    const playExampleAudio = (url, type, id) => {
        playUrl(url, type, id);
    };

    useEffect(() => {
        return () => { if (audioRef.current) stopAudio(); };
    }, []);
    
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

    const selectAll = () => setSelectedIds(new Set(filteredWords.map(w => w.vocabId)));
    const unselectAll = () => setSelectedIds(new Set());

    const onMoveClick = async () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) { alert('이동할 단어를 선택하세요.'); return; }
        try {
            await fetchJSON('/my-wordbook/assign', withCreds({
                method: 'PATCH',
                body: JSON.stringify({
                    vocabIds: ids,
                    categoryId: moveTarget === 'none' ? null : Number(moveTarget),
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

    const openDetail = async (vocabId, e) => {
        e?.preventDefault?.();
        e?.stopPropagation?.();
        try {
            setDetailLoading(true);
            const { data } = await fetchJSON(`/vocab/${vocabId}`, withCreds(), 15000);
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
            alert('SRS에 추가할 단어를 선택하세요.'); return;
        }
        try {
            const { data } = await fetchJSON('/srs/create-many', withCreds({
                method: 'POST',
                body: JSON.stringify({ vocabIds: ids }),
            }));
            const count = data?.count ?? 0;
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
            alert('삭제할 단어를 선택하세요.'); return;
        }
        if (window.confirm(`${ids.length}개의 단어를 내 단어장에서 삭제하시겠습니까?`)) {
            try {
                await fetchJSON('/my-wordbook/remove-many', withCreds({
                    method: 'POST',
                    body: JSON.stringify({ vocabIds: ids }),
                }));
                alert(`${ids.length}개의 단어를 삭제했습니다.`);
                await loadWordbook(filter);
                await loadCategories();
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
                    <button type="button" className="btn btn-success" onClick={handleFlashSelected}>
                        선택 자동학습
                    </button>
                    <Link to="/vocab" className="btn btn-outline-primary">단어 추가하기</Link>
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
                            // ★ 시작: API 응답 구조 변경에 따라 데이터 접근 방식을 수정하고, 품사 정보를 처리합니다.
                            const { vocab } = v;
                            const gloss = vocab.ko_gloss;
                            const checked = selectedIds.has(v.vocabId);
                            const posList = vocab.pos ? vocab.pos.split(',').map(p => p.trim()) : [];
                            // ★ 종료: 데이터 접근 방식 수정

                            return (
                                <div
                                    key={v.id}
                                    className="list-group-item d-flex justify-content-between align-items-center"
                                >
                                    <div className="d-flex align-items-center gap-2" style={{ flexGrow: 1 }}>
                                        <input
                                            type="checkbox"
                                            className="form-check-input"
                                            checked={checked}
                                            onChange={() => toggleSelect(v.vocabId)}
                                        />
                                        <div>
                                            {/* ★ 시작: 단어, 품사, 발음, 뜻을 표시합니다. */}
                                            <div className="d-flex align-items-center">
                                                <div className="fw-semibold me-2" lang="en">{vocab.lemma}</div>
                                                <div className="d-flex gap-1">
                                                    {posList.map(p => (
                                                        p && p.toLowerCase() !== 'unk' && (
                                                            <span key={p} className={`badge ${getPosBadgeColor(p)} fst-italic`}>
                                                                {p}
                                                            </span>
                                                        )
                                                    ))}
                                                </div>
                                            </div>
                                            <Pron ipa={vocab.dictMeta?.ipa} ipaKo={vocab.dictMeta?.ipaKo} />
                                            <div className="text-muted small">{gloss || '뜻 정보 없음'}</div>
                                            {/* ★ 종료: UI 개선 */}
                                        </div>
                                    </div>

                                    <div className="d-flex gap-2">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-secondary"
                                            onClick={(e) => openDetail(v.vocabId, e)}
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
                <div className="modal show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            {detailLoading ? (
                                <div className="modal-body text-center p-5">
                                    <div className="spinner-border" role="status"><span className="visually-hidden">Loading...</span></div>
                                </div>
                            ) : (
                                <VocabDetailModal
                                    vocab={detail}
                                    onClose={() => { setDetail(null); stopAudio(); }}
                                    onPlayUrl={(url, id, index) => playExampleAudio(url, 'example', `${id}-${index}`)}
                                    onPlayVocabAudio={playVocabAudio}
                                    playingAudio={playingAudio}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
