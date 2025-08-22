import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './ReadingList.css';

export default function ReadingList() {
    const [levelData, setLevelData] = useState({});
    const [loading, setLoading] = useState(true);

    const levels = [
        { 
            code: 'A1', 
            name: 'Beginner', 
            description: '기초 수준의 간단한 일상 표현과 기본 문법',
            color: '#ff6b6b',
            available: true
        },
        { 
            code: 'A2', 
            name: 'Elementary', 
            description: '친숙한 주제에 대한 간단한 대화와 문장',
            color: '#ffa726',
            available: true
        },
        { 
            code: 'B1', 
            name: 'Intermediate', 
            description: '일반적인 주제에 대한 명확한 표준 언어',
            color: '#66bb6a',
            available: true
        },
        { 
            code: 'B2', 
            name: 'Upper-Intermediate', 
            description: '복잡한 텍스트와 추상적 주제 이해',
            color: '#42a5f5',
            available: false
        },
        { 
            code: 'C1', 
            name: 'Advanced', 
            description: '복잡하고 긴 텍스트의 함축적 의미 파악',
            color: '#ab47bc',
            available: false
        }
    ];

    useEffect(() => {
        loadLevelData();
    }, []);

    const loadLevelData = async () => {
        setLoading(true);
        const data = {};

        for (const level of levels) {
            if (level.available) {
                try {
                    const response = await fetch(`/${level.code}/${level.code}_reading/${level.code}_reading.json`);
                    if (response.ok) {
                        const jsonData = await response.json();
                        data[level.code] = {
                            count: jsonData.length,
                            available: true
                        };
                    } else {
                        data[level.code] = { count: 0, available: false };
                    }
                } catch (err) {
                    console.error(`Failed to load ${level.code} data:`, err);
                    data[level.code] = { count: 0, available: false };
                }
            } else {
                data[level.code] = { count: 0, available: false };
            }
        }

        setLevelData(data);
        setLoading(false);
    };

    const getDifficultyInfo = (levelCode) => {
        switch (levelCode) {
            case 'A1': return { icon: '🌱', difficulty: '매우 쉬움' };
            case 'A2': return { icon: '🌿', difficulty: '쉬움' };
            case 'B1': return { icon: '🌳', difficulty: '보통' };
            case 'B2': return { icon: '🎯', difficulty: '어려움' };
            case 'C1': return { icon: '🎓', difficulty: '매우 어려움' };
            default: return { icon: '📚', difficulty: '알 수 없음' };
        }
    };

    if (loading) {
        return (
            <main className="container py-4">
                <div className="text-center">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2">리딩 레벨 정보를 불러오는 중...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="container py-4">
            <div className="reading-list-container">
                {/* Header */}
                <div className="reading-list-header">
                    <h1 className="reading-list-title">📚 영어 리딩 연습</h1>
                    <p className="reading-list-subtitle">
                        당신의 수준에 맞는 리딩 문제를 선택하세요. CEFR 기준에 따라 A1부터 C1까지 단계별로 구성되어 있습니다.
                    </p>
                </div>

                {/* Level Cards Grid */}
                <div className="level-cards-grid">
                    {levels.map((level) => {
                        const info = getDifficultyInfo(level.code);
                        const data = levelData[level.code] || { count: 0, available: false };
                        const isAvailable = data.available && data.count > 0;

                        return (
                            <div 
                                key={level.code} 
                                className={`level-card ${isAvailable ? 'available' : 'unavailable'}`}
                                style={{ '--level-color': level.color }}
                            >
                                <div className="level-card-header">
                                    <div className="level-info">
                                        <div className="level-icon">{info.icon}</div>
                                        <div className="level-details">
                                            <h3 className="level-code">{level.code}</h3>
                                            <span className="level-name">{level.name}</span>
                                        </div>
                                    </div>
                                    <div className="difficulty-badge">
                                        {info.difficulty}
                                    </div>
                                </div>

                                <div className="level-description">
                                    {level.description}
                                </div>

                                <div className="level-stats">
                                    {isAvailable ? (
                                        <div className="stats-available">
                                            <span className="question-count">
                                                📝 {data.count}개 문제
                                            </span>
                                            <span className="estimated-time">
                                                ⏱️ 약 {Math.ceil(data.count * 1.5)}분
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="stats-unavailable">
                                            <span className="coming-soon">
                                                {level.available ? '데이터 로딩 실패' : '준비 중'}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="level-actions">
                                    {isAvailable ? (
                                        <Link 
                                            to={`/reading/practice?level=${level.code}`}
                                            className="start-btn"
                                        >
                                            🚀 시작하기
                                        </Link>
                                    ) : (
                                        <button className="start-btn disabled" disabled>
                                            {level.available ? '⏳ 로딩 실패' : '🔒 준비 중'}
                                        </button>
                                    )}
                                </div>

                                {/* Progress indicator for available levels */}
                                {isAvailable && (
                                    <div className="level-progress">
                                        <div className="progress-bar">
                                            <div 
                                                className="progress-fill"
                                                style={{ width: '0%' }}
                                            ></div>
                                        </div>
                                        <span className="progress-text">시작 전</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Information Section */}
                <div className="reading-info-section">
                    <h3 className="info-title">📖 리딩 연습 가이드</h3>
                    <div className="info-grid">
                        <div className="info-card">
                            <div className="info-icon">🎯</div>
                            <h4>단계별 학습</h4>
                            <p>A1부터 C1까지 체계적인 단계별 학습으로 실력을 점진적으로 향상시킬 수 있습니다.</p>
                        </div>
                        
                        <div className="info-card">
                            <div className="info-icon">💡</div>
                            <h4>즉시 피드백</h4>
                            <p>각 문제마다 정답과 함께 상세한 한국어 해설을 제공하여 이해도를 높입니다.</p>
                        </div>
                        
                        <div className="info-card">
                            <div className="info-icon">📊</div>
                            <h4>진행률 추적</h4>
                            <p>학습 진행 상황과 점수를 실시간으로 확인하며 성취감을 느낄 수 있습니다.</p>
                        </div>
                        
                        <div className="info-card">
                            <div className="info-icon">🔄</div>
                            <h4>반복 학습</h4>
                            <p>언제든지 다시 시작할 수 있어 반복 학습을 통해 실력을 확실히 다질 수 있습니다.</p>
                        </div>
                    </div>
                </div>

                {/* Back to Home */}
                <div className="back-to-home">
                    <Link to="/home" className="back-btn">
                        🏠 홈으로 돌아가기
                    </Link>
                </div>
            </div>
        </main>
    );
}