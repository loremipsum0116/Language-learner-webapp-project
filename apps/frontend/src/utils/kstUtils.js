// src/utils/kstUtils.js
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/ko';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('ko');
dayjs.tz.setDefault('Asia/Seoul');

/**
 * UTC Date를 KST로 변환하여 표시하는 포맷 함수들
 */

// YYYY.MM.DD (ddd) 형식으로 표시
export const formatKstDate = (date) => {
  if (!date) return "-";
  return dayjs.utc(date).tz('Asia/Seoul').format("YYYY.MM.DD (ddd)");
};

// YYYY.MM.DD HH:mm 형식으로 표시
export const formatKstDateTime = (date) => {
  if (!date) return "-";
  return dayjs.utc(date).tz('Asia/Seoul').format("YYYY.MM.DD HH:mm");
};

// HH:mm:ss 형식으로 표시
export const formatKstTime = (date) => {
  if (!date) return "-";
  return dayjs.utc(date).tz('Asia/Seoul').format("HH:mm:ss");
};

// 상대 시간 표시 (예: "3일 전", "1시간 후")
export const formatKstRelative = (date) => {
  if (!date) return "-";
  return dayjs.utc(date).tz('Asia/Seoul').fromNow();
};

// 현재 KST 시간 반환
export const nowKst = () => {
  return dayjs().tz('Asia/Seoul');
};

// UTC Date를 KST dayjs 객체로 변환
export const utcToKst = (utcDate) => {
  if (!utcDate) return null;
  return dayjs.utc(utcDate).tz('Asia/Seoul');
};

// 시간 차이 계산 (밀리초)
export const diffKst = (date1, date2 = null) => {
  const d1 = dayjs.utc(date1).tz('Asia/Seoul');
  const d2 = date2 ? dayjs.utc(date2).tz('Asia/Seoul') : nowKst();
  return d1.diff(d2);
};

// Date 유효성 검사
export const isValidDate = (date) => {
  if (!date) return false;
  return dayjs(date).isValid();
};

export default {
  formatKstDate,
  formatKstDateTime,
  formatKstTime,
  formatKstRelative,
  nowKst,
  utcToKst,
  diffKst,
  isValidDate
};