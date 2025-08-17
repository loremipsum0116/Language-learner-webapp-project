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
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedDetails, setExpandedDetails] = useState(new Set());

  const reload = async () => {
    setLoading(true);
    try {
      const { data } = await fetchJSON(
        `/srs/wrong-answers?includeCompleted=${includeCompleted}`, 
        withCreds()
      );
      setWrongAnswers(data || []);
    } catch (error) {
      console.error('Failed to load wrong answers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, [includeCompleted]);


  const handleSelectItem = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === wrongAnswers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(wrongAnswers.map(wa => wa.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    
    if (!window.confirm(`선택한 ${selectedIds.size}개 항목을 삭제하시겠습니까?`)) return;
    
    try {
      await fetchJSON('/srs/wrong-answers/delete-multiple', withCreds({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wrongAnswerIds: Array.from(selectedIds) })
      }));
      setSelectedIds(new Set());
      await reload();
    } catch (error) {
      alert(`삭제 실패: ${error.message}`);
    }
  };

  const toggleDetails = (id) => {
    const newExpanded = new Set(expandedDetails);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedDetails(newExpanded);
  };

  const handleStartLearning = (mode) => {
    if (selectedIds.size === 0) {
      alert('학습할 단어를 선택해주세요.');
      return;
    }

    // 선택된 오답노트 항목들 가져오기
    const selectedWrongAnswers = wrongAnswers.filter(wa => selectedIds.has(wa.id));
    
    // 폴더별로 그룹화
    const folderGroups = new Map();
    selectedWrongAnswers.forEach(wa => {
      // SRS 카드에서 폴더 정보 추출
      if (wa.srsCard?.folders && wa.srsCard.folders.length > 0) {
        // 첫 번째 폴더를 기본으로 사용 (나중에 사용자가 선택할 수 있도록 개선 가능)
        const folder = wa.srsCard.folders[0];
        const folderId = folder.id;
        
        if (!folderGroups.has(folderId)) {
          folderGroups.set(folderId, {
            folder: folder,
            vocabIds: []
          });
        }
        
        folderGroups.get(folderId).vocabIds.push(wa.vocabId);
      }
    });

    if (folderGroups.size === 0) {
      alert('선택된 단어의 폴더 정보를 찾을 수 없습니다.');
      return;
    }

    // 첫 번째 폴더로 학습 시작 (여러 폴더인 경우 나중에 개선 가능)
    const [folderId, groupData] = folderGroups.entries().next().value;
    const { folder, vocabIds } = groupData;
    
    // 여러 폴더의 단어가 섞여 있으면 경고
    if (folderGroups.size > 1) {
      const folderNames = Array.from(folderGroups.values()).map(g => g.folder.name).join(', ');
      if (!window.confirm(`선택된 단어들이 여러 폴더(${folderNames})에 속해 있습니다. '${folder.name}' 폴더로 학습을 시작하시겠습니까?`)) {
        return;
      }
    }

    // 학습 페이지로 이동
    const params = new URLSearchParams({
      mode: mode === 'flash' ? 'flash' : 'srs_folder',
      folderId: folderId,
      selectedItems: vocabIds.join(',')
    });
    
    if (mode === 'flash') {
      params.set('auto', '1');
    }
    
    navigate(`/learn/vocab?${params.toString()}`);
  };

  // SRS 상태 기준으로 계산 (오답노트와 1:1 대응)
  const availableCount = wrongAnswers.filter(wa => 
    wa.srsCard && (wa.srsCard.isOverdue || (wa.srsCard.isFromWrongAnswer && !wa.srsCard.isMastered))
  ).length;
  const pendingCount = wrongAnswers.filter(wa => 
    wa.srsCard && !wa.srsCard.isOverdue && !wa.srsCard.isMastered && wa.srsCard.waitingUntil
  ).length;

  return (
    <main className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>📝 오답노트</h2>
        <Link to="/srs" className="btn btn-outline-secondary">
          ← SRS 대시보드
        </Link>
      </div>

      {/* 요약 정보 */}
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
              <h3 className="text-secondary">{pendingCount}</h3>
              <p className="mb-0">대기 중</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-center">
            <div className="card-body">
              <h3 className="text-primary">{wrongAnswers.length}</h3>
              <p className="mb-0">전체</p>
            </div>
          </div>
        </div>
      </div>

      {/* 학습 버튼들 */}
      <div className="d-flex gap-2 mb-4 flex-wrap">
        {/* 학습 시작 버튼 */}
        {selectedIds.size > 0 ? (
          selectedIds.size > 100 ? (
            <button 
              className="btn btn-primary" 
              onClick={() => alert('100개를 초과하여 선택하신 단어는 학습할 수 없습니다. 100개 이하로 선택해주세요.')}
            >
              학습 시작 ({selectedIds.size}개 선택) - 100개 초과
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => handleStartLearning('srs_folder')}
            >
              학습 시작 ({selectedIds.size}개 선택)
            </button>
          )
        ) : (
          <button 
            className="btn btn-primary opacity-50" 
            disabled
            title="단어를 선택해주세요"
          >
            학습 시작
          </button>
        )}
        
        {/* 선택 자동학습 버튼 */}
        {selectedIds.size > 0 ? (
          selectedIds.size > 100 ? (
            <button 
              className="btn btn-success" 
              onClick={() => alert('100개를 초과하여 선택하신 단어는 학습할 수 없습니다. 100개 이하로 선택해주세요.')}
            >
              선택 자동학습 ({selectedIds.size}개) - 100개 초과
            </button>
          ) : (
            <button
              className="btn btn-success"
              onClick={() => handleStartLearning('flash')}
            >
              선택 자동학습 ({selectedIds.size}개)
            </button>
          )
        ) : (
          <button 
            className="btn btn-success opacity-50" 
            disabled
            title="단어를 선택해주세요"
          >
            선택 자동학습
          </button>
        )}
        
{wrongAnswers.length > 0 && (
          <>
            <button 
              className="btn btn-outline-secondary" 
              onClick={handleSelectAll}
            >
              {selectedIds.size === wrongAnswers.length ? '전체 해제' : '전체 선택'}
            </button>
            
            <button 
              className={`btn ${selectedIds.size > 0 ? 'btn-danger' : 'btn-outline-danger'}`}
              onClick={handleDeleteSelected}
              disabled={selectedIds.size === 0}
            >
              🗑️ 선택 삭제 {selectedIds.size > 0 && `(${selectedIds.size}개)`}
            </button>
          </>
        )}
        
        <div className="form-check form-switch">
          <input
            className="form-check-input"
            type="checkbox"
            id="includeCompleted"
            checked={includeCompleted}
            onChange={(e) => setIncludeCompleted(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="includeCompleted">
            완료된 항목 포함
          </label>
        </div>
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
          {wrongAnswers.map((wa, index) => (
            <div key={wa.id} className={`list-group-item ${wa.srsCard?.isMastered ? 'border-warning bg-light' : ''} ${selectedIds.has(wa.id) ? 'border-primary bg-light' : ''}`}>
              <div className="d-flex justify-content-between align-items-start">
                <div className="d-flex align-items-start gap-3">
                  <input
                    type="checkbox"
                    className="form-check-input mt-1"
                    checked={selectedIds.has(wa.id)}
                    onChange={() => handleSelectItem(wa.id)}
                  />
                  <div className="flex-grow-1">
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
                      let koGloss = '뜻 정보 없음';
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
                              if (koGloss !== '뜻 정보 없음') break;
                            }
                            // 직접 koGloss가 있는 경우
                            if (ex?.koGloss) {
                              koGloss = ex.koGloss;
                              break;
                            }
                            // gloss 형태로 저장된 경우
                            if (ex?.kind === 'gloss' && ex?.ko) {
                              koGloss = ex.ko;
                              break;
                            }
                          }
                        }
                      } catch (e) {
                        console.warn('Failed to parse examples:', e);
                      }
                      return koGloss;
                    })()}
                  </p>
                  
                  {/* SRS 상태 정보 (오답노트와 1:1 대응) */}
                  <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                    {/* SRS 상태를 기준으로 표시 */}
                    {getSrsStatusBadge(wa.srsCard)}
                    
                    <small className="text-muted">
                      총 오답 {wa.totalWrongAttempts || wa.attempts}회
                      {wa.wrongAnswerHistory && wa.wrongAnswerHistory.length > 0 && (
                        <span className="text-info"> ({wa.wrongAnswerHistory.length}회 기록)</span>
                      )}
                    </small>
                    <small className="text-muted">
                      최근 오답: {dayjs(wa.wrongAt).format('MM/DD HH:mm')}
                    </small>
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
                    
                    {/* 폴더 정보 및 이동 버튼 */}
                    {wa.srsCard?.folders && wa.srsCard.folders.length > 0 && (
                      <div className="d-flex align-items-center gap-1">
                        <small className="text-muted">폴더:</small>
                        {wa.srsCard.folders.map((folder, idx) => (
                          <span key={folder.id} className="d-flex align-items-center gap-1">
                            {idx > 0 && <span className="text-muted">,</span>}
                            <Link 
                              to={folder.parentId ? `/srs/folder/${folder.id}` : `/srs/parent/${folder.id}`}
                              className="btn btn-outline-primary btn-sm px-2 py-1"
                              style={{ fontSize: '0.75rem' }}
                              title={`${folder.parentName ? `${folder.parentName} > ` : ''}${folder.name}으로 이동`}
                            >
                              {folder.parentName && <span className="text-muted">{folder.parentName} &gt; </span>}
                              {folder.name}
                            </Link>
                          </span>
                        ))}
                      </div>
                    )}
                    
                    <button 
                      className="btn btn-sm btn-outline-info" 
                      onClick={() => toggleDetails(wa.id)}
                    >
                      {expandedDetails.has(wa.id) ? '▼ 세부정보 접기' : '▶ 세부정보 보기'}
                    </button>
                  </div>
                  
                  {/* 확장된 세부 정보 */}
                  {expandedDetails.has(wa.id) && (
                    <div className="border rounded p-3 mb-2 bg-light">
                      <h6 className="text-primary mb-2">📊 오답 세부 정보</h6>
                      <div className="row">
                        <div className="col-md-6">
                          <div className="mb-2">
                            <strong>복습 기간:</strong><br/>
                            <small className="text-muted">
                              {dayjs(wa.reviewWindowStart).format('YYYY.MM.DD HH:mm')} ~ {dayjs(wa.reviewWindowEnd).format('YYYY.MM.DD HH:mm')}
                            </small>
                          </div>
                          <div className="mb-2">
                            <strong>첫 오답 시각:</strong><br/>
                            <small className="text-muted">
                              {wa.wrongAnswerHistory && wa.wrongAnswerHistory.length > 0 
                                ? dayjs(wa.wrongAnswerHistory[0].wrongAt).format('YYYY년 MM월 DD일 HH:mm')
                                : dayjs(wa.wrongAt).format('YYYY년 MM월 DD일 HH:mm')
                              }
                            </small>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-2">
                            <strong>총 오답 횟수:</strong> <span className="badge bg-warning">{wa.totalWrongAttempts || wa.attempts}회</span>
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
                              <div key={history.id} className="mb-2 p-2 bg-white rounded border border-light">
                                <div>
                                  <strong>#{idx + 1}회차:</strong> {dayjs(history.wrongAt).format('YYYY.MM.DD HH:mm')}
                                  <span className="badge bg-danger ms-2">오답</span>
                                  {history.stageAtTime !== undefined && (
                                    <span className="badge bg-info ms-1">Stage {history.stageAtTime}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* SRS 카드 상태 정보 */}
                  {wa.srsCard && (
                    <div className="border-top pt-2 mt-2">
                      <div className="d-flex align-items-center gap-3 small">
                        {wa.srsCard.isMastered ? (
                          <div className="text-warning fw-bold">
                            🌟 마스터 완료 ({wa.srsCard.masterCycles}회)
                          </div>
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
                              정답: {wa.srsCard.correctTotal}회 / 오답: {wa.srsCard.wrongTotal}회
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
                          🏆 {dayjs(wa.srsCard.masteredAt).format('YYYY.MM.DD')} 마스터 달성
                        </div>
                      )}
                    </div>
                  )}
                  
                  {!wa.srsCard && (
                    <div className="border-top pt-2 mt-2">
                      <small className="text-muted">SRS 카드 정보 없음</small>
                    </div>
                  )}
                  </div>
                </div>
                
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}