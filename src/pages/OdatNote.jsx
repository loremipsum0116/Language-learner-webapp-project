// src/pages/OdatNote.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchJSON, withCreds } from '../api/client';
import Pron from '../components/Pron';

const isAbort = (e) =>
    e?.name === 'AbortError' || e?.message?.toLowerCase?.().includes('abort');

export default function OdatNote() {
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    // item: {cardId, vocabId, lemma, ko_gloss, incorrectCount, updatedAt, ipa?, ipaKo?}
    const [items, setItems] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [q, setQ] = useState('');

    // ★ 퀴즈 상태
    const [quizOpen, setQuizOpen] = useState(false);
    const [quizLoading, setQuizLoading] = useState(false);
    // quiz item: {cardId, question, answer, options, pron?: {ipa, ipaKo}}
    const [quizQueue, setQuizQueue] = useState([]);
    const [quizIndex, setQuizIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState(null);
    const [feedback, setFeedback] = useState(null); // {status:'pass'|'fail', answer:string}

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
            setItems(Array.isArray(data) ? data : []);
            setSelected(new Set());
        } catch (e) {
            if (!isAbort(e)) setErr(e);
        } finally {
            if (!ac.signal.aborted) setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();
        if (!needle) return items;
        return items.filter(
            (x) =>
                x.lemma.toLowerCase().includes(needle) ||
                (x.ko_gloss || '').toLowerCase().includes(needle)
        );
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

    // ★ 단건 정답 처리(= 오답노트에서 제거)
    const resolveOne = async (cardId) => {
        try {
            await fetchJSON(
                '/srs/answer',
                withCreds({
                    method: 'POST',
                    body: JSON.stringify({ cardId, result: 'pass', source: 'odatNote' }),
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

    // ★ 선택 항목 일괄 정답 처리
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

    // ★ 선택 퀴즈 시작
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

    // ★ 퀴즈 제출 -> 정답이면 서버에 pass 전송 + 리스트에서 제거
    const currentQuiz = quizQueue[quizIndex];
    const submitQuizAnswer = async (isCorrect) => {
        if (!currentQuiz) return;
        const result = isCorrect ? 'pass' : 'fail';
        setFeedback({ status: result, answer: currentQuiz.answer });

        if (isCorrect) {
            try {
                await fetchJSON(
                    '/srs/answer',
                    withCreds({
                        method: 'POST',
                        body: JSON.stringify({
                            cardId: currentQuiz.cardId,
                            result: 'pass',
                            source: 'odatNote',
                        }),
                    })
                );
                // 화면에서 즉시 제거
                setItems((prev) =>
                    prev.filter((x) => x.cardId !== currentQuiz.cardId)
                );
                setSelected((prev) => {
                    const n = new Set(prev);
                    n.delete(currentQuiz.cardId);
                    return n;
                });
            } catch (e) {
                if (!isAbort(e)) console.error('정답 처리 실패:', e);
            }
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
                    {/* ▼▼▼ [수정] 버튼 그룹 재정렬 및 '전체 오답 퀴즈' 버튼 추가 ▼▼▼ */}
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
                    <Link to="/learn/vocab?mode=odat" className="btn btn-sm btn-warning">
                        전체 오답 퀴즈
                    </Link>
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
                {filtered.map((item) => (
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
                                <h5 className="mb-1" lang="de">
                                    {item.lemma}
                                </h5>
                                <Pron ipa={item.ipa} ipaKo={item.ipaKo} />
                                <div className="text-muted">{item.ko_gloss || '뜻 정보 없음'}</div>
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
                ))}
            </div>

            {/* ★ 선택 퀴즈 모달 */}
            {quizOpen && (
                <div
                    className="modal show"
                    style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}
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
                                        <h2 className="display-5 mb-1" lang="de">
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
            )}
        </main>
    );
}