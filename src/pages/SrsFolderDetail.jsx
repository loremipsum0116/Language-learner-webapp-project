// src/pages/SrsFolderDetail.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { SrsApi } from "../api/srs";
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

const getCardBackgroundColor = (item) => {
    // 동결 상태 체크 (최우선)
    if (item.frozenUntil) {
        const now = new Date();
        const frozenUntil = new Date(item.frozenUntil);
        if (now < frozenUntil) {
            return 'bg-info-subtle'; // 동결 - 파란색 (최우선)
        }
    }
    
    if (item.isOverdue) return 'bg-warning-subtle'; // overdue - 노란색
    if (item.learned) return 'bg-success-subtle'; // 정답 - 초록색
    if (item.wrongCount > 0) return 'bg-danger-subtle'; // 틀림 - 빨간색
    return ''; // 미학습 - 기본색
};

export default function SrsFolderDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [folder, setFolder] = useState(null);
    const [items, setItems] = useState([]); // 폴더에 담긴 모든 단어
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [deleting, setDeleting] = useState(false);
    const [showWrongOnly, setShowWrongOnly] = useState(false); // 오답 단어만 보기 필터

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

    useEffect(() => { reload(); /* eslint-disable-next-line */ }, [id]);

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
    const filteredItems = showWrongOnly 
        ? items.filter(item => item.wrongCount > 0 || item.isWrongAnswer)
        : items;
        
    const wrongAnswerCount = items.filter(item => item.wrongCount > 0 || item.isWrongAnswer).length;

    return (
        <main className="container py-4">
            {/* 헤더 */}
            <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                    <h4 className="mb-1">{folder.name}</h4>
                    <small className="text-muted">
                        생성일: <strong>{fmt(created)}</strong>
                        <span className="mx-2">|</span>
                        단어 {items.length}개
                        <span className="mx-2">|</span>
                        오답 <span className="text-danger">{wrongAnswerCount}개</span>
                        {showWrongOnly && <span className="text-warning"> (오답만 표시)</span>}
                    </small>
                </div>
                <div className="d-flex gap-2">
                    <Link className="btn btn-outline-secondary btn-sm" to="/srs">← 대시보드</Link>
                    <Link 
                        className="btn btn-primary btn-sm" 
                        to={`/learn/vocab?mode=srs_folder&folderId=${folder.id}${
                            selectedIds.size > 0 
                                ? `&selectedItems=${Array.from(selectedIds).join(',')}` 
                                : ''
                        }`}
                    >
                        복습 시작 {selectedIds.size > 0 ? `(${selectedIds.size}개 선택)` : ''}
                    </Link>
                </div>
            </div>

            {/* 시간 가속 컨트롤 */}
            <div className="mb-4">
                <TimeAcceleratorControl />
            </div>

            {/* 단어 관리 툴바 */}
            {items.length > 0 && (
                <div className="d-flex gap-2 mb-3">
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
                    <div className="ms-auto d-flex gap-2">
                        <button
                            className={`btn btn-sm ${showWrongOnly ? 'btn-warning' : 'btn-outline-warning'}`}
                            onClick={() => setShowWrongOnly(!showWrongOnly)}
                            disabled={wrongAnswerCount === 0}
                        >
                            {showWrongOnly ? '전체 보기' : `오답만 보기 (${wrongAnswerCount})`}
                        </button>
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
                    {showWrongOnly ? "오답 단어가 없습니다. 모든 단어를 정답으로 맞춘 상태입니다!" : "표시할 단어가 없습니다."}
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
                        const cardBgClass = getCardBackgroundColor(item);
                        
                        return (
                            <div key={itemId || cardId} className="col-md-6 col-lg-4 mb-3">
                                <div className={`card h-100 ${isSelected ? 'border-primary' : ''} ${cardBgClass} ${item.isMastered ? 'border-purple-300 bg-gradient-to-br from-white to-purple-50' : ''}`}>
                                    <div className="card-header d-flex justify-content-between align-items-center p-2">
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
                                            {!item.isMastered && item.isOverdue && (
                                                <span className="text-warning fw-bold">⚠️ 복습 대기중</span>
                                            )}
                                            {!item.isMastered && !item.isOverdue && item.learned && <span className="text-success">✓ 학습완료</span>}
                                            {!item.isMastered && !item.isOverdue && !item.learned && item.wrongCount > 0 && (
                                                <span className="text-danger">✗ 오답 {item.wrongCount}회</span>
                                            )}
                                            {!item.isMastered && !item.isOverdue && !item.learned && (!item.wrongCount || item.wrongCount === 0) && (
                                                <span className="text-muted">미학습</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="card-body pt-2">
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
                                        
                                        {/* SRS 정보 표시 */}
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
                                                    ) : (
                                                        <div>
                                                            <span className="badge bg-info">Stage {item.stage ?? 0}</span>
                                                            <div className="ms-2 mt-1">
                                                                {item.nextReviewAt && (
                                                                    <div className="text-muted small">
                                                                        다음 복습: {fmt(item.nextReviewAt)}
                                                                    </div>
                                                                )}
                                                                <ReviewTimer 
                                                                    nextReviewAt={item.nextReviewAt}
                                                                    waitingUntil={item.waitingUntil}
                                                                    isOverdue={item.isOverdue}
                                                                    overdueDeadline={item.overdueDeadline}
                                                                    isFromWrongAnswer={item.isFromWrongAnswer}
                                                                    frozenUntil={item.frozenUntil}
                                                                    isMastered={item.isMastered}
                                                                    className="small"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                {item.wrongCount > 0 && (
                                                    <span className="badge bg-danger">
                                                        오답 {item.wrongCount}회
                                                    </span>
                                                )}
                                            </div>
                                        </div>
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