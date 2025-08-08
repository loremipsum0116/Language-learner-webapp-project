// KST(UTC+9) 기반 날짜 유틸
const KST_OFFSET = 9 * 60 * 60 * 1000;

function startOfKstDay(d = new Date()) {
  // "해당 KST 날짜의 00:00"을 UTC Date로 반환
  const utcMidnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return new Date(utcMidnight - KST_OFFSET);
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
