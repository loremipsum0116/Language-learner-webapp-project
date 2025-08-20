// src/pages/SrsParentFolder.jsx
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchJSON, withCreds } from "../api/client";
import { SrsApi } from "../api/srs";
import dayjs from "dayjs";
import "dayjs/locale/ko";

dayjs.locale("ko");

function fmt(d) {
    if (!d) return "-";
    return dayjs(d).format("YYYY.MM.DD (ddd)");
}

export default function SrsParentFolder() {
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const [parentFolder, setParentFolder] = useState(null);
    const [children, setChildren] = useState([]);
    const [newSubFolderName, setNewSubFolderName] = useState("");

    const reload = async () => {
        setLoading(true);
        try {
            const { data } = await fetchJSON(`/srs/folders/${id}/children`, withCreds());
            setParentFolder(data.parentFolder);
            
            // 각 하위 폴더의 items를 가져와서 상세페이지와 동일한 계산 수행
            const childrenWithStats = await Promise.all(
                (data.children || []).map(async (child) => {
                    if (child.learningCurveType === 'free') {
                        try {
                            const folderData = await SrsApi.getFolderItems(child.id);
                            const items = folderData?.quizItems ?? folderData?.items ?? [];
                            
                            // 상세페이지와 동일한 계산 로직
                            const correctWords = items.filter(item => {
                                if (!item.lastReviewedAt) return false;
                                if (!item.lastWrongAt) return true;
                                return new Date(item.lastReviewedAt) > new Date(item.lastWrongAt);
                            }).length;
                            
                            const wrongAnswers = items.filter(item => {
                                if (!item.lastWrongAt) return false;
                                if (!item.lastReviewedAt) return true;
                                return new Date(item.lastWrongAt) >= new Date(item.lastReviewedAt);
                            }).length;
                            
                            const learningWaiting = items.filter(item => !item.lastReviewedAt && !item.lastWrongAt).length;
                            
                            return {
                                ...child,
                                correctWords,
                                wrongAnswers,
                                learningWaiting
                            };
                        } catch (e) {
                            console.error(`Failed to load items for folder ${child.id}:`, e);
                            return child; // 실패시 원본 데이터 사용
                        }
                    }
                    return child; // 자율모드가 아니면 원본 데이터 사용
                })
            );
            
            setChildren(childrenWithStats);
        } catch (e) {
            console.error('Failed to load parent folder:', e);
            alert('폴더를 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { reload(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleCreateSubFolder = async (e) => {
        e.preventDefault();
        const name = newSubFolderName.trim();
        if (!name) { 
            alert("하위 폴더 이름을 입력하세요."); 
            return; 
        }
        
        try {
            await fetchJSON("/srs/folders", withCreds({
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, parentId: parseInt(id) }),
            }));
            setNewSubFolderName("");
            await reload();
        } catch (e) {
            alert(`하위 폴더 생성 실패: ${e.message || "Unknown error"}`);
        }
    };

    const handleDeleteSubFolder = async (childId, childName) => {
        if (!window.confirm(`"${childName}" 하위 폴더를 삭제하시겠습니까? (포함된 카드도 함께 삭제됩니다)`)) {
            return;
        }
        
        try {
            await SrsApi.deleteFolder(childId);
            await reload();
        } catch (e) {
            alert(`폴더 삭제 실패: ${e.message || "Unknown error"}`);
        }
    };

    if (loading) {
        return (
            <div className="container mt-4">
                <div className="spinner-border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    if (!parentFolder) {
        return (
            <div className="container mt-4">
                <div className="alert alert-danger">
                    상위 폴더를 찾을 수 없습니다.
                </div>
                <Link to="/srs" className="btn btn-secondary">
                    ← SRS 대시보드로 돌아가기
                </Link>
            </div>
        );
    }

    return (
        <div className="container mt-4">
            {/* 헤더 */}
            <div className={`d-flex justify-content-between align-items-center mb-4 ${
                parentFolder.isFolderMastered ? 'p-3 rounded' : ''
            }`} style={parentFolder.isFolderMastered ? {
                background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                boxShadow: '0 8px 16px rgba(33, 150, 243, 0.3)',
                border: '3px solid #2196f3'
            } : {}}>
                <div>
                    <h1 className={`h3 ${parentFolder.isFolderMastered ? 'text-primary' : ''}`}>
                        {parentFolder.isFolderMastered ? '🌟' : '📁'} {parentFolder.name}
                        {parentFolder.isFolderMastered && <span className="ms-2">✨ 완전 정복! ✨</span>}
                    </h1>
                    <small className={parentFolder.isFolderMastered ? 'text-primary' : 'text-muted'}>
                        생성일: {fmt(parentFolder.createdDate)} | 하위 폴더 {children.length}개
                        {parentFolder.isFolderMastered && parentFolder.folderMasteredAt && (
                            <span className="ms-2 badge bg-primary">
                                완료일: {fmt(parentFolder.folderMasteredAt)}
                            </span>
                        )}
                    </small>
                </div>
                <Link to="/srs" className="btn btn-outline-secondary">
                    ← SRS 대시보드
                </Link>
            </div>

            {/* 안내 메시지 */}
            <div className="alert alert-info mb-4">
                <h6 className="alert-heading">📌 3단계 구조 안내</h6>
                <p className="mb-0">
                    이 상위 폴더에는 직접 카드를 추가할 수 없습니다. 
                    아래에서 하위 폴더를 만든 후, 각 하위 폴더에 카드를 추가해 주세요.
                </p>
            </div>

            {/* 하위 폴더 생성 폼 */}
            <div className="card mb-4">
                <div className="card-header">
                    <h5 className="card-title mb-0">🆕 새 하위 폴더 만들기</h5>
                </div>
                <div className="card-body">
                    <form onSubmit={handleCreateSubFolder} className="d-flex gap-2">
                        <input
                            type="text"
                            className="form-control"
                            placeholder="하위 폴더 이름 (예: 명사, 동사, 형용사...)"
                            value={newSubFolderName}
                            onChange={(e) => setNewSubFolderName(e.target.value)}
                        />
                        <button type="submit" className="btn btn-primary">
                            만들기
                        </button>
                    </form>
                </div>
            </div>

            {/* 하위 폴더 목록 */}
            <div className="card">
                <div className="card-header">
                    <h5 className="card-title mb-0">📂 하위 폴더 목록</h5>
                </div>
                <div className="card-body">
                    {children.length === 0 ? (
                        <div className="text-center text-muted py-4">
                            <div className="mb-3">📭</div>
                            <p>아직 하위 폴더가 없습니다.</p>
                            <p className="small">위에서 새 하위 폴더를 만들어 시작해보세요!</p>
                        </div>
                    ) : (
                        <div className="list-group list-group-flush">
                            {children.map(child => (
                                <div
                                    key={child.id}
                                    className={`list-group-item d-flex justify-content-between align-items-center ${
                                        child.isFolderMastered ? 'border-warning bg-gradient' : ''
                                    }`}
                                    style={child.isFolderMastered ? {
                                        background: 'linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%)',
                                        boxShadow: '0 4px 8px rgba(255, 193, 7, 0.3)',
                                        border: '2px solid #ffc107'
                                    } : {}}
                                >
                                    <div className="flex-grow-1">
                                        <Link
                                            to={`/srs/folder/${child.id}`}
                                            className="text-decoration-none"
                                        >
                                            <h6 className="mb-1">
                                                {child.learningCurveType === 'short' ? '🐰' : child.learningCurveType === 'free' ? '🎯' : '🐢'} {child.name}
                                            </h6>
                                            <small className="text-muted">
                                                생성일: {fmt(child.createdDate)}
                                                <span className="mx-2">|</span>
                                                단어 {child.total}개
                                                <span className="mx-2">|</span>
                                                {child.learningCurveType === 'free' ? (
                                                    // 자율모드 통계
                                                    <>
                                                        정답한 단어 {child.correctWords}개
                                                        <span className="mx-2">|</span>
                                                        오답한 단어 {child.wrongAnswers}개
                                                        <span className="mx-2">|</span>
                                                        미학습 {child.learningWaiting}개
                                                    </>
                                                ) : (
                                                    // 일반 SRS 모드 통계
                                                    <>
                                                        복습 <span className="text-warning">{child.reviewWaiting}개</span>
                                                        <span className="mx-2">|</span>
                                                        미학습 <span className="text-info">{child.learningWaiting}개</span>
                                                        <span className="mx-2">|</span>
                                                        오답 <span className="text-danger">{child.wrongAnswers}개</span>
                                                        <span className="mx-2">|</span>
                                                        동결 <span className="text-secondary">{child.frozen}개</span>
                                                        <span className="mx-2">|</span>
                                                        마스터 <span className="text-warning">{child.mastered || 0}개</span>
                                                    </>
                                                )}
                                            </small>
                                        </Link>
                                    </div>
                                    <div className="d-flex align-items-center gap-2">
                                        <Link
                                            to={`/srs/folder/${child.id}`}
                                            className="btn btn-sm btn-outline-primary"
                                        >
                                            관리
                                        </Link>
                                        <button
                                            className="btn btn-sm btn-outline-danger"
                                            onClick={() => handleDeleteSubFolder(child.id, child.name)}
                                            title="하위 폴더 삭제"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 빠른 하위 폴더 생성 버튼들 */}
            {children.length === 0 && (
                <div className="mt-4">
                    <h6 className="text-muted mb-3">💡 빠른 생성 (예시)</h6>
                    <div className="d-flex flex-wrap gap-2">
                        {['명사', '동사', '형용사', '부사', '회화', '문법'].map(name => (
                            <button
                                key={name}
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => setNewSubFolderName(name)}
                            >
                                + {name}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}