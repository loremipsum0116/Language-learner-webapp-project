// KST(UTC+9) 기반 날짜 유틸
const KST_OFFSET = 9 * 60 * 60 * 1000;

// 현재 KST 시간을 반환
function nowKst() {
  const now = new Date();
  return new Date(now.getTime() + KST_OFFSET);
}

// UTC Date를 KST Date로 변환
function utcToKst(utcDate) {
  return new Date(utcDate.getTime() + KST_OFFSET);
}

// KST Date를 UTC Date로 변환 (DB 저장용)
function kstToUtc(kstDate) {
  return new Date(kstDate.getTime() - KST_OFFSET);
}

// KST 기준 오늘 자정 (00:00:00)을 반환
function startOfKstDay(d = null) {
  // KST 기준 현재 시간
  const kstNow = d ? new Date(d.getTime() + KST_OFFSET) : new Date(Date.now() + KST_OFFSET);
  
  // KST 기준 날짜만 추출 (YYYY-MM-DD)
  const year = kstNow.getUTCFullYear();
  const month = kstNow.getUTCMonth();
  const date = kstNow.getUTCDate();
  
  // 해당 날짜의 UTC 00:00을 반환 (프론트엔드에서 KST로 변환 시 올바른 날짜 표시를 위해)
  return new Date(Date.UTC(year, month, date, 0, 0, 0, 0));
}

// KST 날짜에 일수를 더함
function kstAddDays(kstDate, days) {
  return new Date(kstDate.getTime() + days * 24 * 60 * 60 * 1000);
}

// KST 날짜에 특정 시간을 설정
function kstAt(kstDate, hour = 9, minute = 0, second = 0) {
  const result = new Date(kstDate);
  result.setHours(hour, minute, second, 0);
  return result;
}

// "YYYY-MM-DD" 문자열을 KST 날짜로 파싱
function parseKstDateYYYYMMDD(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d); // 로컬 시간으로 생성 (KST)
}

// Date 객체를 KST 기준 "YYYY-MM-DD HH:mm:ss" 형식으로 포맷
function formatKstDateTime(date) {
  const kstDate = date.getTime ? utcToKst(date) : date;
  return kstDate.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\./g, '-').replace(', ', ' ');
}

// Date 객체를 KST 기준 "YYYY-MM-DD" 형식으로 포맷
function formatKstDate(date) {
  const kstDate = date.getTime ? utcToKst(date) : date;
  return kstDate.toISOString().split('T')[0];
}

module.exports = { 
  startOfKstDay, 
  kstAddDays, 
  kstAt, 
  parseKstDateYYYYMMDD, 
  nowKst, 
  utcToKst, 
  kstToUtc,
  formatKstDateTime,
  formatKstDate 
};
