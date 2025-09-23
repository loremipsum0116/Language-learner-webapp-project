// src/pages/WrongAnswers.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import { fetchJSON, withCreds } from "../api/client";
import ReviewTimer from "../components/ReviewTimer";
import RainbowStar from "../components/RainbowStar";

dayjs.locale("ko");

// 텍스트 파싱 함수 (리스닝용 - 발화자 있든 없든 통합)
function parseTextWithTranslation(text) {
  if (!text) return { type: 'none', data: null };

  try {
    // 발화자 패턴 확인 (A:, B:, C: 등)
    const speakerRegex = /([A-Z]):\s*/g;
    const hasSpeakers = speakerRegex.test(text);

    if (hasSpeakers) {
      // 발화자가 있는 경우 - 발화자별로 분리
      speakerRegex.lastIndex = 0; // 정규식 리셋
      const parts = [];
      let match;

      // 모든 발화자 위치 찾기
      const speakers = [];
      while ((match = speakerRegex.exec(text)) !== null) {
        speakers.push({
          speaker: match[1],
          start: match.index,
          end: match.index + match[0].length
        });
      }

      // 각 발화자의 텍스트 추출
      for (let i = 0; i < speakers.length; i++) {
        const currentSpeaker = speakers[i];
        const nextSpeaker = speakers[i + 1];

        const startIndex = currentSpeaker.end;
        const endIndex = nextSpeaker ? nextSpeaker.start : text.length;

        const content = text.substring(startIndex, endIndex).trim();

        if (content) {
          // 원어와 번역 분리 (마지막 괄호 기준)
          const lastParenIndex = content.lastIndexOf('(');
          const lastParenEndIndex = content.lastIndexOf(')');

          if (lastParenIndex !== -1 && lastParenEndIndex !== -1 && lastParenIndex < lastParenEndIndex) {
            const original = content.substring(0, lastParenIndex).trim();
            const translation = content.substring(lastParenIndex + 1, lastParenEndIndex).trim();

            parts.push({
              speaker: currentSpeaker.speaker,
              original,
              translation
            });
          } else {
            // 번역이 없는 경우
            parts.push({
              speaker: currentSpeaker.speaker,
              original: content,
              translation: ''
            });
          }
        }
      }

      return { type: 'dialogue', data: parts };
    } else {
      // 발화자가 없는 경우 - 단일 텍스트
      const lastParenIndex = text.lastIndexOf('(');
      const lastParenEndIndex = text.lastIndexOf(')');

      if (lastParenIndex !== -1 && lastParenEndIndex !== -1 && lastParenIndex < lastParenEndIndex) {
        const original = text.substring(0, lastParenIndex).trim();
        const translation = text.substring(lastParenIndex + 1, lastParenEndIndex).trim();

        return {
          type: 'single',
          data: {
            original,
            translation
          }
        };
      } else {
        // 번역이 없는 경우
        return {
          type: 'single',
          data: {
            original: text,
            translation: ''
          }
        };
      }
    }
  } catch (error) {
    console.error('텍스트 파싱 오류:', error);
    return { type: 'none', data: null };
  }
}

// 리딩 지문과 번역을 결합하는 함수
function parseReadingWithTranslation(passage, translationData, passageId) {
  if (!passage) return { type: 'none', data: null };

  try {
    let translation = '';

    // 번역 데이터에서 해당 지문의 번역 찾기
    if (translationData && passageId) {
      const translationItem = translationData.find(t => t.id === passageId);
      if (translationItem) {
        translation = translationItem.translation;
      }
    }

    return {
      type: 'single',
      data: {
        original: passage,
        translation
      }
    };
  } catch (error) {
    console.error('리딩 텍스트 파싱 오류:', error);
    return { type: 'none', data: null };
  }
}

function formatTimeRemaining(hours) {
  if (hours <= 0) return "지금";
  if (hours < 24) return `${Math.ceil(hours)}시간 후`;
  const days = Math.floor(hours / 24);
  return `${days}일 후`;
}

// 슬래시를 기점으로 문단을 나누어 표시하는 함수
function formatTextWithParagraphs(text) {
  if (!text) return '';

  // 슬래시(/)를 기준으로 문단 분리
  const paragraphs = text.split('/').map(paragraph => paragraph.trim()).filter(paragraph => paragraph);

  return paragraphs.map((paragraph, index) => (
    <div key={index} className={index > 0 ? "mt-3" : ""}>
      <div dangerouslySetInnerHTML={{ __html: paragraph }}></div>
    </div>
  ));
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
  const [selectedLanguage, setSelectedLanguage] = useState("all"); // 언어 선택 상태 추가
  const [categories, setCategories] = useState({
    vocab: { total: 0, active: 0 },
    grammar: { total: 0, active: 0 },
    reading: { total: 0, active: 0 },
    listening: { total: 0, active: 0 },
  });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedDetails, setExpandedDetails] = useState(new Set());
  const [translationData, setTranslationData] = useState({}); // 번역 데이터 캐시

  const loadCategories = async () => {
    try {
      // 캐시 무효화를 위한 타임스탬프 추가
      const timestamp = Date.now();
      const { data } = await fetchJSON(`/api/odat-note/categories?_=${timestamp}`, withCreds());
      setCategories(data);
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  // 번역 데이터 로드 함수
  const loadTranslationData = async (level, isJapanese) => {
    const cacheKey = `${level}_${isJapanese ? 'ja' : 'en'}`;

    // 이미 로드된 데이터가 있으면 반환
    if (translationData[cacheKey]) {
      return translationData[cacheKey];
    }

    try {
      // 여러 가능한 경로 시도
      const possiblePaths = [];

      if (isJapanese) {
        // 일본어 번역 파일 경로들
        possiblePaths.push(`/${level}_Reading/${level}_Reading_Translation.json`);
        possiblePaths.push(`/${level}/${level}_Reading/${level}_Translation.json`);
        possiblePaths.push(`/${level}_Reading/${level}_Translation.json`);
      } else {
        // 영어 번역 파일 경로들
        possiblePaths.push(`/${level}/${level}_Translation.json`);
        possiblePaths.push(`/${level}_reading/${level}_reading_Translation.json`);
        possiblePaths.push(`/${level}_Reading/${level}_Reading_Translation.json`);
      }

      // 경로를 순서대로 시도
      for (const translationPath of possiblePaths) {
        try {
          const response = await fetch(translationPath);
          if (response.ok) {
            const data = await response.json();
            console.log(`번역 파일 로드 성공: ${translationPath}`, data);
            setTranslationData(prev => ({
              ...prev,
              [cacheKey]: data
            }));
            return data;
          }
        } catch (pathError) {
          console.log(`번역 파일 로드 실패: ${translationPath}`, pathError);
          continue;
        }
      }
    } catch (error) {
      console.error(`번역 데이터 로드 실패 (${level}):`, error);
    }

    return null;
  };

  // 언어별 필터링 함수
  const detectLanguage = (wrongAnswer) => {
    // 어휘의 경우
    if (selectedTab === "vocab" && wrongAnswer.vocab) {
      // 일본어 단어 감지
      if (wrongAnswer.vocab.lemma && /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(wrongAnswer.vocab.lemma)) {
        return 'ja';
      }
      // JLPT 레벨이나 일본어 관련 필드가 있으면 일본어
      if (wrongAnswer.vocab.levelJLPT || wrongAnswer.vocab.source === 'jlpt_vocabs') {
        return 'ja';
      }
      // 그 외는 영어
      return 'en';
    }

    // 문법의 경우
    if (selectedTab === "grammar" && wrongAnswer.wrongData) {
      // wrongData에서 언어 정보 확인
      if (wrongAnswer.wrongData.language === 'ja') {
        return 'ja';
      }
      // 문제 텍스트에 일본어 문자가 있으면 일본어
      if (wrongAnswer.wrongData.question && /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(wrongAnswer.wrongData.question)) {
        return 'ja';
      }
      return 'en';
    }

    // 리딩, 리스닝의 경우도 유사하게 처리
    if ((selectedTab === "reading" || selectedTab === "listening") && wrongAnswer.wrongData) {
      // itemType을 우선 확인 (가장 정확한 방법)
      if (wrongAnswer.itemType === 'japanese-reading' || wrongAnswer.itemType === 'japanese-listening') {
        return 'ja';
      }
      if (wrongAnswer.wrongData.language === 'ja') {
        return 'ja';
      }
      // 문제나 지문에 일본어 문자가 있으면 일본어
      const textToCheck = wrongAnswer.wrongData.question || wrongAnswer.wrongData.passage || wrongAnswer.wrongData.script || '';
      if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(textToCheck)) {
        return 'ja';
      }
      return 'en';
    }

    return 'en'; // 기본값은 영어
  };

  // 리딩 지문과 번역을 표시하는 컴포넌트
  function ReadingPassageWithTranslation({ wrongAnswer, loadTranslationData }) {
    const [translation, setTranslation] = useState('');
    const [loading, setLoading] = useState(true);
    const isJapanese = detectLanguage(wrongAnswer) === 'ja';

    useEffect(() => {
      const loadTranslation = async () => {
        setLoading(true);
        try {
          // questionId에서 레벨과 지문 ID 추출
          const questionId = wrongAnswer.wrongData?.questionId;
          console.log(`번역 로드 시도: questionId=${questionId}, isJapanese=${isJapanese}`);

          if (!questionId) {
            setLoading(false);
            return;
          }

          let level, passageId;

          if (isJapanese) {
            // 일본어 패턴들 시도
            let match = questionId.match(/^(N[1-5])_JR_(\d+)_Q\d+$/); // N1_JR_002_Q1
            if (!match) {
              match = questionId.match(/^(N[1-5])_(\d+)_Q\d+$/); // N1_002_Q1
            }
            if (!match) {
              match = questionId.match(/^(N[1-5]).*?(\d+).*?Q\d+$/); // 더 유연한 패턴
            }

            if (match) {
              level = match[1];
              passageId = parseInt(match[2]);
              console.log(`일본어 매칭 성공: level=${level}, passageId=${passageId}`);
            }
          } else {
            // 영어 패턴들 시도
            let match = questionId.match(/^([ABC][12])_R_(\d+)$/); // A2_R_001
            if (!match) {
              match = questionId.match(/^([ABC][12])_(\d+)_Q\d+$/); // A1_002_Q1
            }
            if (!match) {
              match = questionId.match(/^([ABC][12])_reading_(\d+)_Q\d+$/); // A1_reading_002_Q1
            }
            if (!match) {
              match = questionId.match(/^([ABC][12])_Reading_(\d+)_Q\d+$/); // A1_Reading_002_Q1
            }
            if (!match) {
              match = questionId.match(/^([ABC][12]).*?(\d+).*?Q?\d*$/); // 더 유연한 패턴
            }

            if (match) {
              level = match[1];
              passageId = parseInt(match[2]);
              console.log(`영어 매칭 성공: level=${level}, passageId=${passageId}`);
            } else {
              console.log(`영어 패턴 매칭 실패: questionId=${questionId}`);
            }
          }

          if (level && passageId) {
            const translationData = await loadTranslationData(level, isJapanese);
            if (translationData) {
              const translationItem = translationData.find(t => t.id === passageId);
              if (translationItem) {
                setTranslation(translationItem.translation);
              }
            }
          }
        } catch (error) {
          console.error('번역 로드 오류:', error);
        } finally {
          setLoading(false);
        }
      };

      loadTranslation();
    }, [wrongAnswer, loadTranslationData, isJapanese]);

    if (loading) {
      return (
        <div className="text-center p-3">
          <div className="spinner-border spinner-border-sm" role="status">
            <span className="visually-hidden">번역 로딩 중...</span>
          </div>
          <div className="small text-muted mt-2">번역을 불러오는 중...</div>
        </div>
      );
    }

    return (
      <div>
        {/* 원어 지문 */}
        <div className="mb-3">
          <h6 className="text-primary mb-2">📝 지문 ({isJapanese ? '일본어' : '영어'})</h6>
          <div className="p-3 bg-white rounded border">
            <div className={isJapanese ? "japanese-text" : ""}>
              {formatTextWithParagraphs(wrongAnswer.wrongData.passage)}
            </div>
          </div>
        </div>

        {/* 한글 번역 */}
        <div>
          <h6 className="text-success mb-2">📝 번역 (한국어)</h6>
          <div className="p-3 bg-white rounded border">
            {translation ? (
              <div>
                {formatTextWithParagraphs(translation)}
              </div>
            ) : (
              <div className="text-muted">번역을 찾을 수 없습니다.</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const reload = async () => {
    setLoading(true);
    try {
      // 캐시 무효화를 위한 타임스탬프 추가
      const timestamp = Date.now();
      const { data } = await fetchJSON(`/api/odat-note/list?type=${selectedTab}&_=${timestamp}`, withCreds());
      const allData = data || [];

      console.log(`🔍 [WrongAnswers DEBUG] API 응답:`, {
        selectedTab,
        selectedLanguage,
        totalItems: allData.length,
        data: allData
      });

      // 언어별 필터링
      let filteredData = allData;
      if (selectedLanguage !== "all") {
        filteredData = allData.filter(wrongAnswer => {
          const detectedLanguage = detectLanguage(wrongAnswer);
          console.log(`🧭 [언어 감지] ID: ${wrongAnswer.id}, 감지된 언어: ${detectedLanguage}, 선택된 언어: ${selectedLanguage}, 표시 여부: ${detectedLanguage === selectedLanguage}`);
          return detectedLanguage === selectedLanguage;
        });
      }

      console.log(`📊 [필터링 결과] 전체: ${allData.length}개 → 필터링 후: ${filteredData.length}개`);
      setWrongAnswers(filteredData);
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
  }, [selectedTab, selectedLanguage]);

  // 오답 기록 이벤트 리스너 추가
  useEffect(() => {
    const handleWrongAnswerAdded = () => {
      console.log('[WRONG ANSWERS] New wrong answer detected, refreshing...');
      reload();
      loadCategories();
    };

    const handleDataUpdated = (event) => {
      console.log('[WRONG ANSWERS] SRS data updated (folder deleted), refreshing...', event?.detail);
      reload();
      loadCategories();
    };

    // localStorage 변경 감지 (다른 탭에서 폴더 삭제 시)
    const handleStorageChange = (e) => {
      if (e.key === 'srs-data-updated') {
        console.log('[WRONG ANSWERS] Storage event detected, refreshing...');
        reload();
        loadCategories();
      }
    };

    // 페이지가 다시 포커스될 때 새로고침 (다른 탭에서 학습 후 돌아올 때)
    const handleFocus = () => {
      console.log('[WRONG ANSWERS] Page focused, refreshing...');
      reload();
      loadCategories();
    };

    // 페이지가 다시 보이게 될 때 새로고침 (탭 전환 시)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('[WRONG ANSWERS] Page became visible, refreshing...');
        reload();
        loadCategories();
      }
    };

    // 커스텀 이벤트 리스너 등록
    window.addEventListener('wrongAnswerAdded', handleWrongAnswerAdded);
    window.addEventListener('srsDataUpdated', handleDataUpdated);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('wrongAnswerAdded', handleWrongAnswerAdded);
      window.removeEventListener('srsDataUpdated', handleDataUpdated);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

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
      
      // 다른 페이지에 삭제 완료 알림 (실시간 업데이트용)
      localStorage.setItem('wrongAnswersUpdated', Date.now().toString());
      
      // 같은 탭에서도 이벤트 발생 (storage 이벤트는 다른 탭에서만 발생)
      window.dispatchEvent(new CustomEvent('wrongAnswersUpdated', { 
        detail: { timestamp: Date.now() } 
      }));
      
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
      const reviewData = selectedWrongAnswers.map((wa) => {
        // questionId에서 숫자 부분 추출
        let questionIndex = 0;
        const questionId = wa.wrongData?.questionId;
        if (typeof questionId === 'string' && questionId.includes('_')) {
          // 일본어 리딩의 경우 지문 번호 추출 (N1_JR_002_Q1 -> 002)
          const passageMatch = questionId.match(/_JR_(\d+)(_Q\d+)?$/);
          if (passageMatch) {
            questionIndex = parseInt(passageMatch[1]) - 1; // 지문 번호에서 0-based index
          } else {
            const match = questionId.match(/_(\d+)$/);
            questionIndex = match ? parseInt(match[1]) - 1 : 0; // 기존 로직
          }
        } else if (questionId) {
          questionIndex = parseInt(questionId) - 1 || 0;
        }
        
        return {
          id: wa.id,
          level: wa.wrongData?.level || "A1",
          questionIndex: questionIndex,
          passage: wa.wrongData?.passage || "",
          question: wa.wrongData?.question || "",
          options: wa.wrongData?.options || {},
          answer: wa.wrongData?.correctAnswer || "A",
          explanation_ko: wa.wrongData?.explanation || "",
          isReview: true,
          wrongAnswerId: wa.id,
        };
      });

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

        {/* 언어 섹션 선택 탭 */}
        <div className="mt-3">
          <ul className="nav nav-pills">
            <li className="nav-item">
              <button
                className={`nav-link ${selectedLanguage === "all" ? "active" : ""}`}
                onClick={() => setSelectedLanguage("all")}
              >
                🌐 전체
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${selectedLanguage === "en" ? "active" : ""}`}
                onClick={() => setSelectedLanguage("en")}
              >
                🇺🇸 영어
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${selectedLanguage === "ja" ? "active" : ""}`}
                onClick={() => setSelectedLanguage("ja")}
              >
                🇯🇵 일본어
              </button>
            </li>
          </ul>
        </div>
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
                key={`wrong-answer-${safeId}-${index}`}
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
                              let koGloss = "뜻 정보 없음";

                              try {
                                // 1순위: vocab.translations에서 한국어 번역 확인 (새로운 데이터 구조)
                                if (wa.vocab?.translations && Array.isArray(wa.vocab.translations)) {
                                  const koreanTranslation = wa.vocab.translations.find(t =>
                                    t.language?.code === 'ko'
                                  );
                                  if (koreanTranslation?.translation) {
                                    koGloss = koreanTranslation.translation;
                                    return koGloss; // 찾았으면 즉시 반환
                                  }
                                }

                                // 2순위: 기존 dictentry.examples 방식 (하위 호환성)
                                if (wa.vocab?.dictentry?.examples) {
                                  let examples = wa.vocab.dictentry.examples;

                                  // 문자열인 경우에만 JSON 파싱
                                  if (typeof examples === 'string') {
                                    examples = JSON.parse(examples);
                                  }

                                  // 배열이 아닌 경우 배열로 변환
                                  if (!Array.isArray(examples)) {
                                    examples = [examples];
                                  }

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
                                console.warn("Failed to parse vocab meaning:", e);
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
                              📖 {wa.wrongData.level} 레벨 리딩 문제 #{(() => {
                                // questionId에서 숫자 부분 추출
                                const questionId = wa.wrongData.questionId;
                                if (typeof questionId === 'string' && questionId.includes('_')) {
                                  // 일본어 리딩의 경우 지문 번호 추출 (N1_JR_002_Q1 -> 002)
                                  const passageMatch = questionId.match(/_JR_(\d+)(_Q\d+)?$/);
                                  if (passageMatch) {
                                    return parseInt(passageMatch[1]); // 지문 번호
                                  } else {
                                    const match = questionId.match(/_(\d+)$/);
                                    return match ? parseInt(match[1]) : 'NaN';
                                  }
                                }
                                return questionId || 'NaN';
                              })()}
                            </h5>
                          </div>

                          <div className="mb-2">
                            <div className="mb-2">
                              <strong>문제:</strong> <span className={detectLanguage(wa) === 'ja' ? "japanese-text" : ""} dangerouslySetInnerHTML={{ __html: wa.wrongData.question }}></span>
                            </div>
                            <div className="mb-2">
                              <span className="badge bg-danger me-2">내 답: {wa.wrongData.userAnswer}</span>
                              <span className="badge bg-success">정답: {wa.wrongData.correctAnswer}</span>
                            </div>
                            {wa.wrongData.passage && (
                              <div className="small text-muted">
                                <strong>지문:</strong>
                                <div className="mt-1">
                                  {(() => {
                                    const isJapanese = detectLanguage(wa) === 'ja';
                                    const shortOriginal = wa.wrongData.passage.length > 100
                                      ? wa.wrongData.passage.substring(0, 100) + '...'
                                      : wa.wrongData.passage;

                                    return (
                                      <div>
                                        <div className="text-muted">
                                          <strong>{isJapanese ? '일본어' : '영어'}:</strong> <span className={isJapanese ? "japanese-text" : ""} dangerouslySetInnerHTML={{ __html: shortOriginal }}></span>
                                        </div>
                                        <div className="text-muted small">(번역은 세부정보에서 확인 가능)</div>
                                      </div>
                                    );
                                  })()}
                                </div>
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
                              <strong>문제:</strong> <span dangerouslySetInnerHTML={{ __html: wa.wrongData.question }}></span>
                            </div>
                            <div className="mb-2">
                              <span className="badge bg-danger me-2">내 답: <span dangerouslySetInnerHTML={{ __html: wa.wrongData.userAnswer }}></span></span>
                              <span className="badge bg-success">정답: <span dangerouslySetInnerHTML={{ __html: wa.wrongData.correctAnswer }}></span></span>
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
                              <strong>스크립트:</strong>
                              <div className="small mt-1">
                                {(() => {
                                  const parsedScript = parseTextWithTranslation(wa.wrongData.script);

                                  if (parsedScript.type === 'dialogue' && parsedScript.data.length > 0) {
                                    // 발화자가 있는 대화형
                                    const firstDialogue = parsedScript.data[0];
                                    const shortOriginal = firstDialogue.original.length > 50
                                      ? firstDialogue.original.substring(0, 50) + '...'
                                      : firstDialogue.original;
                                    const shortTranslation = firstDialogue.translation.length > 50
                                      ? firstDialogue.translation.substring(0, 50) + '...'
                                      : firstDialogue.translation;

                                    const isJapanese = detectLanguage(wa) === 'ja';

                                    return (
                                      <div>
                                        <div className="text-muted">
                                          <strong>{firstDialogue.speaker}:</strong> <span className={isJapanese ? "japanese-text" : ""}>{shortOriginal}</span>
                                        </div>
                                        <div className="text-muted">
                                          <strong>{firstDialogue.speaker}:</strong> {shortTranslation}
                                        </div>
                                        {parsedScript.data.length > 1 && (
                                          <div className="text-muted small">... 외 {parsedScript.data.length - 1}명 더 (자세히 보려면 세부정보 보기)</div>
                                        )}
                                      </div>
                                    );
                                  } else if (parsedScript.type === 'single' && parsedScript.data) {
                                    // 발화자가 없는 단일 텍스트
                                    const shortOriginal = parsedScript.data.original.length > 100
                                      ? parsedScript.data.original.substring(0, 100) + '...'
                                      : parsedScript.data.original;
                                    const shortTranslation = parsedScript.data.translation.length > 100
                                      ? parsedScript.data.translation.substring(0, 100) + '...'
                                      : parsedScript.data.translation;

                                    const isJapanese = detectLanguage(wa) === 'ja';

                                    return (
                                      <div>
                                        <div className="text-muted">
                                          <strong>{isJapanese ? '일본어' : '영어'}:</strong> <span className={isJapanese ? "japanese-text" : ""}>{shortOriginal}</span>
                                        </div>
                                        <div className="text-muted">
                                          <strong>한글:</strong> {shortTranslation}
                                        </div>
                                        <div className="text-muted small">(자세히 보려면 세부정보 보기)</div>
                                      </div>
                                    );
                                  } else {
                                    return <em>"{wa.wrongData.script || "스크립트 정보 없음"}"</em>;
                                  }
                                })()}
                              </div>
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
                          <small className="text-muted">총 오답 {wa.wrongData?.incorrectCount || wa.attempts}회</small>
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
                                  <div className="bg-light p-3 mt-2 rounded border">
                                    <ReadingPassageWithTranslation
                                      wrongAnswer={wa}
                                      loadTranslationData={loadTranslationData}
                                    />
                                  </div>
                                </div>

                                <div className="mb-3">
                                  <strong>❓ 문제:</strong>
                                  <div className={`bg-white p-2 mt-1 rounded border ${detectLanguage(wa) === 'ja' ? 'japanese-text' : ''}`} dangerouslySetInnerHTML={{ __html: wa.wrongData.question }}></div>
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
                                        <strong>{key}.</strong> <span className={detectLanguage(wa) === 'ja' ? "japanese-text" : ""} dangerouslySetInnerHTML={{ __html: value }}></span>
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
                                    <div className="bg-info bg-opacity-10 p-2 mt-1 rounded border" dangerouslySetInnerHTML={{ __html: wa.wrongData.explanation }}>
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
                                      <span className="badge bg-warning">{wa.wrongData?.incorrectCount || wa.attempts}회</span>
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
                                  <div className="bg-white p-3 mt-2 rounded border" dangerouslySetInnerHTML={{ __html: wa.wrongData.question }}></div>
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
                                        <strong dangerouslySetInnerHTML={{ __html: option }}></strong>
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
                                    <div className="bg-info bg-opacity-10 p-2 mt-1 rounded border" dangerouslySetInnerHTML={{ __html: wa.wrongData.explanation }}>
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
                                      <span className="badge bg-warning">{wa.wrongData?.incorrectCount || wa.attempts}회</span>
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
                                    {(() => {
                                      const parsedScript = parseTextWithTranslation(wa.wrongData.script);
                                      const isJapanese = detectLanguage(wa) === 'ja';

                                      if (parsedScript.type === 'dialogue' && parsedScript.data.length > 0) {
                                        return (
                                          <div>
                                            {/* 원어 대화 */}
                                            <div className="mb-3">
                                              <h6 className="text-primary mb-2">🗣️ 대화 ({isJapanese ? '일본어' : '영어'})</h6>
                                              {parsedScript.data.map((dialogue, idx) => (
                                                <div key={`original-${idx}`} className="mb-2 p-2 bg-white rounded border">
                                                  <div className="fw-bold text-info">{dialogue.speaker}:</div>
                                                  <div className={isJapanese ? "japanese-text" : ""}>{dialogue.original}</div>
                                                </div>
                                              ))}
                                            </div>

                                            {/* 한글 번역 */}
                                            <div>
                                              <h6 className="text-success mb-2">🗣️ 번역 (한국어)</h6>
                                              {parsedScript.data.map((dialogue, idx) => (
                                                <div key={`translation-${idx}`} className="mb-2 p-2 bg-white rounded border">
                                                  <div className="fw-bold text-info">{dialogue.speaker}:</div>
                                                  <div>{dialogue.translation}</div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        );
                                      } else if (parsedScript.type === 'single' && parsedScript.data) {
                                        return (
                                          <div>
                                            {/* 원어 텍스트 */}
                                            <div className="mb-3">
                                              <h6 className="text-primary mb-2">📝 스크립트 ({isJapanese ? '일본어' : '영어'})</h6>
                                              <div className="p-3 bg-white rounded border">
                                                <div className={isJapanese ? "japanese-text" : ""}>{parsedScript.data.original}</div>
                                              </div>
                                            </div>

                                            {/* 한글 번역 */}
                                            <div>
                                              <h6 className="text-success mb-2">📝 번역 (한국어)</h6>
                                              <div className="p-3 bg-white rounded border">
                                                <div>{parsedScript.data.translation}</div>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      } else {
                                        // 파싱 실패시 기존 방식으로 표시
                                        return <em>"{wa.wrongData.script}"</em>;
                                      }
                                    })()}
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
                                      <span className="badge bg-warning">{wa.wrongData?.incorrectCount || wa.attempts}회</span>
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
