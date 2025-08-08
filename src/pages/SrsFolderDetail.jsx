// src/pages/SrsFolderDetail.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchJSON, withCreds } from '../api/client';

export default function SrsFolderDetail() {
    const { id } = useParams();          // 루트 폴더 ID
    const navigate = useNavigate();

    const [root, setRoot] = useState(null);
    const [children, setChildren] = useState([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [creating, setCreating] = useState(false);

    async function reload() {
        setLoading(true);
        try {
            const { data } = await fetchJSON(`/srs/folders/${id}/children`, withCreds());
            setRoot(data.root);
            setChildren(Array.isArray(data.children) ? data.children : []);
        } catch (e) {
            alert(`폴더를 불러오지 못했습니다: ${e.message || '서버 오류'}`);
            navigate('/srs');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { reload(); /* id 변경 시 재조회 */ }, [id]);

    async function createSub() {
        if (!name.trim()) return alert('하위 폴더 이름을 입력하세요.');
        try {
            await fetchJSON(`/srs/folders/${id}/subfolders`, withCreds({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            }));
            setName('');
            await reload();
        } catch (e) {
            // ✅ 서버가 409로 보내면 그냥 "중복" 안내만 하고 목록을 새로고침
            if (e.status === 409) {
                alert('같은 이름의 하위 폴더가 이미 있습니다.');
                await reload();
            } else {
                alert('하위 폴더 생성 실패');
                console.error(e);
            }
        }
    }


    async function deleteFolder(folderId) {
        if (!window.confirm('이 폴더를 삭제하시겠습니까? 폴더 내 카드가 모두 삭제됩니다.')) return;
        try {
            await fetchJSON(`/srs/folders/${folderId}`, withCreds({ method: 'DELETE' }));
            await reload();
        } catch (e) {
            alert(`삭제 실패: ${e.message || '서버 오류'}`);
        }
    }

    if (loading) {
        return (
            <main className="container py-5 text-center">
                <div className="spinner-border" role="status" />
            </main>
        );
    }

    return (
        <main className="container py-4">
            {/* 상단 바: 제목 + 대시보드로 */}
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="mb-0">{root?.name} (루트)</h4>
                <Link className="btn btn-outline-secondary btn-sm" to="/srs">← 대시보드</Link>
            </div>

            {/* 하위 폴더 만들기 */}
            <div className="input-group mb-3" style={{ maxWidth: 480 }}>
                <input
                    className="form-control"
                    placeholder="하위 폴더 이름"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') createSub(); }}
                />
                <button className="btn btn-primary" onClick={createSub} disabled={creating}>
                    {creating ? '만드는 중…' : '하위 폴더 만들기'}
                </button>
            </div>

            {/* 하위 폴더 목록 */}
            {children.length === 0 ? (
                <div className="alert alert-info">하위 폴더가 없습니다. 위에서 새로 만드세요.</div>
            ) : (
                <div className="row g-3">
                    {children.map(c => (
                        <div className="col-12 col-md-6 col-lg-4" key={c.id}>
                            <div className="card h-100">
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <h5 className="mb-0">{c.name}</h5>
                                        <button
                                            className="btn btn-sm btn-outline-danger"
                                            onClick={() => deleteFolder(c.id)}
                                            title="하위 폴더 삭제"
                                        >
                                            삭제
                                        </button>
                                    </div>
                                    <div className="mt-2 text-muted">
                                        완료: {c.completed} / 총: {c.total}
                                        {c.incorrect > 0 && <span className="ms-2 text-danger">오답: {c.incorrect}</span>}
                                    </div>
                                    <div className="d-flex gap-2 mt-3">
                                        <Link className="btn btn-sm btn-primary" to={`/srs/quiz?folder=${c.id}`}>퀴즈 시작</Link>
                                        <Link className="btn btn-sm btn-outline-secondary" to={`/vocab?addToFolder=${c.id}`}>카드 추가</Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </main>
    );
}
