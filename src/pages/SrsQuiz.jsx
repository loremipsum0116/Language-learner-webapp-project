// src/pages/SrsQuiz.jsx (교체)
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { SrsApi, QuizApi } from "../api/srs";
import Pron from "../components/Pron";
import { toast } from "react-toastify";

export default function SrsQuiz() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const folderId = Number(params.get("folder"));

    const [loading, setLoading] = useState(true);
    const [queue, setQueue] = useState([]);
    const [idx, setIdx] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState(null);

    useEffect(() => {
        let mounted = true;
        if (!folderId) {
            setErr(new Error("폴더가 지정되지 않았습니다."));
            setLoading(false);
            return;
        }
        (async () => {
            try {
                setLoading(true);
                const data = await SrsApi.getQueue(folderId); // GET /srs/queue?folderId=...
                if (!mounted) return;
                setQueue(Array.isArray(data) ? data : []);
                setIdx(0);
            } catch (e) {
                setErr(e);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [folderId]);

    const current = queue[idx];
    const progress = useMemo(() => {
        const total = queue.length;
        const learned = queue.filter(q => q.learned).length;
        return { total, learned, remaining: total - learned };
    }, [queue]);

    async function submit(correct) {
        if (!current) return;
        try {
            setSubmitting(true);
            await QuizApi.submitAnswer({ folderId, cardId: current.cardId, correct });
            // 로컬 반영 + 안전한 다음 인덱스 계산(업데이트된 배열 기준)
            setQueue(prev => {
                const updated = prev.map((it, i) =>
                    i === idx
                        ? { ...it, learned: correct ? true : it.learned, wrongCount: correct ? it.wrongCount : it.wrongCount + 1 }
                        : it
                );
                const next = updated.findIndex((q, i) => i > idx && !q.learned);
                const fallback = updated.findIndex(q => !q.learned);
                if (next !== -1) setIdx(next);
                else if (fallback !== -1) setIdx(fallback);
                return updated;
            });
        } catch (e) {
            toast.error("정답 제출 실패");
        } finally {
            setSubmitting(false);
        }
    }



    if (loading) return <main className="container py-5 text-center"><div className="spinner-border" /></main>;
    if (err) return <main className="container py-4"><div className="alert alert-danger">퀴즈 로드 실패: {err.message}</div></main>;
    if (!current) {
        return (
            <main className="container py-5 text-center">
                <div className="p-5 bg-light rounded">
                    <h4 className="mb-3">현재 추가된 카드가 없습니다.</h4>
                    <div className="d-flex justify-content-center gap-2">
                        <Link className="btn btn-primary" to={`/vocab?addToFolder=${folderId}`}>+ 단어 추가</Link>
                        <Link className="btn btn-outline-secondary" to="/srs">대시보드</Link>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="container py-4" style={{ maxWidth: 720 }}>
            <div className="d-flex justify-content-between align-items-center mb-2">
                <h4 className="m-0">SRS 복습 퀴즈</h4>
                <span className="badge bg-dark fs-6">{progress.learned} / {progress.total}</span>
            </div>

            <div className="card shadow-sm">
                <div className="card-body text-center p-5">
                    <h2 className="display-4 mb-2" lang="en">{current?.vocab?.lemma ?? "—"}</h2>
                    <Pron ipa={current?.vocab?.dictMeta?.ipa} ipaKo={current?.vocab?.dictMeta?.ipaKo} />

                    <div className="d-flex gap-2 justify-content-center mt-4">
                        <button className="btn btn-success btn-lg" disabled={submitting} onClick={() => submit(true)}>맞음</button>
                        <button className="btn btn-danger btn-lg" disabled={submitting} onClick={() => submit(false)}>틀림</button>
                    </div>
                </div>
            </div>
        </main>
    );
}
