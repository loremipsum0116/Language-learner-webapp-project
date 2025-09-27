// 폴더 단위 통합 타이머 컴포넌트
import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import duration from 'dayjs/plugin/duration';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(duration);

/**
 * 폴더 내 모든 카드에 대해 통합된 타이머를 표시
 * 가장 이른 시간을 기준으로 표시하여 동기화 문제 해결
 */
const UnifiedTimer = ({ cards, className = "" }) => {
    const [timeLeft, setTimeLeft] = useState(null);
    const [isReviewable, setIsReviewable] = useState(false);

    useEffect(() => {
        if (!cards || cards.length === 0) {
            setTimeLeft("복습할 카드 없음");
            return;
        }

        const updateTimer = () => {
            const now = dayjs().tz('Asia/Seoul');

            // 모든 카드의 타이머 중 가장 이른 시간 찾기
            const reviewTimes = cards
                .map(card => {
                    // waitingUntil 우선, 없으면 nextReviewAt 사용
                    const targetTime = card.waitingUntil || card.nextReviewAt;
                    return targetTime ? dayjs.utc(targetTime).tz('Asia/Seoul') : null;
                })
                .filter(time => time !== null);

            if (reviewTimes.length === 0) {
                setTimeLeft("타이머 없음");
                return;
            }

            // 가장 이른 시간 선택 (통합 타이머)
            const earliestTime = reviewTimes.reduce((min, time) =>
                time.isBefore(min) ? time : min
            );

            const diff = earliestTime.diff(now);

            if (diff <= 0) {
                setIsReviewable(true);
                setTimeLeft("✅ 복습 가능!");
                return;
            }

            // 시간 표시
            const duration = dayjs.duration(diff);
            const days = Math.floor(duration.asDays());
            const hours = duration.hours();
            const minutes = duration.minutes();
            const seconds = duration.seconds();

            let timeString = "";
            if (days > 0) {
                timeString = `${days}일 ${hours}시간 ${minutes}분`;
            } else if (hours > 0) {
                timeString = `${hours}시간 ${minutes}분 ${seconds}초`;
            } else if (minutes > 0) {
                timeString = `${minutes}분 ${seconds}초`;
            } else {
                timeString = `${seconds}초`;
            }

            setTimeLeft(`⏰ ${timeString} 후 복습`);
            setIsReviewable(false);
        };

        // 즉시 실행
        updateTimer();

        // 1초마다 업데이트
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [cards]);

    if (timeLeft === null) {
        return <span className={`text-muted ${className}`}>계산 중...</span>;
    }

    return (
        <span className={`${isReviewable ? 'text-success fw-bold' : 'text-primary'} ${className}`}>
            {timeLeft}
        </span>
    );
};

export default UnifiedTimer;