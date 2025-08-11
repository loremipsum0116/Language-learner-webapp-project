import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
// 다른 페이지들과 동일하게 중앙 API 클라이언트를 import 합니다.
import { fetchJSON, withCreds } from "../api/client";

/**
 * English special characters virtual keypad (common symbols)
 * props.onInsert(char) 로 입력 타겟에 삽입
 */
function EnglishKeypad({ onInsert }) {
  const keys = ["'", '"', "!", "?", ";", ":", "&", "-"];
  return (
    <div className="d-flex gap-2 my-2" role="group" aria-label="English punctuation keypad">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => onInsert(k)}
          aria-label={`insert ${k}`}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

/**
 * 오디오 플레이어 (속도 0.75 / 1.0 / 1.25)
 * 라이선스/출처 메타 표시
 */
function AudioPlayer({ src, license, attribution }) {
  const audioRef = useRef(null);
  const [rate, setRate] = useState(1.0);
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);
  if (!src) return null;
  return (
    <div className="my-2">
      <audio ref={audioRef} src={src} controls preload="none" aria-label="pronunciation audio" />
      <div className="d-flex align-items-center gap-2 mt-1">
        <label className="form-label m-0">Speed</label>
        {[0.75, 1.0, 1.25].map((r) => (
          <button
            key={r}
            type="button"
            className={"btn btn-sm " + (rate === r ? "btn-primary" : "btn-outline-primary")}
            onClick={() => setRate(r)}
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

/**
 * 페르소나 폼 (로컬 저장)
 * level/tone/address 는 /tutor 요청 시 사용
 */
function PersonaForm({ value, onChange }) {
  const [level, setLevel] = useState(value?.level || "A2");
  const [tone, setTone] = useState(value?.tone || "formal");
  const [address, setAddress] = useState(value?.address || "formal");

  useEffect(() => {
    onChange?.({ level, tone, address });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, tone, address]);

  return (
    <form className="row g-2" aria-label="Tutor persona form">
      <div className="col-md-4">
        <label className="form-label">CEFR</label>
        <select className="form-select" value={level} onChange={(e) => setLevel(e.target.value)}>
          {["A1", "A2", "B1", "B2", "C1"].map((lv) => (
            <option key={lv} value={lv}>
              {lv}
            </option>
          ))}
        </select>
      </div>
      <div className="col-md-4">
        <label className="form-label">톤</label>
        <select className="form-select" value={tone} onChange={(e) => setTone(e.target.value)}>
          <option value="formal">격식</option>
          <option value="friendly">친근</option>
        </select>
      </div>
      <div className="col-md-4">
        <label className="form-label">호칭</label>
        <select className="form-select" value={address} onChange={(e) => setAddress(e.target.value)}>
          <option value="formal">formal</option>
          <option value="casual">casual</option>
        </select>
      </div>
    </form>
  );
}

/**
 * 근거(Refs) Drawer
 */
function RefDrawer({ refs }) {
  if (!refs || !refs.length) return null;
  return (
    <details className="mt-2">
      <summary>근거(Refs)</summary>
      <ul className="mt-2">
        {refs.map((r, i) => (
          <li key={i}>
            <code>{typeof r === "string" ? r : JSON.stringify(r)}</code>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * SRS 위젯: 오늘의 카드 수 집계
 */
function SrsWidget() {
  const [count, setCount] = useState(null);
  const [lat, setLat] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
        try {
            const data = await fetchJSON('/srs/queue?limit=100', withCreds());
            if (!mounted) return;
            setCount(Array.isArray(data?.data) ? data.data.length : 0);
            setLat(data._latencyMs);
        } catch (e) {
            if (mounted) setErr(e);
        }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="card h-100">
      <div className="card-body">
        <h5 className="card-title">오늘의 SRS</h5>
        {err && err.status === 401 ? (
          <div className="alert alert-warning">세션 만료: <Link to="/login">다시 로그인</Link></div>
        ) : count === null ? (
          <div className="placeholder-glow">
            <span className="placeholder col-6"></span>
          </div>
        ) : (
          <>
            <p className="card-text">대기 카드: <strong>{count}</strong> 개</p>
            {lat !== null && <div className="form-text">API {lat}ms</div>}
            <Link className="btn btn-primary" to="/learn/vocab">
              학습 시작
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 사전 검색 퀵패널 (GET /dict/search)
 */
function DictQuickPanel() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState([]);
  const [lat, setLat] = useState(null);
  const [err, setErr] = useState(null);
  const inputRef = useRef(null);

  const onSearch = async (e) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchJSON(`/dict/search?q=${encodeURIComponent(q.trim())}`, withCreds());
      setEntries(data?.data?.entries || data?.entries || []);
      setLat(data._latencyMs);
    } catch (e) {
      setErr(e);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card h-100">
      <div className="card-body">
        <h5 className="card-title">사전 검색</h5>
        <form className="d-flex gap-2" onSubmit={onSearch} role="search" aria-label="dictionary search">
          <input
            ref={inputRef}
            className="form-control"
            // ▼▼▼ placeholder 수정 ▼▼▼
            placeholder="영어 또는 한국어 뜻 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="query"
          />
          <button className="btn btn-outline-secondary" type="submit" disabled={loading}>
            {loading ? "검색 중..." : "검색"}
          </button>
          <Link className="btn btn-link" to="/dict" aria-label="open dictionary page">
            상세 보기 →
          </Link>
        </form>
        {err && err.status === 401 && (
          <div className="alert alert-warning mt-2">세션 만료: <Link to="/login">다시 로그인</Link></div>
        )}
        {lat !== null && (
          <div className="form-text mt-1">
            API {lat}ms {lat <= 300 ? "✅(≤300ms)" : "⚠"}
          </div>
        )}
        <div className="mt-3" aria-live="polite">
          {entries.slice(0, 3).map((e, idx) => (
            <div key={idx} className="border rounded p-2 mb-2">
              <div className="d-flex justify-content-between">
                <strong>{e.lemma}</strong>
                <span className="text-muted">{e.pos}</span>
              </div>
              {e.ipa && <div className="text-muted">/{e.ipa}/</div>}
              <AudioPlayer src={e.audio} license={e.license} attribution={e.attribution} />
              {Array.isArray(e.examples) && e.examples.length > 0 && (
                <ul className="mb-0">
                  {e.examples.slice(0, 2).map((ex, i) => (
                    <li key={i}>
                      <span lang="en">{ex.de}</span>
                      {ex.ko ? <span> — {ex.ko}</span> : null}
                      {ex.cefr ? <small className="text-muted"> ({ex.cefr})</small> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


/**
 * 튜터 퀵챗 (POST /tutor/chat)
 */
function TutorQuickChat({ persona }) {
  const [prompt, setPrompt] = useState("");
  const [resp, setResp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [lat, setLat] = useState(null);

  const send = async (e) => {
    e?.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setErr(null);
    setResp(null);
    try {
      const data = await fetchJSON(
        `/tutor/chat`, // API_BASE is prepended by the imported fetchJSON
        withCreds({
          method: "POST",
          body: JSON.stringify({
            mode: "chat",
            persona: persona || { level: "A2", tone: "formal", address: "formal" },
            contextTags: [],
            prompt: prompt.trim(),
          }),
        })
      );
      setResp(data?.data || data);
      setLat(data._latencyMs);
    } catch (e2) {
      setErr(e2);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card h-100">
      <div className="card-body">
        <h5 className="card-title">AI English Tutor (Preview)</h5>
        <form className="d-flex gap-2" onSubmit={send}>
          <input
            className="form-control"
            placeholder="예: I am going to the movies tomorrow. Please review grammar."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            aria-label="tutor prompt"
          />
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                전송
              </>
            ) : (
              "전송"
            )}
          </button>
          <Link className="btn btn-link" to="/tutor" aria-label="open tutor page">
            전체 열기 →
          </Link>
        </form>
        {err && err.status === 401 && (
          <div className="alert alert-warning mt-2">세션 만료: <Link to="/login">다시 로그인</Link></div>
        )}
        {resp && (
          <div className="mt-3">
            <div className="mb-2">
              <strong lang="en">DE</strong>
              <div className="border rounded p-2" lang="en">
                {resp.de_answer}
              </div>
            </div>
            {resp.ko_explain && (
              <div className="mb-2">
                <strong>KO</strong>
                <div className="border rounded p-2">{resp.ko_explain}</div>
              </div>
            )}
            {Array.isArray(resp.tips) && resp.tips.length > 0 && (
              <ul className="mb-2">
                {resp.tips.slice(0, 3).map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            )}
            <RefDrawer refs={resp.refs} />
            {lat !== null && <div className="form-text mt-1">API {lat}ms</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 리딩 티저: /reading/list
 */
function ReadingTeaser() {
  const [list, setList] = useState([]);
  const [err, setErr] = useState(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
        try {
            const d = await fetchJSON(`/reading/list?level=`, withCreds());
            if (!mounted) return;
            setList(d?.data || d || []);
        } catch (e) {
            if (mounted) setErr(e);
        }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  return (
    <div className="card h-100">
      <div className="card-body">
        <h5 className="card-title">리딩</h5>
        {err && err.status === 401 ? (
          <div className="alert alert-warning">세션 만료: <Link to="/login">다시 로그인</Link></div>
        ) : (
          <ul className="mb-2">
            {list.slice(0, 3).map((r) => (
              <li key={r.id}>
                <Link to={`/read/${r.id}`}>{r.title}</Link>{" "}
                <small className="text-muted">({r.levelCEFR})</small>
              </li>
            ))}
            {list.length === 0 && <li className="text-muted">콘텐츠 준비 중</li>}
          </ul>
        )}
        <Link className="btn btn-outline-secondary btn-sm" to="/read/1">
          샘플 열기
        </Link>
      </div>
    </div>
  );
}

/**
 * 홈(메인) 페이지
 */
export default function Home() {
  const { user, updateProfile } = useAuth();
  const [authErr, setAuthErr] = useState(null);
  const [persona, setPersona] = useState({ level: "A2", tone: "formal", address: "formal" });
  useEffect(() => {
    if (user?.profile) {
      setPersona((prev) => ({
        ...prev,
        ...user.profile,
      }));
    }
  }, [user]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  async function onSavePersona() {
    setSaving(true);
    setSaveMsg(null);
    try {
      await updateProfile({
        level: persona.level,
        tone: persona.tone,
        address: persona.address,
      });
      setSaveMsg("저장됨");
      setTimeout(() => setSaveMsg(null), 1500);
    } catch (e) {
      setSaveMsg("저장 실패");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
        try {
            await fetchJSON(`/me`, withCreds());
        } catch (e) {
            if (mounted) setAuthErr(e);
        }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("persona", JSON.stringify(persona || {}));
  }, [persona]);

  return (
    <main className="container py-4">
      <section className="mb-4 hero-section">
        <div className="p-4 p-md-5 bg-light rounded-3">
          <h1 className="display-6 mb-2">Efficient English Learning Platform</h1>
          <p className="mb-3">
            SRS vocabulary, grammar practice, reading comprehension. Experience adaptive learning combined with{" "}
            <strong>AI English Tutor</strong> and <strong>Dictionary API (with audio)</strong>.
          </p>
          <div className="d-flex gap-2">
            <Link className="btn btn-primary" to="/learn/vocab">
              오늘 학습 시작
            </Link>
            <Link className="btn btn-outline-secondary" to="/tutor">
              튜터 열기
            </Link>
            <Link className="btn btn-outline-secondary" to="/dict">
              사전 검색
            </Link>
            <Link className="btn btn-outline-secondary" to="/vocab">
              전체 단어장
            </Link>
            <Link className="btn btn-outline-secondary" to="/learn/grammar">
              문법 세트
            </Link>
          </div>
        </div>
      </section>
      {authErr && authErr.status === 401 && (
        <div className="alert alert-warning" role="alert">
          세션이 만료되었습니다(401). 15분 유휴 정책에 따라 재로그인이 필요할 수 있습니다.{" "}
          <Link to="/login">로그인</Link>
        </div>
      )}

      <section className="row g-3">
        <div className="col-md-6 col-lg-4">
          <SrsWidget />
        </div>
        <div className="col-md-6 col-lg-4">
          <DictQuickPanel />
        </div>
        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">튜터 페르소나</h5>
              <PersonaForm value={persona} onChange={setPersona} />
              <div className="d-flex align-items-center gap-2 mt-2">
                <button className="btn btn-primary btn-sm" onClick={onSavePersona} disabled={saving}>
                  {saving ? "저장 중…" : "프로필 저장"}
                </button>
                {saveMsg && <span className="text-success small">{saveMsg}</span>}
              </div>
              <div className="form-text mt-2">
                이 설정은 로컬에 저장됩니다. (백엔드 프로필 저장은 추후 PATCH /me 추가 권장)
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          <TutorQuickChat persona={persona} />
        </div>
        <div className="col-lg-4">
          <ReadingTeaser />
        </div>
      </section>

      <section className="mt-4">
        <div className="card">
          <div className="card-body">
            <h5 className="card-title">빠른 이동</h5>
            <div className="d-flex flex-wrap gap-2">
              <Link className="btn btn-outline-secondary btn-sm" to="/learn/vocab">
                /learn/vocab
              </Link>
              <Link className="btn btn-outline-secondary btn-sm" to="/learn/grammar">
                /learn/grammar
              </Link>
              <Link className="btn btn-outline-secondary btn-sm" to="/read/1">
                /read/:id
              </Link>
              <Link className="btn btn-outline-secondary btn-sm" to="/tutor">
                /tutor
              </Link>
              <Link className="btn btn-outline-secondary btn-sm" to="/dict">
                /dict
              </Link>
              <Link className="btn btn-outline-secondary btn-sm" to="/admin">
                /admin
              </Link>
            </div>
            <hr />
            <ul className="mb-0 small">
              <li>접근성: 모든 입력에 라벨/aria 제공, 가상 키보드(ä/ö/ü/ß) 제공.</li>
              <li>보안: 모든 API 호출은 JWT HttpOnly 쿠키 포함(`credentials: "include"`).</li>
              <li>에러: 401 수신 시 로그인 안내. 다른 상태코드는 메시지 표시(개선 여지).</li>
              <li>성능: 주요 패널에 API 지연(ms) 표기. 캐시/ETag/Redis는 백엔드에서 구현.</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}