// src/pages/VocabList.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchJSON, withCreds, isAbortError, API_BASE } from '../api/client';
import Pron from '../components/Pron';
import VocabDetailModal from '../components/VocabDetailModal.jsx';

function safeFileName(str) {
    if (!str) return '';
    return encodeURIComponent(str.toLowerCase().replace(/\s+/g, '_'));
}

const getPosBadgeColor = (pos) => {
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

/**
 * 단어 카드 컴포넌트 (VocabCard)
 */
function VocabCard({ vocab, onOpenDetail, onAddWordbook, onAddSRS, inWordbook, inSRS, onPlayAudio, enrichingId, onDeleteVocab, isAdmin, isSelected, onToggleSelect, playingAudio }) {
    const koGloss = vocab.ko_gloss || '뜻 정보 없음';
    const isEnriching = enrichingId === vocab.id;
    const isPlaying = playingAudio?.type === 'vocab' && playingAudio?.id === vocab.id;
    const posList = vocab.pos ? vocab.pos.split(',').map(p => p.trim()) : [];

    return (
        <div className="col-md-6 col-lg-4 mb-3">
            <div className={`card h-100 ${isSelected ? 'border-primary' : ''}`}>
                <div className="card-header d-flex justify-content-end p-1">
                    <input
                        className="form-check-input"
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => { e.stopPropagation(); onToggleSelect(vocab.id); }}
                        title="단어 선택"
                    />
                </div>
                <div
                    className="card-body card-clickable pt-0"
                    onClick={() => onOpenDetail(vocab.id)}
                    style={{ cursor: 'pointer' }}
                >
                    <div className="d-flex align-items-center mb-1">
                        <h5 className="card-title mb-0 me-2" lang="en">{vocab.lemma}</h5>
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
                    <Pron ipa={vocab.ipa} ipaKo={vocab.ipaKo} />
                    <div className="card-subtitle text-muted">{koGloss}</div>
                </div>
                <div className="card-footer d-flex gap-2 justify-content-between align-items-center">
                   <div className="d-flex align-items-center">
                        <div className="btn-group">
                            <button
                                className={`btn btn-sm ${inWordbook ? 'btn-secondary' : 'btn-outline-primary'}`}
                                onClick={(e) => { e.stopPropagation(); onAddWordbook(vocab.id); }}
                                disabled={inWordbook}
                                title="내 단어장에 추가"
                            >
                                {inWordbook ? '단어장에 있음' : '내 단어장'}
                            </button>
                            <button
                                className={`btn btn-sm ${inSRS ? 'btn-secondary' : 'btn-outline-success'}`}
                                onClick={(e) => { e.stopPropagation(); onAddSRS([vocab.id]); }}
                                disabled={inSRS}
                                title="SRS 학습 큐에 추가"
                            >
                                {inSRS ? 'SRS에 있음' : 'SRS 추가'}
                            </button>
                        </div>
                        <button
                            className="btn btn-sm btn-outline-info rounded-circle d-flex align-items-center justify-content-center ms-2"
                            style={{ width: '32px', height: '32px' }}
                            onClick={(e) => { e.stopPropagation(); onPlayAudio(vocab); }}
                            disabled={isEnriching}
                            title="음성 듣기"
                        >
                            {isEnriching ? (
                                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                            ) : isPlaying ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-pause-fill" viewBox="0 0 16 16">
                                    <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/>
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-play-fill" viewBox="0 0 16 16">
                                    <path d="M11.596 8.697l-6.363 3.692A.5.5 0 0 1 4 11.942V4.058a.5.5 0 0 1 .777-.416l6.363 3.692a.5.5 0 0 1 0 .863z"/>
                                </svg>
                            )}
                        </button>
                    </div>
                    {isAdmin && (
                        <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={(e) => { e.stopPropagation(); onDeleteVocab(vocab.id, vocab.lemma); }}
                            title="단어 삭제 (관리자)"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-trash" viewBox="0 0 16 16">
                                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z" />
                                <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function VocabList() {
    const { user } = useAuth();
    const [activeLevel, setActiveLevel] = useState('A1');
    const [words, setWords] = useState([]);
    const [myWordbookIds, setMyWordbookIds] = useState(new Set());
    const [srsIds, setSrsIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const audioRef = useRef(null);
    const [playingAudio, setPlayingAudio] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [enrichingId, setEnrichingId] = useState(null);

    const isAdmin = user?.role === 'admin';

    const filteredWords = useMemo(() => {
        const needle = searchTerm.trim().toLowerCase();
        if (!needle) return words;
        return words.filter(word =>
            word.lemma.toLowerCase().includes(needle) ||
            (word.ko_gloss || '').toLowerCase().includes(needle)
        );
    }, [words, searchTerm]);

    const handleToggleSelect = (vocabId) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(vocabId)) {
                next.delete(vocabId);
            } else {
                next.add(vocabId);
            }
            return next;
        });
    };

    const isAllSelected = useMemo(() => {
        if (filteredWords.length === 0) return false;
        return filteredWords.every(word => selectedIds.has(word.id));
    }, [filteredWords, selectedIds]);

    const handleToggleSelectAll = () => {
        if (isAllSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredWords.map(word => word.id)));
        }
    };

    const handleAddSelectedToWordbook = async () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) {
            alert('단어를 먼저 선택해주세요.');
            return;
        }
        try {
            const { data } = await fetchJSON('/my-wordbook/add-many', withCreds({
                method: 'POST',
                body: JSON.stringify({ vocabIds: ids })
            }));
            const count = data?.count || 0;
            alert(`${ids.length}개 중 ${count}개의 새로운 단어를 내 단어장에 추가했습니다.`);
            setSelectedIds(new Set());
            setMyWordbookIds(prev => new Set([...prev, ...ids]));
        } catch (e) {
            console.error("내 단어장 추가 실패:", e);
            alert(`추가 실패: ${e.message || '서버 오류'}`);
        }
    };

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

        newAudio.onended = () => {
            setPlayingAudio(null);
        };

        newAudio.play().then(() => {
            audioRef.current = newAudio;
            setPlayingAudio({ type, id });
        }).catch(e => {
            console.error("오디오 재생 실패:", e, fullUrl);
            setPlayingAudio(null);
        });
    };

    const playVocabAudio = async (vocab) => {
        const targetUrl = vocab.audio;
        if (targetUrl) {
            playUrl(targetUrl, 'vocab', vocab.id);
            return;
        }
        try {
            setEnrichingId(vocab.id);
            const { data: updatedVocab } = await fetchJSON(`/vocab/${vocab.id}/enrich`, withCreds({ method: 'POST' }));
            setWords(prevWords => prevWords.map(w => (w.id === updatedVocab.id ? updatedVocab : w)));
            const enrichedUrl = updatedVocab.audio;
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

    const playExampleAudio = (url, vocabId, index) => {
        playUrl(url, 'example', `${vocabId}-${index}`);
    };

    const handleDeleteVocab = async (vocabId, lemma) => {
        if (!window.confirm(`'${lemma}' 단어를 데이터베이스에서 영구적으로 삭제하시겠습니까?`)) return;
        try {
            await fetchJSON(`/vocab/${vocabId}`, withCreds({ method: 'DELETE' }));
            setWords(prevWords => prevWords.filter(word => word.id !== vocabId));
            alert(`'${lemma}' 단어가 삭제되었습니다.`);
        } catch (e) {
            console.error("단어 삭제 실패:", e);
            alert(`삭제 실패: ${e.message || '서버 오류'}`);
        }
    };

    useEffect(() => {
        return () => { if (audioRef.current) stopAudio(); };
    }, []);

    useEffect(() => {
        const ac = new AbortController();
        (async () => {
            try {
                setLoading(true); setErr(null);
                const { data } = await fetchJSON(`/vocab/list?level=${encodeURIComponent(activeLevel)}`, withCreds({ signal: ac.signal }), 15000);
                setWords(Array.isArray(data) ? data : []);
            } catch (e) {
                if (!isAbortError(e)) setErr(e);
            } finally {
                if (!ac.signal.aborted) setLoading(false);
            }
        })();
        return () => ac.abort();
    }, [activeLevel]);

    useEffect(() => {
        if (!user) { setMyWordbookIds(new Set()); setSrsIds(new Set()); return; }
        const ac = new AbortController();
        (async () => {
            try {
                const [wb, srs] = await Promise.all([
                    fetchJSON('/my-wordbook', withCreds({ signal: ac.signal })),
                    // ★ 시작: 존재하지 않는 API 주소('/srs/cards')를 올바른 주소('/srs/all-cards')로 수정합니다.
                    fetchJSON('/srs/all-cards', withCreds({ signal: ac.signal }))
                    // ★ 종료: API 주소 수정
                ]);
                
                // ★ 수정: /srs/all-cards 응답 데이터 구조에 맞게 srsIds를 설정합니다.
                // 이 API는 { vocabId: number, ... } 형태의 객체 배열을 반환합니다.
                const wbIds = new Set((wb.data || []).map(v => v.vocabId)); 
                const srsSet = new Set((srs.data || []).map(card => card.vocabId));
                
                setMyWordbookIds(wbIds);
                setSrsIds(srsSet);
            } catch (e) {
                if (!isAbortError(e)) console.error(e);
            }
        })();
        return () => ac.abort();
    }, [user]);

    const handleOpenDetail = async (vocabId) => {
        try {
            setDetailLoading(true); setDetail(null);
            const { data } = await fetchJSON(`/vocab/${vocabId}`, withCreds(), 15000);
            setDetail(data);
        } catch (e) {
            if (e.status === 401) alert('로그인이 필요합니다.');
            else alert('상세 정보를 불러오지 못했습니다.');
            console.error(e);
        } finally {
            setDetailLoading(false);
        }
    };

    const handleAddWordbook = async (vocabId) => {
        if (!user) return alert('로그인이 필요합니다.');
        try {
            await fetchJSON('/my-wordbook/add', withCreds({ method: 'POST', body: JSON.stringify({ vocabId }) }));
            setMyWordbookIds(prev => new Set(prev).add(vocabId));
            alert('내 단어장에 추가했습니다.');
        } catch (e) {
            console.error(e);
            alert('추가 실패');
        }
    };

    const handleAddSRS = async (ids) => {
        if (!user) return alert('로그인이 필요합니다.');
        try {
            await fetchJSON('/srs/create-many', withCreds({ method: 'POST', body: JSON.stringify({ vocabIds: ids }) }));
            setSrsIds(prev => new Set([...prev, ...ids]));
            alert(`${ids.length}개를 SRS에 추가했습니다.`);
        } catch (e) {
            console.error(e);
            alert('SRS 추가 실패');
        }
    };

    return (
        <main className="container py-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h2 className="m-0">레벨별 단어</h2>
                <div className="btn-group">
                    {['A1', 'A2', 'B1', 'B2', 'C1'].map(l => (
                        <button key={l} className={`btn btn-sm ${activeLevel === l ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setActiveLevel(l)}>{l}</button>
                    ))}
                </div>
            </div>

            <div className="d-flex justify-content-between align-items-center mb-3 p-2 rounded bg-light">
                <div className="form-check">
                    <input
                        className="form-check-input"
                        type="checkbox"
                        id="selectAllCheck"
                        checked={isAllSelected}
                        onChange={handleToggleSelectAll}
                        disabled={filteredWords.length === 0}
                    />
                    <label className="form-check-label" htmlFor="selectAllCheck">
                        {isAllSelected ? '전체 해제' : '전체 선택'} ({selectedIds.size} / {filteredWords.length})
                    </label>
                </div>
                <div className="d-flex gap-2">
                    <button
                        className="btn btn-primary btn-sm"
                        disabled={selectedIds.size === 0}
                        onClick={handleAddSelectedToWordbook}
                    >
                        선택한 단어 {selectedIds.size}개 내 단어장에 추가
                    </button>
                    <Link to="/my-wordbook" className="btn btn-outline-secondary btn-sm">내 단어장 가기</Link>
                </div>
            </div>

            <div className="mb-3">
                <input
                    type="search"
                    className="form-control"
                    placeholder="단어 검색 (독일어 또는 한국어 뜻)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {loading && <div>목록 로딩 중…</div>}
            {err && <div className="alert alert-warning">해당 레벨 목록을 불러오지 못했습니다.</div>}
            {!loading && !err && filteredWords.length === 0 && (
                <div className="text-muted">
                    {searchTerm ? '검색 결과가 없습니다.' : '이 레벨에 표시할 단어가 없습니다.'}
                </div>
            )}
            <div className="row">
                {filteredWords.map(vocab => (
                    <VocabCard
                        key={vocab.id}
                        vocab={vocab}
                        onOpenDetail={handleOpenDetail}
                        onAddWordbook={handleAddWordbook}
                        onAddSRS={handleAddSRS}
                        inWordbook={myWordbookIds.has(vocab.id)}
                        inSRS={srsIds.has(vocab.id)}
                        onPlayAudio={playVocabAudio}
                        enrichingId={enrichingId}
                        onDeleteVocab={handleDeleteVocab}
                        isAdmin={isAdmin}
                        isSelected={selectedIds.has(vocab.id)}
                        onToggleSelect={handleToggleSelect}
                        playingAudio={playingAudio}
                    />
                ))}
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
                                    onPlayUrl={playExampleAudio}
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
