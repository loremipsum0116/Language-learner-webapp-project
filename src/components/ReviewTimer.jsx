// src/components/ReviewTimer.jsx
import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import duration from 'dayjs/plugin/duration';
import { fetchJSON, withCreds } from '../api/client';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(duration);

const ReviewTimer = ({ nextReviewAt, waitingUntil, isOverdue, overdueDeadline, isFromWrongAnswer, isFrozen, frozenUntil, className = "" }) => {
    const [timeLeft, setTimeLeft] = useState(null);
    const [isReviewable, setIsReviewable] = useState(false);
    const [dayOffset, setDayOffset] = useState(0); // 타임머신 오프셋 (일 단위)

    // 타임머신 상태 가져오기 (5초마다 갱신)
    useEffect(() => {
        const fetchTimeOffset = async () => {
            try {
                // 타임머신 상태 가져오기 (인증 필요)
                const response = await fetchJSON('/time-machine/status', withCreds());
                const offset = response.data?.dayOffset || 0;
                setDayOffset(offset);
            } catch (e) {
                // 에러 발생 시 오프셋 0 사용 (실제 시간)
                console.warn('Failed to fetch time offset, using dayOffset 0 (real time):', e);
                setDayOffset(0); // 실제 시간 사용
            }
        };
        
        // 즉시 실행
        fetchTimeOffset();
        
        // 5초마다 타임머신 상태 확인 (타임머신 변경사항 실시간 반영)
        // 에러가 발생해도 계속 시도하도록 래핑
        const intervalFetch = async () => {
            try {
                await fetchTimeOffset();
            } catch (e) {
                // 이미 fetchTimeOffset 내부에서 에러 처리됨, 여기서는 조용히 넘어감
            }
        };
        const interval = setInterval(intervalFetch, 5000);
        
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        // nextReviewAt이 없지만 동결 상태인 경우는 계속 진행
        if (!nextReviewAt && !(isFrozen && frozenUntil)) return;

        const updateTimer = () => {
            // 타임머신 오프셋을 적용한 현재 시간 (실시간 계산)
            const now = dayjs().add(dayOffset, 'day').tz('Asia/Seoul');
            
            // 동결 상태 처리 (최우선) - nextReviewAt 없어도 동결 상태면 처리
            if (isFrozen && frozenUntil) {
                const frozenUntilTime = dayjs.utc(frozenUntil).tz('Asia/Seoul');
                const realNow = dayjs().tz('Asia/Seoul'); // 타임머신 오프셋 적용 안 함
                const diff = frozenUntilTime.diff(realNow);
                
                if (diff > 0) {
                    const duration = dayjs.duration(diff);
                    const hours = Math.floor(duration.asHours());
                    const minutes = duration.minutes();
                    const seconds = duration.seconds();
                    
                    let timeString = "🧊 동결 중 ";
                    if (hours > 0) {
                        timeString += `${hours}시간 `;
                    }
                    timeString += `${minutes}분 ${seconds}초 후 해제`;
                    
                    setTimeLeft(timeString);
                    setIsReviewable(false);
                    return;
                } else {
                    // 동결 해제된 상태 - 단순히 overdue로 표시
                    setTimeLeft("복습 가능!");
                    setIsReviewable(true);
                    return;
                }
            }
            
            // nextReviewAt이 없고 동결 상태도 아닌 경우 여기서 종료
            if (!nextReviewAt) {
                setTimeLeft("복습일 없음");
                setIsReviewable(false);
                return;
            }
            
            // 디버깅 로그 (개발 중에만)
            if (isOverdue && isFromWrongAnswer) {
                console.log(`[ReviewTimer] Debug info:`);
                console.log(`  dayOffset: ${dayOffset}`);
                console.log(`  now (with offset): ${now.toISOString()}`);
                console.log(`  realNow (without offset): ${dayjs().tz('Asia/Seoul').toISOString()}`);
                console.log(`  overdueDeadline: ${overdueDeadline}`);
                if (overdueDeadline) {
                    const deadlineTime = dayjs.utc(overdueDeadline).tz('Asia/Seoul');
                    const realNow = dayjs().tz('Asia/Seoul');
                    const diff = deadlineTime.diff(realNow);
                    console.log(`  diff hours (real time): ${Math.round(diff / (60 * 60 * 1000))}`);
                    const diffWithOffset = deadlineTime.diff(now);
                    console.log(`  diff hours (with offset): ${Math.round(diffWithOffset / (60 * 60 * 1000))}`);
                }
            }
            
            // overdue 상태인 경우 처리
            if (isOverdue) {
                if (isFromWrongAnswer) {
                    // 오답 카드: overdue 상태에서 복습 가능하지만 24시간 데드라인까지 타이머 표시
                    if (overdueDeadline) {
                        const deadlineTime = dayjs.utc(overdueDeadline).tz('Asia/Seoul');
                        // overdue 데드라인은 타임머신 시간 기준으로 설정되므로 타임머신 시간과 비교
                        const diff = deadlineTime.diff(now); // now는 이미 타임머신 오프셋이 적용된 시간
                        
                        if (diff <= 0) {
                            // overdue 데드라인이 지났을 때: 동결 상태로 표시해야 함
                            setTimeLeft(`🧊 동결 상태 (24시간 페널티 적용 중)`);
                            setIsReviewable(false); // 동결 중이므로 복습 불가
                            return;
                        }
                        
                        const duration = dayjs.duration(diff);
                        const hours = Math.floor(duration.asHours());
                        const minutes = duration.minutes();
                        const seconds = duration.seconds();

                        let timeString = "✅ 복습 가능! ";
                        if (hours > 0) {
                            timeString += `(${hours}시간 `;
                        } else {
                            timeString += `(`;
                        }
                        timeString += `${minutes}분 ${seconds}초 후 초기화)`;

                        setTimeLeft(timeString);
                        setIsReviewable(true);
                        return;
                    } else {
                        setTimeLeft("복습 가능!");
                        setIsReviewable(true);
                        return;
                    }
                } else {
                    // 일반 카드 overdue: overdueDeadline까지의 24시간 카운트다운 표시
                    if (overdueDeadline) {
                        const deadlineTime = dayjs.utc(overdueDeadline).tz('Asia/Seoul');
                        // overdue 데드라인은 타임머신 시간 기준으로 설정되므로 타임머신 시간과 비교
                        const deadlineDiff = deadlineTime.diff(now); // now는 이미 타임머신 오프셋이 적용된 시간
                        
                        if (deadlineDiff <= 0) {
                            // overdue 데드라인이 지났을 때: 동결 상태로 표시해야 함
                            setTimeLeft(`🧊 동결 상태 (24시간 페널티 적용 중)`);
                            setIsReviewable(false); // 동결 중이므로 복습 불가
                            return;
                        }
                        
                        const duration = dayjs.duration(deadlineDiff);
                        const hours = Math.floor(duration.asHours());
                        const minutes = duration.minutes();
                        const seconds = duration.seconds();

                        let timeString = "⚠️ ";
                        if (hours > 0) {
                            timeString += `${hours}시간 `;
                        }
                        timeString += `${minutes}분 ${seconds}초 후 초기화`;

                        setTimeLeft(timeString);
                        setIsReviewable(true);
                        return;
                    } else {
                        setTimeLeft("복습 가능!");
                        setIsReviewable(true);
                        return;
                    }
                }
            }
            
            // 오답 단어의 대기 상태 처리 (isFromWrongAnswer = true, 단 overdue가 아닐 때만)
            if (isFromWrongAnswer && !isOverdue) {
                // waitingUntil이 있으면 이를 기준으로, 없으면 nextReviewAt 기준으로 24시간 대기 표시
                const targetTime = waitingUntil ? 
                    dayjs.utc(waitingUntil).tz('Asia/Seoul') : 
                    dayjs.utc(nextReviewAt).tz('Asia/Seoul');
                
                // 오답 카드의 waitingUntil은 타임머신 시간으로 설정되므로 타임머신 시간과 비교
                const diff = targetTime.diff(now); // now는 이미 타임머신 오프셋이 적용된 시간
                
                if (diff <= 0) {
                    // 대기 시간이 지났을 경우: 실제로는 overdue 상태여야 함
                    // overdue 상태에서는 복습 가능하므로 해당 로직으로 이동
                    // 여기서는 단순히 "복습 준비 중" 메시지만 표시
                    setTimeLeft("🔄 복습 준비 중... (새로고침 해보세요)");
                    setIsReviewable(false);
                    return;
                }
                
                // 24시간 대기 카운트다운 표시
                const duration = dayjs.duration(diff);
                const hours = Math.floor(duration.asHours());
                const minutes = duration.minutes();
                const seconds = duration.seconds();

                let timeString = "⏳ ";
                if (hours > 0) {
                    timeString += `${hours}시간 `;
                }
                timeString += `${minutes}분 ${seconds}초 후 복습 대기`;

                setTimeLeft(timeString);
                setIsReviewable(false);
                return;
            }
            
            // 일반적인 복습일 체크 (overdue가 아닌 일반 카드)
            const reviewTime = dayjs.utc(nextReviewAt).tz('Asia/Seoul');
            const diff = reviewTime.diff(now);

            if (diff <= 0) {
                setIsReviewable(true);
                setTimeLeft("복습 가능!");
                return;
            }

            // waitingUntil이 있으면 이를 사용하여 정확한 대기 시간 표시
            // waitingUntil은 타임머신 시간으로 설정되므로 타임머신 시간과 비교
            if (waitingUntil) {
                const waitingTime = dayjs.utc(waitingUntil).tz('Asia/Seoul');
                const waitingDiff = waitingTime.diff(now); // now는 이미 타임머신 오프셋이 적용된 시간

                if (waitingDiff <= 0) {
                    // 대기 시간이 지났지만 아직 overdue 플래그가 false인 경우
                    // (크론잡이 아직 실행되지 않은 상태)
                    setIsReviewable(false);
                    setTimeLeft("곧 복습 대기 상태로 변경됩니다");
                    return;
                }

                // 정확한 대기 시간 표시
                const duration = dayjs.duration(waitingDiff);
                const days = Math.floor(duration.asDays());
                const hours = duration.hours();
                const minutes = duration.minutes();
                const seconds = duration.seconds();

                let timeString = "";
                if (days > 0) {
                    timeString += `${days}일 `;
                }
                if (hours > 0 || days > 0) {
                    timeString += `${hours}시간 `;
                }
                if (minutes > 0 || hours > 0 || days > 0) {
                    timeString += `${minutes}분 `;
                }
                timeString += `${seconds}초 후 복습 대기`;

                setTimeLeft(timeString);
                setIsReviewable(false);
                return;
            }

            // waitingUntil이 없는 경우 기존 로직 사용 (하위 호환성)
            // 일반 카드의 경우 overdue 시작까지의 시간만 표시 (망각곡선 -1일)
            // nextReviewAt에서 24시간을 뺀 시점까지의 시간 계산
            const overdueStartTime = reviewTime.subtract(24, 'hour');
            const overdueStartDiff = overdueStartTime.diff(now);

            if (overdueStartDiff <= 0) {
                // overdue 시작 시간이 지났지만 아직 overdue 플래그가 false인 경우
                // (크론잡이 아직 실행되지 않은 상태)
                setIsReviewable(false);
                setTimeLeft("곧 복습 대기 상태로 변경됩니다");
                return;
            }

            // overdue 시작까지의 시간 표시
            const duration = dayjs.duration(overdueStartDiff);
            const days = Math.floor(duration.asDays());
            const hours = duration.hours();
            const minutes = duration.minutes();
            const seconds = duration.seconds();

            let timeString = "";
            if (days > 0) {
                timeString += `${days}일 `;
            }
            if (hours > 0 || days > 0) {
                timeString += `${hours}시간 `;
            }
            if (minutes > 0 || hours > 0 || days > 0) {
                timeString += `${minutes}분 `;
            }
            timeString += `${seconds}초 후 복습 대기`;

            setTimeLeft(timeString);
            setIsReviewable(false);
        };

        // 즉시 실행
        updateTimer();
        
        // 1초마다 업데이트
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [nextReviewAt, waitingUntil, isOverdue, overdueDeadline, isFromWrongAnswer, isFrozen, frozenUntil, dayOffset]);

    // 동결 상태인 경우 nextReviewAt이 없어도 동결 타이머를 표시해야 함
    if (!nextReviewAt && !isFrozen) {
        return <span className={`text-muted ${className}`}>복습일 없음</span>;
    }
    
    // 동결 상태이지만 nextReviewAt이 없는 경우, 실시간 동결 타이머를 위한 useEffect 사용
    if (!nextReviewAt && isFrozen && frozenUntil) {
        // 이 경우 useEffect에서 타이머를 업데이트하므로 timeLeft 값을 사용
        if (timeLeft !== null) {
            return <span className={`text-info fw-bold ${className}`}>{timeLeft}</span>;
        } else {
            // 초기 로딩 중 - 간단한 동결 상태 표시
            const now = new Date();
            const frozenUntilTime = new Date(frozenUntil);
            
            if (now < frozenUntilTime) {
                const diff = frozenUntilTime.getTime() - now.getTime();
                const hours = Math.floor(diff / (60 * 60 * 1000));
                const days = Math.floor(hours / 24);
                
                if (days > 0) {
                    return <span className={`text-info fw-bold ${className}`}>🧊 동결 중 (약 ${days}일 ${hours % 24}시간 남음)</span>;
                } else {
                    return <span className={`text-info fw-bold ${className}`}>🧊 동결 중 (약 ${hours}시간 남음)</span>;
                }
            } else {
                return <span className={`text-success fw-bold ${className}`}>복습 가능!</span>;
            }
        }
    }

    if (timeLeft === null) {
        return <span className={`text-muted ${className}`}>계산 중...</span>;
    }

    return (
        <span className={`${
            isFrozen ? 'text-info fw-bold' :
            isReviewable ? (isOverdue ? 'text-warning fw-bold' : 'text-success fw-bold') : 'text-primary'
        } ${className}`}>
            {isFrozen ? "🧊 " :
             isReviewable ? (isOverdue ? "⚠️ " : "✅ ") : "⏰ "}{timeLeft}
        </span>
    );
};

export default ReviewTimer;