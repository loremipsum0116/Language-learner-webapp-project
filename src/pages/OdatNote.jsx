// src/pages/OdatNote.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchJSON, withCreds } from '../api/client';
import Pron from '../components/Pron';
import { useAuth } from '../context/AuthContext';

const getCefrBadgeColor = (level = '') => {
    switch (level.toUpperCase()) {
        case 'A1': return 'bg-danger';
        case 'A2': return 'bg-warning text-dark';
        case 'B1': return 'bg-success';
        case 'B2': return 'bg-info text-dark';
        case 'C1': return 'bg-primary';
        default: return 'bg-secondary';
    }
};
const getPosBadgeColor = (pos = '') => {
    switch (pos.trim().toLowerCase()) {
        case 'noun': return 'bg-primary';
        case 'verb': return 'bg-success';
        case 'adjective': return 'bg-warning text-dark';
        case 'adverb': return 'bg-info text-dark';
        default: return 'bg-secondary';
    }
};
const isAbort = (e) =>
    e?.name === 'AbortError' || e?.message?.toLowerCase?.().includes('abort');

export default function OdatNote() {
    const { user, loading: authLoading } = useAuth();
    const nav = useNavigate();
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const [items, setItems] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [q, setQ] = useState('');
    const [quizOpen, setQuizOpen] = useState(false);
    const [quizLoading, setQuizLoading] = useState(false);
    const [quizQueue, setQuizQueue] = useState([]);
    const [quizIndex, setQuizIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState(null);
    const [feedback, setFeedback] = useState(null);

    // 퀴즈 실행 중 배경 제어 로직은 더 이상 필요 없으므로 삭제합니다.

    const load = async () => {
        const ac = new AbortController();
        try {
            setLoading(true);
            setErr(null);
            const { data } = await fetchJSON(
                '/odat-note/list',
                withCreds({ signal: ac.signal }),
                15000
            );
            setItems(
                Array.isArray(data)
                    ? data.map(it => ({
                        ...it,
                        /* ---- 평탄화 ---- */
                        lemma: it.lemma ?? it.vocab?.lemma ?? '',
                        pos: it.pos ?? it.vocab?.pos ?? '',
                        levelCEFR: it.levelCEFR ?? it.vocab?.levelCEFR ?? '',
                        ipa: it.ipa ?? it.vocab?.ipa ?? '',
                        ipaKo: it.ipaKo ?? it.vocab?.ipaKo ?? '',
                        ko_gloss:
                            it.ko_gloss
                            ?? it.koGloss
                            ?? it.vocab?.ko_gloss
                            ?? it.vocab?.koGloss
                            ?? '',
                    }))
                    : [],
            );
            setSelected(new Set());
        } catch (e) {
            if (!isAbort(e)) setErr(e);
        } finally {
            if (!ac.signal.aborted) setLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading && !user) {
            nav('/', { replace: true });
        }
    }, [authLoading, user, nav]);

    useEffect(() => {
        load();
    }, []);

    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();
        if (!needle) return items;

        return items.filter((x) => {
            const gloss = (x.ko_gloss || x.koGloss || '').toLowerCase();
            return x.lemma.toLowerCase().includes(needle) || gloss.includes(needle);
        });
    }, [items, q]);

    const allSelected =
        filtered.length > 0 && filtered.every((x) => selected.has(x.cardId));
    const toggle = (id) => {
        setSelected((prev) => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
    };

    const resolveOne = async (cardId) => {
    try {
        await fetchJSON(
            '/quiz/answer',
            withCreds({
                method: 'POST',
                body: JSON.stringify({ cardId, correct: true }),
            })
        );
        setItems((prev) => prev.filter((x) => x.cardId !== cardId));
        setSelected((prev) => {
            const n = new Set(prev);
            n.delete(cardId);
            return n;
        });
    } catch (e) {
        if (!isAbort(e)) alert('정답 처리 실패');
    }
};

    const resolveSelected = async () => {
        const ids = Array.from(selected);
        if (ids.length === 0) return;
        if (
            !window.confirm(
                `${ids.length}개 항목을 정답 처리(오답 노트에서 제거)하시겠습니까?`
            )
        )
            return;
        try {
            await fetchJSON(
                '/odat-note/resolve-many',
                withCreds({
                    method: 'POST',
                    body: JSON.stringify({ cardIds: ids }),
                })
            );
            setItems((prev) => prev.filter((x) => !selected.has(x.cardId)));
            setSelected(new Set());
        } catch (e) {
            if (!isAbort(e)) alert('일괄 정답 처리 실패');
        }
    };

    const startSelectedQuiz = async () => {
        const ids = Array.from(selected);
        if (ids.length === 0) {
            alert('선택된 항목이 없습니다.');
            return;
        }
        try {
            setQuizLoading(true);
            const { data } = await fetchJSON(
                '/odat-note/quiz',
                withCreds({
                    method: 'POST',
                    body: JSON.stringify({ cardIds: ids }),
                }),
                20000
            );
            const queue = Array.isArray(data) ? data : [];
            if (queue.length === 0) {
                alert('퀴즈로 만들 수 있는 항목이 없습니다.');
                return;
            }
            setQuizQueue(queue);
            setQuizIndex(0);
            setUserAnswer(null);
            setFeedback(null);
            setQuizOpen(true);
        } catch (e) {
            if (!isAbort(e)) alert('퀴즈 생성 실패');
        } finally {
            setQuizLoading(false);
        }
    };

    const currentQuiz = quizQueue[quizIndex];
    const submitQuizAnswer = async (isCorrect) => {
        if (!currentQuiz) return;
        const result = isCorrect ? 'pass' : 'fail';
        setFeedback({ status: result, answer: currentQuiz.answer });
        try {
            // ▼▼▼ API 엔드포인트와 전송 데이터를 수정합니다 ▼▼▼
            await fetchJSON(
                '/quiz/answer', // [수정] /srs/answer -> /quiz/answer
                withCreds({
                    method: 'POST',
                    body: JSON.stringify({
                        cardId: currentQuiz.cardId,
                        correct: isCorrect, // [수정] 'result', 'source' 대신 'correct' 사용
                    }),
                })
            );

            if (isCorrect) {
                /* 맞히면 카드 제거 */
                setItems(prev => prev.filter(x => x.cardId !== currentQuiz.cardId));
                setSelected(prev => {
                    const n = new Set(prev); n.delete(currentQuiz.cardId); return n;
                });
            } else {
                /* 틀리면 incorrectCount++ 로컬 반영 */
                setItems(prev =>
                    prev.map(x =>
                        x.cardId === currentQuiz.cardId
                            ? { ...x, incorrectCount: (x.incorrectCount ?? 0) + 1 }
                            : x
                    )
                );
            }
        } catch (e) {
            if (!isAbort(e)) console.error('정답 처리 실패:', e);
        }
    };


    const nextQuiz = () => {
        setFeedback(null);
        setUserAnswer(null);
        setQuizIndex((i) => i + 1);
    };

    const closeQuiz = () => {
        setQuizOpen(false);
        setQuizQueue([]);
        setQuizIndex(0);
        setUserAnswer(null);
        setFeedback(null);
    };

    if (loading)
        return (
            <main className="container py-4">
                <h4>오답 노트 로딩 중…</h4>
            </main>
        );

    return (
        <main className="container py-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h2 className="m-0">오답 노트</h2>
                <div className="d-flex gap-2">
                    <input
                        className="form-control form-control-sm"
                        style={{ width: 220 }}
                        placeholder="검색(단어/뜻)"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                    <button
                        className="btn btn-sm btn-outline-secondary"
                        disabled={filtered.length === 0}
                        onClick={() =>
                            setSelected(
                                allSelected ? new Set() : new Set(filtered.map((x) => x.cardId))
                            )
                        }
                    >
                        {allSelected ? '전체 선택 해제' : '전체 선택'}
                    </button>
                    <button
                        className="btn btn-sm btn-danger"
                        disabled={selected.size === 0}
                        onClick={resolveSelected}
                    >
                        선택 정답 처리
                    </button>
                    <button
                        className="btn btn-sm btn-primary"
                        disabled={selected.size === 0 || quizLoading}
                        onClick={startSelectedQuiz}
                    >
                        {quizLoading ? '퀴즈 준비 중…' : '선택 퀴즈 시작'}
                    </button>
                    <button className="btn btn-sm btn-outline-primary" onClick={load}>
                        새로고침
                    </button>
                </div>
            </div>

            {err && (
                <div className="alert alert-danger">
                    오답 노트를 불러오지 못했습니다.
                </div>
            )}
            {!err && filtered.length === 0 && (
                <div className="text-muted">현재 ‘틀린 단어’가 없습니다.</div>
            )}

            <div className="list-group">
                {filtered.map((item) => {
                    // ✨ map 안에서 바로 파생 데이터 계산
                    const posList = Array.from(
                        new Set((item.pos || '')
                            .split(',')
                            .map(p => p.trim())
                            .filter(Boolean))
                    );
                    const gloss = item.ko_gloss || item.gloss || '';

                    return (
                        <div
                            key={item.cardId}
                            className="list-group-item d-flex justify-content-between align-items-center"
                        >
                            <div
                                className="d-flex align-items-start gap-2"
                                style={{ flexGrow: 1 }}
                            >
                                <input
                                    type="checkbox"
                                    className="form-check-input mt-1"
                                    checked={selected.has(item.cardId)}
                                    onChange={() => toggle(item.cardId)}
                                />
                                <div>
                                    <h5 className="mb-1" lang="en">{item.lemma}</h5>
                                    <div className="d-flex gap-1 flex-wrap mb-1">
                                        {item.levelCEFR && (
                                            <span className={`badge ${getCefrBadgeColor(item.levelCEFR)}`}>
                                                {item.levelCEFR}
                                            </span>
                                        )}
                                        {/* 품사 뱃지 */}
                                        {posList.length > 0 && (
                                            <div className="d-flex gap-1 flex-wrap mb-1">
                                                {posList.map(p => (
                                                    p.toLowerCase() !== 'unk' && (
                                                        <span key={p}
                                                            className={`badge ${getPosBadgeColor(p)} fst-italic`}>
                                                            {p}
                                                        </span>
                                                    )
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <Pron ipa={item.ipa} ipaKo={item.ipaKo} />
                                    <div className="text-muted">
                                        {gloss || '뜻 정보 없음'}
                                    </div>
                                    <small className="text-muted">틀린 횟수: {item.incorrectCount}</small>
                                </div>
                            </div>
                            <div className="d-flex gap-2">
                                <button
                                    className="btn btn-sm btn-outline-success"
                                    onClick={() => resolveOne(item.cardId)}
                                >
                                    정답 처리
                                </button>
                            </div>
                        </div>
                    );  /* ← return 닫기 */
                })}
            </div>

            {
                quizOpen && (
                    <div
                        className="modal show"
                        // ★★★★★ 1. 배경을 불투명한 흰색으로 변경 ★★★★★
                        style={{ display: 'block', backgroundColor: 'white' }}
                    >
                        <div className="modal-dialog modal-dialog-centered">
                            <div className="modal-content">
                                {!currentQuiz ? (
                                    <div className="modal-body text-center p-4">
                                        <h5 className="mb-3">퀴즈 완료</h5>
                                        <div className="d-flex justify-content-center gap-2">
                                            <button className="btn btn-primary" onClick={closeQuiz}>
                                                닫기
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="modal-header">
                                            <h5 className="modal-title">선택 퀴즈</h5>
                                            <div className="ms-auto text-muted small">
                                                {quizIndex + 1} / {quizQueue.length}
                                            </div>
                                            <button
                                                type="button"
                                                className="btn-close"
                                                onClick={closeQuiz}
                                            />
                                        </div>
                                        <div className="modal-body text-center p-4">
                                            <h2 className="display-5 mb-1" lang="en">
                                                {currentQuiz.question}
                                            </h2>
                                            <div className="mb-3">
                                                <Pron
                                                    ipa={currentQuiz.pron?.ipa}
                                                    ipaKo={currentQuiz.pron?.ipaKo}
                                                />
                                            </div>

                                            {!feedback && (
                                                <div className="d-grid gap-2 col-10 mx-auto">
                                                    {currentQuiz.options.map((opt) => (
                                                        <button
                                                            key={opt}
                                                            className={`btn btn-lg ${userAnswer === opt
                                                                ? 'btn-primary'
                                                                : 'btn-outline-primary'
                                                                }`}
                                                            onClick={() => setUserAnswer(opt)}
                                                        >
                                                            {opt}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {feedback && (
                                                <div
                                                    className={`mt-3 p-3 rounded ${feedback.status === 'pass'
                                                        ? 'bg-success-subtle'
                                                        : 'bg-danger-subtle'
                                                        }`}
                                                >
                                                    <h5>
                                                        {feedback.status === 'pass'
                                                            ? '정답입니다!'
                                                            : '오답입니다'}
                                                    </h5>
                                                    <p className="lead">정답: {feedback.answer}</p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="modal-footer">
                                            {!feedback ? (
                                                <button
                                                    className="btn btn-success w-100"
                                                    disabled={!userAnswer}
                                                    onClick={() =>
                                                        submitQuizAnswer(userAnswer === currentQuiz.answer)
                                                    }
                                                >
                                                    제출하기
                                                </button>
                                            ) : (
                                                <button className="btn btn-primary w-100" onClick={nextQuiz}>
                                                    다음 →
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </main>
    );
}