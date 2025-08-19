// src/pages/VocabList.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchJSON, withCreds, isAbortError, API_BASE } from '../api/client';
import Pron from '../components/Pron';
import VocabDetailModal from '../components/VocabDetailModal.jsx';
import { SrsApi } from '../api/srs';
import HierarchicalFolderPickerModal from '../components/HierarchicalFolderPickerModal';
import RainbowStar from '../components/RainbowStar';
import AutoFolderModal from '../components/AutoFolderModal';

// Helper functions (no changes)
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
        default: return 'bg-secondary';
    }
};

// VocabCard component (updated with RainbowStar support)
function VocabCard({ vocab, onOpenDetail, onAddWordbook, onAddSRS, inWordbook, inSRS, onPlayAudio, enrichingId, onDeleteVocab, isAdmin, isSelected, onToggleSelect, playingAudio, masteredCards }) {
    const koGloss = vocab.ko_gloss || '뜻 정보 없음';
    const isEnriching = enrichingId === vocab.id;
    const isPlaying = playingAudio?.type === 'vocab' && playingAudio?.id === vocab.id;
    const uniquePosList = [...new Set(vocab.pos ? vocab.pos.split(',').map(p => p.trim()) : [])];
    
    // 마스터된 카드 정보 찾기
    const masteredCard = masteredCards?.find(card => card.itemType === 'vocab' && card.itemId === vocab.id);
    const isMastered = !!masteredCard;
    const masterCycles = masteredCard?.masterCycles || 0;

    return (
        <div className="col-md-6 col-lg-4 mb-3">
            <div className={`card h-100 ${isSelected ? 'border-primary' : ''} ${isMastered ? 'border-warning bg-light' : ''} position-relative`}>
                {/* 마스터 별 표시 */}
                {isMastered && (
                    <RainbowStar 
                        size="medium" 
                        cycles={masterCycles} 
                        animated={true}
                        className="position-absolute"
                        style={{ top: '8px', right: '8px', zIndex: 10 }}
                    />
                )}
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
                            {vocab.levelCEFR && <span className={`badge ${getCefrBadgeColor(vocab.levelCEFR)}`}>{vocab.levelCEFR}</span>}
                            {uniquePosList.map(p => (
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
                                className="btn btn-sm btn-outline-success"
                                onClick={(e) => { e.stopPropagation(); onAddSRS([vocab.id]); }}
                                title="오늘 학습할 SRS 폴더에 추가"
                            >
                                + SRS
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
                                    <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-play-fill" viewBox="0 0 16 16">
                                    <path d="M11.596 8.697l-6.363 3.692A.5.5 0 0 1 4 11.942V4.058a.5.5 0 0 1 .777-.416l6.363 3.692a.5.5 0 0 1 0 .863z" />
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

// useDebounce hook (no changes)
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

export default function VocabList() {
    const { user, srsIds, loading: authLoading, refreshSrsIds } = useAuth();
    const [activeLevel, setActiveLevel] = useState('A1');
    const [activeTab, setActiveTab] = useState('cefr'); // 'cefr' or 'exam'
    const [activeExam, setActiveExam] = useState('TOEIC');
    const [examCategories, setExamCategories] = useState([]);
    const [words, setWords] = useState([]);
    const [allWords, setAllWords] = useState([]); // 전체 단어 리스트
    const [displayCount, setDisplayCount] = useState(100); // 현재 표시되는 단어 개수
    const [myWordbookIds, setMyWordbookIds] = useState(new Set());
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pendingVocabIds, setPendingVocabIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const audioRef = useRef(null);
    const [playingAudio, setPlayingAudio] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [enrichingId, setEnrichingId] = useState(null);
    const [masteredCards, setMasteredCards] = useState([]);
    const [autoFolderModalOpen, setAutoFolderModalOpen] = useState(false);


    const [pickerIds, setPickerIds] = useState([]); // 선택된 vocabIds 보관

    const debouncedSearchTerm = useDebounce(searchTerm, 400);
    const isAdmin = user?.role === 'admin';

    // 시험 카테고리 로드
    useEffect(() => {
        if (authLoading) return;
        const ac = new AbortController();
        (async () => {
            try {
                const { data } = await fetchJSON('/exam-vocab/categories', withCreds({ signal: ac.signal }));
                setExamCategories(Array.isArray(data) ? data : []);
            } catch (e) {
                if (!isAbortError(e)) {
                    console.error('Failed to load exam categories:', e);
                }
            }
        })();
        return () => ac.abort();
    }, [authLoading]);

    useEffect(() => {
        if (authLoading) return;
        const ac = new AbortController();
        (async () => {
            try {
                setLoading(true);
                setErr(null);
                let url, data;
                
                if (debouncedSearchTerm) {
                    // 검색 모드
                    url = `/vocab/list?q=${encodeURIComponent(debouncedSearchTerm)}`;
                    const response = await fetchJSON(url, withCreds({ signal: ac.signal }));
                    data = response.data;
                } else if (activeTab === 'cefr') {
                    // CEFR 레벨별 조회
                    url = `/vocab/list?level=${encodeURIComponent(activeLevel)}`;
                    const response = await fetchJSON(url, withCreds({ signal: ac.signal }));
                    data = response.data;
                } else {
                    // 시험별 조회
                    url = `/exam-vocab/${activeExam}?limit=100`;
                    const response = await fetchJSON(url, withCreds({ signal: ac.signal }));
                    data = response.data?.vocabs || [];
                }
                
                const wordsArray = Array.isArray(data) ? data : [];
                setAllWords(wordsArray);
                setWords(wordsArray.slice(0, displayCount));
                setDisplayCount(100); // 새로운 데이터 로드 시 초기화
            } catch (e) {
                if (!isAbortError(e)) {
                    console.error("Failed to fetch vocab list:", e);
                    setErr(e);
                }
            } finally {
                if (!ac.signal.aborted) setLoading(false);
            }
        })();
        return () => ac.abort();
    }, [activeLevel, activeTab, activeExam, debouncedSearchTerm, authLoading]);

    // displayCount 변경 시 words 업데이트
    useEffect(() => {
        setWords(allWords.slice(0, displayCount));
    }, [allWords, displayCount]);

    useEffect(() => {
        if (!user) return;
        const ac = new AbortController();
        fetchJSON('/my-wordbook', withCreds({ signal: ac.signal }))
            .then(({ data }) => {
                if (Array.isArray(data)) {
                    setMyWordbookIds(new Set(data.map(item => item.vocabId)));
                }
            })
            .catch(e => {
                if (!isAbortError(e)) console.error("Failed to fetch my wordbook IDs", e);
            });
        return () => ac.abort();
    }, [user]);

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
                if (!isAbortError(e)) console.error("Failed to fetch mastered cards", e);
            });
        return () => ac.abort();
    }, [user]);

    // ★★★★★ 문제의 함수 수정 ★★★★★
    const handleAddWordbook = async (vocabId) => {
        if (!user) {
            alert('로그인이 필요합니다.');
            return;
        }

        console.log(`[단어장 추가 시도] Vocab ID: ${vocabId}`);

        try {
            const response = await fetchJSON('/my-wordbook/add', withCreds({
                method: 'POST',
                body: JSON.stringify({ vocabId })
            }));

            console.log('[API 응답 수신]', response);

            if (response?.meta?.created) {
                alert(`단어가 내 단어장에 새로 추가되었습니다.`);
                setMyWordbookIds(prev => new Set(prev).add(vocabId));
            } else if (response?.meta?.already) {
                alert('이미 내 단어장에 있는 단어입니다.');
                if (!myWordbookIds.has(vocabId)) {
                    setMyWordbookIds(prev => new Set(prev).add(vocabId));
                }
            } else {
                alert('요청은 성공했지만 서버 응답 형식이 예상과 다릅니다.');
                console.warn('예상치 못한 성공 응답:', response);
            }

        } catch (e) {
            // 사용자가 보게 될 가능성이 높은 에러 블록
            console.error('handleAddWordbook 함수에서 에러 발생:', e);
            alert(`[오류] 단어장 추가에 실패했습니다. 브라우저 개발자 콘솔(F12)에서 자세한 오류를 확인해주세요. 메시지: ${e.message}`);
        }
    };

    // Other functions (no changes)
    const handleToggleSelect = (vocabId) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(vocabId)) next.delete(vocabId); else next.add(vocabId);
            return next;
        });
    };

    const isAllSelected = useMemo(() => {
        if (allWords.length === 0) return false;
        return allWords.every(word => selectedIds.has(word.id));
    }, [allWords, selectedIds]);

    const handleToggleSelectAll = () => {
        if (isAllSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(allWords.map(word => word.id)));
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
        newAudio.onended = () => setPlayingAudio(null);
        newAudio.play().then(() => {
            audioRef.current = newAudio;
            setPlayingAudio({ type, id });
        }).catch(e => {
            console.error("오디오 재생 실패:", e, fullUrl);
            setPlayingAudio(null);
        });
    };

    const safeFileName = (str) => {
        if (!str) return '';
        return encodeURIComponent(str.toLowerCase().replace(/\s+/g, '_'));
    };

    const playVocabAudio = (vocab) => {
        // 목록에서는 vocab.audio, 상세에서는 vocab.dictentry.audioUrl 사용
        const targetUrl = vocab.audio || vocab.dictentry?.audioUrl;
        if (targetUrl) {
            playUrl(targetUrl, 'vocab', vocab.id);
            return;
        }
        
        // Use the same path pattern as examples
        const localAudioPath = `/${vocab.levelCEFR}/audio/${safeFileName(vocab.lemma)}.mp3`;
        playUrl(localAudioPath, 'vocab', vocab.id);
    };

    const playExampleAudio = (url, type, id) => {
        playUrl(url, type, id);
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

    const handleOpenDetail = async (vocabId) => {
        try {
            setDetailLoading(true); setDetail(null);
            const { data } = await fetchJSON(`/vocab/${vocabId}`, withCreds());
            setDetail(data);
        } catch (e) {
            if (e.status === 401) alert('로그인이 필요합니다.');
            else alert('상세 정보를 불러오지 못했습니다.');
            console.error(e);
        } finally {
            setDetailLoading(false);
        }
    };

    // src/pages/VocabList.jsx

    const handleAddSRS = async (ids) => {
        // 1) 입력 검증
        if (!user) {
            return alert('로그인이 필요합니다.');
        }
        if (!Array.isArray(ids) || ids.length === 0) {
            return alert('먼저 단어를 선택하세요.');
        }

        setPickerIds(ids);
        setPickerOpen(true);
    };

    useEffect(() => {
        return () => { if (audioRef.current) stopAudio(); };
    }, []);

    // 더 보기 버튼 핸들러
    const handleLoadMore = () => {
        setDisplayCount(prev => prev + 100);
    };

    // JSX rendering (no changes)
    return (
        <main className="container py-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h2 className="m-0">단어 학습</h2>
                
                {/* 자동 폴더 생성 버튼 - 상시 노출 */}
                <button 
                    className={`btn btn-sm ${selectedIds.size > 0 ? 'btn-success' : 'btn-outline-secondary'}`}
                    onClick={() => setAutoFolderModalOpen(true)}
                    disabled={selectedIds.size === 0}
                    title={selectedIds.size > 0 ? `선택된 단어들로 자동 폴더 생성 (${selectedIds.size}개)` : '단어를 선택한 후 자동 폴더 생성'}
                >
                    📁 자동 폴더 생성 {selectedIds.size > 0 && `(${selectedIds.size}개)`}
                </button>
            </div>

            {/* 탭 네비게이션 */}
            <div className="mb-3">
                <ul className="nav nav-tabs">
                    <li className="nav-item">
                        <button 
                            className={`nav-link ${activeTab === 'cefr' ? 'active' : ''}`}
                            onClick={() => { 
                                setActiveTab('cefr'); 
                                setSearchTerm(''); 
                                setSelectedIds(new Set()); // 선택된 단어 초기화
                                setDisplayCount(100); // 표시 개수 초기화
                            }}
                        >
                            CEFR 레벨별
                        </button>
                    </li>
                    <li className="nav-item">
                        <button 
                            className={`nav-link ${activeTab === 'exam' ? 'active' : ''}`}
                            onClick={() => { 
                                setActiveTab('exam'); 
                                setSearchTerm(''); 
                                setSelectedIds(new Set()); // 선택된 단어 초기화
                                setDisplayCount(100); // 표시 개수 초기화
                            }}
                        >
                            시험별 단어
                        </button>
                    </li>
                </ul>
            </div>

            {/* CEFR 레벨 탭 */}
            {activeTab === 'cefr' && (
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h4 className="m-0">CEFR 레벨별 단어</h4>
                    <div className="btn-group">
                        {['A1', 'A2', 'B1', 'B2', 'C1'].map(l => (
                            <button 
                                key={l} 
                                className={`btn btn-sm ${activeLevel === l ? 'btn-primary' : 'btn-outline-primary'}`} 
                                onClick={() => { 
                                    setSearchTerm(''); 
                                    setActiveLevel(l); 
                                    setSelectedIds(new Set()); // 선택된 단어 초기화
                                    setDisplayCount(100); // 표시 개수 초기화
                                }}
                            >
                                {l}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 시험별 탭 */}
            {activeTab === 'exam' && (
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h4 className="m-0">시험별 필수 단어</h4>
                    <div className="btn-group flex-wrap">
                        {examCategories.map(exam => (
                            <button 
                                key={exam.name} 
                                className={`btn btn-sm ${activeExam === exam.name ? 'btn-info' : 'btn-outline-info'}`} 
                                onClick={() => { 
                                    setSearchTerm(''); 
                                    setActiveExam(exam.name); 
                                    setSelectedIds(new Set()); // 선택된 단어 초기화
                                    setDisplayCount(100); // 표시 개수 초기화
                                }}
                                title={`${exam.description} (${exam.actualWordCount || 0}개 단어)`}
                            >
                                {exam.displayName}
                                {exam.actualWordCount > 0 && (
                                    <span className="badge bg-secondary ms-1">{exam.actualWordCount}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}


            <div className="d-flex justify-content-between align-items-center mb-3 p-2 rounded bg-light">
                <div className="form-check">
                    <input
                        className="form-check-input"
                        type="checkbox"
                        id="selectAllCheck"
                        checked={isAllSelected}
                        onChange={handleToggleSelectAll}
                        disabled={allWords.length === 0}
                    />
                    <label className="form-check-label" htmlFor="selectAllCheck">
                        {isAllSelected ? '전체 해제' : '전체 선택'} ({selectedIds.size} / {allWords.length})
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
                    placeholder="전체 레벨에서 단어 검색..."
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setDisplayCount(100); // 검색 시 표시 개수 초기화
                    }}
                />
            </div>

            {loading && <div>목록 로딩 중…</div>}
            {err && <div className="alert alert-warning">해당 레벨 목록을 불러오지 못했습니다.</div>}
            {!loading && !err && words.length === 0 && (
                <div className="text-muted">
                    {searchTerm ? '검색 결과가 없습니다.' : '이 레벨에 표시할 단어가 없습니다.'}
                </div>
            )}
            <div className="row">
                {words.map(vocab => (
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
                        masteredCards={masteredCards}
                    />
                ))}
            </div>
            
            {/* 더 보기 버튼 */}
            {!loading && !err && allWords.length > displayCount && (
                <div className="text-center mt-4">
                    <button 
                        className="btn btn-outline-primary btn-lg"
                        onClick={handleLoadMore}
                    >
                        더 보기 ({allWords.length - displayCount}개 더)
                    </button>
                </div>
            )}
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
                                    onPlayUrl={(url, type, id) => playExampleAudio(url, type, id)}
                                    onPlayVocabAudio={playVocabAudio}
                                    playingAudio={playingAudio}
                                    onAddSRS={(ids) => handleAddSRS(ids)}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
            {pickerOpen && (
                <HierarchicalFolderPickerModal
                    show={pickerOpen}
                    onClose={() => { setPickerOpen(false); setPickerIds([]); }}
                    onPick={async (folder) => {
                        const folderId = folder?.id ?? folder; // 안전 처리
                        try {
                            const res = await SrsApi.addItems(folderId, { vocabIds: pickerIds });
                            const added = res?.added ?? res?.addedCount ?? 0;
                            const dup = res?.duplicateIds?.length ?? 0;
                            alert(`추가됨 ${added}개${dup ? `, 중복 ${dup}개` : ''}`);
                            await refreshSrsIds?.();
                        } catch (e) {
                            alert('폴더에 추가 실패: ' + (e?.message || '서버 오류'));
                        } finally {
                            setPickerOpen(false); setPickerIds([]);
                        }
                    }}
                />
            )}
            
            {/* 자동 폴더 생성 모달 */}
            <AutoFolderModal
                isOpen={autoFolderModalOpen}
                onClose={() => setAutoFolderModalOpen(false)}
                selectedVocabIds={Array.from(selectedIds)}
                examCategory={activeTab === 'exam' ? activeExam : null}
                cefrLevel={activeTab === 'cefr' ? activeLevel : null}
                examCategories={examCategories}
                onSuccess={(result) => {
                    console.log('Folders created:', result);
                    setSelectedIds(new Set()); // 선택 해제
                }}
            />
        </main>
    );
}