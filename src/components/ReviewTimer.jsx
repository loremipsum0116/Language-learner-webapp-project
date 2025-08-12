// src/components/ReviewTimer.jsx
import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import duration from 'dayjs/plugin/duration';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(duration);

const ReviewTimer = ({ nextReviewAt, isOverdue, overdueDeadline, isFromWrongAnswer, className = "" }) => {
    const [timeLeft, setTimeLeft] = useState(null);
    const [isReviewable, setIsReviewable] = useState(false);

    useEffect(() => {
        if (!nextReviewAt) return;

        const updateTimer = () => {
            const now = dayjs().tz('Asia/Seoul');
            
            // overdue 상태인 경우 처리
            if (isOverdue) {
                if (isFromWrongAnswer) {
                    // 오답 카드: 48시간 데드라인까지의 시간 표시
                    if (overdueDeadline) {
                        const deadlineTime = dayjs.utc(overdueDeadline).tz('Asia/Seoul');
                        const diff = deadlineTime.diff(now);
                        
                        if (diff <= 0) {
                            setTimeLeft("곧 stage 0으로 초기화됩니다");
                            setIsReviewable(true);
                            return;
                        }
                        
                        const duration = dayjs.duration(diff);
                        const days = Math.floor(duration.asDays());
                        const hours = duration.hours();
                        const minutes = duration.minutes();
                        const seconds = duration.seconds();

                        let timeString = "⚠️ ";
                        if (days > 0) {
                            timeString += `${days}일 `;
                        }
                        if (hours > 0 || days > 0) {
                            timeString += `${hours}시간 `;
                        }
                        if (minutes > 0 || hours > 0 || days > 0) {
                            timeString += `${minutes}분 `;
                        }
                        timeString += `${seconds}초 후 초기화`;

                        setTimeLeft(timeString);
                        setIsReviewable(true);
                        return;
                    }
                } else {
                    // 일반 카드 overdue: overdueDeadline까지의 24시간 카운트다운 표시
                    if (overdueDeadline) {
                        const deadlineTime = dayjs.utc(overdueDeadline).tz('Asia/Seoul');
                        const deadlineDiff = deadlineTime.diff(now);
                        
                        if (deadlineDiff <= 0) {
                            setTimeLeft("곧 stage 0으로 초기화됩니다");
                            setIsReviewable(true);
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
            
            // 일반적인 복습일 체크 (overdue가 아닌 일반 카드)
            const reviewTime = dayjs.utc(nextReviewAt).tz('Asia/Seoul');
            const diff = reviewTime.diff(now);

            if (diff <= 0) {
                setIsReviewable(true);
                setTimeLeft("복습 가능!");
                return;
            }

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
    }, [nextReviewAt, isOverdue, overdueDeadline, isFromWrongAnswer]);

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