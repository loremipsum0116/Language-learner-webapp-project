// src/pages/SrsFolderDetail.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { SrsApi } from "../api/srs";
import { useAuth } from "../context/AuthContext";
import Pron from "../components/Pron";
import ReviewTimer from "../components/ReviewTimer";
import RainbowStar from "../components/RainbowStar";
import TimeAcceleratorControl from "../components/TimeAcceleratorControl";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("ko");

const fmt = (d) => (d ? dayjs.utc(d).tz('Asia/Seoul').format("YYYY.MM.DD (ddd)") : "-");

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

const isCardFrozen = (item) => {
    if (item.frozenUntil) {
        const now = new Date();
        const frozenUntil = new Date(item.frozenUntil);
        return now < frozenUntil;
    }
    return false;
};

const getCardBackgroundColor = (item) => {
    // 동결 상태 체크 (최우선) - 연한 파란색
    if (isCardFrozen(item)) {
        return { 
            className: 'text-dark border-info', 
            style: { backgroundColor: '#cff4fc', color: '#055160' } // 연한 파란색
        };
    }
    
    if (item.isOverdue) return { 
        className: 'text-dark border-warning', 
        style: { backgroundColor: '#fff3cd', color: '#664d03' } // 연한 노란색
    };
    
    if (item.learned) return { 
        className: 'text-dark border-success', 
        style: { backgroundColor: '#d1e7dd', color: '#0f5132' } // 연한 초록색
    };
    
    if (item.wrongCount > 0) return { 
        className: 'text-dark border-danger', 
        style: { backgroundColor: '#f8d7da', color: '#721c24' } // 연한 빨간색
    };
    
    // 대기 중인 카드 체크 (nextReviewAt이 미래인 경우)
    if (item.nextReviewAt) {
        const now = new Date();
        const reviewTime = new Date(item.nextReviewAt);
        if (reviewTime > now) {
            return { 
                className: 'text-dark border-secondary', 
                style: { backgroundColor: '#e2e3e5', color: '#41464b' } // 연한 회색
            };
        }
    }
    
    // Stage별 색상 구분 (대기 중이 아닌 경우)
    if (item.stage >= 7) return { 
        className: 'text-dark border-primary', 
        style: { backgroundColor: '#cfe2ff', color: '#084298' } // 연한 파란색 (고단계)
    };
    
    if (item.stage >= 4) return { 
        className: 'text-dark border-primary', 
        style: { backgroundColor: '#e7f3ff', color: '#0a58ca' } // 매우 연한 파란색 (중단계)
    };
    
    if (item.stage >= 1) return { 
        className: 'text-dark border-secondary', 
        style: { backgroundColor: '#f8f9fa', color: '#495057' } // 연한 회색 (저단계)
    };
    
    return { className: 'border-light', style: {} }; // Stage 0 (미학습) - 기본색
};

export default function SrsFolderDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    // 운영자 체크
    const isAdmin = user?.email === 'super@root.com';

    const [loading, setLoading] = useState(true);
    const [folder, setFolder] = useState(null);
    const [items, setItems] = useState([]); // 폴더에 담긴 모든 단어
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [deleting, setDeleting] = useState(false);
    const [filterMode, setFilterMode] = useState('all'); // 'all', 'review', 'learning', 'frozen', 'stage', 'wrong'
    const [flippedCards, setFlippedCards] = useState(new Set()); // 뒤집힌 카드들의 ID 저장
    
    // 필터 변경 시 선택 상태 초기화
    const handleFilterChange = (newFilter) => {
        setFilterMode(newFilter);
        setSelectedIds(new Set()); // 기존 선택 상태 모두 초기화
    };

    const handleCardFlip = (itemId) => {
        setFlippedCards(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    const reload = async () => {
        setLoading(true);
        try {
            const data = await SrsApi.getFolderItems(id);
            console.log('[DEBUG] SrsFolderDetail raw data:', data);
            setFolder(data?.folder ?? null);
            // 서버가 items 또는 quizItems로 내려올 수 있음 → quizItems 우선 사용
            const raw = data?.quizItems ?? data?.items ?? [];
            console.log('[DEBUG] Items array:', raw);
            if (raw.length > 0) {
                console.log('[DEBUG] First item structure:', raw[0]);
                console.log('[DEBUG] First item SRS fields:', {
                    nextReviewAt: raw[0]?.nextReviewAt,
                    waitingUntil: raw[0]?.waitingUntil,
                    isOverdue: raw[0]?.isOverdue,
                    overdueDeadline: raw[0]?.overdueDeadline,
                    isFromWrongAnswer: raw[0]?.isFromWrongAnswer,
                    frozenUntil: raw[0]?.frozenUntil,
                    stage: raw[0]?.stage,
                    isMastered: raw[0]?.isMastered
                });
                console.log('[DEBUG] FULL FIRST ITEM:', JSON.stringify(raw[0], null, 2));
                if (raw.length > 1) {
                    console.log('[DEBUG] SECOND ITEM SRS fields:', {
                        nextReviewAt: raw[1]?.nextReviewAt,
                        waitingUntil: raw[1]?.waitingUntil,
                        isOverdue: raw[1]?.isOverdue,
                        overdueDeadline: raw[1]?.overdueDeadline,
                        isFromWrongAnswer: raw[1]?.isFromWrongAnswer,
                        frozenUntil: raw[1]?.frozenUntil,
                        stage: raw[1]?.stage,
                        isMastered: raw[1]?.isMastered
                    });
                    console.log('[DEBUG] FULL SECOND ITEM:', JSON.stringify(raw[1], null, 2));
                }
                console.log('[DEBUG] First item vocab:', raw[0]?.vocab);
                console.log('[DEBUG] First item dictMeta:', raw[0]?.vocab?.dictMeta);
                console.log('[DEBUG] First item examples:', raw[0]?.vocab?.dictMeta?.examples);
                if (raw[0]?.vocab?.dictMeta?.examples?.[0]) {
                    console.log('[DEBUG] First example detailed:', JSON.stringify(raw[0].vocab.dictMeta.examples[0], null, 2));
                }
            }
            setItems(Array.isArray(raw) ? raw : []);
            setSelectedIds(new Set()); // 선택 초기화
        } catch (e) {
            alert(`폴더 불러오기 실패: ${e?.message || "서버 오류"}`);
            navigate("/srs");
        } finally {
            setLoading(false);
        }
    };

    const handleToggleSelect = (itemId) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        const allIds = filteredItems.map(item => item.folderItemId ?? item.id);
        const allSelected = allIds.every(id => selectedIds.has(id));
        if (allSelected) {
            // 필터링된 아이템들만 선택 해제
            const newSelectedIds = new Set(selectedIds);
            allIds.forEach(id => newSelectedIds.delete(id));
            setSelectedIds(newSelectedIds);
        } else {
            // 필터링된 아이템들을 기존 선택에 추가
            setSelectedIds(new Set([...selectedIds, ...allIds]));
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) {
            alert('삭제할 단어를 선택해주세요.');
            return;
        }
        
        if (!window.confirm(`선택한 ${selectedIds.size}개 단어를 폴더에서 삭제하시겠습니까?`)) {
            return;
        }

        try {
            setDeleting(true);
            await SrsApi.removeItems(folder.id, { itemIds: Array.from(selectedIds) });
            await reload();
            alert('선택한 단어들이 삭제되었습니다.');
        } catch (e) {
            alert(`삭제 실패: ${e?.message || "서버 오류"}`);
        } finally {
            setDeleting(false);
        }
    };

    const handleAccelerateCards = async () => {
        if (selectedIds.size === 0) {
            alert('자동학습할 단어를 선택해주세요.');
            return;
        }
        
        try {
            // 선택된 카드 ID들을 미리 준비하고 localStorage에 저장
            const selectedItems = items.filter(item => selectedIds.has(item.folderItemId ?? item.id));
            const cardIds = selectedItems.map(item => item.cardId).filter(cardId => cardId);
            
            console.log('[ACCELERATION SETUP] Selected items:', selectedItems.length);
            console.log('[ACCELERATION SETUP] Card IDs:', cardIds);
            console.log('[ACCELERATION SETUP] Folder ID:', folder.id);
            
            // 학습 완료 후 처리할 정보를 localStorage에 저장
            const accelerationData = {
                folderId: folder.id,
                cardIds: cardIds,
                timestamp: Date.now()
            };
            
            localStorage.setItem('pendingAcceleration', JSON.stringify(accelerationData));
            console.log('[ACCELERATION SETUP] Saved to localStorage:', accelerationData);
            
            // 기존 자동학습 모드로 이동
            const selectedItemIds = Array.from(selectedIds).join(',');
            const learnUrl = `/learn/vocab?mode=flash&auto=1&folderId=${folder.id}&selectedItems=${selectedItemIds}`;
            
            navigate(learnUrl);
            
        } catch (e) {
            console.error('자동학습 시작 실패:', e);
            alert(`자동학습 시작 실패: ${e?.message || "서버 오류"}`);
        }
    };

    useEffect(() => { 
        reload(); 
        
        // 학습 완료 후 돌아온 경우 대기 중인 가속화 처리
        const checkPendingAcceleration = async () => {
            const pending = localStorage.getItem('pendingAcceleration');
            console.log('[ACCELERATION CHECK] Checking localStorage:', pending);
            
            if (pending) {
                try {
                    const data = JSON.parse(pending);
                    console.log('[ACCELERATION CHECK] Parsed data:', data);
                    console.log('[ACCELERATION CHECK] Current folderId:', id, 'Data folderId:', data.folderId);
                    console.log('[ACCELERATION CHECK] Time check:', Date.now() - data.timestamp, 'ms ago');
                    
                    // 24시간 이내의 요청만 처리
                    if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000 && 
                        data.folderId === parseInt(id) && 
                        data.cardIds.length > 0) {
                        
                        console.log('[ACCELERATION] Processing pending acceleration for', data.cardIds.length, 'cards:', data.cardIds);
                        const result = await SrsApi.accelerateCards(data.folderId, { cardIds: data.cardIds });
                        console.log('[ACCELERATION] Result:', result);
                        
                        // 상태 변경 후 페이지 새로고침하여 업데이트된 카드 상태 반영
                        console.log('[ACCELERATION] Reloading page to reflect changes');
                        await reload();
                        
                        // 추가: 강제 페이지 새로고침으로 확실한 상태 업데이트
                        setTimeout(() => {
                            window.location.reload();
                        }, 500);
                        
                        // alert 제거 - 자동학습 후 조용히 상태 변경
                    } else {
                        console.log('[ACCELERATION CHECK] Conditions not met - skipping');
                    }
                } catch (e) {
                    console.error('[ACCELERATION ERROR] Failed to process pending acceleration:', e);
                } finally {
                    console.log('[ACCELERATION] Removing localStorage item');
                    localStorage.removeItem('pendingAcceleration');
                }
            } else {
                console.log('[ACCELERATION CHECK] No pending acceleration found');
            }
        };
        
        // 페이지 로드 후 잠시 후에 처리 (reload 완료 후)
        setTimeout(checkPendingAcceleration, 1000);
        
        /* eslint-disable-next-line */ 
    }, [id]);

    if (loading) return <main className="container py-5 text-center"><div className="spinner-border" /></main>;
    if (!folder) {
        return (
            <main className="container py-5 text-center">
                <p>폴더 정보를 찾을 수 없습니다.</p>
                <Link className="btn btn-outline-secondary" to="/srs">← 대시보드</Link>
            </main>
        );
    }

    const created = folder.createdDate ?? folder.createdAt ?? folder.date;
    const nextDue = folder.nextReviewDate ?? folder.nextReviewAt;
    const stage = folder.stage ?? 0;

    // 필터링된 아이템들
    const filteredItems = items.filter(item => {
        if (folder.learningCurveType === 'free') {
            // 자율학습모드용 필터링 - 마지막 학습 상태 기준
            switch (filterMode) {
                case 'correct':
                    // 마지막 학습이 정답인 단어들: lastReviewedAt > lastWrongAt
                    if (!item.lastReviewedAt) return false; // 아예 학습한 적 없음
                    if (!item.lastWrongAt) return true; // 오답한 적 없고 학습한 적 있음 = 정답
                    return new Date(item.lastReviewedAt) > new Date(item.lastWrongAt);
                case 'wrong':
                    // 마지막 학습이 오답인 단어들: lastWrongAt > lastReviewedAt 또는 lastReviewedAt 없음
                    if (!item.lastWrongAt) return false; // 오답한 적 없음
                    if (!item.lastReviewedAt) return true; // 오답은 있지만 정답 학습 기록 없음
                    return new Date(item.lastWrongAt) >= new Date(item.lastReviewedAt);
                case 'unlearned':
                    return !item.lastReviewedAt && !item.lastWrongAt; // 아예 학습한 적 없는 단어들
                case 'all':
                default:
                    return true;
            }
        } else {
            // 일반 SRS 모드용 필터링
            switch (filterMode) {
                case 'review':
                    return item.isOverdue; // 복습 대기중
                case 'learning':
                    return !item.isOverdue && !item.learned && (!item.wrongCount || item.wrongCount === 0); // 학습 대기중
                case 'frozen':
                    if (item.frozenUntil) {
                        const now = new Date();
                        const frozenUntil = new Date(item.frozenUntil);
                        return now < frozenUntil; // 동결중
                    }
                    return false;
                case 'stage':
                    return item.stage > 0 && !item.isOverdue && !item.isMastered; // stage 대기중이지만 overdue나 mastered가 아닌 단어들
                case 'wrong':
                    // 빨간 배경을 가진 단어들 (현재 오답 대기중): wrongCount > 0이지만 동결/overdue/learned가 아닌 상태
                    if (item.frozenUntil) {
                        const now = new Date();
                        const frozenUntil = new Date(item.frozenUntil);
                        if (now < frozenUntil) return false; // 동결중이면 제외
                    }
                    return !item.isOverdue && !item.learned && item.wrongCount > 0;
                case 'all':
                default:
                    return true;
            }
        }
    });
        
    const wrongAnswerCount = items.filter(item => {
        // 빨간 배경을 가진 단어들과 동일한 조건
        if (item.frozenUntil) {
            const now = new Date();
            const frozenUntil = new Date(item.frozenUntil);
            if (now < frozenUntil) return false; // 동결중이면 제외
        }
        return !item.isOverdue && !item.learned && item.wrongCount > 0;
    }).length;
    const reviewWaitingCount = items.filter(item => item.isOverdue).length;
    const learningWaitingCount = items.filter(item => !item.isOverdue && !item.learned && (!item.wrongCount || item.wrongCount === 0)).length;
    const frozenCount = items.filter(item => {
        if (item.frozenUntil) {
            const now = new Date();
            const frozenUntil = new Date(item.frozenUntil);
            return now < frozenUntil;
        }
        return false;
    }).length;
    const masteredCount = items.filter(item => item.isMastered).length;
    const stageWaitingCount = items.filter(item => item.stage > 0 && !item.isOverdue && !item.isMastered).length;
    
    // 디버깅 로그
    console.log('[FRONTEND DEBUG] Total items:', items.length);
    console.log('[FRONTEND DEBUG] Wrong answer waiting items:', 
        items.filter(item => item.isWrongAnswerWaiting).map(item => ({
            lemma: item.vocab?.lemma,
            isWrongAnswerWaiting: item.isWrongAnswerWaiting,
            frozenUntil: item.frozenUntil,
            isFromWrongAnswer: item.isFromWrongAnswer,
            isMastered: item.isMastered
        }))
    );
    console.log('[FRONTEND DEBUG] Wrong answer count:', wrongAnswerCount);

    return (
        <main className="container py-4">
            {/* 헤더 */}
            <div className={`d-flex justify-content-between align-items-center mb-3 ${
                folder.isFolderMastered ? 'p-3 rounded' : ''
            }`} style={folder.isFolderMastered ? {
                background: 'linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%)',
                boxShadow: '0 8px 16px rgba(255, 193, 7, 0.3)',
                border: '3px solid #ffc107'
            } : {}}>
                <div>
                    <h4 className={`mb-1 ${folder.isFolderMastered ? 'text-warning' : ''}`}>
                        {folder.isFolderMastered ? '🏆' : (folder.learningCurveType === 'short' ? '🐰' : folder.learningCurveType === 'free' ? '🎯' : '🐢')} {folder.name}
                        {folder.isFolderMastered && <span className="ms-2">🎉 완전 마스터! 🎉</span>}
                        <span className="badge ms-2" style={{
                            backgroundColor: folder.isFolderMastered ? '#ff9800' : (folder.learningCurveType === 'short' ? '#ff6b6b' : 
                                           folder.learningCurveType === 'free' ? '#28a745' : '#4ecdc4'),
                            color: 'white',
                            fontSize: '0.7em'
                        }}>
                            {folder.isFolderMastered ? '모든 단어 마스터 완료!' : (folder.learningCurveType === 'short' 
                                ? '스퍼트 곡선 (10단계, 빠른 반복)' 
                                : folder.learningCurveType === 'free'
                                ? '자율 모드 (타이머 없음, 자유 학습)'
                                : '장기 곡선 (7단계, 점진적 확장)'
                            )}
                        </span>
                    </h4>
                    <small className="text-muted">
                        생성일: {fmt(created)}
                        <span className="mx-2">|</span>
                        {folder.learningCurveType === 'free' ? (
                            // 자율학습모드용 통계
                            <>
                                단어 {items.length}개
                                <span className="mx-2">|</span>
                                정답한 단어 {items.filter(item => {
                                    // 마지막 학습이 정답인 단어들
                                    if (!item.lastReviewedAt) return false;
                                    if (!item.lastWrongAt) return true;
                                    return new Date(item.lastReviewedAt) > new Date(item.lastWrongAt);
                                }).length}개
                                <span className="mx-2">|</span>
                                오답한 단어 {items.filter(item => {
                                    // 마지막 학습이 오답인 단어들
                                    if (!item.lastWrongAt) return false;
                                    if (!item.lastReviewedAt) return true;
                                    return new Date(item.lastWrongAt) >= new Date(item.lastReviewedAt);
                                }).length}개
                                <span className="mx-2">|</span>
                                미학습 {items.filter(item => !item.lastReviewedAt && !item.lastWrongAt).length}개
                            </>
                        ) : (
                            // 일반 SRS 모드용 통계
                            <>
                                학습곡선: <strong>{folder.learningCurveType === 'short' 
                                    ? '2일 간격 고정 반복 (단기 집중형)' 
                                    : '1시간→1일→3일→7일→13일→29일→60일 (장기 기억형)'
                                }</strong>
                                <span className="mx-2">|</span>
                                단어 {items.length}개
                                <span className="mx-2">|</span>
                                복습 {reviewWaitingCount}개
                                <span className="mx-2">|</span>
                                미학습 {learningWaitingCount}개
                                <span className="mx-2">|</span>
                                오답 {wrongAnswerCount}개
                                <span className="mx-2">|</span>
                                동결 {frozenCount}개
                                <span className="mx-2">|</span>
                                마스터 <span className="text-warning">{masteredCount}개</span>
                            </>
                        )}
                
                        {filterMode !== 'all' && (
                            <span className="text-warning">
                                {' '}({folder.learningCurveType === 'free' ? (
                                    filterMode === 'correct' ? '정답한 단어들만 표시' :
                                    filterMode === 'wrong' ? '오답한 단어들만 표시' :
                                    filterMode === 'unlearned' ? '미학습 단어들만 표시' : '필터링 중'
                                ) : (
                                    filterMode === 'review' ? '복습 대기중인 단어들만 표시' :
                                    filterMode === 'learning' ? '학습 대기중인 단어들만 표시' :
                                    filterMode === 'frozen' ? '동결중인 단어들만 표시' :
                                    filterMode === 'stage' ? 'Stage 대기중인 단어들만 표시' :
                                    filterMode === 'wrong' ? '오답 대기중인 단어들만 표시' : '필터링 중'
                                )})
                            </span>
                        )}
                    </small>
                </div>
                <div className="d-flex gap-2">
                    {folder.parentId ? (
                        <Link className="btn btn-outline-secondary btn-sm" to={`/srs/parent/${folder.parentId}`}>
                            ← 상위폴더로
                        </Link>
                    ) : (
                        <Link className="btn btn-outline-secondary btn-sm" to="/srs">← 대시보드</Link>
                    )}
                    {selectedIds.size > 0 ? (
                        selectedIds.size > 100 ? (
                            <button 
                                className="btn btn-primary btn-sm" 
                                onClick={() => alert('100개를 초과하여 선택하신 단어는 학습할 수 없습니다. 100개 이하로 선택해주세요.')}
                            >
                                학습 시작 ({selectedIds.size}개 선택) - 100개 초과
                            </button>
                        ) : (
                            <Link 
                                className="btn btn-primary btn-sm" 
                                to={`/learn/vocab?mode=srs_folder&folderId=${folder.id}&selectedItems=${Array.from(selectedIds).join(',')}`}
                            >
                                학습 시작 ({selectedIds.size}개 선택)
                            </Link>
                        )
                    ) : (
                        <button 
                            className="btn btn-primary btn-sm opacity-50" 
                            disabled
                            title="단어를 선택해주세요"
                        >
                            학습 시작
                        </button>
                    )}
                    {selectedIds.size > 0 ? (
                        selectedIds.size > 100 ? (
                            <button 
                                className="btn btn-success btn-sm" 
                                onClick={() => alert('100개를 초과하여 선택하신 단어는 학습할 수 없습니다. 100개 이하로 선택해주세요.')}
                            >
                                선택 자동학습 ({selectedIds.size}개) - 100개 초과
                            </button>
                        ) : (
                            <button 
                                className="btn btn-success btn-sm" 
                                onClick={handleAccelerateCards}
                            >
                                선택 자동학습 ({selectedIds.size}개)
                            </button>
                        )
                    ) : (
                        <button 
                            className="btn btn-success btn-sm opacity-50" 
                            disabled
                            title="단어를 선택해주세요"
                        >
                            선택 자동학습
                        </button>
                    )}
                </div>
            </div>


            {/* 시간 가속 컨트롤 - 운영자만 표시, 자율학습모드에서는 숨김 */}
            {isAdmin && folder.learningCurveType !== 'free' && (
                <div className="mb-4">
                    <TimeAcceleratorControl />
                </div>
            )}

            {/* 10분 이하 카드 즉시 학습 가능 버튼 - 자율학습모드에서는 숨김 */}
            {folder.learningCurveType !== 'free' && (
                <div className="mb-4">
                <div className="p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
                    <div className="d-flex align-items-center justify-content-between">
                        <div>
                            <h6 className="mb-1 fw-bold text-green-700">⚡ 빠른 복습</h6>
                            <small className="text-muted">10분 이하 남은 카드들을 즉시 학습 가능하게 만듭니다</small>
                        </div>
                        <button
                            className="btn btn-success btn-sm"
                            onClick={async () => {
                                const cardsUnder10Min = items.filter(item => {
                                    if (item.isOverdue || item.isMastered) return false;
                                    
                                    const now = new Date();
                                    let targetTime = null;
                                    
                                    // 동결 카드인 경우 frozenUntil 시간 확인
                                    if (isCardFrozen(item)) {
                                        targetTime = new Date(item.frozenUntil);
                                    }
                                    // 일반 카드인 경우 nextReviewAt 시간 확인
                                    else if (item.nextReviewAt) {
                                        targetTime = new Date(item.nextReviewAt);
                                    }
                                    
                                    if (!targetTime) return false;
                                    
                                    const timeDiff = targetTime.getTime() - now.getTime();
                                    const minutesLeft = Math.floor(timeDiff / (1000 * 60));
                                    
                                    return minutesLeft <= 10 && minutesLeft > 0;
                                });
                                
                                if (cardsUnder10Min.length === 0) {
                                    alert('10분 이하 남은 카드가 없습니다.');
                                    return;
                                }
                                
                                if (window.confirm(`${cardsUnder10Min.length}개의 카드를 즉시 학습 가능하게 만드시겠습니까?`)) {
                                    try {
                                        const cardIds = cardsUnder10Min.map(c => c.id || c.cardId);
                                        const result = await SrsApi.accelerateCards(folder.id, { cardIds });
                                        alert(result.message || `${result.acceleratedCount}개 카드가 즉시 학습 가능하게 설정되었습니다.`);
                                        await reload(); // 페이지 새로고침
                                    } catch (e) {
                                        alert(`카드 가속 실패: ${e?.message || "서버 오류"}`);
                                    }
                                }
                            }}
                        >
                            즉시 학습 가능 ({items.filter(item => {
                                if (item.isOverdue || item.isMastered) return false;
                                
                                const now = new Date();
                                let targetTime = null;
                                
                                // 동결 카드인 경우 frozenUntil 시간 확인
                                if (isCardFrozen(item)) {
                                    targetTime = new Date(item.frozenUntil);
                                }
                                // 일반 카드인 경우 nextReviewAt 시간 확인
                                else if (item.nextReviewAt) {
                                    targetTime = new Date(item.nextReviewAt);
                                }
                                
                                if (!targetTime) return false;
                                
                                const timeDiff = targetTime.getTime() - now.getTime();
                                const minutesLeft = Math.floor(timeDiff / (1000 * 60));
                                
                                return minutesLeft <= 10 && minutesLeft > 0;
                            }).length}개)
                        </button>
                    </div>
                </div>
                </div>
            )}

            {/* 단어 관리 툴바 */}
            {items.length > 0 && (
                <div className="mb-3">
                    {/* 첫 번째 줄: 선택/삭제 버튼 */}
                    <div className="d-flex gap-2 mb-2">
                        <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={handleSelectAll}
                        >
                            {filteredItems.length > 0 && filteredItems.every(item => selectedIds.has(item.folderItemId ?? item.id))
                                ? '전체 선택 해제' : '전체 선택'}
                        </button>
                        <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={handleDeleteSelected}
                            disabled={selectedIds.size === 0 || deleting}
                        >
                            {deleting ? '삭제 중...' : `선택 삭제 (${selectedIds.size})`}
                        </button>
                    </div>
                    {/* 두 번째 줄: 필터 버튼들 */}
                    <div className="d-flex flex-wrap gap-2">
                        <button
                            className={`btn btn-sm ${filterMode === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
                            onClick={() => handleFilterChange('all')}
                        >
                            전체 보기 ({items.length})
                        </button>
                        {folder.learningCurveType === 'free' ? (
                            // 자율학습모드용 필터 버튼들
                            <>
                                <button
                                    className={`btn btn-sm ${filterMode === 'correct' ? 'btn-success' : 'btn-outline-success'}`}
                                    onClick={() => handleFilterChange('correct')}
                                    disabled={items.filter(item => {
                                        if (!item.lastReviewedAt) return false;
                                        if (!item.lastWrongAt) return true;
                                        return new Date(item.lastReviewedAt) > new Date(item.lastWrongAt);
                                    }).length === 0}
                                >
                                    정답한 단어만 보기 ({items.filter(item => {
                                        if (!item.lastReviewedAt) return false;
                                        if (!item.lastWrongAt) return true;
                                        return new Date(item.lastReviewedAt) > new Date(item.lastWrongAt);
                                    }).length})
                                </button>
                                <button
                                    className={`btn btn-sm ${filterMode === 'wrong' ? 'btn-danger' : 'btn-outline-danger'}`}
                                    onClick={() => handleFilterChange('wrong')}
                                    disabled={items.filter(item => {
                                        if (!item.lastWrongAt) return false;
                                        if (!item.lastReviewedAt) return true;
                                        return new Date(item.lastWrongAt) >= new Date(item.lastReviewedAt);
                                    }).length === 0}
                                >
                                    오답한 단어만 보기 ({items.filter(item => {
                                        if (!item.lastWrongAt) return false;
                                        if (!item.lastReviewedAt) return true;
                                        return new Date(item.lastWrongAt) >= new Date(item.lastReviewedAt);
                                    }).length})
                                </button>
                                <button
                                    className={`btn btn-sm ${filterMode === 'unlearned' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                                    onClick={() => handleFilterChange('unlearned')}
                                    disabled={items.filter(item => !item.lastReviewedAt && !item.lastWrongAt).length === 0}
                                >
                                    미학습 단어만 보기 ({items.filter(item => !item.lastReviewedAt && !item.lastWrongAt).length})
                                </button>
                            </>
                        ) : (
                            // 일반 SRS 모드용 필터 버튼들
                            <>
                                <button
                                    className={`btn btn-sm ${filterMode === 'review' ? 'btn-warning' : 'btn-outline-warning'}`}
                                    onClick={() => handleFilterChange('review')}
                                    disabled={reviewWaitingCount === 0}
                                >
                                    복습 대기중인 단어들만 보기 ({reviewWaitingCount})
                                </button>
                                <button
                                    className={`btn btn-sm ${filterMode === 'learning' ? 'btn-secondary' : 'btn-outline-info'}`}
                                    onClick={() => handleFilterChange('learning')}
                                    disabled={learningWaitingCount === 0}
                                >
                                    미학습 단어들만 보기 ({learningWaitingCount})
                                </button>
                                <button
                                    className={`btn btn-sm ${filterMode === 'frozen' ? 'btn-info' : 'btn-outline-secondary'}`}
                                    onClick={() => handleFilterChange('frozen')}
                                    disabled={frozenCount === 0}
                                >
                                    동결중인 단어들만 보기 ({frozenCount})
                                </button>
                                <button
                                    className={`btn btn-sm ${filterMode === 'stage' ? 'btn-success' : 'btn-outline-success'}`}
                                    onClick={() => handleFilterChange('stage')}
                                    disabled={stageWaitingCount === 0}
                                >
                                    Stage 대기중인 단어들만 보기 ({stageWaitingCount})
                                </button>
                                <button
                                    className={`btn btn-sm ${filterMode === 'wrong' ? 'btn-danger' : 'btn-outline-danger'}`}
                                    onClick={() => handleFilterChange('wrong')}
                                    disabled={wrongAnswerCount === 0}
                                >
                                    오답만 보기 ({wrongAnswerCount})
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* 담긴 단어 리스트 - 카드 UI */}
            {items.length === 0 ? (
                <div className="alert alert-light">
                    이 폴더에 담긴 단어가 없습니다. <Link to="/vocab">단어장 페이지</Link>에서 "+SRS" 버튼으로 추가하세요.
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="alert alert-warning">
                    {filterMode === 'wrong' ? "오답 대기중인 단어가 없습니다. 모든 단어를 정답으로 맞춘 상태입니다!" : 
                     filterMode === 'review' ? "복습 대기중인 단어가 없습니다." :
                     filterMode === 'learning' ? "학습 대기중인 단어가 없습니다." :
                     filterMode === 'frozen' ? "동결중인 단어가 없습니다." :
                     filterMode === 'stage' ? "Stage 대기중인 단어가 없습니다." :
                     "표시할 단어가 없습니다."}
                </div>
            ) : (
                <div className="row">
                    {filteredItems.map((item) => {
                        const v = item.vocab || item.item || null;
                        const itemId = item.folderItemId ?? item.id; // For selection/deletion
                        const cardId = item.cardId; // For display key
                        const lemma = v?.lemma ?? "—";
                        const pos = v?.pos ?? "";
                        const level = v?.level ?? v?.levelCEFR ?? "";
                        // dictentry.examples에서 한국어 뜻 추출
                        let koGloss = '뜻 정보 없음';
                        try {
                            // 우선 dictentry.examples 확인 (올바른 데이터 소스)
                            if (v?.dictentry?.examples) {
                                const examples = Array.isArray(v.dictentry.examples) 
                                    ? v.dictentry.examples 
                                    : JSON.parse(v.dictentry.examples);
                                
                                // 다양한 구조에서 한국어 뜻 찾기
                                for (const ex of examples) {
                                    // definitions 안에 ko_def가 있는 경우 (표준 구조)
                                    if (ex?.definitions && Array.isArray(ex.definitions)) {
                                        for (const def of ex.definitions) {
                                            if (def?.ko_def) {
                                                koGloss = def.ko_def;
                                                break;
                                            }
                                            if (def?.ko) {
                                                koGloss = def.ko;
                                                break;
                                            }
                                            if (def?.koGloss) {
                                                koGloss = def.koGloss;
                                                break;
                                            }
                                        }
                                        if (koGloss !== '뜻 정보 없음') break;
                                    }
                                    // 직접 koGloss가 있는 경우
                                    if (ex?.koGloss) {
                                        koGloss = ex.koGloss;
                                        break;
                                    }
                                    // gloss 형태로 저장된 경우 (기존 로직)
                                    if (ex?.kind === 'gloss' && ex?.ko) {
                                        koGloss = ex.ko;
                                        break;
                                    }
                                }
                            }
                            // 백업: dictMeta.examples도 확인 (하위 호환성)
                            else if (v?.dictMeta?.examples) {
                                const examples = Array.isArray(v.dictMeta.examples) 
                                    ? v.dictMeta.examples 
                                    : JSON.parse(v.dictMeta.examples);
                                
                                for (const ex of examples) {
                                    if (ex?.definitions && Array.isArray(ex.definitions)) {
                                        for (const def of ex.definitions) {
                                            if (def?.ko_def) {
                                                koGloss = def.ko_def;
                                                break;
                                            }
                                            if (def?.ko) {
                                                koGloss = def.ko;
                                                break;
                                            }
                                        }
                                        if (koGloss !== '뜻 정보 없음') break;
                                    }
                                    if (ex?.koGloss) {
                                        koGloss = ex.koGloss;
                                        break;
                                    }
                                    if (ex?.kind === 'gloss' && ex?.ko) {
                                        koGloss = ex.ko;
                                        break;
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn('Failed to parse examples:', e, v?.dictentry?.examples || v?.dictMeta?.examples);
                        }
                        
                        // IPA 발음 기호 추출
                        const ipa = v?.dictentry?.ipa || null;
                        const ipaKo = v?.dictentry?.ipaKo || null;
                        
                        const uniquePosList = pos ? [...new Set(pos.split(',').map(p => p.trim()))].filter(Boolean) : [];
                        const isSelected = selectedIds.has(itemId);
                        const cardBgInfo = getCardBackgroundColor(item);
                        
                        return (
                            <div key={itemId || cardId} className="col-md-6 col-lg-4 mb-3">
                                <div 
                                    className={`card h-100 ${isSelected ? 'border-primary' : ''} ${cardBgInfo.className} ${item.isMastered ? 'border-purple-300' : ''}`}
                                    style={{
                                        ...item.isMastered ? 
                                            { background: 'linear-gradient(135deg, #ffffff 0%, #f3e8ff 100%)', ...cardBgInfo.style } : 
                                            cardBgInfo.style,
                                        cursor: 'pointer',
                                        transition: 'transform 0.3s ease'
                                    }}
                                    onClick={(e) => {
                                        // Ctrl 클릭시 디버그 정보 출력, 일반 클릭시 카드 뒤집기
                                        if (e.ctrlKey || e.metaKey) {
                                            console.log(`[CARD CLICKED] ${lemma} Debug Info:`, {
                                                lemma,
                                                isOverdue: item.isOverdue,
                                                isMastered: item.isMastered,
                                                learned: item.learned,
                                                wrongCount: item.wrongCount,
                                                stage: item.stage,
                                                cardId: item.cardId,
                                                fullItem: item
                                            });
                                        } else {
                                            handleCardFlip(itemId);
                                        }
                                    }}
                                >
                                    <div 
                                        className="card-header d-flex justify-content-between align-items-center p-2"
                                        style={item.isMastered ? 
                                            { background: 'linear-gradient(135deg, #ffffff 0%, #f3e8ff 100%)', color: '#000' } : 
                                            cardBgInfo.style
                                        }
                                    >
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleToggleSelect(itemId)}
                                            title="단어 선택"
                                        />
                                        <div className="d-flex gap-1 align-items-center small text-muted">
                                            {item.isMastered && (
                                                <span className="text-purple-600 fw-bold">🌟 마스터 완료</span>
                                            )}
                                            {!item.isMastered && folder?.learningCurveType === 'free' ? (
                                                // 자율학습모드 - 간단한 정답/오답 표시
                                                <div className="d-flex gap-1">
                                                    {item.isOverdue ? (
                                                        <span className="text-warning fw-bold">⚠️ 복습 대기중</span>
                                                    ) : (item.correctTotal > 0 || item.wrongTotal > 0) ? (
                                                        <>
                                                            <span className="text-success">✓ {item.correctTotal || 0}</span>
                                                            <span className="text-danger">✗ {item.wrongTotal || 0}</span>
                                                        </>
                                                    ) : (
                                                        <span className="text-muted">미학습</span>
                                                    )}
                                                </div>
                                            ) : (
                                                // 일반 SRS 모드
                                                <>
                                                    {/* 디버깅용 로그 */}
                                                    {console.log(`[CARD DEBUG] ${item.vocab?.lemma || 'Unknown'}: isMastered=${item.isMastered}, isOverdue=${item.isOverdue}, learned=${item.learned}, wrongCount=${item.wrongCount}, stage=${item.stage}`)}
                                                    
                                                    {item.isOverdue ? (
                                                        <span className="text-warning fw-bold">⚠️ 복습 대기중</span>
                                                    ) : item.isMastered ? (
                                                        <span className="text-primary fw-bold">★ 마스터</span>
                                                    ) : item.learned ? (
                                                        <span className="text-success">✓ 학습완료</span>
                                                    ) : item.wrongCount > 0 ? (
                                                        <span className="text-danger">✗ 오답 {item.wrongCount}회</span>
                                                    ) : (
                                                        <span className="text-muted">미학습</span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div 
                                        className="card-body pt-2"
                                        style={item.isMastered ? 
                                            { background: 'linear-gradient(135deg, #ffffff 0%, #f3e8ff 100%)', color: '#000' } : 
                                            cardBgInfo.style
                                        }
                                    >
                                        {!flippedCards.has(itemId) ? (
                                            // 앞면
                                            <>
                                                <div className="d-flex align-items-center mb-2">
                                                    <h5 className="card-title mb-0 me-2" lang="en">{lemma}</h5>
                                                    {/* 마스터 별을 제목 옆에 인라인 배치 */}
                                                    {item.isMastered && (
                                                        <RainbowStar 
                                                            size="small" 
                                                            cycles={item.masterCycles || 1} 
                                                            animated={true}
                                                            className="me-2"
                                                        />
                                                    )}
                                                    <div className="d-flex gap-1 flex-wrap">
                                                        {level && <span className={`badge ${getCefrBadgeColor(level)}`}>{level}</span>}
                                                        {uniquePosList.map(p => (
                                                            p && p.toLowerCase() !== 'unk' && (
                                                                <span key={p} className={`badge ${getPosBadgeColor(p)} fst-italic`}>
                                                                    {p}
                                                                </span>
                                                            )
                                                        ))}
                                                    </div>
                                                </div>
                                                <Pron ipa={ipa} ipaKo={ipaKo} />
                                                <div className="card-subtitle text-muted mt-2">{koGloss}</div>
                                            </>
                                        ) : (
                                            // 뒷면 - 예문과 마지막 학습일
                                            <>
                                                <div className="text-center mb-3">
                                                    <h5 className="card-title mb-2" lang="en">{lemma}</h5>
                                                </div>
                                                
                                                {/* 예문 표시 */}
                                                <div className="mb-3">
                                                    {(() => {
                                                        try {
                                                            // VocabDetailModal과 동일한 로직 사용
                                                            const dictentry = v?.dictentry || {};
                                                            const rawMeanings = Array.isArray(dictentry.examples) ? dictentry.examples : [];
                                                            
                                                            if (rawMeanings.length === 0) {
                                                                return <div className="text-muted small">예문이 없습니다.</div>;
                                                            }
                                                            
                                                            const examples = [];
                                                            
                                                            // VocabDetailModal처럼 meanings를 처리
                                                            for (const meaning of rawMeanings) {
                                                                if (meaning.definitions && Array.isArray(meaning.definitions)) {
                                                                    for (const defItem of meaning.definitions) {
                                                                        if (defItem.examples && Array.isArray(defItem.examples)) {
                                                                            for (const ex of defItem.examples) {
                                                                                if (ex.de && ex.ko) {
                                                                                    examples.push({
                                                                                        german: ex.de,
                                                                                        korean: ex.ko
                                                                                    });
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                            
                                                            if (examples.length > 0) {
                                                                return (
                                                                    <div>
                                                                        {examples.slice(0, 2).map((ex, idx) => (
                                                                            <div key={idx} className="mb-2 p-2 bg-light rounded">
                                                                                <div className="fw-bold text-dark" lang="de">{ex.german}</div>
                                                                                <div className="text-muted small">— {ex.korean}</div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                );
                                                            } else {
                                                                return <div className="text-muted small">예문이 없습니다.</div>;
                                                            }
                                                        } catch (e) {
                                                            console.warn('Failed to parse examples for card flip:', e);
                                                            return <div className="text-muted small">예문을 불러올 수 없습니다.</div>;
                                                        }
                                                    })()}
                                                </div>
                                                
                                                {/* 마지막 학습일 표시 */}
                                                <div>
                                                    {item.lastReviewedAt ? (
                                                        <div className="text-success small mb-1">
                                                            ✅ 마지막 학습: {fmt(item.lastReviewedAt)}
                                                        </div>
                                                    ) : (
                                                        <div className="text-muted small mb-1">
                                                            아직 학습하지 않았습니다.
                                                        </div>
                                                    )}
                                                    {item.lastWrongAt && (
                                                        <div className="text-danger small mb-1">
                                                            ❌ 마지막 오답: {fmt(item.lastWrongAt)}
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                        
                                        {/* SRS 정보 표시 - 뒷면에서는 숨김 */}
                                        {!flippedCards.has(itemId) && (
                                            <div className="mt-3 pt-2 border-top">
                                            <div className="d-flex justify-content-between align-items-center small">
                                                <div>
                                                    {item.isMastered ? (
                                                        <div>
                                                            <span className="badge bg-purple-600 text-white">마스터 완료</span>
                                                            {item.masterCycles > 1 && (
                                                                <span className="badge bg-purple-100 text-purple-800 ms-1">
                                                                    {item.masterCycles}회 달성
                                                                </span>
                                                            )}
                                                            {item.masteredAt && (
                                                                <div className="text-purple-600 small mt-1">
                                                                    🏆 {fmt(item.masteredAt)} 완료
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : folder?.learningCurveType === 'free' ? (
                                                        // 자율학습모드 - 다른 정보 표시
                                                        <div>
                                                            <span className="badge bg-success">🎯 자율학습</span>
                                                            <div className="mt-1 text-muted small">
                                                                Stage {item.stage ?? 0}
                                                                {(item.correctTotal > 0 || item.wrongTotal > 0) && (
                                                                    <span className="ms-2">
                                                                        정답 {item.correctTotal || 0}회, 오답 {item.wrongTotal || 0}회
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {item.lastReviewedAt && (
                                                                <div className="text-muted small mt-1">
                                                                    마지막 학습: {fmt(item.lastReviewedAt)}
                                                                </div>
                                                            )}
                                                            {item.lastWrongAt && (
                                                                <div className="text-danger small mt-1">
                                                                    마지막 오답: {fmt(item.lastWrongAt)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        // 일반 SRS 모드
                                                        <div>
                                                            <span className="badge bg-info">Stage {item.stage ?? 0}</span>
                                                            <div className="ms-2 mt-1">
                                                                {item.nextReviewAt && !item.isOverdue && (
                                                                    <div className="text-muted small">
                                                                        다음 복습: {fmt(item.nextReviewAt)}
                                                                    </div>
                                                                )}
                                                                {/* ReviewTimer props 디버깅 */}
                                                                {item.vocab?.lemma === 'Achieve' && console.log('[ReviewTimer Props]', {
                                                                    nextReviewAt: item.nextReviewAt,
                                                                    waitingUntil: item.waitingUntil,
                                                                    isOverdue: item.isOverdue,
                                                                    overdueDeadline: item.overdueDeadline,
                                                                    isFromWrongAnswer: item.isFromWrongAnswer,
                                                                    frozenUntil: item.frozenUntil,
                                                                    isMastered: item.isMastered
                                                                })}
                                                                <ReviewTimer 
                                                                    nextReviewAt={item.nextReviewAt}
                                                                    waitingUntil={item.waitingUntil}
                                                                    isOverdue={item.isOverdue}
                                                                    overdueDeadline={item.overdueDeadline}
                                                                    isFromWrongAnswer={item.isFromWrongAnswer}
                                                                    frozenUntil={item.frozenUntil}
                                                                    isMastered={item.isMastered}
                                                                    stage={item.stage}
                                                                    className="small"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                {/* 우측 통계 정보 */}
                                                <div className="text-end">
                                                    {folder?.learningCurveType === 'free' ? (
                                                        // 자율학습모드에서는 총 정답/오답 횟수 표시
                                                        <div>
                                                            {(item.correctTotal > 0 || item.wrongTotal > 0) && (
                                                                <div className="small">
                                                                    <span className="badge bg-success">✓ {item.correctTotal || 0}</span>
                                                                    <span className="badge bg-danger ms-1">✗ {item.wrongTotal || 0}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        // 일반 모드에서는 폴더 오답 횟수 표시
                                                        item.wrongCount > 0 && (
                                                            <span className="badge bg-danger">
                                                                오답 {item.wrongCount}회
                                                            </span>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </main>
    );
}