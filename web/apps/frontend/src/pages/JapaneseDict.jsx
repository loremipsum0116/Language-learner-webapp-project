import React, { useEffect, useRef, useState } from "react";
import { fetchJSON, withCreds } from "../api/client";
import { useAuth } from "../context/AuthContext";

const API_URL = process.env.REACT_APP_API_URL || 'https://clever-elegance-production.up.railway.app';

// Furigana display component - handles mixed kanji/hiragana
function FuriganaDisplay({ kanji, kana }) {
  // Special handling for problematic phrases
  if (kanji === 'お先に失礼します') {
    return (
      <span className="fs-5" lang="ja">
        お<ruby>先<rt className="fs-6">さき</rt></ruby>に<ruby>失礼<rt className="fs-6">しつれい</rt></ruby>します
      </span>
    );
  }

  // If no kanji text, return kana
  if (!kanji) {
    return <span className="fs-5" lang="ja">{kana || ''}</span>;
  }

  // If no kana provided, return kanji only
  if (!kana) {
    return <span className="fs-5" lang="ja">{kanji}</span>;
  }

  // Simple approach: check if there are kanji characters
  const hasKanji = /[一-龯]/.test(kanji);

  if (!hasKanji) {
    // No kanji, just return the text
    return <span className="fs-5" lang="ja">{kanji}</span>;
  }

  // Complex furigana parsing logic
  const result = [];
  let kanjiIndex = 0;
  let kanaIndex = 0;
  let currentKanji = '';
  let currentKana = '';

  for (let i = 0; i < kanji.length; i++) {
    const char = kanji[i];

    if (/[一-龯]/.test(char)) {
      // This is a kanji character
      currentKanji += char;
    } else {
      // This is hiragana/katakana
      if (currentKanji) {
        // We have accumulated kanji, find corresponding kana
        let correspondingKana = '';
        while (kanaIndex < kana.length && /[ひらがなカタカナ]/.test(kana[kanaIndex])) {
          correspondingKana += kana[kanaIndex];
          kanaIndex++;
        }

        result.push(
          <ruby key={`kanji-${kanjiIndex++}`}>
            {currentKanji}
            <rt className="fs-6">{correspondingKana}</rt>
          </ruby>
        );
        currentKanji = '';
      }

      result.push(<span key={`kana-${i}`}>{char}</span>);
      kanaIndex++;
    }
  }

  // Handle any remaining kanji
  if (currentKanji) {
    let correspondingKana = '';
    while (kanaIndex < kana.length) {
      correspondingKana += kana[kanaIndex];
      kanaIndex++;
    }

    result.push(
      <ruby key={`kanji-${kanjiIndex}`}>
        {currentKanji}
        <rt className="fs-6">{correspondingKana}</rt>
      </ruby>
    );
  }

  return <span className="fs-5" lang="ja">{result}</span>;
}

/* 오디오 플레이어 (속도 조절) */
function AudioPlayer({ src, license, attribution }) {
    const [rate, setRate] = useState(1.0);
    const ref = useRef(null);

    // API_URL을 사용하여 절대 경로로 변환 (영어사전과 동일)
    const fullAudioUrl = src ? (src.startsWith('http') ? src : `${API_URL}${src}`) : undefined;

    // 항상 표시 (영어사전과 동일)
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
                    {license ? `License: ${license}` : ""} {attribution ? ` | © ${attribution}` : ""}
                </div>
            )}
        </div>
    );
}

export default function JapaneseDict() {
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

    // 일본어사전 검색 - 일본어 단어와 한국어 뜻을 검색
    const search = async (e) => {
        e?.preventDefault();
        if (!q.trim()) return;

        setLoading(true);
        setErr(null);
        setLat(null);
        setEntries([]); // 이전 검색 결과 초기화

        try {
            // 일본어 단어 검색을 위해 vocab API 사용 (일본어 languageId: 3)
            const response = await fetchJSON(`/vocab/search?q=${encodeURIComponent(q.trim())}&languageId=3`, withCreds());
            setEntries(response?.data || []);
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

    // 일본어 오디오 URL 생성
    const getJapaneseAudioUrl = (vocab) => {
        if (!vocab) return null;

        // JLPT 레벨과 로마자가 있는 경우만 오디오 생성
        if (vocab.levelJLPT && vocab.ipaKo) {
            // JLPT 단어의 경우 /jlpt/{level}/{romaji}/word.mp3 형식
            const level = vocab.levelJLPT.toLowerCase(); // N5 -> n5, N4 -> n4 등
            const romaji = vocab.ipaKo; // ipaKo 필드에 로마자 저장됨 (실제 폴더명)
            return `/jlpt/${level}/${romaji}/word.mp3`;
        }

        return null;
    };

    return (
        <main className="container py-4">
            <h2 className="mb-3">일본어사전</h2>

            <form className="d-flex gap-2" onSubmit={search} role="search" aria-label="japanese dictionary search">
                <label htmlFor="japanese-dict-q" className="visually-hidden">검색어</label>
                <input
                    id="japanese-dict-q"
                    ref={inputRef}
                    className="form-control"
                    placeholder="일본어 단어 또는 한국어 뜻을 입력하세요"
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
                {entries.map((vocab, i) => {
                    // 일본어 데이터를 영어사전과 동일한 구조로 변환
                    const e = {
                        id: vocab.id,
                        lemma: vocab.lemma,
                        pos: vocab.pos + (vocab.levelJLPT ? ` ${vocab.levelJLPT}` : ''),
                        ipa: vocab.ipaKo,
                        audio: getJapaneseAudioUrl(vocab) || "", // 빈 문자열로 기본값 설정
                        license: "JLPT Vocabs Dataset",
                        attribution: "JLPT Vocabs Dataset",
                        examples: (() => {
                            const examples = [];
                            // 한국어 뜻을 gloss로 추가
                            if (vocab.ko_gloss) {
                                const cleanKoGloss = vocab.ko_gloss.replace(/^[a-z]+\.\s*/i, '');
                                examples.push({
                                    kind: 'gloss',
                                    ko: cleanKoGloss
                                });
                            }
                            // 예문이 있으면 추가
                            if (vocab.example && vocab.koExample) {
                                examples.push({
                                    de: vocab.example,
                                    ko: vocab.koExample,
                                    cefr: vocab.levelJLPT
                                });
                            }
                            return examples;
                        })()
                    };

                    // 영어사전과 완전히 동일한 구조 사용
                    return (
                        <div key={e.id ?? i} className="border rounded p-2 mb-2">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <strong>
                                        <FuriganaDisplay
                                            kanji={e.lemma}
                                            kana={vocab.kana || vocab.dictentry?.ipa}
                                        />
                                    </strong>
                                    {e.ipa && (
                                        <div className="text-muted small">
                                            [{e.ipa}]
                                        </div>
                                    )}
                                </div>
                                <span className="text-muted">
                                    {e.pos}
                                </span>
                            </div>
                            <AudioPlayer src={e.audio} license={e.license} attribution={e.attribution} />

                            {/* 한국어 뜻 표시 - 영어사전과 완전히 동일한 로직 */}
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
                                            <span lang="ja">{ex.de}</span>
                                            {ex.ko ? <span> — {ex.ko}</span> : null}
                                            {ex.cefr ? <small className="text-muted"> ({ex.cefr})</small> : null}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    );
                })}
                {entries.length === 0 && <div className="text-muted">검색 결과가 없습니다.</div>}
            </div>
        </main>
    );
}