// KST(UTC+9) 기반 날짜 유틸
const KST_OFFSET = 9 * 60 * 60 * 1000;

function startOfKstDay(d = new Date()) {
  // 단순히 현재 날짜/시간을 그대로 반환 (테스트용)
  const now = new Date();
  console.log(`[KST] startOfKstDay - current time: ${now.toISOString()}, local: ${now.toLocaleString()}`);
  console.log(`[KST] startOfKstDay - input: ${d.toISOString()}`);
  
  // 오늘 날짜의 자정으로 설정
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  console.log(`[KST] startOfKstDay - result: ${today.toISOString()}, local: ${today.toLocaleString()}`);
  return today;
}

function kstAddDays(kstDate00, days) {
  return new Date(kstDate00.getTime() + days * 24 * 60 * 60 * 1000);
}

function kstAt(kstDate00, hour = 9, minute = 0, second = 0) {
  return new Date(kstDate00.getTime() + ((hour * 60 + minute) * 60 + second) * 1000);
}

function parseKstDateYYYYMMDD(s) {
  // "YYYY-MM-DD"를 KST 00:00(UTC 변환)로
  const [y, m, d] = s.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d);
  return new Date(utc - KST_OFFSET);
}

module.exports = { startOfKstDay, kstAddDays, kstAt, parseKstDateYYYYMMDD };
