import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchJSON, withCreds } from "../api/client";
import LanguageSwitcher from "../components/LanguageSwitcher";
import LanguageSelectionModal from "../components/LanguageSelectionModal";
import "./Home_jp.css";

/**
 * Japanese special characters virtual keypad (hiragana/katakana/symbols)
 * props.onInsert(char) で入力ターゲットに挿入
 */
function JapaneseKeypad({ onInsert }) {
  const hiragana = ["あ", "い", "う", "え", "お", "ん", "っ", "ー"];
  const katakana = ["ア", "イ", "ウ", "エ", "オ", "ン", "ッ", "ー"];
  const symbols = ["。", "、", "？", "！", "・", "「", "」", "〜"];
  
  return (
    <div className="japanese-keypad my-2">
      <div className="keypad-section">
        <label className="keypad-label">ひらがな</label>
        <div className="d-flex gap-2 flex-wrap" role="group" aria-label="Hiragana keypad">
          {hiragana.map((k) => (
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
      </div>
      
      <div className="keypad-section mt-2">
        <label className="keypad-label">カタカナ</label>
        <div className="d-flex gap-2 flex-wrap" role="group" aria-label="Katakana keypad">
          {katakana.map((k) => (
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
      </div>
      
      <div className="keypad-section mt-2">
        <label className="keypad-label">記号</label>
        <div className="d-flex gap-2 flex-wrap" role="group" aria-label="Japanese symbols keypad">
          {symbols.map((k) => (
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
      </div>
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
  const [todayFolderId, setTodayFolderId] = useState(null);
  // 언어별 카드 수 상태 추가
  const [srsJapanese, setSrsJapanese] = useState(0);
  const [srsEnglish, setSrsEnglish] = useState(0);
  const [hasMultipleLanguages, setHasMultipleLanguages] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
        try {
            // overdue 状態のすべてのカードを照会
            const availableData = await fetchJSON(`/srs/available`, withCreds());
            if (!mounted) return;
            
            // 새로운 언어별 분류 응답 처리 (Dashboard와 동일)
            const srsData = availableData?.data;
            const count = srsData?.total || 0;
            const japaneseCards = srsData?.japanese || [];
            const englishCards = srsData?.english || [];
            const hasMultiple = srsData?.hasMultipleLanguages || false;

            setCount(count);
            setSrsJapanese(japaneseCards.length);
            setSrsEnglish(englishCards.length);
            setHasMultipleLanguages(hasMultiple);
            setLat(availableData._latencyMs);
        } catch (e) {
            if (mounted) setErr(e);
        }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="card h-100 vocabulary-card">
      <div className="card-body">
        <h5 className="card-title d-flex align-items-center gap-1">
          <img src="/sakura.png" alt="" style={{ height: '24px', width: 'auto' }} />
          今日のSRS
        </h5>
        {err && err.status === 401 ? (
          <div className="alert alert-warning">セッション満了: <Link to="/login">再ログイン</Link></div>
        ) : count === null ? (
          <div className="placeholder-glow">
            <span className="placeholder col-6"></span>
          </div>
        ) : (
          <>
            <p className="card-text">復習待機: <strong>{count}</strong> 個</p>
            {lat !== null && <div className="form-text">API {lat}ms</div>}
            <button 
              className="btn btn-primary" 
              onClick={async () => {
                try {
                  // すべてのoverdueカードのvocabId照会
                  const availableData = await fetchJSON(`/srs/available`, withCreds());
                  
                  // 새로운 언어별 분류 응답 구조 처리
                  const srsData = availableData?.data;
                  const allCards = [...(srsData?.japanese || []), ...(srsData?.english || [])];

                  if (allCards.length > 0) {
                    // overdueカードからvocabId抽出
                    const vocabIds = allCards
                      .map(card => card.srsfolderitem?.[0]?.vocabId || card.srsfolderitem?.[0]?.vocab?.id)
                      .filter(Boolean);
                    
                    if (vocabIds.length > 0) {
                      // learn/vocab システムにリダイレクト (全体overdueモード)
                      window.location.href = `/learn/vocab?mode=all_overdue&selectedItems=${vocabIds.join(',')}`;
                    } else {
                      alert('復習する単語がありません。');
                    }
                  } else {
                    alert('復習するカードがありません。');
                  }
                } catch (error) {
                  console.error('Failed to fetch overdue cards:', error);
                  alert('復習カードの読み込み中にエラーが発生しました。');
                }
              }}
            >
              復習開始
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 辞書検索クイックパネル (GET /dict/search)
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

  // 日本語入力用のキーパッド挿入
  const insertChar = (char) => {
    if (inputRef.current) {
      const start = inputRef.current.selectionStart;
      const end = inputRef.current.selectionEnd;
      const newValue = q.slice(0, start) + char + q.slice(end);
      setQ(newValue);
      
      // カーソル位置を設定
      setTimeout(() => {
        inputRef.current.selectionStart = inputRef.current.selectionEnd = start + char.length;
        inputRef.current.focus();
      }, 0);
    }
  };

  return (
    <div className="card h-100 vocabulary-card">
      <div className="card-body">
        <h5 className="card-title">📚 辞書検索</h5>
        <form className="d-flex gap-2" onSubmit={onSearch} role="search" aria-label="dictionary search">
          <input
            ref={inputRef}
            className="form-control"
            placeholder="日本語または韓国語の意味検索"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="query"
          />
          <button className="btn btn-outline-primary" type="submit" disabled={loading}>
            {loading ? "🔍 検索中..." : "🔍 検索"}
          </button>
          <Link className="btn btn-link" to="/dict" aria-label="open dictionary page">
            詳細表示 →
          </Link>
        </form>
        
        {/* 日本語キーパッド追加 */}
        <JapaneseKeypad onInsert={insertChar} />
        
        {err && err.status === 401 && (
          <div className="alert alert-sakura mt-2">セッション満了: <Link to="/login">再ログイン</Link></div>
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
                      <span lang="ja">{ex.de}</span>
                      {ex.ko ? <span> — {ex.ko}</span> : null}
                      {ex.jlpt ? <small className="text-muted"> (JLPT {ex.jlpt})</small> : null}
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
 * リーディングティーザー: /reading/list
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
    <div className="card h-100 vocabulary-card">
      <div className="card-body">
        <h5 className="card-title">📜 読解練習</h5>
        {err && err.status === 401 ? (
          <div className="alert alert-warning">セッション満了: <Link to="/login">再ログイン</Link></div>
        ) : (
          <ul className="mb-2">
            {list.slice(0, 3).map((r) => (
              <li key={r.id}>
                <Link to={`/read/${r.id}`}>{r.title}</Link>{" "}
                <small className="text-muted">(JLPT {r.levelJLPT || 'N5'})</small>
              </li>
            ))}
            {list.length === 0 && <li className="text-muted">コンテンツ準備中</li>}
          </ul>
        )}
        <Link className="btn btn-outline-secondary btn-sm" to="/read/1">
          サンプルを開く
        </Link>
      </div>
    </div>
  );
}

/**
 * ダッシュボードウィジェット: 実際のバックエンドデータを使用した学習統計
 */
function DashboardWidget() {
  const [stats, setStats] = useState({
    srsQueue: 0,
    masteredWords: 0,
    streakDays: 0,
    studiedToday: 0
  });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const ac = new AbortController();
    
    (async () => {
      try {
        setLoading(true);

        // Dashboard.jsxと同じAPI呼び出し
        const [srsQueueRes, masteredCardsRes, streakRes] = await Promise.all([
          fetchJSON('/srs/available', withCreds({ signal: ac.signal })),
          fetchJSON('/srs/mastered-cards', withCreds({ signal: ac.signal })),
          fetchJSON('/srs/streak', withCreds({ signal: ac.signal }))
        ]);

        if (!ac.signal.aborted) {
          const masteredData = Array.isArray(masteredCardsRes.data) ? masteredCardsRes.data : [];
          const streakData = streakRes.data || {};
          
          setStats({
            srsQueue: Array.isArray(srsQueueRes.data) ? srsQueueRes.data.length : 0,
            masteredWords: masteredData.length,
            streakDays: streakData.streak || 0,
            studiedToday: streakData.dailyQuizCount || 0
          });
        }
      } catch (e) {
        if (!ac.signal.aborted) {
          console.error('Dashboard widget data loading failed:', e);
          setErr(e);
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, []);

  if (loading) {
    return (
      <div className="dashboard-loading-compact">
        <div className="spinner-compact"></div>
        <span>読み込み中...</span>
      </div>
    );
  }

  if (err) {
    return (
      <div className="dashboard-error-compact">
        <span>📊</span>
        <p>統計を読み込めません</p>
        {err.status === 401 && (
          <Link to="/login" className="dashboard-login-link">再ログイン</Link>
        )}
      </div>
    );
  }

  return (
    <div className="dashboard-content-compact">
      <div className="dashboard-stats-compact">
        <div className="stat-item-compact">
          <div className="stat-icon-compact">📚</div>
          <div className="stat-details-compact">
            <div className="stat-number-compact">{stats.srsQueue}</div>
            <div className="stat-label-compact">復習待機</div>
          </div>
        </div>
        
        <div className="stat-item-compact">
          <div className="stat-icon-compact">🏆</div>
          <div className="stat-details-compact">
            <div className="stat-number-compact">{stats.masteredWords}</div>
            <div className="stat-label-compact">マスター</div>
          </div>
        </div>
        
        <div className="stat-item-compact">
          <div className="stat-icon-compact">🔥</div>
          <div className="stat-details-compact">
            <div className="stat-number-compact">{stats.streakDays}</div>
            <div className="stat-label-compact">連続日</div>
          </div>
        </div>

        <div className="stat-item-compact">
          <div className="stat-icon-compact">✨</div>
          <div className="stat-details-compact">
            <div className="stat-number-compact">{stats.studiedToday}</div>
            <div className="stat-label-compact">今日</div>
          </div>
        </div>
      </div>
      
      <div className="dashboard-actions-compact">
        <Link to="/dashboard" className="dashboard-btn-compact primary">
          📊 詳細ダッシュボード
        </Link>
      </div>
    </div>
  );
}

/**
 * ホーム(メイン)ページ - 日本語版
 */
export default function HomeJP() {
  const { user } = useAuth();
  const [authErr, setAuthErr] = useState(null);
  
  // 管理者チェック
  const isAdmin = user?.email === 'super@root.com';

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

  return (
    <div className="home-container japanese-theme">
      {/* Language Switcher */}
      <LanguageSwitcher />
      
      {/* Hero Section */}
      <section className="hero-modern">
        <h1 className="hero-title">
          <img src="/sakura.png" alt="" style={{ height: '48px', width: 'auto', marginRight: '0.5rem' }} />
          桜と一緒に学ぶ日本語
        </h1>
        <p className="hero-subtitle">
          SRS 단어 학습, 문법 연습, 독해력을 한 곳에서! 아름다운 벚꽃과 함께{" "}
          <strong>🔊 음성 사전</strong>을 경험해보세요.
        </p>
        <div className="hero-actions">
          <Link className="hero-btn hero-btn-primary" to="/srs">
            🌸 오늘 학습 시작
          </Link>
          <Link className="hero-btn hero-btn-outline" to="/dict">
            📚 사전 검색
          </Link>
          <Link className="hero-btn hero-btn-outline" to="/vocab">
            📁 단어장
          </Link>
          <Link className="hero-btn hero-btn-outline" to="/my-wordbook">
            📖 내 단어장
          </Link>
        </div>
      </section>
      {authErr && authErr.status === 401 && (
        <div className="alert alert-warning" role="alert">
          세션이 만료되었습니다(401). 15분 유휴 정책에 따라 재로그인이 필요할 수 있습니다.{" "}
          <Link to="/login">로그인</Link>
        </div>
      )}

      {/* 운영자 전용 섹션 */}
      {isAdmin && (
        <div className="admin-panel">
          <div className="admin-content">
            <div className="admin-info">
              <h5>🛠️ 운영자 패널</h5>
              <p>시간 가속 컨트롤러와 고급 관리 기능에 접근할 수 있습니다.</p>
            </div>
            <div className="admin-actions">
              <Link to="/admin" className="admin-btn admin-btn-outline">
                관리자 콘솔
              </Link>
              <Link to="/admin/dashboard" className="admin-btn admin-btn-solid">
                운영자 대시보드
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Widget Section */}
      <section className="widgets-section">
        <div className="widget-card">
          <div className="widget-title">
            <img src="/sakura.png" alt="" style={{ height: '24px', width: 'auto' }} />
            오늘의 SRS
          </div>
          <div className="widget-content">
            <SrsWidget />
          </div>
        </div>
        
        <div className="widget-card">
          <div className="widget-title">📚 사전 검색</div>
          <div className="widget-content">
            <DictQuickPanel />
          </div>
        </div>
        
        <div className="widget-card">
          <div className="widget-title">📊 학습 대시보드</div>
          <div className="widget-content">
            <DashboardWidget />
          </div>
        </div>
      </section>

      {/* Learning Areas Section */}
      <section className="learning-section">
        <h2 className="learning-title">📚 학습 영역</h2>
        
        <div className="learning-grid">
          {/* 문법 섹션 */}
          <div className="learning-card grammar">
            <div className="learning-card-header">
              <h3 className="learning-card-title">📝 문법 연습</h3>
              <span className="learning-badge grammar">Grammar</span>
            </div>
            <p className="learning-description">
              체계적인 일본어 문법 학습으로 정확한 일본어 구사력을 키워보세요.
            </p>
            
            <div className="level-buttons">
              {["N5", "N4", "N3", "N2", "N1"].map((level) => (
                <Link 
                  key={level}
                  to={`/learn/grammar?level=${level}`} 
                  className="level-btn grammar"
                >
                  {level}
                </Link>
              ))}
            </div>
            
            <Link to="/learn/grammar" className="learning-main-btn grammar">
              전체 문법 목록 보기 →
            </Link>
          </div>

          {/* 독해 섹션 */}
          <div className="learning-card reading">
            <div className="learning-card-header">
              <h3 className="learning-card-title">📖 독해 연습</h3>
              <span className="learning-badge reading">Reading</span>
            </div>
            <p className="learning-description">
              다양한 주제의 텍스트를 읽고 독해력을 향상시켜보세요.
            </p>
            
            <div className="level-buttons">
              {["N5", "N4", "N3", "N2", "N1"].map((level) => (
                <Link 
                  key={level}
                  to={`/reading?level=${level}`} 
                  className="level-btn reading"
                >
                  {level}
                </Link>
              ))}
            </div>
            
            <Link to="/reading" className="learning-main-btn reading">
              전체 독해 목록 보기 →
            </Link>
          </div>

          {/* 청취 섹션 */}
          <div className="learning-card listening">
            <div className="learning-card-header">
              <h3 className="learning-card-title">🎧 청취 연습</h3>
              <span className="learning-badge listening">Listening</span>
            </div>
            <p className="learning-description">
              원어민 음성을 듣고 청취력을 기르며 발음을 익혀보세요.
            </p>
            
            <div className="level-buttons">
              {["N5", "N4", "N3", "N2", "N1"].map((level) => (
                <Link 
                  key={level}
                  to={`/listening/list?level=${level}`} 
                  className="level-btn listening"
                >
                  {level}
                </Link>
              ))}
            </div>
            
            <Link to="/listening" className="learning-main-btn listening">
              전체 청취 목록 보기 →
            </Link>
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section className="tools-section">
        <h3 className="tools-title">🚀 빠른 이동</h3>
        <div className="quick-links">
          <Link className="quick-link" to="/learn/vocab">
            /learn/vocab
          </Link>
          <Link className="quick-link" to="/learn/grammar">
            /learn/grammar
          </Link>
          <Link className="quick-link" to="/read/1">
            /read/:id
          </Link>
          <Link className="quick-link" to="/dict">
            /dict
          </Link>
          <Link className="quick-link" to="/admin">
            /admin
          </Link>
        </div>
        <div className="tools-info">
          <ul>
            <li>접근성: 모든 입력에 라벨/aria 제공, 가상 키보드(ひらがな/カタカナ) 제공.</li>
            <li>보안: 모든 API 호출은 JWT HttpOnly 쿠키 포함(`credentials: "include"`).</li>
            <li>에러: 401 수신 시 로그인 안내. 다른 상태코드는 메시지 표시(개선 여지).</li>
            <li>성능: 주요 패널에 API 지연(ms) 표기. 캐시/ETag/Redis는 백엔드에서 구현.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}