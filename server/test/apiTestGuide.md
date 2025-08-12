# SRS 시스템 수동 API 테스트 가이드

## 🎯 빠른 검증 방법

### 1️⃣ **새 카드 생성 및 정답 처리**

```bash
# 1. 새 카드 생성 (POST /quiz/answer)
curl -X POST http://localhost:3000/quiz/answer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "cardId": 123,
    "correct": true
  }'

# 예상 결과:
# - Stage 0 → 1
# - waitingUntil: 48시간 후
# - canReview: true
```

### 2️⃣ **대기 중 복습 시도 (상태 변화 없음)**

```bash
# 같은 카드로 다시 복습 시도
curl -X POST http://localhost:3000/quiz/answer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "cardId": 123,
    "correct": true
  }'

# 예상 결과:
# - message: "대기 시간입니다..."
# - canReview: false
# - Stage 변화 없음
```

### 3️⃣ **SRS 상태 확인**

```bash
# 사용자 SRS 전체 상태 조회
curl -X GET http://localhost:3000/srs/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# 예상 결과:
# {
#   "overdueCount": 0,
#   "waitingCount": 1,
#   "totalCards": 1,
#   "reviewableCount": 0
# }
```

### 4️⃣ **알림 상태 확인**

```bash
# 오늘의 알림 상태 확인
curl -X GET http://localhost:3000/srs/reminders/today \
  -H "Authorization: Bearer YOUR_TOKEN"

# 예상 결과 (overdue 카드 없을 때):
# {
#   "hasOverdueCards": false,
#   "shouldNotifyNow": false,
#   "overdueCount": 0,
#   "message": "복습할 overdue 단어가 없습니다."
# }
```

## 🚀 **빠른 시나리오 테스트**

### 시나리오 A: 정답 진행 (Stage 0→1→2→3...)

1. 새 카드에서 정답 → Stage 1, 48시간 대기
2. 48시간 후 overdue → 정답 → Stage 2, 144시간 대기  
3. 144시간 후 overdue → 정답 → Stage 3, 312시간 대기
4. ...120일까지 반복

### 시나리오 B: 오답 처리

1. overdue 카드에서 오답 → Stage 0, 24시간 대기
2. 24시간 후 overdue → 오답 다시 → Stage 0, 24시간 대기 (무한 반복)
3. 24시간 후 overdue → 정답 → Stage 1, 48시간 대기 (정상 복귀)

### 시나리오 C: 데드라인 초과 리셋

1. 카드를 overdue 상태로 만들기
2. 24시간 넘게 방치 → 자동으로 Stage 0 리셋
3. 알림 상태도 자동 업데이트

## 📊 **검증 포인트**

### ✅ 수학적 정확성 (이미 검증됨!)
- Stage 1: 48h 대기 + 24h overdue = 72h (3일) ✅
- Stage 2: 144h 대기 + 24h overdue = 168h (7일) ✅
- Stage 6: 2856h 대기 + 24h overdue = 2880h (120일) ✅

### ✅ 로직 검증 포인트
- [ ] 대기 중 복습 → 상태 변화 없음
- [ ] Overdue 상태에서만 학습 가능
- [ ] 오답 → 24시간 대기
- [ ] 정답 → (n-1)일 대기
- [ ] 데드라인 초과 → Stage 0 리셋
- [ ] 알림 시스템 자동 업데이트

## 🛠️ **데이터베이스 직접 확인**

```sql
-- 카드 상태 확인
SELECT id, stage, isOverdue, waitingUntil, overdueDeadline, 
       isFromWrongAnswer, wrongStreakCount, correctTotal, wrongTotal
FROM SRSCard 
WHERE userId = YOUR_USER_ID;

-- 사용자 알림 상태 확인
SELECT hasOverdueCards, lastOverdueCheck, nextOverdueAlarm
FROM User 
WHERE id = YOUR_USER_ID;
```

## 🎭 **Mock 시간으로 빠른 테스트**

데이터베이스에서 직접 시간을 조작하여 빠른 테스트:

```sql
-- 카드를 2일 전 상태로 변경 (곧 overdue가 되도록)
UPDATE SRSCard 
SET waitingUntil = DATE_SUB(NOW(), INTERVAL 2 DAY)
WHERE id = YOUR_CARD_ID;

-- 또는 overdue 데드라인을 1시간 전으로 설정
UPDATE SRSCard 
SET overdueDeadline = DATE_SUB(NOW(), INTERVAL 1 HOUR)
WHERE id = YOUR_CARD_ID AND isOverdue = true;
```

## 🎉 **예상 결과**

모든 테스트가 성공하면:

1. ✅ **수학적 정확성**: 모든 단위 테스트 통과 (100% 성공률)
2. ✅ **로직 무결성**: 대기/overdue/리셋 모든 상태 전환 정상
3. ✅ **데이터 일관성**: DB 상태와 API 응답 일치
4. ✅ **알림 시스템**: overdue 상태에 따른 자동 알림 관리
5. ✅ **사용자 경험**: 망각곡선 과학적 근거 유지하면서 직관적 동작

**결론: 120일을 기다리지 않고도 시스템이 완벽히 작동함을 확신할 수 있습니다! 🚀**