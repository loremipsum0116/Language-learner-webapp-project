// src/api/client.js
import { getGlobalAuthContext } from "../context/AuthContext";

export const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:4000";

export const withCreds = (opts = {}) => ({
  credentials: "include",
  headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  ...opts, // signal, method, body 등을 그대로 허용
});

// AbortError 판별 유틸
export function isAbortError(e) {
  return e?.name === "AbortError" || e?.code === "ABORT_ERR" || String(e?.message || "").includes("aborted");
}

// 외부 signal 과 내부 타임아웃 signal 을 결합
function combineSignals(external, timeoutSignal) {
  if (external && "any" in AbortSignal) {
    // 현대 브라우저: AbortSignal.any 사용
    return AbortSignal.any([external, timeoutSignal]);
  }
  if (!external) return timeoutSignal;
  // 폴백: 두 신호 중 하나라도 abort되면 새 컨트롤러 abort
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  external.addEventListener("abort", onAbort, { once: true });
  timeoutSignal.addEventListener("abort", onAbort, { once: true });
  return ctrl.signal;
}

/**
 * JSON fetch with credentials + timeout + external abort support
 * @param {string} url
 * @param {RequestInit} opts - may include `signal`
 * @param {number} timeoutMs - default 8000ms
 */
export async function fetchJSON(url, opts = {}, timeoutMs = 8000) {
  const timeoutCtrl = new AbortController();
  const id = setTimeout(() => timeoutCtrl.abort(new DOMException("timeout", "AbortError")), timeoutMs);

  const t0 = performance.now();
  try {
    const finalUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
    const signal = combineSignals(opts.signal, timeoutCtrl.signal);

    const res = await fetch(finalUrl, { ...opts, signal });

    const latency = Math.round(performance.now() - t0);
    if (res.status === 401) {
      // Don't auto-handle 401 for login/register endpoints - they need to handle their own auth failures
      const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register');

      if (!isAuthEndpoint) {
        const authContext = getGlobalAuthContext();
        if (authContext && authContext.handleTokenExpiration) {
          authContext.handleTokenExpiration();
        }
      }

      const err = new Error("Unauthorized");
      err.status = 401;
      err.latency = latency;
      throw err;
    }
    if (!res.ok) {
      // 서버가 JSON 에러를 주더라도 안전하게 처리
      let text = "";
      try { text = await res.text(); } catch {}
      const err = new Error(text || "HTTP Error");
      err.status = res.status;
      err.latency = latency;
      throw err;
    }

    // 204/205 같은 바디 없는 성공 응답 처리
    if (res.status === 204 || res.status === 205) {
      return { ok: true, _latencyMs: latency };
    }

    const data = await res.json();
    data._latencyMs = latency;
    return data;
  } finally {
    clearTimeout(id);
  }
}
