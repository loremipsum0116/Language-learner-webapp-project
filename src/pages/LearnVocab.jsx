/*
  LearnVocab.jsx
  ──────────────
  · SRS / 오답노트 / Flash(선택·자동) 학습 화면
  · ‘완료’ 화면 버튼 세트:
      └ SRS 모드      → 다시 학습 / 문제 편집 / 오답 문제 풀이
      └ Flash·선택   → 다시 학습 / <지금 단어들로 SRS 학습>
      └ 오답노트      → 다시 학습 / <SRS 퀴즈로 가기>
*/

import React, {
    useEffect, useMemo, useReducer, useRef, useState,
} from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { fetchJSON, withCreds, API_BASE } from '../api/client';
import Pron from '../components/Pron';
import { useAuth } from '../context/AuthContext';

// ──────────────────────────────────────────────────────────
// util helpers
// ──────────────────────────────────────────────────────────
const isAbortError = (e) =>
    e?.name === 'AbortError' || e?.message?.toLowerCase?.().includes('abort');

const safeFileName = (s) => encodeURIComponent(String(s ?? '')
    .toLowerCase().replace(/\s+/g, '_'));

const getPosBadgeColor = (pos) => {
    switch ((pos || '').toLowerCase()) {
        case 'noun': return 'bg-primary';
        case 'verb': return 'bg-success';
        case 'adjective': return 'bg-warning text-dark';
        case 'adverb': return 'bg-info text-dark';
        default: return 'bg-secondary';
    }
};

const shuffleArray = (arr) => {
    let i = arr.length;
    while (i) {
        const j = Math.floor(Math.random() * i--);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

const useQuery = () => {
    const { search } = useLocation();
    return useMemo(() => new URLSearchParams(search), [search]);
};

// ──────────────────────────────────────────────────────────
// component
// ──────────────────────────────────────────────────────────
export default function LearnVocab() {
    const navigate = useNavigate();
    const location = useLocation();
    const query = useQuery();
    const idsParam = query.get('ids');     // 선택 학습 id CSV
    const mode = query.get('mode');    // flash | odat | null
    const autoParam = query.get('auto');    // '1' | null
    const { removeSrsId, refreshSrsIds } = useAuth();

    // ─── state ───────────────────────────────
    const [queue, setQueue] = useState(() => location.state?.initialQueue ?? []);
    const [loading, setLoading] = useState(() => !(location.state?.initialQueue));
    const [idx, setIdx] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [auto, setAuto] = useState(autoParam === '1');
    const [currentDetail, setDetail] = useState(null);
    const [currentPron, setPron] = useState(null);
    const [err, setErr] = useState(null);
    const [userAnswer, setAnswer] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [isSubmitting, setSubmitting] = useState(false);
    const [reloading, setReloading] = useState(false);

    // SRS 재로드용 키 (순수 SRS 모드에서 ‘다시 학습하기’ 눌렀을 때 강제 의존성 변화)
    const [reloadKey, forceReload] = useReducer((k) => k + 1, 0);

    // 오디오
    const audioRef = useRef(null);
    const [isPlaying, setPlay] = useState(false);

    const stopAudio = () => {
        if (audioRef.current) { try { audioRef.current.pause(); } catch { /* noop */ } }
        audioRef.current = null;
        setPlay(false);
    };
    const playUrl = (url) => {
        stopAudio();
        const src = url.startsWith('/') ? `${API_BASE}${url}` : url;
        const audio = new Audio(src);
        audio.loop = true;
        audio.onended = () => setPlay(false);
        audio.onerror = () => setPlay(false);
        audio.play().then(() => { audioRef.current = audio; setPlay(true); })
            .catch(() => setPlay(false));
    };

    // 현재 카드
    const current = queue[idx];

    // ─── queue fetch ─────────────────────────
    useEffect(() => {
        // Flash ⇒ SRS 전환(state.fromFlashcardSrs)을 처리한 뒤 재호출 필요
        if (queue.length && !location.state?.fromFlashcardSrs) return;

        const ac = new AbortController();
        (async () => {
            try {
                setLoading(true); setErr(null); setIdx(0); setFeedback(null); setAnswer(null);

                let data = [];
                if (mode === 'odat') {
                    ({ data } = await fetchJSON('/odat-note/queue?limit=100',
                        withCreds({ signal: ac.signal }), 15000));
                } else if (idsParam) {
                    const vocabIds = idsParam.split(',').map(Number).filter(Boolean);
                    ({ data } = await fetchJSON('/quiz/by-vocab',
                        withCreds({ method: 'POST', body: JSON.stringify({ vocabIds }), signal: ac.signal }), 20000));
                } else {
                    ({ data } = await fetchJSON('/srs/queue?limit=100',
                        withCreds({ signal: ac.signal }), 15000));
                }

                let fetched = Array.isArray(data) ? data : [];
                if (mode === 'flash') fetched = shuffleArray(fetched);
                setQueue(fetched);

                // 카드가 없는데 순수 SRS 모드라면 안내
                if (!mode && fetched.length === 0) {
                    alert('학습할 SRS 카드가 없습니다. 단어를 추가해 주세요.');
                    navigate('/vocab');
                }
            } catch (e) {
                if (!isAbortError(e)) setErr(e);
            } finally {
                if (!ac.signal.aborted) setLoading(false);
            }
        })();

        return () => ac.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idsParam, mode, location.state?.fromFlashcardSrs, reloadKey]);

    // ─── 카드 부가 정보 ───────────────────────
    useEffect(() => { setFlipped(false); stopAudio(); }, [idx]);

    useEffect(() => {
        setDetail(null); setPron(null);
        if (!current) { stopAudio(); return; }

        const ac = new AbortController();
        (async () => {
            try {
                const { data } =
                    await fetchJSON(`/dict/search?q=${encodeURIComponent(current.question)}`,
                        withCreds({ signal: ac.signal }), 15000);

                const first = data?.entries?.[0];
                if (first) {
                    setDetail(first);
                    if (first.ipa) setPron({ ipa: first.ipa, ipaKo: first.ipaKo });
                }

                if (mode === 'flash' && auto) {
                    playUrl(`/audio/${safeFileName(current.question)}.mp3`);
                }
            } catch (_) { /* ignore */ }
        })();

        return () => { ac.abort(); stopAudio(); };
    }, [current, mode, auto]);

    // ─── 제출 (퀴즈 모드) ──────────────────────
    const submit = async () => {
        if (!current || !userAnswer || isSubmitting) return;
        setSubmitting(true);
        const correct = userAnswer === current.answer;

        // DB 기록은 SRS/오답노트 모드에서만
        const shouldRecord = !mode || mode === 'odat';
        try {
            if (shouldRecord) {
                let cardId = current.cardId;
                if (!cardId && current.vocabId) {
                    const { data: newCard } =
                        await fetchJSON(`/vocab/${current.vocabId}/bookmark`,
                            withCreds({ method: 'POST' }));
                    cardId = newCard?.id;
                }
                if (cardId) {
                    await fetchJSON('/srs/answer', withCreds({
                        method: 'POST',
                        body: JSON.stringify({ cardId, result: correct ? 'pass' : 'fail' }),
                    }));
                    if (correct) removeSrsId(current.vocabId);
                }
            }
        } catch (e) {
            if (!isAbortError(e)) alert('답변 기록 중 오류가 발생했습니다.');
        } finally {
            setFeedback({ status: correct ? 'pass' : 'fail', answer: current.answer });
            setSubmitting(false);
        }
    };

    // ─── 네비게이션 핸들러 ────────────────────
    const next = () => { stopAudio(); setIdx((i) => i + 1); setAnswer(null); setFeedback(null); };

    const handleRestart = () => {
        setFlipped(false); setFeedback(null); setAnswer(null); setIdx(0);

        if (!mode) {          // 순수 SRS 모드 → 큐를 새로 받아오기
            forceReload();      // reloadKey 증가 → useEffect 재실행
        }
        // Flash / ids / odat 모드는 그대로 queue 재사용 (idx만 0으로)
    };

    const handleReplaceSrsAndLearn = async () => {
        setReloading(true);
        try {
            const vocabIds = queue.map((i) => i.vocabId).filter(Boolean);
            await fetchJSON('/srs/replace-deck',
                withCreds({ method: 'POST', body: JSON.stringify({ vocabIds }) }));
            navigate('/learn/vocab', { state: { fromFlashcardSrs: true } });
        } catch (e) { alert('SRS 덱 교체 실패'); } finally { setReloading(false); }
    };

    // ─── auto-flash(5s flip / 20s next) ──────
    useEffect(() => {
        if (mode !== 'flash' || !auto || !current) return undefined;
        const flip = setInterval(() => setFlipped((f) => !f), 5000);
        const nxt = setInterval(() => setIdx((i) => i + 1), 20000);
        return () => { clearInterval(flip); clearInterval(nxt); };
    }, [mode, auto, current]);

    // 모든 카드 소진 후 SRS-ids 새로고침
    useEffect(() => { if (!current) refreshSrsIds(); }, [current]);

    // ──────────────────────────────────────────
    // Rendering
    // ──────────────────────────────────────────
    if (loading) return <main className="container py-4"><h4>로딩 중…</h4></main>;
    if (err) return <main className="container py-4"><div className="alert alert-danger">퀴즈 로드 실패</div></main>;

    // ── 완료 화면 ────────────────────────────
    if (!current) {
        const isFlashLike = mode === 'flash' || !!idsParam;  // Flash & 선택 학습
        const isOdat = mode === 'odat';
        const isPureSrs = !isFlashLike && !isOdat;

        return (
            <main className="container py-4" style={{ maxWidth: 720 }}>
                <div className="p-4 bg-light rounded text-center">
                    <h4 className="mb-2">🎉 학습 완료!</h4>
                    <p className="text-muted">다음 작업을 선택하세요.</p>

                    <div className="d-flex flex-wrap justify-content-center gap-3 mt-4">
                        {/* 공통: 다시 학습하기 */}
                        <button className="btn btn-outline-secondary" onClick={handleRestart}>
                            다시 학습하기
                        </button>

                        {/* Flash / 선택 학습 */}
                        {isFlashLike && (
                            <button className="btn btn-primary" onClick={handleReplaceSrsAndLearn} disabled={reloading}>
                                {reloading ? '준비 중…' : '지금 단어들로 SRS 학습하기'}
                            </button>
                        )}

                        {/* 순수 SRS 모드 → 3-버튼 세트 */}
                        {isPureSrs && (
                            <>
                                <Link className="btn btn-outline-secondary" to="/learn/srs-manager">
                                    문제 편집
                                </Link>
                                <Link className="btn btn-primary" to="/odat-note">
                                    오답 문제 풀이
                                </Link>
                            </>
                        )}

                        {/* 오답노트 모드 */}
                        {isOdat && (
                            <Link className="btn btn-primary" to="/learn/vocab">
                                SRS 퀴즈로 가기
                            </Link>
                        )}
                    </div>
                </div>
            </main>
        );
    }

    // ── Flash 모드(자동학습) ───────────────────
    if (mode === 'flash') {
        const examples = currentDetail?.examples ?? [];
        return (
            <main className="container py-4" style={{ maxWidth: 720 }}>
                <div className="d-flex align-items-center mb-2">
                    <strong className="me-auto">플래시카드 ({queue.length}개)</strong>

                    {/* 자동재생 토글 */}
                    <button
                        type="button"
                        className="btn btn-light d-flex justify-content-center align-items-center"
                        onClick={() => { stopAudio(); setAuto((a) => !a); }}
                        style={{ borderRadius: '50%', width: '2.5rem', height: '2.5rem', border: '1px solid #dee2e6' }}
                        aria-label={auto ? '자동재생 멈춤' : '자동재생 시작'}
                    >
                        {auto
                            ? <svg xmlns="http://www.w3.org/2000/svg" width="18" viewBox="0 0 16 16"><path d="M5.5 3.5A1.5 1.5 0 017 5v6a1.5 1.5 0 01-3 0V5a1.5 1.5 0 011.5-1.5zm5 0A1.5 1.5 0 0112 5v6a1.5 1.5 0 01-3 0V5a1.5 1.5 0 011.5-1.5z" /></svg>
                            : <svg xmlns="http://www.w3.org/2000/svg" width="18" viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.058c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 010 1.393z" /></svg>}
                    </button>
                    <span className="text-muted ms-2">{idx + 1} / {queue.length}</span>
                </div>

                <div className="card">
                    <div
                        className="card-body position-relative text-center p-5 d-flex flex-column justify-content-center align-items-center"
                        role="button"
                        onClick={() => setFlipped((f) => !f)}
                        style={{ minHeight: '45rem' }}
                    >
                        {!flipped ? (
                            <>
                                {/* 품사 뱃지 */}
                                <div className="d-flex justify-content-center gap-2 mb-2">
                                    {(current.pos || '')
                                        .split(',').map((t) => t.trim()).filter((t) => t && t !== 'unk')
                                        .map((t) => <span key={t} className={`badge ${getPosBadgeColor(t)}`}>{t}</span>)}
                                </div>
                                <h2 className="display-5 mb-3" lang="en">{current.question}</h2>
                                <Pron ipa={current.pron?.ipa || currentPron?.ipa}
                                    ipaKo={current.pron?.ipaKo || currentPron?.ipaKo} />
                                <div className="text-muted mt-2">카드를 클릭하면 뜻이 표시됩니다.</div>
                            </>
                        ) : (
                            <>
                                <div className="mb-3 lead"><strong>뜻:</strong> {current.answer}</div>
                                {examples.length > 0 && (
                                    <div className="mt-4 text-start w-100">
                                        <h6 className="fw-bold">예문</h6>
                                        {examples.map((blk, i) => (
                                            <div key={i}>
                                                {blk.definitions?.map((def, j) => (
                                                    <ul key={j} className="list-unstyled mt-2">
                                                        {def.examples?.map((ex, k) => (
                                                            <li key={k} className="mb-2 p-2 bg-light rounded">
                                                                <span
                                                                    lang="en"
                                                                    dangerouslySetInnerHTML={{
                                                                        __html: ex.de.replace(
                                                                            new RegExp(`\\b(${current.question})\\b`, 'gi'),
                                                                            '<strong>$1</strong>',
                                                                        ),
                                                                    }}
                                                                />
                                                                {ex.ko && <div className="text-muted small mt-1">— {ex.ko}</div>}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="card-footer d-flex gap-2">
                        <button className="btn btn-outline-secondary w-25"
                            onClick={() => { stopAudio(); setFlipped(false); setIdx((i) => Math.max(0, i - 1)); }}>
                            ← 이전
                        </button>
                        <button className="btn btn-primary w-75"
                            onClick={() => { stopAudio(); setFlipped(false); setIdx((i) => i + 1); }}>
                            다음 →
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    // ── SRS / 오답노트 퀴즈 ─────────────────────
    return (
        <main className="container py-4" style={{ maxWidth: 720 }}>
            <div className="d-flex justify-content-between align-items-center mb-2">
                <strong>{mode === 'odat' ? '오답노트 퀴즈' : 'SRS 퀴즈'}</strong>
                <span className="text-muted">{idx + 1} / {queue.length}</span>
            </div>

            <div className="card">
                <div className="card-body text-center p-4">
                    <h2 className="display-5 mb-1" lang="en">{current.question}</h2>
                    <Pron ipa={current.pron?.ipa} ipaKo={current.pron?.ipaKo} />

                    {!feedback && (
                        <div className="d-grid gap-2 col-8 mx-auto mt-3">
                            {current.options?.map((opt) => (
                                <button key={opt}
                                    className={`btn btn-lg ${userAnswer === opt ? 'btn-primary' : 'btn-outline-primary'}`}
                                    onClick={() => setAnswer(opt)}
                                    disabled={isSubmitting}>
                                    {opt}
                                </button>
                            ))}
                            <button className="btn btn-success btn-lg mt-2"
                                disabled={!userAnswer || isSubmitting}
                                onClick={submit}>
                                {isSubmitting ? '처리 중…' : '제출하기'}
                            </button>
                        </div>
                    )}

                    {feedback && (
                        <div className={`mt-3 p-3 rounded ${feedback.status === 'pass' ? 'bg-success-subtle' : 'bg-danger-subtle'}`}>
                            <h5>{feedback.status === 'pass' ? '정답입니다!' : '오답입니다'}</h5>
                            <p className="lead">정답: {feedback.answer}</p>
                        </div>
                    )}
                </div>

                <div className="card-footer p-3">
                    {feedback && <button className="btn btn-primary w-100" onClick={next}>다음 →</button>}
                </div>
            </div>
        </main>
    );
}
