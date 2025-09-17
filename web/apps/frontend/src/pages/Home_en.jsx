import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from 'react-dom';
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchJSON, withCreds } from "../api/client";
import LanguageSwitcher from "../components/LanguageSwitcher";
import LanguageSelectionModal from "../components/LanguageSelectionModal";
import "./Home_en.css";

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

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

  // API_URL을 사용하여 절대 경로로 변환
  const fullAudioUrl = src.startsWith('http') ? src : `${API_URL}${src}`;

  return (
    <div className="my-2">
      <audio ref={audioRef} src={fullAudioUrl} controls preload="none" aria-label="pronunciation audio" />
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
  const [availableData, setAvailableData] = useState(null); // SRS 카드 데이터 저장

  useEffect(() => {
    let mounted = true;
    (async () => {
        try {
            // overdue 상태인 모든 카드 조회
            const fetchedData = await fetchJSON(`/srs/available`, withCreds());
            if (!mounted) return;

            // 데이터를 상태에 저장
            setAvailableData(fetchedData);

            // 새로운 언어별 분류 응답 처리 (Dashboard와 동일)
            const srsData = fetchedData?.data;
            const count = srsData?.total || 0;
            const japaneseCards = srsData?.japanese || [];
            const englishCards = srsData?.english || [];
            const hasMultiple = srsData?.hasMultipleLanguages || false;

            setCount(count);
            setSrsJapanese(japaneseCards.length);
            setSrsEnglish(englishCards.length);
            setHasMultipleLanguages(hasMultiple);
            setLat(fetchedData._latencyMs);
        } catch (e) {
            if (mounted) setErr(e);
        }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="widget-card">
      <div className="widget-title">
        <img src="/danmoosae.png" alt="" style={{ height: '24px', width: 'auto' }} />
        오늘의 SRS
      </div>
      <div className="widget-content">
        {err && err.status === 401 ? (
          <div className="alert alert-warning">세션 만료: <Link to="/login">다시 로그인</Link></div>
        ) : count === null ? (
          <div className="placeholder-glow">
            <span className="placeholder col-6"></span>
          </div>
        ) : (
          <>
            <p className="card-text">복습 대기: <strong>{count}</strong> 개</p>
            {lat !== null && <div className="form-text">API {lat}ms</div>}
            <button
              className="btn btn-primary"
              onClick={() => {
                console.log('[Home SRS] 복습 시작 클릭');
                console.log('Japanese cards:', srsJapanese);
                console.log('English cards:', srsEnglish);
                console.log('Has multiple languages:', hasMultipleLanguages);

                // 모든 overdue 카드의 vocabIds 수집
                const srsData = availableData?.data;
                const allCards = [...(srsData?.japanese || []), ...(srsData?.english || [])];
                const vocabIds = allCards
                  .map(card => card.srsfolderitem?.[0]?.vocabId || card.srsfolderitem?.[0]?.vocab?.id)
                  .filter(Boolean);

                console.log('[Home SRS] VocabIds collected:', vocabIds);

                // 언어가 하나만 있는 경우 바로 해당 언어로 퀴즈 타입 선택창 이동
                if (!hasMultipleLanguages) {
                  if (srsJapanese > 0 && srsEnglish === 0) {
                    // 일본어만 있는 경우 - LearnVocab으로 이동
                    console.log('[Home SRS] 일본어만 있음 - 일본어 퀴즈 타입 선택창으로 이동');
                    window.location.href = `/learn/vocab?mode=all_overdue&selectedItems=${vocabIds.join(',')}`;
                  } else if (srsEnglish > 0 && srsJapanese === 0) {
                    // 영어만 있는 경우 - LearnVocab으로 이동
                    console.log('[Home SRS] 영어만 있음 - 영어 퀴즈 타입 선택창으로 이동');
                    window.location.href = `/learn/vocab?mode=all_overdue&selectedItems=${vocabIds.join(',')}`;
                  } else {
                    // 카드가 없는 경우
                    console.log('[Home SRS] 복습할 카드가 없음');
                    alert('복습할 카드가 없습니다.');
                  }
                } else {
                  // 여러 언어가 섞여있는 경우 언어 선택 모달 표시
                  console.log('[Home SRS] 여러 언어 섞임 - 언어 선택 모달 표시');
                  setShowLanguageModal(true);
                }
              }}
            >
              복습 시작
            </button>
          </>
        )}
      </div>

      {/* 언어 선택 모달 - createPortal로 document.body에 렌더링 */}
      {showLanguageModal && createPortal(
        <LanguageSelectionModal
          show={showLanguageModal}
          onHide={() => setShowLanguageModal(false)}
          japaneseCount={srsJapanese}
          englishCount={srsEnglish}
          onSelectLanguage={(language) => {
            console.log('[Home SRS] 언어 선택:', language);

            // 언어별로 카드 ID 필터링
            const srsData = availableData?.data;
            let filteredVocabIds = [];

            if (language === 'japanese') {
              const japaneseCards = srsData?.japanese || [];
              filteredVocabIds = japaneseCards
                .map(card => card.srsfolderitem?.[0]?.vocabId || card.srsfolderitem?.[0]?.vocab?.id)
                .filter(Boolean);
              console.log('[Home SRS] 일본어 카드 IDs:', filteredVocabIds);
              window.location.href = `/learn/vocab?mode=all_overdue&selectedItems=${filteredVocabIds.join(',')}`;
            } else if (language === 'english') {
              const englishCards = srsData?.english || [];
              filteredVocabIds = englishCards
                .map(card => card.srsfolderitem?.[0]?.vocabId || card.srsfolderitem?.[0]?.vocab?.id)
                .filter(Boolean);
              console.log('[Home SRS] 영어 카드 IDs:', filteredVocabIds);
              window.location.href = `/learn/vocab?mode=all_overdue&selectedItems=${filteredVocabIds.join(',')}`;
            }
          }}
        />,
        document.body
      )}
    </div>
  );
}

/**
 * 영어사전 퀵패널 (GET /dict/search)
 */
function EnglishDictQuickPanel() {
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
    <div className="widget-card">
      <div className="widget-title">🇺🇸 영어사전</div>
      <div className="widget-content">
        <form className="d-flex gap-2" onSubmit={onSearch} role="search" aria-label="english dictionary search">
          <input
            ref={inputRef}
            className="form-control"
            placeholder="영어 단어 또는 한국어 뜻 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="query"
          />
          <button className="btn btn-outline-primary" type="submit" disabled={loading}>
            {loading ? "🔍 검색 중..." : "🔍 검색"}
          </button>
          <Link className="btn btn-link" to="/english-dict" aria-label="open english dictionary page">
            상세 보기 →
          </Link>
        </form>
        {err && err.status === 401 && (
          <div className="alert alert-danmoosae mt-2">세션 만료: <Link to="/login">다시 로그인</Link></div>
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

// Furigana display component for Japanese words
function FuriganaDisplay({ kanji, kana }) {
  if (kanji === 'お先に失礼します') {
    return (
      <span className="fs-6" lang="ja">
        お<ruby>先<rt className="fs-7">さき</rt></ruby>に<ruby>失礼<rt className="fs-7">しつれい</rt></ruby>します
      </span>
    );
  }

  if (!kanji) {
    return <span className="fs-6" lang="ja">{kana || ''}</span>;
  }

  if (!kana) {
    return <span className="fs-6" lang="ja">{kanji}</span>;
  }

  const hasKanji = /[一-龯]/.test(kanji);
  if (!hasKanji) {
    return <span className="fs-6" lang="ja">{kanji}</span>;
  }

  // Simple approach for now
  return <span className="fs-6" lang="ja">{kanji}</span>;
}

/**
 * 일본어사전 퀵패널 (GET /vocab/search?languageId=3)
 */
function JapaneseDictQuickPanel() {
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
      const data = await fetchJSON(`/vocab/search?q=${encodeURIComponent(q.trim())}&languageId=3`, withCreds());
      setEntries(data?.data || []);
      setLat(data._latencyMs);
    } catch (e) {
      setErr(e);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  // 일본어 오디오 URL 생성
  const getJapaneseAudioUrl = (vocab) => {
    if (!vocab) return null;

    if (vocab.levelJLPT && vocab.ipaKo) {
      const level = vocab.levelJLPT.toLowerCase();
      const romaji = vocab.ipaKo;
      return `/jlpt/${level}/${romaji}/word.mp3`;
    }

    return null;
  };

  return (
    <div className="widget-card">
      <div className="widget-title">🇯🇵 일본어사전</div>
      <div className="widget-content">
        <form className="d-flex gap-2" onSubmit={onSearch} role="search" aria-label="japanese dictionary search">
          <input
            ref={inputRef}
            className="form-control"
            placeholder="일본어 단어 또는 한국어 뜻 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="query"
          />
          <button className="btn btn-outline-primary" type="submit" disabled={loading}>
            {loading ? "🔍 검색 중..." : "🔍 검색"}
          </button>
          <Link className="btn btn-link" to="/japanese-dict" aria-label="open japanese dictionary page">
            상세 보기 →
          </Link>
        </form>
        {err && err.status === 401 && (
          <div className="alert alert-danmoosae mt-2">세션 만료: <Link to="/login">다시 로그인</Link></div>
        )}
        {lat !== null && (
          <div className="form-text mt-1">
            API {lat}ms {lat <= 300 ? "✅(≤300ms)" : "⚠"}
          </div>
        )}
        <div className="mt-3" aria-live="polite">
          {entries.slice(0, 2).map((e, idx) => (
            <div key={idx} className="border rounded p-2 mb-2">
              <div className="d-flex justify-content-between">
                <strong>
                  <FuriganaDisplay
                    kanji={e.lemma}
                    kana={e.kana || e.dictentry?.ipa}
                  />
                </strong>
                <span className="text-muted">{e.pos}</span>
              </div>
              {e.ipaKo && <div className="text-muted">//{e.ipaKo}//</div>}
              <AudioPlayer src={getJapaneseAudioUrl(e)} license={e.license} attribution={e.attribution} />
              {(() => {
                // ko_gloss 필드 우선 사용 (한국어 뜻)
                const koGloss = e.ko_gloss ||
                  (Array.isArray(e.examples)
                    ? e.examples.find(ex => ex && ex.kind === 'gloss')?.ko
                    : null);

                return koGloss ? (
                  <div>
                    — {koGloss} {e.levelJLPT ? <span className="text-muted">({e.levelJLPT})</span> : null}
                  </div>
                ) : null;
              })()}
            </div>
          ))}
        </div>
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
    <div className="widget-card">
      <div className="widget-title">📜 리딩</div>
      <div className="widget-content">
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
 * 대시보드 위젯: 실제 백엔드 데이터를 사용한 학습 통계
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

        // Dashboard.jsx와 동일한 API 호출
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

  return (
    <div className="widget-card">
      <div className="widget-title">📊 학습 대시보드</div>
      <div className="widget-content">
        {loading ? (
          <div className="dashboard-loading-compact">
            <div className="spinner-compact"></div>
            <span>로딩 중...</span>
          </div>
        ) : err ? (
          <div className="dashboard-error-compact">
            <span>📊</span>
            <p>통계를 불러올 수 없습니다</p>
            {err.status === 401 && (
              <Link to="/login" className="dashboard-login-link">다시 로그인</Link>
            )}
          </div>
        ) : (
          <div className="dashboard-content-compact">
      <div className="dashboard-stats-compact">
        <div className="stat-item-compact">
          <div className="stat-icon-compact">📚</div>
          <div className="stat-details-compact">
            <div className="stat-number-compact">{stats.srsQueue}</div>
            <div className="stat-label-compact">복습 대기</div>
          </div>
        </div>
        
        <div className="stat-item-compact">
          <div className="stat-icon-compact">🏆</div>
          <div className="stat-details-compact">
            <div className="stat-number-compact">{stats.masteredWords}</div>
            <div className="stat-label-compact">마스터</div>
          </div>
        </div>
        
        <div className="stat-item-compact">
          <div className="stat-icon-compact">🔥</div>
          <div className="stat-details-compact">
            <div className="stat-number-compact">{stats.streakDays}</div>
            <div className="stat-label-compact">연속일</div>
          </div>
        </div>

        <div className="stat-item-compact">
          <div className="stat-icon-compact">✨</div>
          <div className="stat-details-compact">
            <div className="stat-number-compact">{stats.studiedToday}</div>
            <div className="stat-label-compact">오늘</div>
          </div>
        </div>
      </div>
      
      <div className="dashboard-actions-compact">
        <Link to="/dashboard" className="dashboard-btn-compact primary">
          📊 상세 대시보드
        </Link>
      </div>
    </div>
        )}
      </div>
    </div>
  );
}

/**
 * 홈(메인) 페이지
 */
export default function Home() {
  const { user } = useAuth();
  const [authErr, setAuthErr] = useState(null);
  
  // 운영자 체크
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
    <div className="home-container">
      {/* Language Switcher */}
      <LanguageSwitcher />
      
      {/* Hero Section */}
      <section className="hero-modern">
        <h1 className="hero-title">
          <img src="/danmoosae.png" alt="" style={{ height: '48px', width: 'auto', marginRight: '0.5rem' }} />
          단무새와 함께하는 영어 학습
        </h1>
        <p className="hero-subtitle">
          SRS 단어 학습, 문법 연습, 리딩 이해력을 한 곳에서! 귀여운 단무새와 함께{" "}
          <strong>🔊 음성 사전</strong>을 경험해보세요.
        </p>
        <div className="hero-actions">
          <Link className="hero-btn hero-btn-primary" to="/srs">
            🎆 오늘 학습 시작
          </Link>
          <Link className="hero-btn hero-btn-outline" to="/english-dict">
            🇺🇸 영어사전
          </Link>
          <Link className="hero-btn hero-btn-outline" to="/japanese-dict">
            🇯🇵 일본어사전
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
        <SrsWidget />

        <EnglishDictQuickPanel />

        <JapaneseDictQuickPanel />

        <DashboardWidget />
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
              체계적인 영어 문법 학습으로 정확한 영어 구사력을 키워보세요.
            </p>
            
            <div className="level-buttons">
              {["A1", "A2", "B1", "B2", "C1"].map((level) => (
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

          {/* 리딩 섹션 */}
          <div className="learning-card reading">
            <div className="learning-card-header">
              <h3 className="learning-card-title">📖 리딩 연습</h3>
              <span className="learning-badge reading">Reading</span>
            </div>
            <p className="learning-description">
              다양한 주제의 텍스트를 읽고 독해력을 향상시켜보세요.
            </p>
            
            <div className="level-buttons">
              {["A1", "A2", "B1", "B2", "C1"].map((level) => (
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
              전체 리딩 목록 보기 →
            </Link>
          </div>

          {/* 리스닝 섹션 */}
          <div className="learning-card listening">
            <div className="learning-card-header">
              <h3 className="learning-card-title">🎧 리스닝 연습</h3>
              <span className="learning-badge listening">Listening</span>
            </div>
            <p className="learning-description">
              원어민 음성을 듣고 청취력을 기르며 발음을 익혀보세요.
            </p>
            
            <div className="level-buttons">
              {["A1", "A2", "B1", "B2", "C1"].map((level) => (
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
              전체 리스닝 목록 보기 →
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
            <li>접근성: 모든 입력에 라벨/aria 제공, 가상 키보드(ä/ö/ü/ß) 제공.</li>
            <li>보안: 모든 API 호출은 JWT HttpOnly 쿠키 포함(`credentials: "include"`).</li>
            <li>에러: 401 수신 시 로그인 안내. 다른 상태코드는 메시지 표시(개선 여지).</li>
            <li>성능: 주요 패널에 API 지연(ms) 표기. 캐시/ETag/Redis는 백엔드에서 구현.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}