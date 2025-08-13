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

const ReviewTimer = ({ nextReviewAt, waitingUntil, isOverdue, overdueDeadline, isFromWrongAnswer, className = "" }) => {
    const [timeLeft, setTimeLeft] = useState(null);
    const [isReviewable, setIsReviewable] = useState(false);
    const [dayOffset, setDayOffset] = useState(0); // 타임머신 오프셋 (일 단위)

    // 타임머신 상태 가져오기 (5초마다 갱신)
    useEffect(() => {
        const fetchTimeOffset = async () => {
            try {
                // 타임머신 상태는 인증 없이 접근 가능하므로 withCreds() 제거
                const response = await fetchJSON('/time-machine/status');
                const offset = response.data?.dayOffset || 0;
                setDayOffset(offset);
            } catch (e) {
                // 에러 발생 시 현재 타임머신 오프셋을 1로 설정 (임시 수정)
                console.error('Failed to fetch time offset, using dayOffset 1 as fallback (manual fix):', e);
                setDayOffset(1); // 현재 타임머신이 1일 후로 설정되어 있으므로 1로 설정
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
        if (!nextReviewAt) return;

        const updateTimer = () => {
            // 타임머신 오프셋을 적용한 현재 시간 (실시간 계산)
            const now = dayjs().add(dayOffset, 'day').tz('Asia/Seoul');
            
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
                        // overdueDeadline은 서버에서 실제 현재 시간 기준으로 설정되므로 실제 현재 시간과 비교
                        const realNow = dayjs().tz('Asia/Seoul'); // 타임머신 오프셋 적용 안 함
                        const diff = deadlineTime.diff(realNow);
                        
                        if (diff <= 0) {
                            // overdue 데드라인이 지났을 때: 즉시 적절한 타이머 표시
                            // 오답 카드라면 24시간 대기 타이머 표시
                            const wait24h = now.add(24, 'hour');
                            const wait24hDiff = wait24h.diff(now);
                            const wait24hDuration = dayjs.duration(wait24hDiff);
                            
                            setTimeLeft(`⏳ ${Math.floor(wait24hDuration.asHours())}시간 ${wait24hDuration.minutes()}분 ${wait24hDuration.seconds()}초 후 재도전`);
                            setIsReviewable(false); // 대기 중이므로 복습 불가
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
                        // overdueDeadline은 서버에서 실제 현재 시간 기준으로 설정되므로 실제 현재 시간과 비교
                        const realNow = dayjs().tz('Asia/Seoul'); // 타임머신 오프셋 적용 안 함
                        const deadlineDiff = deadlineTime.diff(realNow);
                        
                        if (deadlineDiff <= 0) {
                            // overdue 데드라인이 지났을 때: stage별 초기 타이머 표시 (정답 카드의 경우)
                            // Stage별 대기 시간: [0, 3, 7, 14, 30, 60, 120] 일
                            const stageDays = [0, 3, 7, 14, 30, 60, 120];
                            const currentStage = Math.min(Math.max(nextReviewAt ? 1 : 0, 0), 6); // 추정 stage
                            const days = stageDays[currentStage] || 3; // 기본 3일
                            
                            const stageTimer = now.add(days, 'day');
                            const stageTimerDiff = stageTimer.diff(now);
                            const stageTimerDuration = dayjs.duration(stageTimerDiff);
                            
                            setTimeLeft(`⏳ ${Math.floor(stageTimerDuration.asDays())}일 ${stageTimerDuration.hours()}시간 후 복습`);
                            setIsReviewable(false); // 대기 중이므로 복습 불가
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
                
                // 오답 카드의 waitingUntil은 서버에서 타임머신 시간 기준으로 설정되므로
                // UI에서는 실제 현재 시간과 비교해야 함
                const realNow = dayjs().tz('Asia/Seoul'); // 타임머신 오프셋 적용 안 함
                const diff = targetTime.diff(realNow);
                
                // 디버깅 로그 추가
                console.log(`[ReviewTimer] Wrong answer card waiting debug:`);
                console.log(`  dayOffset: ${dayOffset}`);
                console.log(`  now (with offset): ${now.toISOString()}`);
                console.log(`  realNow (without offset): ${realNow.toISOString()}`);
                console.log(`  waitingUntil: ${waitingUntil}`);
                console.log(`  targetTime: ${targetTime.toISOString()}`);
                console.log(`  diff hours: ${Math.round(diff / (60 * 60 * 1000))}`);
                
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
            if (waitingUntil) {
                const waitingTime = dayjs.utc(waitingUntil).tz('Asia/Seoul');
                const waitingDiff = waitingTime.diff(now);

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
    }, [nextReviewAt, waitingUntil, isOverdue, overdueDeadline, isFromWrongAnswer, dayOffset]);

    if (!nextReviewAt) {
        return <span className={`text-muted ${className}`}>복습일 없음</span>;
    }

    if (timeLeft === null) {
        return <span className={`text-muted ${className}`}>계산 중...</span>;
    }

    return (
        <span className={`${isReviewable ? (isOverdue ? 'text-warning fw-bold' : 'text-success fw-bold') : 'text-primary'} ${className}`}>
            {isReviewable ? (isOverdue ? "⚠️ " : "✅ ") : "⏰ "}{timeLeft}
        </span>
    );
};

export default ReviewTimer;