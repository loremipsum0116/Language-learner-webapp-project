// src/pages/VocabList.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// ★ API_BASE를 임포트합니다.
import { fetchJSON, withCreds, isAbortError, API_BASE } from '../api/client';
import Pron from '../components/Pron';

/**
 * 상세 보기 모달 (수정됨)
 * - onPlayUrl 함수를 props로 받아 예문 오디오를 재생합니다.
 */
function VocabDetailModal({ vocab, onClose, onPlayUrl }) {
    const koGloss =
        vocab?.dictMeta?.examples?.find?.(ex => ex && ex.kind === 'gloss')?.ko || null;
    const examples =
        Array.isArray(vocab?.dictMeta?.examples)
            ? vocab.dictMeta.examples.filter(ex => ex && ex.kind !== 'gloss')
            : [];

    return (
        <div className="modal show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
            <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title" lang="de">{vocab?.lemma}</h5>
                        <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
                    </div>
                    <div className="modal-body">
                        <Pron ipa={vocab?.dictMeta?.ipa} ipaKo={vocab?.dictMeta?.ipaKo} />
                        {koGloss && <div className="mt-2"><strong>뜻</strong>: {koGloss}</div>}

                        {examples.length > 0 && (
                            <ul className="mt-2 list-unstyled">
                                {examples.map((ex, i) => (
                                    <li key={i} className="d-flex justify-content-between align-items-center mb-1 p-2 rounded hover-bg-light">
                                        <div>
                                            <span lang="de">{ex.de}</span>
                                            {ex.ko ? <span className="text-muted d-block small"> — {ex.ko}</span> : null}
                                        </div>
                                        {/* ★ 예문에 audioUrl이 있으면 버튼 렌더링 */}
                                        {ex.audioUrl && (
                                            <button
                                                className="btn btn-sm btn-outline-secondary ms-2"
                                                onClick={(e) => {
                                                    e.stopPropagation(); // 모달 닫힘 방지
                                                    onPlayUrl(ex.audioUrl);
                                                }}
                                                aria-label="Play example sentence"
                                                title="예문 듣기"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-play-circle" viewBox="0 0 16 16">
                                                  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                                                  <path d="M6.271 5.055a.5.5 0 0 1 .52.038l3.5 2.5a.5.5 0 0 1 0 .814l-3.5 2.5A.5.5 0 0 1 6 10.5v-5a.5.5 0 0 1 .271-.445z"/>
                                                </svg>
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}

                        <details className="mt-2">
                            <summary className="small text-muted">debug</summary>
                            <pre className="small mb-0">{JSON.stringify(vocab, null, 2)}</pre>
                        </details>
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={onClose}>닫기</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * 카드 컴포넌트 (수정됨)
 * - onPlayAudio 함수를 props로 받아 단어 오디오를 재생합니다.
 */
function VocabCard({ vocab, onOpenDetail, onAddWordbook, onAddSRS, inWordbook, inSRS, onPlayAudio, enrichingId }) {
    const koGloss = vocab.ko_gloss || (vocab.dictMeta?.examples?.find(ex => ex.kind === 'gloss')?.ko) || '뜻 정보 없음';
    const isEnriching = enrichingId === vocab.id;

    return (
        <div className="col-md-6 col-lg-4 mb-3">
            <div className="card h-100">
                <div
                    className="card-body card-clickable"
                    onClick={() => onOpenDetail(vocab.id)}
                    style={{ cursor: 'pointer' }}
                >
                    <h5 className="card-title mb-1" lang="de">{vocab.lemma}</h5>
                    <Pron ipa={vocab.ipa || vocab.dictMeta?.ipa} ipaKo={vocab.ipaKo || vocab.dictMeta?.ipaKo} />
                    <div className="card-subtitle text-muted">{koGloss}</div>
                </div>
                <div className="card-footer d-flex gap-2">
                    <button
                        className={`btn btn-sm ${inWordbook ? 'btn-secondary' : 'btn-outline-primary'}`}
                        onClick={() => onAddWordbook(vocab.id)}
                        disabled={inWordbook}
                        title="내 단어장에 추가"
                    >
                        {inWordbook ? '단어장에 있음' : '내 단어장'}
                    </button>
                    <button
                        className={`btn btn-sm ${inSRS ? 'btn-secondary' : 'btn-outline-success'}`}
                        onClick={() => onAddSRS([vocab.id])}
                        disabled={inSRS}
                        title="SRS 학습 큐에 추가"
                    >
                        {inSRS ? 'SRS에 있음' : 'SRS 추가'}
                    </button>
                    <button
                        className="btn btn-sm btn-outline-info"
                        onClick={(e) => {
                            e.stopPropagation();
                            onPlayAudio(vocab);
                        }}
                        disabled={isEnriching}
                        title="음성 듣기"
                    >
                        {isEnriching ? (
                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        ) : (
                            '음성'
                        )}
                    </button>
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
    const [audio, setAudio] = useState(null); // ★ 오디오 인스턴스 중앙 관리
    const [enrichingId, setEnrichingId] = useState(null);

    // ★ 범용 오디오 재생 함수 (URL 직접 재생) - 수정됨
    const playUrl = (url) => {
        if (audio) {
            audio.pause(); // 기존 오디오가 있다면 정지
        }
        if (url && typeof url === 'string' && (url.startsWith('http') || url.startsWith('/'))) {
            // ★ URL이 상대 경로인 경우 API_BASE를 붙여 절대 경로로 만듭니다.
            const fullUrl = url.startsWith('/') ? `${API_BASE}${url}` : url;

            const newAudio = new Audio(fullUrl);
            newAudio.play().catch(e => {
                console.error("오디오 재생 실패:", e);
                console.error("실패한 URL:", fullUrl); // 디버깅을 위해 URL도 함께 출력
            });
            setAudio(newAudio); // 새 오디오 인스턴스를 상태에 저장
        } else {
            console.warn("제공된 오디오 URL이 유효하지 않습니다:", url);
        }
    };

    // ★ 단어 오디오 재생 함수 (기존 로직 + playUrl 활용)
    const playVocabAudio = async (vocab) => {
        const targetUrl = vocab.audioUrl || vocab.dictMeta?.audioUrl;
        if (targetUrl) {
            playUrl(targetUrl);
            return;
        }

        // Enrich 로직 (데이터베이스에 오디오 URL이 없을 경우)
        try {
            setEnrichingId(vocab.id);
            const { data: updatedVocab } = await fetchJSON(
                `/vocab/${vocab.id}/enrich`,
                withCreds({ method: 'POST' })
            );

            setWords(prevWords =>
                prevWords.map(w => (w.id === updatedVocab.id ? updatedVocab : w))
            );

            const enrichedUrl = updatedVocab.audioUrl || updatedVocab.dictMeta?.audioUrl;
            if (enrichedUrl) {
                playUrl(enrichedUrl);
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

    // ★ 컴포넌트가 사라질 때 오디오 정리
    useEffect(() => {
        return () => {
            if (audio) {
                audio.pause();
            }
        };
    }, [audio]);

    useEffect(() => {
        const ac = new AbortController();
        (async () => {
            try {
                setLoading(true); setErr(null);
                const { data } = await fetchJSON(
                    `/vocab/list?level=${encodeURIComponent(activeLevel)}`,
                    withCreds({ signal: ac.signal }),
                    15000
                );
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
                    fetchJSON('/srs/cards', withCreds({ signal: ac.signal }))
                ]);
                const wbIds = new Set((wb.data || []).map(v => v.id));
                const srsSet = new Set(srs.data || []);
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
            await fetchJSON('/my-wordbook/add', withCreds({
                method: 'POST',
                body: JSON.stringify({ vocabId })
            }));
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
            await fetchJSON('/srs/create-many', withCreds({
                method: 'POST',
                body: JSON.stringify({ vocabIds: ids })
            }));
            setSrsIds(prev => {
                const n = new Set(prev);
                ids.forEach(id => n.add(id));
                return n;
            });
            alert(`${ids.length}개를 SRS에 추가했습니다.`);
        } catch (e) {
            console.error(e);
            alert('SRS 추가 실패');
        }
    };
    
    const filteredWords = useMemo(() => {
        const needle = searchTerm.trim().toLowerCase();
        if (!needle) return words;
        return words.filter(word =>
            word.lemma.toLowerCase().includes(needle) ||
            (word.ko_gloss || '').toLowerCase().includes(needle)
        );
    }, [words, searchTerm]);

    const idsInCurrent = useMemo(() => filteredWords.map(w => w.id).filter(Boolean), [filteredWords]);
    const idsToAddAllSRS = useMemo(
        () => idsInCurrent.filter(id => !srsIds.has(id)),
        [idsInCurrent, srsIds]
    );

    return (
        <main className="container py-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h2 className="m-0">레벨별 단어</h2>
                <div className="btn-group">
                    {['A1', 'A2', 'B1', 'B2', 'C1'].map(l => (
                        <button
                            key={l}
                            className={`btn btn-sm ${activeLevel === l ? 'btn-primary' : 'btn-outline-primary'}`}
                            onClick={() => setActiveLevel(l)}
                        >{l}</button>
                    ))}
                </div>
            </div>

            <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="text-muted">{activeLevel} 레벨</div>
                <div className="d-flex gap-2">
                    <Link to="/my-wordbook" className="btn btn-outline-secondary btn-sm">내 단어장</Link>
                    <Link to="/odat-note" className="btn btn-outline-danger btn-sm">오답노트</Link>
                    <button
                        className="btn btn-success btn-sm"
                        disabled={!user || idsToAddAllSRS.length === 0}
                        onClick={() => handleAddSRS(idsToAddAllSRS)}
                        title="현재 필터링된 모든 단어를 SRS에 추가"
                    >
                        {searchTerm ? '검색 결과' : activeLevel} 모두 SRS 추가
                    </button>
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
                    />
                ))}
            </div>

            {/* ★ 모달 렌더링 시 onPlayUrl 함수 전달 */}
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
                                    onClose={() => setDetail(null)}
                                    onPlayUrl={playUrl} 
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
