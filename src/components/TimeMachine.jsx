import React, { useState, useEffect } from 'react';
import { fetchJSON, withCreds } from '../api/client';
import { toast } from 'react-toastify';

const TimeMachine = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [dayOffset, setDayOffset] = useState(0);
    const [inputValue, setInputValue] = useState('');
    const [currentOffset, setCurrentOffset] = useState(0);
    const [loading, setLoading] = useState(false);

    // 현재 오프셋 확인
    useEffect(() => {
        fetchCurrentOffset();
    }, []);

    const fetchCurrentOffset = async () => {
        try {
            const response = await fetchJSON('/time-machine/status', withCreds());
            setCurrentOffset(response.data?.dayOffset || 0);
            setDayOffset(response.data?.dayOffset || 0);
        } catch (e) {
            console.error('Failed to fetch time machine status:', e);
        }
    };

    const applyTimeOffset = async () => {
        if (inputValue === '') return;
        
        setLoading(true);
        try {
            const offset = parseInt(inputValue, 10);
            if (isNaN(offset)) {
                toast.error('유효한 숫자를 입력해주세요');
                return;
            }

            await fetchJSON('/time-machine/set', withCreds({
                method: 'POST',
                body: JSON.stringify({ dayOffset: offset })
            }));

            setCurrentOffset(offset);
            setDayOffset(offset);
            setInputValue('');
            
            if (offset === 0) {
                toast.success('현재 시간으로 복귀했습니다');
            } else {
                toast.success(`${offset}일 ${offset > 0 ? '미래' : '과거'}로 이동했습니다`);
            }
            
            // 페이지 새로고침으로 모든 데이터 갱신 (서버 처리 완료 대기)
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            
        } catch (e) {
            toast.error('타임머신 설정에 실패했습니다');
            console.error('Time machine error:', e);
        } finally {
            setLoading(false);
        }
    };

    const resetTime = async () => {
        setLoading(true);
        try {
            await fetchJSON('/time-machine/reset', withCreds({
                method: 'POST'
            }));

            setCurrentOffset(0);
            setDayOffset(0);
            setInputValue('');
            
            toast.success('현재 시간으로 복귀했습니다');
            
            // 페이지 새로고침으로 모든 데이터 갱신 (서버 처리 완료 대기)
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            
        } catch (e) {
            toast.error('시간 리셋에 실패했습니다');
            console.error('Time reset error:', e);
        } finally {
            setLoading(false);
        }
    };

    const fixDeadlines = async () => {
        setLoading(true);
        try {
            const response = await fetchJSON('/time-machine/fix-deadlines', withCreds({
                method: 'POST'
            }));
            
            toast.success(`${response.data?.fixedCount || 0}개 카드의 데드라인을 24시간으로 수정했습니다`);
            
            // 페이지 새로고침으로 모든 데이터 갱신
            setTimeout(() => {
                window.location.reload();
            }, 1000);
            
        } catch (e) {
            toast.error('데드라인 수정에 실패했습니다');
            console.error('Fix deadlines error:', e);
        } finally {
            setLoading(false);
        }
    };

    const forceResetAll = async () => {
        setLoading(true);
        try {
            const response = await fetchJSON('/time-machine/force-reset-all', withCreds({
                method: 'POST'
            }));
            
            toast.success(`${response.data?.resetCount || 0}개 모든 카드를 24시간으로 강제 리셋했습니다!`);
            
            // 페이지 새로고침으로 모든 데이터 갱신
            setTimeout(() => {
                window.location.reload();
            }, 1000);
            
        } catch (e) {
            toast.error('강제 리셋에 실패했습니다');
            console.error('Force reset error:', e);
        } finally {
            setLoading(false);
        }
    };

    const emergencyFix = async () => {
        setLoading(true);
        try {
            const response = await fetchJSON('/time-machine/emergency-fix', withCreds({
                method: 'POST'
            }));
            
            toast.success(`긴급 수정: ${response.data?.fixedCount || 0}개 카드를 24시간으로 리셋!`);
            
            // 페이지 새로고침으로 모든 데이터 갱신
            setTimeout(() => {
                window.location.reload();
            }, 500);
            
        } catch (e) {
            toast.error('긴급 수정에 실패했습니다');
            console.error('Emergency fix error:', e);
        } finally {
            setLoading(false);
        }
    };

    const getCurrentDate = () => {
        const now = new Date();
        const offsetDate = new Date(now.getTime() + currentOffset * 24 * 60 * 60 * 1000);
        return offsetDate.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
    };

    if (!isOpen && currentOffset === 0) {
        return (
            <div 
                style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    zIndex: 9999,
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '50px',
                    height: '50px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '20px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
                }}
                onClick={() => setIsOpen(true)}
                title="타임머신"
            >
                ⏰
            </div>
        );
    }

    return (
        <div 
            style={{
                position: 'fixed',
                top: '20px',
                right: '20px',
                zIndex: 9999,
                backgroundColor: currentOffset !== 0 ? '#dc3545' : '#ffffff',
                color: currentOffset !== 0 ? 'white' : 'black',
                border: '2px solid #dee2e6',
                borderRadius: '10px',
                padding: '15px',
                minWidth: '300px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                fontSize: '14px'
            }}
        >
            <div className="d-flex justify-content-between align-items-center mb-2">
                <strong>🕰️ 타임머신</strong>
                <button 
                    className="btn-close btn-close-white"
                    onClick={() => setIsOpen(false)}
                    style={{ fontSize: '12px' }}
                ></button>
            </div>
            
            {currentOffset !== 0 && (
                <div className="alert alert-warning p-2 mb-2" style={{ fontSize: '12px' }}>
                    <strong>⚠️ 시간 여행 중</strong><br/>
                    현재: {getCurrentDate()}<br/>
                    오프셋: {currentOffset}일
                </div>
            )}

            <div className="mb-2">
                <label className="form-label mb-1" style={{ fontSize: '12px' }}>
                    일수 입력 (음수 = 과거, 양수 = 미래)
                </label>
                <div className="input-group input-group-sm">
                    <input
                        type="number"
                        className="form-control"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="120 (120일 후)"
                        disabled={loading}
                    />
                    <button 
                        className="btn btn-primary"
                        onClick={applyTimeOffset}
                        disabled={loading || inputValue === ''}
                    >
                        {loading ? '이동중...' : '이동'}
                    </button>
                </div>
            </div>

            <div className="d-flex gap-1 mb-2">
                <button 
                    className="btn btn-success btn-sm flex-fill"
                    onClick={resetTime}
                    disabled={loading}
                >
                    {loading ? '복귀중...' : '현재로 복귀'}
                </button>
                <button 
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setIsOpen(false)}
                >
                    닫기
                </button>
            </div>
            
            <div className="d-flex gap-1 mb-1">
                <button 
                    className="btn btn-warning btn-sm flex-fill"
                    onClick={fixDeadlines}
                    disabled={loading}
                    style={{ fontSize: '10px' }}
                >
                    {loading ? '수정중...' : '타이머 수정'}
                </button>
            </div>
            
            <div className="d-flex gap-1 mb-1">
                <button 
                    className="btn btn-danger btn-sm flex-fill"
                    onClick={forceResetAll}
                    disabled={loading}
                    style={{ fontSize: '10px' }}
                >
                    {loading ? '리셋중...' : '강제 24시간 리셋'}
                </button>
            </div>
            
            <div className="d-flex gap-1">
                <button 
                    className="btn btn-outline-danger btn-sm flex-fill"
                    onClick={emergencyFix}
                    disabled={loading}
                    style={{ fontSize: '9px' }}
                >
                    {loading ? '수정중...' : '긴급 수정 (47h→24h)'}
                </button>
            </div>

            <div className="mt-2" style={{ fontSize: '11px', opacity: '0.8' }}>
                💡 팁: 120 입력 → 120일 후, -30 입력 → 30일 전
            </div>
        </div>
    );
};

export default TimeMachine;