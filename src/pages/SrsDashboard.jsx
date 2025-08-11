// src/pages/SrsDashboard.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import { fetchJSON, withCreds } from "../api/client";
import { SrsApi } from "../api/srs";

dayjs.locale("ko");

function fmt(d) {
    if (!d) return "-";
    return dayjs(d).format("YYYY.MM.DD (ddd)");
}
function isDue(nextReviewDate) {
    return dayjs(nextReviewDate).isSame(dayjs(), "day") || dayjs(nextReviewDate).isBefore(dayjs(), "day");
}

export default function SrsDashboard() {
    const [folders, setFolders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newFolderName, setNewFolderName] = useState("");
    const [streakInfo, setStreakInfo] = useState(null);
    const [wrongAnswersCount, setWrongAnswersCount] = useState(0);

    const reload = async () => {
        setLoading(true);
        try {
            const { data } = await fetchJSON("/srs/dashboard", withCreds());
            // 서버가 nextReviewAt로 주던 과거 호환
            const normalized = (data || []).map(f => ({
                ...f,
                nextReviewDate: f.nextReviewDate ?? f.nextReviewAt,
                isDue: f.nextReviewDate ? isDue(f.nextReviewDate) : (f.kind === 'manual' && !f.isCompleted)
            }));
            setFolders(normalized);
            
            // Streak 정보 로드
            const streakRes = await fetchJSON("/srs/streak", withCreds());
            setStreakInfo(streakRes.data);
            
            // 오답노트 개수 로드
            const wrongRes = await fetchJSON("/srs/wrong-answers/count", withCreds());
            setWrongAnswersCount(wrongRes.data.count);
            
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { reload(); }, []);

    async function deleteFolderSafely(e, id, reload) {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm("폴더를 삭제하시겠습니까? (연결된 아이템도 함께 삭제)")) return;
        await SrsApi.deleteFolder(id);
        await reload();
    }
    const handleCreateFolder = async (e) => {
        e.preventDefault();
        const name = newFolderName.trim();
        if (!name) { alert("폴더 이름을 입력하세요."); return; }
        try {
            await fetchJSON("/srs/folders", withCreds({
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            }));
            setNewFolderName("");
            await reload();
        } catch (e) {
            alert(`폴더 생성 실패: ${e.message || "Unknown error"}`);
        }
    };

    const toggleAlarm = async (folder) => {
        const turnOn = !folder.alarmActive;
        if (turnOn && !window.confirm("알림을 다시 켜면 진행도가 stage 0으로 초기화됩니다. 계속하시겠습니까?")) return;
        try {
            await fetchJSON(`/srs/folders/${folder.id}/alarm`, withCreds({
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ active: turnOn }),
            }));
            await reload();
        } catch (e) {
            alert(`알림 상태 변경 실패: ${e.message || "Unknown error"}`);
        }
    };

    const restartMasteredFolder = async (folder) => {
        if (!window.confirm(`${folder.name}을 새로운 120일 사이클로 재시작하시겠습니까?\n\n모든 단어가 미학습 상태로 리셋되고 Stage 0부터 다시 시작합니다.`)) return;
        
        try {
            await fetchJSON(`/srs/folders/${folder.id}/restart`, withCreds({
                method: "POST"
            }));
            alert("마스터된 폴더가 재시작되었습니다. 새로운 120일 사이클이 시작됩니다!");
            await reload();
        } catch (e) {
            alert(`폴더 재시작 실패: ${e.message || "Unknown error"}`);
        }
    };

    return (
        <main className="container py-4">
            <h2 className="mb-4">SRS 학습 🧠</h2>

            {/* Streak 정보 및 오답노트 */}
            {streakInfo && (
                <div className="row mb-4">
                    <div className="col-md-6">
                        <div className="card">
                            <div className="card-body">
                                <h5 className="card-title">🔥 연속 학습</h5>
                                <h2 className="text-primary mb-2">{streakInfo.streak}일</h2>
                                <div className="progress mb-2" style={{height: '20px'}}>
                                    <div 
                                        className="progress-bar" 
                                        style={{width: `${(streakInfo.dailyQuizCount / streakInfo.requiredDaily) * 100}%`}}
                                    >
                                        {streakInfo.dailyQuizCount}/{streakInfo.requiredDaily}
                                    </div>
                                </div>
                                <small className="text-muted">
                                    오늘 {streakInfo.remainingForStreak > 0 ? 
                                        `${streakInfo.remainingForStreak}개 더 필요` : 
                                        '목표 달성! 🎉'}
                                </small>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-6">
                        <div className="card">
                            <div className="card-body">
                                <h5 className="card-title">📝 오답노트</h5>
                                <h2 className="text-warning mb-2">{wrongAnswersCount}개</h2>
                                <Link to="/srs/wrong-answers" className="btn btn-outline-warning btn-sm">
                                    오답노트 보기
                                </Link>
                                {wrongAnswersCount > 0 && (
                                    <Link to="/srs/wrong-answers/quiz" className="btn btn-warning btn-sm ms-2">
                                        복습하기
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <form onSubmit={handleCreateFolder} className="d-flex gap-2 mb-4">
                <input
                    type="text"
                    className="form-control"
                    placeholder="새 학습 폴더 이름..."
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                />
                <button type="submit" className="btn btn-primary">만들기</button>
            </form>

            {loading ? <div className="spinner-border" /> : (
                <div className="list-group">
                    {folders.map(f => (
                        <Link
                            to={`/srs/folder/${f.id}`}
                            key={f.id}
                            className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                        >
                            <div>
                                <h5 className={`mb-1 ${f.isDue && !f.isMastered ? "text-primary" : ""}`}>
                                    {f.name}
                                    {f.kind === 'manual' && !f.isMastered && <span className="badge bg-secondary ms-2">수동</span>}
                                    {f.kind === 'review' && !f.isMastered && <span className="badge bg-info ms-2">복습</span>}
                                    {f.isMastered && <span className="badge bg-warning text-dark ms-2">🏆 마스터</span>}
                                    {f.isCompleted && !f.isMastered && <span className="badge bg-success ms-2">완료</span>}
                                </h5>
                                <small>
                                    생성일: <strong>{fmt(f.createdDate ?? f.createdAt ?? f.date ?? null)}</strong>
                                    <span className="mx-2">|</span>
                                    {f.isMastered ? (
                                        <>
                                            <strong className="text-warning">🏆 {f.completionCount || 1}회차 마스터 완료</strong>
                                            <span className="mx-2">|</span>
                                            <span className="text-muted">알림 비활성화</span>
                                        </>
                                    ) : (
                                        <>
                                            {f.kind === 'manual' && !f.isCompleted ? 
                                                <strong className="text-primary">학습 중</strong> :
                                                f.isDue
                                                    ? <strong className="text-success">오늘 복습!</strong>
                                                    : <>다음 복습: <strong>{fmt(f.nextReviewDate)}</strong></>}
                                            <span className="mx-2">|</span>
                                            Stage {f.stage}
                                        </>
                                    )}
                                    <span className="mx-2">|</span>
                                    카드 {f.total ?? 0}개
                                    {f.counts && (
                                        <>
                                            <span className="mx-2">|</span>
                                            <span className="text-success">완료 {f.counts.learned}</span> / 
                                            <span className="text-warning"> 남은 {f.counts.remaining}</span>
                                        </>
                                    )}
                                </small>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                                {f.isMastered ? (
                                    <>
                                        <button
                                            className="btn btn-sm btn-warning"
                                            onClick={(e) => { e.preventDefault(); restartMasteredFolder(f); }}
                                            title="새로운 120일 사이클 재시작"
                                        >
                                            🔄 재시작
                                        </button>
                                        <span className="text-muted small">🔕 알림 OFF</span>
                                    </>
                                ) : (
                                    <button
                                        className="btn btn-sm"
                                        onClick={(e) => { e.preventDefault(); toggleAlarm(f); }}
                                        title={f.alarmActive ? "알림 끄기" : "알림 켜기 (stage 0 초기화)"}
                                    >
                                        {f.alarmActive ? "🔔" : "🔕"}
                                    </button>
                                )}
                                <button
                                    className="btn btn-sm btn-outline-danger"
                                    title="폴더 삭제"
                                    onClick={(e) => deleteFolderSafely(e, f.id, reload)}
                                >
                                    🗑️
                                </button>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {!loading && folders.length === 0 && (
                <div className="text-center p-5 bg-light rounded">
                    <h4>복습할 폴더가 없습니다.</h4>
                    <p>위에서 새 복습 폴더를 만들어 단어를 추가해보세요.</p>
                </div>
            )}
        </main>
    );
}
