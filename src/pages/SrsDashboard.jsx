// src/pages/SrsDashboard.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchJSON, withCreds } from '../api/client';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';

dayjs.locale('ko');

const FolderIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-folder-fill me-3" viewBox="0 0 16 16">
        <path d="M9.828 3h-3.982a2 2 0 0 0-1.992 2.181l.637 7A2 2 0 0 0 6.489 14h4.022a2 2 0 0 0 1.992-1.819l.637-7A2 2 0 0 0 9.828 3m-3.122.502c.06.13.14.253.24.364l.707.707a1 1 0 0 0 .707.293H7.88a1 1 0 0 1 .707-.293l.707-.707a1 1 0 0 0 .24-.364H6.706z"/>
    </svg>
);


export default function SrsDashboard() {
    const [folders, setFolders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const ac = new AbortController();
        fetchJSON('/srs/dashboard', withCreds({ signal: ac.signal }))
            .then(({ data }) => setFolders(data || []))
            .catch(err => console.error("대시보드 로드 실패:", err))
            .finally(() => setLoading(false));
        return () => ac.abort();
    }, []);

    const todayStr = dayjs().format('YYYY-MM-DD');

    return (
        <main className="container py-4">
            <h2 className="mb-4">SRS 복습</h2>
            <p className="text-muted">날짜별로 정리된 폴더를 학습하세요. 오늘 학습할 단어가 있는 폴더는 🔔 아이콘으로 표시됩니다.</p>
            
            {loading && <div className="spinner-border" />}
            
            <div className="list-group">
                {folders.map(folder => {
                    const isToday = folder.date === todayStr;
                    const isDue = dayjs(folder.date).isSameOrBefore(dayjs(), 'day');

                    return (
                        <Link key={folder.date} to={`/srs/quiz?date=${folder.date}`} 
                              className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center p-3 ${isToday ? 'active' : ''}`}>
                            <div className="d-flex align-items-center">
                                <FolderIcon/>
                                <div>
                                    <h5 className="mb-1 fw-bold">
                                        {isToday ? '오늘 복습' : dayjs(folder.date).format('M월 D일 (dddd)')}
                                        {isDue && folder.completed < folder.total && <span className="ms-2">🔔</span>}
                                    </h5>
                                    <small>
                                        완료: {folder.completed} / 총: {folder.total}
                                        {folder.incorrect > 0 && <span className="ms-2 text-danger">● 오답: {folder.incorrect}</span>}
                                    </small>
                                </div>
                            </div>
                            <span className="badge bg-light text-dark rounded-pill fs-6">{folder.total}</span>
                        </Link>
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