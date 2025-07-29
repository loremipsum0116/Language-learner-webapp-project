// src/pages/LearnVocab.jsx
import React, { useEffect, useState } from "react";
import { fetchJSON, withCreds } from "../api/client";

export default function LearnVocab() {
    const [queue, setQueue] = useState([]);
    const [idx, setIdx] = useState(0);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState(null);

    useEffect(() => {
        let mounted = true;
        async function load() {
            setLoading(true);
            setErr(null);
            try {
                const d = await fetchJSON("/srs/queue?limit=10", withCreds());
                const arr = d?.data || [];
                if (mounted) {
                    setQueue(arr);
                    setIdx(0);
                }
            } catch (e) {
                setErr(e);
            } finally {
                mounted && setLoading(false);
            }
        }
        load();
        return () => (mounted = false);
    }, []);

    const current = queue[idx];

    async function answer(result) {
        if (!current) return;
        setSubmitting(true);
        try {
            await fetchJSON("/srs/answer", withCreds({ method: "POST", body: JSON.stringify({ cardId: current.id, result }) }));
            setIdx((i) => i + 1);
        } catch (e) {
            setErr(e);
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) return <main className="container py-4">로딩 중…</main>;
    if (err) return <main className="container py-4"><div className="alert alert-danger">에러: {String(err.message || err)}</div></main>;
    if (!current) return <main className="container py-4"><h4>오늘의 카드 완료 🎉</h4></main>;

    return (
        <main className="container py-4" style={{ maxWidth: 720 }}>
            <div className="d-flex justify-content-between mb-2">
                <strong>SRS 진행</strong>
                <span className="text-muted">{idx + 1} / {queue.length}</span>
            </div>
            <div className="card">
                <div className="card-body">
                    {/* 서버에서 카드 형태/콘텐츠를 주면 그에 맞춰 렌더링하세요. 여기선 간단 플레이스홀더 */}
                   // 기존: <h5 className="card-title">카드 #{current.id}</h5> ...
                    <h5 className="card-title">
                        {current.detail?.lemma ? `단어: ${current.detail.lemma}` : `카드 #${current.id}`}
                    </h5>
                    {current.detail?.dictMeta?.ipa && (
                        <div className="text-muted">/{current.detail.dictMeta.ipa}/</div>
                    )}
                    {Array.isArray(current.detail?.dictMeta?.examples) && (
                        <ul className="mb-3">
                            {current.detail.dictMeta.examples.slice(0, 2).map((ex, i) => (
                                <li key={i}><span lang="de">{ex.de}</span>{ex.ko ? ` — ${ex.ko}` : ''}</li>
                            ))}
                        </ul>
                    )}
                    <p className="card-text">여기에 "뜻→형태 / 오디오→철자 / 동의·반의" 등 카드 내용을 표시합니다.</p>
                    <div className="d-flex gap-2">
                        <button className="btn btn-outline-secondary" disabled={submitting} onClick={() => answer("fail")}>틀림</button>
                        <button className="btn btn-primary" disabled={submitting} onClick={() => answer("pass")}>맞음</button>
                    </div>
                </div>
            </div>
        </main>
    );
}
