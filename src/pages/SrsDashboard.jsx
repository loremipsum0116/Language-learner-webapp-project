// src/pages/SrsDashboard.jsx (교체)

import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import "dayjs/locale/ko";
import { fetchJSON, withCreds } from "../api/client";

dayjs.extend(isSameOrBefore);
dayjs.locale("ko");

const FolderIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor"
        className="bi bi-folder-fill me-3" viewBox="0 0 16 16">
        <path d="M9.828 3h-3.982a2 2 0 0 0-1.992 2.181l.637 7A2 2 0 0 0 6.489 14h4.022a2 2 0 0 0 1.992-1.819l.637-7A2 2 0 0 0 9.828 3m-3.122.502c.06.13.14.253.24.364l.707.707a1 1 0 0 0 .707.293H7.88a1 1 0 0 1 .707-.293l.707-.707a1 1 0 0 0 .24-.364H6.706z" />
    </svg>
);

export default function SrsDashboard() {
    const [folders, setFolders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false)
    const navigate = useNavigate();
    const [selected, setSelected] = useState(new Set());
    const allSelected = folders.length > 0 && folders.every(f => selected.has(f.id));

    const toggleOne = (id) => {
        setSelected(prev => {
            const s = new Set(prev);
            s.has(id) ? s.delete(id) : s.add(id);
            return s;
        });
    };
    const toggleAll = () => {
        setSelected(prev => allSelected ? new Set() : new Set(folders.map(f => f.id)));
    };
    const deleteSelected = async () => {
        const ids = Array.from(selected);
        if (ids.length === 0) return;
        if (!window.confirm(`선택한 ${ids.length}개 폴더를 삭제하시겠습니까? 하위 폴더/카드도 함께 삭제됩니다.`)) return;
        try {
            await fetchJSON('/srs/folders/bulk-delete', withCreds({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            }));
            setSelected(new Set());
            await reload();
        } catch (e) {
            console.error(e);
            alert('선택 삭제 실패');
        }
    };
    // 목록 로드
    const reload = async () => {
        const ac = new AbortController();
        try {
            setLoading(true);
            const { data } = await fetchJSON("/srs/dashboard", withCreds({ signal: ac.signal }));
            setFolders(data || []);
        } catch (err) {
            console.error("대시보드 로드 실패:", err);
            alert("대시보드 데이터를 불러오지 못했습니다.");
        } finally {
            setLoading(false);
            ac.abort();
        }
    };
    useEffect(() => { reload(); }, []);


    const todayStr = dayjs().format("YYYY-MM-DD");

    return (
        <main className="container py-4">
            <h2 className="mb-4">SRS 복습</h2>
            {/* 상단 액션 바: 전체선택/선택삭제 */}
            <div className="d-flex align-items-center gap-2 mb-2">
                <div className="form-check">
                    <input id="chk-all" className="form-check-input" type="checkbox"
                        checked={allSelected} onChange={toggleAll} disabled={folders.length === 0} />
                    <label className="form-check-label" htmlFor="chk-all">
                        전체 선택 ({selected.size}/{folders.length})
                    </label>
                </div>
                <button className="btn btn-outline-danger btn-sm"
                    disabled={selected.size === 0}
                    onClick={deleteSelected}>
                    선택 삭제
                </button>
                <div className="ms-auto" />
                <button
                    type="button"
                    id="btn-create-folder"
                    className="btn btn-outline-primary"
                    disabled={creating}
                    onClick={async () => {
                        try {
                            console.log("[UI] 폴더 만들기 클릭");
                            setCreating(true);
                            const res = await fetchJSON('/srs/folders/quick-create', withCreds({
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ kind: 'review', enableAlarm: true })
                            }));
                            const folderId = res?.data?.id ?? res?.id;
                            const created = res?.data?.created ?? true;
                            if (!created) alert('날짜 폴더는 하루에 하나만 만들 수 있습니다.');
                            console.log("[UI] quick-create 응답:", res);
                            if (folderId) {
                                // ✅ 방금 만든(또는 기존) ‘오늘 날짜’ 루트 폴더 상세로 이동
                                navigate(`/srs/folder/${folderId}`);
                            } else {
                                await reload(); // 폴더 ID가 없으면 재조회 fallback
                            }// 성공 시 목록 재조회
                        } catch (e) {
                            console.error(e);
                            alert("폴더 생성 실패");
                        } finally {
                            setCreating(false);
                        }
                    }}
                >
                    {creating ? "만드는 중…" : "폴더 만들기"}
                </button>
            </div>
            <p className="text-muted">
                날짜별로 정리된 폴더를 학습하세요. 오늘 학습할 단어가 있는 폴더는 🔔 아이콘으로 표시됩니다.
            </p>

            {loading && <div className="spinner-border" />}

            <div className="list-group">
                {folders.map(folder => {
                    const isToday = folder.date === todayStr;
                    const isDue = dayjs(folder.date).isSameOrBefore(dayjs(), "day");
                    const targetHref = folder.id
                        ? `/srs/folder/${folder.id}`
                        : `/srs/folder/date/${folder.date}`;
                    return (
                        <div
                            key={folder.id ?? folder.date}
                            className={`list-group-item d-flex justify-content-between align-items-center p-3 ${isToday ? "active" : ""}`}
                        >
                            <div className="d-flex align-items-center" style={{ gap: 12 }}>
                                {/* 개별 체크 */}
                                <input
                                    type="checkbox"
                                    className="form-check-input"
                                    checked={selected.has(folder.id)}
                                    onChange={(e) => toggleOne(folder.id)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                {/* 카드 본문(클릭 시 상세로 이동) */}
                                <Link to={targetHref} className="text-reset text-decoration-none d-flex align-items-center">
                                    <FolderIcon />
                                    <div>
                                        <h5 className="mb-1 fw-bold">
                                            {isToday ? "오늘 복습" : dayjs(folder.date).format("M월 D일 (dddd)")}
                                            {isDue && folder.completed < folder.total && <span className="ms-2">🔔</span>}
                                        </h5>
                                        <small>
                                            완료: {folder.completed} / 총: {folder.total}
                                            {folder.incorrect > 0 && <span className="ms-2 text-danger">● 오답: {folder.incorrect}</span>}
                                        </small>
                                    </div>
                                </Link>
                            </div>
                            <div className="d-flex align-items-center" style={{ gap: 8 }}>
                                <span className="badge bg-light text-dark rounded-pill fs-6">{folder.total}</span>
                                {/* 개별 휴지통 아이콘 */}
                                <button
                                    className="btn btn-outline-danger btn-sm"
                                    title="폴더 삭제"
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        if (!window.confirm('이 폴더를 삭제하시겠습니까? 하위 폴더/카드도 함께 삭제됩니다.')) return;
                                        try {
                                            await fetchJSON(`/srs/folders/${folder.id}`, withCreds({ method: 'DELETE' }));
                                            setSelected(prev => {
                                                const s = new Set(prev); s.delete(folder.id); return s;
                                            });
                                            await reload();
                                        } catch (err) {
                                            console.error(err);
                                            alert('폴더 삭제 실패');
                                        }
                                    }}
                                >
                                    🗑
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {!loading && folders.length === 0 && (
                <div className="text-center p-5 bg-light rounded">
                    <h4>복습할 카드가 없습니다.</h4>
                    <p>단어장에서 새로운 단어를 추가해보세요.</p>
                    <Link to="/vocab" className="btn btn-primary">전체 단어 보러가기</Link>
                </div>
            )}
        </main>
    );
}
