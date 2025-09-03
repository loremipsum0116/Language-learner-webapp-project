// src/pages/MasteredWords.jsx
// 마스터 완료 단어들을 보여주는 전용 페이지

import React, { useState, useEffect } from 'react';
import RainbowStar from '../components/RainbowStar';

const MasteredWords = () => {
  const [masteredData, setMasteredData] = useState(null);
  const [masteryStats, setMasteryStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('masteredAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadMasteredWords();
    if (currentPage === 0) {
      loadMasteryStats();
    }
  }, [sortBy, sortOrder, currentPage, searchTerm]);

  const loadMasteredWords = async () => {
    try {
      const token = localStorage.getItem('authToken');
      let url = `/api/srs/mastered?limit=${itemsPerPage}&offset=${currentPage * itemsPerPage}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      
      if (searchTerm.trim()) {
        url += `&search=${encodeURIComponent(searchTerm.trim())}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMasteredData(data.data);
      } else {
        console.error('Failed to load mastered words');
      }
    } catch (error) {
      console.error('Error loading mastered words:', error);
    }
  };

  const loadMasteryStats = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/srs/mastery-stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMasteryStats(data.data);
      }
    } catch (error) {
      console.error('Error loading mastery stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSortLabel = (key) => {
    const labels = {
      'masteredAt': '마스터 완료일',
      'masterCycles': '완료 횟수',
      'correctTotal': '정답 횟수',
      'lemma': '단어 이름'
    };
    return labels[key] || key;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <span className="ml-4 text-lg">마스터 단어를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-800">
            🌟 마스터 단어 갤러리
          </h1>
          <RainbowStar size="large" animated={true} />
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-600">총 마스터 단어</div>
          <div className="text-2xl font-bold text-purple-600">
            {masteredData?.totalMastered || 0}개
          </div>
        </div>
      </div>

      {/* 통계 대시보드 */}
      {masteryStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg p-6 text-white">
            <h3 className="text-lg font-semibold mb-2">마스터율</h3>
            <div className="text-3xl font-bold">{masteryStats.masteryRate}%</div>
            <div className="text-sm opacity-80">
              {masteryStats.masteredCount} / {masteryStats.totalCards}
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg p-6 text-white">
            <h3 className="text-lg font-semibold mb-2">총 단어</h3>
            <div className="text-3xl font-bold">{masteryStats.totalCards}</div>
          </div>
          
          <div className="bg-gradient-to-r from-green-500 to-teal-500 rounded-lg p-6 text-white">
            <h3 className="text-lg font-semibold mb-2">마스터 완료</h3>
            <div className="text-3xl font-bold">{masteryStats.masteredCount}</div>
          </div>
          
          <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-lg p-6 text-white">
            <h3 className="text-lg font-semibold mb-2">최근 마스터</h3>
            <div className="text-sm">
              {masteryStats.recentMastery?.[0]?.lemma || '없음'}
            </div>
            <div className="text-xs opacity-80">
              {masteryStats.recentMastery?.[0]?.masteredAt && 
                formatDate(masteryStats.recentMastery[0].masteredAt)}
            </div>
          </div>
        </div>
      )}

      {/* 검색 및 정렬 옵션 */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        {/* 검색 입력 */}
        <div className="mb-4">
          <input
            type="search"
            placeholder="마스터한 단어 검색..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(0); // 검색 시 첫 페이지로 리셋
            }}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        
        {/* 정렬 옵션 */}
        <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <span className="font-medium">정렬:</span>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1"
          >
            <option value="masteredAt">마스터 완료일</option>
            <option value="masterCycles">완료 횟수</option>
            <option value="correctTotal">정답 횟수</option>
            <option value="lemma">단어명(알파벳순)</option>
            <option value="levelCEFR">레벨순</option>
          </select>
        </label>
        
        <label className="flex items-center gap-2">
          <span className="font-medium">순서:</span>
          <select 
            value={sortOrder} 
            onChange={(e) => setSortOrder(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1"
          >
            <option value="desc">내림차순</option>
            <option value="asc">올림차순</option>
          </select>
        </label>
        
        <div className="ml-auto text-sm text-gray-600">
          {currentPage * itemsPerPage + 1} - {Math.min((currentPage + 1) * itemsPerPage, masteredData?.totalMastered || 0)} / {masteredData?.totalMastered || 0}
        </div>
        </div>
      </div>

      {/* 마스터 단어 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {masteredData?.masteredCards?.map((card) => (
          <div 
            key={card.id} 
            className="vocab-card bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 relative border border-gray-200"
          >
            {/* 무지개 별 */}
            <RainbowStar 
              size="medium" 
              cycles={card.masterCycles} 
              animated={true}
              className="absolute top-3 right-3"
            />
            
            {/* 단어 정보 */}
            <div className="mb-4">
              <h3 className="text-xl font-bold text-gray-800 mb-1">
                {card.vocab?.lemma || 'Unknown Word'}
              </h3>
              <div className="text-sm text-gray-600">
                {card.vocab?.pos} • {card.vocab?.levelCEFR}
              </div>
            </div>
            
            {/* 마스터 정보 */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">마스터 완료:</span>
                <span className="font-medium">
                  {formatDate(card.masteredAt)}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">완료 횟수:</span>
                <span className="font-bold text-purple-600">
                  {card.masterCycles}회
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">정답률:</span>
                <span className="font-medium">
                  {card.correctTotal > 0 && card.wrongTotal >= 0 
                    ? `${((card.correctTotal / (card.correctTotal + card.wrongTotal)) * 100).toFixed(1)}%`
                    : '100%'
                  }
                </span>
              </div>
            </div>
            
            {/* 발음 및 의미 (있는 경우) */}
            {card.vocab?.dictMeta && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                {card.vocab.dictMeta.ipa && (
                  <div className="text-sm text-gray-600 mb-1">
                    /{card.vocab.dictMeta.ipa}/
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 빈 상태 */}
      {(!masteredData?.masteredCards || masteredData.masteredCards.length === 0) && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🌟</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            아직 마스터 완료한 단어가 없습니다
          </h3>
          <p className="text-gray-600">
            120일 사이클을 완주하여 첫 무지개 별을 획득해보세요!
          </p>
        </div>
      )}

      {/* 페이지네이션 */}
      {masteredData?.pagination && masteredData.masteredCards?.length > 0 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <button
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="px-4 py-2 bg-gray-300 rounded-lg disabled:opacity-50"
          >
            이전
          </button>
          
          <span className="px-4 py-2">
            페이지 {currentPage + 1}
          </span>
          
          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={!masteredData.pagination.hasMore}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
};

export default MasteredWords;