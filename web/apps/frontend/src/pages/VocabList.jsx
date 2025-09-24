// src/pages/VocabList.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchJSON, withCreds, isAbortError, API_BASE } from '../api/client';
import Pron from '../components/Pron';
import VocabDetailModal from '../components/VocabDetailModal.jsx';
import IdiomDetailModal from '../components/IdiomDetailModal.jsx';
import { SrsApi } from '../api/srs';
import HierarchicalFolderPickerModal from '../components/HierarchicalFolderPickerModal';
import { parseAudioLocal } from '../utils/audioUtils';
import RainbowStar from '../components/RainbowStar';
import AutoFolderModal from '../components/AutoFolderModal';
import JapaneseVocabCard from '../components/JapaneseVocabCard';

// Helper functions (no changes)
const getCefrBadgeColor = (level) => {
    switch (level) {
        case 'A1': return 'bg-danger';
        case 'A2': return 'bg-warning text-dark';
        case 'B1': return 'bg-success';
        case 'B2': return 'bg-info text-dark';
        case 'C1': return 'bg-primary';
        case 'C2': return 'bg-dark';
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

// IdiomCard component
function IdiomCard({ idiom, onOpenDetail, onAddWordbook, onAddSRS, inWordbook, inSRS, onPlayAudio, enrichingId, isSelected, onToggleSelect, playingAudio }) {
    const koGloss = idiom.meaning || idiom.korean_meaning || idiom.ko_gloss || '뜻 정보 없음';
    const isEnriching = enrichingId === idiom.id;
    const isPlaying = playingAudio?.type === 'idiom' && playingAudio?.id === idiom.id;
    
    // API에서 직접 CEFR 레벨을 제공함
    const cefrLevel = idiom.levelCEFR;

    return (
        <div className="col-md-6 col-lg-4 mb-3">
            <div className={`card h-100 ${isSelected ? 'border-primary' : ''} position-relative`}>
                <div className="card-header d-flex justify-content-end p-1">
                    <input
                        className="form-check-input"
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => { e.stopPropagation(); onToggleSelect(idiom.id); }}
                        title="숙어 선택"
                    />
                </div>
                <div
                    className="card-body card-clickable pt-0"
                    onClick={() => onOpenDetail(idiom.id)}
                    style={{ cursor: 'pointer' }}
                >
                    <div className="d-flex align-items-center mb-1">
                        <h5 className="card-title mb-0 me-2" lang="en">{idiom.lemma}</h5>
                        <div className="d-flex gap-1">
                            {idiom.levelCEFR && <span className={`badge ${getCefrBadgeColor(idiom.levelCEFR)}`}>{idiom.levelCEFR}</span>}
                            <span className={`badge ${idiom.pos === 'idiom' ? 'bg-success' : 'bg-info'} fst-italic`}>
                                {idiom.pos === 'idiom' ? '숙어' : '구동사'}
                            </span>
                        </div>
                    </div>
                    <div className="card-subtitle text-muted">{koGloss}</div>
                </div>
                <div className="card-footer d-flex gap-2 justify-content-between align-items-center">
                    <div className="d-flex align-items-center">
                        <div className="btn-group">
                            <button
                                className={`btn btn-sm ${inWordbook ? 'btn-secondary' : 'btn-outline-primary'}`}
                                onClick={(e) => { e.stopPropagation(); onAddWordbook(idiom.id); }}
                                disabled={inWordbook || isEnriching}
                                title="내 단어장에 추가"
                            >
                                {inWordbook ? '단어장에 있음' : '내 단어장'}
                            </button>
                            <button
                                className={`btn btn-sm ${inSRS ? 'btn-warning' : 'btn-outline-warning'}`}
                                onClick={(e) => { e.stopPropagation(); onAddSRS([idiom.id]); }}
                                disabled={inSRS || isEnriching}
                                title="SRS 폴더에 추가"
                            >
                                {inSRS ? 'SRS에 있음' : '+SRS'}
                            </button>
                        </div>
                    </div>
                    {idiom.audio && (
                        <button
                            className="btn btn-sm btn-outline-primary rounded-circle d-flex align-items-center justify-content-center"
                            style={{ width: '32px', height: '32px' }}
                            onClick={(e) => { e.stopPropagation(); onPlayAudio(idiom); }}
                            disabled={isEnriching}
                            aria-label="숙어 오디오 재생"
                            title="숙어 듣기"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={`bi ${isPlaying ? 'bi-pause-fill' : 'bi-play-fill'}`} viewBox="0 0 16 16">
                                {isPlaying ? (
                                    <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z" />
                                ) : (
                                    <path d="M11.596 8.697l-6.363 3.692A.5.5 0 0 1 4 11.942V4.058a.5.5 0 0 1 .777-.416l6.363 3.692a.5.5 0 0 1 0 .863z" />
                                )}
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// VocabCard component (updated with RainbowStar support)
function VocabCard({ vocab, onOpenDetail, onAddWordbook, onAddSRS, inWordbook, inSRS, onPlayAudio, enrichingId, onDeleteVocab, isAdmin, isSelected, onToggleSelect, playingAudio, masteredCards }) {
    const koGloss = vocab.meaning || vocab.ko_gloss || '뜻 정보 없음';
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
                    <Pron ipa={vocab.ipa} ipaKo={vocab.ipa ? vocab.ipaKo : null} />
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
                        {/* Show play button only for idioms/phrasal verbs OR regular vocab with audio */}
                        {((vocab.source === 'idiom_migration') || (!vocab.source || vocab.source !== 'idiom_migration')) && (
                            <button
                                className="btn btn-sm btn-outline-info rounded-circle d-flex align-items-center justify-content-center ms-2"
                                style={{ width: '32px', height: '32px' }}
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    onPlayAudio(vocab);
                                }}
                                disabled={isEnriching}
                                title={vocab.source === 'idiom_migration' ? '숙어/구동사 듣기' : '음성 듣기'}
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
                        )}
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

// CEFR to folder mapping for audio paths
const cefrToFolder = {
    'A1': 'starter',
    'A2': 'elementary', 
    'B1': 'intermediate',
    'B2': 'upper',
    'C1': 'advanced',
    'C2': 'advanced'
};

export default function VocabList() {
    const { user, srsIds, loading: authLoading, refreshSrsIds } = useAuth();
    const [activeLevel, setActiveLevel] = useState('A1');
    const [activeTab, setActiveTab] = useState('cefr'); // 'cefr', 'exam', 'idiom', or 'japanese'
    const [activeExam, setActiveExam] = useState('');
    const [activeIdiomCategory, setActiveIdiomCategory] = useState('숙어'); // '숙어' or '구동사'
    const [activeJlptLevel, setActiveJlptLevel] = useState('N5'); // JLPT level
    const [examCategories, setExamCategories] = useState([]);
    const [words, setWords] = useState([]);
    const [allWords, setAllWords] = useState([]); // 전체 단어 리스트
    const [displayCount, setDisplayCount] = useState(100); // 현재 표시되는 단어 개수
    const [currentPage, setCurrentPage] = useState(1); // 현재 페이지
    const [hasNextPage, setHasNextPage] = useState(false); // 다음 페이지 존재 여부
    const [totalCount, setTotalCount] = useState(0); // 전체 단어 수
    const [myWordbookIds, setMyWordbookIds] = useState(new Set());
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pendingVocabIds, setPendingVocabIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const [detail, setDetail] = useState(null);
    const [detailType, setDetailType] = useState('vocab'); // 'vocab' or 'idiom'
    const [detailLoading, setDetailLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const audioRef = useRef(null);
    const [playingAudio, setPlayingAudio] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [audioFilesCache, setAudioFilesCache] = useState(new Map()); // 레벨별 오디오 파일 캐시
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
                const categories = Array.isArray(data) ? data : [];
                setExamCategories(categories);
                // 첫 번째 카테고리를 기본으로 설정
                if (categories.length > 0 && !activeExam) {
                    setActiveExam(categories[0].name);
                }
            } catch (e) {
                if (!isAbortError(e)) {
                    console.error('Failed to load exam categories:', e);
                    setExamCategories([]);
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
                
                if (activeTab === 'cefr') {
                    // CEFR 레벨별 조회 (검색 포함)
                    if (debouncedSearchTerm) {
                        url = `/vocab/list?level=${encodeURIComponent(activeLevel)}&q=${encodeURIComponent(debouncedSearchTerm)}`;
                    } else {
                        url = `/vocab/list?level=${encodeURIComponent(activeLevel)}`;
                    }
                    const response = await fetchJSON(url, withCreds({ signal: ac.signal }));
                    data = response.data;
                    // CEFR 탭에서도 totalCount 설정
                    setTotalCount(Array.isArray(data) ? data.length : 0);
                } else if (activeTab === 'idiom') {
                    // 숙어·구동사 조회 - 페이징 지원으로 수정
                    const posType = activeIdiomCategory === '숙어' ? 'idiom' : 'phrasal verb';
                    url = `/api/simple-vocab?pos=${encodeURIComponent(posType)}&search=${encodeURIComponent(debouncedSearchTerm)}&limit=100`;
                    console.log('🔍 [IDIOM UNIFIED] Calling API:', url);
                    const response = await fetchJSON(url, { signal: ac.signal });
                    console.log('📥 [IDIOM UNIFIED] API Response:', response);
                    data = response.data || [];
                    console.log('📋 [IDIOM UNIFIED] Data length:', Array.isArray(data) ? data.length : 'Not array');
                    console.log('📊 [IDIOM UNIFIED] Total count from API:', response.total);

                    setWords(data.slice(0, displayCount));
                    setAllWords(data);
                    setTotalCount(response.total || 0);
                    setDisplayCount(100); // 초기 100개 표시
                    setHasNextPage(data.length >= 100); // 100개 이상이면 다음 페이지 있음
                    return; // 숙어 탭에서는 여기서 종료
                } else if (activeTab === 'japanese') {
                    // 일본어 JLPT 레벨별 조회 (검색 포함)
                    if (debouncedSearchTerm) {
                        url = `/vocab/japanese-list?level=${encodeURIComponent(activeJlptLevel)}&q=${encodeURIComponent(debouncedSearchTerm)}`;
                    } else {
                        url = `/vocab/japanese-list?level=${encodeURIComponent(activeJlptLevel)}`;
                    }
                    const response = await fetchJSON(url, withCreds({ signal: ac.signal }));
                    data = response.data || [];

                    setWords(data.slice(0, displayCount));
                    setAllWords(data);
                    setTotalCount(Array.isArray(data) ? data.length : 0);
                    setDisplayCount(100); // 새로운 데이터 로드 시 초기화
                    return; // 일본어 탭에서는 여기서 종료
                } else {
                    // 시험별 조회
                    if (!activeExam) {
                        data = []; // 선택된 시험이 없으면 빈 배열
                        setTotalCount(0);
                        setHasNextPage(false);
                    } else {
                        url = `/exam-vocab/${activeExam}?page=1&limit=100${debouncedSearchTerm ? `&search=${encodeURIComponent(debouncedSearchTerm)}` : ''}`;
                        const response = await fetchJSON(url, withCreds({ signal: ac.signal }));
                        data = response.data?.vocabs || [];
                        setTotalCount(response.data?.pagination?.totalCount || 0);
                        setHasNextPage(response.data?.pagination?.hasNext || false);
                        setCurrentPage(1);
                    }
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
    }, [activeLevel, activeTab, activeExam, activeIdiomCategory, activeJlptLevel, debouncedSearchTerm, authLoading]);

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

    // 숙어/구동사는 이제 일반 vocab으로 통합되어 별도 조회 불필요

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
        if (activeTab === 'exam') {
            // 시험별 탭에서는 실제 로드 가능한 단어 수와 비교
            // API에서 전체 단어를 가져왔을 때의 실제 개수와 비교
            const actualMaxCount = Math.min(totalCount, allWords.length || totalCount);
            return selectedIds.size > 0 && selectedIds.size >= actualMaxCount - 1; // 1개 차이 허용
        } else if (activeTab === 'idiom') {
            // 숙어 탭에서는 현재 표시된 단어들과 비교
            if (words.length === 0) return false;
            return words.every(word => selectedIds.has(word.id));
        } else {
            // CEFR 탭에서는 현재 표시된 단어들과 비교
            if (words.length === 0) return false;
            return words.every(word => selectedIds.has(word.id));
        }
    }, [words, selectedIds, activeTab, totalCount, allWords.length]);

    const handleToggleSelectAll = async () => {
        if (activeTab === 'exam' && !isAllSelected) {
            // 시험별 탭에서 전체 선택: 서버에서 모든 단어 ID 가져오기
            try {
                setLoading(true);
                const response = await fetchJSON(`/exam-vocab/${activeExam}?limit=${totalCount}${debouncedSearchTerm ? `&search=${encodeURIComponent(debouncedSearchTerm)}` : ''}`, withCreds());
                const allVocabIds = response.data?.vocabs?.map(v => v.id) || [];
                setSelectedIds(new Set(allVocabIds));
            } catch (error) {
                console.error('Failed to select all words:', error);
                // 실패 시 현재 페이지 단어들만 선택
                const newSelected = new Set(selectedIds);
                words.forEach(word => newSelected.add(word.id));
                setSelectedIds(newSelected);
            } finally {
                setLoading(false);
            }
        } else if (activeTab === 'cefr' && !isAllSelected) {
            // CEFR 탭에서 전체 선택: 서버에서 모든 단어 ID 가져오기
            try {
                setLoading(true);
                const response = await fetchJSON(`/vocab/list?level=${encodeURIComponent(activeLevel)}`, withCreds());
                const allVocabData = response.data || [];
                const allVocabIds = allVocabData.map(v => v.id) || [];
                setSelectedIds(new Set(allVocabIds));
            } catch (error) {
                console.error('Failed to select all words:', error);
                // 실패 시 현재 페이지 단어들만 선택
                const newSelected = new Set(selectedIds);
                words.forEach(word => newSelected.add(word.id));
                setSelectedIds(newSelected);
            } finally {
                setLoading(false);
            }
        } else if (activeTab === 'idiom' && !isAllSelected) {
            // 숙어 탭에서 전체 선택: 서버에서 모든 숙어 ID 가져오기
            try {
                setLoading(true);
                const posType = activeIdiomCategory === '숙어' ? 'idiom' : 'phrasal verb';
                const response = await fetchJSON(`/api/simple-vocab?pos=${encodeURIComponent(posType)}&search=&limit=1000`);
                const allIdiomIds = response.data?.map(item => item.id) || [];
                console.log(`🔍 [IDIOM SELECT ALL] Found ${allIdiomIds.length} ${posType}s to select`);
                setSelectedIds(new Set(allIdiomIds));
            } catch (error) {
                console.error('Failed to select all idioms:', error);
                // 실패 시 현재 페이지 단어들만 선택
                const allWordIds = words.map(word => word.id);
                setSelectedIds(new Set(allWordIds));
            } finally {
                setLoading(false);
            }
        } else if (activeTab === 'japanese' && !isAllSelected) {
            // 일본어 탭에서 전체 선택: 서버에서 모든 일본어 단어 ID 가져오기
            try {
                setLoading(true);
                const response = await fetchJSON(`/vocab/japanese-list?level=${encodeURIComponent(activeJlptLevel)}`, withCreds());
                if (response && Array.isArray(response.data)) {
                    const allIds = response.data.map(vocab => vocab.id);
                    console.log(`🔍 [JAPANESE SELECT ALL] Found ${allIds.length} Japanese vocabs to select`);
                    setSelectedIds(new Set(allIds));
                }
            } catch (error) {
                console.error('Failed to fetch all Japanese vocab IDs:', error);
                // 실패 시 현재 페이지 단어들만 선택
                const allWordIds = words.map(word => word.id);
                setSelectedIds(new Set(allWordIds));
            } finally {
                setLoading(false);
            }
        } else {
            // 선택 해제의 경우
            setSelectedIds(new Set());
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

        // Special mappings for specific problematic paths
        const specialMappings = {
            'advanced/strip-remove-clothes/a-layer/example.mp3': 'advanced/strip-remove-clothesa-layer/example.mp3',
            'intermediate/stick-push-into/attach/example.mp3': 'intermediate/stick-push-intoattach/example.mp3',
            'advanced/strip-remove-clothes/a-layer/us.mp3': 'advanced/strip-remove-clothesa-layer/us.mp3',
            'intermediate/stick-push-into/attach/us.mp3': 'intermediate/stick-push-intoattach/us.mp3',
            'elementary/light-from-the-sun/a-lamp/example.mp3': 'elementary/light-from-the-suna-lamp/example.mp3',
            'elementary/light-from-the-sun/a-lamp/word.mp3': 'elementary/light-from-the-suna-lamp/word.mp3',
            'elementary/light-from-the-sun/a-lamp/gloss.mp3': 'elementary/light-from-the-suna-lamp/gloss.mp3',
            // Also handle paths with spaces instead of hyphens
            'elementary/light-from the sun/a lamp/example.mp3': 'elementary/light-from-the-suna-lamp/example.mp3',
            'elementary/light-from the sun/a lamp/word.mp3': 'elementary/light-from-the-suna-lamp/word.mp3',
            'elementary/light-from the sun/a lamp/gloss.mp3': 'elementary/light-from-the-suna-lamp/gloss.mp3',
            'intermediate/plus-about adding/example.mp3': 'intermediate/plus-aboutadding/example.mp3',
            'intermediate/plus-about adding/word.mp3': 'intermediate/plus-aboutadding/word.mp3',
            'intermediate/plus-about adding/gloss.mp3': 'intermediate/plus-aboutadding/gloss.mp3',
            'elementary/rest-remaining part/example.mp3': 'elementary/rest-remaining-part/example.mp3',
            'elementary/rest-remaining part/word.mp3': 'elementary/rest-remaining-part/word.mp3',
            'elementary/rest-remaining part/gloss.mp3': 'elementary/rest-remaining-part/gloss.mp3',
            'elementary/light-not heavy/example.mp3': 'elementary/light-not-heavy/example.mp3',
            'elementary/light-not heavy/word.mp3': 'elementary/light-not-heavy/word.mp3',
            'elementary/light-not heavy/gloss.mp3': 'elementary/light-not-heavy/gloss.mp3',
            'intermediate/lie-tell a lie/example.mp3': 'intermediate/lie-tell-a-lie/example.mp3',
            'intermediate/lie-tell a lie/word.mp3': 'intermediate/lie-tell-a-lie/word.mp3',
            'intermediate/lie-tell a lie/gloss.mp3': 'intermediate/lie-tell-a-lie/gloss.mp3',
            'intermediate/like-find-sb/sth-pleasant/example.mp3': 'intermediate/like-find-sbsth-pleasant/example.mp3',
            'intermediate/like-find-sb/sth-pleasant/word.mp3': 'intermediate/like-find-sbsth-pleasant/word.mp3',
            'intermediate/like-find-sb/sth-pleasant/gloss.mp3': 'intermediate/like-find-sbsth-pleasant/gloss.mp3',
            'elementary/rest-sleep/relax/example.mp3': 'elementary/rest-sleeprelax/example.mp3',
            'elementary/rest-sleep/relax/word.mp3': 'elementary/rest-sleeprelax/word.mp3',
            'elementary/rest-sleep/relax/gloss.mp3': 'elementary/rest-sleeprelax/gloss.mp3'
        };

        // GCS URL인 경우 그대로 사용 (변환하지 않음)
        if (url.startsWith('https://')) {
            console.log('[AUDIO DEBUG] Using direct GCS URL:', url);
            const newAudio = new Audio(url);
            newAudio.onended = () => setPlayingAudio(null);
            newAudio.play().then(() => {
                console.log('🎵 Playing audio from GCS:', url);
                setPlayingAudio({ type, id, audio: newAudio });
            }).catch(err => {
                console.error('오디오 재생 실패:', err, url);
                setPlayingAudio(null);
            });
            return;
        }

        // Apply special mappings first
        let mappedUrl = url;
        if (url.startsWith('/')) {
            const pathWithoutSlash = url.substring(1);
            if (specialMappings[pathWithoutSlash]) {
                mappedUrl = '/' + specialMappings[pathWithoutSlash];
                console.log('[AUDIO DEBUG] Applied special mapping:', url, '->', mappedUrl);
            } else {
                // Apply general pattern for all paths with spaces
                // Pattern: level/word-phrase with spaces/file.mp3 -> level/word-phrase-with-spaces/file.mp3
                const parts = pathWithoutSlash.split('/');
                if (parts.length === 3) {
                    const [level, wordPart, file] = parts;
                    // Replace all spaces with hyphens in the word part
                    const fixedWordPart = wordPart.replace(/\s+/g, '-');
                    if (fixedWordPart !== wordPart) {
                        mappedUrl = `/${level}/${fixedWordPart}/${file}`;
                        console.log('[AUDIO DEBUG] Applied general space-to-hyphen mapping:', url, '->', mappedUrl);
                    }
                }
            }
        }

        // URL 경로의 각 세그먼트를 개별적으로 인코딩
        let encodedUrl = mappedUrl;

        // If URL doesn't start with '/', add it
        if (!mappedUrl.startsWith('/')) {
            mappedUrl = '/' + mappedUrl;
        }

        const pathSegments = mappedUrl.split('/').filter(segment => segment);
        console.log('[AUDIO DEBUG] Original URL:', url);
        console.log('[AUDIO DEBUG] Mapped URL:', mappedUrl);
        console.log('[AUDIO DEBUG] Path segments:', pathSegments);
        const encodedSegments = pathSegments.map(segment => encodeURIComponent(segment));
        console.log('[AUDIO DEBUG] Encoded segments:', encodedSegments);
        encodedUrl = '/' + encodedSegments.join('/');
        console.log('[AUDIO DEBUG] Final encoded URL:', encodedUrl);

        const fullUrl = `${API_BASE}${encodedUrl}`;
        console.log('[AUDIO DEBUG] Full URL:', fullUrl);
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
        // Convert to match actual folder structure with all hyphens:
        // "bank (money)" -> "bank-money"
        // "close (near in distance)" -> "close-near-in-distance"
        // "light (from the sun/a lamp)" -> "light-from-the-sun-a-lamp"
        return str.toLowerCase()
            .replace(/\s*\([^)]*\)/g, (match) => {
                // Remove parentheses and process content
                const content = match.replace(/[()]/g, '').trim();
                if (!content) return '';

                // Replace slashes and special chars with spaces first, then convert all spaces to hyphens
                const cleaned = content.replace(/[\/\\]/g, ' ').replace(/\s+/g, '-');
                return '-' + cleaned;
            })
            .replace(/'/g, '')
            .replace(/\s+/g, '-'); // Convert all remaining spaces to hyphens
    };

    // String similarity function (Levenshtein distance-based)
    function stringSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;
        
        const s1 = str1.toLowerCase();
        const s2 = str2.toLowerCase();
        
        if (s1 === s2) return 1;
        
        const len1 = s1.length;
        const len2 = s2.length;
        
        if (len1 === 0) return len2 === 0 ? 1 : 0;
        if (len2 === 0) return 0;
        
        const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
        
        for (let i = 0; i <= len1; i++) matrix[0][i] = i;
        for (let j = 0; j <= len2; j++) matrix[j][0] = j;
        
        for (let j = 1; j <= len2; j++) {
            for (let i = 1; i <= len1; i++) {
                const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j - 1][i] + 1,
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i - 1] + cost
                );
            }
        }
        
        const maxLen = Math.max(len1, len2);
        return (maxLen - matrix[len2][len1]) / maxLen;
    }

    // Get best matching audio file name using similarity
    function getBestMatchingFileName(lemma, pos, availableFiles) {
        console.log('🔍 getBestMatchingFileName called with:', { lemma, pos, availableFilesCount: availableFiles?.length });
        
        if (!lemma) return '';
        
        const lemmaLower = lemma.toLowerCase();
        console.log('🔍 lemmaLower:', lemmaLower);
        
        // For words without parentheses, use simple encoding
        if (!lemma.includes('(')) {
            console.log('🔍 No parentheses, using safeFileName');
            return safeFileName(lemma);
        }
        
        console.log('🔍 Has parentheses, checking known mappings...');
        
        // Known mappings for parentheses words based on ACTUAL A2 files
        const knownMappings = {
            // Correct A2 file mappings
            'rock (music)': 'rock (music)',
            'rock (stone)': 'rock (stone)(n)',
            'light (not heavy)': 'light (not heavy)(adj)',
            'light (from the sun/a lamp)': 'light (from the sun)',
            'last (taking time)': 'last (taking time)(v)',
            'last (final)': 'last (final)',
            'mine (belongs to me)': 'mine (belongs to me)',
            'bear (animal)': 'bear (animal)',
            'bank (money)': 'bank (money)', // A1에서도 매칭되도록 추가
            'race (competition)': 'race (competition)',
            'rest (remaining part)': 'rest (remaining part)',
            'rest (sleep/relax)': 'rest (sleeprelax)(unkown)', // Note: actual file has typo "unkown"
            'second (next after the first)': 'second (next after the first)',
            'strip (remove clothes/a layer)': 'strip-remove-clothesa-layer', // 복잡한 C1 케이스
            'strip (long narrow piece)': 'strip-long-narrow-piece', // C1 케이스
            
            // Additional mappings for common patterns
            'used to': 'used to',
            'have': 'have',
            'may': 'may',
            'might': 'might',
            'either': 'either',
            'neither': 'neither'
        };
        
        // Check known mappings first
        if (knownMappings[lemmaLower]) {
            console.log('🔍 Found in known mappings:', knownMappings[lemmaLower]);
            return knownMappings[lemmaLower];
        }
        
        // Handle slash-separated words in parentheses
        if (lemmaLower.includes('/')) {
            console.log('🔍 Contains slash, checking without slash...');
            const withoutSlash = lemmaLower.replace(/\//g, '');
            console.log('🔍 Without slash:', withoutSlash);
            if (knownMappings[withoutSlash]) {
                console.log('🔍 Found mapping without slash:', knownMappings[withoutSlash]);
                return knownMappings[withoutSlash];
            }
        }
        
        console.log('🔍 Not in known mappings, checking available files...');
        console.log('🔍 Available files:', availableFiles);
        
        // If we have available files, find the best match
        if (availableFiles && availableFiles.length > 0) {
            let bestMatch = '';
            let bestScore = 0;
            
            // Extract base names from files (remove .mp3 extension)
            const fileNames = availableFiles.map(file => 
                file.replace('.mp3', '').toLowerCase()
            );
            
            console.log('🔍 File names (without .mp3):', fileNames);
            
            // Try to find the best matching file
            for (const fileName of fileNames) {
                // Direct match
                if (fileName === lemmaLower) {
                    console.log('🔍 Direct match found:', fileName);
                    return fileName;
                }
                
                // Check if filename starts with the lemma base word
                const baseWord = lemmaLower.split(' ')[0];
                console.log('🔍 Checking base word:', baseWord, 'against file:', fileName);
                
                // More flexible matching for parenthetical words
                if (fileName.startsWith(baseWord)) {
                    const score = stringSimilarity(lemmaLower, fileName);
                    console.log('🔍 Similarity score:', score, 'for file:', fileName);
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = fileName;
                        console.log('🔍 New best match:', bestMatch, 'with score:', bestScore);
                    }
                }
                
                // Also check if the base word appears anywhere in the filename (for better matching)
                else if (fileName.includes(baseWord)) {
                    const score = stringSimilarity(lemmaLower, fileName) * 0.8; // Slightly lower priority
                    console.log('🔍 Contains base word. Adjusted similarity score:', score, 'for file:', fileName);
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = fileName;
                        console.log('🔍 New best match (contains):', bestMatch, 'with score:', bestScore);
                    }
                }
            }
            
            console.log('🔍 Final best match:', bestMatch, 'with score:', bestScore);
            
            // If we found a good match (>0.4 similarity), use it (lowered threshold)
            if (bestMatch && bestScore > 0.4) {
                console.log('🔍 Using best match (score > 0.4):', bestMatch);
                return bestMatch;
            }
        }
        
        // Fallback: try with abbreviated pos
        const posAbbrev = {
            'noun': 'n',
            'verb': 'v', 
            'adjective': 'adj',
            'adverb': 'adv',
            'preposition': 'prep'
        };
        
        const shortPos = posAbbrev[pos?.toLowerCase()] || pos?.toLowerCase() || 'unknown';
        const fallback = `${lemmaLower}(${shortPos})`;
        console.log('🔍 Using fallback:', fallback);
        return fallback;
    }

    // 오디오 파일 목록을 서버에서 가져오는 함수
    const fetchAudioFiles = async (level) => {
        if (audioFilesCache.has(level)) {
            return audioFilesCache.get(level);
        }
        
        try {
            const response = await fetch(`${API_BASE}/audio-files/${level}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch audio files for ${level}`);
            }
            const data = await response.json();
            const files = data.files || [];
            
            // 캐시에 저장
            setAudioFilesCache(prev => new Map(prev).set(level, files));
            return files;
        } catch (error) {
            console.error(`Error fetching audio files for ${level}:`, error);
            return [];
        }
    };

    // Smart file name matching based on known patterns (same as VocabDetailModal)
    async function getSmartAudioFileName(lemma, pos, level) {
        // 특수문자가 포함된 lemma의 경우 정리된 파일명으로 변환
        if (lemma && (lemma.includes(' ') || lemma.includes('-') || lemma.includes("'"))) {
            // Convert to match actual folder structure:
            // "bank (money)" -> "bank-money" 
            // "lie (tell a lie)" -> "lie-tell-a-lie"
            // "light (not heavy)" -> "light-not-heavy"
            // "light (from the sun/a lamp)" -> "light-from-the-suna-lamp"
            let cleanLemma = lemma.toLowerCase()
                .replace(/\s*\([^)]*\)/g, (match) => {
                    // Remove parentheses and process content
                    const content = match.replace(/[()]/g, '').trim();
                    if (!content) return '';
                    
                    // Replace slashes and special chars properly to match actual folder structure
                    // "from the sun/a lamp" → "from-the-suna-lamp"
                    const cleaned = content.replace(/[\/\\]/g, '').replace(/\s+/g, '-').trim();
                    return cleaned ? '-' + cleaned : '';
                })
                .replace(/'/g, '');
            
            // Ensure ALL remaining spaces are converted to hyphens and clean up multiple hyphens
            cleanLemma = cleanLemma.replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
            
            console.log('🔧 [DEBUG] getSmartAudioFileName cleaned lemma:', lemma, '->', cleanLemma);
            return cleanLemma;
        }
        
        // 실제 파일 목록을 가져와서 매칭 (API 실패시 하드코딩된 목록 사용)
        let availableFiles = await fetchAudioFiles(level);
        
        // API 실패시 괄호 포함 단어들의 하드코딩된 목록 사용 (모든 레벨에서 동일한 매칭)
        if (availableFiles.length === 0) {
            console.log(`🔍 Using hardcoded file list for ${level}`);
            availableFiles = [
                // Light variations (ACTUAL A2 files - 모든 레벨에서 동일 매칭)
                'light (from the sun).mp3',
                'light (not heavy)(adj).mp3',
                
                // Rest variations (ACTUAL A2 files)
                'rest (remaining part).mp3',
                'rest (sleeprelax)(unkown).mp3', // Note: actual file has typo
                
                // Mine variations (ACTUAL A2 files)
                'mine (belongs to me).mp3',
                
                // Rock variations (ACTUAL A2 files)
                'rock (music).mp3',
                'rock (stone)(n).mp3',
                
                // Last variations (ACTUAL A2 files)
                'last (final).mp3',
                'last (taking time)(v).mp3',
                
                // Other parenthetical words (ACTUAL A2 files - A1에서도 동일 매칭)
                'bear (animal).mp3',
                'race (competition).mp3',
                'second (next after the first).mp3',
                'bank (money).mp3', // A1에서도 매칭되도록 추가
                'strip-remove-clothesa-layer.mp3', // C1 복잡한 경우
                'strip-long-narrow-piece.mp3', // C1 케이스
                
                // Additional common words (ACTUAL A2 files)
                'used to.mp3',
                'have.mp3',
                'may.mp3',
                'might.mp3',
                'either.mp3',
                'neither.mp3',
                
                // Basic words (for testing)
                'book.mp3',
                'good.mp3',
                'water.mp3',
                'house.mp3'
            ];
        }
        
        return getBestMatchingFileName(lemma, pos, availableFiles);
    }

    // Gloss 오디오 재생 함수 (상세 보기 상단 버튼용)
    const playGlossAudio = async (vocab) => {
        console.log('🔍 [DEBUG] playGlossAudio called with vocab:', vocab.lemma);
        
        // CEFR 레벨을 실제 폴더명으로 매핑
        const cefrToFolder = {
            'A1': 'starter',
            'A2': 'elementary', 
            'B1': 'intermediate',
            'B2': 'upper',
            'C1': 'advanced',
            'C2': 'advanced'
        };
        
        // 1. GCS 오디오 경로 사용 (최우선) - utils 함수 사용
        const audioData = parseAudioLocal(vocab.dictentry?.audioLocal);
        
        // 경로 수정: bank-money -> bank (money) 등 괄호 포함 단어 처리
        let glossAudioPath = audioData?.gloss;
        
        if (glossAudioPath && (glossAudioPath.includes('-') || glossAudioPath.includes(' '))) {
            const pathParts = glossAudioPath.split('/');
            if (pathParts.length >= 3) {
                const folderName = pathParts[1];
                const fileName = pathParts[2];
                
                const pathMappings = {
                    'bank-money': 'bank-money',
                    'rock-music': 'rock (music)',
                    'rock-stone': 'rock (stone)',
                    'light-not-heavy': 'light-not-heavy',
                    'light-from-the-sun': 'light-from-the-suna-lamp',
                    'light-from-the-suna-lamp': 'light-from-the-suna-lamp',
                    'close-near-in-distance': 'close-near-in-distance',
                    'last-taking time': 'last (taking time)',
                    'last-taking-time': 'last (taking time)',
                    'light-not-heavy': 'light-not-heavy',
                    'rest-remaining part': 'rest (remaining part)',
                    'like-find sb/sth pleasant': 'like (find sbsth pleasant)',
                    'strip-remove clothes/a layer': 'strip-remove-clothesa-layer',
                    'last-final': 'last (final)',
                    'mine-belongs-to-me': 'mine (belongs to me)',
                    'bear-animal': 'bear (animal)',
                    'race-competition': 'race (competition)',
                    'rest-remaining-part': 'rest (remaining part)',
                    'rest-sleeprelax': 'rest (sleep/relax)'
                };
                
                if (pathMappings[folderName]) {
                    glossAudioPath = `${pathParts[0]}/${pathMappings[folderName]}/${fileName}`;
                    console.log('🔧 [DEBUG] Gloss path corrected to', glossAudioPath);
                }
            }
        }
        
        if (glossAudioPath) {
            const absolutePath = glossAudioPath.startsWith('/') ? glossAudioPath : `/${glossAudioPath}`;
            console.log('✅ Playing GLOSS audio from cefr_vocabs:', absolutePath);
            playUrl(absolutePath, 'vocab', vocab.id);
            return;
        }
        
        // 폴백: 로컬 오디오 사용 (gloss.mp3)
        const folderName = cefrToFolder[vocab.levelCEFR] || 'starter';
        const audioFileName = await getSmartAudioFileName(vocab.lemma, vocab.pos, vocab.levelCEFR);
        const localAudioPath = `/${folderName}/${audioFileName.trim()}/gloss.mp3`;
        console.log('⚠️ Playing GLOSS audio from local path:', localAudioPath);
        playUrl(localAudioPath, 'vocab', vocab.id);
    };

    const playVocabAudio = async (vocab) => {
        console.log('🔍 [DEBUG] playVocabAudio vocab.source:', vocab.source, 'lemma:', vocab.lemma);

        // Check if this is a Japanese word first - 여러 조건으로 감지
        if (vocab.source === 'jlpt_vocabs' || vocab.source === 'jlpt' || vocab.source === 'jlpt_total' ||
            vocab.levelJLPT ||
            (vocab.dictentry?.audioLocal && vocab.dictentry.audioLocal.includes('jlpt/'))) {
            console.log('🔍 [DEBUG] Detected Japanese word:', vocab.lemma, 'levelJLPT:', vocab.levelJLPT);

            // Try to parse audioLocal for Japanese words using utils function
            const audioData = parseAudioLocal(vocab.dictentry?.audioLocal);
            if (audioData?.word) {
                console.log('✅ Playing Japanese WORD audio from GCS:', audioData.word);
                playUrl(audioData.word, 'vocab', vocab.id);
                return;
            }

            // Fallback to JLPT folder structure
            const jlptLevel = (vocab.levelJLPT || 'N5').toLowerCase();
            // Use romaji for the folder name instead of Japanese characters
            // Replace spaces with underscores for folder names (e.g., "issho ni" -> "issho_ni")
            const folderName = vocab.romaji
                ? vocab.romaji.toLowerCase().replace(/\s+/g, '_')
                : vocab.lemma.toLowerCase().replace(/\s+/g, '_');
            const audioPath = `/jlpt/${jlptLevel}/${folderName}/word.mp3`;
            console.log('⚠️ Playing Japanese audio from JLPT folder:', audioPath);
            console.log('Using romaji/folder name:', folderName, 'from lemma:', vocab.lemma);
            playUrl(audioPath, 'vocab', vocab.id);
            return;
        }

        // Check if this is an idiom/phrasal verb
        if (vocab.source === 'idiom_migration' || vocab.source === 'phrasal_verb_migration' || vocab.pos === 'idiom' || vocab.pos === 'phrasal_verb' || (vocab.lemma && (vocab.lemma.includes(' ') || vocab.lemma.includes('-') || vocab.lemma.includes("'")))) {
            // 숙어/구동사의 경우 실제 데이터베이스의 audioUrl을 사용
            const audioUrl = vocab.audioUrl || vocab.dictentry?.audioUrl || vocab.audio;
            if (audioUrl) {
                // audioUrl을 그대로 사용 (예: "idiom/a_stones_throw.mp3")
                const audioPath = `/${audioUrl}`;
                console.log('🔍 [playVocabAudio] Using database audio for idiom/phrasal:', vocab.lemma, '->', audioPath);
                playUrl(audioPath, 'vocab', vocab.id);
                return;
            } else {
                // Fallback: Use unified folder structure based on CEFR level
                let cleanLemma = vocab.lemma.toLowerCase()
                    .replace(/\s*\([^)]*\)/g, (match) => {
                        // Remove parentheses and process content
                        const content = match.replace(/[()]/g, '').trim();
                        if (!content) return '';

                        // Replace slashes and special chars properly to match actual folder structure
                        // "from the sun/a lamp" → "from-the-suna-lamp"
                        const cleaned = content.replace(/[\/\\]/g, '').replace(/\s+/g, '-').trim();
                        return cleaned ? '-' + cleaned : '';
                    })
                    .replace(/'/g, '');

                // Ensure ALL remaining spaces are converted to hyphens and clean up multiple hyphens
                cleanLemma = cleanLemma.replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

                // Use unified folder structure based on CEFR level instead of separate idiom/phrasal_verb folders
                const folderName = cefrToFolder[vocab.levelCEFR] || 'starter';
                const audioFileName = await getSmartAudioFileName(vocab.lemma, vocab.pos, vocab.levelCEFR);
                const audioPath = `/${folderName}/${audioFileName.trim()}/word.mp3`;
                console.log('🔍 [playVocabAudio] Fallback to folder structure:', vocab.lemma, '->', folderName, 'audioPath:', audioPath);
                playUrl(audioPath, 'vocab', vocab.id);
                return;
            }
        }
        
        // 단어 자체 발음: cefr_vocabs.json의 audio.word 경로 우선 사용
        console.log('🔍 [DEBUG] playVocabAudio called with vocab:', vocab.lemma);
        console.log('🔍 [DEBUG] vocab.dictentry:', vocab.dictentry);
        console.log('🔍 [DEBUG] vocab.dictentry?.audioLocal:', vocab.dictentry?.audioLocal);
        
        // 1. GCS 오디오 경로 사용 (최우선) - utils 함수 사용
        const audioData = parseAudioLocal(vocab.dictentry?.audioLocal);
        // 단어 발음: GCS URL 직접 사용
        const wordAudioPath = audioData?.word;

        if (wordAudioPath) {
            console.log('✅ Playing WORD audio from GCS:', wordAudioPath);
            playUrl(wordAudioPath, 'vocab', vocab.id);
            return;
        }

        // 백업 로직 (이제 필요 시에만 사용)
        if (false && wordAudioPath && (wordAudioPath.includes('-') || wordAudioPath.includes(' '))) {
            console.log('🔍 [DEBUG] Original wordAudioPath:', wordAudioPath);
            
            // 특별한 경우들을 먼저 처리
            const specialMappings = {
                'advanced/strip-remove clothes/a layer/word.mp3': 'advanced/strip-remove-clothesa-layer/word.mp3',
                'advanced/strip-remove clothes/a layer/gloss.mp3': 'advanced/strip-remove-clothesa-layer/gloss.mp3',
                'advanced/strip-remove clothes/a layer/example.mp3': 'advanced/strip-remove-clothesa-layer/example.mp3',
                'advanced/strip-long narrow piece/word.mp3': 'advanced/strip-long-narrow-piece/word.mp3',
                'advanced/strip-long narrow piece/gloss.mp3': 'advanced/strip-long-narrow-piece/gloss.mp3',
                'advanced/strip-long narrow piece/example.mp3': 'advanced/strip-long-narrow-piece/example.mp3',
            };
            
            if (specialMappings[wordAudioPath]) {
                wordAudioPath = specialMappings[wordAudioPath];
                console.log('🔧 [DEBUG] Special mapping applied:', wordAudioPath);
            } else if (wordAudioPath.includes('gloss.mp3') && (wordAudioPath.includes('idiom/') || wordAudioPath.includes('phrasal/') || wordAudioPath.includes('phrasal_verb/'))) {
                // 숙어 및 구동사의 gloss.mp3 파일에 대해 하이픈을 언더스코어로 변환
                wordAudioPath = wordAudioPath.replace(/-/g, '_');
                console.log('🔧 [DEBUG] Hyphen to underscore conversion for gloss.mp3:', wordAudioPath);
            } else {
                // 일반적인 경로 변환
                const pathParts = wordAudioPath.split('/');
                if (pathParts.length >= 3) {
                    const folderName = pathParts[1];
                    const fileName = pathParts[2];
                    
                    const pathMappings = {
                        'bank-money': 'bank-money',
                        'rock-music': 'rock (music)',
                        'rock-stone': 'rock (stone)',
                        'light-not-heavy': 'light-not-heavy',
                        'light-from-the-sun': 'light-from-the-suna-lamp',
                        'light-from-the-suna-lamp': 'light-from-the-suna-lamp',
                        'close-near-in-distance': 'close-near-in-distance',
                        'last-taking time': 'last (taking time)',
                        'last-taking-time': 'last (taking time)',
                        'light-not-heavy': 'light-not-heavy',
                        'rest-remaining part': 'rest (remaining part)',
                        'like-find sb/sth pleasant': 'like (find sbsth pleasant)',
                        'last-final': 'last (final)',
                        'mine-belongs-to-me': 'mine (belongs to me)',
                        'bear-animal': 'bear (animal)',
                        'race-competition': 'race (competition)',
                        'rest-remaining-part': 'rest (remaining part)',
                        'rest-sleeprelax': 'rest (sleep/relax)'
                    };
                    
                    console.log('🔍 [DEBUG] Checking folderName for mapping:', folderName);
                    if (pathMappings[folderName]) {
                        wordAudioPath = `${pathParts[0]}/${pathMappings[folderName]}/${fileName}`;
                        console.log('🔧 [DEBUG] Path corrected from', audioData.word, 'to', wordAudioPath);
                    } else {
                        console.log('⚠️ [DEBUG] No mapping found for folderName:', folderName);
                    }
                }
            }
        }
        
        if (wordAudioPath) {
            // wordAudioPath에 이미 starter/a/word.mp3 형태로 포함되어 있음
            // 앞에 /를 추가하여 절대 경로로 만듦
            const absolutePath = wordAudioPath.startsWith('/') ? wordAudioPath : `/${wordAudioPath}`;
            console.log('✅ Playing WORD audio from cefr_vocabs:', absolutePath);
            playUrl(absolutePath, 'vocab', vocab.id);
            return;
        }
        
        // 2. 기존 방식 (폴백)
        const targetUrl = vocab.audio || vocab.dictentry?.audioUrl;
        if (targetUrl) {
            console.log('✅ Playing WORD audio from legacy audioUrl:', targetUrl);
            playUrl(targetUrl, 'vocab', vocab.id);
            return;
        }
        
        // 3. 로컬 오디오 사용 (단어 발음용) - word.mp3 사용
        const folderName = cefrToFolder[vocab.levelCEFR] || 'starter';
        const audioFileName = await getSmartAudioFileName(vocab.lemma, vocab.pos, vocab.levelCEFR);
        const localAudioPath = `/${folderName}/${audioFileName.trim()}/word.mp3`;
        console.log('⚠️ Playing WORD audio from local path (no audioUrl found):', localAudioPath);
        console.log('🎯 Matched audio file:', audioFileName);
        playUrl(localAudioPath, 'vocab', vocab.id);
    };

    // 예문 전용 오디오 재생 함수 추가
    const playExampleOnlyAudio = async (vocab) => {
        // 숙어/구동사인 경우 특별 처리
        if ((vocab.source === 'idiom_migration' || vocab.source === 'phrasal_verb_migration' || (vocab.lemma && (vocab.lemma.includes(' ') || vocab.lemma.includes('-') || vocab.lemma.includes("'")))) && vocab.lemma) {
            // Convert to match actual folder structure:
            // "bank (money)" -> "bank-money" 
            // "lie (tell a lie)" -> "lie-tell a lie"
            // "light (from the sun/a lamp)" -> "light-from the suna lamp"
            let cleanLemma = vocab.lemma.toLowerCase()
                .replace(/\s*\([^)]*\)/g, (match) => {
                    // Remove parentheses and process content
                    const content = match.replace(/[()]/g, '').trim();
                    if (!content) return '';
                    
                    // Replace slashes and special chars properly to match actual folder structure
                    // "from the sun/a lamp" → "from-the-suna-lamp"
                    const cleaned = content.replace(/[\/\\]/g, '').replace(/\s+/g, '-').trim();
                    return cleaned ? '-' + cleaned : '';
                })
                .replace(/'/g, '');
            
            // Ensure ALL remaining spaces are converted to hyphens and clean up multiple hyphens
            cleanLemma = cleanLemma.replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
            
            // category에서 "구동사" 여부 확인 또는 source로 판단
            // 알려진 phrasal verb들을 직접 매핑
            const knownPhrasalVerbs = [
              'ask around', 'ask around for', 'ask out', 'ask for', 'ask in', 'ask over', 'ask after',
              'work through', 'work out', 'work up', 'work on', 'work off', 'break down', 'break up', 
              'break out', 'break in', 'break away', 'break through', 'come up', 'come down', 'come out',
              'go through', 'go out', 'go up', 'go down', 'put up', 'put down', 'put off', 'put on',
              'get up', 'get down', 'get out', 'get through', 'turn on', 'turn off', 'turn up', 'turn down'
            ];
            
            // Use unified folder structure based on CEFR level instead of separate idiom/phrasal_verb folders
            const folderName = cefrToFolder[vocab.levelCEFR] || 'starter';
            const audioFileName = await getSmartAudioFileName(vocab.lemma, vocab.pos, vocab.levelCEFR);
            const audioPath = `/${folderName}/${audioFileName.trim()}/example.mp3`;
            console.log('Playing special vocab example audio from unified path:', audioPath, 'category:', vocab.category);
            playUrl(audioPath, 'example', vocab.id);
            return;
        }
        
        // 일반 단어는 기존 로직 사용
        const folderName = cefrToFolder[vocab.levelCEFR] || 'starter';
        const audioFileName = await getSmartAudioFileName(vocab.lemma, vocab.pos, vocab.levelCEFR);
        const localAudioPath = `/${folderName}/${audioFileName.trim()}/example.mp3`;
        console.log('Playing example audio from local path:', localAudioPath);
        console.log('🎯 Matched audio file:', audioFileName);
        playUrl(localAudioPath, 'example', vocab.id);
    };

    const playExampleAudio = (url, type, id) => {
        console.log('🎵 Playing EXAMPLE audio from URL:', url);
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
            setDetailLoading(true); setDetail(null); setDetailType('vocab');
            const { data } = await fetchJSON(`/api/vocab/${vocabId}`, withCreds());
            setDetail(data);
        } catch (e) {
            if (e.status === 401) alert('로그인이 필요합니다.');
            else alert('상세 정보를 불러오지 못했습니다.');
            console.error(e);
        } finally {
            setDetailLoading(false);
        }
    };

    // Idiom handlers
    const handleOpenIdiomDetail = async (idiomId) => {
        try {
            setDetailLoading(true); setDetail(null); setDetailType('idiom');
            const { data } = await fetchJSON(`/api/idiom/${idiomId}`);
            setDetail(data);
        } catch (e) {
            alert('숙어 상세 정보를 불러오지 못했습니다.');
            console.error(e);
        } finally {
            setDetailLoading(false);
        }
    };

    const handleAddIdiomWordbook = async (idiomId) => {
        if (!user) {
            alert('로그인이 필요합니다.');
            return;
        }

        console.log(`[숙어 단어장 추가 시도] Idiom ID: ${idiomId}`);

        try {
            const response = await fetchJSON('/my-idioms/add', withCreds({
                method: 'POST',
                body: JSON.stringify({ idiomId })
            }));

            console.log('[API 응답 수신]', response);

            if (response?.meta?.created) {
                alert(`단어가 내 단어장에 새로 추가되었습니다.`);
                // Vocab system handles the state automatically
            } else if (response?.meta?.already) {
                alert('이미 내 단어장에 있는 단어입니다.');
                // Vocab system handles the state automatically
            } else {
                alert('요청은 성공했지만 서버 응답 형식이 예상과 다릅니다.');
                console.warn('예상치 못한 성공 응답:', response);
            }

        } catch (e) {
            console.error('handleAddIdiomWordbook 함수에서 에러 발생:', e);
            alert(`[오류] 숙어 단어장 추가에 실패했습니다. 브라우저 개발자 콘솔(F12)에서 자세한 오류를 확인해주세요. 메시지: ${e.message}`);
        }
    };

    const playIdiomAudio = (idiom) => {
        if (!idiom.audio || !idiom.audio.word) return;
        // 기본적으로 단어 발음을 재생 (word)
        playExampleAudio(`/${idiom.audio.word}`, 'idiom', idiom.id);
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

    // 더 보기 버튼 핸들러 - 페이지네이션으로 추가 데이터 로드
    const handleLoadMore = async () => {
        if (!hasNextPage || loading) return;
        
        try {
            setLoading(true);
            let url, response, newData;

            if (activeTab === 'exam' && activeExam) {
                // 시험별 단어 페이징
                const nextPage = currentPage + 1;
                url = `/exam-vocab/${activeExam}?page=${nextPage}&limit=100${debouncedSearchTerm ? `&search=${encodeURIComponent(debouncedSearchTerm)}` : ''}`;
                response = await fetchJSON(url, withCreds());
                newData = response.data?.vocabs || [];

                // 기존 단어에 새 단어 추가
                setAllWords(prev => [...prev, ...newData]);
                setWords(prev => [...prev, ...newData]);

                // 페이지네이션 상태 업데이트
                setCurrentPage(nextPage);
                setHasNextPage(response.data?.pagination?.hasNext || false);

            } else if (activeTab === 'idiom') {
                // 숙어/구동사 페이징
                const posType = activeIdiomCategory === '숙어' ? 'idiom' : 'phrasal verb';
                const currentOffset = allWords.length;
                url = `/api/simple-vocab?pos=${encodeURIComponent(posType)}&search=${encodeURIComponent(debouncedSearchTerm)}&limit=100&offset=${currentOffset}`;
                response = await fetchJSON(url);
                newData = response.data || [];

                // 기존 단어에 새 단어 추가
                setAllWords(prev => [...prev, ...newData]);
                setWords(prev => [...prev, ...newData]);
                setDisplayCount(prev => prev + newData.length);

                // 다음 페이지 여부 확인 (100개 미만이면 마지막)
                setHasNextPage(newData.length >= 100);

            } else {
                // 다른 탭들도 여기서 처리 가능
                return;
            }
            
        } catch (error) {
            console.error('Failed to load more words:', error);
        } finally {
            setLoading(false);
        }
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
                                setCurrentPage(1); // 페이지 초기화
                                setHasNextPage(false); // 페이지네이션 상태 초기화
                            }}
                        >
                            수준별 단어
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
                                setCurrentPage(1); // 페이지 초기화
                                setHasNextPage(false); // 페이지네이션 상태 초기화
                            }}
                        >
                            시험별 단어
                        </button>
                    </li>
                    <li className="nav-item">
                        <button
                            className={`nav-link ${activeTab === 'idiom' ? 'active' : ''}`}
                            onClick={() => {
                                setActiveTab('idiom');
                                setSearchTerm('');
                                setSelectedIds(new Set()); // 선택된 단어 초기화
                                setDisplayCount(100); // 표시 개수 초기화
                                setCurrentPage(1); // 페이지 초기화
                                setHasNextPage(false); // 페이지네이션 상태 초기화
                            }}
                        >
                            숙어·구동사
                        </button>
                    </li>
                    <li className="nav-item">
                        <button
                            className={`nav-link ${activeTab === 'japanese' ? 'active' : ''}`}
                            onClick={() => {
                                setActiveTab('japanese');
                                setSearchTerm('');
                                setSelectedIds(new Set()); // 선택된 단어 초기화
                                setDisplayCount(100); // 표시 개수 초기화
                                setCurrentPage(1); // 페이지 초기화
                                setHasNextPage(false); // 페이지네이션 상태 초기화
                            }}
                        >
                            일본어
                        </button>
                    </li>
                </ul>
            </div>

            {/* CEFR 레벨 탭 */}
            {activeTab === 'cefr' && (
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h4 className="m-0">수준별 단어</h4>
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
                                setCurrentPage(1); // 페이지 초기화
                                setHasNextPage(false); // 페이지네이션 상태 초기화
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
                        {examCategories.length > 0 ? (
                            examCategories.map(exam => (
                                <button 
                                    key={exam.name} 
                                    className={`btn btn-sm ${activeExam === exam.name ? 'btn-info' : 'btn-outline-info'}`} 
                                    onClick={() => { 
                                        setSearchTerm(''); 
                                        setActiveExam(exam.name); 
                                        setSelectedIds(new Set()); // 선택된 단어 초기화
                                        setDisplayCount(100); // 표시 개수 초기화
                                setCurrentPage(1); // 페이지 초기화
                                setHasNextPage(false); // 페이지네이션 상태 초기화
                                    }}
                                    title={`${exam.description} (${exam.totalWords || 0}개 단어)`}
                                >
                                    {exam.name}
                                    {exam.totalWords > 0 && (
                                    <span className="badge bg-secondary ms-1">{exam.totalWords}</span>
                                )}
                            </button>
                        ))
                        ) : (
                            <div className="alert alert-info mb-0">
                                <i className="bi bi-info-circle me-2"></i>
                                시험 카테고리가 설정되지 않았습니다. CEFR 레벨별 단어를 이용해주세요.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 숙어·구동사 탭 */}
            {activeTab === 'idiom' && (
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h4 className="m-0">숙어·구동사</h4>
                    <div className="btn-group">
                        {['숙어', '구동사'].map(category => (
                            <button
                                key={category}
                                className={`btn btn-sm ${activeIdiomCategory === category ? 'btn-success' : 'btn-outline-success'}`}
                                onClick={() => {
                                    setSearchTerm('');
                                    setActiveIdiomCategory(category);
                                    setSelectedIds(new Set()); // 선택된 단어 초기화
                                    setDisplayCount(100); // 표시 개수 초기화
                                    setCurrentPage(1); // 페이지 초기화
                                    setHasNextPage(false); // 페이지네이션 상태 초기화
                                }}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 일본어 JLPT 레벨 탭 */}
            {activeTab === 'japanese' && (
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h4 className="m-0">일본어 단어</h4>
                    <div className="btn-group">
                        {['N5', 'N4', 'N3', 'N2', 'N1'].map(level => (
                            <button
                                key={level}
                                className={`btn btn-sm ${activeJlptLevel === level ? 'btn-danger' : 'btn-outline-danger'}`}
                                onClick={() => {
                                    setSearchTerm('');
                                    setActiveJlptLevel(level);
                                    setSelectedIds(new Set()); // 선택된 단어 초기화
                                    setDisplayCount(100); // 표시 개수 초기화
                                    setCurrentPage(1); // 페이지 초기화
                                    setHasNextPage(false); // 페이지네이션 상태 초기화
                                }}
                            >
                                {level}
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
                        disabled={words.length === 0}
                    />
                    <label className="form-check-label" htmlFor="selectAllCheck">
                        {(isAllSelected ? '전체 해제' : '전체 선택')} ({selectedIds.size}개 선택됨)
                        {activeTab === 'exam' && totalCount > 0 && ` / ${totalCount}개 전체`}
                        {activeTab === 'cefr' && totalCount > 0 && ` / ${totalCount}개 전체`}
                        {activeTab === 'idiom' && totalCount > 0 && ` / ${totalCount}개 전체`}
                        {activeTab === 'japanese' && totalCount > 0 && ` / ${totalCount}개 전체`}
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
                        setCurrentPage(1); // 페이지 초기화
                        setHasNextPage(false); // 페이지네이션 상태 초기화
                    }}
                />
            </div>

            {loading && <div>목록 로딩 중…</div>}
            {err && <div className="alert alert-warning">해당 레벨 목록을 불러오지 못했습니다.</div>}
            {!loading && !err && words.length === 0 && (
                <div className="text-muted">
                    {searchTerm ? '검색 결과가 없습니다.' : 
                     activeTab === 'idiom' ? '이 카테고리에 표시할 숙어가 없습니다.' : 
                     '이 레벨에 표시할 단어가 없습니다.'}
                </div>
            )}
            <div className="row">
                {/* 일본어 탭은 JapaneseVocabCard, 나머지는 VocabCard 사용 */}
                {activeTab === 'japanese' ? (
                    words.map(vocab => (
                        <JapaneseVocabCard
                            key={vocab.id}
                            vocab={vocab}
                            onOpenDetail={handleOpenDetail}
                            onAddWordbook={handleAddWordbook}
                            onAddSRS={handleAddSRS}
                            inWordbook={myWordbookIds.has(vocab.id)}
                            inSRS={srsIds.has(vocab.id)}
                            onPlayAudio={playVocabAudio}
                            enrichingId={enrichingId}
                            isSelected={selectedIds.has(vocab.id)}
                            onToggleSelect={handleToggleSelect}
                            playingAudio={playingAudio}
                            masteredCards={masteredCards}
                        />
                    ))
                ) : (
                    words.map(vocab => (
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
                    ))
                )}
            </div>
            
            {/* 더 보기 버튼 - 시험별 및 숙어/구동사 */}
            {!loading && !err && hasNextPage && (activeTab === 'exam' || activeTab === 'idiom') && (
                <div className="text-center mt-4">
                    <button 
                        className="btn btn-outline-primary btn-lg"
                        onClick={handleLoadMore}
                    >
                        더 보기 ({totalCount - allWords.length}개 더)
                    </button>
                </div>
            )}
            
            {/* CEFR 레벨, 일본어에서 더 보기 버튼 표시 (숙어/구동사는 위의 API 페이지네이션 사용) */}
            {!loading && !err && (activeTab === 'cefr' || activeTab === 'japanese') && allWords.length > displayCount && (
                <div className="text-center mt-4">
                    <button
                        className="btn btn-outline-primary btn-lg"
                        onClick={() => setDisplayCount(prev => prev + 100)}
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
                                    onPlayGlossAudio={playGlossAudio}
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