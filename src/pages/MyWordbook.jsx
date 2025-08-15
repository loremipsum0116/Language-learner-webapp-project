//src/pages/MyWorldbook.jsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { fetchJSON, withCreds, API_BASE } from '../api/client';
import Pron from '../components/Pron';
import VocabDetailModal from '../components/VocabDetailModal.jsx';
import { useAuth } from '../context/AuthContext'; // ★ AuthContext에서 useAuth 임포트
import FlatFolderPickerModal from '../components/FlatFolderPickerModal';
import * as SrsApi from '../api/srs';
import RainbowStar from '../components/RainbowStar';

// 헬퍼 함수
const getCefrBadgeColor = (level) => {
    switch (level) {
        case 'A1': return 'bg-danger';
        case 'A2': return 'bg-warning text-dark';
        case 'B1': return 'bg-success';
        case 'B2': return 'bg-info text-dark';
        case 'C1': return 'bg-primary';
        default: return 'bg-secondary';
    }
};

const getPosBadgeColor = (pos) => {
    if (!pos) return 'bg-secondary';
    switch (pos.toLowerCase().trim()) {
        case 'noun': return 'bg-primary';
        case 'verb': return 'bg-success';
        case 'adjective': return 'bg-warning text-dark';
        case 'adverb': return 'bg-info text-dark';
        case 'preposition': return 'bg-danger';
        default: return 'bg-secondary';
    }
};

// 새 폴더 생성 폼 컴포넌트
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

// 메인 페이지 컴포넌트
export default function MyWordbook() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // ★ 1. AuthContext에서 사용자 정보, srsIds, srsIds 새로고침 함수를 가져옵니다.
    const { user, srsIds, refreshSrsIds } = useAuth();

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
    const [masteredCards, setMasteredCards] = useState([]);

    // SRS 폴더 선택 모달 관련 state
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerIds, setPickerIds] = useState([]);

    const handleFlashSelected = () => {
        const ids = Array.from(selectedIds);
        // ✅ FIX: 100개 초과 선택 시 경고 메시지 표시
        if (ids.length > 100) {
            alert('한 번에 100개 이상의 단어를 자동학습할 수 없습니다.');
            return;
        }

        if (ids.length === 0) {
            alert('학습할 단어를 선택하세요.');
            return;
        }
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

    const loadCategories = useCallback(async (signal) => {
        const { data } = await fetchJSON('/categories', withCreds({ signal }));
        setCategories(data?.categories || []);
        setUncategorized(data?.uncategorized || 0);
    }, []);

    const loadWordbook = useCallback(async (f, signal) => {
        setLoading(true);
        try {
            let url = '/my-wordbook';
            if (f === 'none') url += '?categoryId=none';
            else if (typeof f === 'number') url += `?categoryId=${f}`;
            const { data } = await fetchJSON(url, withCreds({ signal }));
            setWords(Array.isArray(data) ? data : []);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // 이 컴포넌트가 화면에서 사라질 때 stopAudio 함수를 호출합니다.
        return () => stopAudio();
    }, [])

    // 마스터된 카드 정보 가져오기
    useEffect(() => {
        if (!user) return;
        const ac = new AbortController();
        fetchJSON('/srs/mastered-cards', withCreds({ signal: ac.signal }))
            .then(({ data }) => {
                if (Array.isArray(data)) {
                    setMasteredCards(data);
                }
            })
            .catch(e => {
                if (e.name !== 'AbortError') console.error("Failed to fetch mastered cards", e);
            });
        return () => ac.abort();
    }, [user]);

    // ★ 2. useEffect에서 로컬 srsIds 로딩 로직을 제거합니다. (AuthContext가 처리)
    useEffect(() => {
        const ac = new AbortController();
        const init = readFilterFromURL();
        setFilter(init);

        Promise.all([
            loadCategories(ac.signal),
            loadWordbook(init, ac.signal),
        ]);

        return () => ac.abort();
    }, [loadCategories, loadWordbook, readFilterFromURL]);

    const filteredWords = useMemo(() => {
        if (!Array.isArray(words)) return [];
        const validWords = words.filter(word => word && word.vocab && word.vocab.lemma);
        const needle = searchTerm.trim().toLowerCase();
        if (!needle) return validWords;
        return validWords.filter(word =>
            word.vocab.lemma.toLowerCase().includes(needle) ||
            (word.vocab.ko_gloss && word.vocab.ko_gloss.toLowerCase().includes(needle))
        );
    }, [words, searchTerm]);

    const stopAudio = () => {
        const el = audioRef.current;
        if (!el) return;
        try {
            el.pause();
            el.removeAttribute('src');
            el.load();
        } catch { }
        setPlayingAudio(null);
    };

    const playUrl = (url, type, id) => {
        const el = audioRef.current;
        if (!el || !url) return;

        if (playingAudio?.id === id) {
            stopAudio();
            return;
        }

        stopAudio();

        el.src = url.startsWith('/') ? `${API_BASE}${url}` : url;
        el.play().then(() => {
            setPlayingAudio({ type, id });
        }).catch(e => {
            console.error("오디오 재생 실패:", e);
            setPlayingAudio(null);
        });

        // 오디오가 끝나면 재생 상태 초기화
        el.onended = () => setPlayingAudio(null);
    };

    // vocab 페이지와 동일한 safeFileName 함수 추가
    const safeFileName = (str) => {
        if (!str) return '';
        return encodeURIComponent(str.toLowerCase().replace(/\s+/g, '_'));
    };

    const playVocabAudio = (vocabData) => {
        const vocab = vocabData.vocab || vocabData;
        // vocab 페이지와 동일한 우선순위: vocab.audio || vocab.dictentry?.audioUrl
        const targetUrl = vocab.audio || vocab.dictentry?.audioUrl;
        if (targetUrl) {
            playUrl(targetUrl, 'vocab', vocab.id);
            return;
        }
        
        // vocab 페이지와 동일한 fallback: 로컬 오디오 패스 생성
        const localAudioPath = `/${vocab.levelCEFR}/audio/${safeFileName(vocab.lemma)}.mp3`;
        playUrl(localAudioPath, 'vocab', vocab.id);
    };

    useEffect(() => {
        return () => stopAudio();
    }, []);

    const onClickFolder = async (f) => {
        setFilter(f);
        setSelectedIds(new Set());
        const params = f === 'all' ? {} : { cat: String(f) };
        setSearchParams(params);
        await loadWordbook(f);
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id); else n.add(id);
            return n;
        });
    };

    const selectAll = () => setSelectedIds(new Set(filteredWords.map(w => w.vocabId)));
    const unselectAll = () => setSelectedIds(new Set());

    const onMoveClick = async () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) { alert('이동할 단어를 선택하세요.'); return; }
        try {
            if (moveTarget === 'none') {
                // 미분류로 이동: 기존 카테고리 연결 제거 (현재 폴더 정보 포함)
                await fetchJSON('/my-wordbook/remove-many', withCreds({
                    method: 'POST',
                    body: JSON.stringify({ 
                        vocabIds: ids,
                        categoryId: filter // 현재 폴더에서 이동하므로 SRS/오답노트 정리
                    }),
                }));
            } else {
                // 특정 카테고리로 이동: 일괄 추가 (서버는 categoryId를 사용)
                await fetchJSON('/my-wordbook/add-many', withCreds({
                    method: 'POST',
                    body: JSON.stringify({
                        vocabIds: ids,
                        categoryId: Number(moveTarget),
                    }),
                }));
            }
            await Promise.all([loadCategories(), loadWordbook(filter)]);
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
            const { data } = await fetchJSON(`/vocab/${vocabId}`, withCreds());
            setDetail(data);
        } catch (err) {
            console.error(err);
            alert('상세 정보를 불러오지 못했습니다.');
        } finally {
            setDetailLoading(false);
        }
    };

    // ★ 3. vocab 페이지와 동일한 SRS 추가 방식으로 변경
    const addVocabToSRS = async (ids) => {
        if (!user || !Array.isArray(ids) || ids.length === 0) {
            alert('SRS에 추가할 단어를 선택하세요.'); return;
        }

        // vocab 페이지와 동일하게 폴더 선택 모달 열기
        setPickerIds(ids);
        setPickerOpen(true);
    };

    const handleDeleteSelected = async () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) { alert('삭제할 단어를 선택하세요.'); return; }
        if (window.confirm(`${ids.length}개의 단어를 내 단어장에서 삭제하시겠습니까?`)) {
            try {
                // 현재 선택된 폴더 정보를 categoryId로 전달하여 SRS/오답노트 정리
                await fetchJSON('/my-wordbook/remove-many', withCreds({
                    method: 'POST',
                    body: JSON.stringify({ 
                        vocabIds: ids,
                        categoryId: filter // 현재 필터(폴더) 정보 포함
                    }),
                }));
                alert(`${ids.length}개의 단어를 삭제했습니다.`);
                await Promise.all([loadWordbook(filter), loadCategories()]);
                unselectAll();
            } catch (e) {
                console.error('단어 삭제 실패:', e);
                alert('단어 삭제에 실패했습니다.');
            }
        }
    };

    const isActive = (f) => f === filter;

    return (
        <main className="container py-4">
            <audio ref={audioRef} style={{ display: 'none' }} />
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
                        <button className={`list-group-item list-group-item-action ${isActive('all') ? 'active' : ''}`} onClick={() => onClickFolder('all')}>전체</button>
                        <button className={`list-group-item list-group-item-action d-flex justify-content-between ${isActive('none') ? 'active' : ''}`} onClick={() => onClickFolder('none')}>
                            <span>미분류</span>
                            <span className="badge text-bg-secondary">{uncategorized}</span>
                        </button>
                        {categories.map((c) => (
                            <button key={c.id} className={`list-group-item list-group-item-action d-flex justify-content-between ${isActive(c.id) ? 'active' : ''}`} onClick={() => onClickFolder(c.id)}>
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
                            <button className="btn btn-sm btn-outline-secondary" onClick={selectAll} disabled={loading || filteredWords.length === 0}>전체 선택</button>
                            <button className="btn btn-sm btn-outline-secondary" onClick={unselectAll} disabled={selectedIds.size === 0}>선택 해제</button>
                            <select className="form-select form-select-sm" style={{ width: 150 }} value={String(moveTarget)} onChange={(e) => setMoveTarget(e.target.value === 'none' ? 'none' : Number(e.target.value))}>
                                <option value="none">미분류로 이동</option>
                                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <button className="btn btn-sm btn-primary" onClick={onMoveClick} disabled={selectedIds.size === 0}>이동</button>
                            <button className="btn btn-sm btn-success" onClick={() => addVocabToSRS(Array.from(selectedIds))} disabled={selectedIds.size === 0}>SRS에 추가</button>
                            <button className="btn btn-sm btn-danger" onClick={handleDeleteSelected} disabled={selectedIds.size === 0}>삭제</button>
                        </div>
                    </div>

                    <div className="mb-3">
                        <input type="search" className="form-control" placeholder="내 단어장에서 검색 (단어 또는 뜻)" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>

                    <div className="list-group">
                        {filteredWords.map((v) => {
                            const { vocab } = v;
                            const gloss = vocab.ko_gloss;
                            const checked = selectedIds.has(v.vocabId);
                            const uniquePosList = [...new Set(vocab.pos ? vocab.pos.split(',').map(p => p.trim()) : [])];
                            
                            // 마스터된 카드 정보 찾기
                            const masteredCard = masteredCards.find(card => card.itemType === 'vocab' && card.itemId === v.vocabId);
                            const isMastered = !!masteredCard;
                            const masterCycles = masteredCard?.masterCycles || 0;

                            return (
                                <div key={v.id} className={`list-group-item d-flex justify-content-between align-items-center ${isMastered ? 'bg-light border-warning' : ''}`}>
                                    <div className="d-flex align-items-center gap-2" style={{ flexGrow: 1 }}>
                                        <input type="checkbox" className="form-check-input" checked={checked} onChange={() => toggleSelect(v.vocabId)} />
                                        <div>
                                            <div className="d-flex align-items-center flex-wrap">
                                                <div className={`fw-semibold me-2 ${isMastered ? 'text-warning' : ''}`} lang="en">{vocab.lemma}</div>
                                                {/* 마스터 별을 단어명 옆 인라인으로 표시 */}
                                                {isMastered && (
                                                    <RainbowStar 
                                                        size="small" 
                                                        cycles={masterCycles} 
                                                        animated={true}
                                                        className="me-2"
                                                        style={{ display: 'inline-block' }}
                                                    />
                                                )}
                                                <div className="d-flex gap-1">
                                                    {vocab.levelCEFR && <span className={`badge ${getCefrBadgeColor(vocab.levelCEFR)}`}>{vocab.levelCEFR}</span>}
                                                    {uniquePosList.map(p => p && p.toLowerCase() !== 'unk' && (
                                                        <span key={p} className={`badge ${getPosBadgeColor(p)} fst-italic`}>{p}</span>
                                                    ))}
                                                    {isMastered && (
                                                        <span className="badge bg-warning text-dark">
                                                            🌟 마스터 완료
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <Pron ipa={vocab.dictMeta?.ipa} ipaKo={vocab.dictMeta?.ipaKo} />
                                            <div className="text-muted small">{gloss || '뜻 정보 없음'}</div>
                                        </div>
                                    </div>
                                    <div className="d-flex gap-2">
                                        <button
                                            className="btn btn-sm btn-outline-info rounded-circle d-flex align-items-center justify-content-center"
                                            style={{ width: '32px', height: '32px' }}
                                            onClick={(e) => { e.stopPropagation(); playVocabAudio(v); }}
                                            disabled={enrichingId === v.vocabId}
                                            title="음성 듣기"
                                        >
                                            {enrichingId === v.vocabId ? (
                                                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                            ) : playingAudio?.type === 'vocab' && playingAudio?.id === v.vocabId ? (
                                                <i className="fas fa-pause" style={{ fontSize: '12px' }}></i>
                                            ) : (
                                                <i className="fas fa-volume-up" style={{ fontSize: '12px' }}></i>
                                            )}
                                        </button>
                                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={(e) => openDetail(v.vocabId, e)}>상세</button>
                                        {/* ★ 4. 버튼의 상태와 동작이 전역 srsIds를 사용하도록 수정되었습니다. */}
                                        <button
                                            className="btn btn-sm btn-outline-success"
                                            onClick={() => addVocabToSRS([v.vocabId])}
                                            title="오늘 학습할 SRS 폴더에 추가"
                                        >
                                            + SRS
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {!loading && filteredWords.length === 0 && (
                            <div className="alert alert-light mb-0">
                                {searchTerm ? '해당 단어가 없습니다.' : '이 폴더에 단어가 없습니다.'}
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
                                <div className="modal-body text-center p-5"><div className="spinner-border" role="status"><span className="visually-hidden">Loading...</span></div></div>
                            ) : (
                                <VocabDetailModal
                                    vocab={detail}
                                    onClose={() => { setDetail(null); stopAudio(); }}
                                    onPlayUrl={playUrl}
                                    onPlayVocabAudio={playVocabAudio}
                                    playingAudio={playingAudio}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* SRS 폴더 선택 모달 */}
            {pickerOpen && (
                <FlatFolderPickerModal
                    show={pickerOpen}
                    onClose={() => { setPickerOpen(false); setPickerIds([]); }}
                    onPick={async (folder) => {
                        const folderId = folder?.id ?? folder; // 안전 처리
                        try {
                            const res = await SrsApi.SrsApi.addItems(folderId, { vocabIds: pickerIds });

                            const added = res?.added ?? res?.addedCount ?? 0;
                            const dup = res?.duplicateIds?.length ?? 0;
                            alert(`추가됨 ${added}개${dup ? `, 중복 ${dup}개` : ''}`);
                            await refreshSrsIds?.();
                        } catch (e) {
                            alert('폴더에 추가 실패: ' + (e?.message || '서버 오류'));
                        } finally {
                            setPickerOpen(false);
                            setPickerIds([]);
                        }
                    }}
                />
            )}
        </main>
    );
}