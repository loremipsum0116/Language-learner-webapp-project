import React, { useEffect, useRef, useState } from "react";
import { fetchJSON, withCreds } from "../api/client";
import { useAuth } from "../context/AuthContext";

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

/* 오디오 플레이어 (속도 조절) */
function AudioPlayer({ src, license, attribution }) {
    const [rate, setRate] = useState(1.0);
    const ref = useRef(null);
    if (!src) return null;

    // API_URL을 사용하여 절대 경로로 변환
    const fullAudioUrl = src.startsWith('http') ? src : `${API_URL}${src}`;

    return (
        <div className="my-2">
            <audio
                ref={ref}
                src={fullAudioUrl}
                controls
                preload="none"
                onPlay={() => {
                    if (ref.current) ref.current.playbackRate = rate;
                }}
                aria-label="pronunciation audio"
            />
            <div className="d-flex gap-2 align-items-center mt-1">
                <span className="form-label m-0">Speed</span>
                {[0.75, 1.0, 1.25].map((r) => (
                    <button
                        key={r}
                        className={"btn btn-sm " + (rate === r ? "btn-primary" : "btn-outline-primary")}
                        onClick={() => {
                            setRate(r);
                            if (ref.current) ref.current.playbackRate = r;
                        }}
                        aria-pressed={rate === r}
                    >
                        {r.toFixed(2)}×
                    </button>
                ))}
            </div>
            {(license || attribution) && (
                <div className="form-text mt-1">
                    {license} {attribution ? ` | © ${attribution}` : ""}
                </div>
            )}
        </div>
    );
}

export default function EnglishDict() {
    const { user } = useAuth(); // 로그인 여부(단어장 추가 버튼 노출 용도)

    const [q, setQ] = useState("");
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [lat, setLat] = useState(null);
    const [err, setErr] = useState(null);
    const inputRef = useRef(null);

    // 처음 열 때 검색창 포커스
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // 영어사전 검색 - 영어 단어와 한국어 뜻을 검색
    const search = async (e) => {
        e?.preventDefault();
        if (!q.trim()) return;

        setLoading(true);
        setErr(null);
        setLat(null);
        setEntries([]); // 이전 검색 결과 초기화

        try {
            // 영어 단어 검색을 위해 기존 /dict/search API 사용
            const response = await fetchJSON(`/dict/search?q=${encodeURIComponent(q.trim())}`, withCreds());
            setEntries(response?.data?.entries || response?.entries || []);
            setLat(response._latencyMs);
        } catch (error) {
            setErr(error);
            setEntries([]);
        } finally {
            setLoading(false);
        }
    };

    // 단어장 북마크 → SRSCard 생성
    async function bookmark(vocabId) {
        try {
            await fetchJSON(`/vocab/${vocabId}/bookmark`, withCreds({ method: "POST" }));
            alert("내 단어장에 추가되었습니다.");
        } catch (e) {
            if (e.status === 401) alert("로그인이 필요합니다.");
            else alert("추가 실패: " + (e.message || ""));
        }
    }

    return (
        <main className="container py-4">
            <h2 className="mb-3">영어사전</h2>

            <form className="d-flex gap-2" onSubmit={search} role="search" aria-label="english dictionary search">
                <label htmlFor="english-dict-q" className="visually-hidden">검색어</label>
                <input
                    id="english-dict-q"
                    ref={inputRef}
                    className="form-control"
                    placeholder="영어 단어 또는 한국어 뜻을 입력하세요"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    aria-label="query"
                />
                <button className="btn btn-primary" disabled={loading}>
                    {loading ? "검색 중…" : "검색"}
                </button>
            </form>

            {lat !== null && <div className="form-text mt-1">API {lat}ms</div>}
            {err && (
                <div className="alert alert-danger mt-2">
                    {err.status === 401 ? (
                        <>로그인이 필요합니다. 상단에서 로그인 후 다시 시도하세요.</>
                    ) : (
                        <>에러: {String(err.message || err)}</>
                    )}
                </div>
            )}

            <div className="mt-3">
                {entries.map((e, i) => (
                    <div key={e.id ?? i} className="border rounded p-2 mb-2">
                        <div className="d-flex justify-content-between align-items-center">
                            <strong>{e.lemma}</strong>
                            <span className="text-muted">
                                {e.pos}
                            </span>
                        </div>

                        {e.ipa && <div className="text-muted">/{e.ipa}/</div>}
                        <AudioPlayer src={e.audio} license={e.license} attribution={e.attribution} />

                        {/* 한국어 뜻 표시 */}
                        {(() => {
                            const koGloss = Array.isArray(e.examples)
                                ? (e.examples.find(ex => ex && (ex.kind === 'gloss' || (!ex.de && ex.ko)))?.ko)
                                : null;

                            return koGloss ? <div className="mt-1"><strong>뜻</strong>: {koGloss}</div> : null;
                        })()}

                        <details className="mt-1">
                            <summary className="small text-muted">debug</summary>
                            <pre className="mb-0 small">{JSON.stringify(e, null, 2)}</pre>
                        </details>

                        {Array.isArray(e.examples) && e.examples.length > 0 && (
                            <ul className="mb-0">
                                {e.examples.map((ex, idx) => (
                                    <li key={idx}>
                                        <span lang="en">{ex.de}</span>
                                        {ex.ko ? <span> — {ex.ko}</span> : null}
                                        {ex.cefr ? <small className="text-muted"> ({ex.cefr})</small> : null}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ))}
                {entries.length === 0 && <div className="text-muted">검색 결과가 없습니다.</div>}
            </div>
        </main>
    );
}