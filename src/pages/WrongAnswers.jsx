// src/pages/WrongAnswers.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import { fetchJSON, withCreds } from "../api/client";
import ReviewTimer from "../components/ReviewTimer";
import RainbowStar from "../components/RainbowStar";

dayjs.locale("ko");

function formatTimeRemaining(hours) {
  if (hours <= 0) return "지금";
  if (hours < 24) return `${Math.ceil(hours)}시간 후`;
  const days = Math.floor(hours / 24);
  return `${days}일 후`;
}

function getSrsStatusBadge(srsCard) {
  if (!srsCard) {
    return <span className="badge bg-light">SRS 정보 없음</span>;
  }

  const now = new Date();

  // 마스터 완료 확인
  if (srsCard.isMastered) {
    return <span className="badge bg-warning">마스터 완료</span>;
  }

  // 동결 상태 확인 (최우선)
  if (srsCard.frozenUntil && new Date(srsCard.frozenUntil) > now) {
    return <span className="badge bg-info">동결 상태</span>;
  }

  // overdue 상태 확인 (동결 다음 우선순위)
  if (srsCard.isOverdue) {
    return <span className="badge bg-danger">복습 가능</span>;
  }

  // 대기 시간 확인 (waitingUntil 기준)
  if (srsCard.waitingUntil) {
    const waitingUntil = new Date(srsCard.waitingUntil);
    if (now < waitingUntil) {
      // 아직 대기 중
      if (srsCard.isFromWrongAnswer) {
        return <span className="badge bg-warning">오답 대기 중</span>;
      } else {
        return <span className="badge bg-primary">Stage {srsCard.stage} 대기 중</span>;
      }
    } else {
      // 대기 시간 완료 - 즉시 복습 가능
      return <span className="badge bg-success">복습 가능</span>;
    }
  }

  // nextReviewAt 기준 확인 (하위 호환성)
  if (srsCard.nextReviewAt) {
    const nextReviewAt = new Date(srsCard.nextReviewAt);
    if (now < nextReviewAt) {
      return <span className="badge bg-primary">Stage {srsCard.stage} 대기 중</span>;
    } else {
      return <span className="badge bg-success">복습 가능</span>;
    }
  }

  // 기본값 (stage 0 또는 정보 부족)
  return <span className="badge bg-secondary">학습 대기 중</span>;
}

export default function WrongAnswers() {
  const navigate = useNavigate();
  const [wrongAnswers, setWrongAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState("vocab"); // 새로운 탭 상태
  const [categories, setCategories] = useState({
    vocab: { total: 0, active: 0 },
    grammar: { total: 0, active: 0 },
    reading: { total: 0, active: 0 },
    listening: { total: 0, active: 0 },
  });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedDetails, setExpandedDetails] = useState(new Set());

  const loadCategories = async () => {
    try {
      const { data } = await fetchJSON("/api/odat-note/categories", withCreds());
      setCategories(data);
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  const reload = async () => {
    setLoading(true);
    try {
      const { data } = await fetchJSON(`/api/odat-note/list?type=${selectedTab}`, withCreds());
      setWrongAnswers(data || []);
    } catch (error) {
      console.error("Failed to load wrong answers:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    reload();
  }, [selectedTab]);

  const handleSelectItem = (id) => {
    // Only allow selection of real database IDs (number or string, but not temp IDs)
    if (!id || (typeof id === 'string' && id.startsWith('temp-'))) {
      console.log('handleSelectItem: Ignoring invalid ID:', id);
      return; // Ignore temp IDs
    }
    
    console.log('handleSelectItem called with ID:', id, 'type:', typeof id);
    
    setSelectedIds(prev => {
      const newSelected = new Set(prev);
      const wasSelected = newSelected.has(id);
      
      if (wasSelected) {
        newSelected.delete(id);
        console.log('  - Removing ID from selection');
      } else {
        newSelected.add(id);
        console.log('  - Adding ID to selection');
      }
      
      console.log('  - New selectedIds:', Array.from(newSelected));
      return newSelected;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === wrongAnswers.length) {
      setSelectedIds(new Set());
    } else {
      // Only select items with real database IDs, skip temp IDs
      const realIds = wrongAnswers
        .map(wa => wa.id || wa.wrongAnswerId)
        .filter(id => id && !String(id).startsWith('temp-'));
      setSelectedIds(new Set(realIds));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    // Filter out temp IDs and only keep real database IDs
    const realIds = Array.from(selectedIds).filter(id => id && !String(id).startsWith('temp-'));
    
    if (realIds.length === 0) {
      alert('선택된 항목 중 삭제 가능한 항목이 없습니다. (실제 데이터베이스 ID가 필요함)');
      return;
    }

    if (!window.confirm(`선택한 ${realIds.length}개 항목을 삭제하시겠습니까?`)) return;

    try {
      await fetchJSON(
        "/srs/wrong-answers/delete-multiple",
        withCreds({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wrongAnswerIds: realIds }),
        }),
      );
      setSelectedIds(new Set());
      await reload();
    } catch (error) {
      alert(`삭제 실패: ${error.message}`);
    }
  };

  const toggleDetails = (id) => {
    setExpandedDetails(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(id)) {
        newExpanded.delete(id);
      } else {
        newExpanded.add(id);
      }
      return newExpanded;
    });
  };

  const handleStartLearning = (mode) => {
    if (selectedIds.size === 0) {
      alert("학습할 단어를 선택해주세요.");
      return;
    }

    // 선택된 오답노트 항목들 가져오기
    const selectedWrongAnswers = wrongAnswers.filter((wa) => selectedIds.has(wa.id));

    // 폴더별로 그룹화
    const folderGroups = new Map();
    selectedWrongAnswers.forEach((wa) => {
      // SRS 카드에서 폴더 정보 추출
      if (wa.srsCard?.folders && wa.srsCard.folders.length > 0) {
        // 첫 번째 폴더를 기본으로 사용 (나중에 사용자가 선택할 수 있도록 개선 가능)
        const folder = wa.srsCard.folders[0];
        const folderId = folder.id;

        if (!folderGroups.has(folderId)) {
          folderGroups.set(folderId, {
            folder: folder,
            vocabIds: [],
          });
        }

        folderGroups.get(folderId).vocabIds.push(wa.vocabId);
      }
    });

    if (folderGroups.size === 0) {
      alert("선택된 단어의 폴더 정보를 찾을 수 없습니다.");
      return;
    }

    // 첫 번째 폴더로 학습 시작 (여러 폴더인 경우 나중에 개선 가능)
    const [folderId, groupData] = folderGroups.entries().next().value;
    const { folder, vocabIds } = groupData;

    // 여러 폴더의 단어가 섞여 있으면 경고
    if (folderGroups.size > 1) {
      const folderNames = Array.from(folderGroups.values())
        .map((g) => g.folder.name)
        .join(", ");
      if (
        !window.confirm(
          `선택된 단어들이 여러 폴더(${folderNames})에 속해 있습니다. '${folder.name}' 폴더로 학습을 시작하시겠습니까?`,
        )
      ) {
        return;
      }
    }

    // 학습 페이지로 이동
    const params = new URLSearchParams({
      mode: mode === "flash" ? "flash" : "srs_folder",
      folderId: folderId,
      selectedItems: vocabIds.join(","),
    });

    if (mode === "flash") {
      params.set("auto", "1");
    }

    navigate(`/learn/vocab?${params.toString()}`);
  };

  const handleStartReadingReview = () => {
    if (selectedIds.size === 0) {
      alert("복습할 문제를 선택해주세요.");
      return;
    }

    // 선택된 오답 항목들에서 데이터 추출
    const selectedWrongAnswers = wrongAnswers.filter((wa) => selectedIds.has(wa.id));

    if (selectedTab === "reading") {
      // 리딩 오답들을 세션 스토리지에 저장하고 복습 페이지로 이동
      const reviewData = selectedWrongAnswers.map((wa) => ({
        id: wa.id,
        level: wa.wrongData?.level || "A1",
        questionIndex: wa.wrongData?.questionIndex || 0,
        passage: wa.wrongData?.passage || "",
        question: wa.wrongData?.question || "",
        options: wa.wrongData?.options || {},
        answer: wa.wrongData?.correctAnswer || "A",
        explanation_ko: wa.wrongData?.explanation || "",
        isReview: true,
        wrongAnswerId: wa.id,
      }));

      sessionStorage.setItem("readingReviewData", JSON.stringify(reviewData));
      navigate("/reading/review");
    } else if (selectedTab === "grammar") {
      // 문법 오답 복습 - 새 창에서 문법 페이지로 이동
      const grammarTopics = [...new Set(selectedWrongAnswers.map(wa => wa.wrongData?.topicId).filter(Boolean))];
      if (grammarTopics.length > 0) {
        // 첫 번째 주제로 이동 (나중에 복습 전용 페이지 구현 가능)
        navigate(`/learn/grammar/${grammarTopics[0]}`);
      } else {
        alert("문법 주제 정보를 찾을 수 없습니다.");
      }
    } else if (selectedTab === "listening") {
      // 리스닝 오답 복습
      const listeningLevels = [...new Set(selectedWrongAnswers.map(wa => wa.wrongData?.level).filter(Boolean))];
      if (listeningLevels.length > 0) {
        // 첫 번째 레벨의 리스닝 페이지로 이동
        navigate(`/listening?level=${listeningLevels[0]}`);
      } else {
        alert("리스닝 레벨 정보를 찾을 수 없습니다.");
      }
    }
  };

  // 새로운 오답노트 구조에 맞게 계산
  const availableCount = wrongAnswers.filter((wa) => wa.canReview).length;
  const totalCount = wrongAnswers.length;

  return (
    <main className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2>📝 오답노트</h2>
          <small className="text-muted">카테고리별로 틀린 문제들을 복습할 수 있습니다.</small>
        </div>
        <Link to="/srs" className="btn btn-outline-secondary">
          ← SRS 대시보드
        </Link>
      </div>

      {/* 카테고리 탭 */}
      <div className="mb-4">
        <ul className="nav nav-tabs">
          {[
            { key: "vocab", label: "어휘", icon: "📚" },
            { key: "grammar", label: "문법", icon: "📝" },
            { key: "reading", label: "리딩", icon: "📖" },
            { key: "listening", label: "리스닝", icon: "🎧" },
          ].map((tab) => (
            <li key={tab.key} className="nav-item">
              <button
                className={`nav-link ${selectedTab === tab.key ? "active" : ""}`}
                onClick={() => setSelectedTab(tab.key)}
              >
                {tab.icon} {tab.label}
                <span className="badge bg-primary ms-2">{categories[tab.key]?.active || 0}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* 요약 정보 - 어휘 탭일 때만 표시 */}
      {selectedTab === "vocab" && (
        <div className="row mb-4">
          <div className="col-md-4">
            <div className="card text-center">
              <div className="card-body">
                <h3 className="text-success">{availableCount}</h3>
                <p className="mb-0">복습 가능</p>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card text-center">
              <div className="card-body">
                <h3 className="text-warning">{totalCount - availableCount}</h3>
                <p className="mb-0">복습 대기 중</p>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card text-center">
              <div className="card-body">
                <h3 className="text-info">{categories[selectedTab]?.total || 0}</h3>
                <p className="mb-0">전체 어휘 오답</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 어휘 탭일 때만 학습 버튼들 표시 */}
      {selectedTab === "vocab" && (
        <div className="d-flex gap-2 mb-4 flex-wrap">
          {/* 학습 시작 버튼 */}
          {selectedIds.size > 0 ? (
            selectedIds.size > 100 ? (
              <button
                className="btn btn-primary"
                onClick={() =>
                  alert("100개를 초과하여 선택하신 단어는 학습할 수 없습니다. 100개 이하로 선택해주세요.")
                }
              >
                학습 시작 ({selectedIds.size}개 선택) - 100개 초과
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => handleStartLearning("srs_folder")}>
                학습 시작 ({selectedIds.size}개 선택)
              </button>
            )
          ) : (
            <button className="btn btn-primary opacity-50" disabled title="단어를 선택해주세요">
              학습 시작
            </button>
          )}

          {/* 선택 자동학습 버튼 */}
          {selectedIds.size > 0 ? (
            selectedIds.size > 100 ? (
              <button
                className="btn btn-success"
                onClick={() =>
                  alert("100개를 초과하여 선택하신 단어는 학습할 수 없습니다. 100개 이하로 선택해주세요.")
                }
              >
                선택 자동학습 ({selectedIds.size}개) - 100개 초과
              </button>
            ) : (
              <button className="btn btn-success" onClick={() => handleStartLearning("flash")}>
                선택 자동학습 ({selectedIds.size}개)
              </button>
            )
          ) : (
            <button className="btn btn-success opacity-50" disabled title="단어를 선택해주세요">
              선택 자동학습
            </button>
          )}
        </div>
      )}

      {/* 리딩/문법/리스닝 탭일 때 복습 버튼 */}
      {selectedTab !== "vocab" && wrongAnswers.length > 0 && (
        <div className="d-flex gap-2 mb-4 flex-wrap">
          <button
            className="btn btn-primary"
            onClick={() => handleStartReadingReview()}
            disabled={selectedIds.size === 0}
          >
            📖 선택한 문제 복습하기 ({selectedIds.size}개)
          </button>
          <div className="text-muted small align-self-center">선택한 문제들을 다시 풀어볼 수 있습니다.</div>
        </div>
      )}

      {/* 공통 버튼들 */}
      <div className="d-flex gap-2 mb-4 flex-wrap">
        {wrongAnswers.length > 0 && (
          <>
            <button className="btn btn-outline-secondary" onClick={handleSelectAll}>
              {selectedIds.size === wrongAnswers.length ? "전체 해제" : "전체 선택"}
            </button>

            <button
              className={`btn ${selectedIds.size > 0 ? "btn-danger" : "btn-outline-danger"}`}
              onClick={handleDeleteSelected}
              disabled={selectedIds.size === 0}
            >
              🗑️ 선택 삭제 {selectedIds.size > 0 && `(${selectedIds.size}개)`}
            </button>
          </>
        )}

        <div className="text-muted small">현재는 미완료 오답만 표시됩니다.</div>
      </div>

      {loading ? (
        <div className="text-center">
          <div className="spinner-border" role="status" />
        </div>
      ) : wrongAnswers.length === 0 ? (
        <div className="text-center text-muted py-5">
          <h4>🎉 오답노트가 비어있습니다!</h4>
          <p>모든 문제를 정확히 풀고 있군요.</p>
        </div>
      ) : (
        <div className="list-group">
          {wrongAnswers.map((wa, index) => {
            // Use id or wrongAnswerId as fallback
            const actualId = wa.id || wa.wrongAnswerId;
            const safeId = actualId || `temp-${index}`;
            const hasRealId = actualId && !String(actualId).startsWith('temp-');
            
            // Debug log to see the data structure
            if (index === 0) {
              console.log('First wrong answer data:', wa);
              console.log('wa.id:', wa.id, 'wa.wrongAnswerId:', wa.wrongAnswerId, 'actualId:', actualId, 'hasRealId:', hasRealId);
            }
            
            return (
              <div
                key={`wrong-answer-${safeId}`}
                className={`list-group-item ${
                  wa.srsCard?.isMastered ? "border-warning bg-light" : ""
                } ${hasRealId && selectedIds.has(actualId) ? "border-primary bg-light" : ""}`}
              >
                <div className="d-flex justify-content-between align-items-start">
                  <div className="d-flex align-items-start gap-3">
                    <input
                      type="checkbox"
                      className="form-check-input mt-1"
                      checked={hasRealId && selectedIds.has(actualId)}
                      disabled={!hasRealId}
                      onChange={(e) => {
                        e.stopPropagation();
                        console.log('Checkbox onChange triggered:');
                        console.log('  - actualId:', actualId, 'type:', typeof actualId);
                        console.log('  - hasRealId:', hasRealId);
                        console.log('  - selectedIds has actualId:', selectedIds.has(actualId));
                        console.log('  - selectedIds contents:', Array.from(selectedIds));
                        console.log('  - checkbox checked:', e.target.checked);
                        if (hasRealId) {
                          // 약간의 지연을 두어 React 상태 업데이트가 완료된 후 처리
                          setTimeout(() => handleSelectItem(actualId), 0);
                        }
                      }}
                      id={`checkbox-${safeId}`}
                      title={hasRealId ? "선택 가능" : "데이터베이스 ID가 없어 선택할 수 없습니다"}
                    />
                    <div className="flex-grow-1">
                      {/* 어휘 오답의 경우 */}
                      {selectedTab === "vocab" && wa.vocab && (
                        <>
                          <div className="d-flex align-items-center mb-2">
                            <h5 className="mb-0 me-2">
                              {wa.vocab.lemma}
                              <span className="ms-2 text-muted">({wa.vocab.pos})</span>
                            </h5>
                            {/* 마스터된 단어에 RainbowStar 표시 */}
                            {wa.srsCard?.isMastered && (
                              <RainbowStar
                                size="small"
                                cycles={wa.srsCard.masterCycles || 1}
                                animated={true}
                                className="me-2"
                              />
                            )}
                          </div>

                          <p className="mb-2">
                            {(() => {
                              // dictentry.examples에서 한국어 뜻 추출 (SrsFolderDetail과 동일한 로직)
                              let koGloss = "뜻 정보 없음";
                              try {
                                if (wa.vocab.dictentry?.examples) {
                                  const examples = Array.isArray(wa.vocab.dictentry.examples)
                                    ? wa.vocab.dictentry.examples
                                    : JSON.parse(wa.vocab.dictentry.examples);

                                  for (const ex of examples) {
                                    // definitions 안에 ko_def가 있는 경우
                                    if (ex?.definitions && Array.isArray(ex.definitions)) {
                                      for (const def of ex.definitions) {
                                        if (def?.ko_def) {
                                          koGloss = def.ko_def;
                                          break;
                                        }
                                        if (def?.ko) {
                                          koGloss = def.ko;
                                          break;
                                        }
                                        if (def?.koGloss) {
                                          koGloss = def.koGloss;
                                          break;
                                        }
                                      }
                                      if (koGloss !== "뜻 정보 없음") break;
                                    }
                                    // 직접 koGloss가 있는 경우
                                    if (ex?.koGloss) {
                                      koGloss = ex.koGloss;
                                      break;
                                    }
                                    // gloss 형태로 저장된 경우
                                    if (ex?.kind === "gloss" && ex?.ko) {
                                      koGloss = ex.ko;
                                      break;
                                    }
                                  }
                                }
                              } catch (e) {
                                console.warn("Failed to parse examples:", e);
                              }
                              return koGloss;
                            })()}
                          </p>
                        </>
                      )}

                      {/* 리딩 오답의 경우 */}
                      {selectedTab === "reading" && wa.wrongData && (
                        <>
                          <div className="d-flex align-items-center mb-2">
                            <h5 className="mb-0 me-2">
                              📖 {wa.wrongData.level} 레벨 리딩 문제 #{wa.wrongData.questionIndex + 1}
                            </h5>
                          </div>

                          <div className="mb-2">
                            <div className="mb-2">
                              <strong>문제:</strong> {wa.wrongData.question}
                            </div>
                            <div className="mb-2">
                              <span className="badge bg-danger me-2">내 답: {wa.wrongData.userAnswer}</span>
                              <span className="badge bg-success">정답: {wa.wrongData.correctAnswer}</span>
                            </div>
                            {wa.wrongData.passage && (
                              <div className="small text-muted">
                                <strong>지문:</strong> {wa.wrongData.passage.substring(0, 100)}...
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {/* 문법 오답의 경우 */}
                      {selectedTab === "grammar" && wa.wrongData && (
                        <>
                          <div className="d-flex align-items-center mb-2">
                            <h5 className="mb-0 me-2">📝 {wa.wrongData.topicTitle || "문법 문제"}</h5>
                            <span className="badge bg-secondary">{wa.wrongData.level} 레벨</span>
                          </div>

                          <div className="mb-2">
                            <div className="mb-2">
                              <strong>문제:</strong> {wa.wrongData.question}
                            </div>
                            <div className="mb-2">
                              <span className="badge bg-danger me-2">내 답: {wa.wrongData.userAnswer}</span>
                              <span className="badge bg-success">정답: {wa.wrongData.correctAnswer}</span>
                            </div>
                          </div>
                        </>
                      )}

                      {/* 리스닝 오답의 경우 */}
                      {selectedTab === "listening" && wa.wrongData && (
                        <>
                          <div className="d-flex align-items-center mb-2">
                            <h5 className="mb-0 me-2">🎧 {wa.wrongData.topic || "리스닝 문제"}</h5>
                            <span className="badge bg-secondary">{wa.wrongData.level} 레벨</span>
                          </div>

                          <div className="mb-2">
                            <div className="mb-2">
                              <strong>질문:</strong> {wa.wrongData.question || "질문 정보 없음"}
                            </div>
                            <div className="mb-2">
                              <strong>스크립트:</strong> <em>"{wa.wrongData.script || "스크립트 정보 없음"}"</em>
                            </div>
                            <div className="mb-2">
                              <span className="badge bg-danger me-2">내 답: {wa.wrongData.userAnswer}</span>
                              <span className="badge bg-success">정답: {wa.wrongData.correctAnswer}</span>
                            </div>
                            {wa.wrongData.audioFile && (
                              <div className="small text-muted">
                                <strong>음성 파일:</strong> {wa.wrongData.audioFile}
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {/* 어휘 오답의 경우만 SRS 정보 표시 */}
                      {selectedTab === "vocab" && (
                        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                          {/* SRS 상태를 기준으로 표시 */}
                          {getSrsStatusBadge(wa.srsCard)}

                          <small className="text-muted">
                            총 오답 {wa.totalWrongAttempts || wa.attempts}회
                            {wa.wrongAnswerHistory && wa.wrongAnswerHistory.length > 0 && (
                              <span className="text-info"> ({wa.wrongAnswerHistory.length}회 기록)</span>
                            )}
                          </small>
                          <small className="text-muted">최근 오답: {new Date(wa.wrongAt).toLocaleString('ko-KR', { 
                            timeZone: 'Asia/Seoul',
                            month: '2-digit', 
                            day: '2-digit', 
                            hour: '2-digit', 
                            minute: '2-digit', 
                            hour12: false 
                          })}</small>
                          {/* SRS 타이머 정보 */}
                          {wa.srsCard && !wa.srsCard.isMastered && (
                            <ReviewTimer
                              nextReviewAt={wa.srsCard.nextReviewAt}
                              waitingUntil={wa.srsCard.waitingUntil}
                              isOverdue={wa.srsCard.isOverdue}
                              overdueDeadline={wa.srsCard.overdueDeadline}
                              isFromWrongAnswer={wa.srsCard.isFromWrongAnswer}
                              frozenUntil={wa.srsCard.frozenUntil}
                              isMastered={wa.srsCard.isMastered}
                              className="small"
                            />
                          )}
                        </div>
                      )}

                      {/* 리딩/문법/리스닝 오답의 경우 기본 정보만 표시 */}
                      {selectedTab !== "vocab" && (
                        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                          <small className="text-muted">총 오답 {wa.attempts}회</small>
                          <small className="text-muted">최근 오답: {new Date(wa.wrongAt).toLocaleString('ko-KR', { 
                            timeZone: 'Asia/Seoul',
                            month: '2-digit', 
                            day: '2-digit', 
                            hour: '2-digit', 
                            minute: '2-digit', 
                            hour12: false 
                          })}</small>
                          <span className="badge bg-info">복습 가능</span>
                        </div>
                      )}

                      {/* 폴더 정보 및 이동 버튼 */}
                      {wa.srsCard?.folders && wa.srsCard.folders.length > 0 && (
                        <div className="d-flex align-items-center gap-1">
                          <small className="text-muted">폴더:</small>
                          {wa.srsCard.folders.map((folder, idx) => (
                            <span key={folder.id} className="d-flex align-items-center gap-1">
                              {idx > 0 && <span key={`comma-${folder.id}`} className="text-muted">,</span>}
                              <Link
                                to={folder.parentId ? `/srs/folder/${folder.id}` : `/srs/parent/${folder.id}`}
                                className={`btn ${
                                  folder.isWrongAnswerFolder ? "btn-danger" : "btn-outline-primary"
                                } btn-sm px-2 py-1`}
                                style={{ fontSize: "0.75rem" }}
                                title={`${
                                  folder.isWrongAnswerFolder ? "[오답 폴더] " : ""
                                }${folder.parentName ? `${folder.parentName} > ` : ""}${folder.name}으로 이동`}
                              >
                                {folder.isWrongAnswerFolder && <span key={`warning-${folder.id}`} className="text-warning">⚠️ </span>}
                                {folder.parentName && (
                                  <span key={`parent-${folder.id}`} className="text-muted">{folder.parentName} &gt; </span>
                                )}
                                {folder.name}
                              </Link>
                            </span>
                          ))}
                        </div>
                      )}

                      <button 
                        className="btn btn-sm btn-outline-info" 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleDetails(actualId || safeId);
                        }}
                        key={`toggle-${safeId}`}
                      >
                        {expandedDetails.has(actualId || safeId) ? "▼ 세부정보 접기" : "▶ 세부정보 보기"}
                      </button>

                      {/* ▼▼▼ 이 아래 블록을 한 루트 내에 유지해 인접 JSX 오류 제거 ▼▼▼ */}
                      <div className="mt-2">
                        {/* 확장된 세부 정보 */}
                        {expandedDetails.has(actualId || safeId) && (
                          <div key={`details-${safeId}`} className="border rounded p-3 mb-2 bg-light">
                            <h6 className="text-primary mb-2">📊 오답 세부 정보</h6>

                            {/* 어휘 오답의 세부정보 */}
                            {selectedTab === "vocab" && (
                              <>
                                <div className="row">
                                  <div className="col-md-6">
                                    <div className="mb-2">
                                      <strong>복습 기간:</strong>
                                      <br />
                                      <small className="text-muted">
                                        {dayjs(wa.reviewWindowStart).format("YYYY.MM.DD HH:mm")} ~{" "}
                                        {dayjs(wa.reviewWindowEnd).format("YYYY.MM.DD HH:mm")}
                                      </small>
                                    </div>
                                    <div className="mb-2">
                                      <strong>첫 오답 시각:</strong>
                                      <br />
                                      <small className="text-muted">
                                        {wa.wrongAnswerHistory && wa.wrongAnswerHistory.length > 0
                                          ? dayjs(wa.wrongAnswerHistory[0].wrongAt).tz('Asia/Seoul').format(
                                              "YYYY년 MM월 DD일 HH:mm",
                                            )
                                          : new Date(wa.wrongAt).toLocaleString('ko-KR', { 
                                              timeZone: 'Asia/Seoul',
                                              year: 'numeric', 
                                              month: 'long', 
                                              day: 'numeric', 
                                              hour: '2-digit', 
                                              minute: '2-digit', 
                                              hour12: false 
                                            })}
                                      </small>
                                    </div>
                                  </div>
                                  <div className="col-md-6">
                                    <div className="mb-2">
                                      <strong>총 오답 횟수:</strong>{" "}
                                      <span className="badge bg-warning">
                                        {wa.totalWrongAttempts || wa.attempts}회
                                      </span>
                                    </div>
                                    <div className="mb-2">
                                      <strong>SRS 상태:</strong> {getSrsStatusBadge(wa.srsCard)}
                                    </div>
                                  </div>
                                </div>

                                {/* 오답 히스토리 */}
                                {wa.wrongAnswerHistory && wa.wrongAnswerHistory.length > 0 && (
                                  <div className="mt-3 pt-3 border-top">
                                    <h6 className="text-danger mb-2">📚 오답 기록 히스토리</h6>
                                    <div className="small">
                                      {wa.wrongAnswerHistory.map((history, idx) => (
                                        <div
                                          key={history.id}
                                          className="mb-2 p-2 bg-white rounded border border-light"
                                        >
                                          <div>
                                            <strong>#{idx + 1}회차:</strong>{" "}
                                            {dayjs(history.wrongAt).format("YYYY.MM.DD HH:mm")}
                                            <span className="badge bg-danger ms-2">오답</span>
                                            {history.stageAtTime !== undefined && (
                                              <span className="badge bg-info ms-1">
                                                Stage {history.stageAtTime}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}

                            {/* 리딩 오답의 세부정보 */}
                            {selectedTab === "reading" && wa.wrongData && (
                              <>
                                <div className="mb-3">
                                  <strong>📖 지문 전체:</strong>
                                  <div className="bg-white p-3 mt-2 rounded border">{wa.wrongData.passage}</div>
                                </div>

                                <div className="mb-3">
                                  <strong>❓ 문제:</strong>
                                  <div className="bg-white p-2 mt-1 rounded border">{wa.wrongData.question}</div>
                                </div>

                                <div className="mb-3">
                                  <strong>📝 선택지:</strong>
                                  <div className="mt-2">
                                    {Object.entries(wa.wrongData.options || {}).map(([key, value]) => (
                                      <div
                                        key={key}
                                        className={`p-2 mb-1 rounded border ${
                                          key === wa.wrongData.correctAnswer
                                            ? "bg-success text-white"
                                            : key === wa.wrongData.userAnswer
                                            ? "bg-danger text-white"
                                            : "bg-white"
                                        }`}
                                      >
                                        <strong>{key}.</strong> {value}
                                        {key === wa.wrongData.correctAnswer && (
                                          <span key={`reading-correct-${wa.id}-${key}`} className="ms-2">✅ 정답</span>
                                        )}
                                        {key === wa.wrongData.userAnswer &&
                                          key !== wa.wrongData.correctAnswer && (
                                            <span key={`reading-wrong-${wa.id}-${key}`} className="ms-2">❌ 내 답</span>
                                          )}
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {wa.wrongData.explanation && (
                                  <div className="mb-3">
                                    <strong>💡 해설:</strong>
                                    <div className="bg-info bg-opacity-10 p-2 mt-1 rounded border">
                                      {wa.wrongData.explanation}
                                    </div>
                                  </div>
                                )}

                                <div className="row">
                                  <div className="col-md-6">
                                    <div className="mb-2">
                                      <strong>오답 시각:</strong>
                                      <br />
                                      <small className="text-muted">
                                        {new Date(wa.wrongAt).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                                      </small>
                                    </div>
                                  </div>
                                  <div className="col-md-6">
                                    <div className="mb-2">
                                      <strong>총 오답 횟수:</strong>{" "}
                                      <span className="badge bg-warning">{wa.attempts}회</span>
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}

                            {/* 문법 오답의 세부정보 */}
                            {selectedTab === "grammar" && wa.wrongData && (
                              <>
                                <div className="mb-3">
                                  <strong>📝 문제 전체:</strong>
                                  <div className="bg-white p-3 mt-2 rounded border">{wa.wrongData.question}</div>
                                </div>

                                <div className="mb-3">
                                  <strong>📝 선택지:</strong>
                                  <div className="mt-2">
                                    {wa.wrongData.options && wa.wrongData.options.map((option, idx) => (
                                      <div
                                        key={`${wa.id}-option-${idx}-${option}`}
                                        className={`p-2 mb-1 rounded border ${
                                          option === wa.wrongData.correctAnswer
                                            ? "bg-success text-white"
                                            : option === wa.wrongData.userAnswer
                                            ? "bg-danger text-white"
                                            : "bg-white"
                                        }`}
                                      >
                                        <strong>{option}</strong>
                                        {option === wa.wrongData.correctAnswer && (
                                          <span key={`grammar-correct-${wa.id}-${idx}`} className="ms-2">✅ 정답</span>
                                        )}
                                        {option === wa.wrongData.userAnswer &&
                                          option !== wa.wrongData.correctAnswer && (
                                            <span key={`grammar-wrong-${wa.id}-${idx}`} className="ms-2">❌ 내 답</span>
                                          )}
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {wa.wrongData.explanation && (
                                  <div className="mb-3">
                                    <strong>💡 해설:</strong>
                                    <div className="bg-info bg-opacity-10 p-2 mt-1 rounded border">
                                      {wa.wrongData.explanation}
                                    </div>
                                  </div>
                                )}

                                <div className="row">
                                  <div className="col-md-6">
                                    <div className="mb-2">
                                      <strong>오답 시각:</strong>
                                      <br />
                                      <small className="text-muted">
                                        {new Date(wa.wrongAt).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                                      </small>
                                    </div>
                                  </div>
                                  <div className="col-md-6">
                                    <div className="mb-2">
                                      <strong>총 오답 횟수:</strong>{" "}
                                      <span className="badge bg-warning">{wa.attempts}회</span>
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}

                            {/* 리스닝 오답의 세부정보 */}
                            {selectedTab === "listening" && wa.wrongData && (
                              <>
                                <div className="mb-3">
                                  <strong>🎧 질문:</strong>
                                  <div className="bg-white p-2 mt-1 rounded border">{wa.wrongData.question}</div>
                                </div>

                                <div className="mb-3">
                                  <strong>📝 스크립트:</strong>
                                  <div className="bg-light p-3 mt-2 rounded border">
                                    <em>"{wa.wrongData.script}"</em>
                                  </div>
                                </div>

                                <div className="mb-3">
                                  <strong>📝 선택지:</strong>
                                  <div className="mt-2">
                                    {Object.entries(wa.wrongData.options || {}).map(([key, value]) => (
                                      <div
                                        key={key}
                                        className={`p-2 mb-1 rounded border ${
                                          key === wa.wrongData.correctAnswer
                                            ? "bg-success text-white"
                                            : key === wa.wrongData.userAnswer
                                            ? "bg-danger text-white"
                                            : "bg-white"
                                        }`}
                                      >
                                        <strong>{key}.</strong> {value}
                                        {key === wa.wrongData.correctAnswer && (
                                          <span key={`listening-correct-${wa.id}-${key}`} className="ms-2">✅ 정답</span>
                                        )}
                                        {key === wa.wrongData.userAnswer &&
                                          key !== wa.wrongData.correctAnswer && (
                                            <span key={`listening-wrong-${wa.id}-${key}`} className="ms-2">❌ 내 답</span>
                                          )}
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="row">
                                  <div className="col-md-6">
                                    <div className="mb-2">
                                      <strong>오답 시각:</strong>
                                      <br />
                                      <small className="text-muted">
                                        {new Date(wa.wrongAt).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                                      </small>
                                    </div>
                                  </div>
                                  <div className="col-md-6">
                                    <div className="mb-2">
                                      <strong>총 오답 횟수:</strong>{" "}
                                      <span className="badge bg-warning">{wa.attempts}회</span>
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        {/* 어휘 오답의 경우만 SRS 카드 상태 정보 표시 */}
                        {selectedTab === "vocab" && wa.srsCard && (
                          <div className="border-top pt-2 mt-2">
                            <div className="d-flex align-items-center gap-3 small">
                              {wa.srsCard.isMastered ? (
                                <div className="text-warning fw-bold">🌟 마스터 완료 ({wa.srsCard.masterCycles}회)</div>
                              ) : (
                                <>
                                  <span className="badge bg-info">Stage {wa.srsCard.stage}</span>
                                  {wa.srsCard.isOverdue && (
                                    <span className="badge bg-warning text-dark">⚠️ 복습 필요</span>
                                  )}
                                  {wa.srsCard.isFromWrongAnswer && (
                                    <span className="badge bg-danger">오답 단어</span>
                                  )}
                                  <span className="text-muted">
                                    오답노트 기록: {wa.totalWrongAttempts}회 / SRS 전체: 정답{" "}
                                    {wa.srsCard.correctTotal}회, 오답 {wa.srsCard.wrongTotal}회
                                  </span>
                                </>
                              )}
                            </div>

                            {/* 타이머 표시 */}
                            {!wa.srsCard.isMastered && wa.srsCard.nextReviewAt && (
                              <div className="mt-1">
                                <ReviewTimer
                                  nextReviewAt={wa.srsCard.nextReviewAt}
                                  waitingUntil={wa.srsCard.waitingUntil}
                                  isOverdue={wa.srsCard.isOverdue}
                                  overdueDeadline={wa.srsCard.overdueDeadline}
                                  isFromWrongAnswer={wa.srsCard.isFromWrongAnswer}
                                  isFrozen={wa.srsCard.isFrozen}
                                  frozenUntil={wa.srsCard.frozenUntil}
                                  className="small"
                                />
                              </div>
                            )}

                            {wa.srsCard.isMastered && wa.srsCard.masteredAt && (
                              <div className="text-warning small mt-1">
                                🏆 {dayjs(wa.srsCard.masteredAt).format("YYYY.MM.DD")} 마스터 달성
                              </div>
                            )}
                          </div>
                        )}

                        {selectedTab === "vocab" && !wa.srsCard && (
                          <div className="border-top pt-2 mt-2">
                            <small className="text-muted">SRS 카드 정보 없음</small>
                          </div>
                        )}
                      </div>
                      {/* ▲▲▲ 단일 루트 유지 끝 ▲▲▲ */}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
