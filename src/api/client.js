// src/api/client.js
export const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:4000";

export const withCreds = (opts = {}) => ({
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
});

export async function fetchJSON(url, opts = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const t0 = performance.now();
    try {
        const res = await fetch(url.startsWith("http") ? url : `${API_BASE}${url}`, {
            ...opts,
            signal: controller.signal,
        });
        const latency = Math.round(performance.now() - t0);
        if (res.status === 401) {
            const err = new Error("Unauthorized");
            err.status = 401;
            err.latency = latency;
            throw err;
        }
        if (!res.ok) {
            const text = await res.text();
            const err = new Error(text || "HTTP Error");
            err.status = res.status;
            err.latency = latency;
            throw err;
        }
        const data = await res.json();
        data._latencyMs = latency;
        return data;
    } finally {
        clearTimeout(id);
    }
}
