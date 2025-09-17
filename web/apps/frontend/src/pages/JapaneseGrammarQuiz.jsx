// src/pages/JapaneseGrammarQuiz.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { japaneseGrammarTopics } from '../data/japaneseMockGrammar';
import { fetchJSON, withCreds } from '../api/client';

// 설명 콘텐츠를 렌더링하는 헬퍼 컴포넌트
function ExplanationContent({ item }) {
    switch (item.type) {
        case 'heading':
            return <h5 className="mt-3 mb-2 text-primary" dangerouslySetInnerHTML={{ __html: item.content }}></h5>;
        case 'list':
            return (
                <ul className="list-unstyled ps-3">
                    {item.items.map((li, i) => (
                        <li key={i} className="mb-1">
                            {li.startsWith('🔸') || li.startsWith('🔹') || li.startsWith('📌') || li.startsWith('🎯') ? (
                                <span className="d-block mb-1 fw-bold" dangerouslySetInnerHTML={{ __html: li }}></span>
                            ) : li.includes('→') ? (
                                <span className="d-block ps-3 text-muted" dangerouslySetInnerHTML={{ __html: li }}></span>
                            ) : (
                                <span dangerouslySetInnerHTML={{ __html: `• ${li}` }}></span>
                            )}
                        </li>
                    ))}
                </ul>
            );
        case 'example':
            return (
                <div className="p-3 my-2 rounded bg-light border-start border-4 border-info">
                    {item.items.map((ex, i) => (
                        <div key={i} className="mb-2">
                            <span lang="ja" className="d-block fs-5 mb-1" dangerouslySetInnerHTML={{ __html: ex.de }}></span>
                            <small className="text-muted d-block ps-2" dangerouslySetInnerHTML={{ __html: `→ ${ex.ko}` }}></small>
                        </div>
                    ))}
                </div>
            );
        default:
            return <p className="mb-2 lh-lg" dangerouslySetInnerHTML={{ __html: item.content }}></p>;
    }
}

export default function JapaneseGrammarQuiz() {
    const { topicId } = useParams();
    const [topic, setTopic] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [incorrectAnswers, setIncorrectAnswers] = useState([]);
    const [isCompleted, setIsCompleted] = useState(false);
    const [viewMode, setViewMode] = useState('explanation');
    const [explanationPage, setExplanationPage] = useState(0);
    const [score, setScore] = useState(0);

    useEffect(() => {
        const currentTopic = japaneseGrammarTopics.find(t => t.id === topicId);
        if (currentTopic) {
            setTopic(currentTopic);
            setQuestions(currentTopic.questions);
            setExplanationPage(0);
            setScore(0);
        }
    }, [topicId]);

    const currentQuestion = questions[currentIndex];

    const handleOptionSelect = (option) => {
        if (feedback) return;
        setUserAnswer(option);
    };

    const handleSubmit = async () => {
        const isCorrect = userAnswer === currentQuestion.answer;
        setFeedback({
            isCorrect,
            explanation: currentQuestion.explanation,
        });

        if (isCorrect) {
            setScore(prev => prev + 1);
        } else {
            setIncorrectAnswers(prev => [...prev, currentQuestion]);

            // 오답노트에 일본어 문법 문제 기록
            try {
                await fetchJSON('/api/odat-note', withCreds({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'japanese-grammar',
                        wrongData: {
                            topicId: topicId,
                            topicTitle: topic.title,
                            questionIndex: currentIndex,
                            question: currentQuestion.stem,
                            userAnswer: userAnswer,
                            correctAnswer: currentQuestion.answer,
                            options: currentQuestion.options,
                            explanation: currentQuestion.explanation,
                            level: topic.level
                        }
                    })
                }));
                console.log(`✅ [일본어 문법 오답 기록] ${topic.title} - 문제 ${currentIndex + 1}`);
            } catch (error) {
                console.error('❌ 일본어 문법 오답 기록 실패:', error);
                if (error.message.includes('Unauthorized')) {
                    console.warn('⚠️ 로그인이 필요합니다.');
                }
            }
        }
    };

    const handleNext = () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setUserAnswer(null);
            setFeedback(null);
        } else {
            setIsCompleted(true);
        }
    };

    const handleRestartIncorrect = () => {
        setQuestions(incorrectAnswers);
        setCurrentIndex(0);
        setUserAnswer(null);
        setFeedback(null);
        setIncorrectAnswers([]);
        setIsCompleted(false);
        setScore(0);
    };

    if (!topic) return <main className="container py-4"><h2>주제를 찾을 수 없습니다.</h2></main>;

    // 설명 모드
    if (viewMode === 'explanation') {
        const explanationContent = topic.detailedExplanation || [];
        const currentPageItems = explanationContent[explanationPage] || [];
        const isLastPage = explanationPage === explanationContent.length - 1;

        return (
            <main className="container py-4" style={{ maxWidth: 780 }}>
                <div className="card shadow-sm">
                    <div className="card-header bg-primary text-white">
                        <h4 className="mb-0" dangerouslySetInnerHTML={{ __html: `📚 ${topic.title}` }}></h4>
                        <small className="opacity-75">JLPT {topic.level} 레벨</small>
                    </div>
                    <div className="card-body p-4" style={{ minHeight: '400px' }}>
                        {currentPageItems.map((item, index) => (
                            <ExplanationContent key={index} item={item} />
                        ))}
                    </div>
                    <div className="card-footer d-flex justify-content-between align-items-center p-3">
                        <button 
                            className="btn btn-outline-secondary" 
                            onClick={() => setExplanationPage(p => p - 1)} 
                            disabled={explanationPage === 0}
                        >
                            ◀ 이전
                        </button>
                        <span className="badge bg-secondary px-3 py-2">
                            {explanationPage + 1} / {explanationContent.length} 페이지
                        </span>
                        {isLastPage ? (
                            <button className="btn btn-primary" onClick={() => setViewMode('quiz')}>
                                문제 풀기 ▶
                            </button>
                        ) : (
                            <button className="btn btn-primary" onClick={() => setExplanationPage(p => p + 1)}>
                                다음 ▶
                            </button>
                        )}
                    </div>
                </div>
            </main>
        );
    }

    // 완료 화면
    if (isCompleted) {
        const percentage = Math.round((score / questions.length) * 100);
        const getResultEmoji = () => {
            if (percentage === 100) return '🏆';
            if (percentage >= 80) return '🎉';
            if (percentage >= 60) return '😊';
            if (percentage >= 40) return '💪';
            return '📚';
        };

        return (
            <main className="container py-4" style={{ maxWidth: 720 }}>
                <div className="text-center p-5 card shadow">
                    <div className="mb-4">
                        <span style={{ fontSize: '72px' }}>{getResultEmoji()}</span>
                    </div>
                    <h2 className="mb-3">학습 완료!</h2>
                    <div className="progress mb-3" style={{ height: '30px' }}>
                        <div 
                            className={`progress-bar ${percentage >= 80 ? 'bg-success' : percentage >= 60 ? 'bg-info' : 'bg-warning'}`}
                            role="progressbar" 
                            style={{ width: `${percentage}%` }}
                        >
                            <span className="fs-5 fw-bold">{percentage}%</span>
                        </div>
                    </div>
                    <p className="lead">
                        전체 {questions.length}문제 중 <strong className="text-success">{score}개</strong> 정답!
                    </p>
                    
                    {incorrectAnswers.length > 0 && (
                        <div className="alert alert-warning mt-3">
                            <h5 className="alert-heading">🔍 복습이 필요한 문제</h5>
                            <p>{incorrectAnswers.length}개의 틀린 문제가 있습니다.</p>
                            <div className="mt-2">
                                <Link to="/wrong-answers?tab=japanese-grammar" className="btn btn-sm btn-outline-primary me-2">
                                    📝 일본어 오답노트 확인
                                </Link>
                                <button className="btn btn-sm btn-primary" onClick={handleRestartIncorrect}>
                                    🔄 틀린 문제만 다시 풀기
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {percentage === 100 && (
                        <div className="alert alert-success">
                            <h5>완벽해요! 🎊</h5>
                            <p>모든 문제를 맞혔습니다. 다음 레벨에 도전해보세요!</p>
                        </div>
                    )}
                    
                    <div className="d-flex justify-content-center gap-3 mt-4">
                        <Link to="/learn/japanese-grammar" className="btn btn-outline-secondary">
                            📚 목록으로
                        </Link>
                        <button className="btn btn-primary" onClick={() => window.location.reload()}>
                            🔄 다시 풀기
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    // 퀴즈 모드
    return (
        <main className="container py-4" style={{ maxWidth: 720 }}>
            {/* 헤더 정보 */}
            <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                    <h4 className="m-0" dangerouslySetInnerHTML={{ __html: topic.title }}></h4>
                    <small className="text-muted">JLPT {topic.level}</small>
                </div>
                <div className="text-end">
                    <span className="badge bg-primary fs-6 me-2">
                        문제 {currentIndex + 1} / {questions.length}
                    </span>
                    <span className="badge bg-success fs-6">
                        점수: {score}
                    </span>
                </div>
            </div>

            {/* 진행 바 */}
            <div className="progress mb-4" style={{ height: '10px' }}>
                <div
                    className="progress-bar bg-primary progress-bar-striped progress-bar-animated"
                    role="progressbar"
                    style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                >
                </div>
            </div>

            {/* 문제 카드 */}
            <div className="card shadow">
                <div className="card-body p-4">
                    <div className="mb-4">
                        <h5 className="text-muted mb-3">다음 빈칸에 알맞은 것을 고르세요:</h5>
                        <p className="fs-4" lang="ja" dangerouslySetInnerHTML={{
                            __html: `${currentQuestion?.stem.split('___')[0] || ''}<span class="fw-bold text-primary mx-2" style="font-size: 1.2em;">___</span>${currentQuestion?.stem.split('___')[1] || ''}`
                        }}></p>
                    </div>
                </div>
                
                {/* 선택지 */}
                <div className="list-group list-group-flush">
                    {currentQuestion?.options.map((option, index) => (
                        <button
                            key={option}
                            className={`list-group-item list-group-item-action fs-5 py-3 ${
                                userAnswer === option ? 'active' : ''
                            } ${
                                feedback && option === currentQuestion.answer ? 'list-group-item-success' : ''
                            } ${
                                feedback && userAnswer === option && !feedback.isCorrect ? 'list-group-item-danger' : ''
                            }`}
                            onClick={() => handleOptionSelect(option)}
                            disabled={!!feedback}
                        >
                            <span className="badge bg-secondary me-2">{String.fromCharCode(65 + index)}</span>
                            <span lang="ja" dangerouslySetInnerHTML={{ __html: option }}></span>
                        </button>
                    ))}
                </div>
            </div>

            {/* 피드백 */}
            {feedback && (
                <div className={`mt-3 p-3 rounded ${
                    feedback.isCorrect 
                        ? 'bg-success-subtle text-success-emphasis border border-success' 
                        : 'bg-danger-subtle text-danger-emphasis border border-danger'
                }`}>
                    <h5 className="mb-2">
                        {feedback.isCorrect ? '⭕ 정답입니다!' : `❌ 틀렸습니다!`}
                    </h5>
                    {!feedback.isCorrect && (
                        <p className="mb-2">
                            정답: <strong lang="ja" dangerouslySetInnerHTML={{ __html: currentQuestion.answer }}></strong>
                        </p>
                    )}
                    <p className="mb-0" dangerouslySetInnerHTML={{ __html: `💡 ${feedback.explanation}` }}></p>
                </div>
            )}

            {/* 버튼 */}
            <div className="mt-4">
                {feedback ? (
                    <button className="btn btn-primary btn-lg w-100" onClick={handleNext}>
                        {currentIndex < questions.length - 1 ? '다음 문제 ▶' : '🎯 결과 보기'}
                    </button>
                ) : (
                    <button 
                        className="btn btn-secondary btn-lg w-100" 
                        onClick={handleSubmit} 
                        disabled={!userAnswer}
                    >
                        제출하기
                    </button>
                )}
            </div>
        </main>
    );
}